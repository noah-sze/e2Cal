import os
import io
import csv
import json
import zipfile
import uuid

# e2Cal 系統命名空間 UUID (確定性雜湊 UUIDv5)
NAMESPACE_E2CAL = uuid.UUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')

def make_uuid(authority: str, source_id: str) -> str:
    key = f"{authority}:{source_id}"
    return str(uuid.uuid5(NAMESPACE_E2CAL, key))

def safe_float(val, default=0.0):
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).strip().replace(',', '')
    if not val_str or val_str.lower() in ('na', 'none', '-', 'trace', 'tr', 'nd'):
        return default
    try:
        return float(val_str)
    except:
        return default

def round2(val):
    return round(float(val), 2)

print("=== 正在構建 e2Cal 權威食材庫 (USDA + TFDA + CFCT) ===")

all_foods = []
seen_ids = set()

# -----------------------------------------------------------------------------
# 1. 解析台灣 TFDA (食品營養成分資料庫)
# -----------------------------------------------------------------------------
tfda_zip_path = 'scripts/pipeline/tfda_foods_csv.zip'
if os.path.exists(tfda_zip_path):
    print("正在解析台灣 TFDA 資料集...")
    tfda_map = {}
    with zipfile.ZipFile(tfda_zip_path) as z:
        csv_name = [n for n in z.namelist() if n.endswith('.csv')][0]
        with z.open(csv_name) as f:
            reader = csv.reader(io.TextIOWrapper(f, encoding='utf-8-sig'))
            header = next(reader)
            # 欄位下標推導
            # 食品分類, 資料類別, 整合編號, 樣品名稱, 俗名, 樣品英文名稱, 內容物描述, 廢棄率, 分析項, 每100克含量
            col_id = 2      # 整合編號
            col_name = 3    # 樣品名稱
            col_refuse = 7  # 廢棄率
            col_analy = 9   # 分析項 (分析項分類在 8)
            col_amount = 11 # 每100克含量 (或 10 是含量單位)

            for row in reader:
                if len(row) < 12:
                    continue
                code = row[col_id].strip()
                name = row[col_name].strip()
                if not code or not name:
                    continue

                if code not in tfda_map:
                    refuse_pct = safe_float(row[col_refuse], 0.0)
                    refuse_rate = round(refuse_pct / 100.0, 4) if refuse_pct > 0 else 0.0
                    edible_rate = round(1.0 - refuse_rate, 4)
                    tfda_map[code] = {
                        'code': code,
                        'name': name,
                        'refuseRate': refuse_rate,
                        'edibleRate': edible_rate,
                        'nutrients': {}
                    }

                analy_name = row[col_analy].strip()
                amount_val = safe_float(row[col_amount], 0.0)
                tfda_map[code]['nutrients'][analy_name] = amount_val

    for code, item in tfda_map.items():
        nuts = item['nutrients']
        calories = nuts.get('修正熱量') or nuts.get('熱量') or 0.0
        protein = nuts.get('粗蛋白') or 0.0
        fat = nuts.get('粗脂肪') or 0.0
        carbs = nuts.get('總碳水化合物') or 0.0
        fiber = nuts.get('膳食纖維') or 0.0
        sugar = nuts.get('糖質總量') or 0.0
        sat_fat = nuts.get('飽和脂肪酸') or 0.0
        trans_fat = nuts.get('反式脂肪酸') or 0.0
        sodium = nuts.get('鈉') or 0.0

        micros = {}
        if '鉀' in nuts: micros['potassium'] = round2(nuts['鉀'])
        if '鈣' in nuts: micros['calcium'] = round2(nuts['鈣'])
        if '鎂' in nuts: micros['magnesium'] = round2(nuts['鎂'])
        if '鐵' in nuts: micros['iron'] = round2(nuts['鐵'])
        if '鋅' in nuts: micros['zinc'] = round2(nuts['鋅'])
        if '維生素C' in nuts: micros['vitaminC'] = round2(nuts['維生素C'])
        if '膽固醇' in nuts: micros['cholesterol'] = round2(nuts['膽固醇'])

        u_id = make_uuid('TFDA', code)
        if u_id in seen_ids:
            continue
        seen_ids.add(u_id)

        food_entry = {
            'id': u_id,
            'name': item['name'],
            'calories': round2(calories),
            'carbs': round2(carbs),
            'protein': round2(protein),
            'fat': round2(fat),
            'dataSource': {
                'authority': 'TFDA',
                'sourceId': code,
                'sourceName': item['name'],
                'verifiedAt': '2026-11-23'
            }
        }
        if fiber > 0: food_entry['fiber'] = round2(fiber)
        if sugar > 0: food_entry['sugar'] = round2(sugar)
        if sat_fat > 0: food_entry['saturatedFat'] = round2(sat_fat)
        if trans_fat > 0: food_entry['transFat'] = round2(trans_fat)
        if sodium > 0: food_entry['sodium'] = round2(sodium)
        if item['refuseRate'] > 0:
            food_entry['refuseRate'] = item['refuseRate']
            food_entry['edibleRate'] = item['edibleRate']
        if micros:
            food_entry['micros'] = micros
        all_foods.append(food_entry)
    print(f"TFDA 轉換完成：共計 {len(tfda_map)} 筆食材。")

# -----------------------------------------------------------------------------
# 2. 解析中國 CDC (CFCT 第 6 版食物成分表標準版)
# -----------------------------------------------------------------------------
cfct_dir = 'scripts/pipeline/china-food-composition-data/json_data_v3_20260825_qwen38max_kimi_k3_fixed_en'
if os.path.exists(cfct_dir):
    print("正在解析中國 CDC (CFCT) 資料集...")
    cfct_count = 0
    for fname in os.listdir(cfct_dir):
        if not fname.endswith('.json') or fname == 'enrich_log.json':
            continue
        fpath = os.path.join(cfct_dir, fname)
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                items = json.load(f)
                if not isinstance(items, list):
                    continue
                for item in items:
                    code = str(item.get('foodCode') or item.get('code') or item.get('id') or '').strip()
                    name = str(item.get('foodName') or item.get('name') or '').strip()
                    if not code or not name:
                        continue

                    u_id = make_uuid('CFCT', code)
                    if u_id in seen_ids:
                        continue
                    seen_ids.add(u_id)

                    edible_pct = safe_float(item.get('edible'), 100.0)
                    edible_rate = round(edible_pct / 100.0, 4) if edible_pct > 0 else 1.0
                    refuse_rate = round(max(0.0, 1.0 - edible_rate), 4)

                    calories = safe_float(item.get('energyKCal') or item.get('energy_kcal') or item.get('calories'), 0.0)
                    protein = safe_float(item.get('protein'), 0.0)
                    fat = safe_float(item.get('fat'), 0.0)
                    carbs = safe_float(item.get('CHO') or item.get('carbohydrate') or item.get('carbs'), 0.0)
                    fiber = safe_float(item.get('dietaryFiber') or item.get('fiber'), 0.0)
                    sodium = safe_float(item.get('Na') or item.get('na') or item.get('sodium'), 0.0)

                    micros = {}
                    if 'K' in item: micros['potassium'] = round2(safe_float(item['K']))
                    elif 'k' in item: micros['potassium'] = round2(safe_float(item['k']))

                    if 'Ca' in item: micros['calcium'] = round2(safe_float(item['Ca']))
                    elif 'ca' in item: micros['calcium'] = round2(safe_float(item['ca']))

                    if 'Mg' in item: micros['magnesium'] = round2(safe_float(item['Mg']))
                    elif 'mg' in item: micros['magnesium'] = round2(safe_float(item['mg']))

                    if 'Fe' in item: micros['iron'] = round2(safe_float(item['Fe']))
                    elif 'fe' in item: micros['iron'] = round2(safe_float(item['fe']))

                    if 'Zn' in item: micros['zinc'] = round2(safe_float(item['Zn']))
                    elif 'zn' in item: micros['zinc'] = round2(safe_float(item['zn']))

                    if 'Se' in item: micros['selenium'] = round2(safe_float(item['Se']))
                    elif 'se' in item: micros['selenium'] = round2(safe_float(item['se']))

                    if 'vitaminC' in item: micros['vitaminC'] = round2(safe_float(item['vitaminC']))
                    elif 'vitamin_c' in item: micros['vitaminC'] = round2(safe_float(item['vitamin_c']))

                    if 'cholesterol' in item: micros['cholesterol'] = round2(safe_float(item['cholesterol']))

                    food_entry = {
                        'id': u_id,
                        'name': name,
                        'calories': round2(calories),
                        'carbs': round2(carbs),
                        'protein': round2(protein),
                        'fat': round2(fat),
                        'dataSource': {
                            'authority': 'CFCT',
                            'sourceId': code,
                            'sourceName': name,
                            'verifiedAt': '2026-11-23'
                        }
                    }
                    if fiber > 0: food_entry['fiber'] = round2(fiber)
                    if sodium > 0: food_entry['sodium'] = round2(sodium)
                    if refuse_rate > 0:
                        food_entry['refuseRate'] = refuse_rate
                        food_entry['edibleRate'] = edible_rate
                    if micros:
                        food_entry['micros'] = micros
                    all_foods.append(food_entry)
                    cfct_count += 1
        except Exception as e:
            pass
    print(f"CFCT 轉換完成：共計 {cfct_count} 筆食材。")

# -----------------------------------------------------------------------------
# 3. 解析美國 USDA SR Legacy (標準參考庫 7,793 筆)
# -----------------------------------------------------------------------------
usda_zip_path = 'scripts/pipeline/usda_sr_legacy.zip'
if os.path.exists(usda_zip_path):
    print("正在解析美國 USDA SR Legacy 資料集...")
    usda_foods = {}
    with zipfile.ZipFile(usda_zip_path) as z:
        prefix = 'FoodData_Central_sr_legacy_food_csv_2018-04/'
        
        # 1. 讀取所有 food 基礎條目
        with z.open(prefix + 'food.csv') as f:
            reader = csv.reader(io.TextIOWrapper(f, encoding='utf-8'))
            header = next(reader)
            # fdc_id, data_type, description, food_category_id, publication_date
            for row in reader:
                if len(row) < 3: continue
                fdc_id = row[0].strip()
                data_type = row[1].strip()
                desc = row[2].strip()
                if data_type == 'sr_legacy_food':
                    usda_foods[fdc_id] = {
                        'fdcId': fdc_id,
                        'name': desc,
                        'nutrients': {}
                    }
        print(f"USDA SR Legacy 總計索引 {len(usda_foods)} 個基礎食材條目。正在關聯營養成分...")

        # 2. 營養素對應表
        target_nutrients = {
            '1008': 'calories',
            '1003': 'protein',
            '1004': 'fat',
            '1005': 'carbs',
            '1079': 'fiber',
            '2000': 'sugar',
            '1258': 'saturatedFat',
            '1257': 'transFat',
            '1093': 'sodium',
            '1092': 'potassium',
            '1087': 'calcium',
            '1090': 'magnesium',
            '1089': 'iron',
            '1095': 'zinc',
            '1162': 'vitaminC',
            '1253': 'cholesterol'
        }

        with z.open(prefix + 'food_nutrient.csv') as f:
            reader = csv.reader(io.TextIOWrapper(f, encoding='utf-8'))
            header = next(reader)
            for row in reader:
                if len(row) < 4: continue
                fdc_id = row[1].strip()
                nutrient_id = row[2].strip()
                if fdc_id in usda_foods and nutrient_id in target_nutrients:
                    nut_name = target_nutrients[nutrient_id]
                    usda_foods[fdc_id]['nutrients'][nut_name] = safe_float(row[3])

    for fdc_id, item in usda_foods.items():
        nuts = item['nutrients']
        u_id = make_uuid('USDA', fdc_id)
        if u_id in seen_ids:
            continue
        seen_ids.add(u_id)

        micros = {}
        for m_key in ['potassium', 'calcium', 'magnesium', 'iron', 'zinc', 'vitaminC', 'cholesterol']:
            if m_key in nuts and nuts[m_key] > 0:
                micros[m_key] = round2(nuts[m_key])

        food_entry = {
            'id': u_id,
            'name': item['name'],
            'calories': round2(nuts.get('calories', 0.0)),
            'carbs': round2(nuts.get('carbs', 0.0)),
            'protein': round2(nuts.get('protein', 0.0)),
            'fat': round2(nuts.get('fat', 0.0)),
            'dataSource': {
                'authority': 'USDA',
                'sourceId': fdc_id,
                'sourceName': item['name'],
                'verifiedAt': '2026-11-23'
            }
        }
        if nuts.get('fiber', 0.0) > 0: food_entry['fiber'] = round2(nuts['fiber'])
        if nuts.get('sugar', 0.0) > 0: food_entry['sugar'] = round2(nuts['sugar'])
        if nuts.get('saturatedFat', 0.0) > 0: food_entry['saturatedFat'] = round2(nuts['saturatedFat'])
        if nuts.get('transFat', 0.0) > 0: food_entry['transFat'] = round2(nuts['transFat'])
        if nuts.get('sodium', 0.0) > 0: food_entry['sodium'] = round2(nuts['sodium'])
        if micros:
            food_entry['micros'] = micros
        all_foods.append(food_entry)
    print(f"USDA SR Legacy 轉換完成：共計 {len(usda_foods)} 筆食材。")

print("-------------------------------------------------------------")
print(f"全部權威庫處理完成！總計生成食材條目: {len(all_foods)} 筆。")

# 輸出標準化 JSON
output_path = 'src/services/db/authorityFoods.json'
with open(output_path, 'w', encoding='utf-8') as out_f:
    json.dump(all_foods, out_f, ensure_ascii=False, separators=(',', ':'))

file_size_kb = os.path.getsize(output_path) / 1024
print(f"成功輸出至 {output_path}，文件大小: {file_size_kb:.1f} KB (未壓縮)")
