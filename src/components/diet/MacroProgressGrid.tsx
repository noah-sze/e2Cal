import React from 'react';
import { useTranslation } from 'react-i18next';
import { MetricValue } from '@/components/ui/metric-value';
import {
  SubNutrientsPopover,
  buildCarbsSubRows,
  type SubNutrientRowSpec,
} from '@/components/food/SubNutrientsPopover';
import { cn } from '@/lib/utils';

export interface MacroProgressTotals {
  carbs: number;
  protein: number;
  fat: number;
  sugar?: number;
  fiber?: number;
  saturatedFat?: number;
  transFat?: number;
}

export interface MacroProgressTargets {
  carbsGrams: number;
  proteinGrams: number;
  fatGrams: number;
}

export interface MacroProgressGridProps {
  totals: MacroProgressTotals;
  targetMacros: MacroProgressTargets;
  interactive?: boolean;
  className?: string;
}

interface SegmentSpec {
  key: string;
  pct: number;
  className: string;
  minWidthPx?: number;
}

function toPct(val: number, denom: number): number {
  if (denom <= 0 || val <= 0) return 0;
  return Math.min(100, (val / denom) * 100);
}

interface MacroColumnCellProps {
  label: string;
  labelClassName: string;
  current: number;
  target: number;
  trackClassName: string;
  segments: SegmentSpec[];
  subRows?: SubNutrientRowSpec[];
  align?: 'start' | 'end';
  interactive: boolean;
}

function MacroColumnCell({
  label,
  labelClassName,
  current,
  target,
  trackClassName,
  segments,
  subRows,
  align = 'start',
  interactive,
}: MacroColumnCellProps) {
  const hasSub = Boolean(subRows?.some((row) => typeof row.value === 'number'));
  const canInteract = interactive && hasSub;

  const visibleSegments = segments.filter((seg) => seg.pct > 0);

  const cellContent = (
    <div
      className={cn(
        'w-full h-full min-w-0 p-3 sm:p-4 space-y-1 transition-colors select-none',
        canInteract && 'cursor-pointer hover:bg-hover'
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={cn('text-xs font-medium truncate whitespace-nowrap', labelClassName)}>
          {label}
        </span>
        {hasSub && (
          <span
            className="size-1 rounded-full bg-border shrink-0"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="text-sm sm:text-base tracking-tight flex items-baseline whitespace-nowrap">
        <MetricValue
          value={Math.round(current)}
          unit="g"
          valueClassName="font-normal text-foreground"
          unitClassName="text-2xs"
        />
        <span className="text-2xs sm:text-xs font-sans text-muted-foreground mx-0.5">/</span>
        <MetricValue
          value={target}
          unit="g"
          className="text-2xs sm:text-xs text-muted-foreground"
          valueClassName="font-normal"
          unitClassName="text-3xs"
        />
      </div>

      <div className={cn('h-2 w-full rounded-full overflow-hidden mt-2 flex items-stretch', trackClassName)}>
        {visibleSegments.map((seg, idx) => (
          <div
            key={seg.key}
            className={cn(
              'h-full transition-[width] duration-200',
              idx > 0 && 'border-l-[1.5px] border-card',
              seg.minWidthPx && 'shrink-0',
              seg.className
            )}
            style={{
              width: `${seg.pct}%`,
              ...(seg.minWidthPx ? { minWidth: `${seg.minWidthPx}px` } : {}),
            }}
          />
        ))}
      </div>
    </div>
  );

  if (!canInteract || !subRows) {
    return cellContent;
  }

  return (
    <div className="w-full h-full min-w-0">
      <SubNutrientsPopover
        rows={subRows}
        align={align}
        positionerClassName="z-[80]"
        triggerClassName="w-full h-full min-w-0"
      >
        {cellContent}
      </SubNutrientsPopover>
    </div>
  );
}

/**
 * 單一真理源：三大元素（碳 / 蛋 / 脂）三欄進度條矩陣（方案 A）
 * 共用於總覽首頁（DashboardView）與飲食頁面（DietView）：
 * 1. 嚴格固定順序：碳水化合物 -> 蛋白質 -> 脂肪 (C -> P -> F)
 * 2. 進度條內嵌 1.5px 縫隙分隔，膳食纖維採高對比斜線紋理避免與底軌撞色
 * 3. 反式脂肪設 3px 最小可見寬度
 * 4. 支援桌面懸停與點擊展開 Popover 檢視精確次要元素克數
 */
export const MacroProgressGrid = React.memo(function MacroProgressGrid({
  totals,
  targetMacros,
  interactive = true,
  className,
}: MacroProgressGridProps) {
  const { t } = useTranslation();

  // 碳水化合物分段計算
  const carbsDenom = Math.max(targetMacros.carbsGrams, totals.carbs);
  const sugarVal = typeof totals.sugar === 'number' ? Math.max(0, totals.sugar) : 0;
  const fiberVal = typeof totals.fiber === 'number' ? Math.max(0, totals.fiber) : 0;
  const boundedSugar = Math.min(sugarVal, totals.carbs);
  const boundedFiber = Math.min(fiberVal, Math.max(0, totals.carbs - boundedSugar));
  const otherCarbs = Math.max(0, totals.carbs - boundedSugar - boundedFiber);

  return (
    <div className={cn('grid grid-cols-3 divide-x divide-border border-t border-border', className)}>
      {/* 1. 碳水化合物 */}
      <MacroColumnCell
        label={t('dietPlan.carbsShort', '碳水')}
        labelClassName="text-carbs"
        current={totals.carbs}
        target={targetMacros.carbsGrams}
        trackClassName="bg-carbs-subtle"
        align="start"
        interactive={interactive}
        segments={[
          {
            key: 'sugar',
            pct: toPct(boundedSugar, carbsDenom),
            className: 'bg-carbs-dark',
            minWidthPx: boundedSugar > 0 ? 4 : undefined,
          },
          {
            key: 'fiber',
            pct: toPct(boundedFiber, carbsDenom),
            className: 'bg-fiber-stripe',
            minWidthPx: boundedFiber > 0 ? 4 : undefined,
          },
          { key: 'other', pct: toPct(otherCarbs, carbsDenom), className: 'bg-carbs' },
        ]}
        subRows={buildCarbsSubRows(t, totals.sugar, totals.fiber)}
      />

      {/* 2. 蛋白質 */}
      <MacroColumnCell
        label={t('dietPlan.proteinShort', '蛋白質')}
        labelClassName="text-protein"
        current={totals.protein}
        target={targetMacros.proteinGrams}
        trackClassName="bg-protein-subtle"
        interactive={interactive}
        segments={[
          { key: 'protein', pct: toPct(totals.protein, targetMacros.proteinGrams), className: 'bg-protein' },
        ]}
      />

      {/* 3. 脂肪 */}
      <MacroColumnCell
        label={t('dietPlan.fatShort', '脂肪')}
        labelClassName="text-fat"
        current={totals.fat}
        target={targetMacros.fatGrams}
        trackClassName="bg-fat-subtle"
        interactive={interactive}
        segments={[
          { key: 'fat', pct: toPct(totals.fat, targetMacros.fatGrams), className: 'bg-fat' },
        ]}
      />
    </div>
  );
});
