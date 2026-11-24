import os
import json
import uuid
from build_afcd_cofid import parse_afcd, parse_cofid

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
AUTH_JSON_PATH = os.path.join(ROOT_DIR, 'src', 'services', 'db', 'authorityFoods.json')

def main():
    print(f"=== 正在載入既有 authorityFoods.json: {AUTH_JSON_PATH} ===")
    with open(AUTH_JSON_PATH, 'r', encoding='utf-8') as f:
        existing_foods = json.load(f)
    print(f"既有條目總數: {len(existing_foods)}")

    # 統計既有各權威分佈
    counts = {}
    seen_ids = set()
    for item in existing_foods:
        auth = item.get('dataSource', {}).get('authority', 'UNKNOWN')
        counts[auth] = counts.get(auth, 0) + 1
        seen_ids.add(item['id'])
    print("既有各機構統計:", counts)

    # 如果已經包含 AFCD 或 CoFID，先過濾掉舊的避免重複
    clean_existing = [x for x in existing_foods if x.get('dataSource', {}).get('authority') not in ('AFCD', 'CoFID')]
    if len(clean_existing) != len(existing_foods):
        print(f"已清理既有 AFCD/CoFID 條目: {len(existing_foods) - len(clean_existing)}")
    seen_ids = set(x['id'] for x in clean_existing)

    # 1. 解析 AFCD
    afcd_items = parse_afcd()
    # 2. 解析 CoFID
    cofid_items = parse_cofid()

    # 檢查 ID 衝突
    conflicts = 0
    new_items = []
    for item in afcd_items + cofid_items:
        if item['id'] in seen_ids:
            conflicts += 1
            print(f"[WARN] 發現重複 ID: {item['id']} ({item['dataSource']['authority']}:{item['dataSource']['sourceId']})")
        else:
            seen_ids.add(item['id'])
            new_items.append(item)

    print(f"新增無衝突條目: {len(new_items)} (跳過衝突 {conflicts})")

    # 依序合併
    final_foods = clean_existing + new_items
    print(f"合併後總條目數: {len(final_foods)}")

    # 統計最終機構分佈
    final_counts = {}
    for item in final_foods:
        auth = item.get('dataSource', {}).get('authority', 'UNKNOWN')
        final_counts[auth] = final_counts.get(auth, 0) + 1
    print("最終各機構條目分佈:", final_counts)

    # 寫入 authorityFoods.json
    print(f"正在寫入 {AUTH_JSON_PATH} ...")
    with open(AUTH_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(final_foods, f, ensure_ascii=False, indent=2)

    print("=== [DONE] authorityFoods.json 更新完成 ===")

if __name__ == '__main__':
    main()
