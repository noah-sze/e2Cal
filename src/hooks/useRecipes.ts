import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/db/db';
import type { FoodRecipe, FoodItem } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateRecipeTotals, type RecipeTotals } from '@/utils/recipeMath';
import { getInMemoryFoodsCache, setInMemoryFoodsCache } from '@/hooks/useFoods';
import { createInMemoryCache } from './createInMemoryCache';

const EMPTY_RECIPES: FoodRecipe[] = [];
const EMPTY_FOODS: FoodItem[] = [];

const recipesCache = createInMemoryCache<FoodRecipe>(() => db.recipes.toArray());

export const getInMemoryRecipesCache = recipesCache.get;
export const setInMemoryRecipesCache = recipesCache.set;
export const clearRecipesCache = recipesCache.clear;
export const prewarmRecipesCache = recipesCache.prewarm;

export function useRecipes(searchQuery = '') {
  const allRecipesList = useLiveQuery(
    async () => {
      const result = await db.recipes.toArray();
      recipesCache.set(result);
      return result;
    },
    []
  );

  const allFoodsList = useLiveQuery(
    async () => {
      const result = await db.foods.toArray();
      setInMemoryFoodsCache(result);
      return result;
    },
    []
  );

  // 核心即時注水：若 useLiveQuery 仍在等待微任務/IPC 回調，直接同步採用記憶體快照
  const allRecipes = allRecipesList ?? recipesCache.get() ?? EMPTY_RECIPES;
  const allFoods = allFoodsList ?? getInMemoryFoodsCache() ?? EMPTY_FOODS;

  // 構建 foodMap 供純函數計算引用
  const foodMap = useMemo(() => {
    const map = new Map<string, FoodItem>();
    for (const f of allFoods) {
      map.set(f.id, f);
    }
    return map;
  }, [allFoods]);

  const {
    activeRecipes,
    archivedRecipes,
    customRecipes,
    presetRecipes,
    archivedCustomRecipes,
    archivedPresetRecipes,
  } = useMemo(() => {
    const active: FoodRecipe[] = [];
    const archived: FoodRecipe[] = [];
    const custom: FoodRecipe[] = [];
    const preset: FoodRecipe[] = [];
    const archivedCustom: FoodRecipe[] = [];
    const archivedPreset: FoodRecipe[] = [];

    for (const r of allRecipes) {
      if (r.isArchived) {
        archived.push(r);
        if (r.isCustom) archivedCustom.push(r);
        else archivedPreset.push(r);
      } else {
        active.push(r);
        if (r.isCustom) custom.push(r);
        else preset.push(r);
      }
    }

    return {
      activeRecipes: active,
      archivedRecipes: archived,
      customRecipes: custom,
      presetRecipes: preset,
      archivedCustomRecipes: archivedCustom,
      archivedPresetRecipes: archivedPreset,
    };
  }, [allRecipes]);

  const filteredActiveRecipes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeRecipes;
    return activeRecipes.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.ingredients.some((ing) => {
          const food = foodMap.get(ing.foodId);
          return food?.name.toLowerCase().includes(q);
        })
    );
  }, [activeRecipes, foodMap, searchQuery]);

  const addRecipe = async (
    data: Omit<FoodRecipe, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'> & {
      isCustom?: boolean;
    }
  ): Promise<FoodRecipe> => {
    const now = Date.now();
    const newRecipe: FoodRecipe = {
      ...data,
      id: uuidv4(),
      isCustom: data.isCustom ?? true,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.recipes.add(newRecipe);
    return newRecipe;
  };

  const updateRecipe = async (
    id: string,
    updates: Partial<Omit<FoodRecipe, 'id' | 'createdAt'>>
  ) => {
    await db.recipes.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  };

  const archiveRecipe = async (id: string) => {
    await db.recipes.update(id, {
      isArchived: true,
      updatedAt: Date.now(),
    });
  };

  const unarchiveRecipe = async (id: string) => {
    await db.recipes.update(id, {
      isArchived: false,
      updatedAt: Date.now(),
    });
  };

  const deleteRecipe = async (id: string): Promise<{ success: boolean }> => {
    await db.recipes.delete(id);
    return { success: true };
  };

  /**
   * 計算特定菜餚當前的精準總營養素
   */
  const getRecipeMacros = useCallback(
    (
      recipe: FoodRecipe,
      options?: { excludedIndices?: number[]; excludeAllOptional?: boolean }
    ): RecipeTotals => {
      return calculateRecipeTotals(recipe, foodMap, options);
    },
    [foodMap]
  );

  return {
    allRecipes,
    activeRecipes: filteredActiveRecipes,
    archivedRecipes,
    customRecipes,
    presetRecipes,
    archivedCustomRecipes,
    archivedPresetRecipes,
    isLoading: allRecipesList === undefined && recipesCache.get() === null,
    addRecipe,
    updateRecipe,
    archiveRecipe,
    unarchiveRecipe,
    deleteRecipe,
    getRecipeMacros,
    foodMap,
  };
}
