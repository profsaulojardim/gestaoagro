/* Service Worker do "Gestão do Rebanho"
   Guarda os arquivos do app no aparelho para abrir mesmo sem internet.
   (Os DADOS do gado ficam no IndexedDB, separado deste cache.) */

const CACHE = "rebanho-v80";
const CORE = ["./", "./index.html", "./manifest.json", "./icon.png", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./boi.png", "./bezerro.png"];

// Instala: baixa e guarda os arquivos essenciais
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

// Ativa: limpa caches antigos de versões anteriores
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// V74: navegações usam rede primeiro para uma versão nova do app aparecer
// imediatamente; offline continua usando o index.html em cache. Os demais
// arquivos permanecem cache-first.
// V76/V77/V78/V79/V80: o service worker só interfere em arquivos do PRÓPRIO app.
// Requisições externas (principalmente Supabase) passam direto para a rede
// e nunca entram no Cache Storage, evitando respostas antigas na sincronização.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copia));
        }
        return res;
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res && res.ok) {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
      }
      return res;
    }))
  );
});
