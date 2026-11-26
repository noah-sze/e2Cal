import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/db/db';
import type { FoodItem } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { createInMemoryCache } from './createInMemoryCache';

const EMPTY_FOODS: FoodItem[] = [];

const foodsCache = createInMemoryCache<FoodItem>(() => db.foods.toArray());

export const getInMemoryFoodsCache = foodsCache.get;
export const setInMemoryFoodsCache = foodsCache.set;
export const clearFoodsCache = foodsCache.clear;
export const prewarmFoodsCache = foodsCache.prewarm;

/**
 * 歸檔單品食材並於同一交易內從所有關聯食譜中剔除該食材引用
 * 歷史飲食日誌 (daily_diet_logs) 保持原貌不更動
 */
export async function archiveFoodAndCleanRecipes(
  id: string
): Promise<{ removedFromRecipeIds: string[] }> {
  const now = Date.now();
  const removedFromRecipeIds: string[] = [];

  await db.transaction('rw', [db.foods, db.recipes], async () => {
    await db.foods.update(id, {
      isArchived: true,
      updatedAt: now,
    });

    const affectedRecipes = await db.recipes
      .filter((r) => r.ingredients.some((ing) => ing.foodId === id))
      .toArray();

    for (const recipe of affectedRecipes) {
      const nextIngredients = recipe.ingredients.filter((ing) => ing.foodId !== id);
      await db.recipes.update(recipe.id, {
        ingredients: nextIngredients,
        updatedAt: now,
      });
      removedFromRecipeIds.push(recipe.id);
    }
  });

  return { removedFromRecipeIds };
}

export function useFoods(searchQuery = '') {
  const allFoodsList = useLiveQuery(
    async () => {
      const result = await db.foods.toArray();
      foodsCache.set(result);
      return result;
    },
    []
  );

  // 核心即時注水：若 useLiveQuery 仍在等待微任務/IPC 回調，直接同步採用記憶體快照
  const allFoods = allFoodsList ?? foodsCache.get() ?? EMPTY_FOODS;

  const {
    activeFoods,
    archivedFoods,
    customFoods,
    presetFoods,
    archivedCustomFoods,
    archivedPresetFoods,
  } = useMemo(() => {
    const active: FoodItem[] = [];
    const archived: FoodItem[] = [];
    const custom: FoodItem[] = [];
    const preset: FoodItem[] = [];
    const archivedCustom: FoodItem[] = [];
    const archivedPreset: FoodItem[] = [];

    for (const item of allFoods) {
      if (item.isArchived) {
        archived.push(item);
        if (item.isCustom) archivedCustom.push(item);
        else archivedPreset.push(item);
      } else {
        active.push(item);
        if (item.isCustom) custom.push(item);
        else preset.push(item);
      }
    }

    return {
      activeFoods: active,
      archivedFoods: archived,
      customFoods: custom,
      presetFoods: preset,
      archivedCustomFoods: archivedCustom,
      archivedPresetFoods: archivedPreset,
    };
  }, [allFoods]);

  // 支援搜尋關鍵字過濾之可用食物清單
  const filteredActiveFoods = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeFoods;
    return activeFoods.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        Boolean(item.brand && item.brand.toLowerCase().includes(q))
    );
  }, [activeFoods, searchQuery]);

  const addFood = async (
    data: Omit<FoodItem, 'id' | 'createdAt' | 'updatedAt' | 'isCustom' | 'isArchived'> & {
      isCustom?: boolean;
    }
  ): Promise<FoodItem> => {
    const now = Date.now();
    const newFood: FoodItem = {
      ...data,
      id: uuidv4(),
      isCustom: data.isCustom ?? true,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.foods.add(newFood);
    return newFood;
  };

  const updateFood = async (
    id: string,
    updates: Partial<Omit<FoodItem, 'id' | 'createdAt'>>
  ) => {
    await db.foods.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  };

  const archiveFood = async (id: string) => {
    return archiveFoodAndCleanRecipes(id);
  };

  const unarchiveFood = async (id: string) => {
    await db.foods.update(id, {
      isArchived: false,
      updatedAt: Date.now(),
    });
  };

  const deleteFood = async (
    id: string
  ): Promise<{ success: boolean; reason?: 'has_logs' | 'has_recipes' | 'not_found' }> => {
    const food = await db.foods.get(id);
    if (!food) {
      return { success: false, reason: 'not_found' };
    }

    // 檢查是否有關聯之飲食記錄（嚴格純 ID 關聯）
    const hasLogs = await db.daily_diet_logs
      .filter((daily) => daily.entries.some((entry) => entry.foodId === id))
      .count();

    if (hasLogs > 0) {
      return { success: false, reason: 'has_logs' };
    }

    // 檢查是否有關聯之菜餚組合（嚴格純 ID 關聯）
    const hasRecipes = await db.recipes
      .filter((r) => r.ingredients.some((ing) => ing.foodId === id))
      .count();

    if (hasRecipes > 0) {
      return { success: false, reason: 'has_recipes' };
    }

    await db.foods.delete(id);
    return { success: true };
  };

  return {
    foods: filteredActiveFoods,
    allFoods,
    activeFoods,
    archivedFoods,
    customFoods,
    presetFoods,
    archivedCustomFoods,
    archivedPresetFoods,
    isLoading: allFoodsList === undefined && foodsCache.get() === null,
    addFood,
    updateFood,
    archiveFood,
    unarchiveFood,
    deleteFood,
  };
}

