import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')

with open('src/services/db/authorityFoods.json', 'r', encoding='utf-8') as f:
    authority_foods = json.load(f)

with open('scripts/pipeline/extracted_natural_foods.json', 'r', encoding='utf-8') as f:
    natural_foods = json.load(f)

# Divide authority foods by source
usda_foods = [f for f in authority_foods if f.get('dataSource', {}).get('authority') == 'USDA']
tfda_foods = [f for f in authority_foods if f.get('dataSource', {}).get('authority') == 'TFDA']
cfct_foods = [f for f in authority_foods if f.get('dataSource', {}).get('authority') == 'CFCT']

print(f"Authority: USDA {len(usda_foods)}, TFDA {len(tfda_foods)}, CFCT {len(cfct_foods)}")
print(f"Natural foods to upgrade: {len(natural_foods)}")

# Helper to score candidate
def score_candidate(nf, cand):
    # cand: authority food
    c_name = cand['name'].lower()
    c_sname = cand.get('dataSource', {}).get('sourceName', '').lower()
    
    nf_name = nf['name'].lower()
    nf_key = nf['key'].replace('_', ' ').lower()
    
    score = 0
    
    # 1. Name matching
    if nf_name in c_name or nf_name in c_sname:
        score += 50
        if nf_name == c_name:
            score += 30
    
    # 2. English key matching
    key_words = [w for w in nf_key.split() if w not in ('raw', 'meat', 'fresh', 'dry', 'kernels', 'fillet')]
    matched_words = sum(1 for w in key_words if w in c_name or w in c_sname)
    if key_words:
        score += (matched_words / len(key_words)) * 40

    # 3. Nutrient closeness (penalize if macros are too different)
    cal_diff = abs(cand['calories'] - nf['calories'])
    prot_diff = abs(cand['protein'] - nf['protein'])
    fat_diff = abs(cand['fat'] - nf['fat'])
    carb_diff = abs(cand['carbs'] - nf['carbs'])

    # If calories diff is huge (> 100), penalize heavily
    if cal_diff > 120:
        score -= 50
    elif cal_diff < 20:
        score += 20
        
    if prot_diff < 3:
        score += 15
    elif prot_diff > 15:
        score -= 30
        
    if fat_diff < 3:
        score += 15
    elif fat_diff > 15:
        score -= 30

    if carb_diff < 3:
        score += 15
    elif carb_diff > 15:
        score -= 30

    # 4. Source priority (USDA P1 > CFCT P2 > TFDA P3, unless Asian specific)
    auth = cand.get('dataSource', {}).get('authority')
    if auth == 'USDA':
        score += 10
    elif auth == 'TFDA':
        score += 5
    elif auth == 'CFCT':
        score += 5

    return score

# Match each food
matches = []
unmatched = []

for nf in natural_foods:
    best_cand = None
    best_score = -999
    
    # We test USDA, TFDA, and CFCT candidates that share at least one keyword
    key_words = [w for w in nf['key'].replace('_', ' ').split() if w not in ('raw', 'meat', 'fresh', 'dry', 'kernels', 'fillet')]
    
    # Filter search pool to speed up
    pool = []
    # 1. Matching by Chinese name substring in TFDA/CFCT
    for cand in tfda_foods + cfct_foods:
        if nf['name'] in cand['name'] or cand['name'] in nf['name']:
            pool.append(cand)
            
    # 2. Matching by key words in USDA
    for cand in usda_foods:
        c_name = cand['name'].lower()
        if any(w in c_name for w in key_words if len(w) > 3):
            pool.append(cand)

    for cand in pool:
        s = score_candidate(nf, cand)
        if s > best_score:
            best_score = s
            best_cand = cand

    if best_cand and best_score >= 45:
        matches.append({
            'natural': nf,
            'authority': best_cand,
            'score': best_score,
        })
    else:
        unmatched.append((nf, best_cand, best_score))

print(f"Scored matches >= 45: {len(matches)}/{len(natural_foods)}")
print(f"Unmatched count: {len(unmatched)}")
if unmatched:
    print("\nSample low score unmatched:")
    for nf, cand, score in unmatched[:20]:
        cname = cand['name'] if cand else 'None'
        print(f" - {nf['key']} ({nf['name']}) -> best: {cname} (score: {score})")
