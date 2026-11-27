import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { triggerHaptic } from '@/lib/haptics';
import { db } from '@/services/db/db';
import { downloadBackupZip } from '@/services/backup/exportBackupZip';
import {
  parseBackupFile,
  executeImport,
  type ParsedBackupData,
  type ImportStrategy,
} from '@/services/backup/importBackup';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { ClearDataModal } from '@/components/settings/ClearDataModal';
import { ImportStrategyModal } from '@/components/settings/dialogs/ImportStrategyModal';
import type { UserBaseInfo } from '@/types';

export default function DataAndSystemSettingsPage() {
  const { t } = useTranslation();
  const confirm = useConfirm();

  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);
  const [isImportStrategyModalOpen, setIsImportStrategyModalOpen] = useState(false);
  const [stagedBackupData, setStagedBackupData] = useState<ParsedBackupData | null>(null);
  const [stagedLocalBase, setStagedLocalBase] = useState<UserBaseInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 匯出資料備份為 ZIP 檔案
  const handleExportZip = async () => {
    try {
      await downloadBackupZip();
      triggerHaptic('success');
      toast.show(t('settings.exported'));
    } catch {
      toast.show(t('common.error'));
    }
  };

  // 觸發選擇備份檔案
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // 處理匯入備份檔案
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    try {
      const parsed = await parseBackupFile(file);

      const [
        dietLogsCount,
        workoutLogsCount,
        metricsCount,
        customFoodsCount,
        customRecipesCount,
        customExercisesCount,
        customRoutinesCount,
        localBase,
      ] = await Promise.all([
        db.daily_diet_logs.count(),
        db.workout_logs.count(),
        db.body_metrics.count(),
        db.foods.filter((f) => Boolean(f.isCustom)).count(),
        db.recipes.filter((r) => Boolean(r.isCustom)).count(),
        db.exercises.filter((ex) => Boolean(ex.isCustom)).count(),
        db.routines.filter((r) => Boolean(r.isCustom)).count(),
        db.user_base_info.toCollection().first(),
      ]);

      const localCount =
        dietLogsCount +
        workoutLogsCount +
        metricsCount +
        customFoodsCount +
        customRecipesCount +
        customExercisesCount +
        customRoutinesCount;

      if (localCount === 0) {
        const result = await executeImport(parsed, 'overwrite');
        if (result.success) {
          triggerHaptic('success');
          toast.show(t('settings.imported'));
        }
        return;
      }

      setStagedBackupData(parsed);
      setStagedLocalBase(localBase || null);
      setIsImportStrategyModalOpen(true);
    } catch (err: unknown) {
      triggerHaptic('error');
      if (err instanceof Error && err.message === 'INVALID_BACKUP_FILE') {
        toast.show(t('settings.invalidBackupFile'));
      } else {
        toast.show(t('settings.importFailed'));
      }
    }
  };

  // 執行確認之匯入策略
  const handleExecuteImport = async (strategy: ImportStrategy) => {
    if (!stagedBackupData) return;
    try {
      const result = await executeImport(stagedBackupData, strategy);
      if (result.success) {
        triggerHaptic('success');
        toast.show(t('settings.imported'));
      }
    } catch {
      triggerHaptic('error');
      toast.show(t('settings.importFailed'));
    }
  };

  // 恢復缺失的系統預設資料
  const handleRestoreDefaults = async () => {
    const ok = await confirm({
      variant: 'restore',
      title: t('settings.restoreDefaults'),
      description: t('settings.restoreDefaultsConfirm'),
      details: t('settings.restoreDefaultsScope'),
      confirmText: t('settings.restoreDefaultsAction'),
    });

    if (ok) {
      try {
        const res = await db.restoreDefaultData();
        if (res.totalRestored > 0) {
          triggerHaptic('success');
          toast.show(t('settings.defaultsRestoredWithCount', { count: res.totalRestored }));
        } else {
          toast.show(t('settings.noDefaultsToRestore'));
        }
      } catch {
        toast.show(t('common.error'));
      }
    }
  };

  // 開啟清除所有本地資料之高防呆安全確認彈窗
  const handleClearData = () => {
    triggerHaptic('warning');
    setIsClearDataModalOpen(true);
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-7 pb-20 select-none">
      {/* 備份與預設資料 */}
      <section className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start">
        <div className="sm:col-span-4 space-y-0.5 px-1 sm:px-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
            {t('settings.dataVaultSection')}
          </h2>
          <p className="text-2xs text-muted-foreground font-mono leading-relaxed">
            {t('settings.dataVaultDesc')}
          </p>
        </div>
        <div className="sm:col-span-8 border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
          {/* 匯出資料備份 */}
          <div onClick={handleExportZip} className="usage-row cursor-pointer group">
            <span className="text-sm font-normal text-foreground">{t('settings.exportData')}</span>
            <div className="flex items-center gap-1.5 text-sm font-mono text-muted-foreground group-hover:text-foreground">
              <span>ZIP</span>
              <ChevronRight className="size-4 opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* 匯入資料備份 */}
          <div onClick={handleImportClick} className="usage-row cursor-pointer group">
            <span className="text-sm font-normal text-foreground">{t('settings.importData')}</span>
            <div className="flex items-center gap-1.5 text-sm font-mono text-muted-foreground group-hover:text-foreground">
              <span>ZIP</span>
              <ChevronRight className="size-4 opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* 恢復預設數據 */}
          <div onClick={handleRestoreDefaults} className="usage-row cursor-pointer group">
            <span className="text-sm font-normal text-foreground">
              {t('settings.restoreDefaults')}
            </span>
            <div className="flex items-center gap-1.5 text-sm font-mono text-muted-foreground group-hover:text-foreground">
              <span>{t('settings.restoreDefaultsAction')}</span>
              <ChevronRight className="size-4 opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* 隱藏之備份檔案選擇器 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </section>

      {/* 分割線 */}
      <div className="border-t border-border" />

      {/* 危險操作 */}
      <section className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start">
        <div className="sm:col-span-4 space-y-0.5 px-1 sm:px-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-destructive font-mono">
            {t('settings.dangerZoneSection')}
          </h2>
          <p className="text-2xs text-destructive font-mono leading-relaxed">
            {t('settings.dangerZoneDesc')}
          </p>
        </div>
        <div className="sm:col-span-8 border border-destructive rounded-lg overflow-hidden bg-card">
          <div
            onClick={handleClearData}
            className="h-12 px-4 flex items-center justify-between hover:bg-destructive-subtle transition-colors cursor-pointer group"
          >
            <span className="text-sm font-normal text-destructive">{t('settings.clearData')}</span>
            <div className="flex items-center gap-1.5 text-sm font-mono text-destructive">
              <span>{t('settings.clearDataAction')}</span>
              <ChevronRight className="size-4 opacity-70" />
            </div>
          </div>
        </div>
      </section>

      {/* 清除本地資料高防呆確認彈窗 */}
      <ClearDataModal
        isOpen={isClearDataModalOpen}
        onClose={() => setIsClearDataModalOpen(false)}
      />

      {/* 備份匯入衝突策略選擇彈窗 */}
      <ImportStrategyModal
        isOpen={isImportStrategyModalOpen}
        onClose={() => {
          setIsImportStrategyModalOpen(false);
          setStagedBackupData(null);
        }}
        localBaseInfo={stagedLocalBase}
        backupBaseInfo={stagedBackupData?.baseInfos[0] || null}
        onConfirm={handleExecuteImport}
      />
    </div>
  );
}
