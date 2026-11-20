import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { NutritionBasisToggle } from '@/components/food/NutritionBasisToggle';
import { useUnitPreferences } from '@/hooks/useUnitPreferences';
import { formatEnergy, formatFoodServing } from '@/utils/unitMath';
import { cn } from '@/lib/utils';

export interface NutritionFactsData {
  servingSize?: number;
  servingUnit?: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  sugar?: number | null;
  fiber?: number | null;
  saturatedFat?: number | null;
  transFat?: number | null;
  sodium?: number | null;
}

export interface NutritionFactsCardProps {
  /** 卡片標題，預設為「基準營養素」 */
  title?: string;
  /** 卡片右側自訂動作元件，預設為 NutritionBasisToggle */
  action?: React.ReactNode;
  /** 當前等比換算後的營養素數據 */
  data: NutritionFactsData | null | undefined;
  /** 備用或基礎數據（當換算數據為空時自動 fallback） */
  fallbackData?: Partial<NutritionFactsData> | null;
  /** 核心宏量客觀標籤亮點高亮 */
  highlights?: {
    calories?: boolean;
    protein?: boolean;
    carbs?: boolean;
    fat?: boolean;
  } | null;
  className?: string;
}

/**
 * 全域基準營養素規格卡片（單一真理源通用元件）
 * 嚴格遵循 e2Cal 視覺與排版標準：
 * 1. 嚴格三大營養素 C -> P -> F 排序
 * 2. 份量標籤統一為「每」
 * 3. 預設每行極致規整 h-10 (40px)
 * 4. 漸進式展開次級指標：以簡潔 > 圖標旋轉折疊，展開後呈現 CSS 實體連續 1px 導軌樹
 */
export function NutritionFactsCard({
  title,
  action,
  data,
  fallbackData,
  highlights,
  className,
}: NutritionFactsCardProps) {
  const { t } = useTranslation();
  const { foodWeightUnit, foodVolumeUnit, energyUnit } = useUnitPreferences();

  const [isCarbsExpanded, setIsCarbsExpanded] = useState(false);
  const [isFatExpanded, setIsFatExpanded] = useState(false);

  const servingSize = data?.servingSize ?? fallbackData?.servingSize ?? 100;
  const servingUnit = data?.servingUnit ?? fallbackData?.servingUnit ?? 'g';
  const calories = data?.calories ?? fallbackData?.calories ?? 0;
  const carbs = data?.carbs ?? fallbackData?.carbs ?? 0;
  const protein = data?.protein ?? fallbackData?.protein ?? 0;
  const fat = data?.fat ?? fallbackData?.fat ?? 0;

  const sugarVal = data?.sugar ?? fallbackData?.sugar;
  const fiberVal = data?.fiber ?? fallbackData?.fiber;
  const satFatVal = data?.saturatedFat ?? fallbackData?.saturatedFat;
  const transFatVal = data?.transFat ?? fallbackData?.transFat;
  const sodiumVal = data?.sodium ?? fallbackData?.sodium;

  const hasCarbSub = typeof sugarVal === 'number' || typeof fiberVal === 'number';
  const hasFatSub = typeof satFatVal === 'number' || typeof transFatVal === 'number';

  return (
    <SectionCard
      title={title ?? t('diet.servingNutrients', '基準營養素')}
      action={action ?? <NutritionBasisToggle />}
      bodyClassName="text-sm"
      className={className}
    >
      {/* 1. 每基準份量行 (h-10) */}
      <div className="h-10 px-4 flex items-center justify-between">
        <span className="text-muted-foreground">{t('diet.perLabelBasis', '每')}</span>
        <span className="font-mono text-foreground font-medium tabular-nums whitespace-nowrap">
          {formatFoodServing(servingSize, servingUnit, foodWeightUnit, foodVolumeUnit).formatted}
        </span>
      </div>

      {/* 2. 熱量行 (h-10) */}
      <div
        className={cn(
          "h-10 px-4 flex items-center justify-between transition-colors",
          highlights?.calories && "bg-calories-subtle-bg"
        )}
      >
        <span className="text-calories font-medium">{t('diet.calories')}</span>
        <span className="font-mono text-calories font-medium tabular-nums whitespace-nowrap">
          {formatEnergy(calories, energyUnit).formatted}
        </span>
      </div>

      {/* 3. 碳水化合物複合區塊 (折疊 h-10，展開後帶實體導軌樹) */}
      <div
        className={cn(
          "transition-colors",
          highlights?.carbs && "bg-carbs-subtle-bg"
        )}
      >
        <div
          className={cn(
            "h-10 px-4 flex items-center justify-between transition-colors",
            hasCarbSub && "cursor-pointer select-none hover:bg-hover"
          )}
          onClick={hasCarbSub ? () => setIsCarbsExpanded((prev) => !prev) : undefined}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-carbs font-medium">{t('diet.carbs')}</span>
            {hasCarbSub && (
              <ChevronRight
                className={cn(
                  "size-3 text-muted-foreground/50 transition-transform duration-200",
                  isCarbsExpanded && "rotate-90"
                )}
              />
            )}
          </div>
          <span className="font-mono text-carbs font-medium tabular-nums whitespace-nowrap">
            {carbs} g
          </span>
        </div>

        {hasCarbSub && isCarbsExpanded && (
          <div className="px-4 pb-2.5 pt-0.5 space-y-1 text-xs font-mono text-muted-foreground">
            {/* 糖 */}
            <div className="relative pl-6 py-0.5 flex items-center justify-between">
              <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />
              <div className="absolute left-2.5 top-1/2 w-2.5 h-px bg-border" />
              <span className="font-sans text-muted-foreground text-xs">{t('diet.sugar')}</span>
              <span className="tabular-nums whitespace-nowrap text-foreground/80">
                {typeof sugarVal === 'number' ? (
                  `${sugarVal} g`
                ) : (
                  <span className="text-muted-foreground/40 select-none font-mono">-</span>
                )}
              </span>
            </div>

            {/* 膳食纖維 */}
            <div className="relative pl-6 py-0.5 flex items-center justify-between">
              <div className="absolute left-2.5 top-0 h-1/2 w-2.5 border-l border-b border-border rounded-bl-[3px]" />
              <span className="font-sans text-muted-foreground text-xs">{t('diet.fiber')}</span>
              <span className="tabular-nums whitespace-nowrap text-foreground/80">
                {typeof fiberVal === 'number' ? (
                  `${fiberVal} g`
                ) : (
                  <span className="text-muted-foreground/40 select-none font-mono">-</span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4. 蛋白質行 (h-10) */}
      <div
        className={cn(
          "h-10 px-4 flex items-center justify-between transition-colors",
          highlights?.protein && "bg-protein-subtle-bg"
        )}
      >
        <span className="text-protein font-medium">{t('diet.protein')}</span>
        <span className="font-mono text-protein font-medium tabular-nums whitespace-nowrap">
          {protein} g
        </span>
      </div>

      {/* 5. 脂肪複合區塊 (折疊 h-10，展開後帶實體導軌樹) */}
      <div
        className={cn(
          "transition-colors",
          highlights?.fat && "bg-fat-subtle-bg"
        )}
      >
        <div
          className={cn(
            "h-10 px-4 flex items-center justify-between transition-colors",
            hasFatSub && "cursor-pointer select-none hover:bg-hover"
          )}
          onClick={hasFatSub ? () => setIsFatExpanded((prev) => !prev) : undefined}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-fat font-medium">{t('diet.fat')}</span>
            {hasFatSub && (
              <ChevronRight
                className={cn(
                  "size-3 text-muted-foreground/50 transition-transform duration-200",
                  isFatExpanded && "rotate-90"
                )}
              />
            )}
          </div>
          <span className="font-mono text-fat font-medium tabular-nums whitespace-nowrap">
            {fat} g
          </span>
        </div>

        {hasFatSub && isFatExpanded && (
          <div className="px-4 pb-2.5 pt-0.5 space-y-1 text-xs font-mono text-muted-foreground">
            {/* 飽和脂肪 */}
            <div className="relative pl-6 py-0.5 flex items-center justify-between">
              <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />
              <div className="absolute left-2.5 top-1/2 w-2.5 h-px bg-border" />
              <span className="font-sans text-muted-foreground text-xs">{t('diet.saturatedFat')}</span>
              <span className="tabular-nums whitespace-nowrap text-foreground/80">
                {typeof satFatVal === 'number' ? (
                  `${satFatVal} g`
                ) : (
                  <span className="text-muted-foreground/40 select-none font-mono">-</span>
                )}
              </span>
            </div>

            {/* 反式脂肪 */}
            <div className="relative pl-6 py-0.5 flex items-center justify-between">
              <div className="absolute left-2.5 top-0 h-1/2 w-2.5 border-l border-b border-border rounded-bl-[3px]" />
              <span className="font-sans text-muted-foreground text-xs">{t('diet.transFat')}</span>
              <span className="tabular-nums whitespace-nowrap text-foreground/80">
                {typeof transFatVal === 'number' ? (
                  `${transFatVal} g`
                ) : (
                  <span className="text-muted-foreground/40 select-none font-mono">-</span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 6. 鈉獨立指標行 (h-10) */}
      <div className="h-10 px-4 flex items-center justify-between">
        <span className="text-foreground font-medium">{t('diet.sodium')}</span>
        <span className="font-mono text-foreground font-medium tabular-nums whitespace-nowrap">
          {typeof sodiumVal === 'number' ? (
            `${sodiumVal} mg`
          ) : (
            <span className="text-muted-foreground/40 select-none font-mono">-</span>
          )}
        </span>
      </div>
    </SectionCard>
  );
}
