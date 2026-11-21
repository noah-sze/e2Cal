import React from 'react';
import type { TFunction } from 'i18next';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { MetricValue } from '@/components/ui/metric-value';
import { cn } from '@/lib/utils';

export interface SubNutrientRowSpec {
  label: string;
  value?: number | null;
  swatchClassName?: string;
  /** 可選自訂右側值渲染（用於 editable 表單模式接管渲染） */
  renderValue?: (defaultNode: React.ReactNode) => React.ReactNode;
}

export interface SubNutrientsPopoverProps {
  /** 次要營養素項目清單 */
  rows: SubNutrientRowSpec[];
  /** 觸發器內容（支援一般節點或依 open 狀態動態渲染之函式） */
  children: React.ReactNode | ((state: { open: boolean }) => React.ReactNode);
  align?: 'start' | 'center' | 'end';
  alignOffset?: number;
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  positionerClassName?: string;
  triggerClassName?: string;
}

const round1 = (val: number) => Math.round(val * 10) / 10;

export function buildCarbsSubRows(
  t: TFunction,
  sugar?: number | null,
  fiber?: number | null
): SubNutrientRowSpec[] {
  return [
    { label: t('diet.sugar', '糖'), value: sugar, swatchClassName: 'bg-carbs-dark' },
    { label: t('diet.fiber', '膳食纖維'), value: fiber, swatchClassName: 'bg-fiber-stripe' },
  ];
}

export function buildFatSubRows(
  t: TFunction,
  saturatedFat?: number | null,
  transFat?: number | null
): SubNutrientRowSpec[] {
  return [
    { label: t('diet.saturatedFat', '飽和脂肪'), value: saturatedFat, swatchClassName: 'bg-fat-dark' },
    { label: t('diet.transFat', '反式脂肪'), value: transFat, swatchClassName: 'bg-trans-fat-bar' },
  ];
}

/**
 * 單一真理源：次要營養素展示 Popover（帶圖例 Swatch 與純點擊觸發）
 * 共用於三大元素進度條（MacroProgressGrid）與三大元素方形膠囊（MacroSquares）。
 */
export function SubNutrientsPopover({
  rows,
  children,
  align = 'start',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 4,
  positionerClassName = 'z-[70]',
  triggerClassName,
}: SubNutrientsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        render={(props, state) => (
          <div
            {...props}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              props.onClick?.(e);
            }}
            className={cn('outline-none', triggerClassName)}
          >
            {typeof children === 'function' ? children({ open: state.open }) : children}
          </div>
        )}
      />
      <PopoverContent
        side={side}
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        positionerClassName={positionerClassName}
        onClick={(e) => e.stopPropagation()}
        className="w-44 p-1 gap-0 bg-popover text-popover-foreground border border-border shadow-none rounded-lg select-none font-mono"
      >
        <div className="space-y-0.5 text-xs">
          {rows.map((row) => {
            const defaultNode =
              typeof row.value === 'number' ? (
                <MetricValue
                  value={round1(row.value)}
                  unit="g"
                  valueClassName="text-foreground/85 text-xs"
                  unitClassName="text-xs"
                />
              ) : (
                <span className="text-muted-foreground/40 select-none font-mono text-xs">-</span>
              );

            return (
              <div
                key={row.label}
                className="h-8 flex items-center justify-between px-2 rounded hover:bg-hover transition-colors"
              >
                <span className="text-muted-foreground font-sans text-xs inline-flex items-center gap-1.5">
                  {row.swatchClassName && (
                    <span className={cn('w-2.5 h-1.5 rounded-[2px] shrink-0', row.swatchClassName)} />
                  )}
                  <span>{row.label}</span>
                </span>
                <div onClick={(e) => e.stopPropagation()}>
                  {row.renderValue ? row.renderValue(defaultNode) : defaultNode}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
