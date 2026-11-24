---
trigger: always_on
---

# 權威科研食材資料庫更新與對齊標準作業程序 (Authority Food Database SOP)

## 0. 新增食材檢索鐵律：內置權威資料庫優先 (In-Memory Authority First)
本專案已將四大官方科研資料庫（USDA、TFDA、CFCT、MEXT 共 14,161 條權威條目）離線編譯並完整內置於 `src/services/db/authorityFoods.json`。
**在新增原型食材、調整食材屬性或校準損耗率時，嚴禁在互聯網上進行外部搜尋！**

1. **零外網搜尋原則 (Zero Web Search Invariant)**：
   - 所有待新增的原型食材、部位肉、水產、蔬果，必須**100% 直接自專案內置的 `src/services/db/authorityFoods.json` 進行檢索與提取**。
   - 內置庫已涵蓋官方生鮮測定值、微量元素（micros）、電解質（鈉、鉀、鈣、鎂、鐵、鋅）、水分以及官方解剖損耗率（`refuseRate`）。
2. **本地檢索標準指令 (Local Search Standard)**：
   - 透過 Node.js 直接讀取並過濾 `src/services/db/authorityFoods.json`：
     ```bash
     node -e "
     const fs = require('fs');
     const data = JSON.parse(fs.readFileSync('src/services/db/authorityFoods.json', 'utf8'));
     const matches = data.filter(i => {
       const text = (i.name + ' ' + (i.dataSource?.sourceName || '') + ' ' + (i.dataSource?.sourceId || '')).toLowerCase();
       return text.includes('關鍵字');
     });
     matches.forEach(m => console.log(m.dataSource?.authority, m.dataSource?.sourceId, m.name, '| refuse:', m.refuseRate, '| cal:', m.calories, 'p:', m.protein, 'f:', m.fat, 'c:', m.carbs));
     "
     ```
3. **主鍵與數據繼承原則 (UUID & Spec Continuity)**：
   - **優先繼承確定性 UUIDv5**：直接使用內置庫條目已固化之 `item.id`（例如 TFDA 鴨腿 `e1364b57-12b9-5de6-a00d-7cad72609881`），杜絕隨機生成導致 ID 漂移與外鍵斷裂。
   - **數值嚴格對齊**：100% 承襲內置項目的測定常數（`calories`, `carbs`, `protein`, `fat`, `sodium`, `micros`, `refuseRate`, `refuseDescription`）。
   - **補齊次級營養素**：若內置項目缺少個別次級宏量（如 `fiber`, `sugar`, `saturatedFat`, `transFat`），依生物物理守恆與官方營養手冊補齊預設值（純肉/純蛋類 fiber=0, sugar=0，飽和脂肪依脂肪酸組成比例填寫）。

## 1. 適用範圍與動態梯隊順位 (Dynamic Authority Hierarchy)
本 SOP 適用於四大官方科研機構資料庫之增補、季度更新、年度改訂或微量營養素修訂。**嚴禁盲目優先使用單一西方機構資料庫**，應按食材的地域性原生特性動態定序：
- **東亞特色飲食與部位食材 (Asian Native & Cut-specific Foods)**：
  - **P1 TFDA / CFCT**：台灣食藥署與中國疾控中心（禽爪翅、帶骨小排、內臟副產物、中式蔬菜、傳統豆製品，具備第一手精準骨重與外殼損耗率）。
  - **P2 MEXT**：日本文部科學省（生鮮水產魚貝、海藻、日式大豆發酵物）。
  - **P3 USDA**：美國農業部（僅當亞洲庫無測定記錄時作為補充）。
- **西方大宗與通用農產食材 (Western Staple & Universal Commodities)**：
  - **P1 USDA**：乳製品、原切牛羊、穀物燕麥片、西方堅果。
  - **P2 MEXT / TFDA / CFCT**：亞洲官方測定之進口或在地化對應項。

---

## 2. 核心架構鐵律 (Architecture Invariants)
1. **確定性 UUIDv5 主鍵契約 (Zero Key Collision)**：
   - 命名空間 UUID 固定為 `6ba7b810-9dad-11d1-80b4-00c04fd430c8`。
   - 主鍵公式：`uuid5(NAMESPACE_E2CAL, f"{authority}:{sourceId}")`。
   - 官方更新數值時，相同的 `sourceId` 必須生成恆定相同的 UUID，確保使用者歷史 `food_logs`、菜餚 Recipe 與收藏外鍵永不中斷。
2. **純可食部 100g 生重基準 (Edible Portion SSOT)**：
   - 所有化學營養常數強制錨定每 100g 純可食部（Edible Portion）生重，嚴禁將骨、殼、皮計入基準。
3. **不可食用損耗形態解耦 (Refuse Decoupling)**：
   - 不可食殘渣（骨、殼、果核）一律由 `refuseRate` 承載，折算率為 `edibleRate = 1.0 - refuseRate`。
   - **嚴禁在食物品名中添加「（帶骨）」、「(含芯)」、「(帶皮)」等括號或後綴**。
4. **解剖學物理損耗與防降級鐵律 (Anatomical & Semantic Invariants)**：
   - **帶骨/帶殼損耗剛性約束**：凡品名包含「翅、排骨、小排、爪、掌、蛤、貝、螺、帶殼」等明確骨骼或外殼部位者（且未標註去骨/去殼/純肉），其 `refuseRate` 絕對不可為 0 或 undefined。
   - **帶皮/帶核水果瓜類損耗剛性約束**：凡天然鮮果品名包含不可食果皮、硬核、厚瓜瓤（如香蕉、蘋果、柑橘、柳橙、西瓜、鳳梨、木瓜、芒果、荔枝、龍眼、葡萄柚、酪梨、奇異果、火龍果、枇杷、桃、李、櫻桃、檸檬、百香果、柿、甜瓜、哈密瓜、棗、沃柑等，且未標註果汁/果泥/乾貨/仁），其 `refuseRate` 絕對不可為 0 或 undefined。
   - **原型生鮮食材加工污染禁止條款 (No Processed Contamination)**：原型生鮮食材（肉禽、鮮果、蔬菜、生鮮水產）之 `sourceName` 嚴禁包含 `juice` / `汁` / `lemonade` / `cocktail`（加工果汁飲品）、`sauce` / `醬`（調味醬料罐頭）、`babyfood`（嬰兒加工泥）或 `powder` / `粉`。
   - **跨物種/跨生物品類零污染條款 (Taxonomic Purity)**：溯源條目必須嚴格遵循生物界分類，嚴禁蝦類映射為魚類（如草蝦映射黑魚、泰國蝦映射石首魚）、鮮果映射為真菌/塊莖（如火龍果映射洋菇、紅心柚映射馬鈴薯）、魚種錯配（如鰻魚映射笛鯛、武昌魚映射扁豆）。
   - **中英解剖部位語意對齊**：部位食材（如翅 = wing、排 = rib、爪 = foot）溯源品名嚴禁出現全身肉（如 "meat and skin"）泛稱降級混充；亞洲庫有原樣化驗者強制使用亞洲庫。
5. **四層營養素分類與 UI 分離原則**：
   - 核心宏量：`calories`, `carbs`, `protein`, `fat`。
   - 次級宏量：`sugar`, `fiber`（正常參與計算與支援視圖呈現）；`saturatedFat`, `transFat`（資料層 100% 留存，UI 依 Rule 35 隱藏）。
   - 電解質：`sodium`（資料層 100% 留存，UI 依 Rule 35 隱藏）。
   - 微量集合：`micros`（鉀、鈣、鎂、鐵、鋅、硒、維生素群、膽固醇等，按需展開）。

---

## 3. 五步標準執行流程 (5-Step Execution Workflow)

### Step 1: 權威資料檢索與獲取 (Retrieval & Ingestion)
- **日常增補預設食材**：100% 透過本地 Node 腳本檢索 `src/services/db/authorityFoods.json`，提取條目之確定性 UUID、化學分析數值、微量元素與 `refuseRate`。嚴禁聯網搜尋。
- **年度/全量資料集升級**：自官方公開途徑獲取正式發布檔（MEXT Excel、TFDA CSV/ZIP、USDA CSV/API、CFCT 官方出版數據），禁止使用第三方未經化驗的二手數據。

### Step 2: 離線清洗與 INFOODS 標籤標準化
- 數值清洗：移除括號估算標記 `(1.2) -> 1.2`，將未檢出/微量符號 `Tr / - / * / NA` 歸零為 `0.0`。
- INFOODS 化學標籤對齊：
  - `ENERC_KCAL` -> `calories`
  - `PROT-` / `PROTCAA` -> `protein`
  - `FAT-` -> `fat`
  - `CHOCDF-` -> `carbs`
  - `FIB-` -> `fiber`
  - `SUGAR` / `SUCS` -> `sugar`
  - `FASAT` -> `saturatedFat`
  - `FATRN` -> `transFat`
  - `NA` -> `sodium`
  - `CHOLE` -> `micros.cholesterol`
  - `K`, `CA`, `MG`, `FE`, `ZN`, `SE` -> `micros.*`
  - `VITA_RAE`, `VITC`, `VITD`, `TOCPHA`, `THIA`, `RIBF`, `NIA`, `VITB6A`, `VITB12`, `FOL` -> `micros.*`

### Step 3: 雙重物理守恆與子集約束檢驗
執行自動化校驗腳本，未通過者需進行審查修復：
1. **Atwater 熱量守恆檢驗**：
   $$\left| \text{宣稱熱量} - (4 \times \text{protein} + 4 \times \text{carbs} + 9 \times \text{fat}) \right| \le \text{公差門檻}$$
2. **次級宏量邏輯約束檢驗**：
   $$\text{carbs} \ge \text{sugar} + \text{fiber}$$
   $$\text{fat} \ge \text{saturatedFat} + \text{transFat}$$

### Step 4: 合併更新 authorityFoods.json
- 按 `[...USDA, ...MEXT, ...TFDA, ...CFCT]` 格式輸出至 `src/services/db/authorityFoods.json`。
- 維持 JSON Code-Splitting 按需載入架構，首屏載入 0 佔用。

### Step 5: 多語系與系統統計同步
- 同步更新統計數字與提示文案（`zh-TW.json`、`zh-CN.json`、`en.json`、相關 UI 橫條與對話框）。
- 若新增重要單品食材，於 `multilingualAliases.ts` 補齊繁/簡/英/日四語搜尋別名。

---

## 4. 發布前驗證清單 (Pre-release Checklist)
- [ ] 執行 `npm test`：確保所有單元測試 100% 通過。
- [ ] 執行 `npm run build`：確保 TypeScript 類型檢查與 Vite 打包 0 警告 0 錯誤。
- [ ] 驗證資料庫 ID 無重複：`len(set(ids)) === len(foods)`。
- [ ] 驗證搜尋穿透：中文、英文、日語關鍵字皆可秒級召回。
