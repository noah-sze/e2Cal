import Dexie, { type Table } from 'dexie';
import type {
  FoodItem,
  FoodRecipe,
  DailyDietLog,
  Exercise,
  WorkoutRoutine,
  WorkoutLog,
  BodyMetric,
  UserProfile,
  UserBaseInfo,
  Equipment,
} from '@/types';
import {
  DEFAULT_EQUIPMENTS,
  DEFAULT_EXERCISES,
  PRIMARY_USER_ID,
  DEFAULT_USER_PROFILE_ID,
  restoreMissingDefaultData,
  resetDatabaseToFactory,
} from './defaultData';

export class E2CalDatabase extends Dexie {
  foods!: Table<FoodItem>;
  recipes!: Table<FoodRecipe>;
  daily_diet_logs!: Table<DailyDietLog>;
  exercises!: Table<Exercise>;
  routines!: Table<WorkoutRoutine>;
  equipments!: Table<Equipment>;
  workout_logs!: Table<WorkoutLog>;
  body_metrics!: Table<BodyMetric>;
  user_profile!: Table<UserProfile>;
  user_base_info!: Table<UserBaseInfo>;

  constructor() {
    super('e2CalDB');

    this.version(1).stores({
      foods: 'id, name, updatedAt',
      recipes: 'id, name, updatedAt',
      daily_diet_logs: 'id, &date, updatedAt',
      exercises: 'id, name, category, equipment, updatedAt',
      routines: 'id, name, updatedAt',
      equipments: 'id, name, updatedAt',
      workout_logs: 'id, date, title, createdAt, updatedAt',
      body_metrics: 'id, date, updatedAt',
      user_profile: 'id, updatedAt',
      user_base_info: 'id, updatedAt',
    });
  }

  async seedDefaultData() {
    const SEED_STORAGE_KEY = 'e2cal_seed_initialized';
    const isSeeded = typeof window !== 'undefined' && localStorage.getItem(SEED_STORAGE_KEY);
    if (isSeeded) {
      return;
    }

    const now = Date.now();
    const foodCount = await this.foods.count();
    const exerciseCount = await this.exercises.count();
    const equipmentCount = await this.equipments.count();

    // 若既有資料庫已存在數據，表示使用者已初始化過，僅記錄標記防復活，絕不覆寫或增補
    if (foodCount > 0 || exerciseCount > 0 || equipmentCount > 0) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(SEED_STORAGE_KEY, 'true');
      }
      return;
    }

    // 全新資料庫初始種子寫入 (食物與食譜庫出廠為空，由使用者自主打造)
    await this.equipments.bulkAdd(
      DEFAULT_EQUIPMENTS.map((eq) => ({ ...eq, createdAt: now, updatedAt: now }))
    );
    await this.exercises.bulkAdd(
      DEFAULT_EXERCISES.map((ex) => ({ ...ex, createdAt: now, updatedAt: now }))
    );

    const profileCount = await this.user_profile.count();
    if (profileCount === 0) {
      await this.user_profile.add({
        id: DEFAULT_USER_PROFILE_ID,
        name: '',
        gender: 'male',
        heightCm: 0,
        currentWeightKg: 0,
        activityLevel: 1.2,
        goalType: 'lose_fat',
        weightUnit: 'kg',
        isSetupCompleted: false,
        updatedAt: now,
      });
    }

    const baseInfoCount = await this.user_base_info.count();
    if (baseInfoCount === 0) {
      await this.user_base_info.add({
        id: PRIMARY_USER_ID,
        name: '',
        gender: 'male',
        birthDate: '',
        heightCm: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(SEED_STORAGE_KEY, 'true');
    }
  }

  async restoreDefaultData() {
    return await restoreMissingDefaultData(this);
  }

  /**
   * 徹底出廠重置：清空所有業務日誌與自定義資料，恢復預設實體與個人出廠狀態，斷開雲端同步
   */
  async resetToFactoryDefaults() {
    return await resetDatabaseToFactory(this);
  }

  /**
   * 導出整座資料庫所有表的原始無損數據快照（供除錯與架構審查）
   */
  async exportRawSnapshot(): Promise<Record<string, unknown[]>> {
    const snapshot: Record<string, unknown[]> = {};
    for (const table of this.tables) {
      snapshot[table.name] = await table.toArray();
    }
    return snapshot;
  }

  /**
   * 瀏覽器控制台便捷除錯：一鍵將全資料庫下載為格式化 JSON 檔案
   */
  async dump() {
    if (typeof window === 'undefined') return;
    const snapshot = await this.exportRawSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `e2cal-raw-db-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('[e2CalDB] 原始資料庫快照已匯出下載。包含表格：', Object.keys(snapshot));
    return snapshot;
  }
}

export const db = new E2CalDatabase();

// ── 全域資料庫寫入監聽與自動同步防迴圈守衛 ──────────────────────────────
let autoSyncSuppressDepth = 0;
const dbMutationListeners = new Set<() => void>();
let pendingMutationMicrotask = false;

export type SyncTombstoneTable =
  | 'foods'
  | 'recipes'
  | 'exercises'
  | 'equipments'
  | 'routines'
  | 'workout_logs'
  | 'body_metrics';

export type EntityTombstoneMap = Partial<Record<SyncTombstoneTable, Record<string, number>>>;

const ENTITY_TOMBSTONES_STORAGE_KEY = 'e2cal_deleted_entity_tombstones';
const ENTITY_TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function getLocalEntityTombstones(now: number = Date.now()): EntityTombstoneMap {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(ENTITY_TOMBSTONES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Record<string, number>>;
    const cleaned: EntityTombstoneMap = {};
    for (const [tbl, map] of Object.entries(parsed)) {
      if (!map || typeof map !== 'object') continue;
      const valid: Record<string, number> = {};
      for (const [id, ts] of Object.entries(map)) {
        if (id && typeof ts === 'number' && Number.isFinite(ts) && ts > 0 && now - ts <= ENTITY_TOMBSTONE_RETENTION_MS) {
          valid[id] = ts;
        }
      }
      if (Object.keys(valid).length > 0) {
        cleaned[tbl as SyncTombstoneTable] = valid;
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

export function setLocalEntityTombstones(map: EntityTombstoneMap): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const hasAny = Object.values(map).some((m) => m && Object.keys(m).length > 0);
    if (!hasAny) {
      localStorage.removeItem(ENTITY_TOMBSTONES_STORAGE_KEY);
    } else {
      localStorage.setItem(ENTITY_TOMBSTONES_STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // ignore storage errors
  }
}

function recordEntityDeletion(table: SyncTombstoneTable, id: unknown): void {
  if (autoSyncSuppressDepth > 0) return;
  const key = typeof id === 'string' ? id : String(id || '');
  if (!key) return;
  const now = Date.now();
  const current = getLocalEntityTombstones(now);
  const tableMap = { ...(current[table] ?? {}), [key]: now };
  setLocalEntityTombstones({ ...current, [table]: tableMap });
}

function clearEntityDeletion(table: SyncTombstoneTable, id: unknown): void {
  if (autoSyncSuppressDepth > 0) return;
  const key = typeof id === 'string' ? id : String(id || '');
  if (!key) return;
  const current = getLocalEntityTombstones();
  if (!current[table]?.[key]) return;
  const nextTableMap = { ...current[table] };
  delete nextTableMap[key];
  setLocalEntityTombstones({ ...current, [table]: nextTableMap });
}

function notifyDatabaseMutated(): void {
  if (autoSyncSuppressDepth > 0 || dbMutationListeners.size === 0) return;
  if (pendingMutationMicrotask) return;
  pendingMutationMicrotask = true;
  Promise.resolve().then(() => {
    pendingMutationMicrotask = false;
    if (autoSyncSuppressDepth > 0) return;
    dbMutationListeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('[e2CalDB] mutation listener error:', err);
      }
    });
  });
}

/**
 * 在同步拉取或系統種子寫入本機 IndexedDB 期間暫時抑制自動同步觸發，防止無限迴圈
 */
export async function withAutoSyncSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  autoSyncSuppressDepth += 1;
  try {
    return await fn();
  } finally {
    autoSyncSuppressDepth = Math.max(0, autoSyncSuppressDepth - 1);
  }
}

/**
 * 訂閱本機業務資料表的任何新增、修改、刪除事件
 */
export function onDatabaseMutated(listener: () => void): () => void {
  dbMutationListeners.add(listener);
  return () => {
    dbMutationListeners.delete(listener);
  };
}

/**
 * 清除所有資料庫變更監聽器（供全量清空網站數據前徹底靜默背景同步使用）
 */
export function clearDatabaseMutationListeners(): void {
  dbMutationListeners.clear();
  pendingMutationMicrotask = false;
}

function registerSyncMutationHooks(database: E2CalDatabase): void {
  const entityTables: Array<{ key?: SyncTombstoneTable; table: Table }> = [
    { table: database.user_base_info },
    { table: database.user_profile },
    { key: 'foods', table: database.foods },
    { key: 'recipes', table: database.recipes },
    { table: database.daily_diet_logs },
    { key: 'equipments', table: database.equipments },
    { key: 'exercises', table: database.exercises },
    { key: 'routines', table: database.routines },
    { key: 'workout_logs', table: database.workout_logs },
    { key: 'body_metrics', table: database.body_metrics },
  ];

  for (const { key, table } of entityTables) {
    table.hook('creating', (primKey) => {
      if (key) clearEntityDeletion(key, primKey);
      notifyDatabaseMutated();
    });
    table.hook('updating', (_mods, primKey) => {
      if (key) clearEntityDeletion(key, primKey);
      notifyDatabaseMutated();
    });
    table.hook('deleting', (primKey) => {
      if (key) recordEntityDeletion(key, primKey);
      notifyDatabaseMutated();
    });
  }
}

registerSyncMutationHooks(db);

// 自動檢查初始化種子資料（抑制自動同步觸發）
withAutoSyncSuppressed(() => db.seedDefaultData()).catch(console.error);

// 僅於開發環境掛載至 window 便於 Console 即時檢視
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as Window & { db?: E2CalDatabase }).db = db;
}
