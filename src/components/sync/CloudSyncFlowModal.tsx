import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Loader2,
  Cloud,
  RotateCcw,
} from 'lucide-react';
import { useInitialSync } from '@/hooks/useInitialSync';
import { Dialog, PrecisionDialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/section-card';
import { SyncStrategyPanel } from '@/components/sync/SyncStrategyPanel';
import { SyncTargetRows } from '@/components/sync/SyncTargetRows';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { getWorkingSyncProviderId } from '@/services/sync/syncRouter';
import {
  startInitialSync,
  type InitialSyncStep,
  type SyncConflictStrategy,
  type CloudSyncFlowBlockedReason,
  type CloudFlowSourcePickerPayload,
  type CloudFlowBlockedPayload,
} from '@/services/sync/initialSyncManager';
import type { RollingBackupItem } from '@/services/sync/rollingBackupService';
import type { UserBaseInfo } from '@/types';

export interface CloudSyncFlowPreviewConfig {
  open: boolean;
  step: InitialSyncStep;
  blockedReason?: CloudSyncFlowBlockedReason;
  onClose: () => void;
}

export interface CloudSyncFlowModalProps {
  /** 自訂完成後行為（如落地頁雲端導入後銜接過場動畫或補填基本資料）；未傳入則預設重新載入 */
  onCompleted?: () => void | Promise<void>;
  /** Dev 開發者後台預覽用：覆蓋流程狀態，不影響真實同步管理器 */
  preview?: CloudSyncFlowPreviewConfig;
}

function getStepNumber(step: InitialSyncStep): number {
  switch (step) {
    case 'AUTH':
      return 1;
    case 'STRATEGY':
      return 2;
    case 'DOWNLOADING':
      return 3;
    case 'APPLYING':
      return 4;
    case 'COMPLETED':
      return 5;
    default:
      return 1;
  }
}

function isFiveStepFlow(step: InitialSyncStep): boolean {
  return (
    step === 'AUTH' ||
    step === 'STRATEGY' ||
    step === 'DOWNLOADING' ||
    step === 'APPLYING' ||
    step === 'COMPLETED'
  );
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const PREVIEW_LOCAL_INFO: UserBaseInfo = {
  id: 'preview-local',
  name: 'Alex Chen',
  gender: 'male',
  birthDate: '1996-05-12',
  heightCm: 178,
  createdAt: 1,
  updatedAt: 1,
};

const PREVIEW_REMOTE_INFO: UserBaseInfo = {
  id: 'preview-remote',
  name: 'Alex (雲端)',
  gender: 'male',
  birthDate: '1996-05-12',
  heightCm: 178,
  createdAt: 1,
  updatedAt: 2,
};

const PREVIEW_SOURCE_PICKER: CloudFlowSourcePickerPayload = {
  providerId: 'dropbox',
  hasPrimarySync: true,
  backupItems: [
    {
      name: 'e2cal-backup-2026-11-28.zip',
      path: '/backup/e2cal-backup-2026-11-28.zip',
      date: '2026-11-28',
      size: 158240,
      serverModified: '2026-11-28T00:00:00Z',
    },
    {
      name: 'e2cal-backup-2026-11-27.zip',
      path: '/backup/e2cal-backup-2026-11-27.zip',
      date: '2026-11-27',
      size: 154112,
      serverModified: '2026-11-27T00:00:00Z',
    },
  ],
  onSelectRollingBackup: async () => {
    toast.show('預覽還原滾動備份');
  },
};

export function CloudSyncFlowModal({ onCompleted, preview }: CloudSyncFlowModalProps = {}) {
  const { t } = useTranslation();
  const realSync = useInitialSync();

  const isPreview = Boolean(preview);
  const isOpen = preview ? preview.open : realSync.isOpen;
  const step = preview ? preview.step : realSync.step;
  const progressPercent = preview ? (preview.step === 'COMPLETED' ? 100 : 64) : realSync.progressPercent;
  const downloadedFilesCount = preview ? 18 : realSync.downloadedFilesCount;
  const totalFilesCount = preview ? 28 : realSync.totalFilesCount;
  const localCount = preview ? 14 : realSync.localCount;
  const remoteCount = preview ? 28 : realSync.remoteCount;
  const localBaseInfo = preview ? PREVIEW_LOCAL_INFO : realSync.localBaseInfo;
  const remoteBaseInfo = preview ? PREVIEW_REMOTE_INFO : realSync.remoteBaseInfo;
  const isApplying = preview ? false : realSync.isApplying;
  const connectingProvider = preview ? 'dropbox' : realSync.connectingProvider;
  const sourcePicker = preview ? PREVIEW_SOURCE_PICKER : realSync.sourcePicker;
  const backupConnectedProvider = preview ? 'dropbox' : realSync.backupConnectedProvider;
  const blocked: CloudFlowBlockedPayload | null | undefined = preview
    ? {
        providerId: 'dropbox',
        reason: preview.blockedReason ?? 'account_conflict',
        targetScope: 'backup',
        accountLabel: 'user@example.com',
      }
    : realSync.blocked;
  const summary = preview
    ? {
        foodsCount: 12,
        exercisesCount: 8,
        foodLogsCount: 18,
        workoutLogsCount: 6,
        bodyMetricsCount: 4,
      }
    : realSync.summary;
  const error = preview ? null : realSync.error;
  const selectStrategy = preview
    ? (s: SyncConflictStrategy) => {
        toast.show(`預覽策略: ${s}`);
        preview.onClose();
      }
    : realSync.selectStrategy;
  const cancelInitialSync = preview ? preview.onClose : realSync.cancelInitialSync;
  const closeInitialSyncModal = preview ? preview.onClose : realSync.closeInitialSyncModal;
  const closeCloudFlow = preview ? preview.onClose : realSync.closeCloudFlow;

  const [restoringPath, setRestoringPath] = useState<string | null>(null);

  const showFiveStepBar = !error && isFiveStepFlow(step);
  const currentStep = getStepNumber(step);
  const isBusy = isApplying || step === 'CONNECTING' || Boolean(restoringPath);

  const handleCancel = () => {
    if (isBusy) return;
    if (step === 'SOURCE_PICKER') {
      sourcePicker?.onCancel?.();
      closeCloudFlow();
      return;
    }
    if (step === 'BLOCKED') {
      closeCloudFlow();
      return;
    }
    cancelInitialSync();
    toast.show(t('initialSync.cancelToast', '已取消同步'));
  };

  const handleComplete = () => {
    closeInitialSyncModal();
    if (isPreview) return;
    if (onCompleted) {
      void onCompleted();
      return;
    }
    window.location.reload();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen || isBusy) return;
    if (!error && step === 'COMPLETED') {
      handleComplete();
      return;
    }
    if (!error && step === 'BACKUP_CONNECTED') {
      closeCloudFlow();
      return;
    }
    handleCancel();
  };

  const handleSelectPrimaryFromPicker = () => {
    if (!sourcePicker || restoringPath) return;
    if (isPreview) {
      toast.show('預覽選擇雲端同步');
      preview?.onClose();
      return;
    }
    const snapshot = sourcePicker;
    void startInitialSync('', {
      mode: 'restore',
      providerId: snapshot.providerId,
      preloadedTokens: snapshot.preloadedTokens,
    });
  };

  const handleBackupRestore = async (item: RollingBackupItem) => {
    if (!sourcePicker || restoringPath) return;
    setRestoringPath(item.path);
    try {
      await sourcePicker.onSelectRollingBackup(item);
    } finally {
      setRestoringPath(null);
    }
  };

  const isNoRestorableData = blocked?.reason === 'no_restorable_data';

  const modalTitle = error
    ? t('initialSync.errorTitle', '同步失敗')
    : step === 'CONNECTING' || step === 'AUTH'
      ? t('initialSync.authTitle', '連線中')
      : step === 'SOURCE_PICKER'
        ? t('landing.launchMenu.cloudSourceDialogTitle')
        : step === 'BLOCKED'
          ? isNoRestorableData
            ? t('syncStatus.conflictDialog.emptyTitle')
            : t('syncStatus.conflictDialog.title')
          : step === 'BACKUP_CONNECTED'
            ? t('syncStatus.rollingBackup.connectedTitle')
            : step === 'STRATEGY'
            ? t('initialSync.strategyTitle', '同步方式')
            : step === 'DOWNLOADING'
              ? t('initialSync.downloadingTitle', '下載資料')
              : step === 'APPLYING'
                ? t('initialSync.applyingShortTitle', '寫入資料')
                : t('initialSync.completedTitle', '同步完成');

  const stepRightBadge =
    showFiveStepBar && step !== 'COMPLETED' ? (
      <span className="font-mono text-3xs tabular-nums text-muted-foreground min-w-[28px] text-right shrink-0">
        0{currentStep}/05
      </span>
    ) : undefined;

  const blockedProviderName = blocked ? t(`syncStatus.providers.${blocked.providerId}`) : '-';
  const blockedTargetScope = blocked?.targetScope ?? 'primary';
  const blockedTargetChannel =
    blockedTargetScope === 'backup'
      ? t('syncStatus.rollingBackup.settingsRowTitle')
      : t('syncStatus.cloudSyncTitle');
  const blockedOppositeChannel =
    blockedTargetScope === 'backup'
      ? t('syncStatus.cloudSyncTitle')
      : t('syncStatus.rollingBackup.settingsRowTitle');

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <PrecisionDialogContent
        title={modalTitle}
        onClose={
          !error && step === 'COMPLETED'
            ? handleComplete
            : !error && step === 'BACKUP_CONNECTED'
              ? closeCloudFlow
              : handleCancel
        }
        cancelDisabled={isBusy}
        onSubmit={
          !error && step === 'COMPLETED'
            ? handleComplete
            : !error && step === 'BACKUP_CONNECTED'
              ? closeCloudFlow
              : undefined
        }
        rightAction={stepRightBadge}
        submitAriaLabel={
          step === 'BACKUP_CONNECTED'
            ? t('syncStatus.rollingBackup.connectedConfirm')
            : t('initialSync.startUsingBtn', '開始使用')
        }
        cancelAriaLabel={
          error || step === 'BLOCKED' || step === 'SOURCE_PICKER'
            ? t('common.close', '關閉')
            : t('common.cancel', '取消')
        }
        overlayClassName="z-[100]"
        className="z-[100]"
      >
        <div className="pt-3.5 space-y-3 font-mono text-xs select-none">
          {/* 5 段精密步進刻度（僅首次同步核心步驟顯示） */}
          {showFiveStepBar && (
            <div className="flex items-center gap-1" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((idx) => (
                <span
                  key={idx}
                  className={cn(
                    'h-[2px] flex-1 rounded-full transition-colors',
                    idx <= currentStep ? 'bg-foreground' : 'bg-track'
                  )}
                />
              ))}
            </div>
          )}

          {/* 前置態: CONNECTING */}
          {!error && step === 'CONNECTING' && (
            <div className="border border-border rounded-lg bg-card p-3.5 flex items-center gap-3">
              <Loader2 className="size-4 animate-spin text-foreground shrink-0" />
              <div className="min-w-0 space-y-0.5">
                <div className="font-sans font-medium text-foreground">
                  {connectingProvider
                    ? t('landing.launchMenu.cloudConnectingProvider', {
                        provider: t(`syncStatus.providers.${connectingProvider}`),
                      })
                    : ''}
                </div>
                <p className="font-sans text-2xs text-muted-foreground leading-relaxed">
                  {t('landing.launchMenu.cloudConnectingHint')}
                </p>
              </div>
            </div>
          )}

          {/* 前置態: SOURCE_PICKER */}
          {!error && step === 'SOURCE_PICKER' && sourcePicker && (
            <div className="space-y-3.5">
              <p className="text-xs text-muted-foreground leading-relaxed px-0.5 font-sans">
                {sourcePicker.hasPrimarySync
                  ? t('landing.launchMenu.cloudSourceBothDesc', {
                      provider: t(`syncStatus.providers.${sourcePicker.providerId}`),
                    })
                  : t('landing.launchMenu.cloudSourceBackupOnlyDesc', {
                      provider: t(`syncStatus.providers.${sourcePicker.providerId}`),
                    })}
              </p>

              {sourcePicker.hasPrimarySync && (
                <SectionCard
                  title={t('syncStatus.cloudSyncTitle')}
                  bodyClassName="p-3 space-y-2.5 text-xs font-sans divide-y-0"
                >
                  <p className="text-2xs text-muted-foreground leading-relaxed">
                    {t('landing.launchMenu.cloudSourcePrimaryHint')}
                  </p>
                  <Button
                    type="button"
                    className="w-full h-9 text-xs font-semibold rounded-lg"
                    disabled={Boolean(restoringPath)}
                    onClick={handleSelectPrimaryFromPicker}
                  >
                    <Cloud className="size-3.5 mr-1.5" />
                    <span>{t('landing.launchMenu.cloudSourceUsePrimary')}</span>
                  </Button>
                </SectionCard>
              )}

              {sourcePicker.backupItems.length > 0 && (
                <SectionCard
                  title={t('syncStatus.rollingBackup.settingsRowTitle')}
                  bodyClassName="text-xs font-sans divide-y divide-border"
                >
                  {sourcePicker.backupItems.map((item) => (
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
                        variant={sourcePicker.hasPrimarySync ? 'outline' : 'default'}
                        size="sm"
                        disabled={Boolean(restoringPath)}
                        onClick={() => void handleBackupRestore(item)}
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
                  ))}
                </SectionCard>
              )}
            </div>
          )}

          {/* 阻斷態: BLOCKED (同帳戶衝突 / 無可還原資料) */}
          {!error && step === 'BLOCKED' && blocked && (
            <div className="space-y-3.5">
              {isNoRestorableData ? (
                <div className="rounded-lg border border-border bg-muted p-3">
                  <p className="text-xs text-foreground leading-relaxed font-sans">
                    {t('syncStatus.conflictDialog.emptyDesc', {
                      provider: blockedProviderName,
                    })}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-destructive bg-destructive-subtle p-3">
                  <p className="text-xs text-foreground leading-relaxed font-sans">
                    {t('syncStatus.conflictDialog.desc', {
                      provider: blockedProviderName,
                      targetChannel: blockedTargetChannel,
                      oppositeChannel: blockedOppositeChannel,
                    })}
                  </p>
                </div>
              )}

              <SectionCard
                title={
                  isNoRestorableData
                    ? t('syncStatus.conflictDialog.emptyDetailTitle')
                    : t('syncStatus.conflictDialog.detailTitle')
                }
                bodyClassName="text-xs font-sans"
              >
                <div className="h-10 px-4 flex justify-between items-center">
                  <span className="text-muted-foreground">{t('syncStatus.service')}</span>
                  <span className="text-foreground font-medium">{blockedProviderName}</span>
                </div>
                <div className="h-10 px-4 flex justify-between items-center gap-3">
                  <span className="text-muted-foreground shrink-0">
                    {t('syncStatus.dropboxAccountLabel')}
                  </span>
                  <span className="font-mono text-2xs text-foreground truncate">
                    {blocked.accountLabel || '-'}
                  </span>
                </div>
                {isNoRestorableData ? (
                  <>
                    <div className="h-10 px-4 flex justify-between items-center gap-3">
                      <span className="text-muted-foreground shrink-0">
                        {t('syncStatus.conflictDialog.checkedFoldersLabel')}
                      </span>
                      <span className="font-mono text-2xs text-foreground truncate">
                        /app, /backup
                      </span>
                    </div>
                    <div className="h-10 px-4 flex justify-between items-center">
                      <span className="text-muted-foreground">
                        {t('syncStatus.conflictDialog.resultLabel')}
                      </span>
                      <span className="text-foreground font-medium">
                        {t('syncStatus.conflictDialog.emptyResultValue')}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="h-10 px-4 flex justify-between items-center">
                    <span className="text-muted-foreground">
                      {t('syncStatus.conflictDialog.occupiedByLabel')}
                    </span>
                    <span className="text-foreground font-medium">{blockedOppositeChannel}</span>
                  </div>
                )}
              </SectionCard>

              <p className="text-2xs text-muted-foreground leading-relaxed px-0.5 font-sans">
                {isNoRestorableData
                  ? t('syncStatus.conflictDialog.emptySuggestion')
                  : t('syncStatus.conflictDialog.suggestion')}
              </p>

              <Button
                type="button"
                className="w-full h-9 text-xs font-semibold rounded-lg font-sans"
                onClick={handleCancel}
              >
                <span>{t('syncStatus.conflictDialog.confirmAction')}</span>
              </Button>
            </div>
          )}

          {/* 獨立完成態: BACKUP_CONNECTED */}
          {!error && step === 'BACKUP_CONNECTED' && backupConnectedProvider && (
            <div className="space-y-3.5">
              <SectionCard
                title={t('syncStatus.rollingBackup.settingsRowTitle')}
                bodyClassName="text-xs font-sans"
              >
                <div className="h-10 px-4 flex justify-between items-center">
                  <span className="text-muted-foreground">{t('syncStatus.service')}</span>
                  <span className="text-foreground font-medium font-mono">
                    {t(`syncStatus.providers.${backupConnectedProvider}`)}
                  </span>
                </div>
                <SyncTargetRows providerId={backupConnectedProvider} scope="backup" />
                <div className="h-10 px-4 flex justify-between items-center">
                  <span className="text-muted-foreground">
                    {t('syncStatus.rollingBackup.folderLabel')}
                  </span>
                  <span className="font-mono text-2xs text-foreground">/backup</span>
                </div>
              </SectionCard>

              <Button
                type="button"
                onClick={closeCloudFlow}
                className="w-full h-9 rounded-lg bg-foreground text-background font-mono text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
              >
                {t('syncStatus.rollingBackup.connectedConfirm')}
              </Button>
            </div>
          )}

          {/* 錯誤態 */}
          {error && (
            <>
              <div className="border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
                <div className="h-10 px-3.5 flex items-center justify-between">
                  <span className="text-muted-foreground font-sans">
                    {t('syncStatus.service', '服務')}
                  </span>
                  <span className="text-foreground font-medium font-mono">
                    {t(`syncStatus.providers.${getWorkingSyncProviderId()}`)}
                  </span>
                </div>
                <div className="h-10 px-3.5 flex items-center justify-between">
                  <span className="text-muted-foreground font-sans">
                    {t('syncStatus.status', '狀態')}
                  </span>
                  <span className="flex items-center gap-1.5 font-sans font-medium text-destructive">
                    <span className="size-1.5 rounded-full bg-destructive shrink-0" />
                    <span>{t('initialSync.errorStatus', '異常')}</span>
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-destructive bg-destructive-subtle text-destructive text-xs leading-relaxed break-words select-text font-sans">
                {error}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="w-full h-9 rounded-lg border border-border bg-card text-foreground hover:bg-hover font-mono text-xs font-medium cursor-pointer"
              >
                {t('common.close', '關閉')}
              </Button>
            </>
          )}

          {/* 步驟 1: AUTH */}
          {!error && step === 'AUTH' && (
            <>
              <div className="border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
                <div className="h-10 px-3.5 flex items-center justify-between">
                  <span className="text-muted-foreground font-sans">
                    {t('syncStatus.service', '服務')}
                  </span>
                  <span className="text-foreground font-medium font-mono">
                    {t(`syncStatus.providers.${getWorkingSyncProviderId()}`)}
                  </span>
                </div>
                <div className="h-10 px-3.5 flex items-center justify-between">
                  <span className="text-muted-foreground font-sans">
                    {t('syncStatus.status', '狀態')}
                  </span>
                  <span className="flex items-center gap-1.5 font-sans font-medium text-foreground">
                    <Loader2 className="size-3 animate-spin shrink-0" />
                    <span>{t('initialSync.authStatus', '驗證憑證')}</span>
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-track overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground transition-[width] duration-300"
                    style={{ width: `${Math.max(15, progressPercent)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-2xs text-muted-foreground">
                  <span className="font-sans truncate">
                    {t('initialSync.authHint', '正在檢查遠端備份清單…')}
                  </span>
                  <span className="font-mono tabular-nums shrink-0">{progressPercent}%</span>
                </div>
              </div>
            </>
          )}

          {/* 步驟 2: STRATEGY */}
          {!error && step === 'STRATEGY' && (
            <SyncStrategyPanel
              localBaseInfo={localBaseInfo}
              remoteBaseInfo={remoteBaseInfo}
              localCount={localCount}
              remoteCount={remoteCount}
              remoteColumnLabel={t('initialSync.cloudColumn', '雲端')}
              includeOverwriteRemote
              onConfirm={selectStrategy}
            />
          )}

          {/* 步驟 3: DOWNLOADING */}
          {!error && step === 'DOWNLOADING' && (
            <>
              <div className="border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
                <div className="h-10 px-3.5 flex items-center justify-between">
                  <span className="text-muted-foreground font-sans">
                    {t('syncStatus.service', '服務')}
                  </span>
                  <span className="text-foreground font-medium font-mono">
                    {t(`syncStatus.providers.${getWorkingSyncProviderId()}`)}
                  </span>
                </div>
                <div className="h-10 px-3.5 flex items-center justify-between">
                  <span className="text-muted-foreground font-sans">
                    {t('initialSync.filesLabel', '檔案')}
                  </span>
                  <span className="text-foreground font-medium font-mono tabular-nums">
                    {downloadedFilesCount} / {totalFilesCount || '-'}
                  </span>
                </div>
                <div className="h-10 px-3.5 flex items-center justify-between">
                  <span className="text-muted-foreground font-sans">
                    {t('initialSync.progressLabel', '進度')}
                  </span>
                  <span className="text-foreground font-semibold font-mono tabular-nums">
                    {progressPercent}%
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-track overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground transition-[width] duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin shrink-0" />
                  <span className="font-sans truncate">
                    {t('initialSync.downloadingDesc', {
                      provider: t(`syncStatus.providers.${getWorkingSyncProviderId()}`),
                    })}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* 步驟 4: APPLYING */}
          {!error && step === 'APPLYING' && (
            <>
              <div className="border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
                <div className="h-10 px-3.5 flex items-center justify-between">
                  <span className="text-muted-foreground font-sans">
                    {t('syncStatus.service', '服務')}
                  </span>
                  <span className="text-foreground font-medium font-mono">
                    {t(`syncStatus.providers.${getWorkingSyncProviderId()}`)}
                  </span>
                </div>
                <div className="h-10 px-3.5 flex items-center justify-between">
                  <span className="text-muted-foreground font-sans">
                    {t('initialSync.stageLabel', '階段')}
                  </span>
                  <span className="text-foreground font-medium font-sans">
                    {t('initialSync.applyingStage', '原子寫入')}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-track overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground transition-[width] duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-2xs text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-sans truncate">
                    <Loader2 className="size-3 animate-spin shrink-0" />
                    <span className="truncate">
                      {t('initialSync.applyingHint', '寫入本機資料庫中…')}
                    </span>
                  </span>
                  <span className="font-mono tabular-nums shrink-0">{progressPercent}%</span>
                </div>
              </div>
            </>
          )}

          {/* 步驟 5: COMPLETED */}
          {!error && step === 'COMPLETED' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg border border-border bg-card">
                  <div className="text-2xs text-muted-foreground font-sans">
                    {t('initialSync.summaryFoods', '食物庫')}
                  </div>
                  <div className="text-sm font-semibold text-foreground font-mono tabular-nums mt-0.5">
                    {summary?.foodsCount ?? 0}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-border bg-card">
                  <div className="text-2xs text-muted-foreground font-sans">
                    {t('initialSync.summaryExercises', '動作庫')}
                  </div>
                  <div className="text-sm font-semibold text-foreground font-mono tabular-nums mt-0.5">
                    {summary?.exercisesCount ?? 0}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-border bg-card">
                  <div className="text-2xs text-muted-foreground font-sans">
                    {t('initialSync.summaryFoodLogs', '飲食記錄')}
                  </div>
                  <div className="text-sm font-semibold text-foreground font-mono tabular-nums mt-0.5">
                    {summary?.foodLogsCount ?? 0}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-border bg-card">
                  <div className="text-2xs text-muted-foreground font-sans">
                    {t('initialSync.summaryWorkoutLogs', '訓練記錄')}
                  </div>
                  <div className="text-sm font-semibold text-foreground font-mono tabular-nums mt-0.5">
                    {summary?.workoutLogsCount ?? 0}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleComplete}
                className="w-full h-9 rounded-lg bg-foreground text-background font-mono text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
              >
                {t('initialSync.startUsingBtn', '開始使用')}
              </Button>
            </>
          )}
        </div>
      </PrecisionDialogContent>
    </Dialog>
  );
}
