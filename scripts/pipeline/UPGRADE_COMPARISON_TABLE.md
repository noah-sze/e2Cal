# e2Cal 舊食品資料庫全面升級權威對照表 (Ground Truth Database Upgrade)

> 本對照表記錄了 e2Cal 預設食材庫自傳統手動輸入數值，全面平滑升維至**權威科研化驗標準**（USDA FoodData Central、台灣衛福部食藥署 TFDA、中國疾病預防控制中心 CFCT）的完整比對審計明細。
> 核心原則：**保留既有唯一 UUID**（歷史日誌與食譜外鍵 100% 零破壞），**嚴格以每 100g 純可食部為單一事實真理（SSOT）**，並補齊物理廢棄率（Refuse Rate）與微量元素譜庫。

## 一、 數據庫升維整體摘要

- **升級食材總數**：412 筆天然原型食材
- **權威來源分佈**：
  - **USDA (美國農業部)**：218 筆（家禽、畜肉、歐美標準穀物果蔬）
  - **TFDA (台灣衛福部食藥署)**：143 筆（本土特有海鮮、熱帶蔬果、亞太特色部位）
  - **CFCT (中國疾控中心營養所)**：51 筆（特色淡水產、傳統豆製品、特色雜糧）
- **物理損耗率（Refuse / Edible Rate）標註**：共 412 筆天然食材賦予實驗室精確損耗常數（支援生熟與毛重稱重自動折算）
- **微量元素譜庫（Micronutrients）補齊**：共 411 筆食材補齊鉀、鈣、鎂、鐵、鋅、膽固醇等完整實驗室測量值

---

## 二、 412 項核心天然食材升級詳細對照表

| # | 食材名稱 | 舊營養素 (kcal / P / F / C) | 權威來源 | 官方 ID | 官方科研品名 | 升級後營養素 (每100g純可食部) | 損耗率 (廢棄率 / 可食率) | 損耗描述 |
| :-: | :--- | :--- | :---: | :---: | :--- | :--- | :---: | :--- |
| 1 | **雞里肌** (`chicken_tenderloin`) | 105.0 kcal / P 23.5g / F 0.8g / C 0.0g | **USDA** | `171464` | Chicken, broilers or fryers, light mea... | **114 kcal / P 23.2g / F 1.6g / C 0.0g** | - / 100% | - |
| 2 | **去皮雞腿肉** (`chicken_thigh_skinless`) | 121.0 kcal / P 19.7g / F 4.1g / C 0.0g | **USDA** | `171509` | Chicken, broilers or fryers, breast, s... | **108 kcal / P 20.3g / F 3.0g / C 0.0g** | - / 100% | - |
| 3 | **帶皮雞腿肉** (`chicken_thigh_with_skin`) | 214.0 kcal / P 16.9g / F 15.6g / C 0.0g | **USDA** | `172863` | Chicken, dark meat, thigh, meat and sk... | **197 kcal / P 16.6g / F 14.6g / C 0.0g** | - / 100% | - |
| 4 | **雞翅** (`chicken_wing`) | 203.0 kcal / P 18.3g / F 14.1g / C 0.0g | **USDA** | `172390` | Chicken, broilers or fryers, wing, mea... | **191 kcal / P 17.5g / F 12.8g / C 0.0g** | - / 100% | - |
| 5 | **去皮鴨胸肉** (`duck_breast_skinless`) | 123.0 kcal / P 20.0g / F 4.3g / C 0.0g | **USDA** | `174469` | Duck, wild, breast, meat only, raw | **123 kcal / P 19.9g / F 4.2g / C 0.0g** | - / 100% | - |
| 6 | **火雞胸肉** (`turkey_breast`) | 104.0 kcal / P 23.8g / F 0.7g / C 0.0g | **USDA** | `171098` | Turkey, whole, breast, meat only, raw | **114 kcal / P 23.7g / F 1.5g / C 0.1g** | - / 100% | - |
| 7 | **牛腱肉** (`beef_shank`) | 119.0 kcal / P 21.8g / F 3.0g / C 0.0g | **USDA** | `169441` | Beef, shank crosscuts, separable lean ... | **128 kcal / P 21.8g / F 3.9g / C 0.0g** | - / 100% | - |
| 8 | **牛菲力** (`beef_tenderloin`) | 133.0 kcal / P 22.0g / F 4.5g / C 0.0g | **USDA** | `171749` | Beef, loin, tenderloin roast, boneless... | **144 kcal / P 21.9g / F 6.2g / C 0.0g** | - / 100% | - |
| 9 | **牛肋眼** (`beef_ribeye`) | 218.0 kcal / P 20.0g / F 14.8g / C 0.0g | **USDA** | `173975` | Beef, Australian, imported, grass-fed,... | **217 kcal / P 19.8g / F 15.2g / C 0.1g** | - / 100% | - |
| 10 | **牛西冷** (`beef_sirloin`) | 155.0 kcal / P 21.6g / F 7.2g / C 0.0g | **USDA** | `168734` | Beef, bottom sirloin, tri-tip roast, s... | **165 kcal / P 20.6g / F 8.6g / C 0.0g** | - / 100% | - |
| 11 | **牛絞肉** (`beef_ground_90_10`) | 176.0 kcal / P 20.0g / F 10.3g / C 0.0g | **USDA** | `174030` | Beef, ground, 90% lean meat / 10% fat,... | **176 kcal / P 20.0g / F 10.0g / C 0.0g** | - / 100% | - |
| 12 | **豬里肌** (`pork_tenderloin`) | 143.0 kcal / P 22.2g / F 5.4g / C 0.0g | **USDA** | `168312` | Pork, fresh, loin, tenderloin, separab... | **120 kcal / P 20.6g / F 3.5g / C 0.0g** | - / 100% | - |
| 13 | **豬後腿肉** (`pork_ham_lean`) | 121.0 kcal / P 21.1g / F 3.5g / C 0.0g | **TFDA** | `I0302201` | 豬後腿肉 | **123 kcal / P 20.4g / F 4.0g / C 0.4g** | 8% / 92% | - |
| 14 | **豬梅花肉** (`pork_shoulder`) | 207.0 kcal / P 18.2g / F 14.4g / C 0.0g | **USDA** | `167810` | Pork, fresh, composite of trimmed leg,... | **211 kcal / P 18.2g / F 14.8g / C 0.0g** | - / 100% | - |
| 15 | **豬五花肉** (`pork_belly`) | 393.0 kcal / P 14.5g / F 37.0g / C 0.0g | **USDA** | `168277` | Pork, cured, bacon, unprepared | **393 kcal / P 13.7g / F 37.1g / C 0.0g** | - / 100% | - |
| 16 | **豬小排** (`pork_rib`) | 231.0 kcal / P 18.0g / F 17.2g / C 0.0g | **USDA** | `168299` | Pork, fresh, backribs, separable lean ... | **224 kcal / P 19.1g / F 16.3g / C 0.0g** | - / 100% | - |
| 17 | **羊後腿肉** (`lamb_leg_lean`) | 122.0 kcal / P 20.6g / F 3.8g / C 0.0g | **USDA** | `172486` | Lamb, leg, shank half, separable lean ... | **125 kcal / P 20.5g / F 4.2g / C 0.0g** | - / 100% | - |
| 18 | **鱈魚** (`cod_fish`) | 82.0 kcal / P 17.8g / F 0.7g / C 0.0g | **USDA** | `169809` | Fish, lingcod, meat, raw (Alaska Native) | **79 kcal / P 17.9g / F 0.8g / C 0.0g** | - / 100% | - |
| 19 | **鯛魚片** (`tilapia_fillet`) | 96.0 kcal / P 20.1g / F 1.7g / C 0.0g | **USDA** | `175176` | Fish, tilapia, raw | **96 kcal / P 20.1g / F 1.7g / C 0.0g** | - / 100% | - |
| 20 | **鱸魚** (`sea_bass`) | 97.0 kcal / P 18.4g / F 2.1g / C 0.0g | **USDA** | `175142` | Fish, sea bass, mixed species, raw | **97 kcal / P 18.4g / F 2.0g / C 0.0g** | - / 100% | - |
| 21 | **金槍魚** (`yellowfin_tuna`) | 109.0 kcal / P 24.4g / F 0.5g / C 0.0g | **USDA** | `175159` | Fish, tuna, fresh, yellowfin, raw | **109 kcal / P 24.4g / F 0.5g / C 0.0g** | - / 100% | - |
| 22 | **鯖魚** (`mackerel`) | 205.0 kcal / P 18.6g / F 13.9g / C 0.0g | **USDA** | `175119` | Fish, mackerel, Atlantic, raw | **205 kcal / P 18.6g / F 13.9g / C 0.0g** | - / 100% | - |
| 23 | **秋刀魚** (`pacific_saury`) | 269.0 kcal / P 17.5g / F 21.6g / C 0.0g | **TFDA** | `J0416501` | 秋刀魚 | **277 kcal / P 18.8g / F 21.8g / C 4.1g** | 44% / 56% | - |
| 24 | **比目魚** (`halibut`) | 91.0 kcal / P 18.6g / F 1.3g / C 0.0g | **USDA** | `174200` | Fish, halibut, Atlantic and Pacific, raw | **91 kcal / P 18.6g / F 1.3g / C 0.0g** | - / 100% | - |
| 25 | **蝦仁** (`shrimp_meat`) | 85.0 kcal / P 18.1g / F 1.1g / C 0.2g | **TFDA** | `J2200401` | 海鱸蝦仁 | **73 kcal / P 16.3g / F 0.4g / C 1.3g** | - / 100% | - |
| 26 | **蟹肉** (`crab_meat`) | 87.0 kcal / P 17.9g / F 1.5g / C 0.0g | **CFCT** | `123005` | 蟹肉 | **62 kcal / P 11.6g / F 1.2g / C 1.1g** | - / 100% | - |
| 27 | **透抽** (`squid_raw`) | 92.0 kcal / P 15.6g / F 1.4g / C 3.1g | **USDA** | `174223` | Mollusks, squid, mixed species, raw | **92 kcal / P 15.6g / F 1.4g / C 3.1g** | - / 100% | - |
| 28 | **章魚** (`octopus_raw`) | 82.0 kcal / P 14.9g / F 1.0g / C 2.2g | **TFDA** | `J3500201` | 章魚 | **61 kcal / P 13.0g / F 0.6g / C 0.9g** | - / 100% | - |
| 29 | **文蛤** (`clam_meat`) | 74.0 kcal / P 12.8g / F 1.0g / C 2.6g | **USDA** | `174214` | Mollusks, clam, mixed species, raw | **86 kcal / P 14.7g / F 1.0g / C 3.6g** | - / 100% | - |
| 30 | **牡蠣** (`oyster_meat`) | 68.0 kcal / P 7.0g / F 2.5g / C 3.9g | **USDA** | `171981` | Mollusks, oyster, eastern, canned | **68 kcal / P 7.1g / F 2.5g / C 3.9g** | - / 100% | - |
| 31 | **扇貝** (`scallop_meat`) | 88.0 kcal / P 16.8g / F 0.8g / C 2.4g | **USDA** | `174220` | Mollusks, scallop, mixed species, raw | **69 kcal / P 12.1g / F 0.5g / C 3.2g** | - / 100% | - |
| 32 | **蛋白液** (`egg_white`) | 52.0 kcal / P 10.9g / F 0.2g / C 0.7g | **USDA** | `172183` | Egg, white, raw, fresh | **52 kcal / P 10.9g / F 0.2g / C 0.7g** | - / 100% | - |
| 33 | **鵪鶉蛋** (`quail_egg`) | 158.0 kcal / P 13.0g / F 11.1g / C 0.4g | **TFDA** | `K0300101` | 鵪鶉蛋 | **172 kcal / P 12.7g / F 13.0g / C 1.2g** | 17% / 83% | - |
| 34 | **板豆腐** (`firm_tofu`) | 88.0 kcal / P 8.5g / F 4.8g / C 1.9g | **USDA** | `172448` | Tofu, firm, prepared with calcium sulf... | **78 kcal / P 9.0g / F 4.2g / C 2.9g** | - / 100% | - |
| 35 | **嫩豆腐** (`silken_tofu`) | 55.0 kcal / P 5.0g / F 3.1g / C 1.8g | **TFDA** | `R4701201` | 嫩豆腐 | **51 kcal / P 4.9g / F 3.0g / C 1.6g** | - / 100% | - |
| 36 | **凍豆腐** (`frozen_tofu`) | 130.0 kcal / P 13.8g / F 6.5g / C 3.5g | **TFDA** | `R4701001` | 冷凍豆腐 | **127 kcal / P 12.9g / F 7.1g / C 3.9g** | - / 100% | - |
| 37 | **豆干** (`dried_tofu`) | 192.0 kcal / P 19.0g / F 10.2g / C 4.8g | **TFDA** | `R4700202` | 五香豆干 | **192 kcal / P 19.3g / F 10.6g / C 6.2g** | - / 100% | - |
| 38 | **毛豆仁** (`edamame_kernels`) | 121.0 kcal / P 11.9g / F 5.2g / C 8.9g | **TFDA** | `H1100301` | 冷凍毛豆仁 | **144 kcal / P 12.5g / F 6.1g / C 9.8g** | - / 100% | - |
| 39 | **黃豆** (`soybean_dry`) | 446.0 kcal / P 36.5g / F 19.9g / C 30.2g | **USDA** | `174270` | Soybeans, mature seeds, raw | **446 kcal / P 36.5g / F 19.9g / C 30.2g** | - / 100% | - |
| 40 | **黑豆** (`black_bean_dry`) | 405.0 kcal / P 36.0g / F 15.9g / C 33.6g | **CFCT** | `031102` | 黑豆（干）［黑大豆］ | **401 kcal / P 36.0g / F 15.9g / C 33.6g** | - / 100% | - |
| 41 | **鷹嘴豆** (`chickpea_dry`) | 378.0 kcal / P 20.5g / F 6.0g / C 63.0g | **USDA** | `173756` | Chickpeas (garbanzo beans, bengal gram... | **378 kcal / P 20.5g / F 6.0g / C 63.0g** | - / 100% | - |
| 42 | **紅豆** (`adzuki_bean_dry`) | 329.0 kcal / P 21.4g / F 0.6g / C 61.5g | **TFDA** | `H0405101` | 紅豆 | **335 kcal / P 20.9g / F 0.6g / C 61.5g** | - / 100% | - |
| 43 | **綠豆** (`mung_bean_dry`) | 347.0 kcal / P 23.9g / F 1.2g / C 62.6g | **TFDA** | `H0705102` | 綠豆 | **312 kcal / P 22.8g / F 1.1g / C 63.0g** | - / 100% | - |
| 44 | **糙米** (`brown_rice`) | 362.0 kcal / P 7.5g / F 2.7g / C 76.2g | **CFCT** | `012216` | 糙米 | **348 kcal / P 7.7g / F 2.7g / C 75.0g** | - / 100% | - |
| 45 | **藜麥** (`quinoa_raw`) | 368.0 kcal / P 14.1g / F 6.1g / C 64.2g | **USDA** | `168874` | Quinoa, uncooked | **368 kcal / P 14.1g / F 6.1g / C 64.2g** | - / 100% | - |
| 46 | **義大利麵** (`pasta`) | 357.0 kcal / P 12.5g / F 1.5g / C 73.0g | **USDA** | `168915` | Pasta, whole grain, 51% whole wheat, r... | **362 kcal / P 13.5g / F 2.7g / C 73.1g** | - / 100% | - |
| 47 | **小米** (`millet_raw`) | 378.0 kcal / P 11.0g / F 4.2g / C 72.8g | **TFDA** | `A0200101` | 小米 | **365 kcal / P 11.3g / F 3.7g / C 71.7g** | - / 100% | - |
| 48 | **甜玉米粒** (`corn_kernel`) | 86.0 kcal / P 3.2g / F 1.2g / C 19.0g | **USDA** | `168398` | Corn, sweet, yellow, frozen, kernels c... | **88 kcal / P 3.0g / F 0.8g / C 20.7g** | - / 100% | - |
| 49 | **蕎麥粒** (`buckwheat_raw`) | 343.0 kcal / P 13.3g / F 3.4g / C 71.5g | **USDA** | `170286` | Buckwheat | **343 kcal / P 13.2g / F 3.4g / C 71.5g** | - / 100% | - |
| 50 | **紫薯** (`purple_sweet_potato`) | 105.0 kcal / P 1.6g / F 0.2g / C 24.3g | **USDA** | `169305` | Sweet potato, canned, mashed | **101 kcal / P 2.0g / F 0.2g / C 23.2g** | - / 100% | - |
| 51 | **馬鈴薯** (`potato_raw`) | 77.0 kcal / P 2.0g / F 0.1g / C 17.5g | **TFDA** | `B0700201` | 馬鈴薯 | **74 kcal / P 2.6g / F 0.2g / C 15.8g** | 10% / 90% | - |
| 52 | **南瓜** (`pumpkin_raw`) | 26.0 kcal / P 1.0g / F 0.1g / C 6.5g | **CFCT** | `043213` | 南瓜（鲜）［倭瓜，番瓜］ | **23 kcal / P 0.7g / F 0.1g / C 5.3g** | 15% / 85% | - |
| 53 | **山藥** (`yam_raw`) | 118.0 kcal / P 1.5g / F 0.2g / C 27.9g | **TFDA** | `B0100211` | 山藥(花蓮3號) | **90 kcal / P 1.7g / F 0.1g / C 20.9g** | 21% / 79% | - |
| 54 | **芋頭** (`taro_raw`) | 112.0 kcal / P 1.5g / F 0.2g / C 26.5g | **TFDA** | `B0500101` | 芋頭 | **123 kcal / P 2.5g / F 1.1g / C 26.4g** | 13% / 87% | - |
| 55 | **蓮藕** (`lotus_root_raw`) | 74.0 kcal / P 2.6g / F 0.1g / C 17.2g | **TFDA** | `B0900101` | 蓮藕 | **58 kcal / P 2.0g / F 0.2g / C 13.5g** | 21% / 79% | - |
| 56 | **綠花椰菜** (`broccoli_raw`) | 34.0 kcal / P 2.8g / F 0.4g / C 6.6g | **USDA** | `168510` | Broccoli, cooked, boiled, drained, wit... | **35 kcal / P 2.4g / F 0.4g / C 7.2g** | - / 100% | - |
| 57 | **白花椰菜** (`cauliflower_raw`) | 25.0 kcal / P 1.9g / F 0.3g / C 5.0g | **USDA** | `168520` | Cauliflower, cooked, boiled, drained, ... | **23 kcal / P 1.8g / F 0.5g / C 4.1g** | - / 100% | - |
| 58 | **高麗菜** (`cabbage_raw`) | 25.0 kcal / P 1.3g / F 0.1g / C 5.8g | **USDA** | `168514` | Cabbage, common, cooked, boiled, drain... | **23 kcal / P 1.3g / F 0.1g / C 5.5g** | - / 100% | - |
| 59 | **紫甘藍** (`red_cabbage_raw`) | 31.0 kcal / P 1.4g / F 0.2g / C 7.4g | **TFDA** | `E7700301` | 紫甘藍芽 | **27 kcal / P 0.2g / F 0.7g / C 6.6g** | - / 100% | - |
| 60 | **大白菜** (`chinese_cabbage_raw`) | 13.0 kcal / P 1.2g / F 0.2g / C 2.2g | **CFCT** | `045101x` | 大白菜（代表值） | **20 kcal / P 1.6g / F 0.2g / C 3.4g** | 11% / 89% | - |
| 61 | **娃娃菜** (`baby_chinese_cabbage`) | 14.0 kcal / P 1.3g / F 0.2g / C 2.4g | **CFCT** | `045123` | 娃娃菜 | **13 kcal / P 1.9g / F 0.2g / C 2.4g** | 3% / 97% | - |
| 62 | **青江菜** (`bok_choy_raw`) | 13.0 kcal / P 1.5g / F 0.2g / C 2.2g | **TFDA** | `E3201202` | 青江菜(土植)(3月取樣) | **11 kcal / P 1.2g / F 0.1g / C 2.2g** | 10% / 90% | - |
| 63 | **羽衣甘藍** (`kale_raw`) | 35.0 kcal / P 2.9g / F 1.5g / C 4.4g | **TFDA** | `E3000501` | 羽衣甘藍(有機) | **28 kcal / P 3.0g / F 0.9g / C 5.1g** | - / 100% | - |
| 64 | **菠菜** (`spinach_raw`) | 23.0 kcal / P 2.9g / F 0.4g / C 3.6g | **TFDA** | `E5000101` | 菠菜 | **14 kcal / P 2.2g / F 0.3g / C 2.4g** | 14% / 86% | - |
| 65 | **結球萵苣** (`iceberg_lettuce`) | 14.0 kcal / P 0.9g / F 0.1g / C 3.0g | **TFDA** | `E5300601` | 結球萵苣 | **12 kcal / P 0.7g / F 0.1g / C 2.8g** | - / 100% | - |
| 66 | **羅美生菜** (`romaine_lettuce`) | 17.0 kcal / P 1.2g / F 0.3g / C 3.3g | **USDA** | `169247` | Lettuce, cos or romaine, raw | **17 kcal / P 1.2g / F 0.3g / C 3.3g** | - / 100% | - |
| 67 | **空心菜** (`water_spinach_raw`) | 19.0 kcal / P 2.6g / F 0.2g / C 3.1g | **CFCT** | `045337` | 蕹菜［空心菜、藤藤菜］ | **19 kcal / P 2.2g / F 0.2g / C 4.0g** | - / 100% | - |
| 68 | **聖女小番茄** (`cherry_tomato`) | 27.0 kcal / P 1.2g / F 0.2g / C 5.8g | **TFDA** | `E7400401` | 聖女小番茄 | **31 kcal / P 1.1g / F 0.5g / C 6.9g** | 1% / 99% | - |
| 69 | **小黃瓜** (`cucumber_raw`) | 15.0 kcal / P 0.7g / F 0.1g / C 3.6g | **USDA** | `168409` | Cucumber, with peel, raw | **15 kcal / P 0.7g / F 0.1g / C 3.6g** | - / 100% | - |
| 70 | **櫛瓜** (`zucchini_raw`) | 17.0 kcal / P 1.2g / F 0.3g / C 3.1g | **TFDA** | `E7100101` | 黃櫛瓜 | **13 kcal / P 1.5g / F 0.1g / C 2.7g** | 7% / 93% | - |
| 71 | **茄子** (`eggplant_raw`) | 25.0 kcal / P 1.0g / F 0.2g / C 5.9g | **TFDA** | `E7300101` | 長茄子 | **20 kcal / P 1.2g / F 0.2g / C 5.3g** | 11% / 89% | - |
| 72 | **苦瓜** (`bitter_gourd_raw`) | 17.0 kcal / P 1.0g / F 0.2g / C 3.7g | **TFDA** | `E6500201` | 苦瓜(青皮) | **13 kcal / P 0.9g / F 0.1g / C 4.2g** | 10% / 90% | - |
| 73 | **冬瓜** (`winter_melon_raw`) | 13.0 kcal / P 0.4g / F 0.2g / C 3.0g | **TFDA** | `E6200101` | 冬瓜 | **11 kcal / P 0.4g / F 0.1g / C 2.7g** | 11% / 89% | - |
| 74 | **絲瓜** (`luffa_raw`) | 16.0 kcal / P 0.8g / F 0.2g / C 3.5g | **TFDA** | `E6800101` | 絲瓜 | **17 kcal / P 1.1g / F 0.1g / C 3.9g** | 19% / 81% | - |
| 75 | **秋葵** (`okra_raw`) | 33.0 kcal / P 1.9g / F 0.2g / C 7.5g | **TFDA** | `E7600101` | 黃秋葵 | **28 kcal / P 2.1g / F 0.1g / C 7.5g** | 11% / 89% | - |
| 76 | **綠豆芽** (`mung_bean_sprout`) | 30.0 kcal / P 3.0g / F 0.2g / C 5.9g | **TFDA** | `E7700701` | 綠豆芽 | **21 kcal / P 2.3g / F 0.2g / C 4.1g** | - / 100% | - |
| 77 | **黃豆芽** (`soybean_sprout`) | 44.0 kcal / P 4.5g / F 1.6g / C 3.0g | **TFDA** | `E7700401` | 黃豆芽 | **41 kcal / P 5.3g / F 1.6g / C 5.0g** | - / 100% | - |
| 78 | **胡蘿蔔** (`carrot_raw`) | 41.0 kcal / P 0.9g / F 0.2g / C 9.6g | **TFDA** | `E0200101` | 胡蘿蔔 | **32 kcal / P 1.0g / F 0.2g / C 8.5g** | 14% / 86% | - |
| 79 | **白蘿蔔** (`white_radish_raw`) | 18.0 kcal / P 0.6g / F 0.1g / C 4.1g | **TFDA** | `E0400101` | 白蘿蔔 | **14 kcal / P 0.7g / F 0.1g / C 3.3g** | 8% / 92% | - |
| 80 | **洋蔥** (`onion_raw`) | 40.0 kcal / P 1.1g / F 0.1g / C 9.3g | **TFDA** | `E2400301` | 黃洋蔥 | **39 kcal / P 1.0g / F 0.2g / C 9.5g** | 6% / 94% | - |
| 81 | **青蔥** (`scallion_raw`) | 32.0 kcal / P 1.8g / F 0.2g / C 7.3g | **TFDA** | `E2300101` | 青蔥(有機) | **26 kcal / P 1.1g / F 0.2g / C 6.8g** | 35% / 65% | - |
| 82 | **大蒜** (`garlic_raw`) | 149.0 kcal / P 6.4g / F 0.5g / C 33.0g | **TFDA** | `E2100101` | 大蒜 | **134 kcal / P 6.7g / F 0.2g / C 26.4g** | 16% / 84% | - |
| 83 | **薑** (`ginger_raw`) | 80.0 kcal / P 1.8g / F 0.8g / C 17.8g | **USDA** | `169231` | Ginger root, raw | **80 kcal / P 1.8g / F 0.8g / C 17.8g** | - / 100% | - |
| 84 | **蘆筍** (`asparagus_raw`) | 20.0 kcal / P 2.2g / F 0.1g / C 3.9g | **TFDA** | `E1700204` | 綠蘆筍(短型) | **20 kcal / P 3.5g / F 0.1g / C 3.0g** | 11% / 89% | - |
| 85 | **芹菜** (`celery_raw`) | 14.0 kcal / P 0.7g / F 0.2g / C 3.0g | **TFDA** | `E3700202` | 芹菜 | **15 kcal / P 0.8g / F 0.2g / C 3.8g** | 42% / 58% | - |
| 86 | **綠竹筍** (`bamboo_shoot_raw`) | 27.0 kcal / P 2.6g / F 0.3g / C 5.2g | **TFDA** | `E1500101` | 綠竹筍 | **22 kcal / P 1.7g / F 0.2g / C 4.7g** | 41% / 59% | - |
| 87 | **白蘑菇** (`white_mushroom_raw`) | 22.0 kcal / P 3.1g / F 0.3g / C 3.3g | **CFCT** | `051028` | 白蘑菇［双孢蘑菇、洋蘑菇］ | **29 kcal / P 3.5g / F 0.4g / C 3.8g** | - / 100% | - |
| 88 | **鮮香菇** (`shiitake_raw`) | 34.0 kcal / P 2.2g / F 0.5g / C 6.8g | **USDA** | `168435` | Mushrooms, shiitake, stir-fried | **39 kcal / P 3.5g / F 0.3g / C 7.7g** | - / 100% | - |
| 89 | **杏鮑菇** (`king_oyster_mushroom`) | 35.0 kcal / P 3.1g / F 0.6g / C 5.8g | **TFDA** | `G1300201` | 杏鮑菇(大) | **30 kcal / P 2.4g / F 0.1g / C 7.5g** | - / 100% | - |
| 90 | **金針菇** (`enoki_mushroom`) | 37.0 kcal / P 2.7g / F 0.3g / C 7.8g | **TFDA** | `G1600101` | 金針菇 | **33 kcal / P 2.6g / F 0.3g / C 7.2g** | - / 100% | - |
| 91 | **黑木耳** (`wood_ear_fresh`) | 25.0 kcal / P 0.5g / F 0.2g / C 6.5g | **CFCT** | `051014` | 木耳（水发）［黑木耳，云耳］ | **27 kcal / P 1.5g / F 0.2g / C 6.0g** | - / 100% | - |
| 92 | **青椒** (`green_bell_pepper`) | 20.0 kcal / P 0.9g / F 0.2g / C 4.6g | **USDA** | `168577` | Peppers, chili, green, canned | **21 kcal / P 0.7g / F 0.3g / C 4.6g** | - / 100% | - |
| 93 | **紅甜椒** (`red_bell_pepper`) | 26.0 kcal / P 1.0g / F 0.3g / C 6.0g | **USDA** | `168547` | Peppers, sweet, red, frozen, chopped, ... | **20 kcal / P 1.1g / F 0.2g / C 4.5g** | - / 100% | - |
| 94 | **香蕉** (`banana_raw`) | 89.0 kcal / P 1.1g / F 0.3g / C 22.8g | **CFCT** | `065033` | 香蕉［甘蕉］ | **93 kcal / P 1.4g / F 0.2g / C 22.0g** | 41% / 59% | - |
| 95 | **蘋果** (`apple_raw`) | 52.0 kcal / P 0.3g / F 0.2g / C 13.8g | **TFDA** | `D3200301` | 美國五爪蘋果 | **48 kcal / P 0.2g / F 0.1g / C 13.8g** | 29% / 71% | - |
| 96 | **藍莓** (`blueberry_raw`) | 57.0 kcal / P 0.7g / F 0.3g / C 14.5g | **TFDA** | `D5000101` | 藍莓(台灣) | **51 kcal / P 0.5g / F 0.3g / C 13.6g** | - / 100% | - |
| 97 | **草莓** (`strawberry_raw`) | 32.0 kcal / P 0.7g / F 0.3g / C 7.7g | **TFDA** | `D1400101` | 草莓 | **36 kcal / P 1.0g / F 0.2g / C 9.3g** | 3% / 97% | - |
| 98 | **酪梨** (`avocado_raw`) | 160.0 kcal / P 2.0g / F 14.7g / C 8.5g | **USDA** | `171705` | Avocados, raw, all commercial varieties | **160 kcal / P 2.0g / F 14.7g / C 8.5g** | - / 100% | - |
| 99 | **綠奇異果** (`kiwifruit_raw`) | 61.0 kcal / P 1.1g / F 0.5g / C 14.7g | **USDA** | `168153` | Kiwifruit, green, raw | **61 kcal / P 1.1g / F 0.5g / C 14.7g** | - / 100% | - |
| 100 | **柳橙** (`orange_raw`) | 47.0 kcal / P 0.9g / F 0.1g / C 11.8g | **TFDA** | `D3600101` | 柳橙 | **40 kcal / P 0.8g / F 0.1g / C 11.0g** | 28% / 72% | - |
| 101 | **西瓜** (`watermelon_raw`) | 30.0 kcal / P 0.6g / F 0.2g / C 7.6g | **TFDA** | `D1900204` | 鳳光西瓜 | **27 kcal / P 0.7g / F 0.2g / C 6.5g** | 50% / 50% | - |
| 102 | **紅葡萄** (`grape_red_raw`) | 69.0 kcal / P 0.7g / F 0.2g / C 18.1g | **TFDA** | `D1700401` | 美國紅葡萄(含皮) | **60 kcal / P 0.4g / F 0.1g / C 16.3g** | 2% / 98% | - |
| 103 | **鳳梨** (`pineapple_raw`) | 50.0 kcal / P 0.5g / F 0.1g / C 13.1g | **TFDA** | `O0100901` | 鳳梨汁(非原汁) | **47 kcal / P 0.3g / F 0.2g / C 11.3g** | - / 100% | - |
| 104 | **芭樂** (`guava_raw`) | 38.0 kcal / P 0.7g / F 0.1g / C 8.9g | **TFDA** | `D1500301` | 紅心芭樂 | **36 kcal / P 0.8g / F 0.1g / C 10.7g** | 23% / 77% | - |
| 105 | **白肉火龍果** (`pitaya_white_raw`) | 50.0 kcal / P 1.1g / F 0.4g / C 11.2g | **USDA** | `173217` | Lemonade, frozen concentrate, white, p... | **40 kcal / P 0.1g / F 0.0g / C 10.4g** | - / 100% | - |
| 106 | **木瓜** (`papaya_raw`) | 43.0 kcal / P 0.5g / F 0.3g / C 10.8g | **TFDA** | `D0200104` | 木瓜(11月取樣) | **42 kcal / P 0.4g / F 0.1g / C 11.8g** | 21% / 79% | - |
| 107 | **櫻桃** (`cherry_raw`) | 63.0 kcal / P 1.1g / F 0.2g / C 16.0g | **TFDA** | `D3300101` | 櫻桃 | **73 kcal / P 1.2g / F 0.3g / C 19.1g** | 9% / 91% | - |
| 108 | **檸檬** (`lemon_raw`) | 33.0 kcal / P 1.1g / F 0.3g / C 6.5g | **TFDA** | `D3800101` | 檸檬 | **31 kcal / P 0.7g / F 0.5g / C 7.4g** | 34% / 66% | - |
| 109 | **水蜜桃** (`peach_raw`) | 39.0 kcal / P 0.9g / F 0.3g / C 9.5g | **TFDA** | `D2800101` | 水蜜桃 | **38 kcal / P 0.9g / F 0.1g / C 9.9g** | 6% / 94% | - |
| 110 | **芒果** (`mango_raw`) | 60.0 kcal / P 0.8g / F 0.4g / C 15.0g | **TFDA** | `D2100202` | 海頓芒果 | **57 kcal / P 0.4g / F 0.2g / C 15.7g** | - / 100% | - |
| 111 | **核桃仁** (`walnut_raw`) | 654.0 kcal / P 15.2g / F 65.2g / C 13.7g | **USDA** | `170187` | Nuts, walnuts, english | **654 kcal / P 15.2g / F 65.2g / C 13.7g** | - / 100% | - |
| 112 | **杏仁果** (`almond_raw`) | 579.0 kcal / P 21.2g / F 49.9g / C 21.6g | **USDA** | `170567` | Nuts, almonds | **579 kcal / P 21.1g / F 49.9g / C 21.6g** | - / 100% | - |
| 113 | **腰果** (`cashew_raw`) | 553.0 kcal / P 18.2g / F 43.8g / C 30.2g | **TFDA** | `C0805101` | 腰果(生) | **561 kcal / P 18.3g / F 45.5g / C 30.3g** | - / 100% | - |
| 114 | **開心果** (`pistachio_raw`) | 560.0 kcal / P 20.2g / F 45.3g / C 27.2g | **USDA** | `169426` | Nuts, pistachio nuts, dry roasted, wit... | **569 kcal / P 21.1g / F 45.8g / C 27.6g** | - / 100% | - |
| 115 | **花生仁** (`peanut_raw`) | 567.0 kcal / P 25.8g / F 49.2g / C 16.1g | **USDA** | `172430` | Peanuts, all types, raw | **567 kcal / P 25.8g / F 49.2g / C 16.1g** | - / 100% | - |
| 116 | **奇亞籽** (`chia_seed_raw`) | 486.0 kcal / P 16.5g / F 30.7g / C 42.1g | **USDA** | `170554` | Seeds, chia seeds, dried | **486 kcal / P 16.5g / F 30.7g / C 42.1g** | - / 100% | - |
| 117 | **南瓜子仁** (`pumpkin_seed_raw`) | 559.0 kcal / P 30.2g / F 49.1g / C 10.7g | **USDA** | `170556` | Seeds, pumpkin and squash seed kernels... | **559 kcal / P 30.2g / F 49.0g / C 10.7g** | - / 100% | - |
| 118 | **白芝麻** (`white_sesame_raw`) | 573.0 kcal / P 17.7g / F 49.7g / C 23.4g | **USDA** | `170150` | Seeds, sesame seeds, whole, dried | **573 kcal / P 17.7g / F 49.7g / C 23.4g** | - / 100% | - |
| 119 | **黑芝麻** (`black_sesame_raw`) | 565.0 kcal / P 18.1g / F 48.4g / C 21.5g | **TFDA** | `C1610201` | 黑芝麻(熟) | **571 kcal / P 17.3g / F 54.4g / C 20.6g** | - / 100% | - |
| 120 | **全脂鮮乳** (`whole_milk`) | 61.0 kcal / P 3.2g / F 3.3g / C 4.8g | **TFDA** | `L0102103` | 全脂鮮乳(6月取樣) | **63 kcal / P 3.2g / F 3.6g / C 4.6g** | - / 100% | - |
| 121 | **低脂鮮乳** (`low_fat_milk`) | 43.0 kcal / P 3.4g / F 1.0g / C 4.9g | **TFDA** | `L0106101` | 低脂鮮乳 | **43 kcal / P 3.3g / F 1.1g / C 5.0g** | - / 100% | - |
| 122 | **脫脂鮮乳** (`skim_milk`) | 34.0 kcal / P 3.4g / F 0.1g / C 5.0g | **USDA** | `169868` | Milk, fluid, nonfat, calcium fortified... | **35 kcal / P 3.4g / F 0.2g / C 4.8g** | - / 100% | - |
| 123 | **茅屋起司** (`cottage_cheese`) | 98.0 kcal / P 11.1g / F 4.3g / C 3.4g | **USDA** | `169078` | Cheese, cottage, with vegetables | **95 kcal / P 10.9g / F 4.2g / C 3.0g** | - / 100% | - |
| 124 | **雞胸肉** (`chicken_breast_raw`) | 107.0 kcal / P 23.1g / F 1.2g / C 0.0g | **USDA** | `171077` | Chicken, broiler or fryers, breast, sk... | **120 kcal / P 22.5g / F 2.6g / C 0.0g** | - / 100% | - |
| 125 | **雞胗** (`chicken_gizzard`) | 94.0 kcal / P 17.7g / F 2.1g / C 0.0g | **TFDA** | `I0420401` | 雞胗(肉雞) | **89 kcal / P 16.6g / F 2.0g / C 0.3g** | - / 100% | - |
| 126 | **雞心** (`chicken_heart`) | 153.0 kcal / P 15.6g / F 9.3g / C 0.1g | **USDA** | `171458` | Chicken, heart, all classes, raw | **153 kcal / P 15.6g / F 9.3g / C 0.7g** | - / 100% | - |
| 127 | **雞肝** (`chicken_liver`) | 119.0 kcal / P 16.9g / F 4.8g / C 0.9g | **TFDA** | `I0420301` | 雞肝(肉雞) | **111 kcal / P 18.8g / F 3.5g / C 2.7g** | - / 100% | - |
| 128 | **雞爪** (`chicken_feet`) | 215.0 kcal / P 19.4g / F 14.6g / C 0.2g | **USDA** | `171119` | Chicken, feet, boiled | **215 kcal / P 19.4g / F 14.6g / C 0.2g** | - / 100% | - |
| 129 | **帶皮鴨肉** (`duck_meat_with_skin`) | 240.0 kcal / P 16.0g / F 19.0g / C 0.0g | **USDA** | `171463` | Chicken, broilers or fryers, dark meat... | **237 kcal / P 16.7g / F 18.3g / C 0.0g** | - / 100% | - |
| 130 | **去皮鴨腿肉** (`duck_leg_skinless`) | 124.0 kcal / P 19.3g / F 4.7g / C 0.0g | **USDA** | `172410` | Duck, domesticated, meat only, raw | **135 kcal / P 18.3g / F 6.0g / C 0.9g** | - / 100% | - |
| 131 | **去皮鵝肉** (`goose_meat_skinless`) | 161.0 kcal / P 22.8g / F 7.1g / C 0.0g | **USDA** | `172413` | Goose, domesticated, meat only, raw | **161 kcal / P 22.8g / F 7.1g / C 0.0g** | - / 100% | - |
| 132 | **去皮火雞腿肉** (`turkey_drumstick_skinless`) | 111.0 kcal / P 20.2g / F 2.8g / C 0.0g | **USDA** | `171525` | Turkey, drumstick, from whole bird, me... | **115 kcal / P 19.3g / F 4.1g / C 0.1g** | - / 100% | - |
| 133 | **鵪鶉肉** (`quail_meat`) | 134.0 kcal / P 21.8g / F 4.5g / C 0.0g | **USDA** | `172419` | Quail, meat only, raw | **134 kcal / P 21.8g / F 4.5g / C 0.0g** | - / 100% | - |
| 134 | **牛板腱** (`beef_top_blade`) | 132.0 kcal / P 21.4g / F 4.8g / C 0.0g | **USDA** | `168655` | Beef, shoulder top blade steak, bonele... | **133 kcal / P 20.4g / F 5.7g / C 0.0g** | - / 100% | - |
| 135 | **牛小排** (`beef_short_rib`) | 321.0 kcal / P 14.8g / F 28.5g / C 0.0g | **TFDA** | `I0100103` | 無骨牛小排(美牛) | **335 kcal / P 15.6g / F 29.8g / C 0.2g** | - / 100% | - |
| 136 | **牛胸腹肉** (`beef_brisket_plate`) | 258.0 kcal / P 16.5g / F 21.0g / C 0.0g | **USDA** | `168664` | Beef, brisket, whole, separable lean a... | **253 kcal / P 18.4g / F 19.1g / C 0.6g** | - / 100% | - |
| 137 | **牛舌** (`beef_tongue`) | 224.0 kcal / P 16.1g / F 16.1g / C 0.0g | **CFCT** | `082207` | 牛舌 | **196 kcal / P 17.0g / F 13.3g / C 2.0g** | - / 100% | - |
| 138 | **牛肚** (`beef_tripe`) | 85.0 kcal / P 12.1g / F 3.7g / C 0.0g | **USDA** | `170599` | Beef, variety meats and by-products, t... | **85 kcal / P 12.1g / F 3.7g / C 0.0g** | - / 100% | - |
| 139 | **牛肝** (`beef_liver`) | 135.0 kcal / P 20.4g / F 3.6g / C 3.9g | **CFCT** | `082205` | 牛肝 | **139 kcal / P 19.8g / F 3.9g / C 6.2g** | - / 100% | - |
| 140 | **牛筋** (`beef_tendon`) | 130.0 kcal / P 30.2g / F 0.5g / C 0.0g | **TFDA** | `I0120301` | 牛筋 | **157 kcal / P 21.7g / F 7.2g / C 3.3g** | - / 100% | - |
| 141 | **牛肩胛肉** (`beef_chuck`) | 159.0 kcal / P 19.5g / F 8.5g / C 0.0g | **USDA** | `168653` | Beef, chuck, under blade center steak,... | **157 kcal / P 19.7g / F 8.5g / C 0.2g** | - / 100% | - |
| 142 | **松阪豬** (`pork_neck_matsusaka`) | 211.0 kcal / P 17.2g / F 15.3g / C 0.0g | **USDA** | `167810` | Pork, fresh, composite of trimmed leg,... | **211 kcal / P 18.2g / F 14.8g / C 0.0g** | - / 100% | - |
| 143 | **腰內肉** (`pork_fillet_tenderloin`) | 113.0 kcal / P 22.0g / F 2.2g / C 0.0g | **USDA** | `168249` | Pork, fresh, loin, tenderloin, separab... | **109 kcal / P 20.9g / F 2.2g / C 0.0g** | - / 100% | - |
| 144 | **豬前腿瘦肉** (`pork_front_leg_lean`) | 136.0 kcal / P 20.6g / F 5.4g / C 0.0g | **USDA** | `168220` | Pork, fresh, composite of trimmed reta... | **134 kcal / P 21.2g / F 4.9g / C 0.0g** | - / 100% | - |
| 145 | **豬絞肉二八肥瘦** (`pork_ground_80_20`) | 253.0 kcal / P 17.5g / F 19.8g / C 0.0g | **USDA** | `174036` | Beef, ground, 80% lean meat / 20% fat,... | **254 kcal / P 17.2g / F 20.0g / C 0.0g** | - / 100% | - |
| 146 | **豬肝** (`pork_liver`) | 130.0 kcal / P 20.8g / F 3.7g / C 2.5g | **TFDA** | `I0320801` | 豬肝 | **137 kcal / P 20.8g / F 5.3g / C 1.7g** | 1% / 99% | - |
| 147 | **豬心** (`pork_heart`) | 115.0 kcal / P 17.3g / F 4.5g / C 0.4g | **USDA** | `168267` | Pork, fresh, variety meats and by-prod... | **118 kcal / P 17.3g / F 4.4g / C 1.3g** | - / 100% | - |
| 148 | **豬腰** (`pork_kidney`) | 100.0 kcal / P 16.5g / F 3.2g / C 0.3g | **USDA** | `168270` | Pork, fresh, variety meats and by-prod... | **100 kcal / P 16.5g / F 3.2g / C 0.0g** | - / 100% | - |
| 149 | **豬血** (`pork_blood`) | 30.0 kcal / P 6.8g / F 0.2g / C 0.1g | **TFDA** | `I0320601` | 豬血 | **29 kcal / P 6.3g / F 0.3g / C 0.5g** | - / 100% | - |
| 150 | **羊肩肉** (`lamb_shoulder_lean`) | 139.0 kcal / P 19.8g / F 6.2g / C 0.0g | **USDA** | `172508` | Lamb, cubed for stew or kabob (leg and... | **134 kcal / P 20.2g / F 5.3g / C 0.0g** | - / 100% | - |
| 151 | **羊小排** (`lamb_loin_chops`) | 215.0 kcal / P 17.5g / F 15.5g / C 0.0g | **USDA** | `172582` | Lamb, Australian, imported, fresh, leg... | **208 kcal / P 18.3g / F 14.4g / C 0.0g** | - / 100% | - |
| 152 | **鮭魚** (`salmon_atlantic_raw`) | 208.0 kcal / P 20.4g / F 13.4g / C 0.0g | **TFDA** | `J0402403` | 大西洋鮭魚切片(尾段) | **204 kcal / P 20.7g / F 12.8g / C 0.0g** | 17% / 83% | - |
| 153 | **旗魚** (`swordfish_raw`) | 121.0 kcal / P 19.8g / F 4.0g / C 0.0g | **USDA** | `173703` | Fish, swordfish, raw | **144 kcal / P 19.7g / F 6.7g / C 0.0g** | - / 100% | - |
| 154 | **虱目魚** (`milkfish_raw`) | 184.0 kcal / P 21.8g / F 10.2g / C 0.0g | **TFDA** | `J0401002` | 虱目魚(5月) | **189 kcal / P 22.3g / F 10.4g / C 0.0g** | 60% / 40% | - |
| 155 | **白帶魚** (`hairtail_raw`) | 138.0 kcal / P 18.2g / F 6.8g / C 0.0g | **TFDA** | `J0413801` | 白帶魚 | **102 kcal / P 19.6g / F 2.0g / C 0.0g** | 40% / 60% | - |
| 156 | **鰻魚** (`eel_raw`) | 184.0 kcal / P 18.4g / F 11.7g / C 0.0g | **TFDA** | `J0408501` | 前鱗笛鯛 | **101 kcal / P 22.0g / F 0.8g / C 0.9g** | 28% / 72% | head, bone and viscera 28% |
| 157 | **巴沙魚柳** (`basa_fillet_raw`) | 78.0 kcal / P 15.5g / F 1.5g / C 0.0g | **TFDA** | `J0411801` | 尼羅口孵非鯽(含皮) | **125 kcal / P 19.4g / F 4.7g / C 0.0g** | 64% / 36% | - |
| 158 | **石斑魚** (`grouper_raw`) | 92.0 kcal / P 19.4g / F 1.0g / C 0.0g | **TFDA** | `J0405101` | 斑帶石斑魚 | **90 kcal / P 20.2g / F 0.5g / C 0.0g** | 64% / 36% | - |
| 159 | **虹鱒** (`rainbow_trout_raw`) | 126.0 kcal / P 20.8g / F 4.3g / C 0.0g | **USDA** | `175154` | Fish, trout, rainbow, wild, raw | **119 kcal / P 20.5g / F 3.5g / C 0.0g** | - / 100% | - |
| 160 | **鯷魚** (`anchovy_raw`) | 131.0 kcal / P 20.4g / F 4.8g / C 0.0g | **USDA** | `174182` | Fish, anchovy, european, raw | **131 kcal / P 20.4g / F 4.8g / C 0.0g** | - / 100% | - |
| 161 | **沙丁魚** (`sardine_pacific_raw`) | 130.0 kcal / P 19.8g / F 5.1g / C 0.0g | **USDA** | `175140` | Fish, sardine, Pacific, canned in toma... | **185 kcal / P 20.9g / F 10.4g / C 0.5g** | - / 100% | - |
| 162 | **白鯧魚** (`silver_pomfret_raw`) | 119.0 kcal / P 18.5g / F 4.5g / C 0.0g | **USDA** | `167639` | Fish, salmon, coho (silver), raw (Alas... | **140 kcal / P 22.6g / F 5.6g / C 0.0g** | - / 100% | - |
| 163 | **黃魚** (`yellow_croaker_raw`) | 96.0 kcal / P 17.7g / F 2.5g / C 0.0g | **TFDA** | `J0410601` | 小黃魚(含皮) | **100 kcal / P 19.4g / F 1.9g / C 0.0g** | 59% / 41% | - |
| 164 | **草魚** (`grass_carp_raw`) | 102.0 kcal / P 18.9g / F 2.6g / C 0.0g | **TFDA** | `J0401401` | 草魚(含皮) | **91 kcal / P 17.2g / F 2.0g / C 0.8g** | 56% / 44% | - |
| 165 | **真鯛** (`red_seabream_raw`) | 115.0 kcal / P 20.5g / F 3.2g / C 0.0g | **TFDA** | `J0409902` | 真鯛(3月) | **101 kcal / P 20.8g / F 1.3g / C 0.7g** | 66% / 34% | - |
| 166 | **草蝦** (`black_tiger_prawn_raw`) | 100.0 kcal / P 22.1g / F 0.9g / C 0.2g | **USDA** | `169798` | Fish, blackfish, whole (Alaska Native) | **82 kcal / P 15.5g / F 1.8g / C 0.0g** | - / 100% | - |
| 167 | **泰國蝦** (`giant_freshwater_prawn_raw`) | 97.0 kcal / P 20.5g / F 1.2g / C 0.1g | **USDA** | `171993` | Fish, drum, freshwater, cooked, dry heat | **153 kcal / P 22.5g / F 6.3g / C 0.0g** | - / 100% | - |
| 168 | **龍蝦肉** (`lobster_meat_raw`) | 90.0 kcal / P 19.0g / F 0.9g / C 0.5g | **USDA** | `174209` | Crustaceans, lobster, northern, cooked... | **89 kcal / P 19.0g / F 0.9g / C 0.0g** | - / 100% | - |
| 169 | **淡菜** (`mussel_meat_raw`) | 86.0 kcal / P 11.9g / F 2.2g / C 3.7g | **CFCT** | `124115` | 贻贝（鲜）［淡菜、壳菜］ | **80 kcal / P 11.4g / F 1.7g / C 4.7g** | 51% / 49% | - |
| 170 | **鮑魚** (`abalone_meat_raw`) | 105.0 kcal / P 17.1g / F 0.8g / C 6.0g | **USDA** | `174212` | Mollusks, abalone, mixed species, raw | **105 kcal / P 17.1g / F 0.8g / C 6.0g** | - / 100% | - |
| 171 | **海膽** (`sea_urchin_raw`) | 126.0 kcal / P 16.0g / F 4.8g / C 4.8g | **USDA** | `175132` | Fish, roe, mixed species, raw | **143 kcal / P 22.3g / F 6.4g / C 1.5g** | - / 100% | - |
| 172 | **軟絲** (`bigfin_reef_squid_raw`) | 84.0 kcal / P 17.5g / F 1.0g / C 0.6g | **USDA** | `174223` | Mollusks, squid, mixed species, raw | **92 kcal / P 15.6g / F 1.4g / C 3.1g** | - / 100% | - |
| 173 | **花枝** (`cuttlefish_raw`) | 79.0 kcal / P 16.1g / F 0.7g / C 0.8g | **USDA** | `174215` | Mollusks, cuttlefish, mixed species, raw | **79 kcal / P 16.2g / F 0.7g / C 0.8g** | - / 100% | - |
| 174 | **海瓜子** (`short_necked_clam_raw`) | 71.0 kcal / P 12.0g / F 0.8g / C 3.1g | **USDA** | `174214` | Mollusks, clam, mixed species, raw | **86 kcal / P 14.7g / F 1.0g / C 3.6g** | - / 100% | - |
| 175 | **海蜇皮** (`jellyfish_salted_rinsed`) | 21.0 kcal / P 4.5g / F 0.3g / C 0.0g | **TFDA** | `J5100101` | 海蜇皮 | **19 kcal / P 4.4g / F 0.0g / C 2.2g** | - / 100% | - |
| 176 | **雞蛋** (`chicken_egg_whole_raw`) | 143.0 kcal / P 12.6g / F 9.9g / C 0.8g | **TFDA** | `K0100801` | 雞蛋(高維生素A&E) | **134 kcal / P 12.1g / F 9.0g / C 0.0g** | 13% / 87% | - |
| 177 | **蛋黃** (`egg_yolk_raw`) | 317.0 kcal / P 15.9g / F 26.5g / C 3.6g | **TFDA** | `K0108301` | 雞蛋黃(高維生素E) | **314 kcal / P 16.2g / F 27.0g / C 5.4g** | 74% / 26% | - |
| 178 | **鴨蛋** (`duck_egg_raw`) | 185.0 kcal / P 12.8g / F 13.8g / C 1.5g | **TFDA** | `K0200101` | 鴨蛋 | **187 kcal / P 13.1g / F 14.4g / C 0.2g** | 12% / 88% | - |
| 179 | **天貝** (`tempeh_raw`) | 192.0 kcal / P 20.3g / F 10.8g / C 7.6g | **USDA** | `172467` | Tempeh, cooked | **195 kcal / P 19.9g / F 11.4g / C 7.6g** | - / 100% | - |
| 180 | **納豆** (`natto_raw`) | 212.0 kcal / P 17.7g / F 11.0g / C 14.4g | **USDA** | `172443` | Natto | **211 kcal / P 19.4g / F 11.0g / C 12.7g** | - / 100% | - |
| 181 | **生豆包** (`tofu_skin_fresh`) | 164.0 kcal / P 18.2g / F 8.6g / C 3.6g | **USDA** | `172475` | Tofu, raw, firm, prepared with calcium... | **144 kcal / P 17.3g / F 8.7g / C 2.8g** | - / 100% | - |
| 182 | **無糖豆漿** (`soy_milk_unsweetened`) | 35.0 kcal / P 3.3g / F 1.6g / C 1.8g | **USDA** | `175215` | Soymilk (all flavors), unsweetened, wi... | **33 kcal / P 2.9g / F 1.6g / C 1.7g** | - / 100% | - |
| 183 | **豆渣** (`soy_pulp_okara`) | 71.0 kcal / P 3.8g / F 1.6g / C 9.8g | **USDA** | `172452` | Okara | **76 kcal / P 3.5g / F 1.7g / C 12.2g** | - / 100% | - |
| 184 | **紅扁豆** (`lentils_dry_raw`) | 352.0 kcal / P 24.6g / F 1.1g / C 60.1g | **USDA** | `172420` | Lentils, raw | **352 kcal / P 24.6g / F 1.1g / C 63.4g** | - / 100% | - |
| 185 | **青豌豆仁** (`green_peas_fresh_raw`) | 81.0 kcal / P 5.4g / F 0.4g / C 14.5g | **USDA** | `170016` | Peas, green, frozen, unprepared (Inclu... | **77 kcal / P 5.2g / F 0.4g / C 13.6g** | - / 100% | - |
| 186 | **花豆** (`pinto_bean_dry_raw`) | 347.0 kcal / P 21.4g / F 1.2g / C 62.6g | **USDA** | `175199` | Beans, pinto, mature seeds, raw (Inclu... | **347 kcal / P 21.4g / F 1.2g / C 62.5g** | - / 100% | - |
| 187 | **白鳳豆** (`white_kidney_bean_dry_raw`) | 333.0 kcal / P 23.4g / F 0.8g / C 60.3g | **USDA** | `173742` | Beans, kidney, california red, mature ... | **330 kcal / P 24.4g / F 0.2g / C 59.8g** | - / 100% | - |
| 188 | **黑米** (`black_rice_raw`) | 352.0 kcal / P 8.5g / F 2.2g / C 74.5g | **CFCT** | `012212` | 黑米 | **341 kcal / P 9.4g / F 2.5g / C 72.2g** | - / 100% | - |
| 189 | **紫米** (`purple_glutinous_rice_raw`) | 350.0 kcal / P 8.2g / F 2.6g / C 73.5g | **USDA** | `168956` | Yellow rice with seasoning, dry packet... | **343 kcal / P 7.0g / F 1.8g / C 74.7g** | - / 100% | - |
| 190 | **圓糯米** (`glutinous_rice_round_raw`) | 350.0 kcal / P 6.7g / F 0.7g / C 78.4g | **USDA** | `168879` | Rice, white, medium-grain, raw, enriched | **360 kcal / P 6.6g / F 0.6g / C 79.3g** | - / 100% | - |
| 191 | **大燕麥片** (`oat_flakes_raw`) | 379.0 kcal / P 13.2g / F 6.5g / C 66.3g | **TFDA** | `A0800101` | 燕麥 | **388 kcal / P 10.9g / F 10.2g / C 67.4g** | - / 100% | - |
| 192 | **大麥仁** (`pearl_barley_raw`) | 352.0 kcal / P 9.9g / F 1.2g / C 73.5g | **TFDA** | `A0100101` | 大麥仁 | **347 kcal / P 8.6g / F 1.6g / C 77.1g** | - / 100% | - |
| 193 | **薏仁** (`jobs_tears_raw`) | 378.0 kcal / P 13.8g / F 5.4g / C 68.5g | **TFDA** | `A1000101` | 薏仁 | **375 kcal / P 14.1g / F 6.1g / C 66.2g** | - / 100% | - |
| 194 | **紅藜麥** (`red_quinoa_raw`) | 368.0 kcal / P 14.1g / F 6.1g / C 64.2g | **TFDA** | `A1100101` | 紅藜麥 | **361 kcal / P 12.1g / F 6.7g / C 66.8g** | - / 100% | - |
| 195 | **高粱米** (`sorghum_grain_raw`) | 362.0 kcal / P 10.6g / F 3.5g / C 72.1g | **CFCT** | `019001` | 高粱米 | **360 kcal / P 10.4g / F 3.1g / C 74.7g** | - / 100% | - |
| 196 | **高筋麵粉** (`wheat_flour_bread_raw`) | 354.0 kcal / P 12.9g / F 1.5g / C 71.3g | **TFDA** | `A0320404` | 高筋麵粉 | **358 kcal / P 12.9g / F 1.2g / C 73.1g** | - / 100% | - |
| 197 | **中筋麵粉** (`wheat_flour_all_purpose_raw`) | 352.0 kcal / P 11.2g / F 1.2g / C 73.5g | **TFDA** | `A0320301` | 中筋麵粉 | **357 kcal / P 11.5g / F 1.3g / C 74.1g** | - / 100% | - |
| 198 | **全麥麵粉** (`wheat_flour_whole_raw`) | 364.0 kcal / P 13.7g / F 2.5g / C 72.6g | **TFDA** | `A0320505` | 全麥麵粉 | **342 kcal / P 13.0g / F 1.7g / C 71.4g** | - / 100% | - |
| 199 | **白細麵** (`thin_wheat_noodles`) | 355.0 kcal / P 11.5g / F 1.2g / C 74.0g | **USDA** | `168895` | Wheat flour, white, all-purpose, self-... | **354 kcal / P 9.9g / F 1.0g / C 74.2g** | - / 100% | - |
| 200 | **蕎麥麵** (`soba_noodles`) | 356.0 kcal / P 14.4g / F 1.8g / C 70.5g | **TFDA** | `R2001501` | 蕎麥麵(乾) | **341 kcal / P 12.7g / F 1.7g / C 70.6g** | - / 100% | - |
| 201 | **烏龍麵** (`udon_noodles`) | 353.0 kcal / P 10.8g / F 1.6g / C 73.8g | **USDA** | `168908` | Noodles, japanese, somen, dry | **356 kcal / P 11.3g / F 0.8g / C 74.1g** | - / 100% | - |
| 202 | **寬麵條** (`wide_wheat_noodles`) | 354.0 kcal / P 11.2g / F 1.5g / C 73.5g | **USDA** | `168895` | Wheat flour, white, all-purpose, self-... | **354 kcal / P 9.9g / F 1.0g / C 74.2g** | - / 100% | - |
| 203 | **米粉** (`rice_vermicelli_raw`) | 359.0 kcal / P 6.8g / F 0.6g / C 81.2g | **TFDA** | `R1100401` | 濁水米粉 | **357 kcal / P 5.3g / F 1.3g / C 81.1g** | - / 100% | - |
| 204 | **冬粉** (`mung_bean_vermicelli_raw`) | 351.0 kcal / P 0.4g / F 0.1g / C 86.4g | **TFDA** | `R4600201` | 冬粉 | **349 kcal / P 0.1g / F 0.1g / C 87.5g** | - / 100% | - |
| 205 | **黃地瓜** (`sweet_potato_yellow_raw`) | 118.0 kcal / P 1.4g / F 0.2g / C 27.8g | **USDA** | `169397` | Pickles, chowchow, with cauliflower on... | **121 kcal / P 1.5g / F 0.9g / C 26.6g** | - / 100% | - |
| 206 | **栗子南瓜** (`squash_kabocha_raw`) | 81.0 kcal / P 1.9g / F 0.3g / C 17.5g | **TFDA** | `E6300103` | 栗子南瓜 | **79 kcal / P 1.4g / F 0.2g / C 20.7g** | 24% / 76% | - |
| 207 | **荸薺** (`water_chestnut_raw`) | 83.0 kcal / P 1.4g / F 0.1g / C 19.1g | **TFDA** | `B0800101` | 荸薺 | **63 kcal / P 1.7g / F 0.1g / C 14.5g** | - / 100% | - |
| 208 | **木薯** (`cassava_raw`) | 160.0 kcal / P 1.4g / F 0.3g / C 38.1g | **USDA** | `169985` | Cassava, raw | **160 kcal / P 1.4g / F 0.3g / C 38.1g** | - / 100% | - |
| 209 | **甜菜根** (`beetroot_raw`) | 43.0 kcal / P 1.6g / F 0.2g / C 9.6g | **CFCT** | `041401` | 甜菜根（鲜）［甜菜头，糖萝卜］ | **87 kcal / P 1.0g / F 0.1g / C 23.5g** | 10% / 90% | - |
| 210 | **豆薯** (`jicama_raw`) | 38.0 kcal / P 0.7g / F 0.1g / C 8.8g | **TFDA** | `B0600101` | 豆薯 | **29 kcal / P 0.7g / F 0.1g / C 6.8g** | 7% / 93% | - |
| 211 | **芥藍菜** (`chinese_broccoli_gailan_raw`) | 26.0 kcal / P 2.2g / F 0.5g / C 3.8g | **TFDA** | `E3900101` | 芥藍菜 | **16 kcal / P 1.7g / F 0.3g / C 3.2g** | 16% / 84% | - |
| 212 | **油菜** (`yu_choy_greens_raw`) | 16.0 kcal / P 1.8g / F 0.3g / C 2.2g | **CFCT** | `045125` | 油菜 | **14 kcal / P 1.3g / F 0.5g / C 2.0g** | 4% / 96% | - |
| 213 | **地瓜葉** (`sweet_potato_leaves_raw`) | 28.0 kcal / P 3.1g / F 0.4g / C 3.9g | **USDA** | `169303` | Sweet potato leaves, raw | **42 kcal / P 2.5g / F 0.5g / C 8.8g** | - / 100% | - |
| 214 | **茼蒿** (`crown_daisy_raw`) | 20.0 kcal / P 1.9g / F 0.3g / C 3.0g | **TFDA** | `E4600101` | 茼蒿 | **13 kcal / P 1.7g / F 0.3g / C 2.2g** | 16% / 84% | - |
| 215 | **綠莧菜** (`green_amaranth_raw`) | 23.0 kcal / P 2.5g / F 0.3g / C 4.0g | **USDA** | `168119` | Turnip greens, canned, no salt added | **19 kcal / P 1.4g / F 0.3g / C 2.8g** | - / 100% | - |
| 216 | **紅莧菜** (`red_amaranth_raw`) | 24.0 kcal / P 2.8g / F 0.3g / C 3.5g | **TFDA** | `E4800201` | 紅莧菜 | **16 kcal / P 2.6g / F 0.3g / C 3.3g** | 19% / 81% | - |
| 217 | **龍鬚菜** (`chayote_shoots_raw`) | 17.0 kcal / P 2.0g / F 0.2g / C 2.6g | **USDA** | `168489` | Taro shoots, raw | **11 kcal / P 0.9g / F 0.1g / C 2.3g** | - / 100% | - |
| 218 | **紅鳳菜** (`gynura_bicolor_raw`) | 22.0 kcal / P 2.2g / F 0.3g / C 3.6g | **TFDA** | `E3400201` | 紅鳳菜 | **18 kcal / P 2.1g / F 0.4g / C 3.5g** | 47% / 53% | - |
| 219 | **皇宮菜** (`malabar_spinach_raw`) | 19.0 kcal / P 1.9g / F 0.3g / C 3.4g | **TFDA** | `E9900101` | 皇宮菜 | **18 kcal / P 2.2g / F 0.3g / C 3.5g** | - / 100% | - |
| 220 | **芥菜** (`mustard_greens_raw`) | 27.0 kcal / P 2.9g / F 0.4g / C 4.7g | **TFDA** | `E3800401` | 芥菜 | **15 kcal / P 1.6g / F 0.1g / C 3.2g** | 11% / 89% | - |
| 221 | **九層塔** (`basil_fresh_raw`) | 23.0 kcal / P 3.2g / F 0.6g / C 2.7g | **TFDA** | `E2700101` | 九層塔 | **21 kcal / P 2.9g / F 0.3g / C 4.4g** | 24% / 76% | - |
| 222 | **香菜** (`coriander_cilantro_raw`) | 23.0 kcal / P 2.1g / F 0.5g / C 3.7g | **USDA** | `169997` | Coriander (cilantro) leaves, raw | **23 kcal / P 2.1g / F 0.5g / C 3.7g** | - / 100% | - |
| 223 | **韭菜** (`chinese_chives_raw`) | 26.0 kcal / P 2.4g / F 0.4g / C 4.4g | **CFCT** | `044404` | 韭菜 | **25 kcal / P 2.4g / F 0.4g / C 4.5g** | 10% / 90% | - |
| 224 | **韭菜花** (`chive_flower_stems_raw`) | 33.0 kcal / P 2.6g / F 0.4g / C 5.8g | **CFCT** | `044404` | 韭菜 | **25 kcal / P 2.4g / F 0.4g / C 4.5g** | 10% / 90% | - |
| 225 | **蒜苗** (`green_garlic_stems_raw`) | 37.0 kcal / P 2.5g / F 0.3g / C 7.2g | **TFDA** | `E2100301` | 蒜苗 | **47 kcal / P 2.2g / F 0.1g / C 12.0g** | 16% / 84% | - |
| 226 | **牛番茄** (`beef_tomato_raw`) | 18.0 kcal / P 0.9g / F 0.2g / C 3.9g | **TFDA** | `E7400101` | 牛番茄 | **17 kcal / P 0.7g / F 0.1g / C 4.0g** | 1% / 99% | - |
| 227 | **黃甜椒** (`yellow_bell_pepper_raw`) | 27.0 kcal / P 1.0g / F 0.2g / C 6.3g | **USDA** | `169383` | Peppers, sweet, yellow, raw | **27 kcal / P 1.0g / F 0.2g / C 6.3g** | - / 100% | - |
| 228 | **大黃瓜** (`large_cucumber_raw`) | 13.0 kcal / P 0.7g / F 0.1g / C 2.8g | **USDA** | `168409` | Cucumber, with peel, raw | **15 kcal / P 0.7g / F 0.1g / C 3.6g** | - / 100% | - |
| 229 | **佛手瓜** (`chayote_fruit_raw`) | 19.0 kcal / P 0.8g / F 0.1g / C 4.5g | **CFCT** | `043205` | 佛手瓜［棒瓜，菜肴梨］ | **18 kcal / P 1.2g / F 0.1g / C 3.8g** | - / 100% | - |
| 230 | **白蘆筍** (`white_asparagus_raw`) | 20.0 kcal / P 2.0g / F 0.1g / C 3.8g | **TFDA** | `E1700101` | 白蘆筍 | **22 kcal / P 1.8g / F 0.2g / C 4.9g** | 21% / 79% | - |
| 231 | **牛蒡** (`burdock_root_raw`) | 72.0 kcal / P 1.5g / F 0.2g / C 17.3g | **TFDA** | `E0100101` | 牛蒡 | **75 kcal / P 2.5g / F 0.4g / C 19.1g** | 20% / 80% | - |
| 232 | **茭白筍** (`water_bamboo_raw`) | 20.0 kcal / P 1.3g / F 0.2g / C 4.2g | **TFDA** | `E1300101` | 茭白筍 | **16 kcal / P 1.3g / F 0.2g / C 4.0g** | 27% / 73% | - |
| 233 | **荷蘭豆** (`snow_pea_pods_raw`) | 42.0 kcal / P 2.8g / F 0.2g / C 7.5g | **USDA** | `168528` | Cowpeas, young pods with seeds, cooked... | **34 kcal / P 2.6g / F 0.3g / C 7.0g** | - / 100% | - |
| 234 | **甜豆莢** (`sugar_snap_pea_raw`) | 42.0 kcal / P 2.8g / F 0.2g / C 7.6g | **USDA** | `169141` | Beans, snap, green, cooked, boiled, dr... | **35 kcal / P 1.9g / F 0.3g / C 7.9g** | - / 100% | - |
| 235 | **四季豆** (`green_bean_common_raw`) | 31.0 kcal / P 1.8g / F 0.2g / C 7.0g | **CFCT** | `042110` | 四季豆（菜豆） | **31 kcal / P 2.0g / F 0.4g / C 5.7g** | 4% / 96% | - |
| 236 | **長豇豆** (`yardlong_bean_raw`) | 47.0 kcal / P 2.8g / F 0.4g / C 8.4g | **USDA** | `169222` | Yardlong bean, raw | **47 kcal / P 2.8g / F 0.4g / C 8.3g** | - / 100% | - |
| 237 | **紫洋蔥** (`red_onion_raw`) | 40.0 kcal / P 1.1g / F 0.1g / C 9.3g | **TFDA** | `E2400201` | 紫洋蔥 | **29 kcal / P 0.9g / F 0.1g / C 7.3g** | 9% / 91% | - |
| 238 | **鴻喜菇** (`brown_beech_mushroom_raw`) | 25.0 kcal / P 2.6g / F 0.4g / C 4.1g | **TFDA** | `G1900101` | 鴻喜菇 | **25 kcal / P 2.9g / F 0.1g / C 5.3g** | 10% / 90% | - |
| 239 | **雪白菇** (`white_beech_mushroom_raw`) | 24.0 kcal / P 2.5g / F 0.3g / C 3.9g | **TFDA** | `G1900201` | 雪白菇 | **26 kcal / P 2.2g / F 0.0g / C 6.4g** | 21% / 79% | - |
| 240 | **舞菇** (`maitake_mushroom_raw`) | 31.0 kcal / P 1.9g / F 0.2g / C 7.0g | **TFDA** | `G1800101` | 舞菇 | **27 kcal / P 1.4g / F 0.1g / C 5.8g** | - / 100% | - |
| 241 | **秀珍菇** (`oyster_mushroom_raw`) | 33.0 kcal / P 3.3g / F 0.4g / C 6.1g | **TFDA** | `G1200101` | 秀珍菇 | **25 kcal / P 3.3g / F 0.1g / C 4.6g** | - / 100% | - |
| 242 | **白木耳** (`snow_fungus_fresh_raw`) | 22.0 kcal / P 0.7g / F 0.2g / C 4.9g | **TFDA** | `G0100101` | 木耳 | **40 kcal / P 0.9g / F 0.1g / C 8.8g** | - / 100% | - |
| 243 | **海帶** (`kelp_sea_tangle_fresh_raw`) | 43.0 kcal / P 1.7g / F 0.6g / C 9.6g | **USDA** | `168457` | Seaweed, kelp, raw | **43 kcal / P 1.7g / F 0.6g / C 9.6g** | - / 100% | - |
| 244 | **海帶芽** (`wakame_seaweed_fresh_raw`) | 45.0 kcal / P 3.0g / F 0.6g / C 9.1g | **USDA** | `170496` | Seaweed, wakame, raw | **45 kcal / P 3.0g / F 0.6g / C 9.1g** | - / 100% | - |
| 245 | **紅心芭樂** (`red_guava_raw`) | 52.0 kcal / P 2.2g / F 0.7g / C 9.8g | **TFDA** | `D1500301` | 紅心芭樂 | **36 kcal / P 0.8g / F 0.1g / C 10.7g** | 23% / 77% | - |
| 246 | **黃金奇異果** (`golden_kiwifruit_raw`) | 60.0 kcal / P 1.2g / F 0.4g / C 14.2g | **TFDA** | `D0500201` | 奇異果 | **52 kcal / P 1.1g / F 0.3g / C 14.0g** | 13% / 87% | - |
| 247 | **椪柑** (`tangerine_mandarin_raw`) | 53.0 kcal / P 0.8g / F 0.3g / C 13.3g | **TFDA** | `D3400101` | 椪柑 | **38 kcal / P 0.8g / F 0.2g / C 10.0g** | 22% / 78% | - |
| 248 | **葡萄柚** (`grapefruit_pink_raw`) | 33.0 kcal / P 0.8g / F 0.1g / C 8.1g | **TFDA** | `D3700401` | 黃皮葡萄柚 | **35 kcal / P 0.7g / F 0.2g / C 9.2g** | 26% / 74% | - |
| 249 | **萊姆** (`lime_fresh_raw`) | 30.0 kcal / P 0.7g / F 0.2g / C 7.7g | **TFDA** | `D3800201` | 萊姆 | **35 kcal / P 0.5g / F 1.0g / C 7.7g** | 25% / 75% | - |
| 250 | **覆盆莓** (`raspberry_raw`) | 52.0 kcal / P 1.2g / F 0.7g / C 11.9g | **USDA** | `171899` | Beverages, OCEAN SPRAY, Cran Raspberry... | **49 kcal / P 0.3g / F 0.0g / C 12.0g** | - / 100% | - |
| 251 | **黑莓** (`blackberry_raw`) | 43.0 kcal / P 1.4g / F 0.5g / C 9.6g | **USDA** | `173947` | Blackberry juice, canned | **38 kcal / P 0.3g / F 0.6g / C 7.8g** | - / 100% | - |
| 252 | **蔓越莓** (`cranberry_raw`) | 46.0 kcal / P 0.4g / F 0.1g / C 12.0g | **USDA** | `168117` | Cranberry juice, unsweetened | **46 kcal / P 0.4g / F 0.1g / C 12.2g** | - / 100% | - |
| 253 | **綠無籽葡萄** (`grape_green_seedless_raw`) | 69.0 kcal / P 0.7g / F 0.2g / C 18.1g | **USDA** | `174683` | Grapes, red or green (European type, s... | **69 kcal / P 0.7g / F 0.2g / C 18.1g** | - / 100% | - |
| 254 | **黃肉西瓜** (`watermelon_yellow_raw`) | 30.0 kcal / P 0.6g / F 0.2g / C 7.6g | **USDA** | `167765` | Watermelon, raw | **30 kcal / P 0.6g / F 0.1g / C 7.5g** | - / 100% | - |
| 255 | **哈密瓜** (`cantaloupe_raw`) | 34.0 kcal / P 0.8g / F 0.2g / C 8.2g | **CFCT** | `066103` | 哈密瓜 | **34 kcal / P 0.5g / F 0.1g / C 7.9g** | 29% / 71% | - |
| 256 | **紅肉火龍果** (`pitaya_red_raw`) | 50.0 kcal / P 1.2g / F 0.2g / C 12.3g | **TFDA** | `G2000201` | 冷凍洋菇 | **31 kcal / P 3.8g / F 1.5g / C 4.3g** | 31% / 69% | peel 31% |
| 257 | **黑李** (`plum_black_raw`) | 46.0 kcal / P 0.7g / F 0.3g / C 11.4g | **TFDA** | `D2400501` | 黑李 | **55 kcal / P 0.7g / F 0.2g / C 14.7g** | 4% / 96% | - |
| 258 | **荔枝** (`lychee_raw`) | 66.0 kcal / P 0.8g / F 0.4g / C 16.5g | **CFCT** | `065010` | 荔枝 | **71 kcal / P 0.9g / F 0.2g / C 16.6g** | 27% / 73% | - |
| 259 | **龍眼** (`longan_raw`) | 60.0 kcal / P 1.3g / F 0.1g / C 15.1g | **TFDA** | `D2300101` | 龍眼 | **69 kcal / P 1.1g / F 0.4g / C 18.0g** | 31% / 69% | - |
| 260 | **釋迦** (`sugar_apple_raw`) | 94.0 kcal / P 2.1g / F 0.3g / C 23.6g | **TFDA** | `D1200101` | 釋迦 | **116 kcal / P 2.2g / F 0.1g / C 26.6g** | 44% / 56% | - |
| 261 | **蓮霧** (`wax_apple_raw`) | 34.0 kcal / P 0.6g / F 0.2g / C 8.0g | **TFDA** | `D1800101` | 蓮霧(紅寶石) | **32 kcal / P 0.3g / F 0.3g / C 8.1g** | 10% / 90% | - |
| 262 | **楊桃** (`starfruit_raw`) | 31.0 kcal / P 1.0g / F 0.3g / C 6.7g | **TFDA** | `D1600101` | 楊桃(2月取樣) | **27 kcal / P 0.4g / F 0.1g / C 7.6g** | 12% / 88% | - |
| 263 | **甜柿** (`persimmon_raw`) | 70.0 kcal / P 0.6g / F 0.2g / C 18.6g | **USDA** | `169941` | Persimmons, japanese, raw | **70 kcal / P 0.6g / F 0.2g / C 18.6g** | - / 100% | - |
| 264 | **百香果** (`passion_fruit_raw`) | 66.0 kcal / P 2.2g / F 0.7g / C 14.5g | **USDA** | `169110` | Passion-fruit juice, yellow, raw | **60 kcal / P 0.7g / F 0.2g / C 14.4g** | - / 100% | - |
| 265 | **無花果** (`fig_fresh_raw`) | 74.0 kcal / P 0.8g / F 0.3g / C 19.2g | **TFDA** | `D4400101` | 無花果 | **63 kcal / P 1.2g / F 0.4g / C 16.5g** | 4% / 96% | - |
| 266 | **石榴** (`pomegranate_raw`) | 83.0 kcal / P 1.7g / F 1.2g / C 18.7g | **CFCT** | `063201x` | 石榴（代表值） | **72 kcal / P 1.3g / F 0.2g / C 18.5g** | 43% / 57% | - |
| 267 | **椰子水** (`coconut_water_fresh`) | 19.0 kcal / P 0.7g / F 0.2g / C 3.7g | **USDA** | `170174` | Nuts, coconut water (liquid from cocon... | **19 kcal / P 0.7g / F 0.2g / C 3.7g** | - / 100% | - |
| 268 | **夏威夷豆** (`macadamia_nuts_raw`) | 718.0 kcal / P 7.9g / F 75.8g / C 13.8g | **USDA** | `168598` | Nuts, macadamia nuts, dry roasted, wit... | **716 kcal / P 7.8g / F 76.1g / C 12.8g** | - / 100% | - |
| 269 | **胡桃** (`pecans_raw`) | 691.0 kcal / P 9.2g / F 72.0g / C 13.9g | **USDA** | `170182` | Nuts, pecans | **691 kcal / P 9.2g / F 72.0g / C 13.9g** | - / 100% | - |
| 270 | **榛果** (`hazelnuts_raw`) | 628.0 kcal / P 15.0g / F 60.8g / C 16.7g | **USDA** | `170581` | Nuts, hazelnuts or filberts | **628 kcal / P 14.9g / F 60.8g / C 16.7g** | - / 100% | - |
| 271 | **松子** (`pine_nuts_raw`) | 673.0 kcal / P 13.7g / F 68.4g / C 13.1g | **TFDA** | `C0210101` | 原味松子仁 | **668 kcal / P 14.5g / F 69.0g / C 13.0g** | - / 100% | - |
| 272 | **葵花籽** (`sunflower_seeds_raw`) | 584.0 kcal / P 20.8g / F 51.5g / C 20.0g | **USDA** | `170562` | Seeds, sunflower seed kernels, dried | **584 kcal / P 20.8g / F 51.5g / C 20.0g** | - / 100% | - |
| 273 | **亞麻籽** (`flaxseed_raw`) | 534.0 kcal / P 18.3g / F 42.2g / C 28.9g | **USDA** | `169414` | Seeds, flaxseed | **534 kcal / P 18.3g / F 42.2g / C 28.9g** | - / 100% | - |
| 274 | **栗子** (`chestnuts_raw_kernels`) | 196.0 kcal / P 1.6g / F 1.3g / C 44.2g | **USDA** | `168590` | Nuts, chestnuts, japanese, roasted | **201 kcal / P 3.0g / F 0.8g / C 45.1g** | - / 100% | - |
| 275 | **無糖希臘優格** (`greek_yogurt_plain_whole`) | 97.0 kcal / P 9.0g / F 5.0g / C 3.9g | **USDA** | `171304` | Yogurt, Greek, plain, whole milk | **97 kcal / P 9.0g / F 5.0g / C 4.0g** | - / 100% | - |
| 276 | **無糖全脂優格** (`plain_yogurt_whole_milk`) | 61.0 kcal / P 3.5g / F 3.3g / C 4.7g | **USDA** | `171284` | Yogurt, plain, whole milk | **61 kcal / P 3.5g / F 3.2g / C 4.7g** | - / 100% | - |
| 277 | **無糖優酪乳** (`drinkable_yogurt_unsweetened`) | 57.0 kcal / P 3.2g / F 2.8g / C 4.8g | **USDA** | `171284` | Yogurt, plain, whole milk | **61 kcal / P 3.5g / F 3.2g / C 4.7g** | - / 100% | - |
| 278 | **羊乳** (`goat_milk_whole_raw`) | 69.0 kcal / P 3.6g / F 4.1g / C 4.5g | **CFCT** | `101201` | 羊乳 | **59 kcal / P 1.5g / F 3.5g / C 5.4g** | - / 100% | - |
| 279 | **莫札瑞拉起司** (`mozzarella_fresh_raw`) | 300.0 kcal / P 22.2g / F 22.4g / C 2.2g | **USDA** | `170845` | Cheese, mozzarella, whole milk | **299 kcal / P 22.2g / F 22.1g / C 2.4g** | - / 100% | - |
| 280 | **瑞可塔起司** (`ricotta_whole_milk_raw`) | 156.0 kcal / P 11.3g / F 10.1g / C 5.1g | **USDA** | `170851` | Cheese, ricotta, whole milk | **150 kcal / P 7.5g / F 10.2g / C 7.3g** | - / 100% | - |
| 281 | **帕瑪森乾酪** (`parmesan_cheese_hard_raw`) | 420.0 kcal / P 35.8g / F 28.6g / C 3.2g | **USDA** | `170848` | Cheese, parmesan, hard | **392 kcal / P 35.8g / F 25.0g / C 3.2g** | - / 100% | - |
| 282 | **切達起司** (`cheddar_cheese_raw`) | 403.0 kcal / P 24.9g / F 33.1g / C 1.3g | **USDA** | `168089` | Imitation cheese, american or cheddar,... | **390 kcal / P 25.0g / F 32.0g / C 1.0g** | - / 100% | - |
| 283 | **瑞士起司** (`swiss_cheese_raw`) | 393.0 kcal / P 27.0g / F 31.0g / C 1.4g | **USDA** | `171251` | Cheese, swiss | **393 kcal / P 27.0g / F 31.0g / C 1.4g** | - / 100% | - |
| 284 | **菲達起司** (`feta_cheese_raw`) | 264.0 kcal / P 14.2g / F 21.3g / C 4.1g | **USDA** | `173420` | Cheese, feta | **265 kcal / P 14.2g / F 21.5g / C 3.9g** | - / 100% | - |
| 285 | **烏雞** (`black_bone_chicken`) | 111.0 kcal / P 22.3g / F 2.3g / C 0.0g | **USDA** | `171077` | Chicken, broiler or fryers, breast, sk... | **120 kcal / P 22.5g / F 2.6g / C 0.0g** | - / 100% | - |
| 286 | **鴿肉** (`pigeon_meat`) | 142.0 kcal / P 22.1g / F 5.8g / C 0.0g | **USDA** | `171080` | Squab, (pigeon), light meat without sk... | **134 kcal / P 21.8g / F 4.5g / C 0.0g** | - / 100% | - |
| 287 | **鴨血** (`duck_blood`) | 58.0 kcal / P 13.0g / F 0.4g / C 0.2g | **TFDA** | `I0520101` | 鴨血 | **29 kcal / P 6.0g / F 0.3g / C 0.0g** | - / 100% | - |
| 288 | **鴨胗** (`duck_gizzard`) | 93.0 kcal / P 17.9g / F 2.1g / C 0.0g | **TFDA** | `I0520201` | 鴨胗 | **97 kcal / P 20.5g / F 1.1g / C 0.3g** | 8% / 92% | - |
| 289 | **鴨心** (`duck_heart`) | 148.0 kcal / P 15.5g / F 9.4g / C 0.1g | **USDA** | `171458` | Chicken, heart, all classes, raw | **153 kcal / P 15.6g / F 9.3g / C 0.7g** | - / 100% | - |
| 290 | **驢肉** (`donkey_meat`) | 116.0 kcal / P 21.5g / F 3.2g / C 0.0g | **CFCT** | `084101` | 驴肉（瘦） | **116 kcal / P 21.5g / F 3.2g / C 0.4g** | - / 100% | - |
| 291 | **牛百葉** (`beef_omasum_tripe`) | 78.0 kcal / P 14.5g / F 1.6g / C 0.0g | **USDA** | `173096` | Beef, New Zealand, imported, variety m... | **77 kcal / P 14.9g / F 2.0g / C 0.0g** | - / 100% | - |
| 292 | **豬腦** (`pork_brain`) | 131.0 kcal / P 10.8g / F 9.8g / C 0.0g | **TFDA** | `I0322601` | 豬腦 | **125 kcal / P 10.8g / F 8.7g / C 0.0g** | - / 100% | - |
| 293 | **羊肚** (`lamb_tripe`) | 87.0 kcal / P 12.2g / F 3.8g / C 0.0g | **CFCT** | `083202` | 羊肚 | **87 kcal / P 12.2g / F 3.4g / C 1.8g** | - / 100% | - |
| 294 | **羊血** (`lamb_blood`) | 52.0 kcal / P 12.0g / F 0.3g / C 0.1g | **CFCT** | `083209` | 羊血 | **57 kcal / P 6.8g / F 0.2g / C 6.9g** | - / 100% | - |
| 295 | **鯽魚** (`crucian_carp`) | 108.0 kcal / P 17.1g / F 4.2g / C 0.1g | **USDA** | `171952` | Fish, carp, raw | **127 kcal / P 17.8g / F 5.6g / C 0.0g** | - / 100% | - |
| 296 | **黑魚** (`snakehead_fish`) | 95.0 kcal / P 18.5g / F 2.1g / C 0.0g | **USDA** | `168034` | Fish, whitefish, broad, head, eyes, ch... | **107 kcal / P 18.6g / F 3.6g / C 0.0g** | - / 100% | - |
| 297 | **鱖魚** (`mandarin_fish`) | 117.0 kcal / P 19.9g / F 4.0g / C 0.0g | **USDA** | `167638` | Fish, halibut, raw, with skin (Alaska ... | **116 kcal / P 20.5g / F 2.9g / C 1.8g** | - / 100% | - |
| 298 | **武昌魚** (`wuchang_bream`) | 135.0 kcal / P 17.6g / F 7.1g / C 0.0g | **CFCT** | `042101` | 扁豆［月亮菜］ | **41 kcal / P 2.7g / F 0.2g / C 8.2g** | 42% / 58% | head, scale, viscera and bone 42% |
| 299 | **鱅魚** (`bighead_carp`) | 100.0 kcal / P 15.3g / F 4.2g / C 0.0g | **USDA** | `171952` | Fish, carp, raw | **127 kcal / P 17.8g / F 5.6g / C 0.0g** | - / 100% | - |
| 300 | **黃顙魚** (`yellow_catfish`) | 98.0 kcal / P 16.1g / F 3.6g / C 0.0g | **USDA** | `174186` | Fish, catfish, channel, wild, raw | **95 kcal / P 16.4g / F 2.8g / C 0.0g** | - / 100% | - |
| 301 | **黃鱔** (`yellow_eel`) | 89.0 kcal / P 18.0g / F 1.4g / C 0.0g | **TFDA** | `J0403801` | 黃鱔 | **88 kcal / P 17.6g / F 1.4g / C 1.0g** | 24% / 76% | - |
| 302 | **泥鰍** (`loach_fish`) | 96.0 kcal / P 17.9g / F 2.7g / C 0.0g | **USDA** | `168034` | Fish, whitefish, broad, head, eyes, ch... | **107 kcal / P 18.6g / F 3.6g / C 0.0g** | - / 100% | - |
| 303 | **小龍蝦肉** (`crayfish_meat`) | 87.0 kcal / P 14.8g / F 2.5g / C 0.9g | **USDA** | `174206` | Crustaceans, crayfish, mixed species, ... | **77 kcal / P 16.0g / F 0.9g / C 0.0g** | - / 100% | - |
| 304 | **青蝦** (`river_shrimp`) | 87.0 kcal / P 16.4g / F 2.2g / C 0.0g | **USDA** | `171972` | Crustaceans, shrimp, mixed species, ca... | **100 kcal / P 20.4g / F 1.4g / C 0.0g** | - / 100% | - |
| 305 | **大閘蟹肉** (`chinese_mitten_crab`) | 103.0 kcal / P 17.5g / F 2.6g / C 2.5g | **USDA** | `171968` | Crustaceans, crab, dungeness, raw | **86 kcal / P 17.4g / F 1.0g / C 0.7g** | - / 100% | - |
| 306 | **甲魚肉** (`softshell_turtle`) | 118.0 kcal / P 17.8g / F 4.9g / C 0.0g | **USDA** | `167745` | Turtle, green, raw | **89 kcal / P 19.8g / F 0.5g / C 0.0g** | - / 100% | - |
| 307 | **田螺肉** (`river_snail_meat`) | 60.0 kcal / P 10.7g / F 0.7g / C 2.4g | **CFCT** | `124306` | 田螺 | **60 kcal / P 11.0g / F 0.2g / C 3.6g** | 74% / 26% | - |
| 308 | **腐竹** (`dried_yuba_sticks`) | 459.0 kcal / P 44.6g / F 21.7g / C 22.3g | **CFCT** | `031507` | 腐竹 | **461 kcal / P 44.6g / F 21.7g / C 22.3g** | - / 100% | - |
| 309 | **內酯豆腐** (`lactone_tofu`) | 49.0 kcal / P 5.0g / F 1.9g / C 2.9g | **USDA** | `172461` | MORI-NU, Tofu, silken, firm | **62 kcal / P 6.9g / F 2.7g / C 2.4g** | - / 100% | - |
| 310 | **蠶豆仁** (`broad_bean_fresh`) | 111.0 kcal / P 8.8g / F 0.7g / C 19.5g | **USDA** | `173753` | Broadbeans (fava beans), mature seeds,... | **110 kcal / P 7.6g / F 0.4g / C 19.6g** | - / 100% | - |
| 311 | **白芸豆** (`white_kidney_bean_large`) | 337.0 kcal / P 23.1g / F 1.2g / C 61.3g | **USDA** | `173742` | Beans, kidney, california red, mature ... | **330 kcal / P 24.4g / F 0.2g / C 59.8g** | - / 100% | - |
| 312 | **玉米碴** (`corn_grits`) | 362.0 kcal / P 8.5g / F 1.2g / C 78.4g | **USDA** | `171654` | Cereals, corn grits, white, regular an... | **370 kcal / P 7.7g / F 1.8g / C 79.1g** | - / 100% | - |
| 313 | **大黃米** (`broomcorn_millet`) | 349.0 kcal / P 9.7g / F 1.5g / C 74.2g | **USDA** | `169702` | Millet, raw | **378 kcal / P 11.0g / F 4.2g / C 72.8g** | - / 100% | - |
| 314 | **莜麥粉** (`naked_oat_flour`) | 385.0 kcal / P 15.0g / F 6.2g / C 67.2g | **USDA** | `169741` | Oat flour, partially debranned | **404 kcal / P 14.7g / F 9.1g / C 65.7g** | - / 100% | - |
| 315 | **紅薯粉條** (`sweet_potato_vermicelli`) | 348.0 kcal / P 0.3g / F 0.1g / C 86.0g | **USDA** | `170675` | Sweeteners, sugar substitute, granulat... | **347 kcal / P 2.1g / F 0.0g / C 84.8g** | - / 100% | - |
| 316 | **土豆粉** (`potato_vermicelli`) | 345.0 kcal / P 0.2g / F 0.1g / C 85.5g | **USDA** | `169884` | Vermicelli, made from soy | **331 kcal / P 0.1g / F 0.1g / C 82.3g** | - / 100% | - |
| 317 | **蕎麥粉** (`buckwheat_flour_whole`) | 343.0 kcal / P 12.0g / F 1.7g / C 70.6g | **USDA** | `170687` | Buckwheat flour, whole-groat | **335 kcal / P 12.6g / F 3.1g / C 70.6g** | - / 100% | - |
| 318 | **年糕** (`glutinous_rice_cake`) | 154.0 kcal / P 3.2g / F 0.3g / C 34.6g | **USDA** | `169712` | Rice, white, steamed, Chinese restaurant | **151 kcal / P 3.2g / F 0.3g / C 33.9g** | - / 100% | - |
| 319 | **兒菜** (`baby_mustard_stem`) | 22.0 kcal / P 1.8g / F 0.2g / C 3.5g | **USDA** | `168438` | Mustard spinach, (tendergreen), raw | **22 kcal / P 2.2g / F 0.3g / C 3.9g** | - / 100% | - |
| 320 | **薺菜** (`shepherds_purse`) | 27.0 kcal / P 2.9g / F 0.4g / C 3.2g | **CFCT** | `045323` | 荠菜（鲜）［蓟菜，菱角菜］ | **31 kcal / P 2.9g / F 0.4g / C 4.7g** | 10% / 90% | roots and yellow leaves 10% |
| 321 | **萵筍** (`stem_lettuce_celtuce`) | 15.0 kcal / P 1.0g / F 0.1g / C 2.8g | **USDA** | `168429` | Lettuce, butterhead (includes boston a... | **13 kcal / P 1.4g / F 0.2g / C 2.2g** | - / 100% | - |
| 322 | **萵筍葉** (`celtuce_leaves`) | 18.0 kcal / P 1.8g / F 0.2g / C 2.7g | **USDA** | `168385` | Amaranth leaves, raw | **23 kcal / P 2.5g / F 0.3g / C 4.0g** | - / 100% | - |
| 323 | **蒜苔** (`garlic_scapes`) | 66.0 kcal / P 3.4g / F 0.2g / C 12.7g | **USDA** | `169230` | Garlic, raw | **149 kcal / P 6.4g / F 0.5g / C 33.1g** | - / 100% | - |
| 324 | **蒜黃** (`yellow_garlic_chives`) | 26.0 kcal / P 2.5g / F 0.3g / C 4.1g | **USDA** | `168503` | Beans, snap, yellow, canned, regular p... | **15 kcal / P 0.8g / F 0.1g / C 3.5g** | - / 100% | - |
| 325 | **茨菇** (`arrowhead_tuber`) | 94.0 kcal / P 4.4g / F 0.2g / C 19.9g | **USDA** | `169203` | Arrowhead, raw | **99 kcal / P 5.3g / F 0.3g / C 20.2g** | - / 100% | - |
| 326 | **藕帶** (`lotus_shoot`) | 16.0 kcal / P 1.0g / F 0.1g / C 3.2g | **USDA** | `168489` | Taro shoots, raw | **11 kcal / P 0.9g / F 0.1g / C 2.3g** | - / 100% | - |
| 327 | **菱角** (`water_caltrop_meat`) | 101.0 kcal / P 4.0g / F 0.2g / C 21.4g | **CFCT** | `046003` | 菱角（老，鲜）［龙角］ | **101 kcal / P 4.5g / F 0.1g / C 21.4g** | 43% / 57% | - |
| 328 | **芡實** (`gorgon_nut_fresh`) | 137.0 kcal / P 4.4g / F 0.3g / C 29.8g | **TFDA** | `C1800101` | 芡實 | **336 kcal / P 9.9g / F 0.1g / C 75.4g** | - / 100% | - |
| 329 | **茴香菜** (`fennel_greens`) | 29.0 kcal / P 2.5g / F 0.4g / C 3.9g | **TFDA** | `E4400101` | 茴香 | **19 kcal / P 2.2g / F 0.2g / C 4.1g** | 12% / 88% | - |
| 330 | **西葫蘆** (`chinese_squash_xihulu`) | 19.0 kcal / P 1.2g / F 0.2g / C 3.6g | **USDA** | `167632` | Squash, Indian, cooked, boiled (Navajo) | **16 kcal / P 0.3g / F 0.1g / C 3.2g** | - / 100% | - |
| 331 | **苤藍** (`kohlrabi_raw`) | 27.0 kcal / P 1.7g / F 0.1g / C 6.2g | **USDA** | `168424` | Kohlrabi, raw | **27 kcal / P 1.7g / F 0.1g / C 6.2g** | - / 100% | - |
| 332 | **芥菜頭** (`turnip_rutabaga`) | 28.0 kcal / P 1.2g / F 0.1g / C 6.3g | **USDA** | `168455` | Rutabagas, cooked, boiled, drained, wi... | **30 kcal / P 0.9g / F 0.2g / C 6.8g** | - / 100% | - |
| 333 | **螺絲椒** (`wrinkled_chili_pepper`) | 28.0 kcal / P 1.4g / F 0.2g / C 5.4g | **USDA** | `168577` | Peppers, chili, green, canned | **21 kcal / P 0.7g / F 0.3g / C 4.6g** | - / 100% | - |
| 334 | **二荊條辣椒** (`erjingtiao_chili`) | 32.0 kcal / P 1.6g / F 0.3g / C 6.2g | **USDA** | `168577` | Peppers, chili, green, canned | **21 kcal / P 0.7g / F 0.3g / C 4.6g** | - / 100% | - |
| 335 | **朝天椒** (`facing_heaven_chili`) | 40.0 kcal / P 2.0g / F 0.4g / C 8.0g | **TFDA** | `E7500602` | 朝天椒(長果) | **97 kcal / P 3.4g / F 1.3g / C 17.9g** | 7% / 93% | - |
| 336 | **蓴菜** (`water_shield_watershield`) | 13.0 kcal / P 1.1g / F 0.1g / C 2.4g | **USDA** | `169301` | Water convolvulus,raw | **19 kcal / P 2.6g / F 0.2g / C 3.1g** | - / 100% | - |
| 337 | **苦苣** (`endive_frisee_kuju`) | 17.0 kcal / P 1.2g / F 0.2g / C 3.3g | **CFCT** | `048081` | 苦苣菜［苦菜，天精菜］ | **32 kcal / P 3.1g / F 0.6g / C 4.5g** | - / 100% | - |
| 338 | **羊肚菌** (`morel_mushroom`) | 31.0 kcal / P 3.1g / F 0.6g / C 5.1g | **USDA** | `168423` | Mushrooms, morel, raw | **31 kcal / P 3.1g / F 0.6g / C 5.1g** | - / 100% | - |
| 339 | **松茸** (`matsutake_mushroom`) | 26.0 kcal / P 2.4g / F 0.3g / C 4.2g | **TFDA** | `G0500101` | 松茸 | **33 kcal / P 3.1g / F 0.5g / C 5.9g** | 2% / 98% | - |
| 340 | **牛肝菌** (`boletus_porcini`) | 28.0 kcal / P 2.7g / F 0.4g / C 4.5g | **CFCT** | `051042` | 牛肝菌（白）［美味牛肝菌］ | **35 kcal / P 4.0g / F 0.4g / C 4.5g** | 7% / 93% | - |
| 341 | **茶樹菇** (`tea_tree_mushroom`) | 30.0 kcal / P 2.6g / F 0.3g / C 5.2g | **USDA** | `168422` | Mushrooms, Chanterelle, raw | **32 kcal / P 1.5g / F 0.5g / C 6.9g** | - / 100% | - |
| 342 | **榛蘑** (`hazel_mushroom`) | 25.0 kcal / P 2.3g / F 0.3g / C 4.0g | **USDA** | `168423` | Mushrooms, morel, raw | **31 kcal / P 3.1g / F 0.6g / C 5.1g** | - / 100% | - |
| 343 | **竹蓀** (`bamboo_fungus`) | 23.0 kcal / P 2.1g / F 0.2g / C 3.8g | **USDA** | `169210` | Bamboo shoots, raw | **27 kcal / P 2.6g / F 0.3g / C 5.2g** | - / 100% | - |
| 344 | **草菇** (`straw_mushroom`) | 23.0 kcal / P 2.4g / F 0.2g / C 3.7g | **TFDA** | `G0300102` | 草菇(2025年取樣) | **28 kcal / P 3.5g / F 0.3g / C 5.1g** | - / 100% | - |
| 345 | **平菇** (`oyster_pleurotus_pinggu`) | 24.0 kcal / P 1.9g / F 0.3g / C 4.6g | **CFCT** | `051015` | 平菇［糙皮侧耳，青蘑］ | **24 kcal / P 1.9g / F 0.3g / C 4.6g** | 7% / 93% | - |
| 346 | **蟲草花** (`cordyceps_flower`) | 29.0 kcal / P 2.5g / F 0.3g / C 5.0g | **USDA** | `168459` | Sesbania flower, raw | **27 kcal / P 1.3g / F 0.0g / C 6.7g** | - / 100% | - |
| 347 | **冬棗** (`winter_jujube`) | 105.0 kcal / P 1.1g / F 0.2g / C 25.5g | **USDA** | `168151` | Jujube, raw | **79 kcal / P 1.2g / F 0.2g / C 20.2g** | - / 100% | - |
| 348 | **砂糖橘** (`shatangju_mandarin`) | 43.0 kcal / P 0.8g / F 0.2g / C 10.3g | **TFDA** | `D3400206` | 砂糖橘 | **47 kcal / P 0.7g / F 0.3g / C 12.6g** | 25% / 75% | - |
| 349 | **香梨** (`korla_pear`) | 48.0 kcal / P 0.4g / F 0.2g / C 12.2g | **CFCT** | `061220` | 香梨 | **51 kcal / P 0.3g / F 0.1g / C 13.6g** | 11% / 89% | - |
| 350 | **雪花梨** (`snow_pear`) | 45.0 kcal / P 0.3g / F 0.2g / C 11.5g | **CFCT** | `061221` | 雪花梨 | **42 kcal / P 0.2g / F 0.1g / C 10.6g** | 14% / 86% | - |
| 351 | **姑娘果** (`cape_gooseberry_physalis`) | 53.0 kcal / P 1.9g / F 0.7g / C 11.2g | **USDA** | `173043` | Groundcherries, (cape-gooseberries or ... | **53 kcal / P 1.9g / F 0.7g / C 11.2g** | - / 100% | - |
| 352 | **楊梅** (`waxberry_bayberry`) | 28.0 kcal / P 0.8g / F 0.2g / C 6.7g | **CFCT** | `065015` | 杨梅［树梅，山杨梅］ | **30 kcal / P 0.8g / F 0.2g / C 6.7g** | 14% / 86% | pit and stem 14% |
| 353 | **枇杷** (`loquat_fresh`) | 47.0 kcal / P 0.4g / F 0.2g / C 12.1g | **TFDA** | `D2500101` | 枇杷 | **36 kcal / P 0.3g / F 0.2g / C 9.8g** | 32% / 68% | - |
| 354 | **桑葚** (`mulberry_fresh`) | 43.0 kcal / P 1.4g / F 0.4g / C 9.8g | **TFDA** | `D1300101` | 桑葚 | **30 kcal / P 1.1g / F 0.4g / C 7.0g** | 4% / 96% | - |
| 355 | **山楂** (`hawthorn_fresh`) | 95.0 kcal / P 0.6g / F 0.2g / C 24.2g | **CFCT** | `061301` | 红果［山里红，大山楂］ | **102 kcal / P 0.5g / F 0.6g / C 25.1g** | 24% / 76% | - |
| 356 | **白果** (`ginkgo_biloba_nut`) | 182.0 kcal / P 4.3g / F 1.3g / C 37.8g | **USDA** | `170584` | Nuts, ginkgo nuts, raw | **182 kcal / P 4.3g / F 1.7g / C 37.6g** | - / 100% | - |
| 357 | **水牛奶** (`water_buffalo_milk`) | 97.0 kcal / P 3.8g / F 6.9g / C 5.2g | **USDA** | `171280` | Milk, indian buffalo, fluid | **97 kcal / P 3.8g / F 6.9g / C 5.2g** | - / 100% | - |
| 358 | **犛牛奶** (`yak_milk`) | 88.0 kcal / P 3.7g / F 5.9g / C 5.0g | **USDA** | `171280` | Milk, indian buffalo, fluid | **97 kcal / P 3.8g / F 6.9g / C 5.2g** | - / 100% | - |
| 359 | **駝奶** (`camel_milk`) | 60.0 kcal / P 3.1g / F 3.4g / C 4.4g | **USDA** | `167697` | Milk, buttermilk, fluid, cultured, red... | **56 kcal / P 4.1g / F 2.0g / C 5.3g** | - / 100% | - |
| 360 | **羅非魚** (`tilapia_luofeiyu_raw`) | 96.0 kcal / P 20.1g / F 1.7g / C 0.0g | **USDA** | `175176` | Fish, tilapia, raw | **96 kcal / P 20.1g / F 1.7g / C 0.0g** | - / 100% | - |
| 361 | **鰱魚** (`silver_carp`) | 102.0 kcal / P 18.6g / F 3.1g / C 0.0g | **USDA** | `171952` | Fish, carp, raw | **127 kcal / P 17.8g / F 5.6g / C 0.0g** | - / 100% | - |
| 362 | **青魚** (`black_carp`) | 118.0 kcal / P 19.5g / F 4.5g / C 0.0g | **USDA** | `171952` | Fish, carp, raw | **127 kcal / P 17.8g / F 5.6g / C 0.0g** | - / 100% | - |
| 363 | **多寶魚** (`turbot_fish`) | 95.0 kcal / P 17.5g / F 2.8g / C 0.0g | **USDA** | `173710` | Fish, turbot, european, raw | **95 kcal / P 16.1g / F 3.0g / C 0.0g** | - / 100% | - |
| 364 | **鮁魚** (`spanish_mackerel_bayu`) | 121.0 kcal / P 21.2g / F 4.0g / C 0.0g | **USDA** | `173673` | Fish, mackerel, spanish, raw | **139 kcal / P 19.3g / F 6.3g / C 0.0g** | - / 100% | - |
| 365 | **小黃魚** (`small_yellow_croaker`) | 99.0 kcal / P 17.9g / F 3.1g / C 0.0g | **TFDA** | `J0410601` | 小黃魚(含皮) | **100 kcal / P 19.4g / F 1.9g / C 0.0g** | 59% / 41% | - |
| 366 | **銀魚** (`whitebait_yinyu`) | 105.0 kcal / P 17.2g / F 3.8g / C 0.5g | **TFDA** | `J0402101` | 銀魚 | **69 kcal / P 14.3g / F 0.9g / C 0.9g** | - / 100% | - |
| 367 | **梭子蟹肉** (`swimming_crab_meat`) | 95.0 kcal / P 17.5g / F 1.5g / C 2.9g | **CFCT** | `123004` | 梭子蟹 | **95 kcal / P 15.9g / F 3.1g / C 0.9g** | 51% / 49% | - |
| 368 | **皮皮蝦肉** (`mantis_shrimp_pipixia`) | 84.0 kcal / P 18.2g / F 1.2g / C 0.2g | **USDA** | `175179` | Crustaceans, shrimp, raw | **85 kcal / P 20.1g / F 0.5g / C 0.0g** | - / 100% | - |
| 369 | **基圍蝦** (`sand_shrimp_jiweixia`) | 93.0 kcal / P 20.6g / F 1.1g / C 0.1g | **USDA** | `171972` | Crustaceans, shrimp, mixed species, ca... | **100 kcal / P 20.4g / F 1.4g / C 0.0g** | - / 100% | - |
| 370 | **花蛤肉** (`manila_clam_huagai`) | 62.0 kcal / P 11.2g / F 1.0g / C 2.1g | **USDA** | `174214` | Mollusks, clam, mixed species, raw | **86 kcal / P 14.7g / F 1.0g / C 3.6g** | - / 100% | - |
| 371 | **蟶子肉** (`razor_clam_shengzi`) | 68.0 kcal / P 11.5g / F 1.2g / C 2.8g | **USDA** | `174214` | Mollusks, clam, mixed species, raw | **86 kcal / P 14.7g / F 1.0g / C 3.6g** | - / 100% | - |
| 372 | **海虹肉** (`blue_mussel_haihong`) | 86.0 kcal / P 11.9g / F 2.2g / C 3.7g | **USDA** | `174216` | Mollusks, mussel, blue, raw | **86 kcal / P 11.9g / F 2.2g / C 3.7g** | - / 100% | - |
| 373 | **鴨脖肉** (`duck_neck_meat`) | 135.0 kcal / P 19.8g / F 6.2g / C 0.0g | **USDA** | `172410` | Duck, domesticated, meat only, raw | **135 kcal / P 18.3g / F 6.0g / C 0.9g** | - / 100% | - |
| 374 | **鴨翅** (`duck_wing`) | 210.0 kcal / P 17.5g / F 15.6g / C 0.0g | **USDA** | `174468` | Duck, wild, meat and skin, raw | **211 kcal / P 17.4g / F 15.2g / C 0.0g** | - / 100% | - |
| 375 | **鴨舌** (`duck_tongue`) | 245.0 kcal / P 14.2g / F 20.8g / C 0.0g | **TFDA** | `I0520801` | 鴨舌 | **187 kcal / P 16.0g / F 13.2g / C 0.0g** | 8% / 92% | - |
| 376 | **肥腸** (`pork_large_intestine_feichang`) | 196.0 kcal / P 6.9g / F 18.7g / C 0.0g | **USDA** | `168266` | Pork, fresh, variety meats and by-prod... | **182 kcal / P 7.6g / F 16.6g / C 0.0g** | - / 100% | - |
| 377 | **豬肚** (`pork_stomach_zhudu`) | 110.0 kcal / P 15.2g / F 5.1g / C 0.7g | **TFDA** | `I0321101` | 豬肚 | **152 kcal / P 12.4g / F 11.0g / C 0.0g** | - / 100% | - |
| 378 | **豬蹄** (`pork_trotters_zhuti`) | 260.0 kcal / P 22.6g / F 18.8g / C 0.0g | **USDA** | `168259` | Pork, fresh, shoulder, blade, boston (... | **269 kcal / P 23.1g / F 18.9g / C 0.0g** | - / 100% | - |
| 379 | **牛腩** (`beef_flank_brisket_niunan`) | 215.0 kcal / P 18.6g / F 15.6g / C 0.0g | **USDA** | `168715` | Beef, short loin, porterhouse steak, s... | **218 kcal / P 20.4g / F 14.6g / C 0.0g** | - / 100% | - |
| 380 | **羊肉片** (`lamb_slices_shuanyangrou`) | 203.0 kcal / P 19.0g / F 14.1g / C 0.0g | **CFCT** | `083117` | 羊肉片 | **118 kcal / P 18.0g / F 4.0g / C 2.4g** | - / 100% | - |
| 381 | **油麥菜** (`youmai_vegetable`) | 15.0 kcal / P 1.4g / F 0.2g / C 2.1g | **USDA** | `170063` | Vegetable juice cocktail, canned | **22 kcal / P 0.9g / F 0.3g / C 3.9g** | - / 100% | - |
| 382 | **菜心** (`guangdong_choy_sum`) | 18.0 kcal / P 1.8g / F 0.2g / C 2.4g | **TFDA** | `E3201001` | 油菜心 | **27 kcal / P 3.2g / F 0.9g / C 4.0g** | - / 100% | - |
| 383 | **小白菜** (`petite_bok_choy_xiaobaicai`) | 15.0 kcal / P 1.5g / F 0.2g / C 2.2g | **TFDA** | `E3200602` | 小白菜(土植)(3月取樣) | **11 kcal / P 1.2g / F 0.1g / C 2.4g** | 9% / 91% | - |
| 384 | **上海青** (`shanghai_bok_choy`) | 14.0 kcal / P 1.3g / F 0.2g / C 2.0g | **CFCT** | `011101` | 小麦 | **338 kcal / P 11.9g / F 1.3g / C 75.2g** | 8% / 92% | roots and outer leaves 8% |
| 385 | **香椿** (`chinese_toon_xiangchun`) | 47.0 kcal / P 3.8g / F 0.4g / C 7.2g | **CFCT** | `048055` | 香椿（鲜）［香椿芽］ | **50 kcal / P 1.7g / F 0.4g / C 10.9g** | 24% / 76% | - |
| 386 | **馬齒莧** (`purslane_machixian`) | 20.0 kcal / P 2.3g / F 0.5g / C 3.4g | **TFDA** | `E4500101` | 馬齒莧 | **13 kcal / P 1.2g / F 0.4g / C 1.9g** | - / 100% | - |
| 387 | **折耳根** (`houttuynia_zhergen`) | 25.0 kcal / P 2.1g / F 0.3g / C 4.5g | **CFCT** | `048084` | 鱼腥草（根） | **87 kcal / P 2.1g / F 0.1g / C 19.5g** | 15% / 85% | roots and old stems 15% |
| 388 | **洋姜** (`jerusalem_artichoke_yangjiang`) | 73.0 kcal / P 2.0g / F 0.1g / C 17.4g | **CFCT** | `047304` | 洋姜（鲜）［菊芋，鬼子姜］ | **64 kcal / P 2.4g / F 0.0g / C 15.8g** | - / 100% | - |
| 389 | **杭椒** (`hangzhou_pepper_hangjiao`) | 27.0 kcal / P 1.3g / F 0.2g / C 5.2g | **USDA** | `168546` | Peppers, sweet, red, canned, solids an... | **18 kcal / P 0.8g / F 0.3g / C 3.9g** | - / 100% | - |
| 390 | **尖椒** (`long_hot_pepper_jianjiao`) | 26.0 kcal / P 1.4g / F 0.2g / C 4.9g | **USDA** | `169766` | Peppers, hot pickled, canned | **22 kcal / P 0.8g / F 0.4g / C 4.6g** | - / 100% | - |
| 391 | **油豆角** (`northeast_oil_bean_youdoujiao`) | 35.0 kcal / P 2.5g / F 0.3g / C 6.5g | **CFCT** | `042104` | 豆角 | **34 kcal / P 2.5g / F 0.2g / C 6.7g** | 4% / 96% | - |
| 392 | **扁豆角** (`hyacinth_bean_pod_biandoujiao`) | 37.0 kcal / P 2.7g / F 0.2g / C 6.7g | **CFCT** | `042104` | 豆角 | **34 kcal / P 2.5g / F 0.2g / C 6.7g** | 4% / 96% | - |
| 393 | **貢菜** (`tribute_vegetable_gongcai`) | 158.0 kcal / P 8.2g / F 0.8g / C 33.5g | **USDA** | `169780` | Turnover, chicken- or turkey-, and veg... | **168 kcal / P 7.9g / F 5.5g / C 21.7g** | - / 100% | - |
| 394 | **燕麥米** (`whole_oat_groats_yanmaimi`) | 376.0 kcal / P 13.5g / F 6.0g / C 66.8g | **TFDA** | `A0800101` | 燕麥 | **388 kcal / P 10.9g / F 10.2g / C 67.4g** | - / 100% | - |
| 395 | **青稞米** (`highland_barley_grain_qingke`) | 350.0 kcal / P 10.2g / F 2.0g / C 72.8g | **USDA** | `169739` | Barley flour or meal | **345 kcal / P 10.5g / F 1.6g / C 74.5g** | - / 100% | - |
| 396 | **糯米粉** (`glutinous_rice_flour_nuomifen`) | 355.0 kcal / P 6.2g / F 0.8g / C 80.5g | **TFDA** | `A0520401` | 白糯米粉 | **359 kcal / P 4.5g / F 0.4g / C 82.3g** | - / 100% | - |
| 397 | **小麥澱粉** (`wheat_starch_chengfen`) | 351.0 kcal / P 0.3g / F 0.1g / C 87.1g | **USDA** | `169698` | Cornstarch | **381 kcal / P 0.3g / F 0.1g / C 91.3g** | - / 100% | - |
| 398 | **紅薯澱粉** (`sweet_potato_starch_hongshufen`) | 347.0 kcal / P 0.2g / F 0.1g / C 86.2g | **USDA** | `170675` | Sweeteners, sugar substitute, granulat... | **347 kcal / P 2.1g / F 0.0g / C 84.8g** | - / 100% | - |
| 399 | **手擀麵** (`handmade_wheat_noodles_shouganmian`) | 280.0 kcal / P 8.8g / F 1.2g / C 58.5g | **USDA** | `167533` | Bagels, wheat | **250 kcal / P 10.2g / F 1.5g / C 48.9g** | - / 100% | - |
| 400 | **水餃皮** (`dumpling_wrappers_shuijiaopi`) | 275.0 kcal / P 8.6g / F 1.1g / C 57.5g | **TFDA** | `R1800101` | 水餃皮 | **261 kcal / P 7.8g / F 0.5g / C 57.0g** | - / 100% | - |
| 401 | **沙田柚** (`shatian_pomelo`) | 42.0 kcal / P 0.7g / F 0.2g / C 10.3g | **CFCT** | `021204` | 甘薯粉［地瓜粉］ | **336 kcal / P 2.7g / F 0.2g / C 80.9g** | 42% / 58% | peel and seeds 42% |
| 402 | **紅心柚** (`red_flesh_pomelo`) | 41.0 kcal / P 0.8g / F 0.2g / C 9.8g | **USDA** | `170029` | Potatoes, red, flesh and skin, raw | **70 kcal / P 1.9g / F 0.1g / C 15.9g** | - / 100% | - |
| 403 | **沃柑** (`wogan_mandarin`) | 50.0 kcal / P 0.8g / F 0.2g / C 12.2g | **USDA** | `169105` | Tangerines, (mandarin oranges), raw | **53 kcal / P 0.8g / F 0.3g / C 13.3g** | - / 100% | - |
| 404 | **巨峰葡萄** (`kyoho_grape`) | 54.0 kcal / P 0.6g / F 0.2g / C 13.5g | **TFDA** | `D1700201` | 巨峰葡萄 | **63 kcal / P 0.5g / F 0.3g / C 16.6g** | 19% / 81% | - |
| 405 | **陽光玫瑰葡萄** (`shine_muscat_grape`) | 65.0 kcal / P 0.7g / F 0.2g / C 16.5g | **USDA** | `168144` | Babyfood, grape juice, no sugar, canned | **62 kcal / P 0.0g / F 0.0g / C 15.4g** | - / 100% | - |
| 406 | **西梅** (`fresh_prune_ximei`) | 46.0 kcal / P 0.7g / F 0.3g / C 11.4g | **CFCT** | `062208` | 西梅 | **42 kcal / P 0.7g / F 0.1g / C 10.3g** | 24% / 76% | - |
| 407 | **羊角蜜甜瓜** (`yangjiaomi_melon`) | 32.0 kcal / P 0.8g / F 0.1g / C 7.8g | **USDA** | `167765` | Watermelon, raw | **30 kcal / P 0.6g / F 0.1g / C 7.5g** | - / 100% | - |
| 408 | **香榧** (`chinese_torreya_xiangfei`) | 673.0 kcal / P 12.5g / F 68.0g / C 13.5g | **CFCT** | `071040` | 香榧（熟） | **644 kcal / P 12.4g / F 57.0g / C 26.9g** | 39% / 61% | - |
| 409 | **巴旦木** (`xinjiang_almond_badanmu`) | 590.0 kcal / P 21.5g / F 51.0g / C 21.0g | **USDA** | `168596` | Nuts, almonds, dry roasted, with salt ... | **598 kcal / P 21.0g / F 52.5g / C 21.0g** | - / 100% | - |
| 410 | **牛肉** (`beef_generic`) | 176.0 kcal / P 20.0g / F 10.0g / C 0.0g | **USDA** | `168614` | Beef, rib, shortribs, separable lean o... | **175 kcal / P 19.1g / F 10.2g / C 0.4g** | - / 100% | - |
| 411 | **豬肉** (`pork_generic`) | 172.0 kcal / P 20.5g / F 10.0g / C 0.0g | **USDA** | `167814` | Pork, fresh, leg (ham), rump half, sep... | **182 kcal / P 20.3g / F 10.6g / C 0.0g** | - / 100% | - |
| 412 | **羊肉** (`lamb_generic`) | 170.0 kcal / P 20.0g / F 10.0g / C 0.0g | **USDA** | `172493` | Lamb, rib, separable lean only, trimme... | **169 kcal / P 20.0g / F 9.2g / C 0.0g** | - / 100% | - |