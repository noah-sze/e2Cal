import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/db/db';
import type { DailyDietLog } from '@/types';

let inMemoryRecentFoodIds: string[] | null = null;
let inMemoryRecentRecipeIds: string[] | null = null;
let inMemoryFoodLastUsedMap: Map<string, number> | null = null;
let inMemoryRecipeLastUsedMap: Map<string, number> | null = null;

/**
 * 清空最近使用食材與食譜的記憶體快取
 */
export function clearRecentFoodsCache(): void {
  inMemoryRecentFoodIds = null;
  inMemoryRecentRecipeIds = null;
  inMemoryFoodLastUsedMap = null;
  inMemoryRecipeLastUsedMap = null;
}

/**
 * 從歷史飲食日誌中提取去重、按最後使用時間倒序排列的食材與食譜 ID 列表及最後使用時間映射 (Pure Function)
 */
export function extractRecentFoodAndRecipeIds(dailyLogs: DailyDietLog[]): {
  recentFoodIds: string[];
  recentRecipeIds: string[];
  foodLastUsedMap: Map<string, number>;
  recipeLastUsedMap: Map<string, number>;
} {
  const foodLastUsedMap = new Map<string, number>();
  const recipeLastUsedMap = new Map<string, number>();

  for (const dayLog of dailyLogs) {
    const entries = dayLog.entries || [];
    for (const entry of entries) {
      const time =
        Math.max(entry.createdAt || 0, entry.updatedAt || 0) ||
        new Date(dayLog.date).getTime() ||
        0;

      if (entry.bundleId) {
        const existing = recipeLastUsedMap.get(entry.bundleId) || 0;
        if (time > existing) {
          recipeLastUsedMap.set(entry.bundleId, time);
        }
      }

      if (entry.foodId) {
        const existing = foodLastUsedMap.get(entry.foodId) || 0;
        if (time > existing) {
          foodLastUsedMap.set(entry.foodId, time);
        }
      }
    }
  }

  const recentFoodIds = Array.from(foodLastUsedMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const recentRecipeIds = Array.from(recipeLastUsedMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  return { recentFoodIds, recentRecipeIds, foodLastUsedMap, recipeLastUsedMap };
}

const EMPTY_LAST_USED_MAP = new Map<string, number>();

/**
 * 樂觀同步更新記憶體中的最近使用時間映射（於選擇彈窗關閉期間靜默完成排序，避免下次開啟時才重排閃跳）
 */
export function touchRecentFood(foodId: string): void {
  const now = Date.now();
  const nextMap = new Map(inMemoryFoodLastUsedMap ?? EMPTY_LAST_USED_MAP);
  nextMap.set(foodId, now);
  inMemoryFoodLastUsedMap = nextMap;

  const prevIds = inMemoryRecentFoodIds ?? [];
  inMemoryRecentFoodIds = [foodId, ...prevIds.filter((id) => id !== foodId)];
}

/**
 * 樂觀同步更新記憶體中的最近食譜使用時間映射
 */
export function touchRecentRecipe(recipeId: string): void {
  const now = Date.now();
  const nextMap = new Map(inMemoryRecipeLastUsedMap ?? EMPTY_LAST_USED_MAP);
  nextMap.set(recipeId, now);
  inMemoryRecipeLastUsedMap = nextMap;

  const prevIds = inMemoryRecentRecipeIds ?? [];
  inMemoryRecentRecipeIds = [recipeId, ...prevIds.filter((id) => id !== recipeId)];
}

interface RecentFoodsSnapshot {
  recentFoodIds: string[];
  recentRecipeIds: string[];
  foodLastUsedMap: Map<string, number>;
  recipeLastUsedMap: Map<string, number>;
}

export function useRecentFoods(freezeSort = false) {
  const result = useLiveQuery(
    async () => {
      if (typeof indexedDB === 'undefined') {
        return {
          recentFoodIds: [],
          recentRecipeIds: [],
          foodLastUsedMap: new Map<string, number>(),
          recipeLastUsedMap: new Map<string, number>(),
        };
      }

      // 倒序獲取最近 60 個有記錄的日誌
      const dailyLogs = await db.daily_diet_logs.orderBy('date').reverse().limit(60).toArray();
      const extracted = extractRecentFoodAndRecipeIds(dailyLogs);

      inMemoryRecentFoodIds = extracted.recentFoodIds;
      inMemoryRecentRecipeIds = extracted.recentRecipeIds;
      inMemoryFoodLastUsedMap = extracted.foodLastUsedMap;
      inMemoryRecipeLastUsedMap = extracted.recipeLastUsedMap;

      return extracted;
    },
    []
  );

  // 關閉或背景時優先使用已同步更新之 inMemory 快取或最新查詢結果
  const liveFoodLastUsedMap = result?.foodLastUsedMap ?? inMemoryFoodLastUsedMap ?? EMPTY_LAST_USED_MAP;
  const liveRecipeLastUsedMap = result?.recipeLastUsedMap ?? inMemoryRecipeLastUsedMap ?? EMPTY_LAST_USED_MAP;
  const liveRecentFoodIds = result?.recentFoodIds ?? inMemoryRecentFoodIds ?? [];
  const liveRecentRecipeIds = result?.recentRecipeIds ?? inMemoryRecentRecipeIds ?? [];

  // 彈窗開啟瞬間鎖定快照，開啟期間完全凍結順序，防止選取或背景同步導致當場重排跳動
  const [prevFreeze, setPrevFreeze] = useState(freezeSort);
  const [frozenSnapshot, setFrozenSnapshot] = useState<RecentFoodsSnapshot | null>(() =>
    freezeSort
      ? {
          recentFoodIds: liveRecentFoodIds,
          recentRecipeIds: liveRecentRecipeIds,
          foodLastUsedMap: liveFoodLastUsedMap,
          recipeLastUsedMap: liveRecipeLastUsedMap,
        }
      : null
  );

  if (freezeSort !== prevFreeze) {
    setPrevFreeze(freezeSort);
    if (freezeSort) {
      // 開啟時優先採用最新的記憶體快取（可能剛被 touchRecent* 樂觀更新）
      setFrozenSnapshot({
        recentFoodIds: inMemoryRecentFoodIds ?? liveRecentFoodIds,
        recentRecipeIds: inMemoryRecentRecipeIds ?? liveRecentRecipeIds,
        foodLastUsedMap: inMemoryFoodLastUsedMap ?? liveFoodLastUsedMap,
        recipeLastUsedMap: inMemoryRecipeLastUsedMap ?? liveRecipeLastUsedMap,
      });
    } else {
      setFrozenSnapshot(null);
    }
  }

  const active = freezeSort && frozenSnapshot ? frozenSnapshot : null;

  return {
    recentFoodIds: active ? active.recentFoodIds : liveRecentFoodIds,
    recentRecipeIds: active ? active.recentRecipeIds : liveRecentRecipeIds,
    foodLastUsedMap: active ? active.foodLastUsedMap : liveFoodLastUsedMap,
    recipeLastUsedMap: active ? active.recipeLastUsedMap : liveRecipeLastUsedMap,
    isLoading: result === undefined && inMemoryRecentFoodIds === null,
  };
}

// 模組載入時主動發起一次非同步預熱，在使用者點擊開啟彈窗前完成內存常駐
if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
  db.daily_diet_logs.orderBy('date').reverse().limit(60).toArray()
    .then((dailyLogs) => {
      const extracted = extractRecentFoodAndRecipeIds(dailyLogs);
      inMemoryRecentFoodIds = extracted.recentFoodIds;
      inMemoryRecentRecipeIds = extracted.recentRecipeIds;
      inMemoryFoodLastUsedMap = extracted.foodLastUsedMap;
      inMemoryRecipeLastUsedMap = extracted.recipeLastUsedMap;
    })
    .catch(() => {});
}
