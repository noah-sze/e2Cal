import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GitMerge, Download, Upload } from 'lucide-react';
import { MetricValue } from '@/components/ui/metric-value';
import { HoldToDeleteButton } from '@/components/ui/HoldToDeleteButton';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { getActiveSyncProviderId } from '@/services/sync/syncRouter';
import type { SyncConflictStrategy } from '@/services/sync/initialSyncManager';
import type { UserBaseInfo } from '@/types';

export interface SyncStrategyPanelProps {
  localBaseInfo: UserBaseInfo | null;
  remoteBaseInfo: UserBaseInfo | null;
  localCount?: number;
  remoteCount?: number;
  remoteColumnLabel: string;
  includeOverwriteRemote?: boolean;
  isSubmitting?: boolean;
  onConfirm: (strategy: SyncConflictStrategy) => void | Promise<void>;
}

/**
 * 單一真理源：資料對比與同步／匯入策略選擇面板
 * 共用於 CloudSyncFlowModal（STRATEGY 步驟）與 ImportStrategyModal（本地／備份還原策略）。
 */
export function SyncStrategyPanel({
  localBaseInfo,
  remoteBaseInfo,
  localCount,
  remoteCount,
  remoteColumnLabel,
  includeOverwriteRemote = false,
  isSubmitting = false,
  onConfirm,
}: SyncStrategyPanelProps) {
  const { t } = useTranslation();
  const [selectedStrategy, setSelectedStrategy] = useState<SyncConflictStrategy>('merge');

  const localName = localBaseInfo?.name?.trim() || '';
  const remoteName = remoteBaseInfo?.name?.trim() || '';
  const isNameMismatch = Boolean(localName && remoteName && localName !== remoteName);
  const effectiveStrategy: SyncConflictStrategy =
    isNameMismatch && selectedStrategy === 'merge' ? 'overwrite_local' : selectedStrategy;

  const formatGender = (gender?: string) => {
    if (!gender) return '-';
    if (gender === 'male') return t('profile.male', '男');
    if (gender === 'female') return t('profile.female', '女');
    return gender;
  };

  const handleSelect = (next: SyncConflictStrategy) => {
    if (isNameMismatch && next === 'merge') return;
    if (effectiveStrategy !== next) {
      triggerHaptic('selection');
    }
    setSelectedStrategy(next);
  };

  const holdButtonText = isSubmitting
    ? '...'
    : effectiveStrategy === 'merge'
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

  return (
    <>
      <div className="border border-border rounded-lg divide-y divide-border overflow-hidden bg-card text-2xs">
        <div className="grid grid-cols-7 px-2.5 py-1.5 bg-muted text-3xs text-muted-foreground font-sans font-medium">
          <span className="col-span-2">{t('settings.item', '項目')}</span>
          <span className="col-span-2 text-center">{t('settings.local', '本機')}</span>
          <span className="col-span-3 text-right">{remoteColumnLabel}</span>
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
            {localBaseInfo?.heightCm ? (
              <MetricValue value={localBaseInfo.heightCm} unit="cm" />
            ) : (
              '-'
            )}
          </span>
          <span className="col-span-3 text-right text-muted-foreground font-mono">
            {remoteBaseInfo?.heightCm ? (
              <MetricValue value={remoteBaseInfo.heightCm} unit="cm" />
            ) : (
              '-'
            )}
          </span>
        </div>

        <div className="grid grid-cols-7 px-2.5 py-1.5 items-center">
          <span className="col-span-2 text-muted-foreground font-sans">
            {t('initialSync.recordsLabel', '記錄')}
          </span>
          <span className="col-span-2 text-center font-mono font-medium tabular-nums">
            {localCount ?? '-'}
          </span>
          <span className="col-span-3 text-right font-mono font-medium tabular-nums">
            {remoteCount ?? '-'}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <button
          type="button"
          disabled={isNameMismatch || isSubmitting}
          onClick={() => handleSelect('merge')}
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
              <span className="font-sans text-2xs font-semibold text-foreground">
                {t('initialSync.mergeTitle', '雙向合併')}
              </span>
              {isNameMismatch && (
                <span className="font-mono text-[9px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded leading-none">
                  {t('settings.cannotMergeBadge', '不可合併')}
                </span>
              )}
            </span>
            <span className="block font-sans text-3xs text-muted-foreground truncate mt-0.5">
              {isNameMismatch
                ? t('settings.cannotMergeNameMismatch', '姓名不一致，僅支援覆蓋')
                : t('initialSync.mergeDesc', '保留雙方所有資料，相同項目取最新')}
            </span>
          </span>
        </button>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleSelect('overwrite_local')}
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
              <span className="font-sans text-2xs font-semibold text-foreground">
                {t('initialSync.overwriteLocalShortTitle', '覆蓋本機')}
              </span>
              <span className="font-mono text-[9px] text-destructive border border-destructive px-1.5 py-0.5 rounded leading-none">
                {t('initialSync.overwriteLocalBadge', '清空本機')}
              </span>
            </span>
            <span className="block font-sans text-3xs text-muted-foreground truncate mt-0.5">
              {t('initialSync.overwriteLocalDesc', '清空本地，完全還原雲端內容')}
            </span>
          </span>
        </button>

        {includeOverwriteRemote && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSelect('overwrite_remote')}
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
                <span className="font-sans text-2xs font-semibold text-foreground">
                  {t('initialSync.overwriteRemoteShortTitle', '覆蓋雲端')}
                </span>
                <span className="font-mono text-[9px] text-destructive border border-destructive px-1.5 py-0.5 rounded leading-none">
                  {t('initialSync.overwriteRemoteBadge', '覆寫雲端')}
                </span>
              </span>
              <span className="block font-sans text-3xs text-muted-foreground truncate mt-0.5">
                {t('initialSync.overwriteRemoteDesc', {
                  provider: t(`syncStatus.providers.${getActiveSyncProviderId()}`),
                })}
              </span>
            </span>
          </button>
        )}
      </div>

      <HoldToDeleteButton
        key={effectiveStrategy}
        variant={effectiveStrategy === 'merge' ? 'primary' : 'destructive'}
        disabled={isSubmitting}
        text={holdButtonText}
        icon={holdButtonIcon}
        hintText={t('initialSync.holdHint', '長按 0.5 秒確認')}
        onConfirm={() => onConfirm(effectiveStrategy)}
        className="rounded-lg"
      />
    </>
  );
}
