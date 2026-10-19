// CBO Documentos — service worker: app sin internet y documentos guardados en el celular
const VERSION = "cbo-documentos-v1";
const SHELL = [
  "./", "index.html", "manifest.json", "docs/catalogo.js",
  "icon-192.png", "icon-512.png", "apple-touch-icon.png", "logo-verde.png", "logo-beige.png",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
];
const DOCS = "cbo-documentos-archivos";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== DOCS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // PDF y Word: se guardan la primera vez que se abren y luego funcionan sin internet
  if (/\/docs\/.+\.(pdf|docx)$/.test(url.pathname)) {
    e.respondWith(caches.open(DOCS).then(async (c) => {
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Página y catálogo: primero internet (para tener lo último); sin internet, lo guardado
  if (url.origin === location.origin && (req.mode === "navigate" || url.pathname.endsWith("catalogo.js"))) {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))));
    return;
  }

  // Lo demás (íconos, letras, visor de PDF): lo guardado primero
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && (url.origin === location.origin || /cdnjs|gstatic|googleapis/.test(url.host))) {
      const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy));
    }
    return res;
  })));
});
