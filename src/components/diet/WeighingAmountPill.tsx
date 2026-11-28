import type React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { MetricValue } from '@/components/ui/metric-value';
import { cn, formatDisplayAmount } from '@/lib/utils';

export interface WeighingAmountPillProps {
  /** 客觀純可食淨重（或預設顯示重量） */
  quantity: number;
  /** 若以毛重稱量，傳入實際毛重數值以顯示「毛重 | xxx g」 */
  grossQuantity?: number;
  unit?: string;
  disabled?: boolean;
  title?: string;
  /** 當數值 <= 0 時顯示的佔位符（例如 '-'；預設顯示 '0'） */
  emptyFallback?: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

/**
 * L3 共用稱重膠囊按鈕：統一顯示「毛重 | 數值 單位 >」或「數值 單位 >」
 * 用於 EditFoodLogDialog、CopyMealDialog 與 RecipeIngredientsCard。
 */
export function WeighingAmountPill({
  quantity,
  grossQuantity,
  unit = 'g',
  disabled = false,
  title,
  emptyFallback = '0',
  onClick,
  className,
}: WeighingAmountPillProps) {
  const { t } = useTranslation();
  const hasGross = typeof grossQuantity === 'number' && grossQuantity > 0;
  const rawDisplay = hasGross ? grossQuantity : quantity;
  const formattedValue =
    rawDisplay > 0 ? formatDisplayAmount(String(rawDisplay)) || emptyFallback : emptyFallback;

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        'h-7 px-2.5 rounded-full border border-border/80 bg-background hover:bg-hover font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 select-none shrink-0 disabled:pointer-events-none',
        className
      )}
    >
      {hasGross ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-2xs font-sans text-muted-foreground">
            {t('diet.grossWeightLabel', '毛重')}
          </span>
          <span className="h-3 w-px bg-border/80 shrink-0" aria-hidden="true" />
          <MetricValue
            value={formattedValue}
            unit={unit}
            valueClassName="font-normal text-foreground"
            unitClassName="text-2xs"
          />
        </span>
      ) : (
        <MetricValue
          value={formattedValue}
          unit={unit}
          valueClassName="font-normal text-foreground"
          unitClassName="text-2xs"
        />
      )}
      <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
    </button>
  );
}
