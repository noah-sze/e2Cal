"""
從官方原始資料檔回填 USDA、CoFID、AFCD 的不可食損耗率 (refuseRate) 與可食率 (edibleRate)
至 src/services/db/authorityFoods.json。

資料來源：
1. USDA: usda_sr_legacy.zip (sr_legacy_food.csv: fdc_id -> NDB_number) + sr28asc.zip (FOOD_DES.txt: NDB_No -> Refuse %)
2. CoFID: cofid_2021.xlsx ('1.2 Factors': Food Code -> Edible proportion)
3. AFCD: afcd_foods.xlsx ('Food details': Public Food Key -> Unanalysed Portion %)
"""

import csv
import io
import json
import os
import re
import zipfile
import openpyxl

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RAW_DIR = os.path.join(os.path.dirname(__file__), 'raw')
AUTH_JSON = os.path.join(ROOT, 'src', 'services', 'db', 'authorityFoods.json')


def load_usda_refuse_map():
    """建立 USDA fdc_id -> refuse_pct (0~100) 對照表"""
    ndb_to_refuse = {}
    sr28_path = os.path.join(RAW_DIR, 'sr28asc.zip')
    with zipfile.ZipFile(sr28_path) as z:
        with z.open('FOOD_DES.txt') as f:
            for line in io.TextIOWrapper(f, 'latin-1'):
                parts = [p.strip('~') for p in line.strip().split('^')]
                if len(parts) > 8 and parts[8]:
                    try:
                        pct = float(parts[8])
                        if 0 < pct < 100:
                            ndb_to_refuse[parts[0].zfill(5)] = pct
                    except ValueError:
                        pass

    fdc_to_refuse = {}
    fdc_zip = os.path.join(RAW_DIR, 'usda_sr_legacy.zip')
    with zipfile.ZipFile(fdc_zip) as z:
        with z.open('FoodData_Central_sr_legacy_food_csv_2018-04/sr_legacy_food.csv') as f:
            reader = csv.DictReader(io.TextIOWrapper(f, 'utf-8'))
            for row in reader:
                fdc_id = (row.get('fdc_id') or '').strip()
                ndb_no = (row.get('NDB_number') or '').strip().zfill(5)
                if fdc_id and ndb_no in ndb_to_refuse:
                    fdc_to_refuse[fdc_id] = ndb_to_refuse[ndb_no]
    return fdc_to_refuse


def load_cofid_edible_map():
    """建立 CoFID Food Code -> edible_proportion (0~1) 對照表"""
    cofid_path = os.path.join(RAW_DIR, 'cofid_2021.xlsx')
    wb = openpyxl.load_workbook(cofid_path, read_only=True)
    ws = wb['1.2 Factors']
    edible_map = {}
    for idx, row in enumerate(ws.iter_rows(values_only=True)):
        if idx < 3:
            continue
        code = str(row[0] or '').strip()
        if not code:
            continue
        try:
            ep = float(row[7])
            if 0 < ep < 1:
                edible_map[code] = round(ep, 4)
        except (TypeError, ValueError):
            pass
    return edible_map


def load_afcd_refuse_map():
    """建立 AFCD Public Food Key -> refuse_pct (0~100) 對照表"""
    afcd_path = os.path.join(RAW_DIR, 'afcd_foods.xlsx')
    wb = openpyxl.load_workbook(afcd_path, read_only=True)
    ws = wb['Food details']
    refuse_map = {}
    for idx, row in enumerate(ws.iter_rows(values_only=True)):
        if idx < 3:
            continue
        key = str(row[0] or '').strip()
        unanalysed = str(row[10] or '').strip()
        if not key or not unanalysed:
            continue
        m = re.match(r'^(\d+(?:\.\d+)?)\s*%', unanalysed)
        if m:
            pct = float(m.group(1))
            if 0 < pct < 100:
                refuse_map[key] = pct
    return refuse_map


def main():
    usda_map = load_usda_refuse_map()
    cofid_map = load_cofid_edible_map()
    afcd_map = load_afcd_refuse_map()

    with open(AUTH_JSON, 'r', encoding='utf-8') as f:
        foods = json.load(f)

    updated_counts = {'USDA': 0, 'CoFID': 0, 'AFCD': 0}

    for item in foods:
        ds = item.get('dataSource') or {}
        auth = ds.get('authority')
        sid = str(ds.get('sourceId') or '').strip()

        if auth == 'USDA' and sid in usda_map:
            refuse_rate = round(usda_map[sid] / 100.0, 4)
            item['refuseRate'] = refuse_rate
            item['edibleRate'] = round(1.0 - refuse_rate, 4)
            updated_counts['USDA'] += 1
        elif auth == 'CoFID' and sid in cofid_map:
            edible_rate = cofid_map[sid]
            item['edibleRate'] = edible_rate
            item['refuseRate'] = round(1.0 - edible_rate, 4)
            updated_counts['CoFID'] += 1
        elif auth == 'AFCD' and sid in afcd_map:
            refuse_rate = round(afcd_map[sid] / 100.0, 4)
            item['refuseRate'] = refuse_rate
            item['edibleRate'] = round(1.0 - refuse_rate, 4)
            updated_counts['AFCD'] += 1

    with open(AUTH_JSON, 'w', encoding='utf-8') as f:
        json.dump(foods, f, ensure_ascii=False, indent=2)
        f.write('\n')

    # 統計最終各庫覆蓋率
    summary = {}
    for item in foods:
        auth = (item.get('dataSource') or {}).get('authority', 'unknown')
        s = summary.setdefault(auth, {'total': 0, 'hasRefuse': 0})
        s['total'] += 1
        if (item.get('refuseRate') or 0) > 0:
            s['hasRefuse'] += 1

    print('Backfilled counts:', updated_counts)
    print('Final refuseRate coverage:', json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
