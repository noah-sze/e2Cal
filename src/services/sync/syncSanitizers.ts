import type {
  AuthoritySource,
  FoodDataSource,
  FoodItem,
  FoodMicronutrients,
  FoodRecipe,
  FoodLog,
  FoodLogEntryType,
  DailyDietLog,
  MacroSplit,
  MealType,
  WorkoutLog,
  WorkoutRoutine,
  UserBaseInfo,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { PRIMARY_USER_ID } from '@/services/db/defaultData';
import { normalizeServingToMetric } from '@/utils/nutritionMath';

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
}

const VALID_AUTHORITIES: ReadonlySet<AuthoritySource> = new Set([
  'USDA',
  'CFCT',
  'TFDA',
  'MEXT',
  'AFCD',
  'CoFID',
]);

const MICRONUTRIENT_KEYS: ReadonlyArray<keyof FoodMicronutrients> = [
  'potassium',
  'calcium',
  'magnesium',
  'iron',
  'zinc',
  'selenium',
  'vitaminA',
  'vitaminC',
  'vitaminD',
  'vitaminE',
  'vitaminB1',
  'vitaminB2',
  'vitaminB3',
  'vitaminB6',
  'vitaminB12',
  'folate',
  'cholesterol',
  'omega3EPA',
  'omega3DHA',
  'omega3ALA',
  'leucine',
];

/** 將廢棄率或可食率正規化至 [0, 1]，無效值則剔除 */
function sanitizeRate(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return Math.min(1, Math.max(0, num));
}

/** 清洗權威資料庫溯源資訊 */
function sanitizeFoodDataSource(rawInput: unknown): FoodDataSource | undefined {
  if (typeof rawInput !== 'object' || rawInput === null) return undefined;
  const ds = asRecord(rawInput);
  if (typeof ds.authority !== 'string' || !VALID_AUTHORITIES.has(ds.authority as AuthoritySource)) {
    return undefined;
  }
  const sourceId = typeof ds.sourceId === 'string' ? ds.sourceId.trim() : '';
  if (!sourceId) return undefined;

  const sourceName = typeof ds.sourceName === 'string' ? ds.sourceName.trim() : '';
  const verifiedAt = typeof ds.verifiedAt === 'string' ? ds.verifiedAt.trim() : '';

  return {
    authority: ds.authority as AuthoritySource,
    sourceId,
    ...(sourceName ? { sourceName } : {}),
    ...(verifiedAt ? { verifiedAt } : {}),
  };
}

/** 清洗微量元素儲備庫，僅保留有效非負數值 */
function sanitizeFoodMicronutrients(rawInput: unknown): FoodMicronutrients | undefined {
  if (typeof rawInput !== 'object' || rawInput === null) return undefined;
  const rawMicros = asRecord(rawInput);
  const cleaned: FoodMicronutrients = {};
  let hasAny = false;

  for (const key of MICRONUTRIENT_KEYS) {
    const val = rawMicros[key];
    if (val === undefined || val === null || val === '') continue;
    const num = Number(val);
    if (!Number.isFinite(num) || num < 0) continue;
    cleaned[key] = num;
    hasAny = true;
  }

  return hasAny ? cleaned : undefined;
}

function sanitizeOptionalMacro(
  val: unknown,
  scale: number,
  decimals: number
): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const num = Number(val);
  if (!Number.isFinite(num)) return undefined;
  const factor = 10 ** decimals;
  return Math.round(Math.max(0, num) * scale * factor) / factor;
}

/**
 * 清洗單品食材：強制收斂為純淨公制 SI（g / ml、kcal），將營養常數統一收斂於 per-100g/100ml 之 macros 物件
 * 若為歷史扁平格式 (!raw.macros) 則自動依 servingSize 換算至 100g/100ml 基準；若已有 macros 則冪等清洗不重複換算
 */
export function sanitizeFoodItem(rawInput: unknown): FoodItem {
  const raw = asRecord(rawInput);
  const rawId = String(raw.id || uuidv4());
  const category = (raw.category as FoodItem['category']) || 'natural';
  const rawSize = Number(raw.servingSize);
  const rawUnit = typeof raw.servingUnit === 'string' ? raw.servingUnit : undefined;
  const metricServing = normalizeServingToMetric(
    Number.isFinite(rawSize) && rawSize > 0 ? rawSize : 100,
    rawUnit,
    category
  );

  const isCustom = raw.isCustom !== undefined ? Boolean(raw.isCustom) : true;
  const hasMacrosObj =
    typeof raw.macros === 'object' && raw.macros !== null && !Array.isArray(raw.macros);
  const macroSrc = hasMacrosObj ? asRecord(raw.macros) : raw;
  const scale =
    !hasMacrosObj && metricServing.servingSize > 0 && metricServing.servingSize !== 100
      ? 100 / metricServing.servingSize
      : 1;

  const carbsSrc =
    typeof macroSrc.carbs === 'object' && macroSrc.carbs !== null && !Array.isArray(macroSrc.carbs)
      ? asRecord(macroSrc.carbs)
      : null;
  const fatSrc =
    typeof macroSrc.fat === 'object' && macroSrc.fat !== null && !Array.isArray(macroSrc.fat)
      ? asRecord(macroSrc.fat)
      : null;

  const carbsTotal = sanitizeOptionalMacro(carbsSrc ? carbsSrc.total : macroSrc.carbs, scale, 1) ?? 0;
  const sugar = sanitizeOptionalMacro(carbsSrc ? carbsSrc.sugar : macroSrc.sugar, scale, 1);
  const fiber = sanitizeOptionalMacro(carbsSrc ? carbsSrc.fiber : macroSrc.fiber, scale, 1);

  const fatTotal = sanitizeOptionalMacro(fatSrc ? fatSrc.total : macroSrc.fat, scale, 1) ?? 0;
  const saturated = sanitizeOptionalMacro(
    fatSrc ? fatSrc.saturated : macroSrc.saturatedFat,
    scale,
    1
  );
  const trans = sanitizeOptionalMacro(fatSrc ? fatSrc.trans : macroSrc.transFat, scale, 1);
  const sodium = sanitizeOptionalMacro(macroSrc.sodium, scale, 0);

  const macros = {
    calories: Math.round(Math.max(0, Number(macroSrc.calories) || 0) * scale),
    carbs: {
      total: carbsTotal,
      ...(sugar !== undefined ? { sugar } : {}),
      ...(fiber !== undefined ? { fiber } : {}),
    },
    protein: sanitizeOptionalMacro(macroSrc.protein, scale, 1) ?? 0,
    fat: {
      total: fatTotal,
      ...(saturated !== undefined ? { saturated } : {}),
      ...(trans !== undefined ? { trans } : {}),
    },
    ...(sodium !== undefined ? { sodium } : {}),
  };

  const refuseRate = sanitizeRate(raw.refuseRate);
  const edibleRate = sanitizeRate(raw.edibleRate);
  const refuseDescription =
    typeof raw.refuseDescription === 'string' ? raw.refuseDescription.trim() : '';
  const dataSource = sanitizeFoodDataSource(raw.dataSource);
  const micros = sanitizeFoodMicronutrients(raw.micros);

  return {
    id: rawId,
    name: String(raw.name || '').trim(),
    category,
    ...(raw.brand ? { brand: String(raw.brand).trim() } : {}),
    servingSize: metricServing.servingSize,
    servingUnit: metricServing.servingUnit,
    macros,
    ...(refuseRate !== undefined ? { refuseRate } : {}),
    ...(edibleRate !== undefined ? { edibleRate } : {}),
    ...(refuseDescription ? { refuseDescription } : {}),
    ...(dataSource ? { dataSource } : {}),
    ...(micros ? { micros } : {}),
    isCustom,
    isArchived: Boolean(raw.isArchived),
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    ...(raw.rev !== undefined ? { rev: Number(raw.rev) } : {}),
  };
}

/**
 * 清洗菜餚組合：嚴格踐行純 ID 關聯正規化，剔除任何 foodName 快照與根層級 description
 */
export function sanitizeRecipe(recipeInput: unknown): FoodRecipe {
  const recipe = asRecord(recipeInput);
  const rawId = String(recipe.id || '');
  return {
    id: rawId,
    name: String(recipe.name || ''),
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map((ingInput: unknown) => {
          const ing = asRecord(ingInput);
          const rawFoodId = String(ing.foodId || '');
          const item: { foodId: string; quantity: number; unit: string; isOptional?: boolean } = {
            foodId: rawFoodId,
            quantity: Number(ing.quantity) || 0,
            unit: String(ing.unit || 'g'),
          };
          if (typeof ing.isOptional === 'boolean') {
            item.isOptional = ing.isOptional;
          }
          return item;
        })
      : [],
    isCustom: Boolean(recipe.isCustom),
    isArchived: Boolean(recipe.isArchived),
    createdAt: Number(recipe.createdAt) || Date.now(),
    updatedAt: Number(recipe.updatedAt) || Date.now(),
    ...(recipe.rev !== undefined ? { rev: Number(recipe.rev) } : {}),
  };
}

/**
 * 清洗飲食日誌：只保留物理事實與系統原型，剔除食物名稱與靜態營養素快照
 */
export function sanitizeFoodLog(logInput: unknown): FoodLog {
  const log = asRecord(logInput);
  let entryType: FoodLogEntryType = 'item';
  if (log.entryType === 'as_planned' || log.isAsPlanned) {
    entryType = 'as_planned';
  } else if (
    log.entryType === 'estimate' ||
    log.isPlaceholder ||
    (!log.foodId && (log.scenario || log.customTitle || log.calories !== undefined))
  ) {
    entryType = 'estimate';
  }

  const sanitized: FoodLog = {
    id: String(log.id || ''),
    date: String(log.date || ''),
    mealType: (log.mealType as MealType) || 'snack',
    entryType,
    createdAt: Number(log.createdAt) || Date.now(),
    updatedAt: Number(log.updatedAt) || Date.now(),
  };

  if (entryType === 'item') {
    if (log.foodId) sanitized.foodId = String(log.foodId);
    sanitized.quantity = Number(log.quantity) || 0;
    if (typeof log.grossQuantity === 'number' && !isNaN(log.grossQuantity) && log.grossQuantity > 0) {
      sanitized.grossQuantity = log.grossQuantity;
    }
    sanitized.unit = String(log.unit || 'g');
    if (log.bundleId) sanitized.bundleId = String(log.bundleId);
  } else if (entryType === 'as_planned') {
    sanitized.isAsPlanned = true;
    const rawCustomTitle = typeof log.customTitle === 'string' ? log.customTitle.trim() : '';
    const rawFoodName = typeof log.foodName === 'string' ? log.foodName.trim() : '';
    if (rawCustomTitle) {
      sanitized.customTitle = rawCustomTitle;
    } else if (rawFoodName) {
      const isGeneric =
        rawFoodName.endsWith('配額') ||
        rawFoodName.endsWith('配额') ||
        rawFoodName.endsWith('Budget') ||
        rawFoodName === '正常飲食' ||
        rawFoodName === '正常饮食' ||
        rawFoodName === 'Regular Diet' ||
        rawFoodName === '算我正常吃' ||
        rawFoodName === '算我正常食' ||
        rawFoodName === '歷史均值' ||
        rawFoodName === '历史均值' ||
        rawFoodName === 'Past Average' ||
        rawFoodName === 'Historical Average';
      if (!isGeneric) {
        sanitized.customTitle = rawFoodName;
      }
    }
    if (typeof log.calories === 'number' && !isNaN(log.calories)) sanitized.calories = log.calories;
    if (typeof log.carbs === 'number' && !isNaN(log.carbs)) sanitized.carbs = log.carbs;
    if (typeof log.protein === 'number' && !isNaN(log.protein)) sanitized.protein = log.protein;
    if (typeof log.fat === 'number' && !isNaN(log.fat)) sanitized.fat = log.fat;
    if (typeof log.sugar === 'number' && !isNaN(log.sugar)) sanitized.sugar = log.sugar;
    if (typeof log.fiber === 'number' && !isNaN(log.fiber)) sanitized.fiber = log.fiber;
    if (typeof log.saturatedFat === 'number' && !isNaN(log.saturatedFat)) sanitized.saturatedFat = log.saturatedFat;
    if (typeof log.transFat === 'number' && !isNaN(log.transFat)) sanitized.transFat = log.transFat;
    if (typeof log.sodium === 'number' && !isNaN(log.sodium)) sanitized.sodium = log.sodium;
  } else if (entryType === 'estimate') {
    sanitized.isPlaceholder = true;
    if (log.scenario) {
      sanitized.scenario = String(log.scenario);
    }
    const rawCustomTitle = typeof log.customTitle === 'string' ? log.customTitle.trim() : '';
    const rawFoodName = typeof log.foodName === 'string' ? log.foodName.trim() : '';
    if (rawCustomTitle) {
      sanitized.customTitle = rawCustomTitle;
    } else if (rawFoodName) {
      const isGeneric =
        rawFoodName === '快速估算' ||
        rawFoodName === '快速粗估' ||
        rawFoodName === 'Quick Estimate' ||
        rawFoodName === '常規';
      if (!isGeneric) {
        sanitized.customTitle = rawFoodName;
      }
    }
    if (typeof log.calories === 'number' && !isNaN(log.calories)) sanitized.calories = log.calories;
    if (typeof log.carbs === 'number' && !isNaN(log.carbs)) sanitized.carbs = log.carbs;
    if (typeof log.protein === 'number' && !isNaN(log.protein)) sanitized.protein = log.protein;
    if (typeof log.fat === 'number' && !isNaN(log.fat)) sanitized.fat = log.fat;
    if (typeof log.sugar === 'number' && !isNaN(log.sugar)) sanitized.sugar = log.sugar;
    if (typeof log.fiber === 'number' && !isNaN(log.fiber)) sanitized.fiber = log.fiber;
    if (typeof log.saturatedFat === 'number' && !isNaN(log.saturatedFat)) sanitized.saturatedFat = log.saturatedFat;
    if (typeof log.transFat === 'number' && !isNaN(log.transFat)) sanitized.transFat = log.transFat;
    if (typeof log.sodium === 'number' && !isNaN(log.sodium)) sanitized.sodium = log.sodium;
  }

  if (log.rev !== undefined) sanitized.rev = Number(log.rev);

  return sanitized;
}

/**
 * 清洗自包含每日飲食日誌膠囊：規範化日誌頭部 (meta) 與進食組件 (entries)
 */
export function sanitizeDailyDietLog(rawInput: unknown): DailyDietLog {
  const raw = asRecord(rawInput);
  const meta = asRecord(raw.meta);
  const rawId = String(raw.id || '');
  const now = Date.now();
  const maxTombstoneAgeMs = 30 * 24 * 60 * 60 * 1000;
  let deletedEntries: Record<string, number> | undefined;
  if (raw.deletedEntries && typeof raw.deletedEntries === 'object' && !Array.isArray(raw.deletedEntries)) {
    const cleaned: Record<string, number> = {};
    for (const [entryId, ts] of Object.entries(raw.deletedEntries as Record<string, unknown>)) {
      const numTs = Number(ts);
      if (entryId && Number.isFinite(numTs) && numTs > 0 && now - numTs <= maxTombstoneAgeMs) {
        cleaned[entryId] = numTs;
      }
    }
    if (Object.keys(cleaned).length > 0) {
      deletedEntries = cleaned;
    }
  }

  return {
    id: rawId,
    date: String(raw.date || ''),
    meta: {
      activityLevel: Number(meta.activityLevel) || 1.2,
      macroSplit: (meta.macroSplit as MacroSplit | undefined) || { carbs: 40, protein: 30, fat: 30 },
    },
    entries: Array.isArray(raw.entries)
      ? raw.entries.map((entry: unknown) => sanitizeFoodLog(entry))
      : [],
    ...(deletedEntries ? { deletedEntries } : {}),
    createdAt: Number(raw.createdAt) || now,
    updatedAt: Number(raw.updatedAt) || now,
    ...(raw.rev !== undefined ? { rev: Number(raw.rev) } : {}),
  };
}

/**
 * 清洗訓練日誌：只保留動作 ID 與組數，剔除標題、動作名稱與肌群快照
 */
export function sanitizeWorkoutLog(logInput: unknown): WorkoutLog {
  const log = asRecord(logInput);
  const now = Date.now();
  const maxTombstoneAgeMs = 30 * 24 * 60 * 60 * 1000;
  let deletedSetIds: Record<string, number> | undefined;
  if (log.deletedSetIds && typeof log.deletedSetIds === 'object' && !Array.isArray(log.deletedSetIds)) {
    const cleaned: Record<string, number> = {};
    for (const [setId, ts] of Object.entries(log.deletedSetIds as Record<string, unknown>)) {
      const numTs = Number(ts);
      if (setId && Number.isFinite(numTs) && numTs > 0 && now - numTs <= maxTombstoneAgeMs) {
        cleaned[setId] = numTs;
      }
    }
    if (Object.keys(cleaned).length > 0) {
      deletedSetIds = cleaned;
    }
  }

  const sanitized: WorkoutLog = {
    id: String(log.id || ''),
    date: String(log.date || ''),
    exercises: Array.isArray(log.exercises)
      ? log.exercises.map((groupInput: unknown) => {
          const group = asRecord(groupInput);
          return {
            exerciseId: String(group.exerciseId || ''),
            sets: Array.isArray(group.sets)
              ? group.sets.map((sInput: unknown, idx: number) => {
                  const s = asRecord(sInput);
                  const rawWeight =
                    s.weight !== undefined && s.weight !== null && s.weight !== ''
                      ? Number(s.weight)
                      : undefined;
                  const rawReps =
                    s.reps !== undefined && s.reps !== null && s.reps !== ''
                      ? Number(s.reps)
                      : undefined;
                  const rawRev =
                    s.rev !== undefined && s.rev !== null && s.rev !== ''
                      ? Number(s.rev)
                      : undefined;
                  return {
                    id: String(s.id || `set-${idx}`),
                    setNumber: Number(s.setNumber) || idx + 1,
                    ...(rawWeight !== undefined && Number.isFinite(rawWeight)
                      ? { weight: rawWeight }
                      : {}),
                    ...(rawReps !== undefined && Number.isFinite(rawReps) ? { reps: rawReps } : {}),
                    isCompleted: Boolean(s.isCompleted),
                    ...(s.rpe !== undefined ? { rpe: Number(s.rpe) } : {}),
                    ...(s.durationSeconds !== undefined ? { durationSeconds: Number(s.durationSeconds) } : {}),
                    ...(s.distanceKm !== undefined ? { distanceKm: Number(s.distanceKm) } : {}),
                    ...(s.isWarmup !== undefined ? { isWarmup: Boolean(s.isWarmup) } : {}),
                    ...(s.updatedAt !== undefined ? { updatedAt: Number(s.updatedAt) } : {}),
                    ...(rawRev !== undefined && Number.isInteger(rawRev) && rawRev >= 0
                      ? { rev: rawRev }
                      : {}),
                  };
                })
              : [],
          };
        })
      : [],
    ...(deletedSetIds ? { deletedSetIds } : {}),
    createdAt: Number(log.createdAt) || now,
    updatedAt: Number(log.updatedAt) || now,
  };

  if (log.routineId) sanitized.routineId = String(log.routineId);
  if (log.rev !== undefined) sanitized.rev = Number(log.rev);

  return sanitized;
}

/**
 * 清洗使用者基礎資料：剔除 weightUnit 與 activityLevel
 */
export function sanitizeUserBaseInfo(infoInput: unknown): UserBaseInfo {
  const info = asRecord(infoInput);
  const rawId = String(info.id || PRIMARY_USER_ID);
  return {
    id: rawId || PRIMARY_USER_ID,
    name: String(info.name || ''),
    gender: info.gender === 'female' ? 'female' : 'male',
    birthDate: String(info.birthDate || '1999-01'),
    heightCm: Number(info.heightCm) || 175,
    createdAt: Number(info.createdAt) || Date.now(),
    updatedAt: Number(info.updatedAt) || Date.now(),
    ...(info.rev !== undefined ? { rev: Number(info.rev) } : {}),
  };
}

/**
 * 清洗訓練課表/組合：僅保留 exerciseId，徹底剔除 defaultSets 等組數設定
 */
export function sanitizeWorkoutRoutine(routineInput: unknown): WorkoutRoutine {
  const routine = asRecord(routineInput);
  const rawId = String(routine.id || '');
  return {
    id: rawId,
    name: String(routine.name || ''),
    ...(routine.notes ? { notes: String(routine.notes) } : {}),
    exercises: Array.isArray(routine.exercises)
      ? routine.exercises.map((itemInput: unknown) => {
          const item = asRecord(itemInput);
          return {
            exerciseId: String(item.exerciseId || ''),
          };
        })
      : [],
    isCustom: Boolean(routine.isCustom ?? true),
    ...(routine.isArchived !== undefined ? { isArchived: Boolean(routine.isArchived) } : {}),
    createdAt: Number(routine.createdAt) || Date.now(),
    updatedAt: Number(routine.updatedAt) || Date.now(),
    ...(routine.rev !== undefined ? { rev: Number(routine.rev) } : {}),
  };
}
