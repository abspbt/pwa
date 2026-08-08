/*
  ============ 發布新版本的步驟 ============
  1. 修改 index.html 裡的 const APP_VERSION = '...'（頁面內建的版本比對機制會用到）。
  2. 把下面這行 CACHE_VERSION 改成同樣（或至少不同於舊版）的版本字串
     —— 這一步是「真正觸發」所有使用者強制更新的關鍵，缺這步不會生效。
  3. 重新部署 index.html / sw.js 等檔案到你的伺服器（GitHub Pages、Cloudflare Pages 等）。
  4. 之後任何人打開這個網頁或已安裝的 App，都會在背景抓到新的 sw.js，
     自動清掉舊快取、接管頁面；checkForUpdate() 的輪詢會偵測到新版本並跳出
     「發現新版本」提示條，使用者按「立即更新」才會重新整理看到最新版本。
*/
const CACHE_VERSION = '2026.08.08.3';
const CACHE_NAME = 'duey-' + CACHE_VERSION;

// Google Fonts 故意不放進這裡：cache.addAll() 是全有全無，任何一個 URL
// 失敗就整批都不會被存進去。字型／Tailwind 是裝飾與樣式層，不值得讓它們
// 拖累 index.html/manifest.json 這些核心檔案無法預先快取；讓它們在下面的
// fetch handler 裡「用到時自然被快取」就好。
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
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// 回覆頁面的版本查詢：告訴它「目前實際生效」的是哪個 CACHE_VERSION，
// 讓畫面上的版本註記可以跟自己內建的 APP_VERSION 比對，抓出兩者不同步的狀態。
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_CACHE_VERSION' && event.ports[0]) {
    event.ports[0].postMessage({ cacheVersion: CACHE_VERSION });
  }
});

// Cache-first + stale-while-revalidate：已安裝的使用者開啟時直接吃快取立即
// 顯示畫面，同時在背景打網路更新快取，下次開啟才會生效。
//
// 例外：呼叫端明確用 { cache: 'no-store' } 表示不想要任何快取涉入（例如
// checkForUpdate() 拿當下伺服器版本做比對），這裡尊重這個意圖，直接單純
// 打網路、完全不查快取也不寫入快取——否則它帶時間戳記、每次都獨一無二的
// URL 會在 Cache Storage 裡越積越多、永遠不會再被用到的項目。
//
// 跨網域資源（Google Fonts、Tailwind CDN）在沒有 crossorigin 屬性時會是
// opaque response（status 0、ok 為 false），仍要正常快取起來，否則永遠無
// 法真的被快取住。
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.cache === 'no-store') {
    event.respondWith(fetch(event.request));
    return;
  }

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
