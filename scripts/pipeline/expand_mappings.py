import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')

# Load authority foods
with open('src/services/db/authorityFoods.json', 'r', encoding='utf-8') as f:
    authority_foods = json.load(f)

# Helper to find items by keyword in name or sourceName
def search_authority(kw, auth=None, limit=5):
    kw_lower = kw.lower()
    res = []
    for f in authority_foods:
        if auth and f.get('dataSource', {}).get('authority') != auth:
            continue
        name = f.get('name', '')
        sname = f.get('dataSource', {}).get('sourceName', '')
        if kw_lower in name.lower() or kw_lower in sname.lower():
            res.append(f)
            if len(res) >= limit:
                break
    return res

# Let's test search for some unmatched keys
test_keys = ['chicken_breast_raw', 'beef_top_blade', 'pork_fillet_tenderloin', 'grass_carp', 'black_tiger_prawn_raw', 'cuttlefish_raw']
for k in test_keys:
    print(f"\n--- Search for {k} ---")
    results = search_authority(k.split('_')[0], limit=3)
    for r in results:
        print(f"[{r['dataSource']['authority']}] {r['dataSource']['sourceId']}: {r['name']} (Cal: {r['calories']}, P: {r['protein']}, F: {r['fat']}, C: {r['carbs']})")

