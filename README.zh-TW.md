# e2Cal.

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md)

> 極簡、本地優先的個人飲食、肌力訓練與體態追蹤 PWA 應用——採用純黑白高對比工程師美學、零官方後端與完整數據主權。

[![Website](https://img.shields.io/badge/website-e2cal.pages.dev-black?style=flat-square&labelColor=white)](https://e2cal.pages.dev/)
![Version](https://img.shields.io/badge/version-1.0.0-black?style=flat-square&labelColor=white)
![Platform](https://img.shields.io/badge/platform-PWA%20%7C%20Web-black?style=flat-square&labelColor=white)
![License](https://img.shields.io/badge/license-AGPL--3.0-black?style=flat-square&labelColor=white)

## 核心特性

- **純粹單色工程美學**：嚴格遵循純黑白高對比設計、扁平細邊框界定層級、零陰影干擾，全站內建本地自託管 Geist、Inter 與 JetBrains Mono 字體搭配 `tabular-nums` 等寬防抖排版。
- **本地優先與離線完備**：所有飲食、訓練與體態記錄透過 IndexedDB（Dexie.js）直接儲存於本機裝置，無官方伺服器與強制帳號系統，安裝 PWA 後 100% 離線可用。
- **精密飲食與營養追蹤**：強制錨定每 `100 g` 純可食部基準，支援淨重／毛重折算、複合食譜、外食情境估算，並內建六大權威食材資料庫（USDA、CFCT、TFDA、MEXT、AFCD、CoFID 共 18,635 筆離線檢索）。
- **肌力訓練與肌群恢復**：採用 Brzycki 公式計算預估 1RM（`e1RM`）與總訓練容量，結合男女雙版前後視角 17 肌群解剖熱力圖與 48h／72h 生理恢復視窗模型。
- **體態指標與熱力學推算**：以 EWMA 指數加權移動平均（`α = 0.15`）平滑每日體重波動，即時推算每日熱力學能量差額、BMI、FFMI、去脂體重（LBM）、脂肪總重、倒三角比與腰臀比。
- **開放數據匯出（BYO-AI）**：一鍵將當日或全量數據匯出為 Markdown／純文本、無損 JSON 或高解析度單色 PNG 數據快照卡，交由外部 AI 或教練分析。
- **Dropbox 同步與 ZIP 備份**：瀏覽器直連使用者自有 Dropbox 進行 OAuth PKCE 增量雙向同步（LWW 合併），並支援開放可讀的完整 ZIP 備份與還原。
- **多語系與多單位切換**：完整支援繁體中文（`zh-TW`）、簡體中文（`zh-CN`）與英文（`en`），底層嚴格採公制 SI 儲存，視圖層無損換算 `kg/lbs`、`g/oz`、`ml/fl oz`、`cm/in`、`kcal/kJ`。

## 技術棧

- **核心框架**：React 19 / TypeScript / Vite
- **介面與樣式**：Tailwind CSS v4 / Base UI / Radix UI / Lucide Icons
- **狀態管理**：Zustand
- **本地資料庫**：IndexedDB（Dexie.js）
- **同步與備份**：Dropbox API（OAuth PKCE）/ JSZip
- **PWA 離線**：vite-plugin-pwa（Workbox Service Worker 與離線預快取）
- **多語系**：react-i18next
- **測試與檢查**：Vitest / Oxlint

## 安裝與使用

### 線上直接體驗

直接在瀏覽器開啟或安裝為 PWA 應用：
👉 **[https://e2cal.pages.dev](https://e2cal.pages.dev/)**

### 環境需求

請確認系統已安裝 Node.js（>= 20.0.0）與 npm。

### 本地開發

```bash
git clone https://github.com/noah-sze/e2Cal.git
cd e2Cal
npm install
npm run dev
```

### 檢查與建置

```bash
npm run check:all
```

或僅建置生產版本：

```bash
npm run build
```

### PWA 與自架部署

將建置生成的 `dist/` 目錄部署至任何支援 HTTPS 的靜態託管平台（如 Cloudflare Pages、Vercel、Netlify 或 GitHub Pages），亦可使用專案內附的 `Dockerfile` 與 `deploy/` Nginx / Caddy 設定一鍵自架。

## 專案架構

e2Cal 採用職責分離的分層架構，明確區分介面呈現、狀態管理、領域服務與本地持久化：

- `src/components/`：原子 UI 基礎元件、精密彈窗、解剖熱力圖與領域複合元件。
- `src/pages/`：主要頁面視圖（總覽、飲食、訓練、體態、設定與產品導覽頁）。
- `src/hooks/`：響應式 Dexie 資料庫查詢與業務操作封裝 Hooks。
- `src/services/`：IndexedDB Schema 與遷移腳本、Dropbox 增量同步引擎、ZIP 備份還原、權威食材檢索與多格式 AI 匯出。
- `src/store/`：由 Zustand 驅動的輕量全域客戶端狀態。
- `src/utils/`：無副作用、具高單元測試覆蓋率的純數學計算函數、單位換算與多語系檢索工具。
- `src/i18n/`：多語系配置與字典檔（`en`、`zh-TW`、`zh-CN`）。

## 授權條款

本專案採用 GNU Affero General Public License v3（AGPLv3）授權。詳見 [LICENSE](LICENSE) 檔案。
