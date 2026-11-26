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
import {
  listRemoteFolder,
  downloadJsonFile,
  uploadJsonFile,
  getSyncErrorReasonKey,
  formatSyncErrorMessage,
  type SyncErrorReasonKey,
  type DropboxFileMetadata,
} from './dropboxClient';
import {
  sanitizeFoodItem,
  sanitizeRecipe,
  sanitizeDailyDietLog,
  sanitizeWorkoutLog,
  sanitizeWorkoutRoutine,
  sanitizeUserBaseInfo,
} from './syncSanitizers';
import { isDropboxConnected } from './dropboxAuth';
import { clearFoodsCache } from '@/hooks/useFoods';
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
  return localStorage.getItem(LAST_SYNC_KEY);
}

export function setLastSyncTime(isoTime: string): void {
  localStorage.setItem(LAST_SYNC_KEY, isoTime);
  updateSyncEngineStatus({ lastSyncTime: isoTime });
}

export function getCachedRevs(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CACHED_REVS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function setCachedRevs(revs: Record<string, string>): void {
  localStorage.setItem(CACHED_REVS_KEY, JSON.stringify(revs));
}

export function getPushedTimes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TABLE_PUSH_TIME_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function setPushedTimes(times: Record<string, string>): void {
  localStorage.setItem(TABLE_PUSH_TIME_KEY, JSON.stringify(times));
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

  // 1. 使用者個人資料（唯一真理源：base_info）
  cachedRevs['/user/base_info.json'] = await uploadJsonFile(
    '/user/base_info.json',
    baseInfos.map(sanitizeUserBaseInfo)
  );
  pushedTimes['user_base_info'] = now;

  // 2. 飲食模組基礎清單
  cachedRevs['/nutrition/foods.json'] = await uploadJsonFile(
    '/nutrition/foods.json',
    foods.map(sanitizeFoodItem)
  );
  cachedRevs['/nutrition/recipes.json'] = await uploadJsonFile(
    '/nutrition/recipes.json',
    recipes.map(sanitizeRecipe)
  );
  pushedTimes['foods'] = now;
  pushedTimes['recipes'] = now;

  // 3. 飲食日誌按日自包含膠囊 (YYYY-MM-DD，整合日誌頭部 meta 與進食組件 entries)
  const foodBucketManifest: Record<string, BucketInfo> = {};
  for (const dLog of dailyDietLogs) {
    const bucket = dLog.date;
    const bucketPath = `/nutrition/logs/${bucket}.json`;
    cachedRevs[bucketPath] = await uploadJsonFile(bucketPath, sanitizeDailyDietLog(dLog));
    const maxUpdated = getNormalizedTimestamp(dLog.updatedAt);
    foodBucketManifest[bucket] = {
      count: dLog.entries.length,
      updatedAt: maxUpdated,
    };
    pushedTimes[`diet_log_${bucket}`] = now;
    pushedTimes[`diet_log_${bucket}_count`] = String(dLog.entries.length);
  }
  const foodManifestData: BucketManifest = {
    version: 1,
    updatedAt: now,
    buckets: foodBucketManifest,
  };
  cachedRevs['/nutrition/logs/manifest.json'] = await uploadJsonFile(
    '/nutrition/logs/manifest.json',
    foodManifestData
  );

  // 4. 訓練模組基礎清單
  cachedRevs['/workout/exercises.json'] = await uploadJsonFile('/workout/exercises.json', exercises);
  cachedRevs['/workout/equipments.json'] = await uploadJsonFile('/workout/equipments.json', equipments);
  cachedRevs['/workout/routines.json'] = await uploadJsonFile(
    '/workout/routines.json',
    routines.map(sanitizeWorkoutRoutine)
  );
  pushedTimes['exercises'] = now;
  pushedTimes['equipments'] = now;
  pushedTimes['routines'] = now;

  // 5. 訓練日誌按日分卷 (YYYY-MM-DD)
  const groupedWorkoutLogs = groupWorkoutLogsByDate(workoutLogs);
  const workoutBucketManifest: Record<string, BucketInfo> = {};
  for (const [bucket, bLogs] of Object.entries(groupedWorkoutLogs)) {
    const bucketPath = `/workout/logs/${bucket}.json`;
    cachedRevs[bucketPath] = await uploadJsonFile(bucketPath, bLogs.map(sanitizeWorkoutLog));
    const maxUpdated = bLogs.reduce((max, l) => Math.max(max, getNormalizedTimestamp(l.updatedAt)), 0);
    workoutBucketManifest[bucket] = {
      count: bLogs.length,
      updatedAt: maxUpdated,
    };
    pushedTimes[`workout_log_${bucket}`] = now;
    pushedTimes[`workout_log_${bucket}_count`] = String(bLogs.length);
  }
  const workoutManifestData: BucketManifest = {
    version: 1,
    updatedAt: now,
    buckets: workoutBucketManifest,
  };
  cachedRevs['/workout/logs/manifest.json'] = await uploadJsonFile(
    '/workout/logs/manifest.json',
    workoutManifestData
  );

  // 6. 體態指標按日分卷 (YYYY-MM-DD)
  const groupedMetrics = groupBodyMetricsByDate(bodyMetrics);
  const bodyBucketManifest: Record<string, BucketInfo> = {};
  for (const [bucket, bMetrics] of Object.entries(groupedMetrics)) {
    const bucketPath = `/body/metrics/${bucket}.json`;
    cachedRevs[bucketPath] = await uploadJsonFile(bucketPath, bMetrics);
    const maxUpdated = bMetrics.reduce((max, m) => Math.max(max, getNormalizedTimestamp(m.updatedAt)), 0);
    bodyBucketManifest[bucket] = {
      count: bMetrics.length,
      updatedAt: maxUpdated,
    };
    pushedTimes[`body_metric_${bucket}`] = now;
    pushedTimes[`body_metric_${bucket}_count`] = String(bMetrics.length);
  }
  const bodyManifestData: BucketManifest = {
    version: 1,
    updatedAt: now,
    buckets: bodyBucketManifest,
  };
  cachedRevs['/body/metrics/manifest.json'] = await uploadJsonFile(
    '/body/metrics/manifest.json',
    bodyManifestData
  );

  // 7. 跨端實體刪除墓碑 (/deleted_entities.json)
  const localTombstones = getLocalEntityTombstones(Date.now());
  if (Object.keys(localTombstones).length > 0) {
    cachedRevs[DELETED_ENTITIES_PATH] = await uploadJsonFile(
      DELETED_ENTITIES_PATH,
      localTombstones
    );
    pushedTimes['deleted_entities'] = now;
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
    schemaVersion: 2,
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

  if (!isDropboxConnected()) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: 'Dropbox not connected',
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

    // 呼叫一次 listRemoteFolder，單次請求掌握所有遠端檔案及其 rev
    const remoteFiles = await listRemoteFolder();

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
        downloadJsonFile<UserBaseInfo[]>('/user/base_info.json'),
        downloadJsonFile<FoodItem[]>('/nutrition/foods.json'),
        downloadJsonFile<FoodRecipe[]>('/nutrition/recipes.json'),
        downloadJsonFile<Exercise[]>('/workout/exercises.json'),
        downloadJsonFile<Equipment[]>('/workout/equipments.json'),
        downloadJsonFile<WorkoutRoutine[]>('/workout/routines.json'),
      ]);

      // 下載所有飲食分卷
      const foodFiles = remoteFiles.filter(
        (f) =>
          f.path_lower.startsWith('/nutrition/logs/') &&
          f.name.endsWith('.json') &&
          !f.name.endsWith('manifest.json')
      );
      const foodChunks = await Promise.all(
        foodFiles.map((f) => downloadJsonFile<DailyDietLog | DailyDietLog[]>(f.path_lower))
      );
      const allDailyDietLogs: DailyDietLog[] = [];
      for (const chunk of foodChunks) {
        if (!chunk) continue;
        if (Array.isArray(chunk)) {
          allDailyDietLogs.push(...chunk.filter((item) => 'entries' in item).map(sanitizeDailyDietLog));
        } else if ('entries' in chunk) {
          allDailyDietLogs.push(sanitizeDailyDietLog(chunk));
        }
      }

      // 下載所有訓練分卷
      const workoutFiles = remoteFiles.filter(
        (f) =>
          f.path_lower.startsWith('/workout/logs/') &&
          f.name.endsWith('.json') &&
          !f.name.endsWith('manifest.json')
      );
      const workoutChunks = await Promise.all(
        workoutFiles.map((f) => downloadJsonFile<WorkoutLog[]>(f.path_lower))
      );
      const allWorkoutLogs: WorkoutLog[] = [];
      for (const chunk of workoutChunks) {
        if (chunk?.length) allWorkoutLogs.push(...chunk);
      }

      // 下載所有體態分卷
      const bodyFiles = remoteFiles.filter(
        (f) =>
          f.path_lower.startsWith('/body/metrics/') &&
          f.name.endsWith('.json') &&
          !f.name.endsWith('manifest.json')
      );
      const bodyChunks = await Promise.all(
        bodyFiles.map((f) => downloadJsonFile<BodyMetric[]>(f.path_lower))
      );
      const allBodyMetrics: BodyMetric[] = [];
      for (const chunk of bodyChunks) {
        if (chunk?.length) allBodyMetrics.push(...chunk);
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
    const baseInfoMeta = remoteFileMap.get('/user/base_info.json');
    if (baseInfoMeta && cachedRevs['/user/base_info.json'] !== baseInfoMeta.rev) {
      const rawRemote = (await downloadJsonFile<UserBaseInfo[]>('/user/base_info.json')) || [];
      const remoteList = rawRemote.map(sanitizeUserBaseInfo);
      const localList = await db.user_base_info.toArray();
      const m = mergeEntities(localList, remoteList);
      if (m.hasLocalChanges) {
        await withAutoSyncSuppressed(() => db.user_base_info.bulkPut(m.merged.map(sanitizeUserBaseInfo)));
        hasLocalModified = true;
      }
      if (m.hasRemoteChanges) hasRemoteModified = true;
      cachedRevs['/user/base_info.json'] = baseInfoMeta.rev;
      if (!m.hasRemoteChanges) {
        pushedTimes['user_base_info'] = now;
      }
    }

    // 2. 檢查 foods
    let forcePushFoodsFromSchema = false;
    const foodsMeta = remoteFileMap.get('/nutrition/foods.json');
    if (foodsMeta && cachedRevs['/nutrition/foods.json'] !== foodsMeta.rev) {
      const rawRemoteList = (await downloadJsonFile<unknown[]>('/nutrition/foods.json')) || [];
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
        clearFoodsCache();
        hasLocalModified = true;
      }
      if (m.hasRemoteChanges) hasRemoteModified = true;
      cachedRevs['/nutrition/foods.json'] = foodsMeta.rev;
      if (!m.hasRemoteChanges && !forcePushFoodsFromSchema) {
        pushedTimes['foods'] = now;
      }
    }

    // 4. 檢查 recipes
    const recipesMeta = remoteFileMap.get('/nutrition/recipes.json');
    if (recipesMeta && cachedRevs['/nutrition/recipes.json'] !== recipesMeta.rev) {
      const rawRemote = (await downloadJsonFile<FoodRecipe[]>('/nutrition/recipes.json')) || [];
      const remoteList = rawRemote.map(sanitizeRecipe);
      const localList = await db.recipes.toArray();
      const m = mergeEntities(localList, remoteList, mergedTombstones.recipes, nowTs);
      if (m.hasLocalChanges) {
        await withAutoSyncSuppressed(async () => {
          if (m.deletedIds.length) await db.recipes.bulkDelete(m.deletedIds);
          if (m.merged.length) await db.recipes.bulkPut(m.merged.map(sanitizeRecipe));
        });
        hasLocalModified = true;
      }
      if (m.hasRemoteChanges) hasRemoteModified = true;
      cachedRevs['/nutrition/recipes.json'] = recipesMeta.rev;
      if (!m.hasRemoteChanges) {
        pushedTimes['recipes'] = now;
      }
    }

    // 5. 檢查 exercises
    const exMeta = remoteFileMap.get('/workout/exercises.json');
    if (exMeta && cachedRevs['/workout/exercises.json'] !== exMeta.rev) {
      const remoteList = (await downloadJsonFile<Exercise[]>('/workout/exercises.json')) || [];
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
      cachedRevs['/workout/exercises.json'] = exMeta.rev;
      if (!m.hasRemoteChanges) {
        pushedTimes['exercises'] = now;
      }
    }

    // 6. 檢查 equipments
    const eqMeta = remoteFileMap.get('/workout/equipments.json');
    if (eqMeta && cachedRevs['/workout/equipments.json'] !== eqMeta.rev) {
      const remoteList = (await downloadJsonFile<Equipment[]>('/workout/equipments.json')) || [];
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
      cachedRevs['/workout/equipments.json'] = eqMeta.rev;
      if (!m.hasRemoteChanges) {
        pushedTimes['equipments'] = now;
      }
    }

    // 7. 檢查 routines
    const routinesMeta = remoteFileMap.get('/workout/routines.json');
    if (routinesMeta && cachedRevs['/workout/routines.json'] !== routinesMeta.rev) {
      const rawRemote = (await downloadJsonFile<WorkoutRoutine[]>('/workout/routines.json')) || [];
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
      cachedRevs['/workout/routines.json'] = routinesMeta.rev;
      if (!m.hasRemoteChanges) {
        pushedTimes['routines'] = now;
      }
    }

    // 8. 檢查 daily_diet_logs 各日分卷 (/nutrition/logs/YYYY-MM-DD.json)
    const dirtyDietBuckets = new Set<string>();
    const remoteFoodBuckets = remoteFiles.filter(
      (f) =>
        f.path_lower.startsWith('/nutrition/logs/') &&
        f.name.endsWith('.json') &&
        !f.name.endsWith('manifest.json')
    );
    for (const bMeta of remoteFoodBuckets) {
      const path = bMeta.path_lower;
      if (cachedRevs[path] !== bMeta.rev) {
        const bucket = bMeta.name.replace('.json', '');
        const rawRemote = await downloadJsonFile<DailyDietLog | DailyDietLog[]>(path);
        if (rawRemote) {
          let remoteLog: DailyDietLog | null = null;
          if (Array.isArray(rawRemote)) {
            if (rawRemote.length > 0 && 'entries' in rawRemote[0]) {
              remoteLog = sanitizeDailyDietLog(rawRemote[0]);
            }
          } else if ('entries' in rawRemote) {
            remoteLog = sanitizeDailyDietLog(rawRemote);
          }

          if (!remoteLog) {
            cachedRevs[path] = bMeta.rev;
            continue;
          }

          const localLog = await db.daily_diet_logs.where('date').equals(bucket).first();
          if (!localLog) {
            await withAutoSyncSuppressed(() => db.daily_diet_logs.put(remoteLog));
            hasLocalModified = true;
            pushedTimes[`diet_log_${bucket}`] = now;
            pushedTimes[`diet_log_${bucket}_count`] = String(remoteLog.entries.length);
          } else {
            const m = mergeDietLogsByDate([localLog], [remoteLog]);
            if (m.hasLocalChanges && m.merged[0]) {
              const mergedLog = { ...m.merged[0], id: localLog.id };
              await withAutoSyncSuppressed(() => db.daily_diet_logs.put(mergedLog));
              hasLocalModified = true;
              if (!m.hasRemoteChanges) {
                pushedTimes[`diet_log_${bucket}`] = now;
                pushedTimes[`diet_log_${bucket}_count`] = String(mergedLog.entries.length);
              }
            }
            if (m.hasRemoteChanges) {
              hasRemoteModified = true;
              dirtyDietBuckets.add(bucket);
            }
            if (!m.hasLocalChanges && !m.hasRemoteChanges) {
              pushedTimes[`diet_log_${bucket}`] = now;
              pushedTimes[`diet_log_${bucket}_count`] = String(localLog.entries.length);
            }
          }
        }
        cachedRevs[path] = bMeta.rev;
      }
    }

    // 10. 檢查 workout_logs 各月份分卷
    const remoteWorkoutBuckets = remoteFiles.filter(
      (f) =>
        f.path_lower.startsWith('/workout/logs/') &&
        f.name.endsWith('.json') &&
        !f.name.endsWith('manifest.json')
    );
    for (const bMeta of remoteWorkoutBuckets) {
      const path = bMeta.path_lower;
      if (cachedRevs[path] !== bMeta.rev) {
        const bucket = bMeta.name.replace('.json', '');
        const rawRemote = (await downloadJsonFile<WorkoutLog[]>(path)) || [];
        const remoteList = rawRemote.map(sanitizeWorkoutLog);
        const localList = await db.workout_logs.filter((l) => l.date.startsWith(bucket)).toArray();
        const m = mergeWorkoutLogs(localList, remoteList, mergedTombstones.workout_logs, nowTs);
        if (m.hasLocalChanges) {
          await withAutoSyncSuppressed(async () => {
            if (m.deletedIds.length) await db.workout_logs.bulkDelete(m.deletedIds);
            if (m.merged.length) await db.workout_logs.bulkPut(m.merged.map(sanitizeWorkoutLog));
          });
          hasLocalModified = true;
        }
        if (m.hasRemoteChanges) hasRemoteModified = true;
        cachedRevs[path] = bMeta.rev;
        if (!m.hasRemoteChanges) {
          pushedTimes[`workout_log_${bucket}`] = now;
          pushedTimes[`workout_log_${bucket}_count`] = String(m.merged.length);
        }
      }
    }

    // 11. 檢查 body_metrics 各年份分卷
    const remoteBodyBuckets = remoteFiles.filter(
      (f) =>
        f.path_lower.startsWith('/body/metrics/') &&
        f.name.endsWith('.json') &&
        !f.name.endsWith('manifest.json')
    );
    for (const bMeta of remoteBodyBuckets) {
      const path = bMeta.path_lower;
      if (cachedRevs[path] !== bMeta.rev) {
        const bucket = bMeta.name.replace('.json', '');
        const remoteList = (await downloadJsonFile<BodyMetric[]>(path)) || [];
        const localList = await db.body_metrics.filter((m) => m.date.startsWith(bucket)).toArray();
        const m = mergeEntities(localList, remoteList, mergedTombstones.body_metrics, nowTs);
        if (m.hasLocalChanges) {
          await withAutoSyncSuppressed(async () => {
            if (m.deletedIds.length) await db.body_metrics.bulkDelete(m.deletedIds);
            if (m.merged.length) await db.body_metrics.bulkPut(m.merged);
          });
          hasLocalModified = true;
        }
        if (m.hasRemoteChanges) hasRemoteModified = true;
        cachedRevs[path] = bMeta.rev;
        if (!m.hasRemoteChanges) {
          pushedTimes[`body_metric_${bucket}`] = now;
          pushedTimes[`body_metric_${bucket}_count`] = String(m.merged.length);
        }
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
      cachedRevs['/user/base_info.json'] = await uploadJsonFile(
        '/user/base_info.json',
        localBaseInfo.map(sanitizeUserBaseInfo),
        cachedRevs['/user/base_info.json']
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
      cachedRevs['/nutrition/foods.json'] = await uploadJsonFile(
        '/nutrition/foods.json',
        localFoods.map(sanitizeFoodItem),
        cachedRevs['/nutrition/foods.json']
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
      cachedRevs['/nutrition/recipes.json'] = await uploadJsonFile(
        '/nutrition/recipes.json',
        localRecipes.map(sanitizeRecipe),
        cachedRevs['/nutrition/recipes.json']
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
      cachedRevs['/workout/exercises.json'] = await uploadJsonFile(
        '/workout/exercises.json',
        localExercises,
        cachedRevs['/workout/exercises.json']
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
      cachedRevs['/workout/equipments.json'] = await uploadJsonFile(
        '/workout/equipments.json',
        localEquipments,
        cachedRevs['/workout/equipments.json']
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
      cachedRevs['/workout/routines.json'] = await uploadJsonFile(
        '/workout/routines.json',
        localRoutines.map(sanitizeWorkoutRoutine),
        cachedRevs['/workout/routines.json']
      );
      pushedTimes['routines'] = now;
      hasRemoteModified = true;
    }

    // 9. daily_diet_logs 增量推送 (按日自包含膠囊 /nutrition/logs/YYYY-MM-DD.json)
    const allLocalDietLogs = await db.daily_diet_logs.toArray();
    let dietLogsChanged = false;
    const foodBucketManifestData: Record<string, BucketInfo> = {};

    for (const dLog of allLocalDietLogs) {
      const bucket = dLog.date;
      const bucketPath = `/nutrition/logs/${bucket}.json`;
      const lastPushed = pushedTimes[`diet_log_${bucket}`] || '';
      const lastCount = pushedTimes[`diet_log_${bucket}_count`];
      const maxUpdated = getNormalizedTimestamp(dLog.updatedAt);

      const isCountChanged = lastCount !== undefined && lastCount !== String(dLog.entries.length);
      const isTimeUpdated = !lastPushed || maxUpdated > getNormalizedTimestamp(lastPushed);
      const isMissingOnRemote = !cachedRevs[bucketPath];

      if (isTimeUpdated || isCountChanged || isMissingOnRemote || dirtyDietBuckets.has(bucket)) {
        cachedRevs[bucketPath] = await uploadJsonFile(
          bucketPath,
          sanitizeDailyDietLog(dLog),
          cachedRevs[bucketPath]
        );
        pushedTimes[`diet_log_${bucket}`] = now;
        pushedTimes[`diet_log_${bucket}_count`] = String(dLog.entries.length);
        dietLogsChanged = true;
        hasRemoteModified = true;
      }

      foodBucketManifestData[bucket] = {
        count: dLog.entries.length,
        updatedAt: maxUpdated,
      };
    }

    if (dietLogsChanged || !cachedRevs['/nutrition/logs/manifest.json']) {
      const foodManifest: BucketManifest = {
        version: 1,
        updatedAt: now,
        buckets: foodBucketManifestData,
      };
      cachedRevs['/nutrition/logs/manifest.json'] = await uploadJsonFile(
        '/nutrition/logs/manifest.json',
        foodManifest
      );
    }

    // 10. workout_logs 增量推送 (按日分卷 YYYY-MM-DD)
    const allLocalWorkoutLogs = await db.workout_logs.toArray();
    const groupedLocalWorkoutLogs = groupWorkoutLogsByDate(allLocalWorkoutLogs);
    let workoutLogsChanged = false;
    const workoutBucketManifestData: Record<string, BucketInfo> = {};

    for (const [bucket, bLogs] of Object.entries(groupedLocalWorkoutLogs)) {
      const bucketPath = `/workout/logs/${bucket}.json`;
      const lastPushed = pushedTimes[`workout_log_${bucket}`] || '';
      const lastCount = pushedTimes[`workout_log_${bucket}_count`];
      const maxUpdated = bLogs.reduce((max, l) => Math.max(max, getNormalizedTimestamp(l.updatedAt)), 0);

      const isCountChanged = lastCount !== undefined && lastCount !== String(bLogs.length);
      const isTimeUpdated = !lastPushed || maxUpdated > getNormalizedTimestamp(lastPushed);
      const isMissingOnRemote = !cachedRevs[bucketPath];

      if (isTimeUpdated || isCountChanged || isMissingOnRemote) {
        cachedRevs[bucketPath] = await uploadJsonFile(
          bucketPath,
          bLogs.map(sanitizeWorkoutLog),
          cachedRevs[bucketPath]
        );
        pushedTimes[`workout_log_${bucket}`] = now;
        pushedTimes[`workout_log_${bucket}_count`] = String(bLogs.length);
        workoutLogsChanged = true;
        hasRemoteModified = true;
      }

      workoutBucketManifestData[bucket] = {
        count: bLogs.length,
        updatedAt: maxUpdated,
      };
    }

    for (const bMeta of remoteWorkoutBuckets) {
      const bucket = bMeta.name.replace('.json', '');
      if (!groupedLocalWorkoutLogs[bucket] && pushedTimes[`workout_log_${bucket}_count`] !== '0') {
        const bucketPath = bMeta.path_lower;
        cachedRevs[bucketPath] = await uploadJsonFile(bucketPath, [], cachedRevs[bucketPath]);
        delete pushedTimes[`workout_log_${bucket}`];
        pushedTimes[`workout_log_${bucket}_count`] = '0';
        workoutLogsChanged = true;
        hasRemoteModified = true;
      }
    }

    if (workoutLogsChanged || !cachedRevs['/workout/logs/manifest.json']) {
      const workoutManifest: BucketManifest = {
        version: 1,
        updatedAt: now,
        buckets: workoutBucketManifestData,
      };
      cachedRevs['/workout/logs/manifest.json'] = await uploadJsonFile(
        '/workout/logs/manifest.json',
        workoutManifest
      );
    }

    // 11. body_metrics 增量推送 (按日分卷 YYYY-MM-DD)
    const allLocalMetrics = await db.body_metrics.toArray();
    const groupedLocalMetrics = groupBodyMetricsByDate(allLocalMetrics);
    let bodyMetricsChanged = false;
    const bodyBucketManifestData: Record<string, BucketInfo> = {};

    for (const [bucket, bMetrics] of Object.entries(groupedLocalMetrics)) {
      const bucketPath = `/body/metrics/${bucket}.json`;
      const lastPushed = pushedTimes[`body_metric_${bucket}`] || '';
      const lastCount = pushedTimes[`body_metric_${bucket}_count`];
      const maxUpdated = bMetrics.reduce((max, m) => Math.max(max, getNormalizedTimestamp(m.updatedAt)), 0);

      const isCountChanged = lastCount !== undefined && lastCount !== String(bMetrics.length);
      const isTimeUpdated = !lastPushed || maxUpdated > getNormalizedTimestamp(lastPushed);
      const isMissingOnRemote = !cachedRevs[bucketPath];

      if (isTimeUpdated || isCountChanged || isMissingOnRemote) {
        cachedRevs[bucketPath] = await uploadJsonFile(
          bucketPath,
          bMetrics,
          cachedRevs[bucketPath]
        );
        pushedTimes[`body_metric_${bucket}`] = now;
        pushedTimes[`body_metric_${bucket}_count`] = String(bMetrics.length);
        bodyMetricsChanged = true;
        hasRemoteModified = true;
      }

      bodyBucketManifestData[bucket] = {
        count: bMetrics.length,
        updatedAt: maxUpdated,
      };
    }

    for (const bMeta of remoteBodyBuckets) {
      const bucket = bMeta.name.replace('.json', '');
      if (!groupedLocalMetrics[bucket] && pushedTimes[`body_metric_${bucket}_count`] !== '0') {
        const bucketPath = bMeta.path_lower;
        cachedRevs[bucketPath] = await uploadJsonFile(bucketPath, [], cachedRevs[bucketPath]);
        delete pushedTimes[`body_metric_${bucket}`];
        pushedTimes[`body_metric_${bucket}_count`] = '0';
        bodyMetricsChanged = true;
        hasRemoteModified = true;
      }
    }

    if (bodyMetricsChanged || !cachedRevs['/body/metrics/manifest.json']) {
      const bodyManifest: BucketManifest = {
        version: 1,
        updatedAt: now,
        buckets: bodyBucketManifestData,
      };
      cachedRevs['/body/metrics/manifest.json'] = await uploadJsonFile(
        '/body/metrics/manifest.json',
        bodyManifest
      );
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
    console.error('Folder sync execution error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown sync error';
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
    if (!isDropboxConnected() || isDeviceOffline()) return;
    const nextMode = pendingSyncMode;
    pendingSyncMode = 'auto';
    const jitterDelay = Math.floor(800 + Math.random() * 700);
    setTimeout(() => {
      if (!isDropboxConnected() || isDeviceOffline()) return;
      executeSync(nextMode).catch((err) => {
        console.warn('Pending sync execution error:', err);
      });
    }, jitterDelay);
  }
}

export function markPendingAutoSync(): void {
  try {
    localStorage.setItem(PENDING_AUTO_SYNC_KEY, '1');
  } catch {
    // ignore storage errors
  }
}

export function hasPendingAutoSync(): boolean {
  try {
    return localStorage.getItem(PENDING_AUTO_SYNC_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearPendingAutoSync(): void {
  try {
    localStorage.removeItem(PENDING_AUTO_SYNC_KEY);
  } catch {
    // ignore storage errors
  }
}

/**
 * 安排防抖自動同步 (本地有數據變更後自動執行局部增量推送)
 */
export function scheduleAutoSync(delayMs = 2000): void {
  if (!isDropboxConnected()) return;
  if (isDeviceOffline()) {
    markPendingAutoSync();
    return;
  }

  if (autoSyncTimeout) {
    clearTimeout(autoSyncTimeout);
  }

  autoSyncTimeout = setTimeout(() => {
    autoSyncTimeout = null;
    if (!isDropboxConnected() || isDeviceOffline()) {
      if (isDropboxConnected()) markPendingAutoSync();
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
  if (!isDropboxConnected() || isDeviceOffline()) {
    if (isDropboxConnected()) markPendingAutoSync();
    return;
  }
  executeSync('auto').catch((err) => {
    console.warn('Flush auto sync error:', err);
  });
}
