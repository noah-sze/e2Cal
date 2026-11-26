import type { FoodItem, RecipeIngredient } from '@/types';

export interface NutrientBreakdown {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  fiber?: number;
  saturatedFat?: number;
  transFat?: number;
  sodium?: number;
}

export interface RecipeTotals extends NutrientBreakdown {
  totalWeightGrams: number;
  ingredientCount: number;
}

/**
 * 依據食材份量與基礎營養素，精準推算單項食材的熱量與三大營養素
 * 純函數無副作用，處理異常與邊界輸入
 */
export function calculateIngredientMacros(
  food: Pick<FoodItem, 'macros'> | undefined | null,
  quantity: number
): NutrientBreakdown {
  if (
    !food ||
    !food.macros ||
    typeof quantity !== 'number' ||
    isNaN(quantity) ||
    quantity <= 0
  ) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  const ratio = quantity / 100;
  const m = food.macros;
  const safeCalories = typeof m.calories === 'number' && !isNaN(m.calories) ? m.calories : 0;
  const safeProtein = typeof m.protein === 'number' && !isNaN(m.protein) ? m.protein : 0;
  const safeCarbs = typeof m.carbs?.total === 'number' && !isNaN(m.carbs.total) ? m.carbs.total : 0;
  const safeFat = typeof m.fat?.total === 'number' && !isNaN(m.fat.total) ? m.fat.total : 0;
  const safeSugar = typeof m.carbs?.sugar === 'number' && !isNaN(m.carbs.sugar) ? m.carbs.sugar : undefined;
  const safeFiber = typeof m.carbs?.fiber === 'number' && !isNaN(m.carbs.fiber) ? m.carbs.fiber : undefined;
  const safeSatFat = typeof m.fat?.saturated === 'number' && !isNaN(m.fat.saturated) ? m.fat.saturated : undefined;
  const safeTransFat = typeof m.fat?.trans === 'number' && !isNaN(m.fat.trans) ? m.fat.trans : undefined;
  const safeSodium = typeof m.sodium === 'number' && !isNaN(m.sodium) ? m.sodium : undefined;

  return {
    calories: Math.round(safeCalories * ratio),
    protein: Math.round(safeProtein * ratio * 10) / 10,
    carbs: Math.round(safeCarbs * ratio * 10) / 10,
    fat: Math.round(safeFat * ratio * 10) / 10,
    ...(typeof safeSugar === 'number' ? { sugar: Math.round(safeSugar * ratio * 10) / 10 } : {}),
    ...(typeof safeFiber === 'number' ? { fiber: Math.round(safeFiber * ratio * 10) / 10 } : {}),
    ...(typeof safeSatFat === 'number' ? { saturatedFat: Math.round(safeSatFat * ratio * 10) / 10 } : {}),
    ...(typeof safeTransFat === 'number' ? { transFat: Math.round(safeTransFat * ratio * 10) / 10 } : {}),
    ...(typeof safeSodium === 'number' ? { sodium: Math.round(safeSodium * ratio) } : {}),
  };
}

/**
 * 依據菜餚組合的食材清單，動態加權求和計算總營養素與重量
 * 支援透過 excludedIndices 排除特定項（例如取消勾選可選油脂或調味）
 */
export function calculateRecipeTotals(
  recipe: { ingredients: RecipeIngredient[] },
  foodMap: Record<string, FoodItem> | Map<string, FoodItem>,
  options?: {
    excludedIndices?: number[];
    excludeAllOptional?: boolean;
  }
): RecipeTotals {
  const excludedSet = new Set(options?.excludedIndices || []);
  let totalCal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalSugar = 0;
  let hasSugar = false;
  let totalFiber = 0;
  let hasFiber = false;
  let totalSatFat = 0;
  let hasSatFat = false;
  let totalTransFat = 0;
  let hasTransFat = false;
  let totalSodium = 0;
  let hasSodium = false;
  let totalWeight = 0;
  let effectiveCount = 0;

  const getFood = (id: string): FoodItem | undefined => {
    if (foodMap instanceof Map) return foodMap.get(id);
    return foodMap[id];
  };

  const ingredients = recipe.ingredients || [];
  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i];
    if (excludedSet.has(i)) continue;
    if (options?.excludeAllOptional && ing.isOptional) continue;

    const food = getFood(ing.foodId);
    const macros = calculateIngredientMacros(food, ing.quantity);

    totalCal += macros.calories;
    totalProtein += macros.protein;
    totalCarbs += macros.carbs;
    totalFat += macros.fat;

    if (typeof macros.sugar === 'number') {
      totalSugar += macros.sugar;
      hasSugar = true;
    }
    if (typeof macros.fiber === 'number') {
      totalFiber += macros.fiber;
      hasFiber = true;
    }
    if (typeof macros.saturatedFat === 'number') {
      totalSatFat += macros.saturatedFat;
      hasSatFat = true;
    }
    if (typeof macros.transFat === 'number') {
      totalTransFat += macros.transFat;
      hasTransFat = true;
    }
    if (typeof macros.sodium === 'number') {
      totalSodium += macros.sodium;
      hasSodium = true;
    }

    if (ing.unit === 'g' || ing.unit === 'ml') {
      totalWeight += ing.quantity;
    }
    effectiveCount++;
  }

  return {
    calories: Math.round(totalCal),
    protein: Math.round(totalProtein * 10) / 10,
    carbs: Math.round(totalCarbs * 10) / 10,
    fat: Math.round(totalFat * 10) / 10,
    totalWeightGrams: Math.round(totalWeight),
    ingredientCount: effectiveCount,
    ...(hasSugar ? { sugar: Math.round(totalSugar * 10) / 10 } : {}),
    ...(hasFiber ? { fiber: Math.round(totalFiber * 10) / 10 } : {}),
    ...(hasSatFat ? { saturatedFat: Math.round(totalSatFat * 10) / 10 } : {}),
    ...(hasTransFat ? { transFat: Math.round(totalTransFat * 10) / 10 } : {}),
    ...(hasSodium ? { sodium: Math.round(totalSodium) } : {}),
  };
}
