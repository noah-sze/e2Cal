import re
import json

def main():
    with open('src/services/db/defaultNaturalFoods.ts', 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract NATURAL_FOOD_IDS mapping
    id_map = {}
    ids_block_match = re.search(r'export const NATURAL_FOOD_IDS = \{([\s\S]*?)\} as const;', content)
    if ids_block_match:
        for line in ids_block_match.group(1).splitlines():
            line = line.strip()
            m = re.match(r'(\w+):\s*[\'\"]([^\'\"]+)[\'\"]', line)
            if m:
                id_map[m.group(1)] = m.group(2)

    print(f"Loaded {len(id_map)} NATURAL_FOOD_IDS")

    # Find where DEFAULT_NATURAL_FOODS starts
    start_pos = content.find('export const DEFAULT_NATURAL_FOODS')
    end_pos = content.rfind('];')
    array_content = content[start_pos:end_pos+2]

    # Split objects by comma before new object or end of array
    # A cleaner parser: find all { id: ... } blocks
    # Using brace counting
    objects = []
    i = 0
    in_obj = False
    brace_count = 0
    cur_start = -1

    for idx, ch in enumerate(array_content):
        if ch == '{':
            if brace_count == 0:
                cur_start = idx
                in_obj = True
            brace_count += 1
        elif ch == '}':
            brace_count -= 1
            if brace_count == 0 and in_obj:
                obj_str = array_content[cur_start:idx+1]
                objects.append(obj_str)
                in_obj = False

    print(f"Brace parser extracted {len(objects)} raw objects from DEFAULT_NATURAL_FOODS")

    foods = []
    for obj_str in objects:
        key_m = re.search(r'id:\s*(?:NATURAL_FOOD_IDS\.(\w+)|[\'\"]([^\'\"]+)[\'\"])', obj_str)
        name_m = re.search(r'name:\s*[\'\"]([^\'\"]+)[\'\"]', obj_str)
        if not key_m or not name_m:
            continue
        key = key_m.group(1)
        direct_id = key_m.group(2)
        name = name_m.group(1)
        food_id = id_map.get(key, direct_id or key)

        cal = re.search(r'calories:\s*([\d\.]+)', obj_str)
        protein = re.search(r'protein:\s*([\d\.]+)', obj_str)
        fat = re.search(r'fat:\s*([\d\.]+)', obj_str)
        carbs = re.search(r'carbs:\s*([\d\.]+)', obj_str)
        fiber = re.search(r'fiber:\s*([\d\.]+)', obj_str)
        sugar = re.search(r'sugar:\s*([\d\.]+)', obj_str)
        satFat = re.search(r'saturatedFat:\s*([\d\.]+)', obj_str)
        transFat = re.search(r'transFat:\s*([\d\.]+)', obj_str)
        sodium = re.search(r'sodium:\s*([\d\.]+)', obj_str)
        refuse = re.search(r'refuseRate:\s*([\d\.]+)', obj_str)
        has_ds = 'dataSource:' in obj_str

        foods.append({
            'key': key,
            'id': food_id,
            'name': name,
            'calories': float(cal.group(1)) if cal else 0,
            'protein': float(protein.group(1)) if protein else 0,
            'fat': float(fat.group(1)) if fat else 0,
            'carbs': float(carbs.group(1)) if carbs else 0,
            'fiber': float(fiber.group(1)) if fiber else 0,
            'sugar': float(sugar.group(1)) if sugar else 0,
            'saturatedFat': float(satFat.group(1)) if satFat else 0,
            'transFat': float(transFat.group(1)) if transFat else 0,
            'sodium': float(sodium.group(1)) if sodium else 0,
            'refuseRate': float(refuse.group(1)) if refuse else None,
            'hasDataSource': has_ds,
            'raw': obj_str,
        })

    print(f"Successfully parsed {len(foods)} foods")
    with open('scripts/pipeline/extracted_natural_foods.json', 'w', encoding='utf-8') as out:
        json.dump(foods, out, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    main()
