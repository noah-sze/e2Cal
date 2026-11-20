import React, { useMemo, useRef, useState, useEffect } from 'react';
import { evaluateNutritionalHighlight } from '@/utils/nutritionEvaluation';
import { useTranslation } from 'react-i18next';
import { MetricValue } from '@/components/ui/metric-value';
import { AutoMarquee } from '@/components/ui/AutoMarquee';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
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
}

interface SubNutrientRow {
  label: string;
  value?: number | null;
}

interface MacroSquareCellProps {
  label: string;
  value: number;
  isHighlighted?: boolean;
  isSubtle: boolean;
  dashed: boolean;
  accent: 'carbs' | 'protein' | 'fat';
  subRows?: SubNutrientRow[];
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
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const styles = ACCENT_CLASSES[accent];

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const handleMouseLeave = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
    }, 90);
  };

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={(props) => (
          <div
            {...props}
            role="button"
            tabIndex={0}
            onPointerEnter={(e) => {
              if (e.pointerType === 'mouse') handleMouseEnter();
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse') handleMouseLeave();
            }}
            onClick={(e) => {
              e.stopPropagation();
              clearCloseTimer();
              setOpen((prev) => !prev);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                setOpen((prev) => !prev);
              }
            }}
            className="outline-none"
          >
            {squareBody}
          </div>
        )}
      />
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={4}
        positionerClassName="z-[90]"
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') handleMouseEnter();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') handleMouseLeave();
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-44 p-1 gap-0 bg-popover text-popover-foreground border border-border shadow-none rounded-lg select-none font-mono"
      >
        <div className="space-y-0.5 text-xs">
          {subRows.map((row) => (
            <div
              key={row.label}
              className="h-8 flex items-center justify-between px-2 rounded hover:bg-hover transition-colors"
            >
              <span className="text-muted-foreground font-sans text-xs">{row.label}</span>
              {typeof row.value === 'number' ? (
                <MetricValue
                  value={row.value}
                  unit="g"
                  valueClassName="text-foreground/80 text-xs"
                  unitClassName="text-xs"
                />
              ) : (
                <span className="text-muted-foreground/40 select-none font-mono text-xs">-</span>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
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
  saturatedFat,
  transFat,
  highlights,
  variant = 'default',
  dashed = false,
  className,
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

  return (
    <div className={cn('shrink-0 flex items-center gap-2 font-mono text-center', className)}>
      <MacroSquareCell
        label={t('diet.macroMicro.carbs', '碳')}
        value={carbs}
        isHighlighted={resolvedHighlights?.carbs}
        isSubtle={isSubtle}
        dashed={dashed}
        accent="carbs"
        subRows={[
          { label: t('diet.sugar', '糖'), value: sugar },
          { label: t('diet.fiber', '膳食纖維'), value: fiber },
        ]}
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
        subRows={[
          { label: t('diet.saturatedFat', '飽和脂肪'), value: saturatedFat },
          { label: t('diet.transFat', '反式脂肪'), value: transFat },
        ]}
      />
    </div>
  );
});
