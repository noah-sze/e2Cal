import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')

def main():
    with open('scripts/pipeline/extracted_natural_foods.json', 'r', encoding='utf-8') as f:
        natural_foods = json.load(f)

    with open('src/services/db/authorityFoods.json', 'r', encoding='utf-8') as f:
        authority_foods = json.load(f)

    # Let's inspect TFDA foods and CFCT foods for matching
    tfda_items = [f for f in authority_foods if f.get('dataSource', {}).get('authority') == 'TFDA']
    cfct_items = [f for f in authority_foods if f.get('dataSource', {}).get('authority') == 'CFCT']
    usda_items = [f for f in authority_foods if f.get('dataSource', {}).get('authority') == 'USDA']

    print(f"TFDA items: {len(tfda_items)}, CFCT items: {len(cfct_items)}, USDA items: {len(usda_items)}")

    # Test matching for each natural food:
    matches = {}
    unmatched = []

    for nf in natural_foods:
        name = nf['name']
        key = nf['key']
        # search in TFDA
        found = []
        for item in tfda_items:
            iname = item['name']
            if name == iname:
                found.append((item, 100))
            elif iname.startswith(name + '(') or iname.startswith(name + '，') or iname.startswith(name + '、'):
                found.append((item, 90))
            elif name in iname:
                found.append((item, 70))

        for item in cfct_items:
            iname = item['name']
            if name == iname:
                found.append((item, 95))
            elif iname.startswith(name + '(') or iname.startswith(name + '，') or iname.startswith(name + '、'):
                found.append((item, 85))
            elif name in iname:
                found.append((item, 65))

        if found:
            # sort by score then nutrient similarity (calories difference)
            found.sort(key=lambda x: (-x[1], abs(x[0]['calories'] - nf['calories'])))
            matches[key] = (nf, found[0][0])
        else:
            unmatched.append(nf)

    print(f"Matched with TFDA/CFCT: {len(matches)}/{len(natural_foods)}")
    print(f"Remaining unmatched: {len(unmatched)}")
    print("\nSample remaining unmatched:")
    for u in unmatched[:30]:
        print(f" - {u['key']}: {u['name']}")

if __name__ == '__main__':
    main()
