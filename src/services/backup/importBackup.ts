import type JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import { db, withAutoSyncSuppressed } from '@/services/db/db';
import { confirmRawWeightIfHasDietActivity } from '@/utils/rawWeightGuide';
import {
  sanitizeFoodItem,
  sanitizeUserBaseInfo,
  sanitizeRecipe,
  sanitizeDailyDietLog,
  sanitizeWorkoutLog,
  sanitizeWorkoutRoutine,
} from '@/services/sync/syncSanitizers';

export { sanitizeFoodItem };
import type {
  FoodItem,
  FoodRecipe,
  DailyDietLog,
  Exercise,
  Equipment,
  WorkoutRoutine,
  WorkoutLog,
  BodyMetric,
  UserBaseInfo,
} from '@/types';

export type ImportStrategy = 'merge' | 'overwrite';

export interface ImportBackupStats {
  baseInfo: number;
  foods: number;
  recipes: number;
  dailyDietLogs: number;
  exercises: number;
  equipments: number;
  routines: number;
  workoutLogs: number;
  bodyMetrics: number;
  total: number;
}

export interface ImportBackupResult {
  success: boolean;
  stats: ImportBackupStats;
}

export interface ParsedBackupData {
  baseInfos: UserBaseInfo[];
  foods: FoodItem[];
  recipes: FoodRecipe[];
  dailyDietLogs: DailyDietLog[];
  exercises: Exercise[];
  equipments: Equipment[];
  routines: WorkoutRoutine[];
  workoutLogs: WorkoutLog[];
  bodyMetrics: BodyMetric[];
  total: number;
}

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
}

export function sanitizeExercise(rawInput: unknown): Exercise {
  const raw = asRecord(rawInput);
  const rawId = String(raw.id || uuidv4());
  const rawEq = String(raw.equipment || 'bodyweight');
  return {
    id: rawId,
    name: String(raw.name || '').trim(),
    ...(raw.category ? { category: raw.category as Exercise['category'] } : {}),
    equipment: rawEq,
    targetMuscles: (raw.targetMuscles as Exercise['targetMuscles']) || {},
    ...(raw.notes ? { notes: String(raw.notes) } : {}),
    isCustom: Boolean(raw.isCustom),
    isArchived: Boolean(raw.isArchived),
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    ...(raw.rev !== undefined ? { rev: Number(raw.rev) } : {}),
  };
}

export function sanitizeEquipment(rawInput: unknown): Equipment {
  const raw = asRecord(rawInput);
  const rawId = String(raw.id || uuidv4());
  return {
    id: rawId,
    name: String(raw.name || '').trim(),
    isCustom: Boolean(raw.isCustom),
    isArchived: Boolean(raw.isArchived),
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    ...(raw.rev !== undefined ? { rev: Number(raw.rev) } : {}),
  };
}

/** 僅保留有限數值，剔除 null、空字串與 NaN / Infinity */
function finiteOrUndefined(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const num = Number(val);
  return Number.isFinite(num) ? num : undefined;
}

export function sanitizeBodyMetric(rawInput: unknown): BodyMetric {
  const raw = asRecord(rawInput);
  const rawId = String(raw.id || uuidv4());
  const weight = finiteOrUndefined(raw.weight);
  const bodyFat = finiteOrUndefined(raw.bodyFat) ?? finiteOrUndefined(raw.bodyFatPercentage);
  const muscleMass = finiteOrUndefined(raw.muscleMass);
  const waistCm = finiteOrUndefined(raw.waistCm);
  const hipsCm = finiteOrUndefined(raw.hipsCm);
  const chestCm = finiteOrUndefined(raw.chestCm);
  const shouldersCm = finiteOrUndefined(raw.shouldersCm);
  const armsCm = finiteOrUndefined(raw.armsCm);
  const thighsCm = finiteOrUndefined(raw.thighsCm);
  const calvesCm = finiteOrUndefined(raw.calvesCm);
  const waterMl = finiteOrUndefined(raw.waterMl);
  const rev = finiteOrUndefined(raw.rev);

  return {
    id: rawId,
    date: String(raw.date || ''),
    ...(weight !== undefined ? { weight } : {}),
    ...(bodyFat !== undefined ? { bodyFat } : {}),
    ...(muscleMass !== undefined ? { muscleMass } : {}),
    ...(waistCm !== undefined ? { waistCm } : {}),
    ...(hipsCm !== undefined ? { hipsCm } : {}),
    ...(chestCm !== undefined ? { chestCm } : {}),
    ...(shouldersCm !== undefined ? { shouldersCm } : {}),
    ...(armsCm !== undefined ? { armsCm } : {}),
    ...(thighsCm !== undefined ? { thighsCm } : {}),
    ...(calvesCm !== undefined ? { calvesCm } : {}),
    ...(waterMl !== undefined ? { waterMl } : {}),
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    ...(rev !== undefined ? { rev } : {}),
  };
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    if (item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

/**
 * 解析備份檔案內容至記憶體（僅支援標準 e2Cal ZIP 備份包）
 * 不修改資料庫，供前置檢查與對比展示使用
 */
export async function parseBackupFile(file: File | Blob): Promise<ParsedBackupData> {
  const baseInfos: UserBaseInfo[] = [];
  const foods: FoodItem[] = [];
  const recipes: FoodRecipe[] = [];
  const dailyDietLogs: DailyDietLog[] = [];
  const exercises: Exercise[] = [];
  const equipments: Equipment[] = [];
  const routines: WorkoutRoutine[] = [];
  const workoutLogs: WorkoutLog[] = [];
  const bodyMetrics: BodyMetric[] = [];

  let zip: JSZip | null = null;
  let isZipLoaded = false;

  // 1. 以 JSZip 解開備份壓縮包
  try {
    const { default: JSZip } = await import('jszip');
    zip = await JSZip.loadAsync(file);
    isZipLoaded = Object.keys(zip.files).length > 0;
  } catch {
    zip = null;
    isZipLoaded = false;
  }

  // 2. 若為 ZIP 壓縮包，遍歷檔案讀取
  if (zip && isZipLoaded) {
    for (const [rawPath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      const path = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');

      if (/(?:^|\/)user\/base_info\.json$/i.test(path)) {
        const text = await zipEntry.async('string');
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        baseInfos.push(...arr.map(sanitizeUserBaseInfo));
      } else if (/(?:^|\/)nutrition\/foods\.json$/i.test(path)) {
        const text = await zipEntry.async('string');
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        foods.push(...arr.map(sanitizeFoodItem));
      } else if (/(?:^|\/)nutrition\/recipes\.json$/i.test(path)) {
        const text = await zipEntry.async('string');
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        recipes.push(...arr.map(sanitizeRecipe));
      } else if (/(?:^|\/)nutrition\/logs\/([^/]+)\.json$/i.test(path)) {
        const match = path.match(/(?:^|\/)nutrition\/logs\/([^/]+)\.json$/i);
        if (match && match[1] !== 'manifest') {
          const text = await zipEntry.async('string');
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            dailyDietLogs.push(...parsed.map(sanitizeDailyDietLog));
          } else {
            dailyDietLogs.push(sanitizeDailyDietLog(parsed));
          }
        }
      } else if (/(?:^|\/)workout\/exercises\.json$/i.test(path)) {
        const text = await zipEntry.async('string');
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        exercises.push(...arr.map(sanitizeExercise));
      } else if (/(?:^|\/)workout\/equipments\.json$/i.test(path)) {
        const text = await zipEntry.async('string');
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        equipments.push(...arr.map(sanitizeEquipment));
      } else if (/(?:^|\/)workout\/routines\.json$/i.test(path)) {
        const text = await zipEntry.async('string');
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        routines.push(...arr.map(sanitizeWorkoutRoutine));
      } else if (/(?:^|\/)workout\/logs\/([^/]+)\.json$/i.test(path)) {
        const match = path.match(/(?:^|\/)workout\/logs\/([^/]+)\.json$/i);
        if (match && match[1] !== 'manifest') {
          const text = await zipEntry.async('string');
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            workoutLogs.push(...parsed.map(sanitizeWorkoutLog));
          } else {
            workoutLogs.push(sanitizeWorkoutLog(parsed));
          }
        }
      } else if (/(?:^|\/)body\/metrics\/([^/]+)\.json$/i.test(path)) {
        const match = path.match(/(?:^|\/)body\/metrics\/([^/]+)\.json$/i);
        if (match && match[1] !== 'manifest') {
          const text = await zipEntry.async('string');
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            bodyMetrics.push(...parsed.map(sanitizeBodyMetric));
          } else {
            bodyMetrics.push(sanitizeBodyMetric(parsed));
          }
        }
      }
    }
  }

  // 3. 去重與標準化
  const dedupedBaseInfos = dedupeById(baseInfos);
  const dedupedFoods = dedupeById(foods);
  const dedupedRecipes = dedupeById(recipes);
  const dedupedExercises = dedupeById(exercises);
  const dedupedEquipments = dedupeById(equipments);
  const dedupedRoutines = dedupeById(routines);
  const dedupedWorkoutLogs = dedupeById(workoutLogs);
  const dedupedBodyMetrics = dedupeById(bodyMetrics);

  // dailyDietLogs 依照 date 唯一去重
  const dietLogsByDate = new Map<string, DailyDietLog>();
  for (const log of dailyDietLogs) {
    if (log.date) {
      dietLogsByDate.set(log.date, log);
    }
  }
  const dedupedDailyDietLogs = Array.from(dietLogsByDate.values());

  const total =
    dedupedBaseInfos.length +
    dedupedFoods.length +
    dedupedRecipes.length +
    dedupedDailyDietLogs.length +
    dedupedExercises.length +
    dedupedEquipments.length +
    dedupedRoutines.length +
    dedupedWorkoutLogs.length +
    dedupedBodyMetrics.length;

  if (total === 0) {
    throw new Error('INVALID_BACKUP_FILE');
  }

  return {
    baseInfos: dedupedBaseInfos,
    foods: dedupedFoods,
    recipes: dedupedRecipes,
    dailyDietLogs: dedupedDailyDietLogs,
    exercises: dedupedExercises,
    equipments: dedupedEquipments,
    routines: dedupedRoutines,
    workoutLogs: dedupedWorkoutLogs,
    bodyMetrics: dedupedBodyMetrics,
    total,
  };
}

/**
 * 執行已解析資料寫入 IndexedDB（支援合併或完全覆蓋）
 */
export async function executeImport(
  data: ParsedBackupData,
  strategy: ImportStrategy = 'merge'
): Promise<ImportBackupResult> {
  const {
    baseInfos,
    foods,
    recipes,
    dailyDietLogs,
    exercises,
    equipments,
    routines,
    workoutLogs,
    bodyMetrics,
    total,
  } = data;

  await withAutoSyncSuppressed(() =>
    db.transaction(
      'rw',
      [
        db.user_base_info,
        db.user_profile,
        db.foods,
        db.recipes,
        db.daily_diet_logs,
        db.exercises,
        db.equipments,
        db.routines,
        db.workout_logs,
        db.body_metrics,
      ],
      async () => {
        // 若為完全覆蓋策略，先清空所有相關資料庫表
        if (strategy === 'overwrite') {
          await Promise.all([
            db.user_base_info.clear(),
            db.user_profile.clear(),
            db.foods.clear(),
            db.recipes.clear(),
            db.daily_diet_logs.clear(),
            db.exercises.clear(),
            db.equipments.clear(),
            db.routines.clear(),
            db.workout_logs.clear(),
            db.body_metrics.clear(),
          ]);
        } else {
          // 合併策略：飲食日誌防重，若該日已存在日誌，沿用其 ID 防範 &date 唯一鍵衝突
          for (const log of dailyDietLogs) {
            const existing = await db.daily_diet_logs.where('date').equals(log.date).first();
            if (existing) {
              log.id = existing.id;
            }
          }
        }

        if (baseInfos.length > 0) {
          await db.user_base_info.bulkPut(baseInfos);
          // 同步更新 user_profile 表保持 UI 即時響應
          const primary = baseInfos[0];
          const existingProfile = await db.user_profile.toCollection().first();
          if (existingProfile) {
            await db.user_profile.update(existingProfile.id, {
              name: primary.name,
              gender: primary.gender,
              birthDate: primary.birthDate,
              heightCm: primary.heightCm,
              updatedAt: Date.now(),
            });
          }
        }

        if (foods.length > 0) await db.foods.bulkPut(foods);
        if (recipes.length > 0) await db.recipes.bulkPut(recipes);
        if (dailyDietLogs.length > 0) await db.daily_diet_logs.bulkPut(dailyDietLogs);
        if (exercises.length > 0) await db.exercises.bulkPut(exercises);
        if (equipments.length > 0) await db.equipments.bulkPut(equipments);
        if (routines.length > 0) await db.routines.bulkPut(routines);
        if (workoutLogs.length > 0) await db.workout_logs.bulkPut(workoutLogs);
        if (bodyMetrics.length > 0) await db.body_metrics.bulkPut(bodyMetrics);
      }
    )
  );

  confirmRawWeightIfHasDietActivity({
    foodsCount: foods.length,
    recipesCount: recipes.length,
    dailyDietLogs,
  });

  return {
    success: true,
    stats: {
      baseInfo: baseInfos.length,
      foods: foods.length,
      recipes: recipes.length,
      dailyDietLogs: dailyDietLogs.length,
      exercises: exercises.length,
      equipments: equipments.length,
      routines: routines.length,
      workoutLogs: workoutLogs.length,
      bodyMetrics: bodyMetrics.length,
      total,
    },
  };
}

/**
 * 一鍵解析並匯入備份（支援合併或完全覆蓋）
 */
export async function importBackup(
  file: File | Blob,
  strategy: ImportStrategy = 'merge'
): Promise<ImportBackupResult> {
  const parsed = await parseBackupFile(file);
  return await executeImport(parsed, strategy);
}
