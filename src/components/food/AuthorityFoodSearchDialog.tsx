import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogPrecisionHeader,
} from '@/components/ui/dialog';
import { AuthorityFoodBrowser } from '@/components/food/AuthorityFoodBrowser';
import { cn } from '@/lib/utils';
import type { FoodItem } from '@/types';

export interface AuthorityFoodSearchDialogProps {
  /** 控制彈窗開關 */
  open: boolean;
  /** 彈窗開關狀態變更回調 */
  onOpenChange: (open: boolean) => void;
  /** 選取回調：單筆導入後回傳該食物物件（例如在食物選擇彈窗中直接選取並繼續記錄） */
  onSelectFood?: (food: FoodItem) => void;
  /** 自訂初始搜尋關鍵字 */
  initialQuery?: string;
  /** 多層彈窗層級（Rule 4 規範） @default 80 */
  zIndex?: number;
  /** 自訂覆蓋樣式 */
  overlayClassName?: string;
  className?: string;
}

export function AuthorityFoodSearchDialog({
  open,
  onOpenChange,
  onSelectFood,
  initialQuery = '',
  zIndex = 80,
  overlayClassName,
  className,
}: AuthorityFoodSearchDialogProps) {
  const { t } = useTranslation();
  const hasChildModalOpenRef = useRef(false);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && hasChildModalOpenRef.current) return;
    onOpenChange(nextOpen);
  };

  const zIndexClass = `z-[${zIndex}]`;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        showCloseButton={false}
        initialFocus={false}
        className={cn(
          'flex flex-col w-[440px] max-w-[calc(100vw-24px)] sm:w-[440px] sm:max-w-[440px] h-[580px] max-h-[85vh] p-0 sm:p-0 gap-0 overflow-hidden bg-card border border-border shadow-none select-none',
          zIndexClass,
          className
        )}
        overlayClassName={cn(zIndexClass, overlayClassName)}
      >
        <div data-slot="dialog-header" className="shrink-0 bg-card px-4 pt-4 pb-1">
          <DialogPrecisionHeader
            title={t('diet.authorityTitleShort', '食物資料庫')}
            onClose={() => onOpenChange(false)}
            cancelAriaLabel={t('common.close')}
          />
        </div>

        <AuthorityFoodBrowser
          mode="dialog"
          active={open}
          initialQuery={initialQuery}
          onSelectFood={onSelectFood}
          onRequestClose={() => onOpenChange(false)}
          onChildModalOpenChange={(hasOpen) => {
            hasChildModalOpenRef.current = hasOpen;
          }}
          detailZIndex={zIndex + 10}
        />
      </DialogContent>
    </Dialog>
  );
}
