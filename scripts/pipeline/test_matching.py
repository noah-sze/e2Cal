import json
import re

def main():
    with open('scripts/pipeline/extracted_natural_foods.json', 'r', encoding='utf-8') as f:
        natural_foods = json.load(f)

    with open('src/services/db/authorityFoods.json', 'r', encoding='utf-8') as f:
        authority_foods = json.load(f)

    print(f"Natural foods to match: {len(natural_foods)}")
    print(f"Authority database size: {len(authority_foods)}")

    # Index authority foods by source and name
    tfda_map = {}
    cfct_map = {}
    usda_map = {}

    for item in authority_foods:
        auth = item.get('dataSource', {}).get('authority')
        name = item.get('name', '').strip()
        if auth == 'TFDA':
            tfda_map[name.lower()] = item
        elif auth == 'CFCT':
            cfct_map[name.lower()] = item
        elif auth == 'USDA':
            usda_map[name.lower()] = item

    # Let's see how many direct name matches we get
    matched = 0
    unmatched = []

    for nf in natural_foods:
        name = nf['name'].strip()
        name_lower = name.lower()

        match = None
        # Priority: USDA -> CFCT -> TFDA (or TFDA for Chinese names)
        # Check exact Chinese name in TFDA or CFCT
        if name_lower in tfda_map:
            match = tfda_map[name_lower]
        elif name_lower in cfct_map:
            match = cfct_map[name_lower]
        
        if not match:
            # Check if any TFDA item starts with or contains this name
            for k, v in tfda_map.items():
                if k == name_lower or k.startswith(name_lower + '(') or k.startswith(name_lower + '，') or f"({name_lower})" in k:
                    match = v
                    break

        if not match:
            for k, v in cfct_map.items():
                if k == name_lower or k.startswith(name_lower + '(') or k.startswith(name_lower + '，') or f"({name_lower})" in k:
                    match = v
                    break

        if match:
            matched += 1
        else:
            unmatched.append(nf)

    print(f"Direct/Clean Name Matched: {matched}/{len(natural_foods)}")
    print(f"Unmatched: {len(unmatched)}")
    print("Sample unmatched names:")
    for u in unmatched[:20]:
        print(f" - {u['key']}: {u['name']} (Cal: {u['calories']}, P: {u['protein']}, F: {u['fat']}, C: {u['carbs']})")

if __name__ == '__main__':
    main()
