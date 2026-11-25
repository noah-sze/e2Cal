import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/db/authorityFoods.json', () => ({
  default: [
    {
      id: 'usda-chicken-1',
      name: 'Chicken, broilers or fryers, breast, meat only, raw',
      calories: 120,
      carbs: 0,
      protein: 22.5,
      fat: 2.6,
      dataSource: {
        authority: 'USDA',
        sourceId: '05062',
        sourceName: 'Chicken, broilers or fryers, breast, meat only, raw',
        verifiedAt: '2026-11-23',
      },
    },
    {
      id: 'tfda-egg-1',
      name: '雞蛋',
      calories: 139,
      carbs: 1.6,
      protein: 12.6,
      fat: 9.2,
      dataSource: {
        authority: 'TFDA',
        sourceId: 'I0100101',
        sourceName: '雞蛋',
        verifiedAt: '2026-11-23',
      },
    },
    {
      id: 'usda-kfc-drumstick',
      name: 'KFC 原味炸雞小腿（僅肉，去皮去裹粉）',
      calories: 210,
      carbs: 5,
      protein: 24,
      fat: 10,
      dataSource: {
        authority: 'USDA',
        sourceId: '21281',
        sourceName: 'KFC, Fried Chicken, ORIGINAL RECIPE, Drumstick, meat only, skin and breading removed',
        verifiedAt: '2026-11-23',
      },
    },
    {
      id: 'usda-raw-leg',
      name: '肉雞全腿 (純肉，生)',
      calories: 120,
      carbs: 0,
      protein: 19.16,
      fat: 4.22,
      dataSource: {
        authority: 'USDA',
        sourceId: '171474',
        sourceName: 'Chicken, broilers or fryers, leg, meat only, raw',
        verifiedAt: '2026-11-23',
      },
    },
  ],
}));

vi.mock('@/services/db/authorityNames.zh-TW.json', () => ({
  default: {
    'usda-chicken-1': '雞胸肉（去皮去骨，生）',
  },
}));

vi.mock('@/services/db/authorityNames.en.json', () => ({
  default: {
    'tfda-egg-1': 'Chicken egg, whole, raw',
  },
}));

import {
  clearAuthorityFoodsCache,
  getAuthorityFoods,
  isRawOrWholeAuthorityFood,
  resolveAuthorityLocale,
  searchAuthorityFoods,
  searchAuthorityFoodsWithTotal,
  tokenizeFoodSearchQuery,
} from './authorityFoodService';

describe('authorityFoodService localization & bilingual search', () => {
  beforeEach(() => {
    clearAuthorityFoodsCache();
  });

  it('normalizes i18n language codes into supported authority locales', () => {
    expect(resolveAuthorityLocale('zh-TW')).toBe('zh-TW');
    expect(resolveAuthorityLocale('zh-Hant')).toBe('zh-TW');
    expect(resolveAuthorityLocale('zh-CN')).toBe('zh-CN');
    expect(resolveAuthorityLocale('zh-Hans-CN')).toBe('zh-CN');
    expect(resolveAuthorityLocale('en')).toBe('en');
    expect(resolveAuthorityLocale('en-US')).toBe('en');
  });

  it('applies localized display name while preserving original dataSource.sourceName', async () => {
    const zhFoods = await getAuthorityFoods('zh-TW');
    const chicken = zhFoods.find((f) => f.id === 'usda-chicken-1');
    const egg = zhFoods.find((f) => f.id === 'tfda-egg-1');

    expect(chicken?.name).toBe('雞胸肉（去皮去骨，生）');
    expect(chicken?.dataSource?.sourceName).toBe(
      'Chicken, broilers or fryers, breast, meat only, raw'
    );
    // 沒有對應譯名時回退原始名稱
    expect(egg?.name).toBe('雞蛋');
  });

  it('supports cross-language search hitting both translated name and original sourceName', async () => {
    const zhMatch = await searchAuthorityFoods('雞胸肉', 10, 'all', 'zh-TW');
    expect(zhMatch.map((f) => f.id)).toContain('usda-chicken-1');

    const origMatch = await searchAuthorityFoods('broilers', 10, 'all', 'zh-TW');
    expect(origMatch.map((f) => f.id)).toContain('usda-chicken-1');

    const enMatch = await searchAuthorityFoods('Chicken egg', 10, 'all', 'en');
    expect(enMatch.map((f) => f.id)).toContain('tfda-egg-1');
  });

  it('tokenizes multi-word and modifier-prefixed Chinese queries for AND matching', () => {
    expect(tokenizeFoodSearchQuery('去皮雞腿')).toEqual(['去皮', '雞腿']);
    expect(tokenizeFoodSearchQuery('去皮 雞腿 生')).toEqual(['去皮', '雞腿', '生']);
    expect(tokenizeFoodSearchQuery('chicken breast')).toEqual(['chicken', 'breast']);
  });

  it('matches skinless raw chicken leg entries when searching "去皮雞腿" and ranks raw items above fast food', async () => {
    const hits = await searchAuthorityFoods('去皮雞腿', 10, 'USDA', 'zh-TW');
    const ids = hits.map((f) => f.id);

    expect(ids).toContain('usda-raw-leg');
    expect(ids.indexOf('usda-raw-leg')).toBeLessThan(ids.indexOf('usda-kfc-drumstick'));
  });

  it('filters out cooked and fast-food items when rawOnly is true while preserving unmarked TFDA raw foods', async () => {
    const foods = await getAuthorityFoods('zh-TW');
    const egg = foods.find((f) => f.id === 'tfda-egg-1')!;
    const rawLeg = foods.find((f) => f.id === 'usda-raw-leg')!;
    const kfc = foods.find((f) => f.id === 'usda-kfc-drumstick')!;

    expect(isRawOrWholeAuthorityFood(egg)).toBe(true);
    expect(isRawOrWholeAuthorityFood(rawLeg)).toBe(true);
    expect(isRawOrWholeAuthorityFood(kfc)).toBe(false);

    const rawOnlyHits = await searchAuthorityFoods('去皮雞腿', 10, 'USDA', 'zh-TW', true);
    expect(rawOnlyHits.map((f) => f.id)).toEqual(['usda-raw-leg']);

    const limited = await searchAuthorityFoodsWithTotal('去皮雞腿', 1, 'USDA', 'zh-TW', false);
    expect(limited.items).toHaveLength(1);
    expect(limited.total).toBe(2);
  });
});
