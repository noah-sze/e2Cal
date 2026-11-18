import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GitMerge,
  Download,
  Upload,
  Loader2,
} from 'lucide-react';
import { useInitialSync } from '@/hooks/useInitialSync';
import { Dialog, PrecisionDialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HoldToDeleteButton } from '@/components/ui/HoldToDeleteButton';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type {
  InitialSyncStep,
  SyncConflictStrategy,
} from '@/services/sync/initialSyncManager';

export interface InitialSyncModalProps {
  /** 自訂完成後行為（如落地頁雲端導入後銜接過場動畫或補填基本資料）；未傳入則預設重新載入 */
  onCompleted?: () => void | Promise<void>;
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

export function InitialSyncModal({ onCompleted }: InitialSyncModalProps = {}) {
  const { t } = useTranslation();
  const {
    isOpen,
    step,
    progressPercent,
    downloadedFilesCount,
    totalFilesCount,
    localCount,
    remoteCount,
    localBaseInfo,
    remoteBaseInfo,
    isApplying,
    summary,
    error,
    selectStrategy,
    cancelInitialSync,
    closeInitialSyncModal,
  } = useInitialSync();

  const [selectedStrategy, setSelectedStrategy] = useState<SyncConflictStrategy>('merge');

  const localName = localBaseInfo?.name?.trim() || '';
  const remoteName = remoteBaseInfo?.name?.trim() || '';
  const isNameMismatch = Boolean(localName && remoteName && localName !== remoteName);
  const effectiveStrategy: SyncConflictStrategy =
    isNameMismatch && selectedStrategy === 'merge' ? 'overwrite_local' : selectedStrategy;

  const currentStep = getStepNumber(step);

  const handleCancel = () => {
    if (isApplying) return; // 寫入階段禁止打斷
    cancelInitialSync();
    toast.show(t('initialSync.cancelToast', '已取消同步'));
  };

  const handleComplete = () => {
    closeInitialSyncModal();
    if (onCompleted) {
      void onCompleted();
      return;
    }
    window.location.reload();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) return;
    if (isApplying) return;
    if (!error && step === 'COMPLETED') {
      handleComplete();
      return;
    }
    handleCancel();
  };

  const formatGender = (gender?: string) => {
    if (!gender) return '-';
    if (gender === 'male') return t('profile.male', '男');
    if (gender === 'female') return t('profile.female', '女');
    return gender;
  };

  const modalTitle = error
    ? t('initialSync.errorTitle', '同步失敗')
    : step === 'AUTH'
      ? t('initialSync.authTitle', '連線中')
      : step === 'STRATEGY'
        ? t('initialSync.strategyTitle', '同步方式')
        : step === 'DOWNLOADING'
          ? t('initialSync.downloadingTitle', '下載資料')
          : step === 'APPLYING'
            ? t('initialSync.applyingShortTitle', '寫入資料')
            : t('initialSync.completedTitle', '同步完成');

  const holdButtonText =
    effectiveStrategy === 'merge'
      ? t('initialSync.holdToMerge', '長按合併')
      : effectiveStrategy === 'overwrite_local'
        ? t('initialSync.holdToOverwriteLocal', '長按覆蓋本機')
        : t('initialSync.holdToOverwriteRemote', '長按覆蓋雲端');

  const holdButtonIcon =
    effectiveStrategy === 'merge' ? (
      <GitMerge className="size-3.5 shrink-0" strokeWidth={1.8} />
    ) : effectiveStrategy === 'overwrite_local' ? (
      <Download className="size-3.5 shrink-0" strokeWidth={1.8} />
    ) : (
      <Upload className="size-3.5 shrink-0" strokeWidth={1.8} />
    );

  const stepRightBadge =
    !error && step !== 'COMPLETED' ? (
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground min-w-[28px] text-right shrink-0">
        0{currentStep}/05
      </span>
    ) : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <PrecisionDialogContent
        title={modalTitle}
        onClose={handleCancel}
        cancelDisabled={isApplying}
        onSubmit={!error && step === 'COMPLETED' ? handleComplete : undefined}
        rightAction={stepRightBadge}
        submitAriaLabel={t('initialSync.startUsingBtn', '開始使用')}
        cancelAriaLabel={error ? t('common.close', '關閉') : t('common.cancel', '取消')}
        overlayClassName="z-[100]"
        className="z-[100]"
      >
        <div className="pt-3.5 space-y-3 font-mono text-xs select-none">
          {/* 5 段精密步進刻度（非錯誤態顯示） */}
          {!error && (
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

          {/* 錯誤態 */}
          {error && (
            <>
              <div className="border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
                <div className="h-10 px-3.5 flex items-center justify-between">
                  <span className="text-muted-foreground font-sans">
                    {t('syncStatus.service', '服務')}
                  </span>
                  <span className="text-foreground font-medium font-mono">Dropbox</span>
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
                  <span className="text-foreground font-medium font-mono">Dropbox</span>
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
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-sans truncate">
                    {t('initialSync.authHint', '正在檢查遠端備份清單…')}
                  </span>
                  <span className="font-mono tabular-nums shrink-0">{progressPercent}%</span>
                </div>
              </div>
            </>
          )}

          {/* 步驟 2: STRATEGY（個人資訊對比表 + 3 策略卡 + 500ms 長按蓄力確認） */}
          {!error && step === 'STRATEGY' && (
            <>
              <div className="border border-border rounded-lg divide-y divide-border overflow-hidden bg-card text-[11px]">
                <div className="grid grid-cols-7 px-2.5 py-1.5 bg-muted text-[10px] text-muted-foreground font-sans font-medium">
                  <span className="col-span-2">{t('settings.item', '項目')}</span>
                  <span className="col-span-2 text-center">{t('settings.local', '本機')}</span>
                  <span className="col-span-3 text-right">
                    {t('initialSync.cloudColumn', '雲端')}
                  </span>
                </div>

                <div
                  className={cn(
                    'grid grid-cols-7 px-2.5 py-1.5 items-center',
                    isNameMismatch && 'bg-destructive-subtle'
                  )}
                >
                  <span className="col-span-2 text-muted-foreground font-sans">
                    {t('profile.name', '姓名')}
                  </span>
                  <span className="col-span-2 text-center font-mono font-medium truncate">
                    {localName || '-'}
                  </span>
                  <span
                    className={cn(
                      'col-span-3 text-right font-mono font-medium truncate',
                      isNameMismatch ? 'text-destructive' : 'text-foreground'
                    )}
                  >
                    {remoteName || '-'}
                  </span>
                </div>

                <div className="grid grid-cols-7 px-2.5 py-1.5 items-center">
                  <span className="col-span-2 text-muted-foreground font-sans">
                    {t('profile.gender', '性別')}
                  </span>
                  <span className="col-span-2 text-center text-muted-foreground font-sans">
                    {formatGender(localBaseInfo?.gender)}
                  </span>
                  <span className="col-span-3 text-right text-muted-foreground font-sans">
                    {formatGender(remoteBaseInfo?.gender)}
                  </span>
                </div>

                <div className="grid grid-cols-7 px-2.5 py-1.5 items-center">
                  <span className="col-span-2 text-muted-foreground font-sans">
                    {t('profile.birth', '出生')}
                  </span>
                  <span className="col-span-2 text-center text-muted-foreground font-mono">
                    {localBaseInfo?.birthDate || '-'}
                  </span>
                  <span className="col-span-3 text-right text-muted-foreground font-mono">
                    {remoteBaseInfo?.birthDate || '-'}
                  </span>
                </div>

                <div className="grid grid-cols-7 px-2.5 py-1.5 items-center">
                  <span className="col-span-2 text-muted-foreground font-sans">
                    {t('profile.height', '身高')}
                  </span>
                  <span className="col-span-2 text-center text-muted-foreground font-mono">
                    {localBaseInfo?.heightCm ? `${localBaseInfo.heightCm} cm` : '-'}
                  </span>
                  <span className="col-span-3 text-right text-muted-foreground font-mono">
                    {remoteBaseInfo?.heightCm ? `${remoteBaseInfo.heightCm} cm` : '-'}
                  </span>
                </div>

                <div className="grid grid-cols-7 px-2.5 py-1.5 items-center">
                  <span className="col-span-2 text-muted-foreground font-sans">
                    {t('initialSync.recordsLabel', '記錄')}
                  </span>
                  <span className="col-span-2 text-center font-mono font-medium tabular-nums">
                    {localCount}
                  </span>
                  <span className="col-span-3 text-right font-mono font-medium tabular-nums">
                    {remoteCount}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                {/* 雙向合併（無「推薦」微標；姓名不一致時禁用） */}
                <button
                  type="button"
                  disabled={isNameMismatch}
                  onClick={() => setSelectedStrategy('merge')}
                  className={cn(
                    'w-full p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition-colors select-none',
                    isNameMismatch
                      ? 'opacity-40 cursor-not-allowed pointer-events-none border-border bg-card'
                      : effectiveStrategy === 'merge'
                        ? 'border-foreground bg-hover cursor-pointer'
                        : 'border-border bg-card hover:bg-hover cursor-pointer'
                  )}
                >
                  <span className="size-5 rounded bg-muted border border-border flex items-center justify-center shrink-0 mt-0.5">
                    <GitMerge className="size-3 text-foreground" strokeWidth={1.8} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-sans text-[11px] font-semibold text-foreground">
                        {t('initialSync.mergeTitle', '雙向合併')}
                      </span>
                      {isNameMismatch && (
                        <span className="font-mono text-[9px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded leading-none">
                          {t('settings.cannotMergeBadge', '不可合併')}
                        </span>
                      )}
                    </span>
                    <span className="block font-sans text-[10px] text-muted-foreground truncate mt-0.5">
                      {isNameMismatch
                        ? t('settings.cannotMergeNameMismatch', '姓名不一致，僅支援覆蓋')
                        : t('initialSync.mergeDesc', '保留雙方所有資料，相同項目取最新')}
                    </span>
                  </span>
                </button>

                {/* 覆蓋本機 */}
                <button
                  type="button"
                  onClick={() => setSelectedStrategy('overwrite_local')}
                  className={cn(
                    'w-full p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition-colors cursor-pointer select-none',
                    effectiveStrategy === 'overwrite_local'
                      ? 'border-destructive bg-destructive-subtle'
                      : 'border-border bg-card hover:bg-hover'
                  )}
                >
                  <span className="size-5 rounded bg-muted border border-border flex items-center justify-center shrink-0 mt-0.5">
                    <Download className="size-3 text-foreground" strokeWidth={1.8} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-sans text-[11px] font-semibold text-foreground">
                        {t('initialSync.overwriteLocalShortTitle', '覆蓋本機')}
                      </span>
                      <span className="font-mono text-[9px] text-destructive border border-destructive px-1.5 py-0.5 rounded leading-none">
                        {t('initialSync.overwriteLocalBadge', '清空本機')}
                      </span>
                    </span>
                    <span className="block font-sans text-[10px] text-muted-foreground truncate mt-0.5">
                      {t('initialSync.overwriteLocalDesc', '清空本地，完全還原雲端內容')}
                    </span>
                  </span>
                </button>

                {/* 覆蓋雲端 */}
                <button
                  type="button"
                  onClick={() => setSelectedStrategy('overwrite_remote')}
                  className={cn(
                    'w-full p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition-colors cursor-pointer select-none',
                    effectiveStrategy === 'overwrite_remote'
                      ? 'border-destructive bg-destructive-subtle'
                      : 'border-border bg-card hover:bg-hover'
                  )}
                >
                  <span className="size-5 rounded bg-muted border border-border flex items-center justify-center shrink-0 mt-0.5">
                    <Upload className="size-3 text-foreground" strokeWidth={1.8} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-sans text-[11px] font-semibold text-foreground">
                        {t('initialSync.overwriteRemoteShortTitle', '覆蓋雲端')}
                      </span>
                      <span className="font-mono text-[9px] text-destructive border border-destructive px-1.5 py-0.5 rounded leading-none">
                        {t('initialSync.overwriteRemoteBadge', '覆寫雲端')}
                      </span>
                    </span>
                    <span className="block font-sans text-[10px] text-muted-foreground truncate mt-0.5">
                      {t('initialSync.overwriteRemoteDesc', '用當前設備資料覆寫 Dropbox')}
                    </span>
                  </span>
                </button>
              </div>

              <HoldToDeleteButton
                key={effectiveStrategy}
                variant={effectiveStrategy === 'merge' ? 'primary' : 'destructive'}
                text={holdButtonText}
                icon={holdButtonIcon}
                hintText={t('initialSync.holdHint', '長按 0.5 秒確認')}
                onConfirm={() => selectStrategy(effectiveStrategy)}
                className="rounded-lg"
              />
            </>
          )}

          {/* 步驟 3: DOWNLOADING */}
          {!error && step === 'DOWNLOADING' && (
            <>
              <div className="border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
                <div className="h-10 px-3.5 flex items-center justify-between">
                  <span className="text-muted-foreground font-sans">
                    {t('syncStatus.service', '服務')}
                  </span>
                  <span className="text-foreground font-medium font-mono">Dropbox</span>
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
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Loader2 className="size-3 animate-spin shrink-0" />
                  <span className="font-sans truncate">
                    {t('initialSync.downloadingDesc', '正在從 Dropbox 下載最新資料…')}
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
                  <span className="text-foreground font-medium font-mono">Dropbox</span>
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
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
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
                  <div className="text-[11px] text-muted-foreground font-sans">
                    {t('initialSync.summaryFoods', '食材庫')}
                  </div>
                  <div className="text-sm font-semibold text-foreground font-mono tabular-nums mt-0.5">
                    {summary?.foodsCount ?? 0}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-border bg-card">
                  <div className="text-[11px] text-muted-foreground font-sans">
                    {t('initialSync.summaryExercises', '動作庫')}
                  </div>
                  <div className="text-sm font-semibold text-foreground font-mono tabular-nums mt-0.5">
                    {summary?.exercisesCount ?? 0}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-border bg-card">
                  <div className="text-[11px] text-muted-foreground font-sans">
                    {t('initialSync.summaryFoodLogs', '飲食記錄')}
                  </div>
                  <div className="text-sm font-semibold text-foreground font-mono tabular-nums mt-0.5">
                    {summary?.foodLogsCount ?? 0}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-border bg-card">
                  <div className="text-[11px] text-muted-foreground font-sans">
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
