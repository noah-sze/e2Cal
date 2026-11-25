import { db } from '@/services/db/db';
import type { FoodItem, AuthoritySource } from '@/types';
import { clearFoodsCache } from '@/hooks/useFoods';
import { matchesMultilingual } from '@/utils/multilingualSearch';

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

let cachedAuthorityFoods: FoodItem[] | null = null;
let loadingPromise: Promise<FoodItem[]> | null = null;

/**
 * 按需非同步載入 18,635 筆權威科研食材庫 (Code-Splitting，首屏 0 佔用)
 */
export async function getAuthorityFoods(): Promise<FoodItem[]> {
  if (cachedAuthorityFoods) {
    return cachedAuthorityFoods;
  }
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      const module = await import('@/services/db/authorityFoods.json');
      const rawList = (module.default || module) as AuthorityRawFood[];
      const now = Date.now();

      cachedAuthorityFoods = rawList.map((f) => ({
        id: f.id,
        name: f.name,
        category: 'natural',
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
        dataSource: f.dataSource,
        micros: f.micros,
        isCustom: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      }));
      return cachedAuthorityFoods;
    } catch (err) {
      console.error('[AuthorityFoodService] 載入權威食材庫失敗:', err);
      return [];
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/**
 * 在權威庫中進行多語模糊檢索 (支援繁中、簡中、英文)
 */
export async function searchAuthorityFoods(
  query: string,
  limit = 40,
  authorityFilter?: 'all' | AuthoritySource
): Promise<FoodItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const foods = await getAuthorityFoods();
  const lowerQuery = trimmed.toLowerCase();

  const results: FoodItem[] = [];

  for (const food of foods) {
    if (authorityFilter && authorityFilter !== 'all') {
      if (food.dataSource?.authority !== authorityFilter) {
        continue;
      }
    }

    // 1. 繁簡多語言搜尋命中
    const isMatched =
      food.name.toLowerCase().includes(lowerQuery) ||
      matchesMultilingual(trimmed, { id: food.id, name: food.name }, 'food');

    if (isMatched) {
      results.push(food);
      if (results.length >= limit) break;
    }
  }

  // 排序優化：名稱以關鍵字開頭的優先
  return results.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
    const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * 同步從記憶體快取查詢對應的權威科研原始條目（若尚未載入快取則回傳 undefined）
 */
export function getCachedAuthorityFood(
  id?: string,
  authority?: AuthoritySource,
  sourceId?: string
): FoodItem | undefined {
  if (!cachedAuthorityFoods) return undefined;
  return (
    (id ? cachedAuthorityFoods.find((f) => f.id === id) : undefined) ||
    (authority && sourceId
      ? cachedAuthorityFoods.find(
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
