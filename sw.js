/* Service Worker do "Gestão do Rebanho"
   V85: atualização previsível no iPhone sem cachear Supabase. */

const CACHE = "rebanho-v85";
const APP_VERSION = "85";
const CORE = ["./manifest.json", "./icon.png", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./boi.png", "./bezerro.png", "./troca-v81.js", "./troca-v81-core.js"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil((async()=>{
    const ks=await caches.keys();
    await Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();

    // Ao ativar uma versão nova, força as janelas/PWA já abertas a navegarem
    // novamente sob o novo Service Worker. Isso evita ficar preso na versão anterior.
    const cs=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const c of cs){
      try{
        const u=new URL(c.url);
        if(u.origin===self.location.origin){
          u.searchParams.set("appv",APP_VERSION);
          await c.navigate(u.href);
        }
      }catch(_){ }
    }
  })());
});

function atualizadorInline(){
  return `<script>(function(){
    if(!('serviceWorker' in navigator))return;
    var recarregando=false;
    navigator.serviceWorker.addEventListener('controllerchange',function(){
      if(recarregando)return;recarregando=true;
      var u=new URL(location.href);u.searchParams.set('appv','${APP_VERSION}');location.replace(u.href);
    });
    function checar(){navigator.serviceWorker.getRegistration().then(function(r){if(r)r.update();}).catch(function(){});}
    window.addEventListener('load',checar);
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')checar();});
    window.addEventListener('online',checar);
    setInterval(function(){if(document.visibilityState==='visible')checar();},60000);
  })();<\/script>`;
}

async function paginaAtual(request){
  // HTML sempre tenta rede primeiro. Offline usa a última cópia válida.
  const res=await fetch(request,{cache:"no-store"});
  if(!res.ok)return res;
  const tipo=res.headers.get("content-type")||"";
  if(!tipo.includes("text/html"))return res;

  let html=await res.text();
  // Remove loaders antigos e injeta explicitamente a versão atual.
  html=html.replace(/<script\s+src=["']troca-v81\.js(?:\?[^"']*)?["']><\/script>/gi,'');
  html=html.replace(/<\/body>/i,`${atualizadorInline()}<script src="troca-v81.js?v=${APP_VERSION}"></script></body>`);

  const headers=new Headers(res.headers);
  headers.delete("content-length");headers.delete("content-encoding");
  headers.set("cache-control","no-store");
  const out=new Response(html,{status:res.status,statusText:res.statusText,headers});
  const c=await caches.open(CACHE);await c.put("./index.html",out.clone());
  return out;
}

self.addEventListener("fetch", e => {
  if(e.request.method!=="GET")return;
  const url=new URL(e.request.url);

  // REGRA CRÍTICA: Supabase e qualquer domínio externo nunca são interceptados.
  if(url.origin!==self.location.origin)return;

  if(e.request.mode==="navigate"){
    e.respondWith(paginaAtual(e.request).catch(async()=>{
      const cached=await caches.match("./index.html");
      return cached||Response.error();
    }));
    return;
  }

  // Arquivos versionados: rede primeiro, sem reaproveitar resposta HTTP antiga.
  if(url.searchParams.has("v")){
    e.respondWith(fetch(e.request,{cache:"no-store"}).then(res=>{
      if(res&&res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));}
      return res;
    }).catch(()=>caches.match(e.request)));
    return;
  }

  // Demais assets locais: cache-first para manter o app funcionando offline.
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(res=>{
    if(res&&res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));}
    return res;
  })));
});

self.addEventListener("message",e=>{
  if(e.data==="SKIP_WAITING"||e.data?.type==="SKIP_WAITING")self.skipWaiting();
  if(e.data==="CHECK_UPDATE"||e.data?.type==="CHECK_UPDATE")self.registration.update();
});