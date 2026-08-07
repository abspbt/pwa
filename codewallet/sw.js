// Service Worker for Offline PWA Support
const CACHE_NAME = 'barcode-pwa-v7';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://unpkg.com/@zxing/library@0.23.0/umd/index.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();

      // Tell already-open pages a new version just took over, so they can
      // prompt the user to reload instead of silently staying on stale DOM.
      const clientsList = await self.clients.matchAll({ type: 'window' });
      clientsList.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }));
    })()
  );
});

// Answer the page's runtime version check with the cache name this exact
// worker instance is running, so the version footer can detect drift
// between the deployed HTML's BUILD_VERSION and the active Service Worker.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_CACHE_VERSION' && event.ports[0]) {
    event.ports[0].postMessage({ cacheVersion: CACHE_NAME });
  }
});

// Cache-first + stale-while-revalidate: respond from cache immediately for
// instant paint (this is what makes an installed/home-screen launch fast),
// then refresh the cache in the background so the next launch gets the
// latest version. Falls back to network when nothing is cached yet.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);

      const networkFetch = fetch(event.request).then((networkResponse) => {
        if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => cached);

      event.waitUntil(networkFetch);

      return cached || networkFetch;
    })
  );
});
