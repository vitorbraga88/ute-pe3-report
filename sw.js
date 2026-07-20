const CACHE_NAME = 'ute-pe3-v6';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/validation.js',
  './js/camera.js',
  './js/offline.js',
  './js/signature.js',
  './js/report.js',
  './manifest.json',
  './assets/logo-ute.png',
  './assets/icons/favicon.ico'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // nunca intercepta POST (webhook)
  const isAsset = /\.(png|jpg|jpeg|ico|svg|woff2?)$/.test(new URL(req.url).pathname);
  if (isAsset) {
    // cache-first para imagens/ícones
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        return res;
      }))
    );
  } else {
    // network-first para HTML/JS/CSS: online sempre atualizado, offline usa cache
    e.respondWith(
      fetch(req, { cache: 'no-cache' }).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        return res;
      }).catch(() => caches.match(req))
    );
  }
});
