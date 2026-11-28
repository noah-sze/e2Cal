import {
  safeLocalStorage,
  withSyncBasePath,
  APP_SYNC_FOLDER,
  type SyncChannelScope,
  type SyncProviderId,
  type SyncStorageAdapter,
} from './syncAdapter';
import { dropboxAdapter, backupDropboxAdapter } from './adapters/dropboxAdapter';
import {
  webdavAdapter,
  backupWebdavAdapter,
  getWebDavConfig,
  type WebDavConfig,
} from './adapters/webdavAdapter';
import {
  s3Adapter,
  backupS3Adapter,
  getS3Config,
  type S3Config,
} from './adapters/s3Adapter';
import { getStoredTokens } from './dropboxAuth';

const ACTIVE_PROVIDER_KEY = 'e2cal_sync_provider';
const BACKUP_PROVIDER_KEY = 'e2cal_backup_provider';
export const SYNC_CONNECTION_CHANGED_EVENT = 'e2cal-sync-connection-changed';

let stagingSyncProviderId: SyncProviderId | null = null;

export function notifySyncConnectionChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_CONNECTION_CHANGED_EVENT));
  }
}

export function setStagingSyncProviderId(providerId: SyncProviderId | null): void {
  stagingSyncProviderId = providerId;
}

export function getWorkingSyncProviderId(): SyncProviderId {
  return stagingSyncProviderId ?? getActiveSyncProviderId();
}

const rawAdapterRegistry = new Map<SyncProviderId, SyncStorageAdapter>([
  ['dropbox', dropboxAdapter],
  ['webdav', webdavAdapter],
  ['s3', s3Adapter],
]);

const adapterRegistry = new Map<SyncProviderId, SyncStorageAdapter>([
  ['dropbox', withSyncBasePath(dropboxAdapter, APP_SYNC_FOLDER)],
  ['webdav', withSyncBasePath(webdavAdapter, APP_SYNC_FOLDER)],
  ['s3', withSyncBasePath(s3Adapter, APP_SYNC_FOLDER)],
]);

const backupAdapterRegistry = new Map<SyncProviderId, SyncStorageAdapter>([
  ['dropbox', backupDropboxAdapter],
  ['webdav', backupWebdavAdapter],
  ['s3', backupS3Adapter],
]);

/**
 * 註冊雲端同步端點適配器（主同步自動套用 /app 路徑前綴隔離）
 */
export function registerSyncAdapter(adapter: SyncStorageAdapter): void {
  rawAdapterRegistry.set(adapter.providerId, adapter);
  adapterRegistry.set(adapter.providerId, withSyncBasePath(adapter, APP_SYNC_FOLDER));
}

/**
 * 取得目前啟用的雲端同步渠道 ID
 * 向下相容：若未明確設定過渠道但已有舊版 Dropbox Token，預設視為 'dropbox'
 */
export function getActiveSyncProviderId(): SyncProviderId {
  const stored = safeLocalStorage.getItem(ACTIVE_PROVIDER_KEY) as SyncProviderId | null;
  if (stored && adapterRegistry.has(stored)) {
    return stored;
  }
  return 'dropbox';
}

/**
 * 切換目前啟用的主同步渠道
 */
export function setActiveSyncProviderId(providerId: SyncProviderId): void {
  safeLocalStorage.setItem(ACTIVE_PROVIDER_KEY, providerId);
}

/**
 * 依渠道 ID 取得對應適配器（已套用 /app 路徑前綴）
 */
export function getSyncAdapter(providerId: SyncProviderId): SyncStorageAdapter {
  return adapterRegistry.get(providerId) ?? adapterRegistry.get('dropbox')!;
}

/**
 * 依渠道 ID 取得未套用 /app 前綴的原始適配器（供根目錄來源檢測同時檢查 /app 與 /backup）
 */
export function getRawSyncAdapter(providerId: SyncProviderId): SyncStorageAdapter {
  return rawAdapterRegistry.get(providerId) ?? dropboxAdapter;
}

/**
 * 取得目前啟用中的同步適配器（僅認已正式提交持久化之渠道）
 */
export function getActiveSyncAdapter(): SyncStorageAdapter {
  return getSyncAdapter(getActiveSyncProviderId());
}

/**
 * 取得目前同步流程正在使用的適配器（若處於未提交的 Staging 階段則回傳暫存渠道）
 */
export function getWorkingSyncAdapter(): SyncStorageAdapter {
  return getSyncAdapter(getWorkingSyncProviderId());
}

/**
 * 檢查目前啟用渠道是否已連線
 */
export function isCloudSyncConnected(): boolean {
  return getActiveSyncAdapter().isConnected();
}

/**
 * 依渠道隔離本地同步狀態鍵名（Dropbox 維持原鍵名以 100% 向下相容既有使用者）
 */
export function getProviderScopedStorageKey(
  baseKey: string,
  providerId: SyncProviderId = getWorkingSyncProviderId()
): string {
  return providerId === 'dropbox' ? baseKey : `${baseKey}_${providerId}`;
}

/**
 * 取得每日滾動備份通道目前選用的雲端渠道 ID（與主同步完全獨立）
 */
export function getBackupProviderId(): SyncProviderId | null {
  const stored = safeLocalStorage.getItem(BACKUP_PROVIDER_KEY) as SyncProviderId | null;
  if (stored && backupAdapterRegistry.has(stored)) {
    return stored;
  }
  return null;
}

/**
 * 設定每日滾動備份通道選用的雲端渠道 ID（傳入 null 表示清除）
 */
export function setBackupProviderId(providerId: SyncProviderId | null): void {
  if (!providerId) {
    safeLocalStorage.removeItem(BACKUP_PROVIDER_KEY);
    return;
  }
  safeLocalStorage.setItem(BACKUP_PROVIDER_KEY, providerId);
}

/**
 * 依渠道 ID 取得每日滾動備份專屬適配器
 */
export function getBackupAdapter(
  providerId: SyncProviderId | null = getBackupProviderId()
): SyncStorageAdapter | null {
  if (!providerId) return null;
  return backupAdapterRegistry.get(providerId) ?? null;
}

/**
 * 檢查每日滾動備份通道是否已獨立連線
 */
export function isRollingBackupConnected(): boolean {
  const adapter = getBackupAdapter();
  return Boolean(adapter?.isConnected());
}

export interface SyncTargetDetail {
  field: 'account' | 'serverUrl' | 'bucket' | 'endpoint';
  value: string;
}

/**
 * 取得指定渠道與用途的結構化目標資訊（Dropbox 帳戶、WebDAV 伺服器地址、S3 Bucket 與 Endpoint）
 */
export function getSyncTargetDetails(
  providerId: SyncProviderId | null,
  scope: SyncChannelScope = 'primary'
): SyncTargetDetail[] {
  if (!providerId) return [];
  if (providerId === 'dropbox') {
    const tokens = getStoredTokens(scope);
    const account =
      tokens?.email ||
      tokens?.display_name ||
      (tokens?.account_id ? tokens.account_id : '-');
    return [{ field: 'account', value: account }];
  }
  if (providerId === 'webdav') {
    const cfg = getWebDavConfig(scope);
    return [{ field: 'serverUrl', value: cfg?.baseUrl || '-' }];
  }
  const cfg = getS3Config(scope);
  if (!cfg) {
    return [
      { field: 'bucket', value: '-' },
      { field: 'endpoint', value: '-' },
    ];
  }
  return [
    { field: 'bucket', value: cfg.bucket },
    {
      field: 'endpoint',
      value: cfg.endpoint || `https://s3.${cfg.region}.amazonaws.com`,
    },
  ];
}

/**
 * 取得指定渠道與用途的客觀端點識別摘要（供診斷與簡略識別使用）
 */
export function getSyncEndpointSummary(
  providerId: SyncProviderId | null,
  scope: SyncChannelScope = 'primary'
): string {
  if (!providerId) return '-';
  if (providerId === 'webdav') {
    const cfg = getWebDavConfig(scope);
    if (!cfg?.baseUrl) return '-';
    try {
      const u = new URL(cfg.baseUrl);
      const path = u.pathname === '/' ? '' : u.pathname;
      return `${u.host}${path}`;
    } catch {
      return cfg.baseUrl;
    }
  }
  if (providerId === 's3') {
    const cfg = getS3Config(scope);
    if (!cfg) return '-';
    const prefix = cfg.prefix ? `/${cfg.prefix.replace(/^\/+|\/+$/g, '')}` : '';
    return `${cfg.bucket}${prefix}`;
  }
  const tokens = getStoredTokens(scope);
  if (tokens?.email) return tokens.email;
  if (tokens?.display_name) return tokens.display_name;
  if (tokens?.account_id) {
    return `App Folder · ${tokens.account_id.slice(-6)}`;
  }
  return 'App Folder';
}

function getOppositeScope(scope: SyncChannelScope): SyncChannelScope {
  return scope === 'primary' ? 'backup' : 'primary';
}

function isOppositeProviderActive(
  providerId: SyncProviderId,
  targetScope: SyncChannelScope
): boolean {
  const oppositeScope = getOppositeScope(targetScope);
  if (oppositeScope === 'primary') {
    return isCloudSyncConnected() && getActiveSyncProviderId() === providerId;
  }
  return isRollingBackupConnected() && getBackupProviderId() === providerId;
}

function extractWebDavOrigin(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  try {
    return new URL(trimmed).origin.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

/**
 * 判斷兩個 WebDAV 設定是否屬於同一帳戶主體（同一主機位址 + 同一帳號）
 */
export function isSameWebDavAccount(a: WebDavConfig, b: WebDavConfig): boolean {
  if (!a.baseUrl.trim() || !b.baseUrl.trim()) return false;
  return (
    extractWebDavOrigin(a.baseUrl) === extractWebDavOrigin(b.baseUrl) &&
    a.username.trim().toLowerCase() === b.username.trim().toLowerCase()
  );
}

/**
 * 判斷兩個 S3 設定是否屬於同一帳戶主體（同一 Endpoint + 同一 Access Key ID）
 */
export function isSameS3Account(a: S3Config, b: S3Config): boolean {
  const keyA = a.accessKeyId.trim();
  const keyB = b.accessKeyId.trim();
  if (!keyA || !keyB) return false;
  const epA = (a.endpoint || '').trim().replace(/\/+$/, '').toLowerCase();
  const epB = (b.endpoint || '').trim().replace(/\/+$/, '').toLowerCase();
  return epA === epB && keyA === keyB;
}

/**
 * 判斷兩個 Dropbox account_id 是否屬於同一帳號
 */
export function isSameDropboxAccount(
  accountIdA?: string | null,
  accountIdB?: string | null
): boolean {
  const a = accountIdA?.trim();
  const b = accountIdB?.trim();
  return Boolean(a && b && a === b);
}

/**
 * 檢查對側通道是否正連線同類型服務（供第二屏設置頁顯示提醒）
 */
export function hasOppositeProviderConnected(
  providerId: SyncProviderId,
  targetScope: SyncChannelScope
): boolean {
  return isOppositeProviderActive(providerId, targetScope);
}

/**
 * 檢查 WebDAV 設定是否與對側已連線通道使用同一帳戶
 */
export function checkWebDavAccountConflict(
  config: WebDavConfig,
  targetScope: SyncChannelScope
): boolean {
  if (!isOppositeProviderActive('webdav', targetScope)) return false;
  const oppositeConfig = getWebDavConfig(getOppositeScope(targetScope));
  if (!oppositeConfig) return false;
  return isSameWebDavAccount(config, oppositeConfig);
}

/**
 * 檢查 S3 設定是否與對側已連線通道使用同一帳戶
 */
export function checkS3AccountConflict(
  config: S3Config,
  targetScope: SyncChannelScope
): boolean {
  if (!isOppositeProviderActive('s3', targetScope)) return false;
  const oppositeConfig = getS3Config(getOppositeScope(targetScope));
  if (!oppositeConfig) return false;
  return isSameS3Account(config, oppositeConfig);
}

/**
 * 檢查 Dropbox 帳號是否與對側已連線通道使用同一帳戶
 */
export function checkDropboxAccountConflict(
  accountId: string | undefined | null,
  targetScope: SyncChannelScope
): boolean {
  if (!isOppositeProviderActive('dropbox', targetScope)) return false;
  const oppositeTokens = getStoredTokens(getOppositeScope(targetScope));
  return isSameDropboxAccount(accountId, oppositeTokens?.account_id);
}
