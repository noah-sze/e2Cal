import {
  db,
  withAutoSyncSuppressed,
  getLocalEntityTombstones,
  setLocalEntityTombstones,
  type EntityTombstoneMap,
  type SyncTombstoneTable,
} from '@/services/db/db';
import type {
  FoodItem,
  FoodRecipe,
  FoodLog,
  DailyDietLog,
  Exercise,
  Equipment,
  WorkoutRoutine,
  WorkoutLog,
  BodyMetric,
  UserBaseInfo,
} from '@/types';
import i18n from '@/i18n/config';
import { toast } from '@/components/ui/toast';
import { confirmRawWeightIfHasDietActivity } from '@/utils/rawWeightGuide';
import {
  getSyncErrorReasonKey,
  formatSyncErrorMessage,
  type SyncErrorReasonKey,
  type DropboxFileMetadata,
} from './dropboxClient';
import {
  getWorkingSyncAdapter,
  getProviderScopedStorageKey,
  isCloudSyncConnected,
} from './syncRouter';

const listRemoteFolder = (folderPath = '') =>
  getWorkingSyncAdapter().listRemoteFolder(folderPath);
const downloadJsonFile = <T>(filePath: string) =>
  getWorkingSyncAdapter().downloadJsonFile<T>(filePath);
const uploadJsonFile = <T>(filePath: string, data: T, expectedRev?: string) =>
  getWorkingSyncAdapter().uploadJsonFile<T>(filePath, data, expectedRev);
const deleteRemotePath = (path: string) =>
  getWorkingSyncAdapter().deleteRemotePath(path);
import {
  sanitizeFoodItem,
  sanitizeRecipe,
  sanitizeWorkoutLog,
  sanitizeWorkoutRoutine,
  sanitizeUserBaseInfo,
} from './syncSanitizers';
import { clearFoodsCache } from '@/hooks/useFoods';
import {
  SYNC_PATHS,
  CURRENT_SYNC_SCHEMA_VERSION,
  getMonthLogPath,
  isMonthlyLogFilePath,
  groupRecordsByMonth,
  parseMonthlyLogBucketStrict,
  assertCompatibleSchemaVersion,
  assertValidArrayPayload,
  redactSyncSecrets,
  type MonthlySyncLogBucket,
} from './syncSchema';
import { isDeviceOffline, reportNetworkError } from '@/hooks/useNetworkStatus';

export { getSyncErrorReasonKey, formatSyncErrorMessage, type SyncErrorReasonKey };

const LAST_SYNC_KEY = 'e2cal_dropbox_last_sync';
const CACHED_REVS_KEY = 'e2cal_dropbox_cached_revs';
const PENDING_AUTO_SYNC_KEY = 'e2cal_dropbox_pending_sync';
const TABLE_PUSH_TIME_KEY = 'e2cal_dropbox_pushed_times';

export interface SyncResult {
  success: boolean;
  timestamp: string;
  error?: string;
  actionTaken: 'uploaded_initial' | 'merged' | 'downloaded_remote' | 'uploaded_local' | 'up_to_date';
}

export interface SyncEngineStatus {
  isSyncing: boolean;
  lastSyncTime: string | null;
  lastSyncError: string | null;
  justSynced: boolean;
}

let currentSyncStatus: SyncEngineStatus = {
  isSyncing: false,
  lastSyncTime: null,
  lastSyncError: null,
  justSynced: false,
};

const syncStatusListeners = new Set<(status: SyncEngineStatus) => void>();
let justSyncedTimer: ReturnType<typeof setTimeout> | null = null;

export function getSyncEngineStatus(): SyncEngineStatus {
  if (currentSyncStatus.lastSyncTime === null) {
    currentSyncStatus.lastSyncTime = getLastSyncTime();
  }
  return { ...currentSyncStatus };
}

export function updateSyncEngineStatus(patch: Partial<SyncEngineStatus>): void {
  currentSyncStatus = { ...currentSyncStatus, ...patch };
  syncStatusListeners.forEach((fn) => {
    try {
      fn(currentSyncStatus);
    } catch (e) {
      console.error('Error in sync status listener:', e);
    }
  });
}

export function onSyncEngineStatusChange(listener: (status: SyncEngineStatus) => void): () => void {
  syncStatusListeners.add(listener);
  listener(getSyncEngineStatus());
  return () => {
    syncStatusListeners.delete(listener);
  };
}

export interface SyncManifestStats {
  foodsCount: number;
  recipesCount: number;
  dailyDietLogsCount: number;
  exercisesCount: number;
  equipmentsCount: number;
  routinesCount: number;
  workoutLogsCount: number;
  bodyMetricsCount: number;
}

export interface SyncManifest {
  appName: string;
  schemaVersion: number;
  exportedAt: string;
  stats: SyncManifestStats;
}

export interface BucketInfo {
  count: number;
  updatedAt: number;
}

export interface BucketManifest {
  version: number;
  updatedAt: string;
  buckets: Record<string, BucketInfo>;
}

let isSyncInProgress = false;
let hasPendingSyncRequest = false;
let pendingSyncMode: 'auto' | 'overwrite_local' | 'overwrite_remote' = 'auto';
let autoSyncTimeout: ReturnType<typeof setTimeout> | null = null;
let conflictRetryCount = 0;
const MAX_CONFLICT_RETRIES = 2;

export function _resetConflictRetryCount(): void {
  conflictRetryCount = 0;
}

export function _getConflictRetryCount(): number {
  return conflictRetryCount;
}

export function getLastSyncTime(): string | null {
  return localStorage.getItem(getProviderScopedStorageKey(LAST_SYNC_KEY));
}

export function setLastSyncTime(isoTime: string): void {
  localStorage.setItem(getProviderScopedStorageKey(LAST_SYNC_KEY), isoTime);
  updateSyncEngineStatus({ lastSyncTime: isoTime });
}

export function getCachedRevs(): Record<string, string> {
  try {
    const raw = localStorage.getItem(getProviderScopedStorageKey(CACHED_REVS_KEY));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function setCachedRevs(revs: Record<string, string>): void {
  localStorage.setItem(getProviderScopedStorageKey(CACHED_REVS_KEY), JSON.stringify(revs));
}

export function getPushedTimes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(getProviderScopedStorageKey(TABLE_PUSH_TIME_KEY));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function setPushedTimes(times: Record<string, string>): void {
  localStorage.setItem(getProviderScopedStorageKey(TABLE_PUSH_TIME_KEY), JSON.stringify(times));
}

/**
 * 標準化時間戳轉為數字毫秒，保證數值與 ISO 字串能準確對齊比較
 */
export function getNormalizedTimestamp(ts?: number | string): number {
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string' && ts) {
    const parsed = new Date(ts).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function preserveNutrientsIfMissing<T>(chosen: T, fallback: T): T {
  const c = chosen as Record<string, unknown>;
  const f = fallback as Record<string, unknown>;
  const numericKeys = ['refuseRate', 'edibleRate'] as const;
  const metaKeys = ['refuseDescription', 'dataSource', 'micros'] as const;
  let enhanced = false;
  let result: Record<string, unknown> | null = null;

  for (const k of numericKeys) {
    if ((result ? result[k] : c[k]) === undefined) {
      if (typeof f[k] === 'number' && !Number.isNaN(f[k])) {
        if (!result) result = { ...c };
        result[k] = f[k];
        enhanced = true;
      }
    }
  }
  for (const k of metaKeys) {
    if ((result ? result[k] : c[k]) === undefined && f[k] !== undefined) {
      if (!result) result = { ...c };
      result[k] = f[k];
      enhanced = true;
    }
  }

  if (
    typeof c.macros === 'object' &&
    c.macros !== null &&
    typeof f.macros === 'object' &&
    f.macros !== null
  ) {
    const cMacros = c.macros as Record<string, unknown>;
    const fMacros = f.macros as Record<string, unknown>;
    const nextMacros: Record<string, unknown> = { ...cMacros };
    let macrosEnhanced = false;

    const backfillSub = (
      groupKey: 'carbs' | 'fat',
      subKeys: readonly string[]
    ) => {
      const cGroup = cMacros[groupKey];
      const fGroup = fMacros[groupKey];
      if (
        typeof cGroup === 'object' &&
        cGroup !== null &&
        typeof fGroup === 'object' &&
        fGroup !== null
      ) {
        const cg = cGroup as Record<string, unknown>;
        const fg = fGroup as Record<string, unknown>;
        let nextGroup: Record<string, unknown> | null = null;
        for (const sk of subKeys) {
          if ((nextGroup ? nextGroup[sk] : cg[sk]) === undefined) {
            if (typeof fg[sk] === 'number' && !Number.isNaN(fg[sk])) {
              if (!nextGroup) nextGroup = { ...cg };
              nextGroup[sk] = fg[sk];
            }
          }
        }
        if (nextGroup) {
          nextMacros[groupKey] = nextGroup;
          macrosEnhanced = true;
        }
      }
    };

    backfillSub('carbs', ['sugar', 'fiber']);
    backfillSub('fat', ['saturated', 'trans']);

    if (nextMacros.sodium === undefined) {
      if (typeof fMacros.sodium === 'number' && !Number.isNaN(fMacros.sodium)) {
        nextMacros.sodium = fMacros.sodium;
        macrosEnhanced = true;
      }
    }

    if (macrosEnhanced) {
      if (!result) result = { ...c };
      result.macros = nextMacros;
      enhanced = true;
    }
  }

  return enhanced && result ? (result as T) : chosen;
}

/**
 * 核心演算法：支援邏輯版本號 (rev) 與時間戳雙重防護的 LWW (Last-Write-Wins) 合併
 */
const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const DELETED_ENTITIES_PATH = '/deleted_entities.json';

const TOMBSTONE_TABLES: readonly SyncTombstoneTable[] = [
  'foods',
  'recipes',
  'exercises',
  'equipments',
  'routines',
  'workout_logs',
  'body_metrics',
];

export function mergeEntityTombstoneMaps(
  local: EntityTombstoneMap,
  remote: EntityTombstoneMap,
  now: number = Date.now()
): { merged: EntityTombstoneMap; changedLocal: boolean; changedRemote: boolean } {
  const merged: EntityTombstoneMap = {};
  let changedLocal = false;
  let changedRemote = false;

  for (const table of TOMBSTONE_TABLES) {
    const lMap = local[table] ?? {};
    const rMap = remote[table] ?? {};
    const allIds = new Set<string>([...Object.keys(lMap), ...Object.keys(rMap)]);
    const nextMap: Record<string, number> = {};

    for (const id of allIds) {
      const lTs = Number(lMap[id]) || 0;
      const rTs = Number(rMap[id]) || 0;
      const validL = lTs > 0 && now - lTs <= TOMBSTONE_RETENTION_MS ? lTs : 0;
      const validR = rTs > 0 && now - rTs <= TOMBSTONE_RETENTION_MS ? rTs : 0;
      const maxTs = Math.max(validL, validR);
      if (maxTs > 0) {
        nextMap[id] = maxTs;
        if (maxTs > validL) changedLocal = true;
        if (maxTs > validR) changedRemote = true;
      }
    }

    if (Object.keys(nextMap).length > 0) {
      merged[table] = nextMap;
    }
  }

  return { merged, changedLocal, changedRemote };
}

function getMaxTombstoneTime(map?: Record<string, number>): number {
  if (!map) return 0;
  let max = 0;
  for (const ts of Object.values(map)) {
    if (typeof ts === 'number' && Number.isFinite(ts) && ts > max) {
      max = ts;
    }
  }
  return max;
}

export function mergeEntities<T extends { id: string; updatedAt?: number | string; rev?: number }>(
  localList: T[],
  remoteList: T[],
  deletedTombstones?: Record<string, number>,
  now: number = Date.now()
): { merged: T[]; deletedIds: string[]; hasLocalChanges: boolean; hasRemoteChanges: boolean } {
  const localMap = new Map<string, T>(localList.map((item) => [item.id, item]));
  const remoteMap = new Map<string, T>(remoteList.map((item) => [item.id, item]));
  const mergedMap = new Map<string, T>();
  const deletedIds: string[] = [];

  let hasLocalChanges = false;
  let hasRemoteChanges = false;

  const isTombstoned = (id: string, itemTime: number): boolean => {
    const delTs = deletedTombstones?.[id];
    if (!delTs || now - delTs > TOMBSTONE_RETENTION_MS) return false;
    return delTs >= itemTime;
  };

  for (const localItem of localList) {
    const remoteItem = remoteMap.get(localItem.id);
    if (!remoteItem) {
      const localTime = getNormalizedTimestamp(localItem.updatedAt);
      if (isTombstoned(localItem.id, localTime)) {
        deletedIds.push(localItem.id);
        hasLocalChanges = true;
      } else {
        mergedMap.set(localItem.id, localItem);
        hasRemoteChanges = true;
      }
    } else {
      const localRev = localItem.rev || 1;
      const remoteRev = remoteItem.rev || 1;
      const localTime = getNormalizedTimestamp(localItem.updatedAt);
      const remoteTime = getNormalizedTimestamp(remoteItem.updatedAt);

      let chosen: T;
      // 1. 優先比對單調遞增邏輯版本號
      if (remoteRev > localRev) {
        chosen = preserveNutrientsIfMissing(remoteItem, localItem);
        hasLocalChanges = true;
      } else if (localRev > remoteRev) {
        chosen = preserveNutrientsIfMissing(localItem, remoteItem);
        hasRemoteChanges = true;
      } else {
        // 2. 版本號相同時，以最新時間戳為仲裁
        if (remoteTime > localTime) {
          chosen = preserveNutrientsIfMissing(remoteItem, localItem);
          hasLocalChanges = true;
        } else if (localTime > remoteTime) {
          chosen = preserveNutrientsIfMissing(localItem, remoteItem);
          hasRemoteChanges = true;
        } else {
          chosen = preserveNutrientsIfMissing(localItem, remoteItem);
        }
      }

      const chosenTime = Math.max(localTime, remoteTime);
      if (isTombstoned(localItem.id, chosenTime)) {
        deletedIds.push(localItem.id);
        hasLocalChanges = true;
        hasRemoteChanges = true;
      } else {
        mergedMap.set(localItem.id, chosen);
      }
    }
  }

  for (const remoteItem of remoteList) {
    if (!localMap.has(remoteItem.id)) {
      const remoteTime = getNormalizedTimestamp(remoteItem.updatedAt);
      if (isTombstoned(remoteItem.id, remoteTime)) {
        hasRemoteChanges = true;
      } else {
        mergedMap.set(remoteItem.id, remoteItem);
        hasLocalChanges = true;
      }
    }
  }

  return {
    merged: Array.from(mergedMap.values()),
    deletedIds,
    hasLocalChanges,
    hasRemoteChanges,
  };
}

function mergeDietEntries(
  localLog: DailyDietLog,
  remoteLog: DailyDietLog,
  localLogTime: number,
  remoteLogTime: number,
  now: number
): {
  entries: FoodLog[];
  deletedEntries?: Record<string, number>;
  entriesChangedLocal: boolean;
  entriesChangedRemote: boolean;
} {
  const localEntries = localLog.entries || [];
  const remoteEntries = remoteLog.entries || [];
  const localMap = new Map<string, FoodLog>(localEntries.map((e) => [e.id, e]));
  const remoteMap = new Map<string, FoodLog>(remoteEntries.map((e) => [e.id, e]));

  // 合併刪除墓碑並清理超過 30 天的過期記錄
  const rawDeleted: Record<string, number> = {};
  for (const [id, ts] of Object.entries(localLog.deletedEntries ?? {})) {
    if (Number.isFinite(ts) && ts > 0 && now - ts <= TOMBSTONE_RETENTION_MS) {
      rawDeleted[id] = Math.max(rawDeleted[id] ?? 0, ts);
    }
  }
  for (const [id, ts] of Object.entries(remoteLog.deletedEntries ?? {})) {
    if (Number.isFinite(ts) && ts > 0 && now - ts <= TOMBSTONE_RETENTION_MS) {
      rawDeleted[id] = Math.max(rawDeleted[id] ?? 0, ts);
    }
  }

  const mergedEntries: FoodLog[] = [];
  const finalDeleted: Record<string, number> = { ...rawDeleted };
  let entriesChangedLocal = false;
  let entriesChangedRemote = false;

  const allEntryIds = new Set<string>([...localMap.keys(), ...remoteMap.keys()]);

  for (const entryId of allEntryIds) {
    const localEntry = localMap.get(entryId);
    const remoteEntry = remoteMap.get(entryId);
    const deletedAt = rawDeleted[entryId] ?? 0;

    if (localEntry && !remoteEntry) {
      const localEntryTime = getNormalizedTimestamp(localEntry.updatedAt) || localLogTime;
      if (deletedAt > 0 && deletedAt >= localEntryTime) {
        entriesChangedLocal = true;
      } else {
        if (deletedAt > 0 && localEntryTime > deletedAt) {
          delete finalDeleted[entryId];
        }
        mergedEntries.push(localEntry);
        entriesChangedRemote = true;
      }
    } else if (!localEntry && remoteEntry) {
      const remoteEntryTime = getNormalizedTimestamp(remoteEntry.updatedAt) || remoteLogTime;
      if (deletedAt > 0 && deletedAt >= remoteEntryTime) {
        entriesChangedRemote = true;
      } else {
        if (deletedAt > 0 && remoteEntryTime > deletedAt) {
          delete finalDeleted[entryId];
        }
        mergedEntries.push(remoteEntry);
        entriesChangedLocal = true;
      }
    } else if (localEntry && remoteEntry) {
      const localEntryTime = getNormalizedTimestamp(localEntry.updatedAt) || localLogTime;
      const remoteEntryTime = getNormalizedTimestamp(remoteEntry.updatedAt) || remoteLogTime;
      const latestEntryTime = Math.max(localEntryTime, remoteEntryTime);

      if (deletedAt > 0 && deletedAt >= latestEntryTime) {
        entriesChangedLocal = true;
        entriesChangedRemote = true;
      } else {
        if (deletedAt > 0 && latestEntryTime > deletedAt) {
          delete finalDeleted[entryId];
        }
        const localEntryRev = localEntry.rev || 1;
        const remoteEntryRev = remoteEntry.rev || 1;

        if (
          remoteEntryRev > localEntryRev ||
          (remoteEntryRev === localEntryRev && remoteEntryTime > localEntryTime)
        ) {
          mergedEntries.push(remoteEntry);
          entriesChangedLocal = true;
        } else if (
          localEntryRev > remoteEntryRev ||
          (localEntryRev === remoteEntryRev && localEntryTime > remoteEntryTime)
        ) {
          mergedEntries.push(localEntry);
          entriesChangedRemote = true;
        } else {
          mergedEntries.push(localEntry);
        }
      }
    }
  }

  mergedEntries.sort((a, b) => {
    const ca = getNormalizedTimestamp(a.createdAt);
    const cb = getNormalizedTimestamp(b.createdAt);
    if (ca !== cb) return ca - cb;
    return a.id.localeCompare(b.id);
  });

  const hasDeleted = Object.keys(finalDeleted).length > 0;
  return {
    entries: mergedEntries,
    ...(hasDeleted ? { deletedEntries: finalDeleted } : {}),
    entriesChangedLocal,
    entriesChangedRemote,
  };
}

/**
 * 依日期 (date) 為單一真理源合併 DailyDietLog：
 * 1. meta 頭部採 rev + updatedAt LWW 仲裁，並保留本地 id 防止 Dexie ConstraintError
 * 2. entries 採條目級 LWW-Element-Set 聯集合併 + deletedEntries 刪除墓碑，避免多端離線各自新增互相覆蓋
 */
export function mergeDietLogsByDate(
  localList: DailyDietLog[],
  remoteList: DailyDietLog[],
  now: number = Date.now()
): { merged: DailyDietLog[]; hasLocalChanges: boolean; hasRemoteChanges: boolean } {
  const localMap = new Map<string, DailyDietLog>(localList.map((item) => [item.date, item]));
  const remoteMap = new Map<string, DailyDietLog>(remoteList.map((item) => [item.date, item]));
  const mergedMap = new Map<string, DailyDietLog>();

  let hasLocalChanges = false;
  let hasRemoteChanges = false;

  for (const localItem of localList) {
    const remoteItem = remoteMap.get(localItem.date);
    if (!remoteItem) {
      mergedMap.set(localItem.date, localItem);
      hasRemoteChanges = true;
    } else {
      const localRev = localItem.rev || 1;
      const remoteRev = remoteItem.rev || 1;
      const localTime = getNormalizedTimestamp(localItem.updatedAt);
      const remoteTime = getNormalizedTimestamp(remoteItem.updatedAt);

      let chosenHeader: DailyDietLog;
      if (remoteRev > localRev) {
        chosenHeader = { ...remoteItem, id: localItem.id };
        hasLocalChanges = true;
      } else if (localRev > remoteRev) {
        chosenHeader = localItem;
        hasRemoteChanges = true;
      } else if (remoteTime > localTime) {
        chosenHeader = { ...remoteItem, id: localItem.id };
        hasLocalChanges = true;
      } else if (localTime > remoteTime) {
        chosenHeader = localItem;
        hasRemoteChanges = true;
      } else {
        chosenHeader = localItem;
      }

      const { entries, deletedEntries, entriesChangedLocal, entriesChangedRemote } = mergeDietEntries(
        localItem,
        remoteItem,
        localTime,
        remoteTime,
        now
      );

      if (entriesChangedLocal) hasLocalChanges = true;
      if (entriesChangedRemote) hasRemoteChanges = true;

      const mergedLog: DailyDietLog = {
        id: localItem.id,
        date: localItem.date,
        meta: chosenHeader.meta,
        entries,
        createdAt: Math.min(
          getNormalizedTimestamp(localItem.createdAt) || localTime,
          getNormalizedTimestamp(remoteItem.createdAt) || remoteTime
        ),
        updatedAt: Math.max(localTime, remoteTime),
        ...(localItem.rev !== undefined || remoteItem.rev !== undefined
          ? { rev: Math.max(localRev, remoteRev) }
          : {}),
      };
      if (deletedEntries) {
        mergedLog.deletedEntries = deletedEntries;
      }

      mergedMap.set(localItem.date, mergedLog);
    }
  }

  for (const remoteItem of remoteList) {
    if (!localMap.has(remoteItem.date)) {
      mergedMap.set(remoteItem.date, remoteItem);
      hasLocalChanges = true;
    }
  }

  return {
    merged: Array.from(mergedMap.values()),
    hasLocalChanges,
    hasRemoteChanges,
  };
}

function mergeTwoWorkoutLogs(
  localLog: WorkoutLog,
  remoteLog: WorkoutLog,
  now: number
): { merged: WorkoutLog; changedLocal: boolean; changedRemote: boolean } {
  const localRev = localLog.rev || 1;
  const remoteRev = remoteLog.rev || 1;
  const localTime = getNormalizedTimestamp(localLog.updatedAt);
  const remoteTime = getNormalizedTimestamp(remoteLog.updatedAt);

  const remoteWinsHeader =
    remoteRev > localRev || (remoteRev === localRev && remoteTime > localTime);
  const headerSource = remoteWinsHeader ? remoteLog : localLog;
  let changedLocal = remoteWinsHeader;
  let changedRemote = !remoteWinsHeader && (localRev > remoteRev || localTime > remoteTime);

  // 合併 deletedSetIds 墓碑并清理超過 30 天之過期記錄
  const rawDeleted: Record<string, number> = {};
  for (const [id, ts] of Object.entries(localLog.deletedSetIds ?? {})) {
    if (Number.isFinite(ts) && ts > 0 && now - ts <= TOMBSTONE_RETENTION_MS) {
      rawDeleted[id] = Math.max(rawDeleted[id] ?? 0, ts);
    }
  }
  for (const [id, ts] of Object.entries(remoteLog.deletedSetIds ?? {})) {
    if (Number.isFinite(ts) && ts > 0 && now - ts <= TOMBSTONE_RETENTION_MS) {
      rawDeleted[id] = Math.max(rawDeleted[id] ?? 0, ts);
    }
  }
  const finalDeleted: Record<string, number> = { ...rawDeleted };

  // 依 exerciseId 合併動作群組與組數 (LWW-Element-Set)
  const localGroups = localLog.exercises || [];
  const remoteGroups = remoteLog.exercises || [];
  const localGroupMap = new Map(localGroups.map((g) => [g.exerciseId, g]));
  const remoteGroupMap = new Map(remoteGroups.map((g) => [g.exerciseId, g]));
  const orderedExerciseIds: string[] = [];
  for (const g of localGroups) {
    if (!orderedExerciseIds.includes(g.exerciseId)) orderedExerciseIds.push(g.exerciseId);
  }
  for (const g of remoteGroups) {
    if (!orderedExerciseIds.includes(g.exerciseId)) orderedExerciseIds.push(g.exerciseId);
  }

  const mergedGroups: WorkoutLog['exercises'] = [];

  for (const exerciseId of orderedExerciseIds) {
    const lGroup = localGroupMap.get(exerciseId);
    const rGroup = remoteGroupMap.get(exerciseId);
    const lSets = lGroup?.sets || [];
    const rSets = rGroup?.sets || [];
    const lSetMap = new Map(lSets.map((s) => [s.id, s]));
    const rSetMap = new Map(rSets.map((s) => [s.id, s]));
    const allSetIds = new Set<string>([...lSetMap.keys(), ...rSetMap.keys()]);

    const mergedSets: WorkoutLog['exercises'][number]['sets'] = [];

    for (const setId of allSetIds) {
      const lSet = lSetMap.get(setId);
      const rSet = rSetMap.get(setId);
      const delTs = rawDeleted[setId] ?? 0;

      if (lSet && !rSet) {
        const lSetTime = getNormalizedTimestamp(lSet.updatedAt) || localTime;
        if (delTs > 0 && delTs >= lSetTime) {
          changedLocal = true;
        } else {
          if (delTs > 0 && lSetTime > delTs) delete finalDeleted[setId];
          mergedSets.push(lSet);
          changedRemote = true;
        }
      } else if (!lSet && rSet) {
        const rSetTime = getNormalizedTimestamp(rSet.updatedAt) || remoteTime;
        if (delTs > 0 && delTs >= rSetTime) {
          changedRemote = true;
        } else {
          if (delTs > 0 && rSetTime > delTs) delete finalDeleted[setId];
          mergedSets.push(rSet);
          changedLocal = true;
        }
      } else if (lSet && rSet) {
        const lSetTime = getNormalizedTimestamp(lSet.updatedAt) || localTime;
        const rSetTime = getNormalizedTimestamp(rSet.updatedAt) || remoteTime;
        const latestTime = Math.max(lSetTime, rSetTime);
        if (delTs > 0 && delTs >= latestTime) {
          changedLocal = true;
          changedRemote = true;
        } else {
          if (delTs > 0 && latestTime > delTs) delete finalDeleted[setId];
          const lSetRevRaw = (lSet as { rev?: unknown }).rev;
          const rSetRevRaw = (rSet as { rev?: unknown }).rev;
          const lSetRev = typeof lSetRevRaw === 'number' && Number.isFinite(lSetRevRaw) ? lSetRevRaw : 1;
          const rSetRev = typeof rSetRevRaw === 'number' && Number.isFinite(rSetRevRaw) ? rSetRevRaw : 1;
          if (rSetRev > lSetRev || (rSetRev === lSetRev && rSetTime > lSetTime)) {
            mergedSets.push(rSet);
            changedLocal = true;
          } else if (lSetRev > rSetRev || (lSetRev === rSetRev && lSetTime > rSetTime)) {
            mergedSets.push(lSet);
            changedRemote = true;
          } else {
            mergedSets.push(lSet);
          }
        }
      }
    }

    mergedSets.sort((a, b) => a.setNumber - b.setNumber || a.id.localeCompare(b.id));
    if (mergedSets.length > 0 || (lGroup && rGroup)) {
      mergedGroups.push({
        exerciseId,
        sets: mergedSets.map((s, idx) => ({ ...s, setNumber: idx + 1 })),
      });
    }
  }

  const hasDeleted = Object.keys(finalDeleted).length > 0;
  const merged: WorkoutLog = {
    id: localLog.id,
    date: localLog.date,
    ...(headerSource.routineId ? { routineId: headerSource.routineId } : {}),
    exercises: mergedGroups,
    ...(hasDeleted ? { deletedSetIds: finalDeleted } : {}),
    createdAt: Math.min(
      getNormalizedTimestamp(localLog.createdAt) || localTime,
      getNormalizedTimestamp(remoteLog.createdAt) || remoteTime
    ),
    updatedAt: Math.max(localTime, remoteTime),
    ...(localLog.rev !== undefined || remoteLog.rev !== undefined
      ? { rev: Math.max(localRev, remoteRev) }
      : {}),
  };

  return { merged, changedLocal, changedRemote };
}

/**
 * 合併 WorkoutLog：支援跨端動作群組與組數級 LWW-Element-Set 聯集合併 + 刪除墓碑
 */
export function mergeWorkoutLogs(
  localList: WorkoutLog[],
  remoteList: WorkoutLog[],
  deletedTombstones?: Record<string, number>,
  now: number = Date.now()
): { merged: WorkoutLog[]; deletedIds: string[]; hasLocalChanges: boolean; hasRemoteChanges: boolean } {
  const localMap = new Map<string, WorkoutLog>(localList.map((item) => [item.id, item]));
  const remoteMap = new Map<string, WorkoutLog>(remoteList.map((item) => [item.id, item]));
  const mergedMap = new Map<string, WorkoutLog>();
  const deletedIds: string[] = [];

  let hasLocalChanges = false;
  let hasRemoteChanges = false;

  const isTombstoned = (id: string, itemTime: number): boolean => {
    const delTs = deletedTombstones?.[id];
    if (!delTs || now - delTs > TOMBSTONE_RETENTION_MS) return false;
    return delTs >= itemTime;
  };

  for (const localItem of localList) {
    const remoteItem = remoteMap.get(localItem.id);
    if (!remoteItem) {
      const localTime = getNormalizedTimestamp(localItem.updatedAt);
      if (isTombstoned(localItem.id, localTime)) {
        deletedIds.push(localItem.id);
        hasLocalChanges = true;
      } else {
        mergedMap.set(localItem.id, localItem);
        hasRemoteChanges = true;
      }
    } else {
      const { merged, changedLocal, changedRemote } = mergeTwoWorkoutLogs(localItem, remoteItem, now);
      const mergedTime = getNormalizedTimestamp(merged.updatedAt);
      if (isTombstoned(localItem.id, mergedTime)) {
        deletedIds.push(localItem.id);
        hasLocalChanges = true;
        hasRemoteChanges = true;
      } else {
        mergedMap.set(localItem.id, merged);
        if (changedLocal) hasLocalChanges = true;
        if (changedRemote) hasRemoteChanges = true;
      }
    }
  }

  for (const remoteItem of remoteList) {
    if (!localMap.has(remoteItem.id)) {
      const remoteTime = getNormalizedTimestamp(remoteItem.updatedAt);
      if (isTombstoned(remoteItem.id, remoteTime)) {
        hasRemoteChanges = true;
      } else {
        mergedMap.set(remoteItem.id, remoteItem);
        hasLocalChanges = true;
      }
    }
  }

  return {
    merged: Array.from(mergedMap.values()),
    deletedIds,
    hasLocalChanges,
    hasRemoteChanges,
  };
}

/**
 * 按日期 (YYYY-MM-DD) 分組 FoodLog
 */
export function groupFoodLogsByDate(logs: FoodLog[]): Record<string, FoodLog[]> {
  const groups: Record<string, FoodLog[]> = {};
  for (const log of logs) {
    const bucket = log.date && log.date.length >= 10 ? log.date.slice(0, 10) : (log.date || 'unknown');
    if (!groups[bucket]) groups[bucket] = [];
    groups[bucket].push(log);
  }
  return groups;
}

/**
 * 按日期 (YYYY-MM-DD) 分組 WorkoutLog
 */
export function groupWorkoutLogsByDate(logs: WorkoutLog[]): Record<string, WorkoutLog[]> {
  const groups: Record<string, WorkoutLog[]> = {};
  for (const log of logs) {
    const bucket = log.date && log.date.length >= 10 ? log.date.slice(0, 10) : (log.date || 'unknown');
    if (!groups[bucket]) groups[bucket] = [];
    groups[bucket].push(log);
  }
  return groups;
}

/**
 * 按日期 (YYYY-MM-DD) 分組 BodyMetric
 */
export function groupBodyMetricsByDate(metrics: BodyMetric[]): Record<string, BodyMetric[]> {
  const groups: Record<string, BodyMetric[]> = {};
  for (const m of metrics) {
    const bucket = m.date && m.date.length >= 10 ? m.date.slice(0, 10) : (m.date || 'unknown');
    if (!groups[bucket]) groups[bucket] = [];
    groups[bucket].push(m);
  }
  return groups;
}

// 向後相容別名
export const groupFoodLogsByMonth = groupFoodLogsByDate;
export const groupWorkoutLogsByMonth = groupWorkoutLogsByDate;
export const groupBodyMetricsByYear = groupBodyMetricsByDate;

/**
 * 全量上傳本機所有資料模組至雲端
 */
export async function uploadAllLocalData(
  now: string,
  cachedRevs: Record<string, string>,
  pushedTimes: Record<string, string>
): Promise<void> {
  const [
    baseInfos,
    foods,
    recipes,
    dailyDietLogs,
    exercises,
    equipments,
    routines,
    workoutLogs,
    bodyMetrics,
  ] = await Promise.all([
    db.user_base_info.toArray(),
    db.foods.toArray(),
    db.recipes.toArray(),
    db.daily_diet_logs.toArray(),
    db.exercises.toArray(),
    db.equipments.toArray(),
    db.routines.toArray(),
    db.workout_logs.toArray(),
    db.body_metrics.toArray(),
  ]);

  // 1. 資料庫主檔 (/database/*.json)
  cachedRevs[SYNC_PATHS.BASE_INFO] = await uploadJsonFile(
    SYNC_PATHS.BASE_INFO,
    baseInfos.map(sanitizeUserBaseInfo)
  );
  pushedTimes['user_base_info'] = now;

  cachedRevs[SYNC_PATHS.FOODS] = await uploadJsonFile(
    SYNC_PATHS.FOODS,
    foods.map(sanitizeFoodItem)
  );
  cachedRevs[SYNC_PATHS.RECIPES] = await uploadJsonFile(
    SYNC_PATHS.RECIPES,
    recipes.map(sanitizeRecipe)
  );
  pushedTimes['foods'] = now;
  pushedTimes['recipes'] = now;

  cachedRevs[SYNC_PATHS.EXERCISES] = await uploadJsonFile(SYNC_PATHS.EXERCISES, exercises);
  cachedRevs[SYNC_PATHS.EQUIPMENTS] = await uploadJsonFile(SYNC_PATHS.EQUIPMENTS, equipments);
  cachedRevs[SYNC_PATHS.ROUTINES] = await uploadJsonFile(
    SYNC_PATHS.ROUTINES,
    routines.map(sanitizeWorkoutRoutine)
  );
  pushedTimes['exercises'] = now;
  pushedTimes['equipments'] = now;
  pushedTimes['routines'] = now;

  // 2. 月度合併日誌 (/logs/YYYY-MM.json：整合飲食、訓練與體態)
  const monthlyBuckets = groupRecordsByMonth(
    { dailyDietLogs, workoutLogs, bodyMetrics },
    now
  );
  for (const [month, bucket] of monthlyBuckets) {
    const bucketPath = getMonthLogPath(month);
    cachedRevs[bucketPath] = await uploadJsonFile(bucketPath, bucket);
    pushedTimes[`month_log_${month}`] = now;
    pushedTimes[`month_log_${month}_counts`] =
      `${bucket.dailyDietLogs.length}:${bucket.workoutLogs.length}:${bucket.bodyMetrics.length}`;
  }

  // 7. 跨端實體刪除墓碑 (/deleted_entities.json)
  const localTombstones = getLocalEntityTombstones(Date.now());
  if (Object.keys(localTombstones).length > 0) {
    cachedRevs[DELETED_ENTITIES_PATH] = await uploadJsonFile(
      DELETED_ENTITIES_PATH,
      localTombstones
    );
    pushedTimes['deleted_entities'] = now;
  } else {
    await deleteRemotePath(DELETED_ENTITIES_PATH);
    delete cachedRevs[DELETED_ENTITIES_PATH];
    delete pushedTimes['deleted_entities'];
  }

  // 8. 全域清單 manifest.json
  await uploadManifestFile(cachedRevs);
}

/**
 * 建立並上傳全域 manifest.json
 */
export async function uploadManifestFile(cachedRevs: Record<string, string>): Promise<void> {
  const [
    foodsCount,
    recipesCount,
    dailyDietLogsCount,
    exercisesCount,
    equipmentsCount,
    routinesCount,
    workoutLogsCount,
    bodyMetricsCount,
  ] = await Promise.all([
    db.foods.count(),
    db.recipes.count(),
    db.daily_diet_logs.count(),
    db.exercises.count(),
    db.equipments.count(),
    db.routines.count(),
    db.workout_logs.count(),
    db.body_metrics.count(),
  ]);

  const now = new Date().toISOString();
  const manifest: SyncManifest = {
    appName: 'e2Cal',
    schemaVersion: CURRENT_SYNC_SCHEMA_VERSION,
    exportedAt: now,
    stats: {
      foodsCount,
      recipesCount,
      dailyDietLogsCount,
      exercisesCount,
      equipmentsCount,
      routinesCount,
      workoutLogsCount,
      bodyMetricsCount,
    },
  };

  const rev = await uploadJsonFile('/manifest.json', manifest);
  cachedRevs['/manifest.json'] = rev;
}

/**
 * 執行解包資料夾雙向同步 (Unpacked Folder Sync Engine)
 */
export async function executeSync(
  mode: 'auto' | 'manual' | 'overwrite_local' | 'overwrite_remote' = 'auto'
): Promise<SyncResult> {
  if (isSyncInProgress) {
    hasPendingSyncRequest = true;
    if (mode === 'overwrite_remote' || mode === 'overwrite_local') {
      pendingSyncMode = mode;
    }
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: 'Sync already in progress, queued next run',
      actionTaken: 'up_to_date',
    };
  }

  if (!isCloudSyncConnected()) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: 'Cloud sync not connected',
      actionTaken: 'up_to_date',
    };
  }

  // 離線防護：若設備已離線，嚴禁嘗試發起同步，亦不切換狀態為同步中或跳出報錯 Toast
  if (isDeviceOffline()) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: 'Device is offline',
      actionTaken: 'up_to_date',
    };
  }

  updateSyncEngineStatus({ isSyncing: true, lastSyncError: null, justSynced: false });

  // 1. 純覆蓋雲端模式 (Overwrite Remote)
  if (mode === 'overwrite_remote') {
    isSyncInProgress = true;
    try {
      const now = new Date().toISOString();
      const cachedRevs: Record<string, string> = {};
      const pushedTimes: Record<string, string> = {};

      await uploadAllLocalData(now, cachedRevs, pushedTimes);

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem('e2cal_force_push_foods');
        } catch {
          // ignore
        }
      }
      setCachedRevs(cachedRevs);
      setPushedTimes(pushedTimes);
      setLastSyncTime(now);
      conflictRetryCount = 0;

      if (justSyncedTimer) clearTimeout(justSyncedTimer);
      updateSyncEngineStatus({
        isSyncing: false,
        lastSyncTime: now,
        lastSyncError: null,
        justSynced: true,
      });
      justSyncedTimer = setTimeout(() => {
        updateSyncEngineStatus({ justSynced: false });
      }, 2500);

      return { success: true, timestamp: now, actionTaken: 'uploaded_local' };
    } catch (error: unknown) {
      console.error('Overwrite remote error:', error);
      const errMsg = error instanceof Error ? error.message : 'Overwrite remote error';
      if (getSyncErrorReasonKey(error) === 'network') {
        reportNetworkError();
      }
      updateSyncEngineStatus({
        isSyncing: false,
        lastSyncError: errMsg,
        justSynced: false,
      });
      if (!errMsg.includes('Sync already in progress')) {
        const reason = formatSyncErrorMessage(error);
        toast.show(i18n.t('syncStatus.syncFailedToast', { reason }));
      }
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: errMsg,
        actionTaken: 'up_to_date',
      };
    } finally {
      isSyncInProgress = false;
      drainPendingQueue();
    }
  }

  isSyncInProgress = true;
  let remoteFileMap: Map<string, DropboxFileMetadata> | null = null;
  let cachedRevs = getCachedRevs();
  let pushedTimes = getPushedTimes();

  try {
    const now = new Date().toISOString();
    cachedRevs = getCachedRevs();
    pushedTimes = getPushedTimes();

    // 呼叫一次 listRemoteFolder，單次請求掌握所有遠端檔案及其 rev（隔離 /Backup/ 滾動備份目錄）
    const remoteFiles = (await listRemoteFolder()).filter(
      (f) => !f.path_lower.startsWith('/backup/')
    );

    // 2. 遠端完全沒有資料夾記錄（初次上傳）
    if (remoteFiles.length === 0) {
      await uploadAllLocalData(now, cachedRevs, pushedTimes);
      setCachedRevs(cachedRevs);
      setPushedTimes(pushedTimes);
      setLastSyncTime(now);
      conflictRetryCount = 0;

      if (justSyncedTimer) clearTimeout(justSyncedTimer);
      updateSyncEngineStatus({
        isSyncing: false,
        lastSyncTime: now,
        lastSyncError: null,
        justSynced: true,
      });
      justSyncedTimer = setTimeout(() => {
        updateSyncEngineStatus({ justSynced: false });
      }, 2500);

      return { success: true, timestamp: now, actionTaken: 'uploaded_initial' };
    }

    remoteFileMap = new Map<string, DropboxFileMetadata>(
      remoteFiles.map((f) => [f.path_lower, f])
    );

    // 版本門檻檢查：若雲端 schemaVersion 高於本機支援版本，立即中止保護資料
    const manifestMeta = remoteFileMap.get(SYNC_PATHS.MANIFEST);
    if (
      manifestMeta &&
      (mode === 'overwrite_local' || cachedRevs[SYNC_PATHS.MANIFEST] !== manifestMeta.rev)
    ) {
      const remoteManifest = await downloadJsonFile<SyncManifest>(SYNC_PATHS.MANIFEST);
      assertCompatibleSchemaVersion(remoteManifest);
    }

    // 3. 純覆蓋本機模式 (Overwrite Local)
    if (mode === 'overwrite_local') {
      const [
        baseInfos,
        foods,
        recipes,
        exercises,
        equipments,
        routines,
      ] = await Promise.all([
        downloadJsonFile<UserBaseInfo[]>(SYNC_PATHS.BASE_INFO),
        downloadJsonFile<FoodItem[]>(SYNC_PATHS.FOODS),
        downloadJsonFile<FoodRecipe[]>(SYNC_PATHS.RECIPES),
        downloadJsonFile<Exercise[]>(SYNC_PATHS.EXERCISES),
        downloadJsonFile<Equipment[]>(SYNC_PATHS.EQUIPMENTS),
        downloadJsonFile<WorkoutRoutine[]>(SYNC_PATHS.ROUTINES),
      ]);

      // 下載所有月度合併日誌 (/logs/YYYY-MM.json)
      const monthlyFiles = remoteFiles.filter((f) =>
        isMonthlyLogFilePath(f.path_lower, f.name)
      );
      const monthlyChunks = await Promise.all(
        monthlyFiles.map((f) => downloadJsonFile<MonthlySyncLogBucket>(f.path_lower))
      );
      const allDailyDietLogs: DailyDietLog[] = [];
      const allWorkoutLogs: WorkoutLog[] = [];
      const allBodyMetrics: BodyMetric[] = [];
      for (const rawChunk of monthlyChunks) {
        if (!rawChunk) continue;
        const parsed = parseMonthlyLogBucketStrict(rawChunk);
        allDailyDietLogs.push(...parsed.dailyDietLogs);
        allWorkoutLogs.push(...parsed.workoutLogs);
        allBodyMetrics.push(...parsed.bodyMetrics);
      }

      // 飲食分卷去重（保留最新者），避免 bulkPut 觸發 &date 唯一約束衝突
      const dedupedDietLogsMap = new Map<string, DailyDietLog>();
      for (const log of allDailyDietLogs) {
        const existing = dedupedDietLogsMap.get(log.date);
        if (!existing) {
          dedupedDietLogsMap.set(log.date, log);
        } else {
          const existingTime = getNormalizedTimestamp(existing.updatedAt);
          const logTime = getNormalizedTimestamp(log.updatedAt);
          if (logTime >= existingTime) {
            dedupedDietLogsMap.set(log.date, log);
          }
        }
      }
      const dedupedDailyDietLogs = Array.from(dedupedDietLogsMap.values());

      // 原子清空與全量覆寫寫入（抑制自動同步觸發）
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

            if (baseInfos?.length) await db.user_base_info.bulkPut(baseInfos.map(sanitizeUserBaseInfo));
            if (foods?.length) {
              await db.foods.bulkPut(foods.map(sanitizeFoodItem));
              clearFoodsCache();
            }
            if (recipes?.length) await db.recipes.bulkPut(recipes.map(sanitizeRecipe));
            if (dedupedDailyDietLogs.length) await db.daily_diet_logs.bulkPut(dedupedDailyDietLogs);
            if (exercises?.length) await db.exercises.bulkPut(exercises);
            if (equipments?.length) await db.equipments.bulkPut(equipments);
            if (routines?.length) await db.routines.bulkPut(routines.map(sanitizeWorkoutRoutine));
            if (allWorkoutLogs.length) await db.workout_logs.bulkPut(allWorkoutLogs.map(sanitizeWorkoutLog));
            if (allBodyMetrics.length) await db.body_metrics.bulkPut(allBodyMetrics);
          }
        )
      );

      // 快取所有遠端最新 rev
      for (const [pathLower, fileMeta] of remoteFileMap) {
        cachedRevs[pathLower] = fileMeta.rev;
      }
      setCachedRevs(cachedRevs);
      setLastSyncTime(now);

      confirmRawWeightIfHasDietActivity({
        foodsCount: foods?.length ?? 0,
        recipesCount: recipes?.length ?? 0,
        dailyDietLogs: dedupedDailyDietLogs,
      });

      if (justSyncedTimer) clearTimeout(justSyncedTimer);
      updateSyncEngineStatus({
        isSyncing: false,
        lastSyncTime: now,
        lastSyncError: null,
        justSynced: true,
      });
      justSyncedTimer = setTimeout(() => {
        updateSyncEngineStatus({ justSynced: false });
      }, 2500);

      return { success: true, timestamp: now, actionTaken: 'downloaded_remote' };
    }

    // 4. 動態雙向解包文件夾同步模式 (Auto Granular Selective Pull & Push)
    let hasLocalModified = false;
    let hasRemoteModified = false;
    const nowTs = Date.now();

    // 0. 先拉取並合併跨端實體刪除墓碑 (/deleted_entities.json)
    const localTombstones = getLocalEntityTombstones(nowTs);
    let mergedTombstones: EntityTombstoneMap = localTombstones;
    let tombstonesChangedRemote = false;
    const deletedEntitiesMeta = remoteFileMap.get(DELETED_ENTITIES_PATH);
    if (deletedEntitiesMeta && cachedRevs[DELETED_ENTITIES_PATH] !== deletedEntitiesMeta.rev) {
      const remoteTombstones =
        (await downloadJsonFile<EntityTombstoneMap>(DELETED_ENTITIES_PATH)) || {};
      const mTomb = mergeEntityTombstoneMaps(localTombstones, remoteTombstones, nowTs);
      mergedTombstones = mTomb.merged;
      if (mTomb.changedLocal) {
        setLocalEntityTombstones(mergedTombstones);
      }
      if (mTomb.changedRemote) {
        tombstonesChangedRemote = true;
      }
      cachedRevs[DELETED_ENTITIES_PATH] = deletedEntitiesMeta.rev;
    } else if (Object.keys(localTombstones).length > 0 && !deletedEntitiesMeta) {
      tombstonesChangedRemote = true;
    }

    // A. 遠端修訂號比對拉取 (Selective Pull via rev)
    // 1. 檢查 user_base_info
    const baseInfoMeta = remoteFileMap.get(SYNC_PATHS.BASE_INFO);
    if (baseInfoMeta && cachedRevs[SYNC_PATHS.BASE_INFO] !== baseInfoMeta.rev) {
      const rawRemote = assertValidArrayPayload<UserBaseInfo>(
        await downloadJsonFile<unknown>(SYNC_PATHS.BASE_INFO),
        'base_info'
      );
      const remoteList = rawRemote.map(sanitizeUserBaseInfo);
      const localList = await db.user_base_info.toArray();
      const m = mergeEntities(localList, remoteList);
      if (m.hasLocalChanges) {
        await withAutoSyncSuppressed(() => db.user_base_info.bulkPut(m.merged.map(sanitizeUserBaseInfo)));
        hasLocalModified = true;
      }
      if (m.hasRemoteChanges) hasRemoteModified = true;
      cachedRevs[SYNC_PATHS.BASE_INFO] = baseInfoMeta.rev;
      if (!m.hasRemoteChanges) {
        pushedTimes['user_base_info'] = now;
      }
    }

    // 2. 檢查 foods
    let forcePushFoodsFromSchema = false;
    const foodsMeta = remoteFileMap.get(SYNC_PATHS.FOODS);
    if (foodsMeta && cachedRevs[SYNC_PATHS.FOODS] !== foodsMeta.rev) {
      const rawRemoteList = assertValidArrayPayload<unknown>(
        await downloadJsonFile<unknown>(SYNC_PATHS.FOODS),
        'foods'
      );
      const hasLegacyRemoteFood = rawRemoteList.some((item) => {
        if (typeof item !== 'object' || item === null) return true;
        const rec = item as Record<string, unknown>;
        const mObj =
          typeof rec.macros === 'object' && rec.macros !== null
            ? (rec.macros as Record<string, unknown>)
            : null;
        const cObj =
          mObj && typeof mObj.carbs === 'object' && mObj.carbs !== null
            ? (mObj.carbs as Record<string, unknown>)
            : null;
        const fObj =
          mObj && typeof mObj.fat === 'object' && mObj.fat !== null
            ? (mObj.fat as Record<string, unknown>)
            : null;
        return typeof cObj?.total !== 'number' || typeof fObj?.total !== 'number';
      });
      if (hasLegacyRemoteFood) {
        forcePushFoodsFromSchema = true;
      }

      const remoteList = rawRemoteList.map(sanitizeFoodItem);
      const localList = (await db.foods.toArray()).map(sanitizeFoodItem);
      const m = mergeEntities(localList, remoteList, mergedTombstones.foods, nowTs);
      if (m.hasLocalChanges) {
        await withAutoSyncSuppressed(async () => {
          if (m.deletedIds.length) await db.foods.bulkDelete(m.deletedIds);
          if (m.merged.length) await db.foods.bulkPut(m.merged);
        });
        confirmRawWeightIfHasDietActivity({ foodsCount: m.merged.length });
        clearFoodsCache();
        hasLocalModified = true;
      }
      if (m.hasRemoteChanges) hasRemoteModified = true;
      cachedRevs[SYNC_PATHS.FOODS] = foodsMeta.rev;
      if (!m.hasRemoteChanges && !forcePushFoodsFromSchema) {
        pushedTimes['foods'] = now;
      }
    }

    // 4. 檢查 recipes
    const recipesMeta = remoteFileMap.get(SYNC_PATHS.RECIPES);
    if (recipesMeta && cachedRevs[SYNC_PATHS.RECIPES] !== recipesMeta.rev) {
      const rawRemote = assertValidArrayPayload<FoodRecipe>(
        await downloadJsonFile<unknown>(SYNC_PATHS.RECIPES),
        'recipes'
      );
      const remoteList = rawRemote.map(sanitizeRecipe);
      const localList = await db.recipes.toArray();
      const m = mergeEntities(localList, remoteList, mergedTombstones.recipes, nowTs);
      if (m.hasLocalChanges) {
        await withAutoSyncSuppressed(async () => {
          if (m.deletedIds.length) await db.recipes.bulkDelete(m.deletedIds);
          if (m.merged.length) await db.recipes.bulkPut(m.merged.map(sanitizeRecipe));
        });
        confirmRawWeightIfHasDietActivity({ recipesCount: m.merged.length });
        hasLocalModified = true;
      }
      if (m.hasRemoteChanges) hasRemoteModified = true;
      cachedRevs[SYNC_PATHS.RECIPES] = recipesMeta.rev;
      if (!m.hasRemoteChanges) {
        pushedTimes['recipes'] = now;
      }
    }

    // 5. 檢查 exercises
    const exMeta = remoteFileMap.get(SYNC_PATHS.EXERCISES);
    if (exMeta && cachedRevs[SYNC_PATHS.EXERCISES] !== exMeta.rev) {
      const remoteList = assertValidArrayPayload<Exercise>(
        await downloadJsonFile<unknown>(SYNC_PATHS.EXERCISES),
        'exercises'
      );
      const localList = await db.exercises.toArray();
      const m = mergeEntities(localList, remoteList, mergedTombstones.exercises, nowTs);
      if (m.hasLocalChanges) {
        await withAutoSyncSuppressed(async () => {
          if (m.deletedIds.length) await db.exercises.bulkDelete(m.deletedIds);
          if (m.merged.length) await db.exercises.bulkPut(m.merged);
        });
        hasLocalModified = true;
      }
      if (m.hasRemoteChanges) hasRemoteModified = true;
      cachedRevs[SYNC_PATHS.EXERCISES] = exMeta.rev;
      if (!m.hasRemoteChanges) {
        pushedTimes['exercises'] = now;
      }
    }

    // 6. 檢查 equipments
    const eqMeta = remoteFileMap.get(SYNC_PATHS.EQUIPMENTS);
    if (eqMeta && cachedRevs[SYNC_PATHS.EQUIPMENTS] !== eqMeta.rev) {
      const remoteList = assertValidArrayPayload<Equipment>(
        await downloadJsonFile<unknown>(SYNC_PATHS.EQUIPMENTS),
        'equipments'
      );
      const localList = await db.equipments.toArray();
      const m = mergeEntities(localList, remoteList, mergedTombstones.equipments, nowTs);
      if (m.hasLocalChanges) {
        await withAutoSyncSuppressed(async () => {
          if (m.deletedIds.length) await db.equipments.bulkDelete(m.deletedIds);
          if (m.merged.length) await db.equipments.bulkPut(m.merged);
        });
        hasLocalModified = true;
      }
      if (m.hasRemoteChanges) hasRemoteModified = true;
      cachedRevs[SYNC_PATHS.EQUIPMENTS] = eqMeta.rev;
      if (!m.hasRemoteChanges) {
        pushedTimes['equipments'] = now;
      }
    }

    // 7. 檢查 routines
    const routinesMeta = remoteFileMap.get(SYNC_PATHS.ROUTINES);
    if (routinesMeta && cachedRevs[SYNC_PATHS.ROUTINES] !== routinesMeta.rev) {
      const rawRemote = assertValidArrayPayload<WorkoutRoutine>(
        await downloadJsonFile<unknown>(SYNC_PATHS.ROUTINES),
        'routines'
      );
      const remoteList = rawRemote.map(sanitizeWorkoutRoutine);
      const localList = await db.routines.toArray();
      const m = mergeEntities(localList, remoteList, mergedTombstones.routines, nowTs);
      if (m.hasLocalChanges) {
        await withAutoSyncSuppressed(async () => {
          if (m.deletedIds.length) await db.routines.bulkDelete(m.deletedIds);
          if (m.merged.length) await db.routines.bulkPut(m.merged.map(sanitizeWorkoutRoutine));
        });
        hasLocalModified = true;
      }
      if (m.hasRemoteChanges) hasRemoteModified = true;
      cachedRevs[SYNC_PATHS.ROUTINES] = routinesMeta.rev;
      if (!m.hasRemoteChanges) {
        pushedTimes['routines'] = now;
      }
    }

    // 8. 檢查月度合併日誌 (/logs/YYYY-MM.json)
    const dirtyMonths = new Set<string>();
    const remoteMonthFiles = remoteFiles.filter((f) =>
      isMonthlyLogFilePath(f.path_lower, f.name)
    );
    for (const bMeta of remoteMonthFiles) {
      const path = bMeta.path_lower;
      if (cachedRevs[path] !== bMeta.rev) {
        const month = bMeta.name.replace(/\.json$/i, '');
        const rawRemote = await downloadJsonFile<MonthlySyncLogBucket>(path);
        const remoteBucket = parseMonthlyLogBucketStrict(rawRemote, month);
        const [localDietLogs, localWorkoutLogs, localBodyMetrics] = await Promise.all([
          db.daily_diet_logs.filter((l) => l.date.startsWith(month)).toArray(),
          db.workout_logs.filter((l) => l.date.startsWith(month)).toArray(),
          db.body_metrics.filter((m) => m.date.startsWith(month)).toArray(),
        ]);

        const mDiet = mergeDietLogsByDate(localDietLogs, remoteBucket.dailyDietLogs);
        if (mDiet.hasLocalChanges) {
          const localByDate = new Map(localDietLogs.map((l) => [l.date, l]));
          const toPut = mDiet.merged.map((mergedLog) => {
            const existing = localByDate.get(mergedLog.date);
            return existing ? { ...mergedLog, id: existing.id } : mergedLog;
          });
          await withAutoSyncSuppressed(() => db.daily_diet_logs.bulkPut(toPut));
          confirmRawWeightIfHasDietActivity({ dailyDietLogs: toPut });
          hasLocalModified = true;
        }

        const mWorkout = mergeWorkoutLogs(
          localWorkoutLogs,
          remoteBucket.workoutLogs,
          mergedTombstones.workout_logs,
          nowTs
        );
        if (mWorkout.hasLocalChanges) {
          await withAutoSyncSuppressed(async () => {
            if (mWorkout.deletedIds.length) await db.workout_logs.bulkDelete(mWorkout.deletedIds);
            if (mWorkout.merged.length) {
              await db.workout_logs.bulkPut(mWorkout.merged.map(sanitizeWorkoutLog));
            }
          });
          hasLocalModified = true;
        }

        const mBody = mergeEntities(
          localBodyMetrics,
          remoteBucket.bodyMetrics,
          mergedTombstones.body_metrics,
          nowTs
        );
        if (mBody.hasLocalChanges) {
          await withAutoSyncSuppressed(async () => {
            if (mBody.deletedIds.length) await db.body_metrics.bulkDelete(mBody.deletedIds);
            if (mBody.merged.length) await db.body_metrics.bulkPut(mBody.merged);
          });
          hasLocalModified = true;
        }

        const anyRemoteChanges =
          mDiet.hasRemoteChanges || mWorkout.hasRemoteChanges || mBody.hasRemoteChanges;
        if (anyRemoteChanges) {
          hasRemoteModified = true;
          dirtyMonths.add(month);
        } else {
          pushedTimes[`month_log_${month}`] = now;
          pushedTimes[`month_log_${month}_counts`] =
            `${mDiet.merged.length}:${mWorkout.merged.length}:${mBody.merged.length}`;
        }
        cachedRevs[path] = bMeta.rev;
      }
    }

    // B. 本地增量推送 (Granular Push)
    // 1. user_base_info
    const localBaseInfo = await db.user_base_info.toArray();
    const lastBaseInfoPushed = pushedTimes['user_base_info'] || '';
    const maxBaseInfoUpdated = localBaseInfo.reduce(
      (max, i) => Math.max(max, getNormalizedTimestamp(i.updatedAt)),
      0
    );
    if (!lastBaseInfoPushed || maxBaseInfoUpdated > getNormalizedTimestamp(lastBaseInfoPushed)) {
      cachedRevs[SYNC_PATHS.BASE_INFO] = await uploadJsonFile(
        SYNC_PATHS.BASE_INFO,
        localBaseInfo.map(sanitizeUserBaseInfo),
        cachedRevs[SYNC_PATHS.BASE_INFO]
      );
      pushedTimes['user_base_info'] = now;
      hasRemoteModified = true;
    }

    // 2. foods
    const localFoods = await db.foods.toArray();
    const lastFoodsPushed = pushedTimes['foods'] || '';
    const forcePushFoods =
      typeof window !== 'undefined' &&
      window.localStorage?.getItem('e2cal_force_push_foods') === 'true';
    const maxFoodsUpdated = Math.max(
      localFoods.reduce((max, i) => Math.max(max, getNormalizedTimestamp(i.updatedAt)), 0),
      getMaxTombstoneTime(mergedTombstones.foods)
    );
    if (
      forcePushFoods ||
      forcePushFoodsFromSchema ||
      !lastFoodsPushed ||
      maxFoodsUpdated > getNormalizedTimestamp(lastFoodsPushed)
    ) {
      cachedRevs[SYNC_PATHS.FOODS] = await uploadJsonFile(
        SYNC_PATHS.FOODS,
        localFoods.map(sanitizeFoodItem),
        cachedRevs[SYNC_PATHS.FOODS]
      );
      pushedTimes['foods'] = now;
      hasRemoteModified = true;
      if (forcePushFoods && typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem('e2cal_force_push_foods');
        } catch {
          // ignore
        }
      }
    }

    // 4. recipes
    const localRecipes = await db.recipes.toArray();
    const lastRecipesPushed = pushedTimes['recipes'] || '';
    const maxRecipesUpdated = Math.max(
      localRecipes.reduce((max, i) => Math.max(max, getNormalizedTimestamp(i.updatedAt)), 0),
      getMaxTombstoneTime(mergedTombstones.recipes)
    );
    if (!lastRecipesPushed || maxRecipesUpdated > getNormalizedTimestamp(lastRecipesPushed)) {
      cachedRevs[SYNC_PATHS.RECIPES] = await uploadJsonFile(
        SYNC_PATHS.RECIPES,
        localRecipes.map(sanitizeRecipe),
        cachedRevs[SYNC_PATHS.RECIPES]
      );
      pushedTimes['recipes'] = now;
      hasRemoteModified = true;
    }

    // 6. exercises
    const localExercises = await db.exercises.toArray();
    const lastExPushed = pushedTimes['exercises'] || '';
    const maxExUpdated = Math.max(
      localExercises.reduce((max, i) => Math.max(max, getNormalizedTimestamp(i.updatedAt)), 0),
      getMaxTombstoneTime(mergedTombstones.exercises)
    );
    if (!lastExPushed || maxExUpdated > getNormalizedTimestamp(lastExPushed)) {
      cachedRevs[SYNC_PATHS.EXERCISES] = await uploadJsonFile(
        SYNC_PATHS.EXERCISES,
        localExercises,
        cachedRevs[SYNC_PATHS.EXERCISES]
      );
      pushedTimes['exercises'] = now;
      hasRemoteModified = true;
    }

    // 7. equipments
    const localEquipments = await db.equipments.toArray();
    const lastEqPushed = pushedTimes['equipments'] || '';
    const maxEqUpdated = Math.max(
      localEquipments.reduce((max, i) => Math.max(max, getNormalizedTimestamp(i.updatedAt)), 0),
      getMaxTombstoneTime(mergedTombstones.equipments)
    );
    if (!lastEqPushed || maxEqUpdated > getNormalizedTimestamp(lastEqPushed)) {
      cachedRevs[SYNC_PATHS.EQUIPMENTS] = await uploadJsonFile(
        SYNC_PATHS.EQUIPMENTS,
        localEquipments,
        cachedRevs[SYNC_PATHS.EQUIPMENTS]
      );
      pushedTimes['equipments'] = now;
      hasRemoteModified = true;
    }

    // 8. routines
    const localRoutines = await db.routines.toArray();
    const lastRoutinesPushed = pushedTimes['routines'] || '';
    const maxRoutinesUpdated = Math.max(
      localRoutines.reduce((max, i) => Math.max(max, getNormalizedTimestamp(i.updatedAt)), 0),
      getMaxTombstoneTime(mergedTombstones.routines)
    );
    if (!lastRoutinesPushed || maxRoutinesUpdated > getNormalizedTimestamp(lastRoutinesPushed)) {
      cachedRevs[SYNC_PATHS.ROUTINES] = await uploadJsonFile(
        SYNC_PATHS.ROUTINES,
        localRoutines.map(sanitizeWorkoutRoutine),
        cachedRevs[SYNC_PATHS.ROUTINES]
      );
      pushedTimes['routines'] = now;
      hasRemoteModified = true;
    }

    // 9. 月度合併日誌增量推送 (/logs/YYYY-MM.json)
    const [allLocalDietLogs, allLocalWorkoutLogs, allLocalMetrics] = await Promise.all([
      db.daily_diet_logs.toArray(),
      db.workout_logs.toArray(),
      db.body_metrics.toArray(),
    ]);
    const groupedLocalMonths = groupRecordsByMonth(
      {
        dailyDietLogs: allLocalDietLogs,
        workoutLogs: allLocalWorkoutLogs,
        bodyMetrics: allLocalMetrics,
      },
      now
    );

    for (const [month, bucket] of groupedLocalMonths) {
      const bucketPath = getMonthLogPath(month);
      const countSig = `${bucket.dailyDietLogs.length}:${bucket.workoutLogs.length}:${bucket.bodyMetrics.length}`;
      const lastPushed = pushedTimes[`month_log_${month}`] || '';
      const lastCounts = pushedTimes[`month_log_${month}_counts`];
      const maxUpdated = Math.max(
        bucket.dailyDietLogs.reduce((m, l) => Math.max(m, getNormalizedTimestamp(l.updatedAt)), 0),
        bucket.workoutLogs.reduce((m, l) => Math.max(m, getNormalizedTimestamp(l.updatedAt)), 0),
        bucket.bodyMetrics.reduce((m, l) => Math.max(m, getNormalizedTimestamp(l.updatedAt)), 0)
      );

      const isCountChanged = lastCounts !== undefined && lastCounts !== countSig;
      const isTimeUpdated = !lastPushed || maxUpdated > getNormalizedTimestamp(lastPushed);
      const isMissingOnRemote = !cachedRevs[bucketPath];

      if (isTimeUpdated || isCountChanged || isMissingOnRemote || dirtyMonths.has(month)) {
        cachedRevs[bucketPath] = await uploadJsonFile(
          bucketPath,
          bucket,
          cachedRevs[bucketPath]
        );
        pushedTimes[`month_log_${month}`] = now;
        pushedTimes[`month_log_${month}_counts`] = countSig;
        hasRemoteModified = true;
      }
    }

    for (const bMeta of remoteMonthFiles) {
      const month = bMeta.name.replace(/\.json$/i, '');
      if (!groupedLocalMonths.has(month) && pushedTimes[`month_log_${month}_counts`] !== '0:0:0') {
        const emptyBucket: MonthlySyncLogBucket = {
          month,
          updatedAt: now,
          dailyDietLogs: [],
          workoutLogs: [],
          bodyMetrics: [],
        };
        cachedRevs[bMeta.path_lower] = await uploadJsonFile(
          bMeta.path_lower,
          emptyBucket,
          cachedRevs[bMeta.path_lower]
        );
        pushedTimes[`month_log_${month}`] = now;
        pushedTimes[`month_log_${month}_counts`] = '0:0:0';
        hasRemoteModified = true;
      }
    }

    // 若有任何遠端變動，更新全域 manifest.json
    const latestTombstoneTime = Math.max(
      ...TOMBSTONE_TABLES.map((tbl) => getMaxTombstoneTime(mergedTombstones[tbl]))
    );
    const lastTombstonePushed = pushedTimes['deleted_entities'] || '';
    if (
      tombstonesChangedRemote ||
      (latestTombstoneTime > 0 && latestTombstoneTime > getNormalizedTimestamp(lastTombstonePushed))
    ) {
      cachedRevs[DELETED_ENTITIES_PATH] = await uploadJsonFile(
        DELETED_ENTITIES_PATH,
        mergedTombstones,
        cachedRevs[DELETED_ENTITIES_PATH]
      );
      pushedTimes['deleted_entities'] = now;
      hasRemoteModified = true;
    }

    if (hasRemoteModified) {
      await uploadManifestFile(cachedRevs);
    }

    setCachedRevs(cachedRevs);
    setPushedTimes(pushedTimes);
    setLastSyncTime(now);
    clearPendingAutoSync();
    conflictRetryCount = 0;

    if (justSyncedTimer) clearTimeout(justSyncedTimer);
    updateSyncEngineStatus({
      isSyncing: false,
      lastSyncTime: now,
      lastSyncError: null,
      justSynced: true,
    });
    justSyncedTimer = setTimeout(() => {
      updateSyncEngineStatus({ justSynced: false });
    }, 2500);

    return {
      success: true,
      timestamp: now,
      actionTaken: hasLocalModified || hasRemoteModified ? 'merged' : 'up_to_date',
    };
  } catch (error: unknown) {
    const errMsg = redactSyncSecrets(
      error instanceof Error ? error.message : 'Unknown sync error'
    );
    console.error('Folder sync execution error:', errMsg);
    if (errMsg.includes('DROPBOX_CONFLICT')) {
      if (remoteFileMap) {
        for (const [pathLower, fileMeta] of remoteFileMap) {
          cachedRevs[pathLower] = fileMeta.rev;
        }
      }
      setCachedRevs(cachedRevs);
      setPushedTimes(pushedTimes);

      if (conflictRetryCount < MAX_CONFLICT_RETRIES) {
        conflictRetryCount++;
        console.warn(
          `Dropbox concurrency conflict detected! Queuing automatic re-merge attempt ${conflictRetryCount}/${MAX_CONFLICT_RETRIES}...`
        );
        hasPendingSyncRequest = true;
        pendingSyncMode = 'auto';
        updateSyncEngineStatus({
          isSyncing: false,
          lastSyncError: errMsg,
          justSynced: false,
        });
        toast.show(i18n.t('syncStatus.errors.conflict'));
        return {
          success: false,
          timestamp: new Date().toISOString(),
          error: errMsg,
          actionTaken: 'up_to_date',
        };
      }

      console.error(
        `Dropbox concurrency conflict exceeded max retries (${MAX_CONFLICT_RETRIES}). Aborting auto-retry loop.`
      );
      conflictRetryCount = 0;
      hasPendingSyncRequest = false;
      updateSyncEngineStatus({
        isSyncing: false,
        lastSyncError: errMsg,
        justSynced: false,
      });
      toast.show(i18n.t('syncStatus.errors.conflict'));
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: errMsg,
        actionTaken: 'up_to_date',
      };
    }
    if (getSyncErrorReasonKey(error) === 'network') {
      reportNetworkError();
    }
    updateSyncEngineStatus({
      isSyncing: false,
      lastSyncError: errMsg,
      justSynced: false,
    });
    if (!errMsg.includes('Sync already in progress')) {
      const reason = formatSyncErrorMessage(error);
      toast.show(i18n.t('syncStatus.syncFailedToast', { reason }));
    }
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: errMsg,
      actionTaken: 'up_to_date',
    };
  } finally {
    isSyncInProgress = false;
    drainPendingQueue();
  }
}

function drainPendingQueue(): void {
  if (hasPendingSyncRequest) {
    hasPendingSyncRequest = false;
    if (!isCloudSyncConnected() || isDeviceOffline()) return;
    const nextMode = pendingSyncMode;
    pendingSyncMode = 'auto';
    const jitterDelay = Math.floor(800 + Math.random() * 700);
    setTimeout(() => {
      if (!isCloudSyncConnected() || isDeviceOffline()) return;
      executeSync(nextMode).catch((err) => {
        console.warn('Pending sync execution error:', err);
      });
    }, jitterDelay);
  }
}

export function markPendingAutoSync(): void {
  try {
    localStorage.setItem(getProviderScopedStorageKey(PENDING_AUTO_SYNC_KEY), '1');
  } catch {
    // ignore storage errors
  }
}

export function hasPendingAutoSync(): boolean {
  try {
    return localStorage.getItem(getProviderScopedStorageKey(PENDING_AUTO_SYNC_KEY)) === '1';
  } catch {
    return false;
  }
}

export function clearPendingAutoSync(): void {
  try {
    localStorage.removeItem(getProviderScopedStorageKey(PENDING_AUTO_SYNC_KEY));
  } catch {
    // ignore storage errors
  }
}

/**
 * 取消已排程但尚未執行的防抖自動同步計時器
 */
export function cancelScheduledAutoSync(): void {
  if (autoSyncTimeout) {
    clearTimeout(autoSyncTimeout);
    autoSyncTimeout = null;
  }
}

/**
 * 安排防抖自動同步 (本地有數據變更後自動執行局部增量推送)
 */
export function scheduleAutoSync(delayMs = 2000): void {
  if (!isCloudSyncConnected()) return;
  if (isDeviceOffline()) {
    markPendingAutoSync();
    return;
  }

  if (autoSyncTimeout) {
    clearTimeout(autoSyncTimeout);
  }

  autoSyncTimeout = setTimeout(() => {
    autoSyncTimeout = null;
    if (!isCloudSyncConnected() || isDeviceOffline()) {
      if (isCloudSyncConnected()) markPendingAutoSync();
      return;
    }
    executeSync('auto').catch((err) => {
      console.warn('Auto folder sync error:', err);
    });
  }, delayMs);
}

/**
 * 立即沖刷待執行的防抖自動同步（用於手機切至背景或關閉頁面前把變更送出）
 */
export function flushAutoSync(): void {
  if (!autoSyncTimeout) return;
  clearTimeout(autoSyncTimeout);
  autoSyncTimeout = null;
  if (!isCloudSyncConnected() || isDeviceOffline()) {
    if (isCloudSyncConnected()) markPendingAutoSync();
    return;
  }
  executeSync('auto').catch((err) => {
    console.warn('Flush auto sync error:', err);
  });
}
