import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  initiateDropboxAuth,
  exchangeCodeForTokensOnly,
  getStoredTokens,
  setStoredTokens,
  getDropboxAppKey,
  consumePendingDropboxOAuthCallback,
  type DropboxOAuthMode,
} from '@/services/sync/dropboxAuth';
import {
  setStagingWebDavConfig,
  clearStagingWebDavConfig,
  commitStagingWebDavConfig,
  webdavAdapter,
  backupWebdavAdapter,
  type WebDavConfig,
} from '@/services/sync/adapters/webdavAdapter';
import {
  setStagingS3Config,
  clearStagingS3Config,
  commitStagingS3Config,
  s3Adapter,
  backupS3Adapter,
  type S3Config,
} from '@/services/sync/adapters/s3Adapter';
import {
  getActiveSyncAdapter,
  getActiveSyncProviderId,
  setActiveSyncProviderId,
  isCloudSyncConnected,
  getBackupAdapter,
  getBackupProviderId,
  setBackupProviderId,
  isRollingBackupConnected,
  checkWebDavAccountConflict,
  checkS3AccountConflict,
  checkDropboxAccountConflict,
  SYNC_CONNECTION_CHANGED_EVENT,
} from '@/services/sync/syncRouter';
import type { SyncProviderId } from '@/services/sync/syncAdapter';
import {
  executeSync,
  scheduleAutoSync,
  flushAutoSync,
  markPendingAutoSync,
  hasPendingAutoSync,
  onSyncEngineStatusChange,
  getSyncEngineStatus,
  updateSyncEngineStatus,
  formatSyncErrorMessage,
  type SyncEngineStatus,
  type SyncResult,
} from '@/services/sync/syncEngine';
import { onDatabaseMutated } from '@/services/db/db';
import { toast } from '@/components/ui/toast';
import {
  startInitialSync,
  openCloudFlowConnecting,
  openCloudFlowBlocked,
  openCloudFlowBackupConnected,
  closeCloudFlow,
} from '@/services/sync/initialSyncManager';

import { getSyncErrorReasonKey } from '@/services/sync/dropboxClient';
import {
  useNetworkStatus,
  isDeviceOffline,
  reportNetworkSuccess,
  reportNetworkError,
} from '@/hooks/useNetworkStatus';
import {
  markBackupDirty,
  clearBackupTrackingState,
  getLastBackupZipTime,
  isRollingBackupDueToday,
  runRollingBackup,
  type RollingBackupResult,
} from '@/services/sync/rollingBackupService';

// 模組級單例守衛：確保應用冷啟動同步與全域監聽器只註冊一次，多元件掛載不重複註冊
let hasInitialMountSyncExecuted = false;
let activeSyncHookCount = 0;

// 視窗聚焦與分頁可見性切回：全域 30 秒冷卻防護時間戳與離開標記
const FOCUS_COOLDOWN_MS = 30 * 1000;
let lastGlobalFocusCheckTime = Date.now();
let hasBlurredOrHidden = false;

// 滾動 ZIP 備份模組級單例狀態與 8 秒防抖排程
let rollingBackupTimer: ReturnType<typeof setTimeout> | null = null;
let globalIsBackingUpZip = false;
const rollingBackupListeners = new Set<() => void>();

function notifyRollingBackupListeners(): void {
  rollingBackupListeners.forEach((listener) => listener());
}

function scheduleRollingBackup(delayMs = 8000): void {
  if (!isRollingBackupConnected() || isDeviceOffline()) return;
  if (!isRollingBackupDueToday()) return;

  if (rollingBackupTimer) {
    clearTimeout(rollingBackupTimer);
  }
  rollingBackupTimer = setTimeout(() => {
    rollingBackupTimer = null;
    if (!isRollingBackupConnected() || isDeviceOffline()) return;
    if (!isRollingBackupDueToday()) return;

    globalIsBackingUpZip = true;
    notifyRollingBackupListeners();
    runRollingBackup({ force: false })
      .catch((err) => {
        console.warn('[useDropboxSync] 背景滾動 ZIP 備份失敗:', err);
      })
      .finally(() => {
        globalIsBackingUpZip = false;
        notifyRollingBackupListeners();
      });
  }, delayMs);
}

export function useDropboxSync() {
  const { t } = useTranslation();
  const [activeProviderId, setActiveProvider] = useState<SyncProviderId>(getActiveSyncProviderId());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(isCloudSyncConnected());
  const [syncState, setSyncState] = useState<SyncEngineStatus>(getSyncEngineStatus);
  const [backupProviderId, setBackupProviderState] = useState<SyncProviderId | null>(
    getBackupProviderId()
  );
  const [isBackupConnected, setIsBackupConnected] = useState<boolean>(isRollingBackupConnected());
  const [isBackingUpZip, setIsBackingUpZip] = useState<boolean>(globalIsBackingUpZip);
  const [lastBackupZipTime, setLastBackupZipTime] = useState<string | null>(() =>
    getLastBackupZipTime()
  );
  const isOnline = useNetworkStatus();
  const prevIsOnlineRef = useRef(isOnline);

  useEffect(() => {
    return onSyncEngineStatusChange(setSyncState);
  }, []);

  useEffect(() => {
    const syncRollingState = () => {
      setBackupProviderState(getBackupProviderId());
      setIsBackupConnected(isRollingBackupConnected());
      setIsBackingUpZip(globalIsBackingUpZip);
      setLastBackupZipTime(getLastBackupZipTime());
    };
    rollingBackupListeners.add(syncRollingState);
    return () => {
      rollingBackupListeners.delete(syncRollingState);
    };
  }, []);

  // 訂閱本機 IndexedDB 資料寫入：主同步 2 秒防抖、獨立滾動 ZIP 備份 8 秒防抖（每日最多一次）
  useEffect(() => {
    activeSyncHookCount += 1;
    const isPrimaryInstance = activeSyncHookCount === 1;
    let unsubscribeDb: (() => void) | undefined;

    if (isPrimaryInstance) {
      unsubscribeDb = onDatabaseMutated(() => {
        if (isCloudSyncConnected()) {
          if (isDeviceOffline() || !isOnline) {
            markPendingAutoSync();
          } else {
            scheduleAutoSync(2000);
          }
        }

        if (isRollingBackupConnected()) {
          markBackupDirty();
          if (!isDeviceOffline() && isOnline) {
            scheduleRollingBackup(8000);
          }
        }
      });
    }

    return () => {
      unsubscribeDb?.();
      activeSyncHookCount = Math.max(0, activeSyncHookCount - 1);
    };
  }, [isOnline]);

  // 應用啟動與切回視窗時主動檢查遠端是否有更新；切至背景或關閉前立即沖刷待同步變更
  useEffect(() => {
    // 1. 全應用冷啟動同步：僅首次加載且設備在線時執行一次
    if (!hasInitialMountSyncExecuted) {
      if (!isDeviceOffline() && isOnline) {
        hasInitialMountSyncExecuted = true;
        if (isCloudSyncConnected()) {
          scheduleAutoSync(hasPendingAutoSync() ? 500 : 1500);
        }
        if (isRollingBackupConnected()) {
          scheduleRollingBackup(3000);
        }
      }
    }

    // 2. 視窗失焦與分頁隱藏記錄（若有待上傳的防抖同步則立即沖刷）
    const handleBlur = () => {
      hasBlurredOrHidden = true;
    };

    const checkAndTriggerFocusSync = () => {
      const now = Date.now();
      const pending = hasPendingAutoSync();
      if (
        (pending || (hasBlurredOrHidden && now - lastGlobalFocusCheckTime > FOCUS_COOLDOWN_MS)) &&
        isCloudSyncConnected() &&
        isOnline &&
        !isDeviceOffline()
      ) {
        lastGlobalFocusCheckTime = now;
        hasBlurredOrHidden = false;
        scheduleAutoSync(pending ? 500 : 1000);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hasBlurredOrHidden = true;
        flushAutoSync();
      } else if (document.visibilityState === 'visible') {
        checkAndTriggerFocusSync();
      }
    };

    const handlePageHide = () => {
      flushAutoSync();
    };

    const handleFocus = () => {
      checkAndTriggerFocusSync();
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isOnline]);

  // 網路恢復時自動補發同步與滾動備份
  useEffect(() => {
    if (!prevIsOnlineRef.current && isOnline) {
      if (!isDeviceOffline()) {
        hasInitialMountSyncExecuted = true;
        if (isCloudSyncConnected()) {
          scheduleAutoSync(1000);
        }
        if (isRollingBackupConnected()) {
          scheduleRollingBackup(3000);
        }
      }
    }
    prevIsOnlineRef.current = isOnline;
  }, [isOnline]);

  // 消費應用啟動第 0 幀捕獲的 OAuth 回調結果（支援主同步與獨立備份通道）
  useEffect(() => {
    const callback = consumePendingDropboxOAuthCallback();
    if (!callback) return;

    if (callback.kind === 'error') {
      if (callback.error === 'access_denied') {
        toast.show(t('initialSync.cancelToast', '已取消同步'));
      } else {
        const reason = formatSyncErrorMessage(callback.errorDescription || callback.error, t);
        toast.show(t('syncStatus.authFailedToast', { reason }));
      }
      return;
    }

    // 先換取 Token 並於啟動 InitialSyncModal 前完成同帳戶檢測
    openCloudFlowConnecting('dropbox');
    exchangeCodeForTokensOnly(callback.code)
      .then((tokens) => {
        if (checkDropboxAccountConflict(tokens.account_id, callback.scope)) {
          const oppositeTokens = getStoredTokens(
            callback.scope === 'backup' ? 'primary' : 'backup'
          );
          openCloudFlowBlocked({
            providerId: 'dropbox',
            reason: 'account_conflict',
            targetScope: callback.scope,
            accountLabel:
              tokens.email ||
              oppositeTokens?.email ||
              tokens.display_name ||
              oppositeTokens?.display_name ||
              tokens.account_id ||
              '-',
          });
          return;
        }

        if (callback.scope === 'backup') {
          setStoredTokens(tokens, 'backup');
          setBackupProviderId('dropbox');
          notifyRollingBackupListeners();
          openCloudFlowBackupConnected('dropbox');
          return;
        }

        // 通過帳戶檢測後，才啟動事務性首次同步狀態機（傳入已換取之 Token 避免重複交換一次性 code）
        return startInitialSync(callback.code, {
          mode: callback.mode,
          providerId: 'dropbox',
          preloadedTokens: tokens,
        });
      })
      .catch((err) => {
        closeCloudFlow();
        console.error('Failed to process Dropbox OAuth callback:', err);
        const reason = formatSyncErrorMessage(err, t);
        toast.show(t('syncStatus.authFailedToast', { reason }));
      });
  }, [t]);

  // 同步連線狀態變化
  useEffect(() => {
    const syncAuth = () => {
      setActiveProvider(getActiveSyncProviderId());
      setIsAuthenticated(isCloudSyncConnected());
      notifyRollingBackupListeners();
    };
    window.addEventListener('storage', syncAuth);
    window.addEventListener(SYNC_CONNECTION_CHANGED_EVENT, syncAuth);
    return () => {
      window.removeEventListener('storage', syncAuth);
      window.removeEventListener(SYNC_CONNECTION_CHANGED_EVENT, syncAuth);
    };
  }, []);

  // 手動立即執行滾動每日 ZIP 備份
  const backupNow = useCallback(async (): Promise<RollingBackupResult> => {
    if (globalIsBackingUpZip) {
      return { uploaded: false, deletedCount: 0, skippedReason: 'already_running' };
    }
    if (isDeviceOffline() || !isOnline) {
      toast.show(t('syncStatus.offlineToast'));
      return { uploaded: false, deletedCount: 0 };
    }
    globalIsBackingUpZip = true;
    notifyRollingBackupListeners();
    try {
      const result = await runRollingBackup({ force: true });
      if (result.uploaded) {
        reportNetworkSuccess();
        toast.show(t('syncStatus.backupZipSuccessToast'));
      }
      return result;
    } catch (err: unknown) {
      if (getSyncErrorReasonKey(err) === 'network') {
        reportNetworkError();
      }
      const reason = formatSyncErrorMessage(err, t);
      toast.show(t('syncStatus.backupZipFailedToast', { reason }));
      return { uploaded: false, deletedCount: 0 };
    } finally {
      globalIsBackingUpZip = false;
      notifyRollingBackupListeners();
    }
  }, [isOnline, t]);

  // 發起主同步 Dropbox 連線
  const connectDropbox = useCallback(async (mode: DropboxOAuthMode = 'sync') => {
    const appKey = getDropboxAppKey();
    if (!appKey) {
      toast.show(t('settings.missingAppKey', '未配置 Dropbox App Key'));
      return;
    }

    try {
      await initiateDropboxAuth(mode, 'primary');
    } catch (err: unknown) {
      console.error('Failed to initiate Dropbox auth:', err);
      const reason = formatSyncErrorMessage(err, t);
      toast.show(t('syncStatus.authFailedToast', { reason }));
    }
  }, [t]);

  // 發起滾動備份獨立 Dropbox 連線
  const connectBackupDropbox = useCallback(async () => {
    const appKey = getDropboxAppKey();
    if (!appKey) {
      toast.show(t('settings.missingAppKey', '未配置 Dropbox App Key'));
      return;
    }

    try {
      await initiateDropboxAuth('sync', 'backup');
    } catch (err: unknown) {
      console.error('Failed to initiate backup Dropbox auth:', err);
      const reason = formatSyncErrorMessage(err, t);
      toast.show(t('syncStatus.authFailedToast', { reason }));
    }
  }, [t]);

  // 連線主同步 WebDAV（僅寫入記憶體暫存測試連線，通過後啟動首次同步，待步驟 4 完成才持久化）
  const connectWebDav = useCallback(
    async (config: WebDavConfig, mode: DropboxOAuthMode = 'sync'): Promise<boolean> => {
      if (checkWebDavAccountConflict(config, 'primary')) {
        toast.show(t('syncStatus.errors.sameAccount'));
        return false;
      }
      setStagingWebDavConfig(config, 'primary');
      try {
        await webdavAdapter.testConnection?.();
        await startInitialSync('', { mode, providerId: 'webdav' });
        return true;
      } catch (err: unknown) {
        clearStagingWebDavConfig('primary');
        const reason = formatSyncErrorMessage(err, t);
        toast.show(t('syncStatus.authFailedToast', { reason }));
        return false;
      }
    },
    [t]
  );

  // 連線滾動備份獨立 WebDAV（先以記憶體暫存測試連線，通過後才持久化啟用）
  const connectBackupWebDav = useCallback(
    async (config: WebDavConfig): Promise<boolean> => {
      if (checkWebDavAccountConflict(config, 'backup')) {
        toast.show(t('syncStatus.errors.sameAccount'));
        return false;
      }
      setStagingWebDavConfig(config, 'backup');
      try {
        await backupWebdavAdapter.testConnection?.();
        commitStagingWebDavConfig('backup');
        setBackupProviderId('webdav');
        notifyRollingBackupListeners();
        openCloudFlowBackupConnected('webdav');
        return true;
      } catch (err: unknown) {
        clearStagingWebDavConfig('backup');
        const reason = formatSyncErrorMessage(err, t);
        toast.show(t('syncStatus.authFailedToast', { reason }));
        return false;
      }
    },
    [t]
  );

  // 連線主同步 AWS S3 / 相容物件儲存（僅寫入記憶體暫存測試連線，待步驟 4 完成才持久化）
  const connectS3 = useCallback(
    async (config: S3Config, mode: DropboxOAuthMode = 'sync'): Promise<boolean> => {
      if (checkS3AccountConflict(config, 'primary')) {
        toast.show(t('syncStatus.errors.sameAccount'));
        return false;
      }
      setStagingS3Config(config, 'primary');
      try {
        await s3Adapter.testConnection?.();
        await startInitialSync('', { mode, providerId: 's3' });
        return true;
      } catch (err: unknown) {
        clearStagingS3Config('primary');
        const reason = formatSyncErrorMessage(err, t);
        toast.show(t('syncStatus.authFailedToast', { reason }));
        return false;
      }
    },
    [t]
  );

  // 連線滾動備份獨立 AWS S3 / 相容物件儲存（先以記憶體暫存測試連線，通過後才持久化啟用）
  const connectBackupS3 = useCallback(
    async (config: S3Config): Promise<boolean> => {
      if (checkS3AccountConflict(config, 'backup')) {
        toast.show(t('syncStatus.errors.sameAccount'));
        return false;
      }
      setStagingS3Config(config, 'backup');
      try {
        await backupS3Adapter.testConnection?.();
        commitStagingS3Config('backup');
        setBackupProviderId('s3');
        notifyRollingBackupListeners();
        openCloudFlowBackupConnected('s3');
        return true;
      } catch (err: unknown) {
        clearStagingS3Config('backup');
        const reason = formatSyncErrorMessage(err, t);
        toast.show(t('syncStatus.authFailedToast', { reason }));
        return false;
      }
    },
    [t]
  );

  // 中斷主同步連線
  const disconnectDropbox = useCallback(() => {
    getActiveSyncAdapter().disconnect();
    setActiveSyncProviderId('dropbox');
    setActiveProvider('dropbox');
    setIsAuthenticated(false);
    updateSyncEngineStatus({ lastSyncError: null, justSynced: false, lastSyncTime: null });
    toast.show(t('settings.disconnectedToast', '已中斷連線'));
  }, [t]);

  // 中斷每日滾動備份獨立連線（同時清除該渠道備份時間戳與異動標記，避免跨帳號殘留）
  const disconnectBackup = useCallback(() => {
    const currentProvider = getBackupProviderId();
    getBackupAdapter()?.disconnect();
    if (currentProvider) {
      clearBackupTrackingState(currentProvider);
    }
    setBackupProviderId(null);
    notifyRollingBackupListeners();
    toast.show(t('settings.disconnectedToast', '已中斷連線'));
  }, [t]);

  // 手動點擊立即同步 (支援指定模式：auto, overwrite_remote, overwrite_local)
  const syncNow = useCallback(
    async (
      mode: 'auto' | 'overwrite_local' | 'overwrite_remote' = 'auto'
    ): Promise<SyncResult> => {
      if (syncState.isSyncing) {
        return { success: false, timestamp: new Date().toISOString(), actionTaken: 'up_to_date' };
      }

      if (isDeviceOffline() || !isOnline) {
        toast.show(t('syncStatus.offlineToast'));
        return { success: false, timestamp: new Date().toISOString(), actionTaken: 'up_to_date' };
      }

      try {
        const result = await executeSync(mode);
        if (result.success) {
          reportNetworkSuccess();
          toast.show(t('syncStatus.syncSuccessToast'));
        } else if (result.error) {
          if (getSyncErrorReasonKey(result.error) === 'network') {
            reportNetworkError();
          }
          if (result.error === 'Device is offline') {
            toast.show(t('syncStatus.offlineToast'));
          } else if (result.error === 'Dropbox not connected') {
            const reason = formatSyncErrorMessage(result.error, t);
            toast.show(t('syncStatus.syncFailedToast', { reason }));
          }
        }
        return result;
      } catch (err: unknown) {
        if (getSyncErrorReasonKey(err) === 'network') {
          reportNetworkError();
        }
        const msg = err instanceof Error ? err.message : 'Unknown sync error';
        const reason = formatSyncErrorMessage(err, t);
        toast.show(t('syncStatus.syncFailedToast', { reason }));
        return {
          success: false,
          timestamp: new Date().toISOString(),
          error: msg,
          actionTaken: 'up_to_date',
        };
      }
    },
    [syncState.isSyncing, t, isOnline]
  );

  const overwriteRemote = useCallback((): Promise<SyncResult> => {
    return syncNow('overwrite_remote');
  }, [syncNow]);

  return {
    activeProviderId,
    isAuthenticated,
    isSyncing: syncState.isSyncing,
    lastSyncTime: syncState.lastSyncTime,
    lastSyncError: syncState.lastSyncError,
    justSynced: syncState.justSynced,
    isOnline,
    backupProviderId,
    isBackupConnected,
    isBackingUpZip,
    lastBackupZipTime,
    backupNow,
    connectDropbox,
    connectWebDav,
    connectS3,
    disconnectDropbox,
    connectBackupDropbox,
    connectBackupWebDav,
    connectBackupS3,
    disconnectBackup,
    syncNow,
    overwriteRemote,
  };
}
