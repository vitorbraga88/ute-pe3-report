const CACHE_NAME = 'ute-pe3-v2';
const ASSETS = [
  '/ute-pe3-report/',
  '/ute-pe3-report/index.html',
  '/ute-pe3-report/css/styles.css',
  '/ute-pe3-report/js/app.js',
  '/ute-pe3-report/js/validation.js',
  '/ute-pe3-report/js/camera.js',
  '/ute-pe3-report/js/offline.js',
  '/ute-pe3-report/js/signature.js',
  '/ute-pe3-report/js/report.js',
  '/ute-pe3-report/manifest.json',
  '/ute-pe3-report/assets/logo-ute.png',
  '/ute-pe3-report/assets/icons/favicon.ico'
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
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
