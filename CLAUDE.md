# pwa

一個人維護的小型 PWA 工具集合，部署在 GitHub Pages（自訂網域見 `CNAME`：pwapal.com）。每個子資料夾都是一個**獨立、互不相依**的小工具，各自可直接安裝成 App。

## 專案結構

```
/CNAME              # GitHub Pages 自訂網域設定
/<app>/index.html   # 該工具的全部 UI／邏輯，通常單檔內嵌 CSS + JS
/<app>/manifest.json
/<app>/sw.js         # Service Worker，負責離線快取 + 強制更新
```

目前的工具：
- `pricely`：單價比一比，比較不同賣場、規格商品的單位價格。純自製樣式，不依賴外部 CDN（僅使用 Google Fonts）。
- `codewallet`：條碼／QR code 產生與收納，依賴外部 CDN（Tailwind、JsBarcode、zxing、Font Awesome）。
- `duey`：使用 Tailwind CDN。

新增工具時，請延續同樣的資料夾結構（自己的 `index.html` / `manifest.json` / `sw.js`），不要跟其他工具共用程式碼或狀態。

## 開發慣例

- **無建置流程**：所有工具都是純靜態檔案，直接部署即可，不需要 npm/webpack 等工具鏈。
- **單檔優先**：CSS 與 JS 盡量內嵌在 `index.html` 裡，除非依賴的函式庫（如 Tailwind）需要外部載入。
- **介面語言**：UI 文字、註解一律使用**繁體中文**（`lang="zh-Hant"`）。
- **不要過度設計**：這些是給自己與朋友用的小工具，維持精簡、可讀、易維護優先於抽象化或框架化。

## Service Worker／版本更新機制（重要）

各工具 `sw.js` 的快取策略：
- 預設（`pricely`、`duey`）：network-first，只要使用者有網路就優先抓最新版本，離線時才退回快取。
- `codewallet`：已改為 **cache-first + stale-while-revalidate**——已安裝的使用者開啟時直接吃快取立即顯示畫面，同時在背景打網路更新快取，下次開啟才會生效。改成這個策略是為了解決「每次開啟都要等外部 CDN 回應才會出畫面」的問題；改動前後都必須維持這裡列出的版本更新機制，否則使用者會一直卡在舊版看不出來。

不論哪種策略，都要在 `install` 時 `skipWaiting()`、`activate` 時清掉舊快取 + `clients.claim()`，讓使用者一開啟就自動更新，不必手動清快取。

**發布新版本時，必須手動更新快取版本號，且同一次改動裡兩個地方要同步**，否則使用者不會拿到新版本，或是拿到「HTML 是新的、SW 快取還是舊的」這種不一致狀態：
- 有版本號機制的工具（如 `pricely`）：修改 `sw.js` 裡的 `CACHE_VERSION`（建議用日期，如 `2026.08.10.1`），同時同步更新 `index.html` 的 `<meta name="app-version">`（純顯示用）。
- `codewallet`：修改 `sw.js` 裡的 `CACHE_NAME`（如 `barcode-pwa-v3` → `v4`）**時，必須同步把 `index.html` 裡的 `BUILD_VERSION` 常數改成完全相同的字串**。這兩個值目前是各自獨立手寫的常數，沒有建置流程能自動同步——**只要動了 `sw.js` 就要動 `BUILD_VERSION`，反之亦然，兩者缺一不可**。頁面最下方的版本註記會在執行時向目前生效的 Service Worker 詢問實際快取版本，若跟 `BUILD_VERSION` 對不上會立刻用醒目樣式標示「版本不一致」——這是防止漏改的最後一道防線，但不能取代人工遵守這條規則。

忘記改版本號是最容易踩的坑：程式碼即使改了，使用者端仍會被舊的 Service Worker 快取卡住看到舊版。

**每次修改完任一工具的功能／畫面後，在完成前主動詢問使用者要不要一併更新版本號**，確認要更新的話再依上述規則同步改好對應的版本常數並提交，讓已安裝的使用者能強制更新到最新版。

## 圖示（icon）處理方式

各工具的 `manifest.json` 會宣告 `icon-192.png` / `icon-512.png`，但這些圖示**不會**以獨立檔案存放在 repo 裡。使用者會另外自行製作圖示，交給 Claude 後直接轉成 base64 data URI，內嵌進 `manifest.json` 的 `icons[].src` 與 `index.html` 的 `<link rel="icon">` / `<link rel="apple-touch-icon">`，不要另外新增 `.png` 檔案。

## PR 與部署流程

- 開發分支命名：`claude/<主題>-<隨機碼>`（由 session 指定）。
- 合併後即代表已發布到 GitHub Pages（無額外 CI/建置步驟）。
- 這個 repo 目前沒有設定任何 CI（check runs 為 0），不用等 CI 綠燈，合併前確認程式碼本身沒問題即可。
