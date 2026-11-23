import json
import re

def main():
    with open('scripts/pipeline/extracted_natural_foods.json', 'r', encoding='utf-8') as f:
        natural_foods = json.load(f)

    print("Keys and names of natural foods (first 50):")
    for f in natural_foods[:50]:
        print(f"{f['key']}: {f['name']}")

if __name__ == '__main__':
    main()
