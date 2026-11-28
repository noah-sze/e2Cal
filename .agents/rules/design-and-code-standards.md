---
trigger: always_on
---

# UI/UX 設計標準與工程代碼規範 (Design & Code Standards)

## 0. 最高架構總綱：單一真理源與三層複用架構 (SSOT & Reusability Architecture)
- **最高紀律 (Supreme Standard)**：全應用程式嚴格維持「**一處修改，全域變動，始終統一**」。只要有 2 處或以上出現相同或相似結構，絕對嚴禁複製貼上代碼，必須立即收斂為通用元件。
- **三層複用架構 (Three-Tier Reusability Architecture)**：
  - **L1. 視覺與 Design Tokens (Tokens as SSOT)**：顏色、字級、間距、圓角、遮罩等一律引用全域 CSS 變數與 Tailwind 語意類名（`bg-background`, `text-foreground`, `border-border` 等），嚴禁模組私自維護或使用魔術數值。
  - **L2. 原子元件 (Primitive & Base Components)**：所有基礎控件（按鈕、輸入框、彈窗、選單、下拉框等）統一由 `src/components/ui/`（Shadcn UI / Radix）作為唯一真理源封裝，嚴禁業務層繞過共用元件手寫原生標籤。
  - **L3. 領域模式與複合元件 (Domain Patterns & Layout Blocks)**：列表條目（`UsageListItem`）、指標卡片（`MetricCard`）、數值輸入組等複合結構統一抽象為 Pattern 元件，嚴禁在業務頁面複製貼上 JSX。
- **擴展合約與防污染規範 (Extension Contract & Anti-Corruption)**：元件擴展必須透過標準 Variant（`cva`）或 Props 參數正規擴展；嚴禁業務層透過 `!important` 強制覆蓋核心樣式。

---

## 1. 核心視覺風格與排版體系 (Visual Style & Typography System)
- **Vercel 極簡工程師美學**：純黑白高對比（`#000` / `#fff`）、扁平無陰影（**絕對禁止卡片或容器使用任何陰影**，層級全靠 `border-border` 界定）、全域統一懸停回饋 `hover:bg-hover`、無數據佔位符唯一採用單破折號「`-`」。
- **跨端雙軌排版標準 (iOS HIG Mobile + macOS HIG Desktop)**：
  - **手機端 (`< 768px`)**：根字級預設為 **`17px`**（iOS 標準 Body 17pt，解決易讀性並徹底防止 iOS Safari 輸入框聚焦自動放大跑版）。微排版階層：Footnote 13px (`--text-xs: 0.765rem`)、Caption 1 12px (`--text-2xs: 0.706rem`)、Caption 2 11px (`--text-3xs: 0.647rem`，最低辨識極限)。動態縮放：緊湊 15px / 標準 17px / 較大 19px。
  - **桌面端 (`>= 768px`)**：根字級自動切換為 **`14px`**（macOS 系統正文與 Vercel 核心基準），維持高資訊密度儀表板質感。動態縮放：緊湊 13px / 標準 14px / 較大 15px。
  - **真理源**：由 `src/index.css` 之 `@media (min-width: 768px)` 驅動 CSS 變數 `--ui-base-font-size` 與 `--ui-desktop-font-size`，全站間距尺寸嚴格採 `rem` 單位，實現硬體級瞬時自適應等比縮放。
- **字級與行距雙軸綁定矩陣 (Scale & Leading Binding)**：
  - 文字尺寸必須與行距（Leading）強制成對鎖定，嚴禁依賴預設行高：
    - `Large Title`（34px / 28px）：綁定 `leading-[1.2]`。
    - `Title 1 / 2`（28px～22px / 20px）：綁定 `leading-[1.25]`。
    - `Headline`（17px / 14px）：綁定 `leading-[1.29]`（22px），字重 `font-semibold`。
    - `Body`（17px / 14px）：綁定 `leading-[1.29]`（22px），字重 `font-normal`（全站核心正文基準）。
    - `Subheadline`（15px / 13px）：綁定 `leading-[1.33]`（20px）。
    - `Footnote`（13px / 12px）：綁定 `leading-[1.38]`（18px）。
    - `Caption 1 / 2`（12px～11px / 11px）：綁定 `leading-[1.33]`（15px）。
- **粗體邊界與微字重契約 (Font Weight Disciplines)**：
  - **結構專屬**：粗體僅用於定義佈局骨架（標題、獨立數據數值），**嚴禁在正文段落中隨機挑詞加粗**，維護均勻排版灰度。
  - **自然繼承**：產品名（`e2Cal`）與專有名詞出現在正文中時，嚴格繼承所在段落字重，嚴禁強制加粗。
  - **Vercel 微字重與代碼優先**：介面以 **Medium (500) / Semibold (600)** 為強調上限；技術參數、鍵值、路徑與指令**一律以行內代碼（`code` / `font-mono`）標記，嚴禁加粗**。
- **Apple 四級語意文字灰度 (Hierarchical Label System)**：
  - **Primary** (`text-foreground`，100%)：核心標題、輸入文字、關鍵物理數據。
  - **Secondary** (`text-muted-foreground`，約 60%～65%)：副標題、次要描述、欄位名。
  - **Tertiary** (`text-muted-foreground/60`，約 35%～40%)：輸入框佔位符（Placeholder）、空數據破折號、輔助單位。
  - **Quaternary** (`text-muted-foreground/30`，約 15%～20%)：極淡輔助圖標、分割元素。
- **數值與圖文基線微排版 (Metrics & Precision Alignment)**：
  - **數值與單位唯一真理源 (`<MetricValue />`)**：所有「數字 + 物理單位」（如 `10 g`、`863 kcal`、`75 kg`）一律強制由 `@/components/ui/metric-value` 之 `<MetricValue />` 渲染，**絕對嚴禁在 JSX 模板中手寫字串空格（如 `${val} g` 或 `10 g`）**。
  - **2px 黃金微距契約 (`ml-0.5`)**：捨棄 ASCII 空格字元（避免在等寬字體下被拉大至 8px～10px 造成視覺割裂），數值與單位之間一律由 CSS `ml-0.5`（0.125rem ≈ 2px）精確鎖定，呈現緊湊且自然的專業儀表質感。
  - **雙字體分離與層級律動**：數值本體鎖定 `font-mono tabular-nums`（等寬防抖）；計量單位採用 `font-sans text-muted-foreground`（比例字體自然緊湊且灰度降級）。外層中文語意與數值之間採用 `gap-1.5`（6px 盤古之白），嚴格維持「**外層詞間距 6px > 單位內微距 2px**」的均勻微排版層次。
  - **基線平齊**：數值與單位必須嚴格使用 `items-baseline`，底部平齊，嚴禁居中懸浮。
  - **絕對防折行**：所有「數字 + 物理單位」強制成組 `whitespace-nowrap`，嚴禁數字與單位拆散折行。
  - **等寬防抖**：動態變動數值、計時器強制啟用 `tabular-nums`，消除數字跳動抖動。
  - **防截斷紅線**：重量、次數、熱量、體重、日期等物理客觀事實，**絕對禁止使用 `truncate` 省略號截斷**。
- **官方品牌字標規範 (Brand Wordmark: Geist Sans)**：
  - 產品名 **`e2Cal`** 在全站嚴格採用 `Geist Sans`（`@fontsource-variable/geist`），Token 為 `--font-brand` 與 `--tracking-brand: -0.03em`。JSX 一律由 `<BrandWordmark />`（獨立標誌鎖定 `variant="lockup"` 600）或 `<BrandText />`（行內自然繼承字重）輸出；Canvas 繪製採用 `BRAND_FONT`。
- **排版細節**：統計數據採用 `font-mono`；大標題緊湊字距（`tracking-tight`），小標籤大寫寬字距（`uppercase tracking-widest text-xs`）；中文與英數之間嚴格插入半形空格（Pangu Spacing）。
- **100% 本地自託管字體與零外部阻塞資源契約 (Zero External Fonts & Local-First Asset Standard)**：
  - **絕對零外部外鏈**：全應用程式（包含 HTML `<head>`、CSS 檔案與各元件）**絕對嚴禁引入任何外部第三方 CDN 字體或外鏈樣式表**（如 Google Fonts、Typekit、外部 CDN 等）。
  - **本機打包與離線預載**：所有字體資源一律嚴格透過 npm 本地依賴（`@fontsource-variable/*`）自託管打包，並交由 Service Worker 100% 離線預快取；非核心輔助字體僅允許採用系統內建回退（如 `Georgia`, `Cambria` 等系統襯線字體）。
  - **杜絕首屏渲染阻塞**：嚴格保障 Local-First PWA 瞬時啟動體驗，徹底根除連網時瀏覽器強制等待外部 CDN 進行 DNS 解析、TLS 握手與下載外鏈 CSS 所造成的渲染阻塞（Render-Blocking），確保連網與離線啟動性能絕對一致（毫秒級秒開）。

---

## 2. 佈局、組件與跨端通用契約 (Layout, Components & Cross-Platform)
- **跨端架構契約**：拒絕平台特化補丁；全面採用樹狀 100% 高度（`height: 100%`），主滾動由 `<main className="flex-1 overflow-y-auto">` 自適應接管，禁止在根容器使用 `100vh`。
- **組件尺度與容器自適應契約 (No Hardcoded Height & Flex Degradation)**：
  - **觸控尺度**：手機端按鈕/表單行基準維持 `38px` ～ `44px`；桌面端基準維持 `31.5px` ～ `36px`（`h-8` / `h-9`），由 `rem` 單位自動自適應映射。
  - **`min-h` 優先原則**：承載文字之條目、按鈕、卡片**嚴禁寫死固定高度（如 `h-11`）**，一律採用 `min-h-*` 搭配 `py-*`（如 `min-h-11 py-2`），高度由「行高 + 內邊距」自然撐開。
  - **彈性降級與長度緩衝**：列表橫向排列需具備在窄螢幕或大字級下的自動折行（`flex-wrap` / `flex-col`）容錯能力；文字容器禁濫用 `overflow-hidden` 避免文字被削切；預留 30%～50% 多語系（i18n）文字膨脹緩衝。
- **列表與表單佈局 (Usage Dashboard)**：
  - 表格式列表採用 `divide-y divide-border`。
  - **嚴禁列表橫向堆疊多按鈕**：凡涉 2 個以上選項切換，右側一律採用標準 `Select` 下拉選單，嚴禁橫向排列多個按鈕擠壓排版。
- **精密彈窗標準規範 (Standard Precision Modal Architecture)**：
  - **底層真理源**：所有表單與管理 Dialog 一律採用 `@/components/ui/dialog` 之 `<PrecisionDialogContent>`（或 `DialogContent size="standard"`）。
    - 寬度：`w-[320px] max-w-[calc(100vw-24px)] sm:w-[320px] sm:max-w-[320px]`。
    - 內邊距：全端恆定 `16px`（`p-4 sm:p-4`，杜絕桌面端洩漏 24px 大邊距）。
    - 外觀：`text-xs select-none shadow-none bg-card border border-border`（預設 `font-sans`，僅數值、單位與日期數字使用 `font-mono`），原生級瞬時彈出（Instant Pop，禁慢速漸入動畫）。
  - **外層 Flex 居中**：外層 `fixed inset-0 flex items-center justify-center p-4 pointer-events-none`，彈窗本體為普通 block。
  - **平鋪兄弟節點**：**絕對禁止彈窗巢狀聲明**（Dialog 內部寫 Dialog），次級彈窗遮罩與本體必須指定更高層級（如 `z-[70]` 對 `z-[60]`）。
  - **焦點管理**：彈窗掛載**嚴禁輸入框 `autoFocus` 或 JS 主動 `.focus()`**，避免鍵盤自動彈出遮擋。
  - **毛玻璃與遮罩**：遮罩採用語意化變數 `bg-overlay backdrop-blur-[2px]`，**嚴禁在動態 CSS 變數使用 Tailwind 透明度修飾符**（防舊版 WebKit 不支援 `color-mix()` 導致實色 Bug）。
  - **標準標頭與內部律動**：
    - 標頭：統一由 `<PrecisionDialogContent>` 宣告或 `<DialogPrecisionHeader />` 渲染（左取消 ✕、中客觀名詞、右確認 ✓，高度恆定 `h-7`）。
    - 內部間距：頂部留白 `pt-3.5`、主區塊間距 `space-y-3`（表單 `space-y-3.5`）、微型組件成組 `space-y-1.5`、Usage List 行高 `min-h-12 py-2 px-3 sm:px-4`。
  - **動作按鈕佈局**：DialogFooter 嚴格單行水平並排（左取消、右確認，禁移動端垂直倒序）；破壞性高危按鈕一律採用實色紅底純白文字（`bg-destructive text-destructive-foreground`）。
- **外部 AI 掛載助手規範 (External AI Assistant Architecture)**：
  - **原生 Dialog 純淨無侵入**：所有業務表單與精密彈窗必須保持 100% 純淨，**嚴禁在原生 Dialog 卡片內部嵌入 AI 觸發按鈕、拆解清單或狀態條**；未配置 AI 金鑰時，原生介面應與無 AI 版本完全一致。
  - **外部懸浮掛載與單向注入**：AI 一律作為「外部掛載助手」獨立懸浮於彈窗之外（與主體彈窗卡片保持明顯空間分離與視覺區隔）。識別進度與成分拆解預覽皆於外部助手容器內就地完成，識別完畢後再由使用者觸發單向注入數據至原生表單，確保原生彈窗幾何高度與交互節奏不被破壞。
- **視圖導航與歷史堆疊契約**：
  - 頁面內部 Tab 切換（如使用中 / 已歸檔）純本地狀態管理（`useState`），**嚴禁以 Query 參數（`?tab=...`）污染 URL 與瀏覽器歷史**；點擊瀏覽器返回必須直達上一層頁面。

---

## 3. 代碼、型別與極簡文案規範 (Code, TypeScript & Copy Standards)
- **架構分層與關注點分離**：計算、非同步請求與資料庫操作收斂於 Hooks/Services，UI 僅負責狀態渲染與事件派發，JSX 模板嚴禁撰寫複雜資料推算。
- **TypeScript 靜態約束**：嚴格啟用型別檢查，**絕對禁止使用 `any` 型別**。
- **全域零硬編碼文本與 i18n 契約 (Zero Hardcoded Text & Pure i18n Standard)**：
  - **零硬編碼紅線 (Zero Hardcoded Text)**：全應用程式所有使用者可見文本（含標題、對話框、欄位標籤、按鈕、說明文字、Toast 提示、錯誤通知、輸入框 Placeholder、ARIA 輔助文字、選單選項等），**絕對嚴禁在 JSX、元件或服務層中硬編碼自然語言字串**，一律強制透過 `t('key')` 經由 i18n 資源庫統一輸出。
  - **全語系同步維護 (Multi-Language Sync)**：凡新增、修改或刪除任何語意鍵值（key），必須**同步更新現有所有已支援之語言字典**（`src/locales/` 下之所有語系檔案），嚴禁單一語言缺失或落單。
  - **豁免例外白名單 (Allowlist Exceptions)**：
    1. 客觀官方品牌名、技術標誌或產品名（如 `e2Cal`、`Google Gemini`、`OpenAI`、`Anthropic`、`Dropbox`、`Docker` 等客觀固定名稱）。
    2. 物理標準單位（如 `g`、`ml`、`kg`、`kcal`、`cm` 等 SI 度量衡符號，一律經由 `<MetricValue />` 或單位轉換純函數輸出）。
    3. 使用者自行輸入或資料庫既有之自訂實體（如使用者自訂的食材名、自訂品牌、自訂動作名稱）。
  - **翻譯品質契約**：**絕對嚴禁使用「xx/xx」模糊並列翻譯**（必須提煉單一客觀精確詞彙），禁止中英夾雜或未翻譯殘留。
  - **中文引號統一契約**：所有中文語系（包含繁體中文 `zh-TW` 與簡體中文 `zh-CN`）之介面文案與字典檔案一律統一使用直角引號「`「」`」（巢狀引號使用『』），**嚴禁於簡體中文翻譯中使用彎引號（`“”`、`‘’`）**，維持全站視覺與排版美學一致。
- **精密測量儀測試守則**：e1RM、EMA 抗噪體重、供能比、能量差額等純數學計算函數必須維持 100% 單元測試覆蓋率，且覆蓋 0、負數、除以零等異常邊界。
- **全局極簡文本契約 (The 5 Rules of Ultra-Concise Copy)**：
  1. **去上下文冗餘**：已有頁面語境時，嚴禁重複提及對象綴詞（使用「新增」、「編輯」、「已歸檔」，嚴禁「新增自定義食物」）。
  2. **去口語與客套廢話**：零修飾、零說教，嚴禁「請…」、「您可以…」、「成功完成…」。
  3. **動作動詞純粹化**：統一使用最短有力強動詞（「新增」、「儲存」、「匯出」、「刪除」）。
  4. **通知 Toast 極限精簡**：對象 + 結果，2～4 個字結束（「已儲存」、「已刪除」）。
  5. **空狀態客觀陳述**：客觀陳述現狀，零情緒與說教（「無食材」、「無飲食記錄」）。

---

## 4. 領域數據模型與常數契約 (Domain Data & Model Contracts)
- **純可食淨重基準與稱重雙態規範 (Net Weight & Dual-State Weighing Standard)**：
  - **純可食部 100g 基準 (Edible Portion Only SSOT)**：食材在資料庫中的營養常數（熱量、碳水、蛋白質、脂肪等），強制錨定於**每 100g 純可食部 (Edible Portion)**，絕不包含不可食用骨、殼、果核等殘渣重量。
  - **物理度量唯一性 (Strict Metric Standard)**：系統內部及 UI 輸入一律以克（`g`）或毫升（`ml`）為唯一底層物理度量單位，**嚴格禁止引進「隻、個、塊、盤、份」等模糊估算量詞**。
  - **全量食物對齊可食淨重 / 毛重雙態稱重規範 (Universal Net / Gross Weighing Standard)**：所有食物在稱重輸入介面（數字鍵盤、編輯飲食記錄彈窗等）**一律全量無條件展示「可食淨重 / 毛重」切換器**，建立一致且可預期之心智模型：
    - **無損耗食材 (`refuseRate === 0` 或未設定)**：「毛重」選項固定展示但設為禁用（`disabled`，置灰且禁止點擊），明確標註「不可食損耗：0%」，預設維持於可食淨重。
    - **有損耗食材 (`refuseRate > 0`)**：「毛重」選項正常可用，標註食材之實際不可食損耗百分比。
  - **稱重雙態心智模型與物理折算係數**：
    $$\text{可食淨重 (quantity)} = \text{毛重 (grossQuantity)} \times (1.0 - \text{refuseRate})$$
    - 日誌記錄表 `food_logs` 的 `quantity` **永遠只記錄客觀純可食淨重克數**，全應用所有熱量與營養素計算皆以 `quantity` 為唯一真理源。
    - 用戶以毛重稱重時，毛重數值以可選欄位 `grossQuantity` 記錄，**僅供介面回顯與歷史追溯，絕對嚴禁以毛重直接計算熱量**。
- **純使用者自建食材庫與食物名稱對照表 (User-Built Food Library & Synonym Table)**：
  - **零內置寫死食材庫 (No Preset Food Database)**：軟體本身 100% 不收錄、不維護寫死之預設食材庫。食材完全由使用者自主添加或自內置六大權威科研庫（USDA / CFCT / TFDA / MEXT / AFCD / CoFID 共 18,635 筆離線化驗數據，`src/services/db/authorityFoods.json`）依需導入。
  - **食物名稱對照表維護標準 (Food Synonym Maintenance)**：開發者僅集中維護 `src/utils/multilingualAliases.ts` 之通用「食物名稱對照表 (`FOOD_SYNONYM_GROUPS`)」，確保跨地區常用俗名與異名（如「紅薯、番薯」對應官方「地瓜、甘薯」）能無縫穿透檢索六大權威科研資料庫。
  - **品牌命名與客觀計量**：品牌食品統一為「`品牌 · 名稱`」；固體一律以克 (`g`)、液體一律以毫升 (`ml`) 為唯一底層計量真理源，**嚴格禁止「1 勺」、「1 碗」、「中顆」等模糊量詞**。
- **三大營養素全域統一排序契約 (Strict Macro Order: C -> P -> F)**：
  - 全應用程式（方塊矩陣、表單輸入列、HUD 看板、文字副標、過濾選單等）中涉及三大元素時，**嚴格統一固定為「碳水化合物 -> 蛋白質 -> 脂肪 (C -> P -> F)」**，絕對嚴禁顛倒順序。
- **微量元素（鈉 Sodium）專屬水青電解質色彩契約**：
  - 鈉作為調控體液滲透壓與電解質平衡之微量元素，介面展示、進度條、成分卡片與輸入欄位統一採用**水青湖綠 (Teal)** 色系（Token 為 `--sodium`，亮色 `#0d9488` / 深色 `#14b8a6`），嚴禁使用批判性警示紅黃色。
- **預留營養屬性對外隱藏契約 (Reserved Nutrient Attributes — UI Hidden)**：
  - **預留屬性清單**：`飽和脂肪 (saturatedFat)`、`反式脂肪 (transFat)` 均為領域模型之**預留屬性**，不得出現於使用者端介面（包含成分卡片、儀表板進度條、展開氣泡與表單輸入）。
  - **心智減負與可移除性**：此類指標只會增加使用者記錄門檻與心智負擔；現階段僅於資料層保留結構相容性，**禁止於 UI 層新增或恢復其展示與輸入入口**，未來可視演進直接刪除相關代碼與欄位。
- **純 ID 關聯正規化原則 (Strict Pure ID Association & Dynamic Hydration)**：
  - 專案所有資料庫實體（IndexedDB）、同步分卷與備份結構中，凡多對一或組合引用，**持久層僅允許儲存外鍵 ID 及物理事實量**。
  - **絕對嚴禁儲存反正規化快照欄位**（如 `foodName`, `exerciseName`, `calories` 等可變屬性）；展示指標於前端記憶體透過維度表即時 Join 動態解析裝載。
- **全域實體平權與去主觀欄位契約**：
  - 領域實體主鍵一律採用標準 RFC 4122 UUID（預設種子採用靜態固定 UUID），**嚴格禁止使用語意化 Slug ID**（如 `food_chicken_breast`）。
  - 每日飲食背景僅記錄客觀生理參數，**全域嚴格禁止 `planName` 欄位**。
  - 訓練日誌實體僅記錄客觀物理事實，**全域嚴格禁止 `WorkoutLog.title` 欄位**。
  - 動作課表僅代表項目編排結構，**全域嚴格禁止配置組數 `RoutineExerciseItem.defaultSets` 欄位**。
- **雲端連線原子化 Staging 契約 (Atomic Cloud Connection Staging)**：
  - 多步驟雲端連線／首次同步流程中，未完成原子提交前，憑證與啟用渠道（`ProviderId`）僅允許暫存於記憶體 Staging，嚴禁提早寫入 `localStorage`；任一步驟失敗或取消皆須完整回滾並保留原連線狀態。

---

## 5. 違規紅線速查清單 (Strict Prohibitions Checklist)
以下 39 項行為在專案中被**絕對禁止**：
1. **不得進行主觀批判與行為干涉**：嚴禁指示「該吃什麼」、「超標了」、「少練了」等批判警示或紅色超標卡片。
2. **不得 Copy-Paste JSX**：凡重複 2 次以上必須抽離為共用元件。
3. **不得使用 Arbitrary 任意數值與魔術色碼**：嚴禁使用未經 Tokens 定義的臨時值。
4. **不得在容器或卡片上使用陰影**：絕對禁止 `shadow-*`，層級全靠邊框。
5. **不得在列表行右側堆疊多個水平按鈕**：多選項切換一律採用 `Select` 下拉選單。
6. **不得使用任何硬編碼文本（品牌與客觀專有名詞除外）**：全 UI 介面、彈窗、提示、錯誤通知與佔位符 100% 透過 `t('key')` 輸出（同步維護所有已支援之語言字典），嚴禁任何寫死之自然語言文字；嚴禁使用「xx/xx」模糊並列翻譯。
7. **不得使用 `any` 型別**：全代碼嚴格靜態型別約束。
8. **不得在 JSX 內部處理複雜業務計算**：計算與副作用收斂至 Hooks/Services。
9. **不得巢狀聲明 Dialog**：平鋪兄弟節點，絕對禁止 Modal 內部嵌套 Modal。
10. **不得在彈窗掛載時自動聚焦輸入框**：嚴禁 `autoFocus` 或 JS 主動 `.focus()`。
11. **不得在動態 CSS 變數上附加 Tailwind 透明度修飾符**：避免舊版 WebKit `color-mix()` 實色 Bug。
12. **不得在彈窗卡片上使用慢速漸入動畫**：彈窗本體必須原生級瞬時彈出（Instant Pop）。
13. **不得動態插入元素撐大彈窗**：彈窗高度維持絕對穩定防抖。
14. **不得裸奔核心數學計算公式**：純函數必須 100% 單元測試覆蓋與邊界測試。
15. **不得執行未備份的毀滅性資料庫操作**：結構變更必升版本寫遷移腳本。
16. **不得在計量單位中使用模糊非客觀量詞**：嚴禁「1 勺」、「1 碗」、「中顆」，一律以克 (`g`) / 毫升 (`ml`) 為物理度量真理源。
17. **不得將頁面內部 Tab 綁定至污染瀏覽器歷史的 Query 參數**：維持純淨 URL 與返回直達上一層。
18. **不得在全局介面中使用冗長、客套或重複上下文的贅贅文案**：全面落實五大極簡文案法則。
19. **不得任意顛倒三大營養素順序**：全應用程式嚴格固定為「碳水 -> 蛋白質 -> 脂肪 (C -> P -> F)」。
20. **不得在標準數據彈窗上私自手寫覆蓋幾何尺寸與邊距類名**：統一透過 `<PrecisionDialogContent>`。
21. **不得在標準精密彈窗中手寫重複的標頭 JSX**：統一透過 `<DialogPrecisionHeader>`。
22. **不得使用雙破折號作為無數據佔位符**：全站一律使用半形單破折號「`-`」。
23. **不得在關聯引用或聚合實體中快照可變屬性**：嚴禁儲存 `foodName`, `exerciseName` 等反正規化欄位。
24. **不得使用語意化 Slug ID 區分實體**：全域唯一標準 RFC 4122 UUID。
25. **不得在飲食模型與日誌頭部中儲存主觀計劃名稱**：全域嚴禁 `planName` 欄位。
26. **不得在訓練日誌中儲存標題或快照**：全域嚴禁 `WorkoutLog.title` 欄位。
27. **不得在動作組合中配置組數**：全域嚴禁 `RoutineExerciseItem.defaultSets` 欄位。
28. **不得以非官方字體或正文強制粗體渲染產品名**：`e2Cal` 嚴格由 `<BrandWordmark />` / `<BrandText />` 渲染。
29. **不得在正文段落中隨機挑詞加粗，亦不得在介面濫用 700+ 粗體**：微字重封頂，技術參數用 `code`。
30. **不得在承載文字之容器上寫死固定高度 `h-*` 或濫用 `overflow-hidden`**：一律 `min-h-*` 自然撐開。
31. **不得對核心客觀度量數據與確認操作按鈕附加 `truncate` 截斷**：客觀物理事實完整呈現。
32. **不得在「數字 + 物理單位」間手寫字串空格**：一律由 `<MetricValue />` 輸出，嚴格落實 2px (`ml-0.5`) 微排版契約與雙字體分離。
33. **不得於使用者端介面展示或提供記錄「飽和脂肪、反式脂肪」**：兩者均屬預留屬性，禁止出現於前端任何組件與表單中。
34. **不得將 AI 組件、觸發按鈕或拆解預覽直接融入原生 Dialog 內部**：AI 必須作為外部掛載助手懸浮於彈窗之外，識別完畢後再單向注入數據至原生表單。
35. **不得引入任何外部第三方 CDN 字體或外鏈阻塞樣式**：全域字體 100% 本地 npm 依賴自託管或系統字體回退，嚴禁在 `<head>` 或樣式中鏈接外部網路字體，杜絕連網時阻塞初次渲染。
36. **不得在食物稱重輸入介面條件隱藏淨重/毛重切換器**：無論食材有無損耗，全量統一展示雙態切換器；無損耗食材毛重選項嚴格置灰禁用並標記 0% 損耗，維持穩定心智模型。
37. **不得以毛重計算熱量或將不可食殘渣計入食材基準**：食材常數一律錨定每 100g 純可食部；營養素計算唯一真理源永遠是可食淨重 `quantity`，毛重 `grossQuantity` 僅為輔助輸入與回顯。
38. **不得手動維護或寫死預設食材庫 (No Preset Food Database)**：軟體本身 100% 不收錄、不維護寫死之預設食材庫，食材完全由使用者自建或自內置權威科研庫（`authorityFoods.json`）依需導入；開發者僅維護跨地區異名之食物名稱對照表（`multilingualAliases.ts`）。
39. **不得在雲端連線或首次同步原子提交前持久化憑證與渠道**：多步驟流程未完成原子提交前，憑證與 `ProviderId` 僅允許暫存於記憶體 Staging，嚴禁提早寫入 `localStorage`；失敗或取消時必須完整回滾並保留原連線狀態。
