/*
  ============ 發布新版本的步驟 ============
  1. 修改 index.html 裡 <head> 的 <meta name="app-version" content="..."> （純粹顯示用，方便你自己確認）
  2. 把下面這行 CACHE_VERSION 改成新的版本字串（例如日期 '2026.08.10.1'）
     —— 這一步是「真正觸發」所有使用者強制更新的關鍵，缺這步不會生效。
  3. 重新部署 index.html / sw.js 等檔案到你的伺服器（GitHub Pages、Cloudflare Pages 等）。
  4. 之後任何人打開這個網頁或已安裝的 App，都會在背景抓到新的 sw.js，
     自動清掉舊快取、接管頁面；已安裝的使用者會看到「有新版本可用」提示，
     自行選擇時機重新整理即可看到最新版本（見 index.html 的更新提示機制）。
*/
const CACHE_VERSION = '2026.08.05.3';
const CACHE_NAME = 'price-compare-' + CACHE_VERSION;

// Google Fonts 故意不放進這裡：cache.addAll() 是全有全無，任何一個 URL
// 失敗就整批都不會被存進去。字型是純裝飾（CSS 已有 sans-serif 備援），
// 不值得讓它拖累 index.html/manifest.json 這些真正必要的核心檔案無法預先
// 快取；讓它在下面的 fetch handler 裡「用到時自然被快取」就好。
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// 安裝新版本 Service Worker：預先快取核心檔案，並立刻取代舊版（不用等分頁關閉）
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
});

// 啟用新版本：刪除所有舊版本快取，並立即接管所有分頁
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();

      // 告訴已經開著的分頁「新版本已經接管」，讓它們可以跳出提示、
      // 而不是默默停留在舊畫面（尤其現在是 cache-first，分頁可能開很久）。
      const clientsList = await self.clients.matchAll({ type: 'window' });
      clientsList.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }));
    })()
  );
});

// 回覆頁面的版本查詢：告訴它「目前實際生效」的是哪個 CACHE_VERSION，
// 讓畫面上的版本文字可以跟自己內建的 app-version 比對，抓出兩者不同步的狀態。
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_CACHE_VERSION' && event.ports[0]) {
    event.ports[0].postMessage({ cacheVersion: CACHE_VERSION });
  }
});

// Cache-first + stale-while-revalidate：已安裝的使用者開啟時直接吃快取立即
// 顯示畫面，同時在背景打網路更新快取，下次開啟才會生效。跨網域資源（Google
// Fonts）在沒有 crossorigin 屬性時會是 opaque response（status 0、ok 為
// false），仍要正常快取起來，否則字型永遠無法真的被快取住。
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
