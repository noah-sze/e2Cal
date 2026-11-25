import i18n from '@/i18n/config';
import { db } from '@/services/db/db';
import type { FoodItem, AuthoritySource } from '@/types';
import { clearFoodsCache } from '@/hooks/useFoods';
import { matchesMultilingual } from '@/utils/multilingualSearch';

export type AuthorityLocale = 'zh-TW' | 'zh-CN' | 'en';

export interface AuthorityRawFood {
  id: string;
  name: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
  transFat?: number;
  sodium?: number;
  refuseRate?: number;
  edibleRate?: number;
  dataSource: FoodItem['dataSource'];
  micros?: FoodItem['micros'];
}

const cachedFoodsByLocale: Partial<Record<AuthorityLocale, FoodItem[]>> = {};
const loadingPromises: Partial<Record<AuthorityLocale, Promise<FoodItem[]>>> = {};
let lastActiveLocale: AuthorityLocale = 'zh-TW';

/**
 * 將 i18n 語言代碼正規化為權威庫翻譯字典支援語系
 */
export function resolveAuthorityLocale(lang?: string): AuthorityLocale {
  const normalized = (lang || i18n.language || 'zh-TW').toLowerCase();
  if (normalized.startsWith('zh-cn') || normalized.startsWith('zh-hans')) {
    return 'zh-CN';
  }
  if (normalized.startsWith('en')) {
    return 'en';
  }
  return 'zh-TW';
}

async function loadAuthorityNamesMap(locale: AuthorityLocale): Promise<Record<string, string>> {
  try {
    if (locale === 'zh-CN') {
      const mod = await import('@/services/db/authorityNames.zh-CN.json');
      return (mod.default || mod) as Record<string, string>;
    }
    if (locale === 'en') {
      const mod = await import('@/services/db/authorityNames.en.json');
      return (mod.default || mod) as Record<string, string>;
    }
    const mod = await import('@/services/db/authorityNames.zh-TW.json');
    return (mod.default || mod) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * 清除權威庫記憶體快取（主要供單元測試或語系重載使用）
 */
export function clearAuthorityFoodsCache(): void {
  delete cachedFoodsByLocale['zh-TW'];
  delete cachedFoodsByLocale['zh-CN'];
  delete cachedFoodsByLocale.en;
  cachedAuthorityStats = null;
}

/**
 * 按需非同步載入 18,635 筆權威科研食材庫與對應語系翻譯字典 (Code-Splitting，首屏 0 佔用)
 */
export async function getAuthorityFoods(lang?: string): Promise<FoodItem[]> {
  const locale = resolveAuthorityLocale(lang);
  lastActiveLocale = locale;

  const cached = cachedFoodsByLocale[locale];
  if (cached) {
    return cached;
  }
  const pending = loadingPromises[locale];
  if (pending) {
    return pending;
  }

  const promise = (async () => {
    try {
      const [module, nameMap] = await Promise.all([
        import('@/services/db/authorityFoods.json'),
        loadAuthorityNamesMap(locale),
      ]);
      const rawList = (module.default || module) as AuthorityRawFood[];
      const now = Date.now();

      const mapped = rawList.map((f) => {
        const translated = nameMap[f.id]?.trim();
        const displayName = translated || f.name;
        const sourceName = f.dataSource?.sourceName || f.name;

        return {
          id: f.id,
          name: displayName,
          category: 'natural' as const,
          servingSize: 100,
          servingUnit: 'g',
          calories: f.calories,
          carbs: f.carbs,
          protein: f.protein,
          fat: f.fat,
          fiber: f.fiber ?? 0,
          sugar: f.sugar ?? 0,
          saturatedFat: f.saturatedFat ?? 0,
          transFat: f.transFat ?? 0,
          sodium: f.sodium ?? 0,
          refuseRate: f.refuseRate ?? 0,
          edibleRate: f.edibleRate ?? 1.0,
          dataSource: f.dataSource
            ? {
                ...f.dataSource,
                sourceName,
              }
            : undefined,
          micros: f.micros,
          isCustom: false,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        };
      });

      cachedFoodsByLocale[locale] = mapped;
      return mapped;
    } catch (err) {
      console.error('[AuthorityFoodService] 載入權威食材庫失敗:', err);
      return [];
    } finally {
      delete loadingPromises[locale];
    }
  })();

  loadingPromises[locale] = promise;
  return promise;
}

const CHINESE_FOOD_MODIFIERS = [
  '去皮',
  '去骨',
  '帶皮',
  '帶骨',
  '无骨',
  '無骨',
  '带皮',
  '带骨',
  '水煮',
  '清蒸',
  '油炸',
  '煎烤',
  '碳烤',
  '紅燒',
  '红烧',
  '滷',
  '卤',
  '烤',
  '燉',
  '炖',
  '煮',
  '炒',
  '蒸',
  '生',
  '熟',
];

/**
 * 將食物搜尋字串拆分為 AND 匹配的詞元（支援空白分隔與常見中文處理/烹調修飾詞前綴/後綴）
 */
export function tokenizeFoodSearchQuery(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const spaceTokens = trimmed.split(/\s+/).filter(Boolean);
  if (spaceTokens.length > 1) {
    return Array.from(new Set(spaceTokens));
  }

  const single = spaceTokens[0];
  // 僅針對較長的中文連寫詞做修飾詞拆解（如「去皮雞腿」-> ['去皮', '雞腿']）
  if (/[\u4e00-\u9fff]/.test(single) && single.length >= 3) {
    const tokens: string[] = [];
    let rest = single;
    let changed = true;
    while (changed && rest.length >= 2) {
      changed = false;
      for (const mod of CHINESE_FOOD_MODIFIERS) {
        if (rest.startsWith(mod) && rest.length > mod.length) {
          tokens.push(mod);
          rest = rest.slice(mod.length);
          changed = true;
          break;
        }
        if (rest.endsWith(mod) && rest.length > mod.length) {
          tokens.push(mod);
          rest = rest.slice(0, rest.length - mod.length);
          changed = true;
          break;
        }
      }
    }
    if (tokens.length > 0 && rest) {
      tokens.push(rest);
      return Array.from(new Set(tokens));
    }
  }

  return [single];
}

function matchesSingleToken(token: string, food: FoodItem, sourceName: string): boolean {
  const lowerToken = token.toLowerCase();
  if (food.name.toLowerCase().includes(lowerToken)) return true;
  if (sourceName && sourceName !== food.name && sourceName.toLowerCase().includes(lowerToken)) {
    return true;
  }
  if (matchesMultilingual(token, { id: food.id, name: food.name }, 'food')) return true;
  if (
    sourceName &&
    sourceName !== food.name &&
    matchesMultilingual(token, { id: food.id, name: sourceName }, 'food')
  ) {
    return true;
  }
  return false;
}

function scoreAuthorityFoodMatch(
  rawQuery: string,
  tokens: string[],
  food: FoodItem,
  sourceName: string
): number {
  const lowerQuery = rawQuery.toLowerCase();
  const lowerName = food.name.toLowerCase();
  const lowerSrc = sourceName.toLowerCase();

  let score = 0;

  if (lowerName === lowerQuery) score += 200;
  else if (lowerName.startsWith(lowerQuery)) score += 120;
  else if (lowerName.includes(lowerQuery)) score += 80;

  if (lowerSrc && lowerSrc !== lowerName) {
    if (lowerSrc.startsWith(lowerQuery)) score += 60;
    else if (lowerSrc.includes(lowerQuery)) score += 40;
  }

  if (tokens.every((tk) => lowerName.includes(tk.toLowerCase()))) {
    score += 30;
  }

  // 原型生重食材優先於速食/調味加工品
  const isRaw =
    lowerName.includes('生') || lowerSrc.includes(', raw') || lowerSrc.endsWith(' raw');
  const isFastFood = /^(kfc|popeyes|fast foods|mcdonald|burger king)/i.test(lowerSrc);
  if (isRaw) score += 12;
  if (isFastFood) score -= 20;

  return score;
}

const COOKED_OR_PROCESSED_EN_REGEX =
  /\b(cooked|roasted|grilled|broiled|baked|fried|deep-fried|pan-fried|stir-fried|boiled|steamed|stewed|braised|simmered|poached|microwaved|reheated|toasted|smoked|canned|pickled|rotisserie|breaded)\b/i;

const FAST_FOOD_OR_PROCESSED_SRC_REGEX =
  /^(kfc|popeyes|mcdonald|burger king|wendy|taco bell|subway|pizza hut|domino|fast foods|restaurant|babyfood|snacks|candies|beverages|cereals ready-to-eat)/i;

const COOKED_OR_PROCESSED_CJK_REGEX =
  /(水煮|清蒸|油炸|煎烤|碳烤|紅燒|红烧|煮熟|罐頭|罐头|微波|覆熱|复热|煙燻|烟熏|ゆで|焼き|蒸し|揚げ|炒め|くん製|[（(,，、\s]熟[）),，、\s]|^熟)/;

/**
 * 判斷權威庫條目是否為「生重／原型食材」（採負向排除法，避免漏掉預設不標「生」字的 TFDA / CFCT 生鮮條目）
 */
export function isRawOrWholeAuthorityFood(food: FoodItem): boolean {
  const name = food.name || '';
  const sourceName = food.dataSource?.sourceName || '';

  if (COOKED_OR_PROCESSED_EN_REGEX.test(sourceName) || COOKED_OR_PROCESSED_EN_REGEX.test(name)) {
    return false;
  }
  if (FAST_FOOD_OR_PROCESSED_SRC_REGEX.test(sourceName)) {
    return false;
  }
  if (COOKED_OR_PROCESSED_CJK_REGEX.test(name) || COOKED_OR_PROCESSED_CJK_REGEX.test(sourceName)) {
    return false;
  }
  return true;
}

/**
 * 在權威庫中進行多語模糊檢索，同時回傳截斷後清單與真實總命中數
 */
export async function searchAuthorityFoodsWithTotal(
  query: string,
  limit = 40,
  authorityFilter?: 'all' | AuthoritySource,
  lang?: string,
  rawOnly = false
): Promise<{ items: FoodItem[]; total: number }> {
  const trimmed = query.trim();
  if (!trimmed) return { items: [], total: 0 };

  const foods = await getAuthorityFoods(lang);
  const tokens = tokenizeFoodSearchQuery(trimmed);

  const scored: { food: FoodItem; score: number }[] = [];

  for (const food of foods) {
    if (authorityFilter && authorityFilter !== 'all') {
      if (food.dataSource?.authority !== authorityFilter) {
        continue;
      }
    }

    if (rawOnly && !isRawOrWholeAuthorityFood(food)) {
      continue;
    }

    const sourceName = food.dataSource?.sourceName || '';
    const isMatched =
      tokens.length > 1
        ? tokens.every((tk) => matchesSingleToken(tk, food, sourceName))
        : matchesSingleToken(trimmed, food, sourceName);

    if (isMatched) {
      scored.push({
        food,
        score: scoreAuthorityFoodMatch(trimmed, tokens, food, sourceName),
      });
    }
  }

  const sorted = scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.food.name.length !== b.food.name.length) {
      return a.food.name.length - b.food.name.length;
    }
    return a.food.name.localeCompare(b.food.name);
  });

  return {
    items: sorted.slice(0, limit).map((item) => item.food),
    total: sorted.length,
  };
}

/**
 * 在權威庫中進行多語模糊檢索 (支援繁中、簡中、英文譯名與原文雙向穿透、多詞拆詞 AND 匹配與相關度排序)
 */
export async function searchAuthorityFoods(
  query: string,
  limit = 40,
  authorityFilter?: 'all' | AuthoritySource,
  lang?: string,
  rawOnly = false
): Promise<FoodItem[]> {
  const { items } = await searchAuthorityFoodsWithTotal(
    query,
    limit,
    authorityFilter,
    lang,
    rawOnly
  );
  return items;
}

export interface AuthorityStats {
  total: number;
  byAuthority: Record<AuthoritySource, number>;
}

let cachedAuthorityStats: AuthorityStats | null = null;

/**
 * 統計並快取六大權威科研庫的實際條目數量分佈
 */
export async function getAuthorityStats(): Promise<AuthorityStats> {
  if (cachedAuthorityStats) {
    return cachedAuthorityStats;
  }

  const foods = await getAuthorityFoods();
  const byAuthority: Record<AuthoritySource, number> = {
    USDA: 0,
    TFDA: 0,
    CFCT: 0,
    MEXT: 0,
    AFCD: 0,
    CoFID: 0,
  };

  for (const f of foods) {
    const auth = f.dataSource?.authority;
    if (auth && auth in byAuthority) {
      byAuthority[auth as AuthoritySource] += 1;
    }
  }

  cachedAuthorityStats = {
    total: foods.length,
    byAuthority,
  };

  return cachedAuthorityStats;
}

/**
 * 同步從記憶體快取查詢對應的權威科研原始條目（若尚未載入快取則回傳 undefined）
 */
export function getCachedAuthorityFood(
  id?: string,
  authority?: AuthoritySource,
  sourceId?: string
): FoodItem | undefined {
  const locale = resolveAuthorityLocale();
  const list = cachedFoodsByLocale[locale] ?? cachedFoodsByLocale[lastActiveLocale];
  if (!list) return undefined;
  return (
    (id ? list.find((f) => f.id === id) : undefined) ||
    (authority && sourceId
      ? list.find(
          (f) => f.dataSource?.authority === authority && f.dataSource?.sourceId === sourceId
        )
      : undefined)
  );
}

/**
 * 非同步查詢對應的權威科研原始條目（會按需載入權威庫並永久快取）
 */
export async function findAuthorityFood(
  id?: string,
  authority?: AuthoritySource,
  sourceId?: string
): Promise<FoodItem | undefined> {
  const foods = await getAuthorityFoods();
  return (
    (id ? foods.find((f) => f.id === id) : undefined) ||
    (authority && sourceId
      ? foods.find(
          (f) => f.dataSource?.authority === authority && f.dataSource?.sourceId === sourceId
        )
      : undefined)
  );
}

/**
 * 將選中的權威食材單筆寫入本機 IndexedDB (foods 表)，立即在庫存中可用
 */
export async function importAuthorityFoodToDatabase(food: FoodItem): Promise<FoodItem> {
  const existing = await db.foods.get(food.id);
  if (existing) {
    return existing;
  }

  const now = Date.now();
  const importedFood: FoodItem = {
    ...food,
    createdAt: now,
    updatedAt: now,
  };

  await db.foods.put(importedFood);
  clearFoodsCache();
  return importedFood;
}
