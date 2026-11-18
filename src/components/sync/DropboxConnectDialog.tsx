import { useTranslation } from 'react-i18next';
import { Dialog, PrecisionDialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface DropboxConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  actionLabel?: string;
}

/**
 * Dropbox 連線說明與授權確認彈窗（全域共用單一真理源）
 * 供頂部 SyncStatusPill 與落地頁「雲端導入」共用
 */
export function DropboxConnectDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  actionLabel,
}: DropboxConnectDialogProps) {
  const { t } = useTranslation();

  const resolvedTitle = title ?? t('syncStatus.connectDialogTitle');
  const resolvedDescription = description ?? t('syncStatus.connectDialogDesc');
  const resolvedActionLabel = actionLabel ?? t('syncStatus.connectAction');

  const handleConfirm = () => {
    onOpenChange(false);
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PrecisionDialogContent
        title={resolvedTitle}
        onClose={() => onOpenChange(false)}
        onSubmit={handleConfirm}
        submitAriaLabel={resolvedActionLabel}
        cancelAriaLabel={t('common.cancel')}
        overlayClassName="z-[70]"
        className="z-[70]"
      >
        <div className="pt-3.5 space-y-3 font-mono text-xs select-none">
          {/* Vercel Usage List 條目 */}
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
              <div className="flex items-center gap-1.5 font-mono">
                <span className="size-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                <span className="text-muted-foreground">
                  {t('syncStatus.disconnected', '未連線')}
                </span>
              </div>
            </div>
          </div>

          {/* 客觀說明文本 */}
          <p className="text-[11px] text-muted-foreground leading-relaxed px-0.5 font-sans">
            {resolvedDescription}
          </p>

          {/* 滿寬連線操作按鈕 */}
          <Button
            type="button"
            onClick={handleConfirm}
            className="w-full h-9 rounded-lg bg-foreground text-background font-mono text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
          >
            {resolvedActionLabel}
          </Button>
        </div>
      </PrecisionDialogContent>
    </Dialog>
  );
}
