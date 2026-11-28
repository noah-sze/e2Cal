import {
  db,
  withAutoSyncSuppressed,
  getLocalEntityTombstones,
  setLocalEntityTombstones,
  type EntityTombstoneMap,
} from '@/services/db/db';
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
import { type DropboxFileMetadata } from './dropboxClient';
import {
  getWorkingSyncAdapter,
  getActiveSyncProviderId,
  setActiveSyncProviderId,
  setStagingSyncProviderId,
  notifySyncConnectionChanged,
} from './syncRouter';
import {
  commitStagingWebDavConfig,
  clearStagingWebDavConfig,
} from './adapters/webdavAdapter';
import {
  commitStagingS3Config,
  clearStagingS3Config,
} from './adapters/s3Adapter';
import type { SyncProviderId, SyncChannelScope } from './syncAdapter';
import type { RollingBackupItem } from './rollingBackupService';
import {
  SYNC_PATHS,
  isMonthlyLogFilePath,
  parseMonthlyLogBucketStrict,
  assertCompatibleSchemaVersion,
  assertValidArrayPayload,
  type MonthlySyncLogBucket,
} from './syncSchema';

const listRemoteFolder = (folderPath = '') =>
  getWorkingSyncAdapter().listRemoteFolder(folderPath);
const downloadJsonFile = <T>(filePath: string) =>
  getWorkingSyncAdapter().downloadJsonFile<T>(filePath);
const uploadJsonFile = <T>(filePath: string, data: T, expectedRev?: string) =>
  getWorkingSyncAdapter().uploadJsonFile<T>(filePath, data, expectedRev);
import {
  sanitizeFoodItem,
  sanitizeRecipe,
  sanitizeWorkoutRoutine,
  sanitizeUserBaseInfo,
} from './syncSanitizers';
import {
  commitStagingTokens,
  clearStagingTokens,
  setStagingTokens,
  exchangeCodeForTokensOnly,
  type DropboxTokens,
  type DropboxOAuthMode,
} from './dropboxAuth';
import { PRIMARY_USER_ID } from '@/services/db/defaultData';
import { clearFoodsCache } from '@/hooks/useFoods';
import { clearRecipesCache } from '@/hooks/useRecipes';
import { clearExercisesCache } from '@/hooks/useExercises';
import { syncUserProfileCache } from '@/hooks/useUserProfile';
import { confirmRawWeightIfHasDietActivity } from '@/utils/rawWeightGuide';
import i18n from '@/i18n/config';
import { toast } from '@/components/ui/toast';
import {
  mergeEntities,
  mergeEntityTombstoneMaps,
  mergeWorkoutLogs,
  mergeDietLogsByDate,
  getNormalizedTimestamp,
  uploadAllLocalData,
  setLastSyncTime,
  setCachedRevs,
  getCachedRevs,
  getPushedTimes,
  setPushedTimes,
  formatSyncErrorMessage,
  type SyncManifest,
} from './syncEngine';

export type InitialSyncStep =
  | 'CONNECTING'       // 前置: OAuth 回調換取憑證與檢查遠端來源
  | 'SOURCE_PICKER'    // 前置: 落地頁雲端導入來源選擇 (/app vs /backup)
  | 'AUTH'             // 步驟 1: 換取 Token (暫存)
  | 'STRATEGY'         // 步驟 2: 衝突策略選擇 (雙方均有資料時)
  | 'DOWNLOADING'      // 步驟 3: 下載暫存至記憶體
  | 'APPLYING'         // 步驟 4: 本地原子事務寫入
  | 'COMPLETED'        // 步驟 5: 完成展示
  | 'BACKUP_CONNECTED' // 獨立完成態: 每日滾動備份連線完成
  | 'BLOCKED';         // 阻斷態: 同帳戶衝突或無可還原資料

export type SyncConflictStrategy = 'merge' | 'overwrite_local' | 'overwrite_remote';

export type CloudSyncFlowBlockedReason = 'account_conflict' | 'no_restorable_data';

export interface CloudFlowSourcePickerPayload {
  providerId: SyncProviderId;
  hasPrimarySync: boolean;
  backupItems: RollingBackupItem[];
  preloadedTokens?: DropboxTokens;
  onSelectRollingBackup: (item: RollingBackupItem) => Promise<void>;
  onCancel?: () => void;
}

export interface CloudFlowBlockedPayload {
  providerId: SyncProviderId;
  reason: CloudSyncFlowBlockedReason;
  targetScope?: SyncChannelScope;
  accountLabel?: string;
}

export interface InitialSyncState {
  isOpen: boolean;
  step: InitialSyncStep;
  progressPercent: number;
  downloadedFilesCount: number;
  totalFilesCount: number;
  localCount: number;
  remoteCount: number;
  localBaseInfo: UserBaseInfo | null;
  remoteBaseInfo: UserBaseInfo | null;
  error?: string;
  isApplying: boolean;
  summary?: {
    foodsCount: number;
    exercisesCount: number;
    foodLogsCount: number;
    workoutLogsCount: number;
    bodyMetricsCount: number;
  };
  connectingProvider?: SyncProviderId | null;
  sourcePicker?: CloudFlowSourcePickerPayload | null;
  blocked?: CloudFlowBlockedPayload | null;
  backupConnectedProvider?: SyncProviderId | null;
}

interface StagedData {
  baseInfos: UserBaseInfo[];
  foods: FoodItem[];
  recipes: FoodRecipe[];
  dailyDietLogs: DailyDietLog[];
  exercises: Exercise[];
  equipments: Equipment[];
  routines: WorkoutRoutine[];
  workoutLogs: WorkoutLog[];
  bodyMetrics: BodyMetric[];
  revs: Record<string, string>;
  tombstones: EntityTombstoneMap;
  tombstonesChangedRemote: boolean;
}

interface InitialSyncStaging {
  providerId: SyncProviderId;
  mode: DropboxOAuthMode;
  tokens: DropboxTokens | null;
  remoteManifest: SyncManifest | null;
  remoteFiles: DropboxFileMetadata[];
  strategy: SyncConflictStrategy | null;
  downloaded: StagedData;
}

let staging: InitialSyncStaging = {
  providerId: 'dropbox',
  mode: 'sync',
  tokens: null,
  remoteManifest: null,
  remoteFiles: [],
  strategy: null,
  downloaded: {
    baseInfos: [],
    foods: [],
    recipes: [],
    dailyDietLogs: [],
    exercises: [],
    equipments: [],
    routines: [],
    workoutLogs: [],
    bodyMetrics: [],
    revs: {},
    tombstones: {},
    tombstonesChangedRemote: false,
  },
};

let currentState: InitialSyncState = {
  isOpen: false,
  step: 'AUTH',
  progressPercent: 0,
  downloadedFilesCount: 0,
  totalFilesCount: 0,
  localCount: 0,
  remoteCount: 0,
  localBaseInfo: null,
  remoteBaseInfo: null,
  isApplying: false,
};

type StateListener = (state: InitialSyncState) => void;
const listeners = new Set<StateListener>();

function emitState(nextState: Partial<InitialSyncState>) {
  currentState = { ...currentState, ...nextState };
  listeners.forEach((listener) => listener(currentState));
}

export function subscribeInitialSyncState(listener: StateListener): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

export function getInitialSyncState(): InitialSyncState {
  return currentState;
}

function commitProviderStaging(): void {
  if (staging.providerId === 'dropbox') {
    commitStagingTokens();
  } else if (staging.providerId === 'webdav') {
    commitStagingWebDavConfig('primary');
  } else if (staging.providerId === 's3') {
    commitStagingS3Config('primary');
  }
  setActiveSyncProviderId(staging.providerId);
  setStagingSyncProviderId(null);
  notifySyncConnectionChanged();
}

function rollbackProviderStaging(): void {
  if (staging.providerId === 'dropbox') {
    clearStagingTokens();
  } else if (staging.providerId === 'webdav') {
    clearStagingWebDavConfig('primary');
  } else if (staging.providerId === 's3') {
    clearStagingS3Config('primary');
  }
  setStagingSyncProviderId(null);
}

/**
 * 啟動首次同步流程（支援 Dropbox OAuth 或 WebDAV / S3 直接連線）
 */
export async function startInitialSync(
  code: string,
  options?: {
    mode?: DropboxOAuthMode;
    providerId?: SyncProviderId;
    preloadedTokens?: DropboxTokens;
  }
): Promise<void> {
  const providerId: SyncProviderId = options?.providerId ?? 'dropbox';
  setStagingSyncProviderId(providerId);

  staging = {
    providerId,
    mode: options?.mode || 'sync',
    tokens: null,
    remoteManifest: null,
    remoteFiles: [],
    strategy: null,
    downloaded: {
      baseInfos: [],
      foods: [],
      recipes: [],
      dailyDietLogs: [],
      exercises: [],
      equipments: [],
      routines: [],
      workoutLogs: [],
      bodyMetrics: [],
      revs: {},
      tombstones: {},
      tombstonesChangedRemote: false,
    },
  };

  emitState({
    isOpen: true,
    step: 'AUTH',
    progressPercent: 15,
    downloadedFilesCount: 0,
    totalFilesCount: 0,
    localCount: 0,
    remoteCount: 0,
    localBaseInfo: null,
    remoteBaseInfo: null,
    error: undefined,
    isApplying: false,
    summary: undefined,
    connectingProvider: null,
    sourcePicker: null,
    blocked: null,
    backupConnectedProvider: null,
  });

  try {
    // 步驟 1: OAuth 渠道僅暫存 Token（若已由前置帳戶檢測換取則直接複用）；WebDAV / S3 直接測試連線
    if (providerId === 'dropbox') {
      const tokens = options?.preloadedTokens ?? (await exchangeCodeForTokensOnly(code));
      staging.tokens = tokens;
      setStagingTokens(tokens);
    }

    emitState({ progressPercent: 30 });

    // 步驟 2: 檢查遠端 Manifest 與資料總量
    await inspectRemote();
  } catch (err: unknown) {
    console.error('Initial sync auth failed:', err);
    rollbackProviderStaging();
    const reason = formatSyncErrorMessage(err);
    toast.show(i18n.t('syncStatus.authFailedToast', { reason }));
    emitState({
      error: reason,
      progressPercent: 0,
    });
  }
}

/**
 * 檢查遠端檔案清單與記錄筆數
 */
async function inspectRemote(): Promise<void> {
  try {
    const [localDietLogs, localWorkoutLogs, localMetrics, localBaseInfoRaw] = await Promise.all([
      db.daily_diet_logs.count(),
      db.workout_logs.count(),
      db.body_metrics.count(),
      db.user_base_info.get(PRIMARY_USER_ID),
    ]);
    const localCount = localDietLogs + localWorkoutLogs + localMetrics;
    const localBaseInfo = localBaseInfoRaw ?? null;

    const remoteFiles = (await listRemoteFolder()).filter(
      (f) => !f.path_lower.startsWith('/backup/')
    );
    staging.remoteFiles = remoteFiles;

    const manifestMeta = remoteFiles.find((f) => f.path_lower === SYNC_PATHS.MANIFEST);
    const baseInfoMeta = remoteFiles.find((f) => f.path_lower === SYNC_PATHS.BASE_INFO);

    let remoteManifest: SyncManifest | null = null;
    let remoteCount = 0;
    let remoteBaseInfo: UserBaseInfo | null = null;

    const [downloadedManifest, downloadedBaseInfos] = await Promise.all([
      manifestMeta ? downloadJsonFile<SyncManifest>(SYNC_PATHS.MANIFEST) : Promise.resolve(null),
      baseInfoMeta
        ? downloadJsonFile<UserBaseInfo[]>(SYNC_PATHS.BASE_INFO).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (downloadedBaseInfos && downloadedBaseInfos.length > 0) {
      remoteBaseInfo = sanitizeUserBaseInfo(downloadedBaseInfos[0]);
    }

    if (downloadedManifest) {
      assertCompatibleSchemaVersion(downloadedManifest);
      remoteManifest = downloadedManifest;
      staging.remoteManifest = remoteManifest;
      if (remoteManifest?.stats) {
        remoteCount =
          (remoteManifest.stats.dailyDietLogsCount || 0) +
          (remoteManifest.stats.workoutLogsCount || 0) +
          (remoteManifest.stats.bodyMetricsCount || 0);
      }
    } else {
      // 算遠端 json 檔案數量作為簡易粗估
      remoteCount = remoteFiles.filter(
        (f) => f.name.endsWith('.json') && !f.name.endsWith('manifest.json')
      ).length;
    }

    emitState({
      localCount,
      remoteCount,
      localBaseInfo,
      remoteBaseInfo,
      progressPercent: 45,
    });

    // 落地頁「雲端導入」模式：若雲端完全無備份檔，中止還原並回滾暫存憑證（絕不覆寫空資料至雲端）
    if (staging.mode === 'restore') {
      const hasRemoteDataFiles = remoteFiles.some(
        (f) => f.name.endsWith('.json') && !f.name.endsWith('manifest.json')
      );
      if (!hasRemoteDataFiles) {
        rollbackProviderStaging();
        const emptyReason = i18n.t('initialSync.emptyRemoteError', '雲端無備份資料');
        toast.show(emptyReason);
        emitState({
          error: emptyReason,
          progressPercent: 0,
        });
        return;
      }

      await selectStrategy('overwrite_local');
      return;
    }

    const localName = localBaseInfo?.name?.trim() || '';
    const remoteName = remoteBaseInfo?.name?.trim() || '';
    const isNameMismatch = Boolean(localName && remoteName && localName !== remoteName);

    // 判定衝突策略（雙方皆有資料，或姓名不一致時一律進入策略選擇）
    await determineStrategy(localCount, remoteCount, isNameMismatch);
  } catch (err: unknown) {
    console.error('Inspect remote failed:', err);
    rollbackProviderStaging();
    const reason = formatSyncErrorMessage(err);
    toast.show(i18n.t('syncStatus.syncFailedToast', { reason }));
    emitState({
      error: reason,
    });
  }
}

/**
 * 判定資料衝突策略 (若一方為空且個人姓名未衝突則自動進入下載/上傳，否則展示選擇介面)
 */
async function determineStrategy(
  localCount: number,
  remoteCount: number,
  isNameMismatch: boolean
): Promise<void> {
  if ((localCount > 0 && remoteCount > 0) || isNameMismatch) {
    emitState({
      step: 'STRATEGY',
      progressPercent: 50,
      error: undefined,
    });
    return;
  }

  if (remoteCount === 0) {
    // 雲端無資料（初次備份上傳），自動覆蓋雲端
    await selectStrategy('overwrite_remote');
    return;
  }

  // 本地無資料（全新設備換機），自動覆蓋本地
  await selectStrategy('overwrite_local');
}

/**
 * 使用者或系統選擇同步策略並執行後續下載與寫入
 */
export async function selectStrategy(strategy: SyncConflictStrategy): Promise<void> {
  staging.strategy = strategy;

  if (strategy === 'overwrite_remote') {
    await executeAtomicCommit();
    return;
  }

  await executeDownloadQueue();
}

/**
 * 執行下載佇列：將遠端所有模組下載至記憶體暫存
 */
async function executeDownloadQueue(): Promise<void> {
  emitState({
    step: 'DOWNLOADING',
    progressPercent: 55,
    downloadedFilesCount: 0,
    totalFilesCount: 0,
    error: undefined,
  });

  const remoteFiles = staging.remoteFiles;
  const jsonFiles = remoteFiles.filter(
    (f) => f.name.endsWith('.json') && !f.name.endsWith('manifest.json')
  );

  const staged = staging.downloaded;
  let remoteTombstones: EntityTombstoneMap = {};

  if (jsonFiles.length === 0) {
    const nowTs = Date.now();
    const localTombstones = getLocalEntityTombstones(nowTs);
    const mTomb = mergeEntityTombstoneMaps(localTombstones, remoteTombstones, nowTs);
    staged.tombstones = mTomb.merged;
    staged.tombstonesChangedRemote = mTomb.changedRemote;
    await executeAtomicCommit();
    return;
  }

  const total = jsonFiles.length;
  let downloadedCount = 0;

  emitState({
    totalFilesCount: total,
    downloadedFilesCount: 0,
  });

  try {
    for (const file of jsonFiles) {
      const path = file.path_lower;

      if (path === SYNC_PATHS.BASE_INFO) {
        const data = assertValidArrayPayload<UserBaseInfo>(
          await downloadJsonFile<unknown>(path),
          'base_info'
        );
        staged.baseInfos.push(...data.map(sanitizeUserBaseInfo));
      } else if (path === SYNC_PATHS.FOODS) {
        const data = assertValidArrayPayload<FoodItem>(
          await downloadJsonFile<unknown>(path),
          'foods'
        );
        staged.foods.push(...data.map(sanitizeFoodItem));
      } else if (path === SYNC_PATHS.RECIPES) {
        const data = assertValidArrayPayload<FoodRecipe>(
          await downloadJsonFile<unknown>(path),
          'recipes'
        );
        staged.recipes.push(...data.map(sanitizeRecipe));
      } else if (path === SYNC_PATHS.EXERCISES) {
        const data = assertValidArrayPayload<Exercise>(
          await downloadJsonFile<unknown>(path),
          'exercises'
        );
        staged.exercises.push(...data);
      } else if (path === SYNC_PATHS.EQUIPMENTS) {
        const data = assertValidArrayPayload<Equipment>(
          await downloadJsonFile<unknown>(path),
          'equipments'
        );
        staged.equipments.push(...data);
      } else if (path === SYNC_PATHS.ROUTINES) {
        const data = assertValidArrayPayload<WorkoutRoutine>(
          await downloadJsonFile<unknown>(path),
          'routines'
        );
        staged.routines.push(...data.map(sanitizeWorkoutRoutine));
      } else if (isMonthlyLogFilePath(path, file.name)) {
        const raw = await downloadJsonFile<MonthlySyncLogBucket>(path);
        const parsed = parseMonthlyLogBucketStrict(raw);
        staged.dailyDietLogs.push(...parsed.dailyDietLogs);
        staged.workoutLogs.push(...parsed.workoutLogs);
        staged.bodyMetrics.push(...parsed.bodyMetrics);
      } else if (path === SYNC_PATHS.DELETED_ENTITIES) {
        const data = await downloadJsonFile<EntityTombstoneMap>(path);
        if (data) remoteTombstones = data;
      }

      staged.revs[path] = file.rev;
      downloadedCount++;

      const percent = Math.min(85, 55 + Math.round((downloadedCount / total) * 30));
      emitState({
        downloadedFilesCount: downloadedCount,
        progressPercent: percent,
      });
    }

    const nowTs = Date.now();
    const localTombstones = getLocalEntityTombstones(nowTs);
    const mTomb = mergeEntityTombstoneMaps(localTombstones, remoteTombstones, nowTs);
    staged.tombstones = mTomb.merged;
    staged.tombstonesChangedRemote = mTomb.changedRemote;

    await executeAtomicCommit();
  } catch (err: unknown) {
    console.error('Download queue error:', err);
    rollbackProviderStaging();
    const reason = formatSyncErrorMessage(err);
    toast.show(i18n.t('syncStatus.syncFailedToast', { reason }));
    emitState({
      error: reason,
    });
  }
}

/**
 * 執行原子級本地寫入並最終持久化 Token
 */
async function executeAtomicCommit(): Promise<void> {
  emitState({
    step: 'APPLYING',
    isApplying: true,
    progressPercent: 90,
    error: undefined,
  });

  const strategy = staging.strategy || 'merge';
  const staged = staging.downloaded;
  const now = new Date().toISOString();

  try {
    if (strategy === 'overwrite_remote') {
      const cachedRevs = getCachedRevs();
      const pushedTimes = getPushedTimes();
      await uploadAllLocalData(now, cachedRevs, pushedTimes);
      setCachedRevs(cachedRevs);
      setPushedTimes(pushedTimes);
    } else if (strategy === 'overwrite_local') {
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

          if (staged.baseInfos.length) await db.user_base_info.bulkPut(staged.baseInfos);
          if (staged.foods.length) {
            await db.foods.bulkPut(staged.foods);
            clearFoodsCache();
          }
          if (staged.recipes.length) await db.recipes.bulkPut(staged.recipes);
          if (staged.dailyDietLogs.length) {
            const dedupedDietMap = new Map<string, DailyDietLog>();
            for (const log of staged.dailyDietLogs) {
              const existing = dedupedDietMap.get(log.date);
              if (!existing) {
                dedupedDietMap.set(log.date, log);
              } else {
                const existingTime = getNormalizedTimestamp(existing.updatedAt);
                const logTime = getNormalizedTimestamp(log.updatedAt);
                if (logTime >= existingTime) {
                  dedupedDietMap.set(log.date, log);
                }
              }
            }
            await db.daily_diet_logs.bulkPut(Array.from(dedupedDietMap.values()));
          }
          if (staged.exercises.length) await db.exercises.bulkPut(staged.exercises);
          if (staged.equipments.length) await db.equipments.bulkPut(staged.equipments);
          if (staged.routines.length) await db.routines.bulkPut(staged.routines);
          if (staged.workoutLogs.length) await db.workout_logs.bulkPut(staged.workoutLogs);
          if (staged.bodyMetrics.length) await db.body_metrics.bulkPut(staged.bodyMetrics);
        }
      )
      );
      setCachedRevs(staged.revs);
      setLocalEntityTombstones(staged.tombstones);
    } else {
      // 合併 (merge)
      const nowTs = Date.now();
      const tombstones = staged.tombstones;
      await withAutoSyncSuppressed(() =>
        db.transaction(
        'rw',
        [
          db.user_base_info,
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
          const [
            localBaseInfos,
            localFoods,
            localRecipes,
            localDietLogs,
            localExercises,
            localEquipments,
            localRoutines,
            localWorkoutLogs,
            localMetrics,
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

          const mBase = mergeEntities(localBaseInfos, staged.baseInfos);
          const mFood = mergeEntities(localFoods, staged.foods, tombstones.foods, nowTs);
          const mRecipe = mergeEntities(localRecipes, staged.recipes, tombstones.recipes, nowTs);
          const mDiet = mergeDietLogsByDate(localDietLogs, staged.dailyDietLogs);
          const mEx = mergeEntities(localExercises, staged.exercises, tombstones.exercises, nowTs);
          const mEq = mergeEntities(localEquipments, staged.equipments, tombstones.equipments, nowTs);
          const mRoutine = mergeEntities(localRoutines, staged.routines, tombstones.routines, nowTs);
          const mWLogs = mergeWorkoutLogs(localWorkoutLogs, staged.workoutLogs, tombstones.workout_logs, nowTs);
          const mMetrics = mergeEntities(localMetrics, staged.bodyMetrics, tombstones.body_metrics, nowTs);

          if (mBase.merged.length) await db.user_base_info.bulkPut(mBase.merged);
          if (mFood.deletedIds.length) {
            await db.foods.bulkDelete(mFood.deletedIds);
            clearFoodsCache();
          }
          if (mFood.merged.length) {
            await db.foods.bulkPut(mFood.merged);
            clearFoodsCache();
          }
          if (mRecipe.deletedIds.length) {
            await db.recipes.bulkDelete(mRecipe.deletedIds);
            clearRecipesCache();
          }
          if (mRecipe.merged.length) await db.recipes.bulkPut(mRecipe.merged);
          if (mDiet.merged.length) await db.daily_diet_logs.bulkPut(mDiet.merged);
          if (mEx.deletedIds.length) {
            await db.exercises.bulkDelete(mEx.deletedIds);
            clearExercisesCache();
          }
          if (mEx.merged.length) await db.exercises.bulkPut(mEx.merged);
          if (mEq.deletedIds.length) await db.equipments.bulkDelete(mEq.deletedIds);
          if (mEq.merged.length) await db.equipments.bulkPut(mEq.merged);
          if (mRoutine.deletedIds.length) await db.routines.bulkDelete(mRoutine.deletedIds);
          if (mRoutine.merged.length) await db.routines.bulkPut(mRoutine.merged);
          if (mWLogs.deletedIds.length) await db.workout_logs.bulkDelete(mWLogs.deletedIds);
          if (mWLogs.merged.length) await db.workout_logs.bulkPut(mWLogs.merged);
          if (mMetrics.deletedIds.length) await db.body_metrics.bulkDelete(mMetrics.deletedIds);
          if (mMetrics.merged.length) await db.body_metrics.bulkPut(mMetrics.merged);
        }
      )
      );

      setLocalEntityTombstones(staged.tombstones);

      // 合併後上傳全量數據確保雲端與本機雙向一致
      const cachedRevs = { ...getCachedRevs(), ...staged.revs };
      const pushedTimes = getPushedTimes();
      await uploadAllLocalData(now, cachedRevs, pushedTimes);
      if (staged.tombstonesChangedRemote) {
        cachedRevs['/deleted_entities.json'] = await uploadJsonFile(
          '/deleted_entities.json',
          staged.tombstones,
          cachedRevs['/deleted_entities.json']
        );
        pushedTimes['deleted_entities'] = now;
      }
      setCachedRevs(cachedRevs);
      setPushedTimes(pushedTimes);
    }

    // 成功後將憑證正式提交持久化！
    commitProviderStaging();
    setLastSyncTime(now);

    // 清空預熱快取並同步最新個人基礎資料快取，確保直接導向 /app 時零競態
    clearFoodsCache();
    clearRecipesCache();
    clearExercisesCache();
    const restoredBaseInfo = (await db.user_base_info.get(PRIMARY_USER_ID)) ?? null;
    syncUserProfileCache(restoredBaseInfo);

    const [foodsCount, exercisesCount, foodLogsCount, workoutLogsCount, bodyMetricsCount] =
      await Promise.all([
        db.foods.count(),
        db.exercises.count(),
        db.daily_diet_logs.count(),
        db.workout_logs.count(),
        db.body_metrics.count(),
      ]);

    confirmRawWeightIfHasDietActivity({
      foodsCount,
      recipesCount: staged.recipes.length,
      dailyDietLogs: staged.dailyDietLogs,
    });

    emitState({
      step: 'COMPLETED',
      isApplying: false,
      progressPercent: 100,
      summary: {
        foodsCount,
        exercisesCount,
        foodLogsCount,
        workoutLogsCount,
        bodyMetricsCount,
      },
    });
  } catch (err: unknown) {
    console.error('Commit failed:', err);
    rollbackProviderStaging();
    const reason = formatSyncErrorMessage(err);
    toast.show(i18n.t('syncStatus.syncFailedToast', { reason }));
    emitState({
      isApplying: false,
      error: reason,
    });
  }
}

/**
 * 取消首次同步：抹除所有暫存 Token 與下載資料，完全回滾乾淨
 */
export function cancelInitialSync(): void {
  rollbackProviderStaging();
  staging = {
    providerId: getActiveSyncProviderId(),
    mode: 'sync',
    tokens: null,
    remoteManifest: null,
    remoteFiles: [],
    strategy: null,
    downloaded: {
      baseInfos: [],
      foods: [],
      recipes: [],
      dailyDietLogs: [],
      exercises: [],
      equipments: [],
      routines: [],
      workoutLogs: [],
      bodyMetrics: [],
      revs: {},
      tombstones: {},
      tombstonesChangedRemote: false,
    },
  };

  emitState({
    isOpen: false,
    step: 'AUTH',
    progressPercent: 0,
    downloadedFilesCount: 0,
    totalFilesCount: 0,
    localBaseInfo: null,
    remoteBaseInfo: null,
    error: undefined,
    isApplying: false,
    summary: undefined,
    connectingProvider: null,
    sourcePicker: null,
    blocked: null,
    backupConnectedProvider: null,
  });
}

/**
 * 關閉已完成的首次同步彈窗
 */
export function closeInitialSyncModal(): void {
  emitState({
    isOpen: false,
    step: 'AUTH',
    progressPercent: 0,
    localBaseInfo: null,
    remoteBaseInfo: null,
    error: undefined,
    isApplying: false,
    summary: undefined,
    connectingProvider: null,
    sourcePicker: null,
    blocked: null,
    backupConnectedProvider: null,
  });
}

/**
 * 開啟雲端 OAuth 返回過渡視圖（正在連接 xxx…）
 */
export function openCloudFlowConnecting(providerId: SyncProviderId): void {
  emitState({
    isOpen: true,
    step: 'CONNECTING',
    error: undefined,
    isApplying: false,
    connectingProvider: providerId,
    sourcePicker: null,
    blocked: null,
  });
}

/**
 * 開啟落地頁雲端導入來源選擇視圖
 */
export function openCloudFlowSourcePicker(payload: CloudFlowSourcePickerPayload): void {
  emitState({
    isOpen: true,
    step: 'SOURCE_PICKER',
    error: undefined,
    isApplying: false,
    connectingProvider: null,
    sourcePicker: payload,
    blocked: null,
    backupConnectedProvider: null,
  });
}

/**
 * 開啟雲端阻斷說明視圖（同帳戶衝突或無可還原資料）
 */
export function openCloudFlowBlocked(payload: CloudFlowBlockedPayload): void {
  emitState({
    isOpen: true,
    step: 'BLOCKED',
    error: undefined,
    isApplying: false,
    connectingProvider: null,
    sourcePicker: null,
    blocked: payload,
    backupConnectedProvider: null,
  });
}

/**
 * 開啟每日滾動備份連線完成視圖
 */
export function openCloudFlowBackupConnected(providerId: SyncProviderId): void {
  emitState({
    isOpen: true,
    step: 'BACKUP_CONNECTED',
    error: undefined,
    isApplying: false,
    connectingProvider: null,
    sourcePicker: null,
    blocked: null,
    backupConnectedProvider: providerId,
  });
}

/**
 * 關閉前置／阻斷雲端流程彈窗（不影響已完成同步或還原）
 */
export function closeCloudFlow(): void {
  emitState({
    isOpen: false,
    step: 'AUTH',
    error: undefined,
    isApplying: false,
    connectingProvider: null,
    sourcePicker: null,
    blocked: null,
    backupConnectedProvider: null,
  });
}
