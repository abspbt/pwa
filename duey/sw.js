/*
  ============ 發布新版本的步驟 ============
  1. 修改 index.html 裡的 const APP_VERSION = '...'（頁面內建的版本比對機制會用到）。
  2. 把下面這行 CACHE_VERSION 改成同樣（或至少不同於舊版）的版本字串
     —— 這一步是「真正觸發」所有使用者強制更新的關鍵，缺這步不會生效。
  3. 重新部署 index.html / sw.js 等檔案到你的伺服器（GitHub Pages、Cloudflare Pages 等）。
  4. 之後任何人打開這個網頁或已安裝的 App，都會在背景抓到新的 sw.js，
     自動清掉舊快取、接管頁面，看到最新版本。
*/
const CACHE_VERSION = '2026.07.29-1';
const CACHE_NAME = 'duey-' + CACHE_VERSION;

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

// 拿資料一律「先試著連網路拿最新的」，只有離線抓不到時才用快取當備援，
// 這樣只要使用者有網路，每次都會是最新版本。
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkRes) => {
        const clone = networkRes.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return networkRes;
      })
      .catch(() => caches.match(event.request))
  );
});
