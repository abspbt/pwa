// 簡單記帳 Service Worker
// 快取策略：cache-first + stale-while-revalidate（背景更新，不擋畫面顯示）
const CACHE_VERSION = '2026.08.06.2';
const CACHE_NAME = `ledger-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // 明確要求不快取的請求，直接打網路、不碰 Cache Storage
  if (req.cache === 'no-store') {
    event.respondWith(fetch(req));
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);

      const networkFetch = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => null);

      if (cached) {
        // 背景更新快取，立即回應舊快取
        networkFetch;
        return cached;
      }

      const networkRes = await networkFetch;
      return networkRes || cached || Response.error();
    })
  );
});

// 讓頁面可以查詢目前生效的快取版本，用於偵測「HTML 新、SW 舊」的不一致狀態
self.addEventListener('message', (event) => {
  if (event.data === 'GET_VERSION') {
    event.ports[0].postMessage(CACHE_VERSION);
  }
});
