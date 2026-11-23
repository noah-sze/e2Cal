import React, { useMemo } from 'react';
import { evaluateNutritionalHighlight } from '@/utils/nutritionEvaluation';
import { useTranslation } from 'react-i18next';
import { MetricValue } from '@/components/ui/metric-value';
import { AutoMarquee } from '@/components/ui/AutoMarquee';
import {
  SubNutrientsPopover,
  buildCarbsSubRows,
  type SubNutrientRowSpec,
} from '@/components/food/SubNutrientsPopover';
import { cn } from '@/lib/utils';

export interface MacroHighlights {
  protein?: boolean;
  carbs?: boolean;
  fat?: boolean;
}

export interface MacroSquaresProps {
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number | null;
  fiber?: number | null;
  saturatedFat?: number | null;
  transFat?: number | null;
  highlights?: MacroHighlights;
  variant?: 'default' | 'subtle';
  dashed?: boolean;
  className?: string;
  /**
   * 是否啟用手機端自適應緊湊堆疊（方案 H）
   * @default true
   * 當為 true 時，在手機版 (< 768px / md) 自動渲染垂直三階微堆疊，桌面版 (>= 768px / md) 渲染等寬方塊矩陣
   */
  responsive?: boolean;
}

interface MacroSquareCellProps {
  label: string;
  value: number;
  isHighlighted?: boolean;
  isSubtle: boolean;
  dashed: boolean;
  accent: 'carbs' | 'protein' | 'fat';
  subRows?: SubNutrientRowSpec[];
}

interface MacroStackRowProps {
  label: string;
  value: number;
  isHighlighted?: boolean;
  accent: 'carbs' | 'protein' | 'fat';
}

const ACCENT_CLASSES = {
  carbs: {
    subtleBox: 'border-carbs-subtle-border bg-carbs-subtle-bg text-foreground shadow-none',
    defaultBox: 'border-carbs bg-carbs-subtle text-foreground shadow-none',
    subtleText: 'text-carbs/65 font-medium',
    defaultText: 'text-carbs font-semibold',
  },
  protein: {
    subtleBox: 'border-protein-subtle-border bg-protein-subtle-bg text-foreground shadow-none',
    defaultBox: 'border-protein bg-protein-subtle text-foreground shadow-none',
    subtleText: 'text-protein/65 font-medium',
    defaultText: 'text-protein font-semibold',
  },
  fat: {
    subtleBox: 'border-fat-subtle-border bg-fat-subtle-bg text-foreground shadow-none',
    defaultBox: 'border-fat bg-fat-subtle text-foreground shadow-none',
    subtleText: 'text-fat/65 font-medium',
    defaultText: 'text-fat font-semibold',
  },
} as const;

function MacroStackRow({
  label,
  value,
  isHighlighted,
  accent,
}: MacroStackRowProps) {
  const styles = ACCENT_CLASSES[accent];

  return (
    <div
      title={`${label}: ${value}g`}
      aria-label={`${label}: ${value}g`}
      className="flex items-center justify-between w-full gap-1 leading-tight select-none"
    >
      <div className="w-2 flex items-center justify-center shrink-0">
        <span
          className={cn(
            'size-1.5 rounded-full',
            accent === 'carbs' && 'bg-carbs',
            accent === 'protein' && 'bg-protein',
            accent === 'fat' && 'bg-fat'
          )}
          aria-hidden="true"
        />
      </div>
      <div className="flex-1 flex items-baseline justify-end">
        <MetricValue
          value={value}
          unit="g"
          valueClassName={cn(
            'text-[10px] font-mono tabular-nums',
            isHighlighted ? styles.defaultText : 'text-muted-foreground'
          )}
          unitClassName="text-[8px]"
        />
      </div>
    </div>
  );
}

function MacroSquareCell({
  label,
  value,
  isHighlighted,
  isSubtle,
  dashed,
  accent,
  subRows,
}: MacroSquareCellProps) {
  const hasSub = Boolean(subRows?.some((row) => typeof row.value === 'number'));
  const styles = ACCENT_CLASSES[accent];

  const squareBody = (
    <div
      className={cn(
        'relative w-11 py-1 px-0.5 rounded border transition-all overflow-hidden',
        dashed && 'border-dashed',
        hasSub && 'cursor-pointer',
        isHighlighted
          ? isSubtle
            ? styles.subtleBox
            : styles.defaultBox
          : 'border-border bg-muted/30 text-foreground'
      )}
    >
      {hasSub && (
        <span
          className="absolute top-1 right-1 size-[3px] rounded-full bg-border"
          aria-hidden="true"
        />
      )}
      <div
        className={cn(
          'text-[9px] uppercase tracking-wider select-none',
          isHighlighted
            ? isSubtle
              ? styles.subtleText
              : styles.defaultText
            : 'text-muted-foreground'
        )}
      >
        {label}
      </div>
      <AutoMarquee className="text-xs leading-tight" align="center">
        <MetricValue value={value} unit="g" unitClassName="text-[10px]" />
      </AutoMarquee>
    </div>
  );

  if (!hasSub || !subRows) {
    return squareBody;
  }

  return (
    <SubNutrientsPopover
      rows={subRows}
      align="end"
      positionerClassName="z-[90]"
    >
      {squareBody}
    </SubNutrientsPopover>
  );
}

/**
 * 領域共用模式：三大元素（碳 / 蛋 / 脂）三列等寬營養素方塊矩陣
 * 嚴格遵循 Design System 規範：
 * - 固定順序：碳水化合物 (碳)、蛋白質 (蛋)、脂肪 (脂)
 * - 等寬 w-11 (44px)
 * - 等寬字體 font-mono
 * - 支援滑鼠懸停與點擊展開碳水（糖 / 膳食纖維）與脂肪（飽和脂肪 / 反式脂肪）次要元素 Popover
 * - 支援 variant: default (食材管理頁面高飽和) 與 subtle (首頁微光減噪)
 */
export const MacroSquares = React.memo(function MacroSquares({
  protein,
  carbs,
  fat,
  sugar,
  fiber,
  highlights,
  variant = 'default',
  dashed = false,
  className,
  responsive = true,
}: MacroSquaresProps) {
  const { t } = useTranslation();
  const isSubtle = variant === 'subtle';

  // 智慧保底自評估：若外部未顯式傳入 highlights，依據三大素數值自動計算客觀點亮狀態
  const resolvedHighlights = useMemo(() => {
    if (highlights !== undefined) return highlights;
    return evaluateNutritionalHighlight({
      calories: carbs * 4 + protein * 4 + fat * 9,
      carbs,
      protein,
      fat,
    }).highlights;
  }, [highlights, carbs, protein, fat]);

  const carbsSubRows = useMemo(
    () => buildCarbsSubRows(t, sugar, fiber),
    [t, sugar, fiber]
  );

  return (
    <div className={cn('shrink-0 flex items-center font-mono', className)}>
      {/* 手機版：方案 H 垂直三階微堆疊 (僅於 < 768px / md 呈現) */}
      <div
        className={cn(
          'flex-col items-end justify-center font-mono text-[10px] leading-tight shrink-0 py-0.5 select-none gap-0.5 w-[50px]',
          responsive ? 'flex md:hidden' : 'hidden'
        )}
        aria-label={`${t('diet.macroMicro.carbs', '碳')}: ${carbs}g, ${t('diet.macroMicro.protein', '蛋')}: ${protein}g, ${t('diet.macroMicro.fat', '脂')}: ${fat}g`}
      >
        <MacroStackRow
          label={t('diet.macroMicro.carbs', '碳')}
          value={carbs}
          isHighlighted={resolvedHighlights?.carbs}
          accent="carbs"
        />
        <MacroStackRow
          label={t('diet.macroMicro.protein', '蛋')}
          value={protein}
          isHighlighted={resolvedHighlights?.protein}
          accent="protein"
        />
        <MacroStackRow
          label={t('diet.macroMicro.fat', '脂')}
          value={fat}
          isHighlighted={resolvedHighlights?.fat}
          accent="fat"
        />
      </div>

      {/* 桌面版：傳統三大等寬方塊矩陣 (>= 768px / md 呈現) */}
      <div
        className={cn(
          'items-center gap-2 font-mono text-center',
          responsive ? 'hidden md:flex' : 'flex'
        )}
      >
        <MacroSquareCell
          label={t('diet.macroMicro.carbs', '碳')}
          value={carbs}
          isHighlighted={resolvedHighlights?.carbs}
          isSubtle={isSubtle}
          dashed={dashed}
          accent="carbs"
          subRows={carbsSubRows}
        />
        <MacroSquareCell
          label={t('diet.macroMicro.protein', '蛋')}
          value={protein}
          isHighlighted={resolvedHighlights?.protein}
          isSubtle={isSubtle}
          dashed={dashed}
          accent="protein"
        />
        <MacroSquareCell
          label={t('diet.macroMicro.fat', '脂')}
          value={fat}
          isHighlighted={resolvedHighlights?.fat}
          isSubtle={isSubtle}
          dashed={dashed}
          accent="fat"
        />
      </div>
    </div>
  );
});
