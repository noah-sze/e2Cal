import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  ChevronRight,
  RefreshCw,
  RotateCcw,
  Unlink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionCard } from '@/components/ui/section-card';
import { HoldToDeleteIconButton } from '@/components/ui/HoldToDeleteIconButton';
import { Dialog, PrecisionDialogContent } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { db } from '@/services/db/db';
import {
  checkWebDavAccountConflict,
  checkS3AccountConflict,
  type SyncTargetDetail,
} from '@/services/sync/syncRouter';
import {
  listRollingBackups,
  downloadRollingBackupBlob,
  type RollingBackupItem,
} from '@/services/sync/rollingBackupService';
import { formatSyncErrorMessage } from '@/services/sync/syncEngine';
import {
  parseBackupFile,
  executeImport,
  type ParsedBackupData,
  type ImportStrategy,
} from '@/services/backup/importBackup';
import { ImportStrategyModal } from '@/components/settings/dialogs/ImportStrategyModal';
import { SyncTargetRows } from '@/components/sync/SyncTargetRows';
import type { UserBaseInfo } from '@/types';
import type { SyncChannelScope, SyncProviderId } from '@/services/sync/syncAdapter';
import type { WebDavConfig } from '@/services/sync/adapters/webdavAdapter';
import type { S3Config } from '@/services/sync/adapters/s3Adapter';

export interface CloudChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelScope?: SyncChannelScope;
  activeProviderId?: SyncProviderId | null;
  isAuthenticated?: boolean;
  isSyncing?: boolean;
  lastSyncTime?: string | null;
  isOnline?: boolean;
  targetDetailsOverride?: SyncTargetDetail[];
  onConnectDropbox: () => void;
  onConnectWebDav?: (config: WebDavConfig) => Promise<boolean>;
  onConnectS3?: (config: S3Config) => Promise<boolean>;
  onDisconnect?: () => void;
  onSyncNow?: (mode?: 'auto' | 'overwrite_local' | 'overwrite_remote') => Promise<unknown>;
  // 每日滾動備份（channelScope === 'backup' 且已連線）專用控制項
  isBackingUpZip?: boolean;
  lastBackupZipTime?: string | null;
  isCloudSyncConnected?: boolean;
  onBackupNow?: () => Promise<unknown>;
  onSyncAfterRestore?: (mode: 'auto' | 'overwrite_remote') => Promise<unknown>;
  title?: string;
  description?: string;
  actionLabel?: string;
}

const PROVIDER_ORDER: readonly SyncProviderId[] = ['dropbox', 'webdav', 's3'];

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * 統一雲端設定與管理控制台（整合雲端同步、每日滾動備份與落地頁雲端導入）
 * - 未連線：雙步設定精靈（選擇渠道 -> 專屬授權／連線設定）
 * - 已連線 (primary)：主同步控制台（立即同步 / 覆寫雲端 / 中斷連線）
 * - 已連線 (backup)：每日滾動備份控制台（/backup 清單還原 / 立即備份 / 中斷連線）
 */
export function CloudChannelDialog({
  open,
  onOpenChange,
  channelScope = 'primary',
  activeProviderId = 'dropbox',
  isAuthenticated = false,
  isSyncing = false,
  lastSyncTime,
  isOnline = true,
  targetDetailsOverride,
  onConnectDropbox,
  onConnectWebDav,
  onConnectS3,
  onDisconnect,
  onSyncNow,
  isBackingUpZip = false,
  lastBackupZipTime,
  isCloudSyncConnected = false,
  onBackupNow,
  onSyncAfterRestore,
  title,
  description,
  actionLabel,
}: CloudChannelDialogProps) {
  const { t } = useTranslation();
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [selectedProvider, setSelectedProvider] = useState<SyncProviderId>(
    activeProviderId ?? 'dropbox'
  );
  const [isConnecting, setIsConnecting] = useState(false);

  // WebDAV 表單狀態
  const [webdavUrl, setWebdavUrl] = useState('');
  const [webdavUsername, setWebdavUsername] = useState('');
  const [webdavPassword, setWebdavPassword] = useState('');

  // S3 表單狀態
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Region, setS3Region] = useState('us-east-1');
  const [s3Endpoint, setS3Endpoint] = useState('');
  const [s3AccessKey, setS3AccessKey] = useState('');
  const [s3SecretKey, setS3SecretKey] = useState('');
  const [s3Prefix, setS3Prefix] = useState('e2cal');
  const [s3PathStyle, setS3PathStyle] = useState(false);

  // 滾動備份清單與還原狀態
  const [rollingBackups, setRollingBackups] = useState<RollingBackupItem[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [restoringPath, setRestoringPath] = useState<string | null>(null);
  const [restorePreview, setRestorePreview] = useState<{
    parsed: ParsedBackupData;
    localBaseInfo: UserBaseInfo | null;
    localCount: number;
  } | null>(null);

  const isBackupConsole = isAuthenticated && channelScope === 'backup';

  const loadBackups = useCallback(async () => {
    if (!activeProviderId || !isOnline) return;
    setIsLoadingBackups(true);
    try {
      const items = await listRollingBackups();
      setRollingBackups(items.slice(0, 3));
    } catch (err) {
      console.warn('[CloudChannelDialog] 讀取滾動備份清單失敗:', err);
    } finally {
      setIsLoadingBackups(false);
    }
  }, [activeProviderId, isOnline]);

  useEffect(() => {
    if (open && isBackupConsole && activeProviderId) {
      void loadBackups();
    }
  }, [open, isBackupConsole, activeProviderId, loadBackups]);

  const availableProviders = PROVIDER_ORDER.filter((id) => {
    if (id === 'dropbox') return true;
    if (id === 'webdav') return Boolean(onConnectWebDav);
    if (id === 's3') return Boolean(onConnectS3);
    return false;
  });

  const currentProvider: SyncProviderId = availableProviders.includes(selectedProvider)
    ? selectedProvider
    : 'dropbox';

  const getProviderLabel = (id: SyncProviderId) => t(`syncStatus.providers.${id}`);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setWizardStep(1);
    }
    onOpenChange(nextOpen);
  };

  const handleSelectProvider = (id: SyncProviderId) => {
    setSelectedProvider(id);
    setWizardStep(2);
  };

  const handleConnect = async () => {
    if (isConnecting) return;

    if (currentProvider === 'dropbox') {
      handleDialogOpenChange(false);
      onConnectDropbox();
      return;
    }
    if (currentProvider === 'webdav' && onConnectWebDav) {
      if (!webdavUrl.trim()) return;
      setIsConnecting(true);
      try {
        const ok = await onConnectWebDav({
          baseUrl: webdavUrl.trim(),
          username: webdavUsername.trim(),
          password: webdavPassword,
        });
        if (ok) handleDialogOpenChange(false);
      } finally {
        setIsConnecting(false);
      }
      return;
    }
    if (currentProvider === 's3' && onConnectS3) {
      if (!s3Bucket.trim() || !s3AccessKey.trim() || !s3SecretKey) return;
      setIsConnecting(true);
      try {
        const ok = await onConnectS3({
          bucket: s3Bucket.trim(),
          region: s3Region.trim() || 'us-east-1',
          endpoint: s3Endpoint.trim() || undefined,
          accessKeyId: s3AccessKey.trim(),
          secretAccessKey: s3SecretKey,
          prefix: s3Prefix.trim() || 'e2cal',
          forcePathStyle: s3PathStyle,
        });
        if (ok) handleDialogOpenChange(false);
      } finally {
        setIsConnecting(false);
      }
    }
  };

  const handleRestoreClick = async (item: RollingBackupItem) => {
    if (restoringPath) return;
    setRestoringPath(item.path);
    try {
      const blob = await downloadRollingBackupBlob(item.path);
      const [parsed, localBaseInfo, dietCount, workoutCount, bodyCount] = await Promise.all([
        parseBackupFile(blob),
        db.user_base_info.toCollection().first(),
        db.daily_diet_logs.count(),
        db.workout_logs.count(),
        db.body_metrics.count(),
      ]);
      handleDialogOpenChange(false);
      setRestorePreview({
        parsed,
        localBaseInfo: localBaseInfo ?? null,
        localCount: dietCount + workoutCount + bodyCount,
      });
    } catch (err: unknown) {
      const reason = formatSyncErrorMessage(err, t);
      toast.show(t('syncStatus.rollingBackup.restoreFailed', { reason }));
    } finally {
      setRestoringPath(null);
    }
  };

  const handleConfirmRestore = async (strategy: ImportStrategy) => {
    if (!restorePreview) return;
    await executeImport(restorePreview.parsed, strategy);
    setRestorePreview(null);
    toast.show(t('syncStatus.rollingBackup.restoreSuccess'));
    if (isCloudSyncConnected && onSyncAfterRestore && isOnline) {
      await onSyncAfterRestore(strategy === 'overwrite' ? 'overwrite_remote' : 'auto');
    }
  };

  const formatTime = (isoTime: string | null | undefined, includeDate = false) => {
    if (!isoTime) return t('settings.never');
    try {
      const d = new Date(isoTime);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      return includeDate ? `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}` : time;
    } catch {
      return t('settings.never');
    }
  };

  const isWebDavConflict =
    currentProvider === 'webdav' &&
    webdavUrl.trim().length > 0 &&
    checkWebDavAccountConflict(
      {
        baseUrl: webdavUrl.trim(),
        username: webdavUsername.trim(),
        password: webdavPassword,
      },
      channelScope
    );

  const isS3Conflict =
    currentProvider === 's3' &&
    s3AccessKey.trim().length > 0 &&
    checkS3AccountConflict(
      {
        bucket: s3Bucket.trim(),
        region: s3Region.trim() || 'us-east-1',
        endpoint: s3Endpoint.trim() || undefined,
        accessKeyId: s3AccessKey.trim(),
        secretAccessKey: s3SecretKey,
        prefix: s3Prefix.trim() || 'e2cal',
        forcePathStyle: s3PathStyle,
      },
      channelScope
    );

  const isAccountConflict = isWebDavConflict || isS3Conflict;

  const isFormValid =
    currentProvider === 'dropbox' ||
    (currentProvider === 'webdav' && webdavUrl.trim().length > 0 && !isWebDavConflict) ||
    (currentProvider === 's3' &&
      s3Bucket.trim().length > 0 &&
      s3AccessKey.trim().length > 0 &&
      s3SecretKey.length > 0 &&
      !isS3Conflict);

  const conflictChannelLabel =
    channelScope === 'backup'
      ? t('syncStatus.alreadyUsedInCloudSync')
      : t('syncStatus.alreadyUsedInRollingBackup');

  const renderFormConnectButton = () => (
    <Button
      type="button"
      variant={isAccountConflict ? 'destructive' : 'default'}
      disabled={isConnecting || !isFormValid}
      className={cn(
        'w-full h-9 text-xs font-semibold rounded-lg',
        isAccountConflict && 'disabled:opacity-100'
      )}
      onClick={() => void handleConnect()}
    >
      <span>
        {isAccountConflict
          ? conflictChannelLabel
          : isConnecting
            ? t('syncStatus.connecting')
            : t('syncStatus.testAndConnect')}
      </span>
    </Button>
  );

  const isStep2 = !isAuthenticated && wizardStep === 2;
  const resolvedTitle = isStep2
    ? t('syncStatus.setupTitle', { provider: getProviderLabel(currentProvider) })
    : (title ??
      (channelScope === 'backup'
        ? t('syncStatus.rollingBackup.settingsRowTitle')
        : t('syncStatus.cloudSyncTitle')));
  const resolvedDescription =
    description ??
    (channelScope === 'backup'
      ? t('syncStatus.rollingBackup.connectWizardDesc')
      : t('syncStatus.connectDialogDesc'));

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <PrecisionDialogContent
          title={resolvedTitle}
          leftIcon={isStep2 ? 'back' : 'close'}
          onClose={isStep2 ? () => setWizardStep(1) : () => handleDialogOpenChange(false)}
          cancelAriaLabel={isStep2 ? t('common.back', '返回') : t('common.close')}
          rightAction={
            !isAuthenticated ? (
              <span className="text-2xs font-mono tabular-nums text-muted-foreground w-7 text-right">
                {wizardStep}/2
              </span>
            ) : onDisconnect ? (
              <HoldToDeleteIconButton
                disabled={isBackupConsole ? isBackingUpZip : isSyncing}
                title={t('settings.holdToDisconnect')}
                aria-label={t('settings.holdToDisconnect')}
                hintText={t('settings.holdToDisconnectHint')}
                className="text-destructive hover:bg-destructive-subtle"
                onConfirm={() => {
                  onDisconnect();
                  if (isBackupConsole) {
                    handleDialogOpenChange(false);
                  }
                }}
              >
                <Unlink className="size-3.5" strokeWidth={1.8} />
              </HoldToDeleteIconButton>
            ) : undefined
          }
          overlayClassName="z-[70]"
          className="z-[70]"
        >
          <div className="pt-3.5 space-y-3.5 text-xs select-none">
            {/* 第一屏：說明用途並選擇雲端渠道 */}
            {!isAuthenticated && wizardStep === 1 && (
              <>
                {resolvedDescription && (
                  <p className="text-xs text-muted-foreground leading-relaxed px-0.5 font-sans">
                    {resolvedDescription}
                  </p>
                )}

                <SectionCard
                  title={t('syncStatus.chooseProvider')}
                  bodyClassName="text-xs font-sans divide-y divide-border"
                >
                  {availableProviders.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSelectProvider(id)}
                      className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-hover transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-semibold text-foreground">
                          {getProviderLabel(id)}
                        </div>
                        <div className="text-2xs text-muted-foreground mt-0.5">
                          {t(`syncStatus.providerSub.${id}`)}
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </SectionCard>
              </>
            )}

            {/* 第二屏：依所選渠道呈現設置 */}
            {!isAuthenticated && wizardStep === 2 && (
              <>
                {currentProvider === 'dropbox' && (
                  <>
                    <SectionCard
                      title={t('syncStatus.authSpecTitle')}
                      bodyClassName="text-xs font-sans"
                    >
                      <div className="h-10 px-4 flex justify-between items-center">
                        <span className="text-muted-foreground">{t('syncStatus.service')}</span>
                        <span className="text-foreground font-medium">
                          {getProviderLabel(currentProvider)}
                        </span>
                      </div>
                      <div className="h-10 px-4 flex justify-between items-center">
                        <span className="text-muted-foreground">
                          {t('syncStatus.accessScopeLabel')}
                        </span>
                        <span className="text-foreground">{t('syncStatus.appFolderScope')}</span>
                      </div>
                      <div className="h-10 px-4 flex justify-between items-center">
                        <span className="text-muted-foreground">
                          {t('syncStatus.authMethodLabel')}
                        </span>
                        <span className="font-mono text-foreground">
                          {t('syncStatus.oauthPkceValue')}
                        </span>
                      </div>
                    </SectionCard>

                    <Button
                      type="button"
                      disabled={isConnecting}
                      className="w-full h-9 text-xs font-semibold rounded-lg"
                      onClick={() => void handleConnect()}
                    >
                      <span>{actionLabel ?? t('syncStatus.goToAuth')}</span>
                    </Button>
                  </>
                )}

                {currentProvider === 'webdav' && (
                  <>
                    <div className="space-y-2.5">
                      <div className="space-y-1">
                        <Label className="text-2xs text-muted-foreground">
                          {t('syncStatus.webdav.urlLabel')}
                        </Label>
                        <Input
                          type="url"
                          value={webdavUrl}
                          onChange={(e) => setWebdavUrl(e.target.value)}
                          placeholder={t('syncStatus.webdav.urlPlaceholder')}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-2xs text-muted-foreground">
                            {t('syncStatus.webdav.usernameLabel')}
                          </Label>
                          <Input
                            type="text"
                            value={webdavUsername}
                            onChange={(e) => setWebdavUsername(e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-2xs text-muted-foreground">
                            {t('syncStatus.webdav.passwordLabel')}
                          </Label>
                          <Input
                            type="password"
                            value={webdavPassword}
                            onChange={(e) => setWebdavPassword(e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      </div>
                      <p className="text-2xs text-muted-foreground px-0.5">
                        {t('syncStatus.webdav.hint')}
                      </p>
                    </div>

                    {renderFormConnectButton()}
                  </>
                )}

                {currentProvider === 's3' && (
                  <>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-2xs text-muted-foreground">
                            {t('syncStatus.s3.bucketLabel')}
                          </Label>
                          <Input
                            type="text"
                            value={s3Bucket}
                            onChange={(e) => setS3Bucket(e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-2xs text-muted-foreground">
                            {t('syncStatus.s3.regionLabel')}
                          </Label>
                          <Input
                            type="text"
                            value={s3Region}
                            onChange={(e) => setS3Region(e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-2xs text-muted-foreground">
                          {t('syncStatus.s3.endpointLabel')}
                        </Label>
                        <Input
                          type="url"
                          value={s3Endpoint}
                          onChange={(e) => setS3Endpoint(e.target.value)}
                          placeholder={t('syncStatus.s3.endpointPlaceholder')}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-2xs text-muted-foreground">
                          {t('syncStatus.s3.accessKeyLabel')}
                        </Label>
                        <Input
                          type="text"
                          value={s3AccessKey}
                          onChange={(e) => setS3AccessKey(e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-2xs text-muted-foreground">
                          {t('syncStatus.s3.secretKeyLabel')}
                        </Label>
                        <Input
                          type="password"
                          value={s3SecretKey}
                          onChange={(e) => setS3SecretKey(e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 items-end">
                        <div className="space-y-1">
                          <Label className="text-2xs text-muted-foreground">
                            {t('syncStatus.s3.prefixLabel')}
                          </Label>
                          <Input
                            type="text"
                            value={s3Prefix}
                            onChange={(e) => setS3Prefix(e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <label className="h-8 px-2.5 flex items-center justify-between rounded-md border border-border bg-card cursor-pointer text-2xs text-foreground">
                          <span>{t('syncStatus.s3.pathStyleLabel')}</span>
                          <input
                            type="checkbox"
                            checked={s3PathStyle}
                            onChange={(e) => setS3PathStyle(e.target.checked)}
                            className="accent-foreground"
                          />
                        </label>
                      </div>
                      <p className="text-2xs text-muted-foreground px-0.5">
                        {t('syncStatus.s3.hint')}
                      </p>
                    </div>

                    {renderFormConnectButton()}
                  </>
                )}
              </>
            )}

            {/* 第三屏：已連線管理控制台（共用連線資訊卡） */}
            {isAuthenticated && (
              <>
                <SectionCard
                  title={t('settings.connectionInfo')}
                  bodyClassName="text-xs font-sans"
                >
                  <div className="h-10 px-4 flex justify-between items-center">
                    <span className="text-muted-foreground">{t('syncStatus.service')}</span>
                    <span className="text-foreground font-medium">
                      {activeProviderId ? getProviderLabel(activeProviderId) : '-'}
                    </span>
                  </div>

                  <SyncTargetRows
                    details={targetDetailsOverride}
                    providerId={activeProviderId ?? null}
                    scope={channelScope}
                  />

                  <div className="h-10 px-4 flex justify-between items-center">
                    <span className="text-muted-foreground">{t('settings.status')}</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'size-1.5 rounded-full shrink-0',
                          isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/60'
                        )}
                      />
                      <span className="text-foreground font-medium">
                        {isOnline ? t('settings.connected') : t('settings.offline')}
                      </span>
                    </div>
                  </div>

                  <div className="h-10 px-4 flex justify-between items-center">
                    <span className="text-muted-foreground">
                      {isBackupConsole
                        ? t('syncStatus.rollingBackup.lastBackup')
                        : t('settings.lastSync')}
                    </span>
                    <span className="font-mono tabular-nums text-foreground">
                      {isBackupConsole
                        ? formatTime(lastBackupZipTime, true)
                        : formatTime(lastSyncTime)}
                    </span>
                  </div>
                </SectionCard>

                {/* 主同步操作區 */}
                {!isBackupConsole && onSyncNow && (
                  <Button
                    type="button"
                    className="w-full h-9 text-xs font-semibold rounded-lg"
                    onClick={() => onSyncNow()}
                    disabled={isSyncing || !isOnline}
                  >
                    <RefreshCw
                      className={cn('size-3.5 mr-1.5', isSyncing && 'animate-spin')}
                    />
                    <span>
                      {isSyncing
                        ? t('settings.syncing')
                        : !isOnline
                          ? t('settings.offlineCannotSync')
                          : t('settings.syncNow')}
                    </span>
                  </Button>
                )}

                {/* 每日滾動備份操作區 */}
                {isBackupConsole && (
                  <>
                    <SectionCard
                      title={`${t('syncStatus.rollingBackup.title')} (${rollingBackups.length}/3)`}
                      action={
                        <button
                          type="button"
                          onClick={() => void loadBackups()}
                          disabled={isLoadingBackups || !isOnline}
                          title={t('syncStatus.rollingBackup.refresh')}
                          aria-label={t('syncStatus.rollingBackup.refresh')}
                          className="size-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-hover transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw
                            className={cn('size-3', isLoadingBackups && 'animate-spin')}
                          />
                        </button>
                      }
                      bodyClassName="text-xs font-sans divide-y divide-border"
                    >
                      {isLoadingBackups && rollingBackups.length === 0 ? (
                        <div className="py-3 px-4 text-2xs text-muted-foreground">
                          {t('syncStatus.rollingBackup.loading')}
                        </div>
                      ) : rollingBackups.length === 0 ? (
                        <div className="py-3 px-4 text-2xs text-muted-foreground">
                          {t('syncStatus.rollingBackup.empty')}
                        </div>
                      ) : (
                        rollingBackups.map((item) => (
                          <div
                            key={item.path}
                            className="min-h-10 py-1.5 px-4 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-mono tabular-nums text-xs text-foreground">
                                {item.date}
                              </div>
                              <div className="font-mono tabular-nums text-2xs text-muted-foreground">
                                {formatFileSize(item.size)}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={Boolean(restoringPath) || !isOnline}
                              onClick={() => void handleRestoreClick(item)}
                              className="h-7 px-2.5 text-2xs shadow-none shrink-0"
                            >
                              <RotateCcw className="size-3 mr-1" />
                              <span>
                                {restoringPath === item.path
                                  ? t('syncStatus.rollingBackup.restoring')
                                  : t('syncStatus.rollingBackup.restore')}
                              </span>
                            </Button>
                          </div>
                        ))
                      )}

                      {onBackupNow && (
                        <div className="p-3">
                          <Button
                            type="button"
                            className="w-full h-8 text-xs font-semibold rounded-lg shadow-none"
                            disabled={isBackingUpZip || !isOnline}
                            onClick={async () => {
                              await onBackupNow();
                              await loadBackups();
                            }}
                          >
                            <Archive className="size-3.5 mr-1.5" />
                            <span>
                              {isBackingUpZip
                                ? t('syncStatus.rollingBackup.backingUp')
                                : t('syncStatus.rollingBackup.backupNow')}
                            </span>
                          </Button>
                        </div>
                      )}
                    </SectionCard>
                  </>
                )}
              </>
            )}
          </div>
        </PrecisionDialogContent>
      </Dialog>

      <ImportStrategyModal
        isOpen={Boolean(restorePreview)}
        onClose={() => setRestorePreview(null)}
        localBaseInfo={restorePreview?.localBaseInfo ?? null}
        backupBaseInfo={restorePreview?.parsed.baseInfos[0] ?? null}
        localCount={restorePreview?.localCount}
        backupCount={
          restorePreview
            ? restorePreview.parsed.dailyDietLogs.length +
              restorePreview.parsed.workoutLogs.length +
              restorePreview.parsed.bodyMetrics.length
            : undefined
        }
        onConfirm={handleConfirmRestore}
      />
    </>
  );
}
