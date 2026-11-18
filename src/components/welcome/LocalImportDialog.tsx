import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Dialog, PrecisionDialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import {
  parseBackupFile,
  executeImport,
  type ParsedBackupData,
} from '@/services/backup/importBackup';
import { db } from '@/services/db/db';
import { PRIMARY_USER_ID } from '@/services/db/defaultData';
import { clearFoodsCache } from '@/hooks/useFoods';
import { clearRecipesCache } from '@/hooks/useRecipes';
import { clearExercisesCache } from '@/hooks/useExercises';
import { syncUserProfileCache } from '@/hooks/useUserProfile';

export interface LocalImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void | Promise<void>;
}

/**
 * 落地頁「本地導入」說明與備份摘要確認彈窗
 * 與 DropboxConnectDialog 維持完全對稱的 PrecisionDialogContent 幾何與質感
 */
export function LocalImportDialog({
  open,
  onOpenChange,
  onComplete,
}: LocalImportDialogProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stagedData, setStagedData] = useState<ParsedBackupData | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const resetState = () => {
    setStagedData(null);
    setFileName('');
    setIsParsing(false);
    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isImporting) return;
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  };

  const handlePickFile = () => {
    if (isParsing || isImporting) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsParsing(true);
    try {
      const parsed = await parseBackupFile(file);
      setStagedData(parsed);
      setFileName(file.name);
    } catch {
      toast.show(t('landing.launchMenu.invalidBackupToast', '無效的備份檔'));
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!stagedData || isImporting) return;
    setIsImporting(true);
    try {
      await executeImport(stagedData, 'overwrite');
      clearFoodsCache();
      clearRecipesCache();
      clearExercisesCache();
      const restoredBaseInfo = (await db.user_base_info.get(PRIMARY_USER_ID)) ?? null;
      syncUserProfileCache(restoredBaseInfo);
      resetState();
      onOpenChange(false);
      await onComplete();
    } catch {
      setIsImporting(false);
      toast.show(t('landing.launchMenu.importFailedToast', '導入失敗'));
    }
  };

  const backupName = stagedData?.baseInfos[0]?.name?.trim() || '-';

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <PrecisionDialogContent
          title={t('landing.launchMenu.localDialogTitle', '本地導入')}
          onClose={() => handleOpenChange(false)}
          onSubmit={stagedData ? handleConfirmImport : handlePickFile}
          submitDisabled={isParsing || isImporting}
          submitAriaLabel={
            stagedData
              ? t('landing.launchMenu.confirmImportAction', '確認導入')
              : t('landing.launchMenu.selectFileAction', '選擇檔案')
          }
          cancelAriaLabel={t('common.cancel')}
          overlayClassName="z-[70]"
          className="z-[70]"
        >
          <div className="pt-3.5 space-y-3 font-mono text-xs select-none">
            {!stagedData ? (
              <>
                {/* 階段 A：未選檔 — 與 DropboxConnectDialog 完全對稱的雙列 Usage List */}
                <div className="border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
                  <div className="h-10 px-3.5 flex items-center justify-between">
                    <span className="text-muted-foreground font-sans">
                      {t('landing.launchMenu.formatLabel', '格式')}
                    </span>
                    <span className="text-foreground font-medium font-mono">ZIP</span>
                  </div>
                  <div className="h-10 px-3.5 flex items-center justify-between">
                    <span className="text-muted-foreground font-sans">
                      {t('landing.launchMenu.fileLabel', '檔案')}
                    </span>
                    <span className="text-muted-foreground font-mono">-</span>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed px-0.5 font-sans">
                  {t(
                    'landing.launchMenu.localDialogDesc',
                    '選取 e2Cal 匯出的 ZIP 備份檔，將歷史資料還原至此裝置。'
                  )}
                </p>

                <Button
                  type="button"
                  onClick={handlePickFile}
                  disabled={isParsing}
                  className="w-full h-9 rounded-lg bg-foreground text-background font-mono text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
                >
                  {isParsing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    t('landing.launchMenu.selectFileAction', '選擇檔案')
                  )}
                </Button>
              </>
            ) : (
              <>
                {/* 階段 B：已解析 ZIP — 檔案資訊 + 2×2 數據摘要 */}
                <div className="border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
                  <div className="h-10 px-3.5 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground font-sans shrink-0">
                      {t('landing.launchMenu.fileLabel', '檔案')}
                    </span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-foreground font-medium font-mono truncate">
                        {fileName}
                      </span>
                      <button
                        type="button"
                        onClick={handlePickFile}
                        disabled={isImporting}
                        className="text-[11px] text-muted-foreground hover:text-foreground font-sans shrink-0 cursor-pointer transition-colors"
                      >
                        {t('landing.launchMenu.changeFileAction', '更換')}
                      </button>
                    </div>
                  </div>
                  <div className="h-10 px-3.5 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground font-sans shrink-0">
                      {t('profile.name', '姓名')}
                    </span>
                    <span className="text-foreground font-medium font-mono truncate">
                      {backupName}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg border border-border bg-card">
                    <div className="text-[10px] text-muted-foreground font-sans">
                      {t('initialSync.summaryFoods', '食材庫')}
                    </div>
                    <div className="text-sm font-semibold text-foreground font-mono mt-0.5">
                      {stagedData.foods.length}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-border bg-card">
                    <div className="text-[10px] text-muted-foreground font-sans">
                      {t('initialSync.summaryExercises', '動作庫')}
                    </div>
                    <div className="text-sm font-semibold text-foreground font-mono mt-0.5">
                      {stagedData.exercises.length}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-border bg-card">
                    <div className="text-[10px] text-muted-foreground font-sans">
                      {t('initialSync.summaryFoodLogs', '飲食記錄')}
                    </div>
                    <div className="text-sm font-semibold text-foreground font-mono mt-0.5">
                      {stagedData.dailyDietLogs.length}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-border bg-card">
                    <div className="text-[10px] text-muted-foreground font-sans">
                      {t('initialSync.summaryWorkoutLogs', '訓練記錄')}
                    </div>
                    <div className="text-sm font-semibold text-foreground font-mono mt-0.5">
                      {stagedData.workoutLogs.length}
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isImporting}
                  className="w-full h-9 rounded-lg bg-foreground text-background font-mono text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
                >
                  {isImporting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    t('landing.launchMenu.confirmImportAction', '確認導入')
                  )}
                </Button>
              </>
            )}
          </div>
        </PrecisionDialogContent>
      </Dialog>
    </>
  );
}
