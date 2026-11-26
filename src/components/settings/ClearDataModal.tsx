import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, PrecisionDialogContent } from '@/components/ui/dialog';
import { SectionCard } from '@/components/ui/section-card';
import { HoldToDeleteButton } from '@/components/ui/HoldToDeleteButton';
import { wipeAllSiteData } from '@/services/storage/wipeSiteData';
import { triggerHaptic } from '@/lib/haptics';
import { toast } from '@/components/ui/toast';
import { AlertTriangle, Trash2 } from 'lucide-react';

export interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ClearDataModal({ isOpen, onClose }: ClearDataModalProps) {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  const confirmPhrase = t('settings.clearDataConfirmPhrase', '清空所有數據');
  const isMatch = inputText.trim() === confirmPhrase.trim();

  const handleClose = () => {
    if (isClearing) return;
    setInputText('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!isMatch || isClearing) return;

    setIsClearing(true);
    triggerHaptic('warning');

    try {
      // 1. 執行瀏覽器級全量網站數據抹除 (IndexedDB、Storage、Cookies、快取與同步憑證)
      await wipeAllSiteData();

      toast.show(t('settings.dataCleared'));

      // 2. 延遲 300ms 後以 replace 跳轉至首頁，模擬全新訪客首次開啟網站並避免歷史堆疊回退至殘留狀態
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.replace('/');
        }
      }, 300);
    } catch (err) {
      console.error('Failed to wipe site data:', err);
      toast.show(t('common.error'));
      setIsClearing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <PrecisionDialogContent
        title={t('settings.clearData', '清除本地資料')}
        onClose={handleClose}
        overlayClassName="z-[70]"
        className="z-[70]"
        initialFocus={false}
      >
        <div className="flex flex-col space-y-3.5 pt-3.5 pb-0 select-none">
          {/* 1. 客觀警示卡片 */}
          <div className="p-3.5 rounded-lg border border-destructive bg-destructive-subtle flex items-start gap-2.5">
            <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
            <p className="text-xs leading-relaxed text-foreground font-sans">
              {t('settings.clearDataWarning')}
            </p>
          </div>

          {/* 2. 輸入確認防呆引導 (內嵌於 SectionCard，對齊 FoodFormDialog 輸入框規格) */}
          <SectionCard
            title={t('settings.clearDataInputPrompt', { phrase: confirmPhrase })}
            bodyClassName="text-xs font-sans"
          >
            <div className="h-10 relative flex items-stretch min-w-0 rounded-b-lg focus-within:ring-1 focus-within:ring-inset focus-within:ring-foreground focus-within:z-[1] transition-shadow duration-100">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={confirmPhrase}
                aria-label={confirmPhrase}
                disabled={isClearing}
                className="w-full h-full px-4 bg-transparent text-center text-xs font-sans text-foreground font-normal focus:outline-none placeholder:text-muted-foreground/40 disabled:opacity-50"
              />
            </div>
          </SectionCard>

          {/* 3. 底部長按蓄力清空按鈕（500ms 全背景蓄力防誤觸） */}
          <HoldToDeleteButton
            variant="destructive"
            disabled={!isMatch || isClearing}
            text={isClearing ? '...' : t('settings.holdToClearAction', '長按清空')}
            icon={<Trash2 className="size-3.5 shrink-0" strokeWidth={1.8} />}
            hintText={t('initialSync.holdHint', '長按 0.5 秒確認')}
            onConfirm={handleConfirm}
            className="rounded-lg"
          />
        </div>
      </PrecisionDialogContent>
    </Dialog>
  );
}
