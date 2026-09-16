/* Service Worker do "Gestão do Rebanho"
   Guarda os arquivos do app no aparelho para abrir mesmo sem internet.
   (Os DADOS do gado ficam no IndexedDB, separado deste cache.) */

const CACHE = "rebanho-v84";
const CORE = ["./manifest.json", "./icon.png", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./boi.png", "./bezerro.png", "./troca-v81.js", "./troca-v81-core.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function paginaV81(request){
  const res=await fetch(request,{cache:"no-store"});
  if(!res.ok)return res;
  const tipo=res.headers.get("content-type")||"";
  if(!tipo.includes("text/html"))return res;
  let html=await res.text();
  // Cache-busting explícito para que o iPhone não reaproveite o JS antigo da troca de lote.
  html=html.replace(/<script\s+src=["']troca-v81\.js(?:\?[^"']*)?["']><\/script>/gi,'');
  html=html.replace(/<\/body>/i,'<script src="troca-v81.js?v=84"></script></body>');
  const headers=new Headers(res.headers);headers.delete("content-length");headers.delete("content-encoding");
  const out=new Response(html,{status:res.status,statusText:res.statusText,headers});
  const c=await caches.open(CACHE);await c.put("./index.html",out.clone());
  return out;
}

// V84: Supabase e qualquer domínio externo passam direto para a rede e nunca
// entram no Cache Storage. Navegações também buscam a versão mais nova.
self.addEventListener("fetch", e => {
  if(e.request.method!=="GET")return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin)return;
  if(e.request.mode==="navigate"){
    e.respondWith(paginaV81(e.request).catch(()=>caches.match("./index.html")));
    return;
  }
  // Assets com ?v= são sempre buscados na rede primeiro para facilitar atualização do PWA.
  if(url.searchParams.has('v')){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(res=>{
      if(res&&res.ok){const copia=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copia));}
      return res;
    }).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(res=>{
    if(res&&res.ok){const copia=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copia));}
    return res;
  })));
});

self.addEventListener("message",e=>{if(e.data==="SKIP_WAITING")self.skipWaiting();});