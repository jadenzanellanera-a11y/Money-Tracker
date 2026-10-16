/* Money Tracker — service worker
   Keeps this simple on purpose: it just caches the app's own files the first
   time they load, so the app keeps opening and working even with no internet.
   It never talks to any server of ours — there isn't one. */

const CACHE_NAME = 'money-tracker-v4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './license-config.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => { /* first-load caching is best-effort; app still works online */ })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for the app's own files, so it opens instantly and works offline.
// Anything else (e.g. the occasional exchange-rate lookup) just goes to the network as normal.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const isSameOrigin = event.request.url.startsWith(self.location.origin);
  if (!isSameOrigin) return;

  // The app page itself: ask the network first so updates show up right away,
  // and fall back to the saved copy only when offline.
  const isPage = event.request.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(event.request.url).pathname);
  if (isPage) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached); // offline — fall back to whatever's cached
      return cached || network;
    })
  );
});
