import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { NutritionBasisToggle } from '@/components/food/NutritionBasisToggle';
import {
  SubNutrientsPopover,
  buildCarbsSubRows,
  buildFatSubRows,
} from '@/components/food/SubNutrientsPopover';
import { MetricValue } from '@/components/ui/metric-value';
import { useUnitPreferences } from '@/hooks/useUnitPreferences';
import { formatEnergy, formatFoodServing } from '@/utils/unitMath';
import { evaluateNutritionalHighlight } from '@/utils/nutritionEvaluation';
import { cn } from '@/lib/utils';

export type NutritionField =
  | 'serving'
  | 'calories'
  | 'carbs'
  | 'sugar'
  | 'fiber'
  | 'protein'
  | 'fat'
  | 'saturatedFat'
  | 'transFat'
  | 'sodium';

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
  /** 卡片右側自訂動作元件，預設為 NutritionBasisToggle；傳入 null 則不渲染任何動作按鈕 */
  action?: React.ReactNode;
  /** 當前等比換算後的營養素數據 */
  data?: NutritionFactsData | null;
  /** 備用或基礎數據（當換算數據為空時自動 fallback） */
  fallbackData?: Partial<NutritionFactsData> | null;
  /** 核心宏量客觀標籤亮點高亮 */
  highlights?: {
    calories?: boolean;
    protein?: boolean;
    carbs?: boolean;
    fat?: boolean;
    sodium?: boolean;
  } | null;
  /** 首行基準標籤，預設為 t('diet.perLabelBasis', '每') */
  perLabel?: string;
  /** 是否顯示頂部表頭列，預設為 true */
  showHeader?: boolean;
  /** 是否顯示首行基準份量行（例如「每 100 g」），預設為 true */
  showServingRow?: boolean;
  /** 是否顯示熱量行，預設為 true */
  showCaloriesRow?: boolean;
  /** 是否顯示鈉指標行，預設為 false（減輕記錄心智負擔，預設隱藏鈉） */
  showSodiumRow?: boolean;
  /** 是否顯示脂肪次級指標（飽和脂肪、反式脂肪），預設為 false */
  showFatSub?: boolean;
  /** 碳水化合物次級指標初始展開狀態 */
  defaultCarbsExpanded?: boolean;
  /** 脂肪次級指標初始展開狀態 */
  defaultFatExpanded?: boolean;
  /**
   * 編輯/表單模式支援 (Editable Mode):
   * 傳入此物件後，各列右側數值將由 renderValue 接管渲染（例如渲染點擊開啟鍵盤的微型按鈕）
   */
  editable?: {
    renderValue: (field: NutritionField, defaultContent: React.ReactNode) => React.ReactNode;
    /** 在表單中即使次級指標為空也始終顯示 > 圖標以供展開填寫 */
    alwaysShowSubChevrons?: boolean;
    /** 次級編輯鍵盤開啟期間鎖定 Popover 不隨外部點擊關閉 */
    lockSubPopover?: boolean;
  };
  className?: string;
}

/**
 * 全域基準營養素規格卡片（單一真理源通用元件）
 * 適用於：食材詳情頁、食譜詳情頁、新增/編輯食材彈窗、食譜編輯彈窗。
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
  perLabel,
  showHeader = true,
  showServingRow = true,
  showCaloriesRow = true,
  showSodiumRow = false,
  showFatSub = false,
  editable,
  className,
}: NutritionFactsCardProps) {
  const { t } = useTranslation();
  const { foodWeightUnit, foodVolumeUnit, energyUnit } = useUnitPreferences();

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

  const hasCarbSub = Boolean(
    editable?.alwaysShowSubChevrons ||
    typeof sugarVal === 'number' ||
    typeof fiberVal === 'number'
  );
  const hasFatSub = Boolean(
    showFatSub &&
    (editable?.alwaysShowSubChevrons ||
      typeof satFatVal === 'number' ||
      typeof transFatVal === 'number')
  );

  // 智慧保底高亮狀態：若外部未顯式傳入 highlights，自動根據當前營養素推算客觀點亮狀態
  const effectiveHighlights: NutritionFactsCardProps['highlights'] = React.useMemo(() => {
    if (highlights !== undefined) return highlights;
    const res = evaluateNutritionalHighlight({
      calories,
      carbs,
      protein,
      fat,
      servingSize,
      servingUnit,
    });
    return {
      ...res.highlights,
      sodium: false,
    };
  }, [highlights, calories, carbs, protein, fat, servingSize, servingUnit]);

  const defaultAction = action !== undefined ? action : <NutritionBasisToggle />;

  return (
    <SectionCard
      title={title ?? t('diet.servingNutrients', '基準營養素')}
      action={defaultAction}
      showHeader={showHeader}
      bodyClassName="text-sm"
      className={className}
    >
      {/* 1. 每基準份量行 (h-10) */}
      {showServingRow && (
        <div className="h-10 px-4 flex items-center justify-between">
          <span className="text-muted-foreground text-xs">{perLabel ?? t('diet.perLabelBasis', '每')}</span>
          <div onClick={(e) => e.stopPropagation()}>
            {(() => {
              const s = formatFoodServing(servingSize, servingUnit, foodWeightUnit, foodVolumeUnit);
              const node = (
                <MetricValue
                  value={s.size}
                  unit={s.unit}
                  valueClassName="font-medium text-foreground text-xs"
                  unitClassName="text-xs"
                />
              );
              return editable ? editable.renderValue('serving', node) : node;
            })()}
          </div>
        </div>
      )}

      {/* 2. 熱量行 (h-10) */}
      {showCaloriesRow && (
        <div
          className={cn(
            "h-10 px-4 flex items-center justify-between transition-colors",
            effectiveHighlights?.calories && "bg-calories-subtle-bg"
          )}
        >
          <span className="text-calories text-xs font-medium">{t('diet.calories')}</span>
          <div onClick={(e) => e.stopPropagation()}>
            {(() => {
              const e = formatEnergy(calories, energyUnit);
              const node = (
                <MetricValue
                  value={e.value.toLocaleString()}
                  unit={e.unit}
                  valueClassName="font-medium text-calories text-xs"
                  unitClassName="text-xs"
                />
              );
              return editable ? editable.renderValue('calories', node) : node;
            })()}
          </div>
        </div>
      )}

      {/* 3. 碳水化合物行 (h-10) */}
      {hasCarbSub ? (
        <SubNutrientsPopover
          align="start"
          alignOffset={16}
          positionerClassName="z-[70]"
          lockOpen={Boolean(editable?.lockSubPopover)}
          rows={buildCarbsSubRows(t, sugarVal, fiberVal).map((row, idx) => ({
            ...row,
            renderValue: editable
              ? (node) => editable.renderValue(idx === 0 ? 'sugar' : 'fiber', node)
              : undefined,
          }))}
        >
          {({ open }) => (
            <div
              className={cn(
                "h-10 px-4 flex items-center justify-between transition-colors select-none cursor-pointer hover:bg-hover",
                effectiveHighlights?.carbs && "bg-carbs-subtle-bg"
              )}
            >
              <div className="flex items-center gap-1">
                <span className="text-carbs text-xs font-medium">{t('diet.carbs')}</span>
                <ChevronRight
                  className={cn(
                    "size-3 text-carbs/60 transition-transform duration-150",
                    open && "rotate-90 text-carbs"
                  )}
                />
              </div>

              <div
                onClick={(e) => {
                  if (editable) {
                    e.stopPropagation();
                  }
                }}
              >
                {(() => {
                  const node = (
                    <MetricValue
                      value={carbs}
                      unit="g"
                      valueClassName="font-medium text-carbs text-xs"
                      unitClassName="text-xs"
                    />
                  );
                  return editable ? editable.renderValue('carbs', node) : node;
                })()}
              </div>
            </div>
          )}
        </SubNutrientsPopover>
      ) : (
        <div
          className={cn(
            "h-10 px-4 flex items-center justify-between transition-colors select-none",
            effectiveHighlights?.carbs && "bg-carbs-subtle-bg"
          )}
        >
          <span className="text-carbs text-xs font-medium">{t('diet.carbs')}</span>
          <div>
            {(() => {
              const node = (
                <MetricValue
                  value={carbs}
                  unit="g"
                  valueClassName="font-medium text-carbs text-xs"
                  unitClassName="text-xs"
                />
              );
              return editable ? editable.renderValue('carbs', node) : node;
            })()}
          </div>
        </div>
      )}

      {/* 4. 蛋白質行 (h-10) */}
      <div
        className={cn(
          "h-10 px-4 flex items-center justify-between transition-colors",
          effectiveHighlights?.protein && "bg-protein-subtle-bg"
        )}
      >
        <span className="text-protein text-xs font-medium">{t('diet.protein')}</span>
        <div onClick={(e) => e.stopPropagation()}>
          {(() => {
            const node = (
              <MetricValue
                value={protein}
                unit="g"
                valueClassName="font-medium text-protein text-xs"
                unitClassName="text-xs"
              />
            );
            return editable ? editable.renderValue('protein', node) : node;
          })()}
        </div>
      </div>

      {/* 5. 脂肪行 (h-10) */}
      {hasFatSub ? (
        <SubNutrientsPopover
          align="start"
          alignOffset={16}
          positionerClassName="z-[70]"
          lockOpen={Boolean(editable?.lockSubPopover)}
          rows={buildFatSubRows(t, satFatVal, transFatVal).map((row, idx) => ({
            ...row,
            renderValue: editable
              ? (node) => editable.renderValue(idx === 0 ? 'saturatedFat' : 'transFat', node)
              : undefined,
          }))}
        >
          {({ open }) => (
            <div
              className={cn(
                "h-10 px-4 flex items-center justify-between transition-colors select-none cursor-pointer hover:bg-hover",
                effectiveHighlights?.fat && "bg-fat-subtle-bg"
              )}
            >
              <div className="flex items-center gap-1">
                <span className="text-fat text-xs font-medium">{t('diet.fat')}</span>
                <ChevronRight
                  className={cn(
                    "size-3 text-fat/60 transition-transform duration-150",
                    open && "rotate-90 text-fat"
                  )}
                />
              </div>

              <div
                onClick={(e) => {
                  if (editable) {
                    e.stopPropagation();
                  }
                }}
              >
                {(() => {
                  const node = (
                    <MetricValue
                      value={fat}
                      unit="g"
                      valueClassName="font-medium text-fat text-xs"
                      unitClassName="text-xs"
                    />
                  );
                  return editable ? editable.renderValue('fat', node) : node;
                })()}
              </div>
            </div>
          )}
        </SubNutrientsPopover>
      ) : (
        <div
          className={cn(
            "h-10 px-4 flex items-center justify-between transition-colors select-none",
            effectiveHighlights?.fat && "bg-fat-subtle-bg"
          )}
        >
          <span className="text-fat text-xs font-medium">{t('diet.fat')}</span>
          <div>
            {(() => {
              const node = (
                <MetricValue
                  value={fat}
                  unit="g"
                  valueClassName="font-medium text-fat text-xs"
                  unitClassName="text-xs"
                />
              );
              return editable ? editable.renderValue('fat', node) : node;
            })()}
          </div>
        </div>
      )}

      {/* 6. 鈉獨立指標行 (h-10) */}
      {showSodiumRow && (
        <div
          className={cn(
            "h-10 px-4 flex items-center justify-between transition-colors",
            effectiveHighlights?.sodium && "bg-sodium-subtle-bg"
          )}
        >
          <span className="text-sodium text-xs font-medium">{t('diet.sodium')}</span>
          <div onClick={(e) => e.stopPropagation()}>
            {(() => {
              const node = typeof sodiumVal === 'number' ? (
                <MetricValue
                  value={sodiumVal}
                  unit="mg"
                  valueClassName="font-medium text-sodium text-xs"
                  unitClassName="text-xs"
                />
              ) : (
                <span className="text-muted-foreground/40 select-none font-mono text-xs">-</span>
              );
              return editable ? editable.renderValue('sodium', node) : node;
            })()}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
