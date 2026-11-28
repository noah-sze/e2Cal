import { format } from 'date-fns';
import { exportBackupZip } from '@/services/backup/exportBackupZip';
import {
  safeLocalStorage,
  APP_SYNC_FOLDER,
  type RemoteFileMetadata,
  type SyncProviderId,
  type SyncStorageAdapter,
} from './syncAdapter';
import {
  getBackupAdapter,
  getBackupProviderId,
  getProviderScopedStorageKey,
  isRollingBackupConnected,
} from './syncRouter';

export interface RollingBackupItem {
  name: string;
  path: string;
  date: string;
  size: number;
  serverModified: string;
}

export interface RollingBackupResult {
  uploaded: boolean;
  fileName?: string;
  path?: string;
  deletedCount: number;
  skippedReason?: 'not_connected' | 'not_supported' | 'not_due' | 'already_running';
}

export const BACKUP_FOLDER = '/backup';
export const MAX_ROLLING_BACKUPS = 3;
export const BACKUP_FILENAME_REGEX = /^e2cal-backup-(\d{4}-\d{2}-\d{2})\.zip$/i;

const LAST_BACKUP_ZIP_TIME_KEY = 'e2cal_last_backup_zip_time';
const LAST_BACKUP_ZIP_DATE_KEY = 'e2cal_last_backup_zip_date';
const BACKUP_DIRTY_FLAG_KEY = 'e2cal_backup_dirty_flag';

let activeBackupPromise: Promise<RollingBackupResult> | null = null;

function resolveBackupProvider(providerId?: SyncProviderId): SyncProviderId {
  return providerId ?? getBackupProviderId() ?? 'dropbox';
}

/**
 * 標記本機資料庫自上次滾動 ZIP 備份後已有異動
 */
export function markBackupDirty(providerId?: SyncProviderId): void {
  const key = getProviderScopedStorageKey(BACKUP_DIRTY_FLAG_KEY, resolveBackupProvider(providerId));
  safeLocalStorage.setItem(key, '1');
}

/**
 * 清除滾動 ZIP 備份異動標記
 */
export function clearBackupDirtyFlag(providerId?: SyncProviderId): void {
  const key = getProviderScopedStorageKey(BACKUP_DIRTY_FLAG_KEY, resolveBackupProvider(providerId));
  safeLocalStorage.removeItem(key);
}

/**
 * 查詢是否待執行滾動 ZIP 備份
 */
export function hasBackupDirtyFlag(providerId?: SyncProviderId): boolean {
  const key = getProviderScopedStorageKey(BACKUP_DIRTY_FLAG_KEY, resolveBackupProvider(providerId));
  return safeLocalStorage.getItem(key) === '1';
}

/**
 * 取得最後一次成功上傳滾動 ZIP 備份的 ISO 時間戳
 */
export function getLastBackupZipTime(providerId?: SyncProviderId): string | null {
  const key = getProviderScopedStorageKey(
    LAST_BACKUP_ZIP_TIME_KEY,
    resolveBackupProvider(providerId)
  );
  return safeLocalStorage.getItem(key);
}

/**
 * 取得最後一次成功上傳滾動 ZIP 備份的本地日期鍵 (YYYY-MM-DD)
 */
export function getLastBackupZipDateKey(providerId?: SyncProviderId): string | null {
  const key = getProviderScopedStorageKey(
    LAST_BACKUP_ZIP_DATE_KEY,
    resolveBackupProvider(providerId)
  );
  return safeLocalStorage.getItem(key);
}

/**
 * 清除指定備份渠道的追蹤時間戳與異動標記（中斷備份連線時呼叫，防止跨帳號殘留）
 */
export function clearBackupTrackingState(providerId?: SyncProviderId): void {
  const resolved = resolveBackupProvider(providerId);
  safeLocalStorage.removeItem(getProviderScopedStorageKey(LAST_BACKUP_ZIP_TIME_KEY, resolved));
  safeLocalStorage.removeItem(getProviderScopedStorageKey(LAST_BACKUP_ZIP_DATE_KEY, resolved));
  safeLocalStorage.removeItem(getProviderScopedStorageKey(BACKUP_DIRTY_FLAG_KEY, resolved));
}

function getTodayDateKey(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd');
}

/**
 * 判斷今日是否需要自動執行滾動 ZIP 備份：
 * 僅在今日尚未完成備份且（本機已有異動標記或從未備份過）時回傳 true
 */
export function isRollingBackupDueToday(
  now: Date = new Date(),
  providerId?: SyncProviderId
): boolean {
  const resolved = resolveBackupProvider(providerId);
  const todayKey = getTodayDateKey(now);
  const lastDate = getLastBackupZipDateKey(resolved);
  if (lastDate === todayKey) {
    return false;
  }
  return hasBackupDirtyFlag(resolved) || lastDate === null;
}

/**
 * 從遠端中繼資料中篩選並依日期由新到舊排序滾動 ZIP 備份清單
 */
export function parseRollingBackupItems(
  files: RemoteFileMetadata[]
): RollingBackupItem[] {
  const items: RollingBackupItem[] = [];
  for (const file of files) {
    const match = BACKUP_FILENAME_REGEX.exec(file.name);
    if (!match) continue;
    const path = file.path_display || file.path_lower || `${BACKUP_FOLDER}/${file.name}`;
    items.push({
      name: file.name,
      path,
      date: match[1],
      size: file.size || 0,
      serverModified: file.server_modified || file.client_modified || '',
    });
  }

  return items.sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    return b.serverModified.localeCompare(a.serverModified);
  });
}

/**
 * 執行滾動每日 ZIP 備份：
 * 1. 打包全量本地 ZIP 並先上傳至 /Backup/e2cal-backup-YYYY-MM-DD.zip
 * 2. 上傳成功後，列出 /Backup 內所有 e2cal-backup-*.zip 並刪除超過 3 份的最舊檔案
 */
export async function runRollingBackup(options?: {
  force?: boolean;
  now?: Date;
}): Promise<RollingBackupResult> {
  const adapter = getBackupAdapter();
  const providerId = getBackupProviderId();
  if (!adapter || !providerId || !isRollingBackupConnected()) {
    return { uploaded: false, deletedCount: 0, skippedReason: 'not_connected' };
  }

  if (!adapter.uploadBinaryFile) {
    return { uploaded: false, deletedCount: 0, skippedReason: 'not_supported' };
  }

  const now = options?.now ?? new Date();
  if (!options?.force && !isRollingBackupDueToday(now, providerId)) {
    return { uploaded: false, deletedCount: 0, skippedReason: 'not_due' };
  }

  if (activeBackupPromise) {
    return activeBackupPromise;
  }

  activeBackupPromise = (async (): Promise<RollingBackupResult> => {
    const dateKey = getTodayDateKey(now);
    const fileName = `e2cal-backup-${dateKey}.zip`;
    const targetPath = `${BACKUP_FOLDER}/${fileName}`;

    const blob = await exportBackupZip();
    await adapter.uploadBinaryFile!(targetPath, blob);

    const completedAt = new Date().toISOString();
    safeLocalStorage.setItem(
      getProviderScopedStorageKey(LAST_BACKUP_ZIP_TIME_KEY, providerId),
      completedAt
    );
    safeLocalStorage.setItem(
      getProviderScopedStorageKey(LAST_BACKUP_ZIP_DATE_KEY, providerId),
      dateKey
    );
    clearBackupDirtyFlag(providerId);

    // 上傳成功後才清理超過 MAX_ROLLING_BACKUPS (3) 的最舊備份
    let deletedCount = 0;
    try {
      const remoteFiles = await adapter.listRemoteFolder(BACKUP_FOLDER);
      const sortedBackups = parseRollingBackupItems(remoteFiles);
      const excessBackups = sortedBackups.slice(MAX_ROLLING_BACKUPS);

      for (const oldItem of excessBackups) {
        try {
          await adapter.deleteRemotePath(oldItem.path);
          deletedCount += 1;
        } catch (err) {
          console.warn(`[rollingBackup] 刪除舊備份失敗 (${oldItem.path}):`, err);
        }
      }
    } catch (err) {
      console.warn('[rollingBackup] 清理舊備份清單失敗:', err);
    }

    return {
      uploaded: true,
      fileName,
      path: targetPath,
      deletedCount,
    };
  })();

  try {
    return await activeBackupPromise;
  } finally {
    activeBackupPromise = null;
  }
}

/**
 * 列出遠端 /Backup 目錄內的滾動每日 ZIP 備份（依新到舊排序）
 */
export async function listRollingBackups(): Promise<RollingBackupItem[]> {
  const adapter = getBackupAdapter();
  if (!adapter || !isRollingBackupConnected()) return [];
  const files = await adapter.listRemoteFolder(BACKUP_FOLDER);
  return parseRollingBackupItems(files);
}

/**
 * 下載指定遠端滾動備份 ZIP 檔案
 */
export async function downloadRollingBackupBlob(filePath: string): Promise<Blob> {
  const adapter = getBackupAdapter();
  if (!adapter || !adapter.downloadBinaryFile) {
    throw new Error('BACKUP_PROVIDER_NOT_CONNECTED');
  }
  const blob = await adapter.downloadBinaryFile(filePath);
  if (!blob) {
    throw new Error(`ROLLING_BACKUP_NOT_FOUND:${filePath}`);
  }
  return blob;
}

export interface CloudImportSources {
  hasPrimarySync: boolean;
  hasRollingBackup: boolean;
  backupItems: RollingBackupItem[];
}

const PRIMARY_SYNC_PREFIXES = [
  `${APP_SYNC_FOLDER}/user/`,
  `${APP_SYNC_FOLDER}/nutrition/`,
  `${APP_SYNC_FOLDER}/workout/`,
  `${APP_SYNC_FOLDER}/body/`,
] as const;

/**
 * 檢測指定雲端適配器目前包含的資料類型（/app 主同步 JSON / /backup 每日滾動 ZIP 備份）
 */
export async function inspectCloudImportSources(
  adapter: SyncStorageAdapter
): Promise<CloudImportSources> {
  const [appFiles, backupFiles] = await Promise.all([
    adapter.listRemoteFolder(APP_SYNC_FOLDER).catch(() => [] as RemoteFileMetadata[]),
    adapter.listRemoteFolder(BACKUP_FOLDER).catch(() => [] as RemoteFileMetadata[]),
  ]);

  const hasPrimarySync = appFiles.some(
    (f) =>
      f.path_lower === `${APP_SYNC_FOLDER}/manifest.json` ||
      PRIMARY_SYNC_PREFIXES.some((prefix) => f.path_lower.startsWith(prefix))
  );

  const backupMap = new Map<string, RemoteFileMetadata>();
  for (const f of backupFiles) {
    if (f.path_lower.startsWith(`${BACKUP_FOLDER}/`) || BACKUP_FILENAME_REGEX.test(f.name)) {
      backupMap.set(f.path_lower, f);
    }
  }
  const backupItems = parseRollingBackupItems(Array.from(backupMap.values())).slice(
    0,
    MAX_ROLLING_BACKUPS
  );

  return {
    hasPrimarySync,
    hasRollingBackup: backupItems.length > 0,
    backupItems,
  };
}
