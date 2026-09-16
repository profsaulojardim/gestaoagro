/* Service Worker do "Gestão do Rebanho"
   Guarda os arquivos do app no aparelho para abrir mesmo sem internet.
   (Os DADOS do gado ficam no IndexedDB, separado deste cache.) */

const CACHE = "rebanho-v81";
const CORE = ["./", "./index.html", "./manifest.json", "./icon.png", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./boi.png", "./bezerro.png", "./troca-v81.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// V81: mantém rede-primeiro nas navegações e nunca intercepta Supabase/outros domínios.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then(res => {
      if (res && res.ok) {
        const copia = res.clone();
        caches.open(CACHE).then(async c => {
          await c.put("./index.html", copia);
          try {
            const patch = await fetch("./troca-v81.js", {cache:"no-store"});
            if (patch.ok) await c.put("./troca-v81.js", patch.clone());
          } catch (_) {}
        });
      }
      return res;
    }).catch(() => caches.match("./index.html")));
    return;
  }

  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    if (res && res.ok) {
      const copia = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copia));
    }
    return res;
  })));
});

// Injeta apenas o módulo V81 nas páginas do próprio PWA, sem alterar chamadas externas.
self.addEventListener("message", e => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});
