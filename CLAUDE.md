# pwa

一個人維護的小型 PWA 工具集合，部署在 GitHub Pages（自訂網域見 `CNAME`：pwapal.com）。每個子資料夾都是一個**獨立、互不相依**的小工具，各自可直接安裝成 App。

> 最後校對：2026-08-07。本檔的每一項描述都經過實際讀取 main 上的檔案確認。
> 若你（Claude）發現實際程式碼與此處描述不符，**以程式碼為準，並主動回報要求更新本檔**。

## 專案結構

```
/CNAME              # GitHub Pages 自訂網域設定
/<app>/index.html   # 該工具的全部 UI／邏輯，通常單檔內嵌 CSS + JS
/<app>/manifest.json
/<app>/sw.js         # Service Worker，負責離線快取 + 版本更新
```

目前的工具：

| 目錄 | 用途 | 狀態 |
|---|---|---|
| `codewallet` | 條碼／QR code 產生與收納 | 使用中 |
| `duey` | 待辦事項到期提醒 | 使用中 |
| `pricely` | 單價比一比，比較不同賣場、規格商品的單位價格 | 使用中 |
| `hereat` | 規劃中 | **空目錄，沒有 `index.html` / `sw.js`**，不要動 |
| `ledger` | 早期測試用 | **待刪除**（2026-08-07 決定），不要在上面投入工作 |

新增工具時，請延續同樣的資料夾結構（自己的 `index.html` / `manifest.json` / `sw.js`），不要跟其他工具共用程式碼或狀態。

## 開發慣例

- **無建置流程**：所有工具都是純靜態檔案，直接部署即可，不需要 npm/webpack 等工具鏈。
- **單檔優先**：CSS 與 JS 盡量內嵌在 `index.html` 裡，除非依賴的函式庫（如 Tailwind）需要外部載入。
- **介面語言**：UI 文字、註解一律使用**繁體中文**（`lang="zh-Hant"`）。
- **不要過度設計**：這些是給自己與朋友用的小工具，維持精簡、可讀、易維護優先於抽象化或框架化。
- **效能規範**：本 repo 的效能與載入速度要求，一律以 `web-perf-guard` skill 為準。那份是通則，這份 `CLAUDE.md` 只寫本專案的特例與現況。

## Service Worker 快取策略（2026-08-07 校對）

**四個工具目前全部都是 cache-first + stale-while-revalidate。**

> ⚠️ 本檔在 2026-08-06 之前寫的是「`pricely`、`duey` 預設 network-first」，**那已經過時**。三個工具在 08-05～08-06 之間都改成了 cache-first。若看到任何地方仍寫 network-first，那是舊資訊。

行為：有快取就先回應（畫面立即出現），同時在背景打網路更新快取，下次開啟才生效。

**不可以改回 network-first。** 那會讓每次開啟 App 都要等網路，本機快取形同虛設。這個問題在 PageSpeed Insights 上完全測不出來——PSI 測的是「陌生人第一次打開」，而使用者的痛點是「每天開都要等」。

不論哪種策略，都必須：
- `install` 時 `skipWaiting()`
- `activate` 時清掉所有非當前版本的快取 + `clients.claim()`

四個工具目前都有做到這兩點。

### `no-store` 的處理（現況不一致）

fetch handler 應檢查 `event.request.cache === 'no-store'`，遇到就直接打網路、完全不碰 Cache Storage。否則帶時間戳的版本檢查請求會在快取裡不斷累積永遠用不到的項目。

| 工具 | 有沒有處理 `no-store` |
|---|---|
| `duey` | ✅ 有 |
| `ledger` | ✅ 有（但即將刪除） |
| `codewallet` | ❌ **沒有** |
| `pricely` | ❌ **沒有**，而且它每次切回分頁都會 `reg.update()` |

`codewallet` 和 `pricely` 是已知待修項目。

## 版本更新機制（重要）

**每個工具都有「兩個版本號必須手動同步」的規則，而且三個工具的實作方式不同。**

忘記改版本號是最容易踩的坑：程式碼即使改了，使用者端仍會被舊的 Service Worker 快取卡住看到舊版。

| 工具 | `sw.js` 裡改什麼 | `index.html` 裡改什麼 | 目前值 |
|---|---|---|---|
| `codewallet` | `CACHE_NAME` | `BUILD_VERSION` 常數 | `barcode-pwa-v4` |
| `duey` | `CACHE_VERSION` | `APP_VERSION` 常數 | `2026.08.05.4` |
| `pricely` | `CACHE_VERSION` | `<meta name="app-version">` | `2026.08.05.3` |

- `codewallet` 兩邊必須是**完全相同的字串**
- `duey`、`pricely` 建議用日期格式（如 `2026.08.10.1`）
- 這些值都是各自獨立手寫的常數，**沒有建置流程能自動同步**

三個工具的頁面下方都會向目前生效的 Service Worker 詢問實際快取版本，跟頁面自己的版本常數比對，不一致時會醒目標示。**那是防止漏改的最後一道防線，不能取代人工遵守這條規則。**

**每次修改完任一工具的功能／畫面後，在完成前主動詢問使用者要不要一併更新版本號。**

### 更新偵測與提示的行為

| 工具 | 偵測方式 | 發現新版時 |
|---|---|---|
| `codewallet` | SW `controllerchange` + `reg.update()` | 顯示提示條，**不強制重整** |
| `pricely` | SW `controllerchange` + `reg.update()`（每次切回分頁再檢查） | 顯示提示條，**不強制重整** |
| `duey` | 每 10 分鐘 + 切回分頁時，用 `no-store` 重抓自己的 HTML 比對 `APP_VERSION` | 顯示橫幅，**不強制重整** |

**規則：偵測到新版時不可以 `location.reload()`**，要跳出提示讓使用者自己按。強制重整會讓使用者正在填寫的內容消失。

**唯一的例外**：真正的首次安裝（`navigator.serviceWorker.controller` 本來是 null）可以靜默重整一次，此時畫面還沒渲染任何內容，重整沒有風險。`codewallet` 和 `pricely` 都用 `hadController` 旗標處理這個例外，這是正確做法，**新工具請照抄**。

## 外部相依現況（2026-08-07 實查）

**這是目前最主要的效能問題來源。**

| 工具 | 外部網域 | 內容 |
|---|---|---|
| `codewallet` | **5 個** | Tailwind CDN、JsBarcode、qrcodejs、ZXing（`@latest` **未鎖版本**）、Font Awesome |
| `duey` | 2 個 | Tailwind CDN、Google Fonts（**Noto Sans TC 五個字重**，在 `<style>` 裡用 `@import`） |
| `pricely` | 1 個 | Google Fonts（Space Grotesk、Inter、IBM Plex Mono，皆為拉丁字型） |

已知問題，依嚴重度排序：

1. **`codewallet` 在 `<head>` 同步載入 5 個網域**。每多一個網域就多一次 DNS + TCP + TLS 往返。其中 ZXing 只有按「掃描」才用得到，卻在首屏就阻塞渲染，且用 `@latest` 沒鎖版本（行為可能無預警改變）。
2. **`duey` 用 Google Fonts 載入中文字型**。中日韓字型的 `@font-face` CSS 含上百段 `unicode-range`，單一請求可達一兩百 KB，是最嚴重的 render-blocking 來源。而且是寫在 `<style>` 裡的 `@import`，會序列化等待。
3. **Tailwind CDN**（`codewallet`、`duey`）在瀏覽器內即時編譯 CSS，是重量級的 render-blocking 來源。
4. `pricely` 的 Google Fonts 是純拉丁字型，影響小很多，優先度最低。

> `pricely` 舊版本檔曾寫「不依賴外部 CDN（僅使用 Google Fonts）」——那句話自相矛盾，Google Fonts 就是外部 CDN。已更正。

## 資料安全

- `duey` 待辦存在 localStorage（`duey_tasks_v2`、`duey_theme_v1`），**弄丟無法復原**。已有 JSON 匯出備份功能
- `codewallet` 店家資料存在 localStorage（`pwa_barcode_wallet_v2`）
- `pricely` 無持久化儲存（純計算機，輸入只存在記憶體）

localStorage 與 Cache Storage 是兩套獨立機制，改動快取策略不影響使用者資料。但每次改動後仍應提醒使用者確認資料完整。

⚠️ **四個工具共用 `pwapal.com` 這個 origin。** 「清除 pwapal.com 的網站資料」會把所有工具的 localStorage 一起清掉。診斷快取問題時**不可以**建議使用者這樣做。

## 圖示（icon）處理方式

各工具的 `manifest.json` 會宣告 `icon-192.png` / `icon-512.png`，但這些圖示**不會**以獨立檔案存放在 repo 裡。使用者會另外自行製作圖示，交給 Claude 後直接轉成 base64 data URI，內嵌進 `manifest.json` 的 `icons[].src` 與 `index.html` 的 `<link rel="icon">` / `<link rel="apple-touch-icon">`，不要另外新增 `.png` 檔案。

## PR 與部署流程

- 開發分支命名：`claude/<主題>-<隨機碼>`（由 session 指定）
- **一律建 PR，不要直接推 main**
- 合併後即代表已發布到 GitHub Pages（無額外 CI/建置步驟）
- 這個 repo 沒有設定任何 CI（check runs 為 0），不用等 CI 綠燈
- 修改後請回報：實際改了哪幾行，以及 diff 的 `+X -Y`
- **行號一律自己重新讀取檔案取得**，不要沿用對話裡的舊行號

## 實測方式

**PWA 的效能不能只看 PageSpeed Insights。** PSI 測的是全新環境的第一次造訪，測不到快取效果。

手機實測流程：完全關掉 App → 開一次（會慢，正在裝新版）→ 完全關掉 → **再開一次，這次才算數** → 確認畫面最下方版本號已更新。

iOS 從主畫面啟動 PWA 時會播放「圖示放大成視窗」的系統動畫，期間畫面純黑，**這段時間改不掉，所有 App 都一樣**。診斷「開啟慢」時要先扣掉這段固定成本。
