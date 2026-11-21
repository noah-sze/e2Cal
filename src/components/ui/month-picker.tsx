import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import { Dialog, PrecisionDialogContent } from '@/components/ui/dialog';
import { MonthCalendar } from '@/components/ui/month-calendar';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/haptics';

export interface MonthPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value?: string; // "YYYY-MM"
  onChange: (val: string) => void;
}

/**
 * 獨立受控之出生年月選擇彈窗（可作為平級兄弟節點掛載，避免與外層 Dialog 巢狀導致遮罩失效）
 */
export function MonthPickerDialog({
  open,
  onOpenChange,
  value,
  onChange,
}: MonthPickerDialogProps) {
  const { t } = useTranslation();
  const [tempValue, setTempValue] = useState<string>(value || '');

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      if (value) {
        setTempValue(value);
      } else {
        const now = new Date();
        setTempValue(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
      }
    }
  }

  const handleConfirm = () => {
    if (tempValue) {
      onChange(tempValue);
      triggerHaptic('selection');
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PrecisionDialogContent
        overlayClassName="z-[70] bg-overlay backdrop-blur-[2px]"
        className="z-[70]"
        initialFocus={false}
        title={t('profileSettings.birthDate', '出生年月')}
        onClose={() => onOpenChange(false)}
        onSubmit={handleConfirm}
        submitAriaLabel={t('common.confirm', '確認')}
        cancelAriaLabel={t('common.cancel', '取消')}
      >
        <MonthCalendar
          value={tempValue || value}
          onChange={setTempValue}
        />
      </PrecisionDialogContent>
    </Dialog>
  );
}

export interface MonthPickerProps {
  value?: string; // "YYYY-MM"
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  children?: React.ReactNode;
}

/**
 * e2Cal 精密出生年月選擇器 (Precision Month Picker)
 * 100% 遵循標準精密彈窗規範 (Standard Precision Modal Architecture)：
 * 1. 寬度唯一真理源：320px 緊湊網格，內邊距恆定 16px (p-4 sm:p-4)，0 陰影
 * 2. 標頭唯一真理源：左側取消圖標圓鈕 (✕)、中間客觀純名詞「出生年月」、右側確認圓鈕 (✓)
 * 3. 遮罩與層級防護：次級彈窗標準 z-[70] 與 bg-overlay backdrop-blur-[2px]
 */
export function MonthPicker({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  id,
  children,
}: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    if (!disabled) {
      setIsOpen(true);
      triggerHaptic('light');
    }
  };

  return (
    <>
      {children ? (
        <div
          id={id}
          onClick={handleOpen}
          className={cn("cursor-pointer select-none", className)}
        >
          {children}
        </div>
      ) : (
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={handleOpen}
          className={cn(
            "h-10 w-full px-3 rounded-lg border border-border bg-card hover:bg-hover text-foreground transition-colors cursor-pointer text-sm font-mono flex items-center justify-between gap-2 shadow-none disabled:opacity-50 disabled:cursor-not-allowed select-none",
            className
          )}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder || "YYYY-MM"}
          </span>
          <CalendarDays className="size-3.5 text-muted-foreground shrink-0" />
        </button>
      )}

      <MonthPickerDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        value={value}
        onChange={onChange}
      />
    </>
  );
}
