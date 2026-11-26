import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, PrecisionDialogContent } from '@/components/ui/dialog';
import { SectionCard } from '@/components/ui/section-card';
import { MetricValue } from '@/components/ui/metric-value';
import { HoldToDeleteButton } from '@/components/ui/HoldToDeleteButton';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Check, GitMerge, RotateCcw } from 'lucide-react';
import type { UserBaseInfo } from '@/types';
import type { ImportStrategy } from '@/services/backup/importBackup';

export interface ImportStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  localBaseInfo: UserBaseInfo | null;
  backupBaseInfo: UserBaseInfo | null;
  onConfirm: (strategy: ImportStrategy) => Promise<void>;
}

export function ImportStrategyModal({
  isOpen,
  onClose,
  localBaseInfo,
  backupBaseInfo,
  onConfirm,
}: ImportStrategyModalProps) {
  const { t } = useTranslation();

  const localName = localBaseInfo?.name?.trim() || '';
  const backupName = backupBaseInfo?.name?.trim() || '';
  const isNameMismatch = Boolean(localName && backupName && localName !== backupName);

  const [strategy, setStrategy] = useState<ImportStrategy>(isNameMismatch ? 'overwrite' : 'merge');
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 當彈窗開啟或備份資料變動時，重置策略與輸入內容
  useEffect(() => {
    if (isNameMismatch) {
      setStrategy('overwrite');
    } else {
      setStrategy('merge');
    }
    setInputText('');
    setIsSubmitting(false);
  }, [isNameMismatch, isOpen]);

  // 取得目標確認詞
  const targetPhrase =
    strategy === 'merge'
      ? t('settings.confirmMergePhrase', '確認合併')
      : t('settings.confirmOverwritePhrase', '確認覆蓋');

  const isMatch = inputText.trim() === targetPhrase.trim();

  const handleClose = () => {
    if (isSubmitting) return;
    setInputText('');
    onClose();
  };

  const handleSelectStrategy = (newStrategy: ImportStrategy) => {
    if (isNameMismatch && newStrategy === 'merge') return;
    if (strategy !== newStrategy) {
      triggerHaptic('selection');
    }
    setStrategy(newStrategy);
    setInputText('');
  };

  const handleConfirm = async () => {
    if (!isMatch || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm(strategy);
      handleClose();
    } catch {
      setIsSubmitting(false);
    }
  };

  const formatGender = (gender?: string) => {
    if (!gender) return '-';
    if (gender === 'male') return t('profile.male', '男');
    if (gender === 'female') return t('profile.female', '女');
    return gender;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <PrecisionDialogContent
        title={t('settings.importStrategyModalTitle', '匯入方式')}
        onClose={handleClose}
        overlayClassName="z-[70]"
        className="z-[70]"
        initialFocus={false}
      >
        <div className="flex flex-col space-y-3.5 pt-3.5 pb-0 select-none">
          {/* 1. 個人資訊對比 (共用 SectionCard 內嵌表頭) */}
          <SectionCard
            title={t('settings.profileComparison', '個人資訊對比')}
            bodyClassName="text-xs font-sans"
          >
            {/* 三欄欄位標題 */}
            <div className="h-9 px-4 grid grid-cols-7 items-center bg-muted/20 text-2xs text-muted-foreground font-medium">
              <span className="col-span-2">{t('settings.item', '項目')}</span>
              <span className="col-span-2 text-center">{t('settings.local', '本機')}</span>
              <span className="col-span-3 text-right">{t('settings.backup', '備份')}</span>
            </div>

            {/* 姓名對比 */}
            <div
              className={cn(
                'min-h-10 py-2 px-4 grid grid-cols-7 items-center transition-colors',
                isNameMismatch && 'bg-destructive-subtle'
              )}
            >
              <span className="col-span-2 text-muted-foreground">{t('profile.name', '姓名')}</span>
              <span className="col-span-2 text-center font-medium text-foreground truncate">
                {localBaseInfo?.name || '-'}
              </span>
              <span
                className={cn(
                  'col-span-3 text-right font-medium truncate',
                  isNameMismatch ? 'text-destructive' : 'text-foreground'
                )}
              >
                {backupBaseInfo?.name || '-'}
              </span>
            </div>

            {/* 性別對比 */}
            <div className="h-10 px-4 grid grid-cols-7 items-center">
              <span className="col-span-2 text-muted-foreground">{t('profile.gender', '性別')}</span>
              <span className="col-span-2 text-center text-muted-foreground">
                {formatGender(localBaseInfo?.gender)}
              </span>
              <span className="col-span-3 text-right text-muted-foreground">
                {formatGender(backupBaseInfo?.gender)}
              </span>
            </div>

            {/* 出生對比 */}
            <div className="h-10 px-4 grid grid-cols-7 items-center">
              <span className="col-span-2 text-muted-foreground">{t('profile.birth', '出生')}</span>
              <span className="col-span-2 text-center font-mono text-muted-foreground">
                {localBaseInfo?.birthDate || '-'}
              </span>
              <span className="col-span-3 text-right font-mono text-muted-foreground">
                {backupBaseInfo?.birthDate || '-'}
              </span>
            </div>

            {/* 身高對比 */}
            <div className="h-10 px-4 grid grid-cols-7 items-center">
              <span className="col-span-2 text-muted-foreground">{t('profile.height', '身高')}</span>
              <span className="col-span-2 text-center text-muted-foreground">
                {localBaseInfo?.heightCm ? (
                  <MetricValue value={localBaseInfo.heightCm} unit="cm" valueClassName="text-muted-foreground" />
                ) : (
                  '-'
                )}
              </span>
              <span className="col-span-3 text-right text-muted-foreground">
                {backupBaseInfo?.heightCm ? (
                  <MetricValue value={backupBaseInfo.heightCm} unit="cm" valueClassName="text-muted-foreground" />
                ) : (
                  '-'
                )}
              </span>
            </div>
          </SectionCard>

          {/* 2. 處理策略 (共用 SectionCard 列表行) */}
          <SectionCard
            title={t('settings.strategyTitle', '處理策略')}
            bodyClassName="text-xs font-sans"
          >
            {/* 策略 A: 合併資料 */}
            <button
              type="button"
              disabled={isNameMismatch}
              onClick={() => handleSelectStrategy('merge')}
              className={cn(
                'w-full min-h-12 py-2.5 px-4 text-left flex items-center justify-between gap-3 transition-colors select-none',
                isNameMismatch
                  ? 'opacity-40 cursor-not-allowed pointer-events-none bg-card'
                  : strategy === 'merge'
                  ? 'bg-hover cursor-pointer'
                  : 'bg-card hover:bg-hover cursor-pointer'
              )}
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div className="size-6 rounded-md border border-border bg-muted/40 flex items-center justify-center shrink-0 mt-0.5">
                  <GitMerge className="size-3.5 text-foreground" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <span>{t('settings.mergeStrategy', '合併資料')}</span>
                    {isNameMismatch ? (
                      <span className="text-3xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {t('settings.cannotMergeBadge', '不可合併')}
                      </span>
                    ) : (
                      <span className="text-3xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        {t('settings.recommendedBadge', '推薦')}
                      </span>
                    )}
                  </div>
                  <p className="text-2xs text-muted-foreground leading-snug mt-0.5">
                    {isNameMismatch
                      ? t('settings.cannotMergeNameMismatch', '姓名不一致，僅支援覆蓋')
                      : t('settings.mergeStrategyDesc', '保留現有資料並匯入新項目，相同項目以備份更新。')}
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  'size-4 rounded-full flex items-center justify-center shrink-0 border transition-colors',
                  strategy === 'merge' && !isNameMismatch
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-border bg-transparent text-transparent'
                )}
              >
                {strategy === 'merge' && !isNameMismatch && (
                  <Check className="size-2.5" strokeWidth={2.5} />
                )}
              </div>
            </button>

            {/* 策略 B: 完全覆蓋 */}
            <button
              type="button"
              onClick={() => handleSelectStrategy('overwrite')}
              className={cn(
                'w-full min-h-12 py-2.5 px-4 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer select-none',
                strategy === 'overwrite'
                  ? 'bg-destructive-subtle'
                  : 'bg-card hover:bg-hover'
              )}
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div className="size-6 rounded-md border border-border bg-muted/40 flex items-center justify-center shrink-0 mt-0.5">
                  <RotateCcw className="size-3.5 text-foreground" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <span>{t('settings.overwriteStrategy', '完全覆蓋')}</span>
                    <span className="text-3xs font-medium text-destructive border border-destructive px-1.5 py-0.5 rounded">
                      {t('settings.resetBadge', '清空重置')}
                    </span>
                  </div>
                  <p className="text-2xs text-muted-foreground leading-snug mt-0.5">
                    {t('settings.overwriteStrategyDesc', '清空現有本地所有數據，完全以備份內容還原。')}
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  'size-4 rounded-full flex items-center justify-center shrink-0 border transition-colors',
                  strategy === 'overwrite'
                    ? 'bg-destructive text-destructive-foreground border-destructive'
                    : 'border-border bg-transparent text-transparent'
                )}
              >
                {strategy === 'overwrite' && <Check className="size-2.5" strokeWidth={2.5} />}
              </div>
            </button>
          </SectionCard>

          {/* 3. 確認輸入 (內嵌於 SectionCard，對齊 FoodFormDialog 輸入框規格) */}
          <SectionCard
            title={t('settings.confirmInputPrompt', { phrase: targetPhrase })}
            bodyClassName="text-xs font-sans"
          >
            <div className="h-10 relative flex items-stretch min-w-0 rounded-b-lg focus-within:ring-1 focus-within:ring-inset focus-within:ring-foreground focus-within:z-[1] transition-shadow duration-100">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={targetPhrase}
                aria-label={targetPhrase}
                disabled={isSubmitting}
                className="w-full h-full px-4 bg-transparent text-center text-xs font-sans text-foreground font-normal focus:outline-none placeholder:text-muted-foreground/40 disabled:opacity-50"
              />
            </div>
          </SectionCard>

          {/* 4. 底部長按蓄力確認按鈕（500ms 全背景蓄力防誤觸） */}
          <HoldToDeleteButton
            key={strategy}
            variant={strategy === 'merge' ? 'primary' : 'destructive'}
            disabled={!isMatch || isSubmitting}
            text={
              isSubmitting
                ? '...'
                : strategy === 'merge'
                  ? t('settings.holdToMergeAction', '長按合併')
                  : t('settings.holdToOverwriteAction', '長按覆蓋')
            }
            icon={
              strategy === 'merge' ? (
                <GitMerge className="size-3.5 shrink-0" strokeWidth={1.8} />
              ) : (
                <RotateCcw className="size-3.5 shrink-0" strokeWidth={1.8} />
              )
            }
            hintText={t('initialSync.holdHint', '長按 0.5 秒確認')}
            onConfirm={handleConfirm}
            className="rounded-lg"
          />
        </div>
      </PrecisionDialogContent>
    </Dialog>
  );
}
