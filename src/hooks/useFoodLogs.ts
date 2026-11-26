import { useLiveQuery } from 'dexie-react-hooks';
import i18n from '@/i18n/config';
import { db } from '@/services/db/db';
import type { DailyDietLog, FoodLog, FoodLogEntryType, HydratedFoodLog, MealType } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateFoodLogNutrients } from '@/utils/nutritionMath';
import { formatFoodDisplayName } from '@/utils/foodNaming';
import { ensureDailyDietMeta } from './useDietPlan';
import { getInMemoryFoodsCache, setInMemoryFoodsCache } from './useFoods';
import { sortFoodLogsByWeightDesc } from '@/utils/dietSorting';
import { roundTo, ozToG, gToOz, flOzToMl, mlToFlOz } from '@/utils/unitMath';
import { createInMemoryCache } from './createInMemoryCache';

/**
 * 模組級每日飲食日誌記憶體注水快取 (In-Memory Hydration Cache)
 * 解決從 /diet 跳轉至食材/菜餚詳情頁時等待 db.daily_diet_logs.toArray() 異步查詢造成的熱點圖與統計數據二次跳動問題
 */
const dailyDietLogsCache = createInMemoryCache<DailyDietLog>(() => db.daily_diet_logs.toArray());

export const getInMemoryDailyDietLogsCache = dailyDietLogsCache.get;
export const setInMemoryDailyDietLogsCache = dailyDietLogsCache.set;
export const clearDailyDietLogsCache = dailyDietLogsCache.clear;
export const prewarmDailyDietLogsCache = dailyDietLogsCache.prewarm;

function upsertInMemoryDailyDietLog(log: DailyDietLog): void {
  const current = dailyDietLogsCache.get();
  if (!current) return;
  const idx = current.findIndex((d) => d.id === log.id || d.date === log.date);
  if (idx !== -1) {
    const next = [...current];
    next[idx] = log;
    dailyDietLogsCache.set(next);
  } else {
    dailyDietLogsCache.set([...current, log]);
  }
}

export function useFoodLogs(date: string) {
  const currentLang = i18n.language;
  const queryResult = useLiveQuery(
    async () => {
      const dailyLog = await db.daily_diet_logs.where('date').equals(date).first();
      const rawEntries = dailyLog?.entries || [];
      const cachedFoods = getInMemoryFoodsCache();
      const allFoods = cachedFoods ?? (await db.foods.toArray());
      if (!cachedFoods) {
        setInMemoryFoodsCache(allFoods);
      }
      if (dailyDietLogsCache.get() === null) {
        void prewarmDailyDietLogsCache();
      } else if (dailyLog) {
        upsertInMemoryDailyDietLog(dailyLog);
      }
      const foodMap = new Map(allFoods.map((f) => [f.id, f]));

      const hydratedLogs: HydratedFoodLog[] = rawEntries.map((log) => {
        const isSystemEntry =
          log.entryType === 'estimate' ||
          log.entryType === 'as_planned' ||
          log.isPlaceholder ||
          log.isAsPlanned;
        const food = (!isSystemEntry && log.foodId) ? foodMap.get(log.foodId) : undefined;
        // 若有對應食材實體，依據真理源動態推算營養素；無實體時回退粗估/配額快照或保底 0
        const computedNutrients = food
          ? calculateFoodLogNutrients(food, log.quantity || 0, log.unit || 'g')
          : {
              calories: log.calories || 0,
              protein: log.protein || 0,
              carbs: log.carbs || 0,
              fat: log.fat || 0,
              sugar: log.sugar,
              fiber: log.fiber,
              saturatedFat: log.saturatedFat,
              transFat: log.transFat,
              sodium: log.sodium,
            };

        const displayName = food
          ? formatFoodDisplayName(food, currentLang)
          : isSystemEntry
            ? (log.customTitle || log.foodName || '')
            : (log.customTitle || log.foodName || '未知食材');

        const entryType: FoodLogEntryType =
          log.entryType ||
          (log.isAsPlanned ? 'as_planned' : log.isPlaceholder ? 'estimate' : 'item');

        return {
          ...log,
          entryType,
          date,
          foodName: displayName,
          calories: computedNutrients.calories,
          protein: computedNutrients.protein,
          carbs: computedNutrients.carbs,
          fat: computedNutrients.fat,
          fiber: computedNutrients.fiber,
          sugar: computedNutrients.sugar,
          saturatedFat: computedNutrients.saturatedFat,
          transFat: computedNutrients.transFat,
          sodium: computedNutrients.sodium,
        };
      });

      return {
        dailyLog,
        hydratedLogs,
      };
    },
    [date, currentLang]
  );

  const logs: HydratedFoodLog[] = queryResult?.hydratedLogs || [];

  // 當日巨量與次要營養素統計（動態計算值）
  const totals = logs.reduce(
    (acc, item) => {
      acc.calories += item.calories || 0;
      acc.protein += item.protein || 0;
      acc.carbs += item.carbs || 0;
      acc.fat += item.fat || 0;
      if (typeof item.sugar === 'number') acc.sugar = (acc.sugar ?? 0) + item.sugar;
      if (typeof item.fiber === 'number') acc.fiber = (acc.fiber ?? 0) + item.fiber;
      if (typeof item.saturatedFat === 'number') {
        acc.saturatedFat = (acc.saturatedFat ?? 0) + item.saturatedFat;
      }
      if (typeof item.transFat === 'number') {
        acc.transFat = (acc.transFat ?? 0) + item.transFat;
      }
      return acc;
    },
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      sugar: undefined as number | undefined,
      fiber: undefined as number | undefined,
      saturatedFat: undefined as number | undefined,
      transFat: undefined as number | undefined,
    }
  );

  // 按餐別分組
  const mealGroups: Record<MealType, HydratedFoodLog[]> = {
    breakfast: sortFoodLogsByWeightDesc(logs.filter((l) => l.mealType === 'breakfast')),
    lunch: sortFoodLogsByWeightDesc(logs.filter((l) => l.mealType === 'lunch')),
    dinner: sortFoodLogsByWeightDesc(logs.filter((l) => l.mealType === 'dinner')),
    snack: sortFoodLogsByWeightDesc(logs.filter((l) => l.mealType === 'snack')),
  };

  const getOrCreateDailyLog = async (targetDate: string): Promise<DailyDietLog> => {
    const existing = await db.daily_diet_logs.where('date').equals(targetDate).first();
    if (existing) {
      return existing;
    }
    const meta = await ensureDailyDietMeta(targetDate);
    const now = Date.now();
    const newLog: DailyDietLog = {
      id: uuidv4(),
      date: targetDate,
      meta: {
        activityLevel: meta.activityLevel ?? 1.2,
        macroSplit: meta.macroSplit ?? { carbs: 40, protein: 30, fat: 30 },
      },
      entries: [],
      createdAt: now,
      updatedAt: now,
    };
    await db.daily_diet_logs.put(newLog);
    return newLog;
  };

  const addFoodLog = async (data: Omit<FoodLog, 'id' | 'createdAt' | 'updatedAt'>) => {
    const targetDate = data.date || date;
    const dailyLog = await getOrCreateDailyLog(targetDate);
    const now = Date.now();
    const entryType: FoodLogEntryType =
      data.entryType ||
      (data.isAsPlanned ? 'as_planned' : data.isPlaceholder ? 'estimate' : 'item');

    // 同一餐、同一食材重複添加時，自動疊加重量而非獨立為兩個條目
    const isStandaloneItem = entryType === 'item' && Boolean(data.foodId) && !data.bundleId;
    if (isStandaloneItem) {
      const existingEntry = dailyLog.entries.find(
        (entry) =>
          entry.mealType === data.mealType &&
          entry.foodId === data.foodId &&
          !entry.bundleId &&
          (entry.entryType === 'item' || (!entry.entryType && !entry.isPlaceholder && !entry.isAsPlanned))
      );

      if (existingEntry) {
        const incomingQty = data.quantity ?? 100;
        const incomingUnit = data.unit ?? existingEntry.unit ?? 'g';
        const targetUnit = existingEntry.unit ?? incomingUnit;

        let addedQty = incomingQty;
        if (targetUnit !== incomingUnit) {
          if (targetUnit === 'g' && incomingUnit === 'oz') {
            addedQty = ozToG(incomingQty);
          } else if (targetUnit === 'oz' && incomingUnit === 'g') {
            addedQty = gToOz(incomingQty);
          } else if (targetUnit === 'ml' && incomingUnit === 'fl oz') {
            addedQty = flOzToMl(incomingQty);
          } else if (targetUnit === 'fl oz' && incomingUnit === 'ml') {
            addedQty = mlToFlOz(incomingQty);
          }
        }

        existingEntry.quantity = roundTo((existingEntry.quantity ?? 0) + addedQty, 2);
        if (typeof data.grossQuantity === 'number' || typeof existingEntry.grossQuantity === 'number') {
          const existingGross = existingEntry.grossQuantity ?? existingEntry.quantity ?? 0;
          const incomingGross = data.grossQuantity ?? incomingQty;
          existingEntry.grossQuantity = roundTo(existingGross + incomingGross, 2);
        }
        existingEntry.updatedAt = now;
        dailyLog.updatedAt = now;
        await db.daily_diet_logs.put(dailyLog);
        upsertInMemoryDailyDietLog(dailyLog);
        return existingEntry.id;
      }
    }

    const newLogId = uuidv4();
    const newEntry: FoodLog = {
      id: newLogId,
      date: targetDate,
      mealType: data.mealType,
      entryType,
      foodId: data.foodId,
      ...(entryType === 'item'
        ? {
            quantity: data.quantity ?? 100,
            ...(typeof data.grossQuantity === 'number' && data.grossQuantity > 0
              ? { grossQuantity: data.grossQuantity }
              : {}),
            unit: data.unit ?? 'g',
            ...(data.bundleId ? { bundleId: data.bundleId } : {}),
          }
        : {
            ...(data.scenario ? { scenario: data.scenario } : {}),
            ...(data.customTitle ? { customTitle: data.customTitle } : {}),
          }),
      foodName: data.foodName,
      calories: data.calories,
      carbs: data.carbs,
      protein: data.protein,
      fat: data.fat,
      isPlaceholder: data.isPlaceholder ?? (entryType === 'estimate'),
      isAsPlanned: data.isAsPlanned ?? (entryType === 'as_planned'),
      createdAt: now,
      updatedAt: now,
    };
    dailyLog.entries.push(newEntry);
    dailyLog.updatedAt = now;
    await db.daily_diet_logs.put(dailyLog);
    upsertInMemoryDailyDietLog(dailyLog);
    return newLogId;
  };

  const addQuickPlaceholder = async (data: {
    mealType: MealType;
    scenario?: string;
    customTitle?: string;
    foodName?: string;
    calories: number;
    carbs?: number;
    protein?: number;
    fat?: number;
    sugar?: number;
    fiber?: number;
    saturatedFat?: number;
    transFat?: number;
    sodium?: number;
    date?: string;
  }) => {
    const targetDate = data.date || date;
    const dailyLog = await getOrCreateDailyLog(targetDate);
    const now = Date.now();
    const newLogId = uuidv4();
    const customTitle =
      data.customTitle?.trim() ||
      (data.foodName &&
      !['快速估算', '快速粗估', 'Quick Estimate', '常規'].includes(data.foodName.trim())
        ? data.foodName.trim()
        : undefined);
    const newEntry: FoodLog = {
      id: newLogId,
      date: targetDate,
      mealType: data.mealType,
      entryType: 'estimate',
      scenario: data.scenario || 'balanced',
      ...(customTitle ? { customTitle } : {}),
      calories: Math.round(data.calories),
      carbs: data.carbs !== undefined ? Math.round(data.carbs * 10) / 10 : undefined,
      protein: data.protein !== undefined ? Math.round(data.protein * 10) / 10 : undefined,
      fat: data.fat !== undefined ? Math.round(data.fat * 10) / 10 : undefined,
      sugar: data.sugar !== undefined ? Math.round(data.sugar * 10) / 10 : undefined,
      fiber: data.fiber !== undefined ? Math.round(data.fiber * 10) / 10 : undefined,
      saturatedFat:
        data.saturatedFat !== undefined ? Math.round(data.saturatedFat * 10) / 10 : undefined,
      transFat: data.transFat !== undefined ? Math.round(data.transFat * 10) / 10 : undefined,
      sodium: data.sodium !== undefined ? Math.round(data.sodium) : undefined,
      isPlaceholder: true,
      createdAt: now,
      updatedAt: now,
    };
    dailyLog.entries.push(newEntry);
    dailyLog.updatedAt = now;
    await db.daily_diet_logs.put(dailyLog);
    upsertInMemoryDailyDietLog(dailyLog);
    return newLogId;
  };

  const addAsPlannedMeal = async (
    mealType: MealType,
    budget: { calories: number; carbs: number; protein: number; fat: number },
    options?: { date?: string; foodName?: string; customTitle?: string }
  ) => {
    const targetDate = options?.date || date;
    const dailyLog = await getOrCreateDailyLog(targetDate);
    const now = Date.now();
    const newLogId = uuidv4();
    const customTitle = options?.customTitle?.trim() || options?.foodName?.trim();
    const isGeneric =
      !customTitle ||
      customTitle.endsWith('配額') ||
      customTitle.endsWith('配额') ||
      customTitle.endsWith('Budget') ||
      customTitle === '正常飲食' ||
      customTitle === '正常饮食' ||
      customTitle === 'Regular Diet' ||
      customTitle === '算我正常吃' ||
      customTitle === '算我正常食' ||
      customTitle === '歷史均值' ||
      customTitle === '历史均值' ||
      customTitle === 'Past Average' ||
      customTitle === 'Historical Average';
    const finalCustomTitle = isGeneric ? undefined : customTitle;

    const newEntry: FoodLog = {
      id: newLogId,
      date: targetDate,
      mealType,
      entryType: 'as_planned',
      ...(finalCustomTitle ? { customTitle: finalCustomTitle } : {}),
      calories: Math.round(budget.calories),
      carbs: Math.round(budget.carbs * 10) / 10,
      protein: Math.round(budget.protein * 10) / 10,
      fat: Math.round(budget.fat * 10) / 10,
      isAsPlanned: true,
      createdAt: now,
      updatedAt: now,
    };
    dailyLog.entries.push(newEntry);
    dailyLog.updatedAt = now;
    await db.daily_diet_logs.put(dailyLog);
    upsertInMemoryDailyDietLog(dailyLog);
    return newLogId;
  };

  const addFoodLogBundle = async (
    bundleId: string,
    items: Array<Omit<FoodLog, 'id' | 'createdAt' | 'updatedAt' | 'bundleId'>>
  ) => {
    if (items.length === 0) return [];
    const targetDate = items[0].date || date;
    const dailyLog = await getOrCreateDailyLog(targetDate);
    const now = Date.now();
    const newEntries: FoodLog[] = items.map((item) => ({
      id: uuidv4(),
      date: targetDate,
      mealType: item.mealType,
      foodId: item.foodId,
      quantity: item.quantity,
      ...(typeof item.grossQuantity === 'number' && item.grossQuantity > 0
        ? { grossQuantity: item.grossQuantity }
        : {}),
      unit: item.unit,
      bundleId,
      createdAt: now,
      updatedAt: now,
    }));
    dailyLog.entries.push(...newEntries);
    dailyLog.updatedAt = now;
    await db.daily_diet_logs.put(dailyLog);
    upsertInMemoryDailyDietLog(dailyLog);
    return newEntries;
  };

  const updateFoodLog = async (id: string, updates: Partial<Omit<FoodLog, 'id' | 'createdAt'>>) => {
    let dailyLog = await db.daily_diet_logs.where('date').equals(date).first();
    let idx = dailyLog ? dailyLog.entries.findIndex((e) => e.id === id) : -1;
    if (idx === -1) {
      const allDailyLogs = await db.daily_diet_logs.toArray();
      for (const dLog of allDailyLogs) {
        const foundIdx = dLog.entries.findIndex((e) => e.id === id);
        if (foundIdx !== -1) {
          dailyLog = dLog;
          idx = foundIdx;
          break;
        }
      }
    }
    if (!dailyLog || idx === -1) return;
    const now = Date.now();
    const updatedEntry: FoodLog = {
      ...dailyLog.entries[idx],
      ...updates,
      updatedAt: now,
    };
    if (updates.grossQuantity === undefined && 'grossQuantity' in updates) {
      delete updatedEntry.grossQuantity;
    }
    dailyLog.entries[idx] = updatedEntry;
    dailyLog.updatedAt = now;
    await db.daily_diet_logs.put(dailyLog);
    upsertInMemoryDailyDietLog(dailyLog);
  };

  const deleteFoodLog = async (id: string) => {
    let dailyLog = await db.daily_diet_logs.where('date').equals(date).first();
    let idx = dailyLog ? dailyLog.entries.findIndex((e) => e.id === id) : -1;
    if (idx === -1) {
      const allDailyLogs = await db.daily_diet_logs.toArray();
      for (const dLog of allDailyLogs) {
        const foundIdx = dLog.entries.findIndex((e) => e.id === id);
        if (foundIdx !== -1) {
          dailyLog = dLog;
          idx = foundIdx;
          break;
        }
      }
    }
    if (!dailyLog || idx === -1) return;
    const now = Date.now();
    dailyLog.entries = dailyLog.entries.filter((e) => e.id !== id);
    dailyLog.deletedEntries = {
      ...(dailyLog.deletedEntries ?? {}),
      [id]: now,
    };
    dailyLog.updatedAt = now;
    await db.daily_diet_logs.put(dailyLog);
    upsertInMemoryDailyDietLog(dailyLog);
  };

  const deleteFoodLogBundle = async (bundleId: string) => {
    const dailyLog = await db.daily_diet_logs.where('date').equals(date).first();
    if (!dailyLog) return;
    const now = Date.now();
    const removedIds = dailyLog.entries.filter((e) => e.bundleId === bundleId).map((e) => e.id);
    dailyLog.entries = dailyLog.entries.filter((e) => e.bundleId !== bundleId);
    if (removedIds.length > 0) {
      const nextDeleted = { ...(dailyLog.deletedEntries ?? {}) };
      for (const removedId of removedIds) {
        nextDeleted[removedId] = now;
      }
      dailyLog.deletedEntries = nextDeleted;
    }
    dailyLog.updatedAt = now;
    await db.daily_diet_logs.put(dailyLog);
    upsertInMemoryDailyDietLog(dailyLog);
  };

  const updateFoodLogBundle = async (
    bundleId: string,
    items: Array<{
      id?: string;
      foodId?: string;
      quantity: number;
      unit: string;
    }>
  ) => {
    const dailyLog = await db.daily_diet_logs.where('date').equals(date).first();
    if (!dailyLog) return;
    const existing = dailyLog.entries.find((e) => e.bundleId === bundleId);
    if (!existing) return;
    const now = Date.now();
    const previousIds = dailyLog.entries.filter((e) => e.bundleId === bundleId).map((e) => e.id);
    const otherEntries = dailyLog.entries.filter((e) => e.bundleId !== bundleId);
    const updatedEntries: FoodLog[] = items.map((item) => ({
      id: item.id || uuidv4(),
      date,
      mealType: existing.mealType,
      bundleId,
      foodId: item.foodId,
      quantity: item.quantity,
      unit: item.unit,
      createdAt: existing.createdAt,
      updatedAt: now,
    }));
    const keptIdSet = new Set(updatedEntries.map((e) => e.id));
    const removedIds = previousIds.filter((prevId) => !keptIdSet.has(prevId));
    if (removedIds.length > 0) {
      const nextDeleted = { ...(dailyLog.deletedEntries ?? {}) };
      for (const removedId of removedIds) {
        nextDeleted[removedId] = now;
      }
      dailyLog.deletedEntries = nextDeleted;
    }
    dailyLog.entries = [...otherEntries, ...updatedEntries];
    dailyLog.updatedAt = now;
    await db.daily_diet_logs.put(dailyLog);
    upsertInMemoryDailyDietLog(dailyLog);
  };

  return {
    logs,
    totals,
    mealGroups,
    isLoading: queryResult === undefined,
    addFoodLog,
    addQuickPlaceholder,
    addAsPlannedMeal,
    addFoodLogBundle,
    updateFoodLog,
    updateFoodLogBundle,
    deleteFoodLog,
    deleteFoodLogBundle,
  };
}
