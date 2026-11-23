import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')

from create_alignment_dictionary import SYNONYMS

def clean_str(s):
    return re.sub(r'[\(\)（）\s\-_，,、\.]', '', str(s).lower())

def main():
    with open('scripts/pipeline/extracted_natural_foods.json', 'r', encoding='utf-8') as f:
        natural_foods = json.load(f)

    with open('src/services/db/authorityFoods.json', 'r', encoding='utf-8') as f:
        authority_foods = json.load(f)

    tfda_items = [f for f in authority_foods if f.get('dataSource', {}).get('authority') == 'TFDA']
    cfct_items = [f for f in authority_foods if f.get('dataSource', {}).get('authority') == 'CFCT']
    usda_items = [f for f in authority_foods if f.get('dataSource', {}).get('authority') == 'USDA']

    # Index by sourceId
    by_source_id = {f.get('dataSource', {}).get('sourceId'): f for f in authority_foods}

    matched_count = 0
    results = []
    unmatched = []

    for nf in natural_foods:
        key = nf['key']
        name = nf['name']
        match = None
        match_type = ''

        # 1. Check curated SYNONYMS
        if key in SYNONYMS:
            cname, candidates = SYNONYMS[key]
            for cand in candidates:
                if cand in by_source_id:
                    match = by_source_id[cand]
                    match_type = f'curated_id({cand})'
                    break
                # search in usda
                cand_clean = cand.lower()
                for u in usda_items:
                    if cand_clean in u['name'].lower():
                        match = u
                        match_type = f'curated_usda({cand})'
                        break
                if match:
                    break
                # search in tfda
                for t in tfda_items:
                    if cand in t['name']:
                        match = t
                        match_type = f'curated_tfda({cand})'
                        break
                if match:
                    break

        # 2. If no curated match, match by exact Chinese name in TFDA
        if not match:
            for t in tfda_items:
                if t['name'] == name:
                    match = t
                    match_type = 'tfda_exact'
                    break

        # 3. Match by prefix in TFDA (e.g. "菠菜(生鮮)")
        if not match:
            for t in tfda_items:
                tname = t['name']
                if tname.startswith(name + '(') or tname.startswith(name + '，') or tname.startswith(name + '、'):
                    # Nutrient sanity check: calories within 35% or 30 kcal
                    if abs(t['calories'] - nf['calories']) < max(35, nf['calories'] * 0.4):
                        match = t
                        match_type = 'tfda_prefix'
                        break

        # 4. Match in CFCT
        if not match:
            for c in cfct_items:
                if c['name'] == name:
                    match = c
                    match_type = 'cfct_exact'
                    break
                cname = c['name']
                if cname.startswith(name + '(') or cname.startswith(name + '，'):
                    if abs(c['calories'] - nf['calories']) < max(35, nf['calories'] * 0.4):
                        match = c
                        match_type = 'cfct_prefix'
                        break

        # 5. Fuzzy substring in TFDA
        if not match:
            for t in tfda_items:
                if name in t['name']:
                    if abs(t['calories'] - nf['calories']) < max(35, nf['calories'] * 0.4):
                        match = t
                        match_type = 'tfda_substr'
                        break

        # 6. Fuzzy substring in CFCT
        if not match:
            for c in cfct_items:
                if name in c['name']:
                    if abs(c['calories'] - nf['calories']) < max(35, nf['calories'] * 0.4):
                        match = c
                        match_type = 'cfct_substr'
                        break

        if match:
            matched_count += 1
            results.append({
                'key': key,
                'name': name,
                'old_calories': nf['calories'],
                'old_protein': nf['protein'],
                'old_fat': nf['fat'],
                'old_carbs': nf['carbs'],
                'match': match,
                'match_type': match_type,
            })
        else:
            unmatched.append(nf)

    print(f"Total matched: {matched_count}/{len(natural_foods)} ({matched_count/len(natural_foods)*100:.1f}%)")
    print(f"Unmatched count: {len(unmatched)}")
    if unmatched:
        print("\nUnmatched sample:")
        for u in unmatched[:30]:
            print(f" - {u['key']}: {u['name']} (Cal: {u['calories']}, P: {u['protein']}, F: {u['fat']}, C: {u['carbs']})")

if __name__ == '__main__':
    main()
