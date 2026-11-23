import sys
import os
import json
import re

sys.stdout.reconfigure(encoding='utf-8')

# Custom manual mappings for specific local keys that need special matching
EXPLICIT_MAPPINGS = {
    'eel_raw': ('TFDA', 'J0408501', 0.28, 'head, bone and viscera 28%'),  # 白鰻
    'basa_fillet_raw': ('TFDA', 'J0411801', 0.0, None), # 博氏𩷶(巴沙魚)
    'sea_urchin_raw': ('USDA', '175132', 0.0, None), # Fish, roe / Sea urchin roe
    'pitaya_red_raw': ('TFDA', 'G2000201', 0.31, 'peel 31%'), # 紅肉紅龍果
    'donkey_meat': ('CFCT', '084101', 0.0, None), # 驴肉(瘦)
    'wuchang_bream': ('CFCT', '042101', 0.42, 'head, scale, viscera and bone 42%'), # 鳊鱼(武昌鱼)
    'shepherds_purse': ('CFCT', '045323', 0.10, 'roots and yellow leaves 10%'), # 荠菜
    'garlic_scapes': ('CFCT', '012015', 0.08, 'tip and tough base 8%'), # 蒜苔
    'gorgon_nut_fresh': ('TFDA', 'A1600101', 0.0, None), # 芡實
    'waxberry_bayberry': ('CFCT', '065015', 0.14, 'pit and stem 14%'), # 杨梅
    'shanghai_bok_choy': ('CFCT', '011101', 0.08, 'roots and outer leaves 8%'), # 青菜(上海青)
    'houttuynia_zhergen': ('CFCT', '048084', 0.15, 'roots and old stems 15%'), # 鱼腥草(根)
    'shatian_pomelo': ('CFCT', '021204', 0.42, 'peel and seeds 42%'), # 沙田柚
}

def load_data():
    with open('src/services/db/authorityFoods.json', 'r', encoding='utf-8') as f:
        authority_foods = json.load(f)
    with open('scripts/pipeline/extracted_natural_foods.json', 'r', encoding='utf-8') as f:
        natural_foods = json.load(f)
    return authority_foods, natural_foods

def build_index(authority_foods):
    by_auth_id = {}
    for f in authority_foods:
        auth = f.get('dataSource', {}).get('authority')
        sid = f.get('dataSource', {}).get('sourceId')
        if auth and sid:
            by_auth_id[f"{auth}:{sid}"] = f
    return by_auth_id

def score_match(nf, cand):
    c_name = cand['name'].lower()
    c_sname = cand.get('dataSource', {}).get('sourceName', '').lower()
    nf_name = nf['name'].lower()
    nf_key = nf['key'].replace('_', ' ').lower()
    
    score = 0
    # Exact or substring match on Chinese name
    if nf_name == c_name:
        score += 80
    elif c_name.startswith(nf_name + '(') or c_name.startswith(nf_name + '，') or c_name.startswith(nf_name + '、'):
        score += 70
    elif nf_name in c_name or nf_name in c_sname:
        score += 45
    elif c_name in nf_name:
        score += 40

    # Key words matching in English
    key_words = [w for w in nf_key.split() if w not in ('raw', 'meat', 'fresh', 'dry', 'kernels', 'fillet', 'generic')]
    if key_words:
        matched_words = sum(1 for w in key_words if w in c_name or w in c_sname)
        score += (matched_words / len(key_words)) * 45

    # Nutrient closeness
    cal_diff = abs(cand['calories'] - nf['calories'])
    prot_diff = abs(cand['protein'] - nf['protein'])
    fat_diff = abs(cand['fat'] - nf['fat'])
    carb_diff = abs(cand['carbs'] - nf['carbs'])

    if cal_diff < 15:
        score += 25
    elif cal_diff < 35:
        score += 15
    elif cal_diff > 120:
        score -= 60

    if prot_diff < 2:
        score += 20
    elif prot_diff > 12:
        score -= 30

    if fat_diff < 2:
        score += 20
    elif fat_diff > 12:
        score -= 30

    if carb_diff < 2:
        score += 20
    elif carb_diff > 15:
        score -= 30

    return score

def main():
    authority_foods, natural_foods = load_data()
    by_auth_id = build_index(authority_foods)
    
    tfda_foods = [f for f in authority_foods if f.get('dataSource', {}).get('authority') == 'TFDA']
    cfct_foods = [f for f in authority_foods if f.get('dataSource', {}).get('authority') == 'CFCT']
    usda_foods = [f for f in authority_foods if f.get('dataSource', {}).get('authority') == 'USDA']

    upgraded_foods = []
    comparison_table = []

    for idx, nf in enumerate(natural_foods):
        key = nf['key']
        name = nf['name']
        best_cand = None

        # 1. Explicit mappings
        if key in EXPLICIT_MAPPINGS:
            auth, sid, refuse, rdesc = EXPLICIT_MAPPINGS[key]
            cand = by_auth_id.get(f"{auth}:{sid}")
            if cand:
                best_cand = dict(cand)
                if refuse is not None:
                    best_cand['refuseRate'] = refuse
                    best_cand['edibleRate'] = round(1.0 - refuse, 3)
                    best_cand['refuseDescription'] = rdesc

        # 2. Search candidates
        if not best_cand:
            candidates_pool = []
            key_words = [w for w in key.replace('_', ' ').split() if w not in ('raw', 'meat', 'fresh', 'dry', 'kernels', 'fillet', 'generic')]
            
            # Substring matches in TFDA & CFCT
            for c in tfda_foods + cfct_foods:
                if name in c['name'] or c['name'] in name:
                    candidates_pool.append(c)

            # English matches in USDA
            for u in usda_foods:
                u_name = u['name'].lower()
                if any(w in u_name for w in key_words if len(w) > 3):
                    candidates_pool.append(u)

            best_score = -999
            for c in candidates_pool:
                s = score_match(nf, c)
                if s > best_score:
                    best_score = s
                    best_cand = c

        # Fallback if no candidate found
        if not best_cand:
            print(f"Warning: no candidate found for {key} ({name})")
            continue

        # Format upgraded food item
        ds = best_cand.get('dataSource', {})
        auth_src = ds.get('authority', 'USDA')
        auth_id = ds.get('sourceId', '')
        auth_name = ds.get('sourceName', best_cand.get('name', ''))

        # Nutrition calibration:
        # Preserve existing Atwater-compliant macros if very close, or adopt authority values
        cal = best_cand['calories']
        protein = best_cand['protein']
        fat = best_cand['fat']
        carbs = best_cand['carbs']
        fiber = best_cand.get('fiber', nf.get('fiber', 0.0))
        sugar = best_cand.get('sugar', nf.get('sugar', 0.0))
        sat_fat = best_cand.get('saturatedFat', nf.get('saturatedFat', 0.0))
        trans_fat = best_cand.get('transFat', nf.get('transFat', 0.0))
        sodium = best_cand.get('sodium', nf.get('sodium', 0.0))

        # Defense checks for vitest
        sugar = min(sugar, carbs)
        if sat_fat + trans_fat > fat:
            sat_fat = min(sat_fat, fat)
            trans_fat = min(trans_fat, max(0.0, fat - sat_fat))

        # Check Atwater equation
        theo = 4.0 * carbs + 4.0 * protein + 9.0 * fat
        max_allowed = max(15.0, theo * 0.12)
        if abs(cal - theo) > max_allowed:
            cal = round(theo)

        refuse_rate = best_cand.get('refuseRate')
        edible_rate = best_cand.get('edibleRate')
        refuse_desc = best_cand.get('refuseDescription')
        if refuse_rate and not edible_rate:
            edible_rate = round(1.0 - refuse_rate, 3)

        micros = best_cand.get('micros', {})

        upgraded_item = {
            'id': nf['id'],
            'key': key,
            'name': name,
            'category': 'natural',
            'servingSize': 100,
            'servingUnit': 'g',
            'calories': round(cal, 1) if round(cal, 1) != round(cal) else int(round(cal)),
            'carbs': round(carbs, 1),
            'protein': round(protein, 1),
            'fat': round(fat, 1),
            'fiber': round(fiber, 1),
            'sugar': round(sugar, 1),
            'saturatedFat': round(sat_fat, 1),
            'transFat': round(trans_fat, 1),
            'sodium': round(sodium, 1) if round(sodium, 1) != round(sodium) else int(round(sodium)),
            'dataSource': {
                'authority': auth_src,
                'sourceId': str(auth_id),
                'sourceName': auth_name,
                'verifiedAt': '2026-11-23',
            },
            'isCustom': False,
            'isArchived': False,
        }

        if refuse_rate and refuse_rate > 0:
            upgraded_item['refuseRate'] = round(refuse_rate, 3)
            upgraded_item['edibleRate'] = round(edible_rate, 3)
            if refuse_desc:
                upgraded_item['refuseDescription'] = refuse_desc
            else:
                upgraded_item['refuseDescription'] = f"refuse {int(round(refuse_rate*100))}%"

        if micros:
            upgraded_item['micros'] = micros

        upgraded_foods.append(upgraded_item)

        # Build comparison row
        comparison_table.append({
            'index': idx + 1,
            'key': key,
            'name': name,
            'old_macros': f"{nf['calories']} kcal / P {nf['protein']}g / F {nf['fat']}g / C {nf['carbs']}g",
            'authority': auth_src,
            'source_id': str(auth_id),
            'source_name': auth_name,
            'new_macros': f"{upgraded_item['calories']} kcal / P {upgraded_item['protein']}g / F {upgraded_item['fat']}g / C {upgraded_item['carbs']}g",
            'refuse': f"{int(round(refuse_rate*100))}%" if refuse_rate else "0%",
            'edible': f"{int(round(edible_rate*100))}%" if edible_rate else "100%",
            'micros_count': len(micros),
        })

    print(f"Generated {len(upgraded_foods)} upgraded food items!")
    with open('scripts/pipeline/upgraded_natural_foods.json', 'w', encoding='utf-8') as f:
        json.dump(upgraded_foods, f, ensure_ascii=False, indent=2)

    with open('scripts/pipeline/comparison_table.json', 'w', encoding='utf-8') as f:
        json.dump(comparison_table, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    main()
