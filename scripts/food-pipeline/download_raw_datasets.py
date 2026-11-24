import os
import urllib.request
import time

RAW_DIR = os.path.join(os.path.dirname(__file__), 'raw')
os.makedirs(RAW_DIR, exist_ok=True)

URLS = {
    'afcd_foods.xlsx': 'https://www.foodstandards.gov.au/sites/default/files/2025-12/AFCD%20Release%203%20-%20Food%20Details.xlsx',
    'afcd_nutrients.xlsx': 'https://www.foodstandards.gov.au/sites/default/files/2025-12/AFCD%20Release%203%20-%20Nutrient%20profiles.xlsx',
    'cofid_2021.xlsx': 'https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx'
}

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def download_file(filename, url):
    dest = os.path.join(RAW_DIR, filename)
    if os.path.exists(dest) and os.path.getsize(dest) > 10000:
        print(f"[SKIP] {filename} 已存在 ({os.path.getsize(dest)} bytes)")
        return
    print(f"[DOWNLOAD] 下載中: {filename} from {url} ...")
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp, open(dest, 'wb') as f:
        data = resp.read()
        f.write(data)
    print(f"[DONE] {filename} 下載完成 ({len(data)} bytes)")

if __name__ == '__main__':
    for name, url in URLS.items():
        download_file(name, url)
        time.sleep(1)
