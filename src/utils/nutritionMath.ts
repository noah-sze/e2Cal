import type { EnergyUnit, FoodCategory, FoodMacros, FoodWeightUnit, FoodVolumeUnit, MealType } from '@/types';
import { OZ_TO_G_RATIO, FL_OZ_TO_ML_RATIO, kjToKcal, roundTo } from './unitMath';

export type NutritionDisplayMode = 'serving' | 'per100g';

export interface BaseNutritionInput {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
  transFat?: number;
  sodium?: number;
  servingSize?: number;
  servingUnit?: string;
}

export type FoodOrFlatNutritionInput =
  | BaseNutritionInput
  | {
      macros: FoodMacros;
      servingSize?: number;
      servingUnit?: string;
    };

function hasGroupedMacros(
  item: FoodOrFlatNutritionInput | null | undefined
): item is { macros: FoodMacros; servingSize?: number; servingUnit?: string } {
  return Boolean(item && 'macros' in item && item.macros && typeof item.macros === 'object');
}

function extractFlatMacros(item: FoodOrFlatNutritionInput | null | undefined): BaseNutritionInput | null {
  if (!item) return null;
  if (hasGroupedMacros(item)) {
    return {
      calories: item.macros.calories,
      carbs: item.macros.carbs.total,
      protein: item.macros.protein,
      fat: item.macros.fat.total,
      fiber: item.macros.carbs.fiber,
      sugar: item.macros.carbs.sugar,
      saturatedFat: item.macros.fat.saturated,
      transFat: item.macros.fat.trans,
      sodium: item.macros.sodium,
      servingSize: item.servingSize,
      servingUnit: item.servingUnit,
    };
  }
  return item;
}

export interface ScaledNutritionResult {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
  transFat?: number;
  sodium?: number;
  servingSize: number;
  servingUnit: string;
}

export interface ScaledNutritionOptions {
  foodWeightUnit?: FoodWeightUnit;
  foodVolumeUnit?: FoodVolumeUnit;
}

/**
 * 依據顯示模式（每份基準 vs 密度基準 100g / 1 oz），精確推算熱量與三大營養素
 * 純數學無副作用函數，100% 覆蓋邊界情況（除以零、無效數值、負數防護）
 * 
 * 方案 A 國際化密度標準 (SSOT)：
 * - 公制 (g / ml)：以「每 100g」（液體為「每 100ml」）為密度標準
 * - 英制 (oz / fl oz)：以「每 1 oz」（液體為「每 1 fl oz」）為密度標準
 */
export function calculateScaledNutrition(
  rawItem: FoodOrFlatNutritionInput | null | undefined,
  mode: NutritionDisplayMode = 'serving',
  options?: ScaledNutritionOptions
): ScaledNutritionResult {
  const isPer100Anchored = hasGroupedMacros(rawItem);
  const item = extractFlatMacros(rawItem);
  const safeCalories = Math.max(0, typeof item?.calories === 'number' && !isNaN(item.calories) ? item.calories : 0);
  const safeProtein = Math.max(0, typeof item?.protein === 'number' && !isNaN(item.protein) ? item.protein : 0);
  const safeCarbs = Math.max(0, typeof item?.carbs === 'number' && !isNaN(item.carbs) ? item.carbs : 0);
  const safeFat = Math.max(0, typeof item?.fat === 'number' && !isNaN(item.fat) ? item.fat : 0);
  const rawSize = typeof item?.servingSize === 'number' && !isNaN(item.servingSize) ? item.servingSize : 100;
  const rawUnit = (item?.servingUnit || 'g').trim() || 'g';

  const scaleOpt = (val: number | undefined, f: number = 1, isInt: boolean = false) => {
    if (typeof val !== 'number' || isNaN(val)) return undefined;
    const safe = Math.max(0, val);
    return isInt ? Math.round(safe * f) : Math.round(safe * f * 10) / 10;
  };

  // 「每份」模式
  if (mode === 'serving') {
    // 若傳入為 per-100g/100ml 錨定之 FoodItem.macros，則按參考份量 servingSize / 100 折算
    const servingFactor = isPer100Anchored
      ? (rawSize > 0 ? normalizeToPhysicalBase(rawSize, rawUnit) / 100 : 1)
      : 1;
    return {
      calories: Math.round(safeCalories * servingFactor),
      protein: Math.round(safeProtein * servingFactor * 10) / 10,
      carbs: Math.round(safeCarbs * servingFactor * 10) / 10,
      fat: Math.round(safeFat * servingFactor * 10) / 10,
      fiber: scaleOpt(item?.fiber, servingFactor),
      sugar: scaleOpt(item?.sugar, servingFactor),
      saturatedFat: scaleOpt(item?.saturatedFat, servingFactor),
      transFat: scaleOpt(item?.transFat, servingFactor),
      sodium: scaleOpt(item?.sodium, servingFactor, true),
      servingSize: rawSize,
      servingUnit: rawUnit,
    };
  }

  // 「密度」模式 (per100g / per 1 oz)：
  const normalizedRawUnit = rawUnit.toLowerCase();
  const isLiquid = normalizedRawUnit.includes('ml') || normalizedRawUnit.includes('fl');
  const isImperial = options?.foodWeightUnit === 'oz';
  // FoodItem.macros 已強制錨定於每 100g/100ml，無需再依 servingSize 反推
  const basisSize = isPer100Anchored ? 100 : rawSize;
  const basisUnit = isPer100Anchored ? (isLiquid ? 'ml' : 'g') : normalizedRawUnit;

  // 邊界防護：若份量無效或 <= 0，除以零防護，回退為原始數值或預設基準
  if (basisSize <= 0) {
    if (isImperial) {
      return {
        calories: Math.round(safeCalories),
        protein: Math.round(safeProtein * 10) / 10,
        carbs: Math.round(safeCarbs * 10) / 10,
        fat: Math.round(safeFat * 10) / 10,
        fiber: scaleOpt(item?.fiber),
        sugar: scaleOpt(item?.sugar),
        saturatedFat: scaleOpt(item?.saturatedFat),
        transFat: scaleOpt(item?.transFat),
        sodium: scaleOpt(item?.sodium, 1, true),
        servingSize: 1,
        servingUnit: isLiquid ? 'fl oz' : 'oz',
      };
    }
    return {
      calories: Math.round(safeCalories),
      protein: Math.round(safeProtein * 10) / 10,
      carbs: Math.round(safeCarbs * 10) / 10,
      fat: Math.round(safeFat * 10) / 10,
      fiber: scaleOpt(item?.fiber),
      sugar: scaleOpt(item?.sugar),
      saturatedFat: scaleOpt(item?.saturatedFat),
      transFat: scaleOpt(item?.transFat),
      sodium: scaleOpt(item?.sodium, 1, true),
      servingSize: 100,
      servingUnit: isLiquid ? 'ml' : 'g',
    };
  }

  if (isImperial) {
    // 方案 A 英制密度基準：固體為 1 oz，液體為 1 fl oz
    let factor = 1;
    if (isLiquid) {
      // 基準為 1 fl oz
      if (basisUnit.includes('fl')) {
        // 原始單位已是 fl oz
        factor = 1 / basisSize;
      } else {
        // 原始單位為 ml (1 fl oz = FL_OZ_TO_ML_RATIO ml)
        factor = FL_OZ_TO_ML_RATIO / basisSize;
      }
      return {
        calories: Math.round(safeCalories * factor),
        protein: Math.round(safeProtein * factor * 10) / 10,
        carbs: Math.round(safeCarbs * factor * 10) / 10,
        fat: Math.round(safeFat * factor * 10) / 10,
        fiber: scaleOpt(item?.fiber, factor),
        sugar: scaleOpt(item?.sugar, factor),
        saturatedFat: scaleOpt(item?.saturatedFat, factor),
        transFat: scaleOpt(item?.transFat, factor),
        sodium: scaleOpt(item?.sodium, factor, true),
        servingSize: 1,
        servingUnit: 'fl oz',
      };
    } else {
      // 基準為 1 oz
      if (basisUnit.includes('oz')) {
        // 原始單位已是 oz
        factor = 1 / basisSize;
      } else {
        // 原始單位為 g (1 oz = OZ_TO_G_RATIO g)
        factor = OZ_TO_G_RATIO / basisSize;
      }
      return {
        calories: Math.round(safeCalories * factor),
        protein: Math.round(safeProtein * factor * 10) / 10,
        carbs: Math.round(safeCarbs * factor * 10) / 10,
        fat: Math.round(safeFat * factor * 10) / 10,
        fiber: scaleOpt(item?.fiber, factor),
        sugar: scaleOpt(item?.sugar, factor),
        saturatedFat: scaleOpt(item?.saturatedFat, factor),
        transFat: scaleOpt(item?.transFat, factor),
        sodium: scaleOpt(item?.sodium, factor, true),
        servingSize: 1,
        servingUnit: 'oz',
      };
    }
  }

  // 公制密度基準：固體為 100g，液體為 100ml
  let factor = 1;
  if (isLiquid) {
    if (basisUnit.includes('fl')) {
      // 原始單位為 fl oz，100ml = 100 / FL_OZ_TO_ML_RATIO fl oz
      factor = (100 / FL_OZ_TO_ML_RATIO) / basisSize;
    } else {
      factor = 100 / basisSize;
    }
    return {
      calories: Math.round(safeCalories * factor),
      protein: Math.round(safeProtein * factor * 10) / 10,
      carbs: Math.round(safeCarbs * factor * 10) / 10,
      fat: Math.round(safeFat * factor * 10) / 10,
      fiber: scaleOpt(item?.fiber, factor),
      sugar: scaleOpt(item?.sugar, factor),
      saturatedFat: scaleOpt(item?.saturatedFat, factor),
      transFat: scaleOpt(item?.transFat, factor),
      sodium: scaleOpt(item?.sodium, factor, true),
      servingSize: 100,
      servingUnit: 'ml',
    };
  } else {
    if (basisUnit.includes('oz')) {
      // 原始單位為 oz，100g = 100 / OZ_TO_G_RATIO oz
      factor = (100 / OZ_TO_G_RATIO) / basisSize;
    } else {
      factor = 100 / basisSize;
    }
    return {
      calories: Math.round(safeCalories * factor),
      protein: Math.round(safeProtein * factor * 10) / 10,
      carbs: Math.round(safeCarbs * factor * 10) / 10,
      fat: Math.round(safeFat * factor * 10) / 10,
      fiber: scaleOpt(item?.fiber, factor),
      sugar: scaleOpt(item?.sugar, factor),
      saturatedFat: scaleOpt(item?.saturatedFat, factor),
      transFat: scaleOpt(item?.transFat, factor),
      sodium: scaleOpt(item?.sodium, factor, true),
      servingSize: 100,
      servingUnit: 'g',
    };
  }
}

export interface ScaleBasisParams {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
  transFat?: number;
  sodium?: number;
  servingSize: number; // 食用單份數值 (如 20g 或 2 oz)
  servingUnit?: string; // 食用單份單位 (如 'g', 'oz', 'ml', 'fl oz')
  basisSize: number;   // 標籤依據數值 (如 100g 或 1 oz)
  basisUnit?: string;   // 標籤依據單位 (如 'g', 'oz', 'ml', 'fl oz')
}

export interface ScaledServingNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
  transFat?: number;
  sodium?: number;
  servingSize: number;
  servingUnit: string;
}

/**
 * 將數值依據單位歸一化為物理真理源基準 (固體為 g，液體為 ml)
 */
function normalizeToPhysicalBase(value: number, unit?: string): number {
  if (value <= 0 || isNaN(value) || !isFinite(value)) return 0;
  const normalizedUnit = (unit || 'g').trim().toLowerCase();

  if (normalizedUnit === 'oz') {
    return value * OZ_TO_G_RATIO;
  }
  if (normalizedUnit === 'fl oz') {
    return value * FL_OZ_TO_ML_RATIO;
  }
  // 預設為 g 或 ml
  return value;
}

/**
 * 依據自定義營養標籤依據（basisSize 與 basisUnit，如每 100g 或每 1 oz），
 * 精確等比折算出單份食用量（servingSize 與 servingUnit）的實際營養數值。
 * 遵循 Precision Metric 準則：純函數無副作用，100% 防護 NaN、負數、跨度量衡單位折算與除以零
 */
export function scaleNutritionFromBasis(params: ScaleBasisParams): ScaledServingNutrition {
  const safeCalories = Math.max(0, typeof params?.calories === 'number' && !isNaN(params.calories) ? params.calories : 0);
  const safeProtein = Math.max(0, typeof params?.protein === 'number' && !isNaN(params.protein) ? params.protein : 0);
  const safeCarbs = Math.max(0, typeof params?.carbs === 'number' && !isNaN(params.carbs) ? params.carbs : 0);
  const safeFat = Math.max(0, typeof params?.fat === 'number' && !isNaN(params.fat) ? params.fat : 0);

  const scaleOpt = (val: number | undefined, f: number = 1, isInt: boolean = false) => {
    if (typeof val !== 'number' || isNaN(val)) return undefined;
    const safe = Math.max(0, val);
    return isInt ? Math.round(safe * f) : Math.round(safe * f * 10) / 10;
  };

  const servingSize = Math.max(0, typeof params?.servingSize === 'number' && !isNaN(params.servingSize) ? params.servingSize : 100);
  const basisSize = typeof params?.basisSize === 'number' && !isNaN(params.basisSize) ? params.basisSize : 100;
  const rawServingUnit = (params?.servingUnit || 'g').trim() || 'g';
  const rawBasisUnit = (params?.basisUnit || rawServingUnit).trim() || rawServingUnit;

  const servingPhysical = normalizeToPhysicalBase(servingSize, rawServingUnit);
  const basisPhysical = normalizeToPhysicalBase(basisSize, rawBasisUnit);

  // 防護除以零或無效基準重量
  if (basisPhysical <= 0 || servingPhysical <= 0) {
    return {
      calories: Math.round(safeCalories),
      protein: Math.round(safeProtein * 10) / 10,
      carbs: Math.round(safeCarbs * 10) / 10,
      fat: Math.round(safeFat * 10) / 10,
      fiber: scaleOpt(params?.fiber),
      sugar: scaleOpt(params?.sugar),
      saturatedFat: scaleOpt(params?.saturatedFat),
      transFat: scaleOpt(params?.transFat),
      sodium: scaleOpt(params?.sodium, 1, true),
      servingSize: servingSize > 0 ? servingSize : 100,
      servingUnit: rawServingUnit,
    };
  }

  const ratio = servingPhysical / basisPhysical;

  return {
    calories: Math.round(safeCalories * ratio),
    protein: Math.round(safeProtein * ratio * 10) / 10,
    carbs: Math.round(safeCarbs * ratio * 10) / 10,
    fat: Math.round(safeFat * ratio * 10) / 10,
    fiber: scaleOpt(params?.fiber, ratio),
    sugar: scaleOpt(params?.sugar, ratio),
    saturatedFat: scaleOpt(params?.saturatedFat, ratio),
    transFat: scaleOpt(params?.transFat, ratio),
    sodium: scaleOpt(params?.sodium, ratio, true),
    servingSize,
    servingUnit: rawServingUnit,
  };
}

export interface CalculatedFoodLogNutrients {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
  transFat?: number;
  sodium?: number;
}

/**
 * 依據食物定義 (Food) 與攝入數量 (quantity, unit)，動態計算出該筆飲食日誌的客觀營養素
 * 遵循 Precision Metric 純數學無副作用標準
 */
export function calculateFoodLogNutrients(
  rawFood: FoodOrFlatNutritionInput | null | undefined,
  quantity: number,
  unit?: string
): CalculatedFoodLogNutrients {
  const isPer100Anchored = hasGroupedMacros(rawFood);
  const food = extractFlatMacros(rawFood);
  if (!food) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }
  const scaled = scaleNutritionFromBasis({
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    fiber: food.fiber,
    sugar: food.sugar,
    saturatedFat: food.saturatedFat,
    transFat: food.transFat,
    sodium: food.sodium,
    servingSize: quantity,
    servingUnit: unit || food.servingUnit || 'g',
    basisSize: isPer100Anchored ? 100 : (food.servingSize || 100),
    basisUnit: food.servingUnit || 'g',
  });
  return {
    calories: scaled.calories,
    protein: scaled.protein,
    carbs: scaled.carbs,
    fat: scaled.fat,
    fiber: scaled.fiber,
    sugar: scaled.sugar,
    saturatedFat: scaled.saturatedFat,
    transFat: scaled.transFat,
    sodium: scaled.sodium,
  };
}

export const MEAL_RATIOS: Record<MealType, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.30,
  snack: 0.10,
};

export interface MealBudgetResult {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

/**
 * 依據餐別標準比例分配配額：
 * - 早餐 (breakfast)：25%
 * - 午餐 (lunch)：35%
 * - 晚餐 (dinner)：30%
 * - 點心 (snack)：10%
 * 純數學無副作用函數，100% 防護邊界與 NaN
 */
export function calculateMealBudget(
  mealType: MealType,
  targetMacros: {
    calories?: number;
    carbsGrams?: number;
    proteinGrams?: number;
    fatGrams?: number;
  }
): MealBudgetResult {
  const ratio = MEAL_RATIOS[mealType] ?? 0.25;
  const safeCalories = Math.max(0, typeof targetMacros?.calories === 'number' && !isNaN(targetMacros.calories) ? targetMacros.calories : 0);
  const safeCarbs = Math.max(0, typeof targetMacros?.carbsGrams === 'number' && !isNaN(targetMacros.carbsGrams) ? targetMacros.carbsGrams : 0);
  const safeProtein = Math.max(0, typeof targetMacros?.proteinGrams === 'number' && !isNaN(targetMacros.proteinGrams) ? targetMacros.proteinGrams : 0);
  const safeFat = Math.max(0, typeof targetMacros?.fatGrams === 'number' && !isNaN(targetMacros.fatGrams) ? targetMacros.fatGrams : 0);

  return {
    calories: Math.round(safeCalories * ratio),
    carbs: Math.round(safeCarbs * ratio),
    protein: Math.round(safeProtein * ratio),
    fat: Math.round(safeFat * ratio),
  };
}

export interface MetricServingResult {
  servingSize: number;
  servingUnit: 'g' | 'ml';
}

/**
 * 將任意輸入份量與單位（g / oz / ml / fl oz）強制正規化為公制 SI 單位（g 或 ml）
 * 遵循底層數據 100% 公制存儲契約
 */
export function normalizeServingToMetric(
  servingSize: number,
  servingUnit?: string,
  category?: FoodCategory
): MetricServingResult {
  const safeSize =
    typeof servingSize === 'number' && Number.isFinite(servingSize) && servingSize > 0
      ? servingSize
      : 0;
  const normalizedUnit = (servingUnit || '').trim().toLowerCase();

  if (normalizedUnit === 'fl oz' || normalizedUnit === 'floz' || normalizedUnit.includes('fl')) {
    return {
      servingSize: roundTo(safeSize * FL_OZ_TO_ML_RATIO, 2),
      servingUnit: 'ml',
    };
  }
  if (normalizedUnit === 'ml') {
    return {
      servingSize: roundTo(safeSize, 2),
      servingUnit: 'ml',
    };
  }
  if (normalizedUnit === 'oz' || normalizedUnit.includes('oz')) {
    return {
      servingSize: roundTo(safeSize * OZ_TO_G_RATIO, 2),
      servingUnit: 'g',
    };
  }
  if (normalizedUnit === 'g') {
    return {
      servingSize: roundTo(safeSize, 2),
      servingUnit: 'g',
    };
  }

  return {
    servingSize: roundTo(safeSize, 2),
    servingUnit: category === 'beverage' ? 'ml' : 'g',
  };
}

export interface NormalizeFoodInputParams {
  servingSize: number;
  servingUnit: string;
  basisMode: 'serving' | 'custom';
  basisSize?: number;
  basisUnit?: string;
  calories: number;
  energyUnit: EnergyUnit;
  carbs: number;
  protein: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
  transFat?: number;
  sodium?: number;
  category?: FoodCategory;
}

export interface NormalizedMetricFoodNutrition {
  servingSize: number;
  servingUnit: 'g' | 'ml';
  macros: FoodMacros;
}

/**
 * 將新增 / 編輯食材表單中的任意單位（g / oz / ml / fl oz、kcal / kJ）與任意基準（份量 / 自定義）
 * 一次性無損折算為「每 100 g / 100 ml 純公制 SI 營養素 (macros)」，
 * 並保留參考份量 (servingSize / servingUnit) 作為純 UX 元數據。
 */
export function normalizeFoodInputToMetric(
  params: NormalizeFoodInputParams
): NormalizedMetricFoodNutrition {
  const safeRawCal =
    typeof params.calories === 'number' && Number.isFinite(params.calories) && params.calories > 0
      ? params.calories
      : 0;
  const safeCarbs =
    typeof params.carbs === 'number' && Number.isFinite(params.carbs) && params.carbs > 0
      ? params.carbs
      : 0;
  const safeProtein =
    typeof params.protein === 'number' && Number.isFinite(params.protein) && params.protein > 0
      ? params.protein
      : 0;
  const safeFat =
    typeof params.fat === 'number' && Number.isFinite(params.fat) && params.fat > 0
      ? params.fat
      : 0;

  const safeOpt = (val?: number, scale: number = 1, isInt: boolean = false) => {
    if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) return undefined;
    return isInt ? Math.round(val * scale) : roundTo(val * scale, 2);
  };

  // 1. 熱量統一折算為 kcal（1 kcal = 4.184 kJ）
  const baseCaloriesKcal =
    params.energyUnit === 'kJ' ? kjToKcal(safeRawCal, 4) : safeRawCal;

  // 2. 參考份量統一折算為公制 SI（g / ml）
  const metricServing = normalizeServingToMetric(
    params.servingSize,
    params.servingUnit,
    params.category
  );

  // 3. 決定輸入數值所對應的物理基準克數/毫升數，並一律折算為每 100 g / 100 ml
  let basisPhysicalSize = metricServing.servingSize;
  if (params.basisMode === 'custom') {
    const effectiveBasisSize =
      typeof params.basisSize === 'number' && Number.isFinite(params.basisSize) && params.basisSize > 0
        ? params.basisSize
        : params.servingSize;
    const effectiveBasisUnit =
      params.basisSize && params.basisSize > 0 && params.basisUnit
        ? params.basisUnit
        : params.servingUnit;
    basisPhysicalSize = normalizeServingToMetric(
      effectiveBasisSize,
      effectiveBasisUnit,
      params.category
    ).servingSize;
  }

  const ratio = basisPhysicalSize > 0 ? 100 / basisPhysicalSize : 1;
  const fiber = safeOpt(params.fiber, ratio);
  const sugar = safeOpt(params.sugar, ratio);
  const saturatedFat = safeOpt(params.saturatedFat, ratio);
  const transFat = safeOpt(params.transFat, ratio);
  const sodium = safeOpt(params.sodium, ratio, true);

  return {
    servingSize: metricServing.servingSize,
    servingUnit: metricServing.servingUnit,
    macros: {
      calories: roundTo(baseCaloriesKcal * ratio, 2),
      carbs: {
        total: roundTo(safeCarbs * ratio, 2),
        ...(sugar !== undefined ? { sugar } : {}),
        ...(fiber !== undefined ? { fiber } : {}),
      },
      protein: roundTo(safeProtein * ratio, 2),
      fat: {
        total: roundTo(safeFat * ratio, 2),
        ...(saturatedFat !== undefined ? { saturated: saturatedFat } : {}),
        ...(transFat !== undefined ? { trans: transFat } : {}),
      },
      ...(sodium !== undefined ? { sodium } : {}),
    },
  };
}

/**
 * 純函數：計算淨碳水（Net Carbs = carbs - fiber）
 * 邊界防護：若 fiber 為空或未定義，淨碳水即為 carbs；淨碳水不得小於 0
 */
export function calculateNetCarbs(carbs: number, fiber?: number): number {
  const safeCarbs = Math.max(0, typeof carbs === 'number' && Number.isFinite(carbs) ? carbs : 0);
  const safeFiber = Math.max(0, typeof fiber === 'number' && Number.isFinite(fiber) ? fiber : 0);
  return roundTo(Math.max(0, safeCarbs - safeFiber), 2);
}

/**
 * 純函數：推算健康不飽和脂肪（Unsaturated Fat = totalFat - saturatedFat - transFat）
 * 邊界防護：不得小於 0，若未填寫飽和或反式脂肪則視為 0 進行差額估算
 */
export function calculateUnsaturatedFat(
  totalFat: number,
  saturatedFat?: number,
  transFat?: number
): number {
  const safeFat = Math.max(0, typeof totalFat === 'number' && Number.isFinite(totalFat) ? totalFat : 0);
  const safeSat = Math.max(0, typeof saturatedFat === 'number' && Number.isFinite(saturatedFat) ? saturatedFat : 0);
  const safeTrans = Math.max(0, typeof transFat === 'number' && Number.isFinite(transFat) ? transFat : 0);
  return roundTo(Math.max(0, safeFat - safeSat - safeTrans), 2);
}

/**
 * 稱重形態 (Weighing Form):
 * - 'net': 可食淨重 (純肉/純果肉，100% 可食部)
 * - 'gross': 毛重 (盤中或秤上稱得總重，含骨、殼、皮等不可食殘渣)
 */
export type WeighingForm = 'net' | 'gross';

/**
 * 純函數：根據稱重形態與食材可食率，計算出實際記入日誌的有效可食淨重 (g)
 * @param inputGrams 使用者輸入的克數 (>= 0)
 * @param form 稱重形態 ('net' | 'gross')
 * @param edibleRate 食材可食率 (0 < edibleRate <= 1.0，預設 1.0)
 * @returns 折算後的有效可食淨重 (g)
 */
export function calculateEffectiveGrams(
  inputGrams: number,
  form: WeighingForm = 'net',
  edibleRate?: number
): number {
  const safeInput = Math.max(0, typeof inputGrams === 'number' && Number.isFinite(inputGrams) ? inputGrams : 0);
  const safeRate = typeof edibleRate === 'number' && Number.isFinite(edibleRate) && edibleRate > 0 && edibleRate <= 1
    ? edibleRate
    : 1.0;

  if (form === 'gross') {
    return roundTo(safeInput * safeRate, 2);
  }
  return roundTo(safeInput, 2);
}
