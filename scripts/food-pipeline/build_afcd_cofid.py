import os
import re
import json
import uuid
import openpyxl

NAMESPACE_E2CAL = uuid.UUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')
RAW_DIR = os.path.join(os.path.dirname(__file__), 'raw')

def make_uuid(authority: str, source_id: str) -> str:
    key = f"{authority}:{source_id}"
    return str(uuid.uuid5(NAMESPACE_E2CAL, key))

def safe_float(val, default=0.0):
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).strip().replace(',', '')
    if not val_str or val_str.lower() in ('na', 'n', 'none', '-', 'trace', 'tr', 'nd', '*', '<', '>'):
        return default
    # 清洗括號 (1.2) -> 1.2, <0.1 -> 0.1
    val_str = re.sub(r'[\(\)<>\*]', '', val_str).strip()
    try:
        return float(val_str)
    except:
        return default

def round1(val):
    return round(float(val), 1)

def round2(val):
    return round(float(val), 2)

# -----------------------------------------------------------------------------
# 1. 解析澳洲 AFCD (Release 3)
# -----------------------------------------------------------------------------
def parse_afcd():
    print("=== [AFCD] 正在解析澳洲 FSANZ AFCD Release 3 ===")
    xlsx_path = os.path.join(RAW_DIR, 'afcd_nutrients.xlsx')
    wb = openpyxl.load_workbook(xlsx_path, read_only=True)
    sheet = wb['All solids & liquids per 100 g']

    # 讀取 header (row 3)
    header = None
    items = []

    for idx, row in enumerate(sheet.iter_rows(values_only=True)):
        if idx < 2:
            continue
        if idx == 2:
            header = [str(c).replace('\n', ' ').strip() if c is not None else '' for c in row]
            continue
        
        # 資料行從 idx == 3 (Row 4) 開始
        code = str(row[0]).strip() if row[0] is not None else ''
        name = str(row[3]).strip() if row[3] is not None else ''
        if not code or not name:
            continue

        # 基礎宏量
        # Energy: 優先使用 without dietary fibre (col 5) 或 with dietary fibre (col 4) kJ
        kj_no_fib = safe_float(row[5], 0.0)
        kj_with_fib = safe_float(row[4], 0.0)
        kj = kj_no_fib if kj_no_fib > 0 else kj_with_fib
        calories = round1(kj / 4.184) if kj > 0 else 0.0

        protein = round1(safe_float(row[7], 0.0))
        fat = round1(safe_float(row[9], 0.0))
        # Available carbohydrate, without sugar alcohols (col 38)
        carbs = round1(safe_float(row[38], safe_float(row[39], 0.0)))
        fiber = round1(safe_float(row[11], 0.0))
        sugar = round1(safe_float(row[19], 0.0))
        sat_fat = round1(safe_float(row[191], 0.0)) # Total SFA (g)
        trans_fat = round1(safe_float(row[220], 0.0)) if len(row) > 220 else 0.0 # Total trans (g)
        sodium = round1(safe_float(row[72], 0.0)) # Sodium (mg)

        # 守恆修正
        if sat_fat + trans_fat > fat and fat > 0:
            sat_fat = min(sat_fat, fat)
            trans_fat = max(0.0, min(trans_fat, fat - sat_fat))

        # 微量元素
        micros = {}
        # 礦物質
        potassium = safe_float(row[70], 0.0)
        if potassium > 0: micros['potassium'] = round1(potassium)
        calcium = safe_float(row[55], 0.0)
        if calcium > 0: micros['calcium'] = round1(calcium)
        magnesium = safe_float(row[64], 0.0)
        if magnesium > 0: micros['magnesium'] = round1(magnesium)
        iron = safe_float(row[62], 0.0)
        if iron > 0: micros['iron'] = round2(iron)
        zinc = safe_float(row[75], 0.0)
        if zinc > 0: micros['zinc'] = round2(zinc)
        selenium = safe_float(row[71], 0.0)
        if selenium > 0: micros['selenium'] = round2(selenium)

        # 維生素
        vit_a = safe_float(row[81], 0.0) # Retinol eq (ug)
        if vit_a > 0: micros['vitaminA'] = round1(vit_a)
        vit_c = safe_float(row[98], 0.0) # Vitamin C (mg)
        if vit_c > 0: micros['vitaminC'] = round1(vit_c)
        vit_d = safe_float(row[103], 0.0) # D3 eq (ug)
        if vit_d > 0: micros['vitaminD'] = round2(vit_d)
        vit_e = safe_float(row[112], 0.0) # Vitamin E (mg)
        if vit_e > 0: micros['vitaminE'] = round2(vit_e)
        b1 = safe_float(row[85], 0.0)
        if b1 > 0: micros['vitaminB1'] = round2(b1)
        b2 = safe_float(row[86], 0.0)
        if b2 > 0: micros['vitaminB2'] = round2(b2)
        b3 = safe_float(row[89], 0.0)
        if b3 > 0: micros['vitaminB3'] = round2(b3)
        b6 = safe_float(row[91], 0.0)
        if b6 > 0: micros['vitaminB6'] = round2(b6)
        b12 = safe_float(row[93], 0.0)
        if b12 > 0: micros['vitaminB12'] = round2(b12)
        folate = safe_float(row[97], 0.0) # DFE (ug)
        if folate > 0: micros['folate'] = round1(folate)

        # 膽固醇 & 脂肪酸
        if len(row) > 229:
            chol = safe_float(row[229], 0.0)
            if chol > 0: micros['cholesterol'] = round1(chol)
        if len(row) > 215:
            epa = safe_float(row[215], 0.0)
            if epa > 0: micros['omega3EPA'] = round2(epa)
        if len(row) > 218:
            dha = safe_float(row[218], 0.0)
            if dha > 0: micros['omega3DHA'] = round2(dha)
        if len(row) > 209:
            ala = safe_float(row[209], 0.0)
            if ala > 0: micros['omega3ALA'] = round2(ala)

        item = {
            'id': make_uuid('AFCD', code),
            'name': name,
            'calories': calories,
            'carbs': carbs,
            'protein': protein,
            'fat': fat,
            'fiber': fiber,
            'sugar': sugar,
            'saturatedFat': sat_fat,
            'transFat': trans_fat,
            'sodium': sodium,
            'refuseRate': 0.0,
            'edibleRate': 1.0,
            'dataSource': {
                'authority': 'AFCD',
                'sourceId': code,
                'sourceName': name,
                'verifiedAt': '2026-11-24'
            }
        }
        if micros:
            item['micros'] = micros

        items.append(item)

    print(f"[AFCD] 成功解析 {len(items)} 筆食材條目")
    return items

# -----------------------------------------------------------------------------
# 2. 解析英國 CoFID (McCance and Widdowson 2021)
# -----------------------------------------------------------------------------
def parse_cofid():
    print("=== [CoFID] 正在解析英國 UKHSA CoFID 2021 ===")
    xlsx_path = os.path.join(RAW_DIR, 'cofid_2021.xlsx')
    wb = openpyxl.load_workbook(xlsx_path, read_only=True)

    # 1. 讀取 Proximates
    prox_map = {}
    sheet_p = wb['1.3 Proximates']
    for idx, row in enumerate(sheet_p.iter_rows(values_only=True)):
        if idx < 3: # 前 3 行是 header
            continue
        code = str(row[0]).strip() if row[0] is not None else ''
        name = str(row[1]).strip() if row[1] is not None else ''
        if not code or not name:
            continue

        calories = round1(safe_float(row[12], 0.0)) # KCALS
        protein = round1(safe_float(row[9], 0.0))  # PROT
        fat = round1(safe_float(row[10], 0.0))      # FAT
        carbs = round1(safe_float(row[11], 0.0))    # CHO
        sugar = round1(safe_float(row[16], 0.0))    # TOTSUG
        # 纖維優先 AOAC (col 25)，次選 Englyst (col 24)
        fiber = round1(safe_float(row[25], safe_float(row[24], 0.0)))
        sat_fat = round1(safe_float(row[27], safe_float(row[41], 0.0))) # SATFOD 或 SATFODx6
        trans_fat = round1(safe_float(row[45], 0.0)) # FODTRANS
        cholesterol = safe_float(row[46], 0.0) # CHOL (mg)

        prox_map[code] = {
            'code': code,
            'name': name,
            'calories': calories,
            'protein': protein,
            'fat': fat,
            'carbs': carbs,
            'sugar': sugar,
            'fiber': fiber,
            'sat_fat': sat_fat,
            'trans_fat': trans_fat,
            'cholesterol': cholesterol,
            'micros': {}
        }

    # 2. 讀取 Inorganics (礦物質與電解質)
    sheet_i = wb['1.4 Inorganics']
    for idx, row in enumerate(sheet_i.iter_rows(values_only=True)):
        if idx < 3:
            continue
        code = str(row[0]).strip() if row[0] is not None else ''
        if code not in prox_map:
            continue
        # row: 0:code, 7:Na, 8:K, 9:Ca, 10:Mg, 11:P, 12:Fe, 13:Cu, 14:Zn, 17:Se
        prox = prox_map[code]
        prox['sodium'] = round1(safe_float(row[7], 0.0))
        
        k = safe_float(row[8], 0.0)
        if k > 0: prox['micros']['potassium'] = round1(k)
        ca = safe_float(row[9], 0.0)
        if ca > 0: prox['micros']['calcium'] = round1(ca)
        mg = safe_float(row[10], 0.0)
        if mg > 0: prox['micros']['magnesium'] = round1(mg)
        fe = safe_float(row[12], 0.0)
        if fe > 0: prox['micros']['iron'] = round2(fe)
        zn = safe_float(row[14], 0.0)
        if zn > 0: prox['micros']['zinc'] = round2(zn)
        if len(row) > 17:
            se = safe_float(row[17], 0.0)
            if se > 0: prox['micros']['selenium'] = round2(se)

    # 3. 讀取 Vitamins
    sheet_v = wb['1.5 Vitamins']
    for idx, row in enumerate(sheet_v.iter_rows(values_only=True)):
        if idx < 3:
            continue
        code = str(row[0]).strip() if row[0] is not None else ''
        if code not in prox_map:
            continue
        # 0:code, 9:RETEQU, 10:VITD, 11:VITE, 13:THIA, 14:RIBO, 17:NIACEQU, 18:VITB6, 19:VITB12, 20:FOLT, 24:VITC
        prox = prox_map[code]
        va = safe_float(row[9], 0.0)
        if va > 0: prox['micros']['vitaminA'] = round1(va)
        vd = safe_float(row[10], 0.0)
        if vd > 0: prox['micros']['vitaminD'] = round2(vd)
        ve = safe_float(row[11], 0.0)
        if ve > 0: prox['micros']['vitaminE'] = round2(ve)
        b1 = safe_float(row[13], 0.0)
        if b1 > 0: prox['micros']['vitaminB1'] = round2(b1)
        b2 = safe_float(row[14], 0.0)
        if b2 > 0: prox['micros']['vitaminB2'] = round2(b2)
        b3 = safe_float(row[17], 0.0)
        if b3 > 0: prox['micros']['vitaminB3'] = round2(b3)
        b6 = safe_float(row[18], 0.0)
        if b6 > 0: prox['micros']['vitaminB6'] = round2(b6)
        b12 = safe_float(row[19], 0.0)
        if b12 > 0: prox['micros']['vitaminB12'] = round2(b12)
        fol = safe_float(row[20], 0.0)
        if fol > 0: prox['micros']['folate'] = round1(fol)
        if len(row) > 24:
            vc = safe_float(row[24], 0.0)
            if vc > 0: prox['micros']['vitaminC'] = round1(vc)

    # 4. 讀取 PUFA (EPA, DHA, ALA)
    if '1.12 (PUFA per 100gFood)' in wb.sheetnames:
        sheet_pufa = wb['1.12 (PUFA per 100gFood)']
        for idx, row in enumerate(sheet_pufa.iter_rows(values_only=True)):
            if idx < 3:
                continue
            code = str(row[0]).strip() if row[0] is not None else ''
            if code not in prox_map:
                continue
            prox = prox_map[code]
            # ALA: col 16 (cis n-3 C18:3)
            ala = safe_float(row[16], 0.0) if len(row) > 16 else 0.0
            if ala > 0: prox['micros']['omega3ALA'] = round2(ala)
            # EPA: col 28 (cis n-3 C20:5)
            epa = safe_float(row[28], 0.0) if len(row) > 28 else 0.0
            if epa > 0: prox['micros']['omega3EPA'] = round2(epa)
            # DHA: col 40 (cis n-3 C22:6)
            dha = safe_float(row[40], 0.0) if len(row) > 40 else 0.0
            if dha > 0: prox['micros']['omega3DHA'] = round2(dha)

    items = []
    for code, p in prox_map.items():
        if p['cholesterol'] > 0:
            p['micros']['cholesterol'] = round1(p['cholesterol'])

        # 守恆修正
        fat = p['fat']
        sat = p['sat_fat']
        trans = p['trans_fat']
        if sat + trans > fat and fat > 0:
            sat = min(sat, fat)
            trans = max(0.0, min(trans, fat - sat))

        item = {
            'id': make_uuid('CoFID', code),
            'name': p['name'],
            'calories': p['calories'],
            'carbs': p['carbs'],
            'protein': p['protein'],
            'fat': fat,
            'fiber': p['fiber'],
            'sugar': p['sugar'],
            'saturatedFat': sat,
            'transFat': trans,
            'sodium': p.get('sodium', 0.0),
            'refuseRate': 0.0,
            'edibleRate': 1.0,
            'dataSource': {
                'authority': 'CoFID',
                'sourceId': code,
                'sourceName': p['name'],
                'verifiedAt': '2026-11-24'
            }
        }
        if p['micros']:
            item['micros'] = p['micros']
        items.append(item)

    print(f"[CoFID] 成功解析 {len(items)} 筆食材條目")
    return items

if __name__ == '__main__':
    afcd_items = parse_afcd()
    cofid_items = parse_cofid()
    print(f"Total new items: {len(afcd_items) + len(cofid_items)}")
