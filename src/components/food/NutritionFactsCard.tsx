import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { NutritionBasisToggle } from '@/components/food/NutritionBasisToggle';
import { useUnitPreferences } from '@/hooks/useUnitPreferences';
import { formatEnergy, formatFoodServing } from '@/utils/unitMath';
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
  } | null;
  /** 首行基準標籤，預設為 t('diet.perLabelBasis', '每') */
  perLabel?: string;
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
  defaultCarbsExpanded,
  defaultFatExpanded,
  editable,
  className,
}: NutritionFactsCardProps) {
  const { t } = useTranslation();
  const { foodWeightUnit, foodVolumeUnit, energyUnit } = useUnitPreferences();

  const [isCarbsExpanded, setIsCarbsExpanded] = useState(defaultCarbsExpanded ?? false);
  const [isFatExpanded, setIsFatExpanded] = useState(defaultFatExpanded ?? false);

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
    editable?.alwaysShowSubChevrons ||
    typeof satFatVal === 'number' ||
    typeof transFatVal === 'number'
  );

  const defaultAction = action !== undefined ? action : <NutritionBasisToggle />;

  return (
    <SectionCard
      title={title ?? t('diet.servingNutrients', '基準營養素')}
      action={defaultAction}
      bodyClassName="text-sm"
      className={className}
    >
      {/* 1. 每基準份量行 (h-10) */}
      <div className="h-10 px-4 flex items-center justify-between">
        <span className="text-muted-foreground text-xs">{perLabel ?? t('diet.perLabelBasis', '每')}</span>
        <div onClick={(e) => e.stopPropagation()}>
          {editable ? (
            editable.renderValue(
              'serving',
              <span className="font-mono text-foreground font-medium text-xs tabular-nums whitespace-nowrap">
                {formatFoodServing(servingSize, servingUnit, foodWeightUnit, foodVolumeUnit).formatted}
              </span>
            )
          ) : (
            <span className="font-mono text-foreground font-medium text-xs tabular-nums whitespace-nowrap">
              {formatFoodServing(servingSize, servingUnit, foodWeightUnit, foodVolumeUnit).formatted}
            </span>
          )}
        </div>
      </div>

      {/* 2. 熱量行 (h-10) */}
      <div
        className={cn(
          "h-10 px-4 flex items-center justify-between transition-colors",
          highlights?.calories && "bg-calories-subtle-bg"
        )}
      >
        <span className="text-calories text-xs font-medium">{t('diet.calories')}</span>
        <div onClick={(e) => e.stopPropagation()}>
          {editable ? (
            editable.renderValue(
              'calories',
              <span className="font-mono text-calories font-medium text-xs tabular-nums whitespace-nowrap">
                {formatEnergy(calories, energyUnit).formatted}
              </span>
            )
          ) : (
            <span className="font-mono text-calories font-medium text-xs tabular-nums whitespace-nowrap">
              {formatEnergy(calories, energyUnit).formatted}
            </span>
          )}
        </div>
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
            <span className="text-carbs text-xs font-medium">{t('diet.carbs')}</span>
            {hasCarbSub && (
              <ChevronRight
                className={cn(
                  "size-3 text-muted-foreground/50 transition-transform duration-200",
                  isCarbsExpanded && "rotate-90"
                )}
              />
            )}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            {editable ? (
              editable.renderValue(
                'carbs',
                <span className="font-mono text-carbs font-medium text-xs tabular-nums whitespace-nowrap">
                  {carbs} g
                </span>
              )
            ) : (
              <span className="font-mono text-carbs font-medium text-xs tabular-nums whitespace-nowrap">
                {carbs} g
              </span>
            )}
          </div>
        </div>

        {hasCarbSub && isCarbsExpanded && (
          <div className="px-4 pb-2.5 pt-0.5 space-y-1 text-xs font-mono text-muted-foreground">
            {/* 糖 */}
            <div className="relative pl-6 py-0.5 min-h-8 flex items-center justify-between">
              <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />
              <div className="absolute left-2.5 top-1/2 w-2.5 h-px bg-border" />
              <span className="font-sans text-muted-foreground text-xs">{t('diet.sugar')}</span>
              <div onClick={(e) => e.stopPropagation()}>
                {editable ? (
                  editable.renderValue(
                    'sugar',
                    <span className="tabular-nums whitespace-nowrap text-foreground/80">
                      {typeof sugarVal === 'number' ? (
                        `${sugarVal} g`
                      ) : (
                        <span className="text-muted-foreground/40 select-none font-mono">-</span>
                      )}
                    </span>
                  )
                ) : (
                  <span className="tabular-nums whitespace-nowrap text-foreground/80">
                    {typeof sugarVal === 'number' ? (
                      `${sugarVal} g`
                    ) : (
                      <span className="text-muted-foreground/40 select-none font-mono">-</span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* 膳食纖維 */}
            <div className="relative pl-6 py-0.5 min-h-8 flex items-center justify-between">
              <div className="absolute left-2.5 top-0 h-1/2 w-2.5 border-l border-b border-border rounded-bl-[3px]" />
              <span className="font-sans text-muted-foreground text-xs">{t('diet.fiber')}</span>
              <div onClick={(e) => e.stopPropagation()}>
                {editable ? (
                  editable.renderValue(
                    'fiber',
                    <span className="tabular-nums whitespace-nowrap text-foreground/80">
                      {typeof fiberVal === 'number' ? (
                        `${fiberVal} g`
                      ) : (
                        <span className="text-muted-foreground/40 select-none font-mono">-</span>
                      )}
                    </span>
                  )
                ) : (
                  <span className="tabular-nums whitespace-nowrap text-foreground/80">
                    {typeof fiberVal === 'number' ? (
                      `${fiberVal} g`
                    ) : (
                      <span className="text-muted-foreground/40 select-none font-mono">-</span>
                    )}
                  </span>
                )}
              </div>
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
        <span className="text-protein text-xs font-medium">{t('diet.protein')}</span>
        <div onClick={(e) => e.stopPropagation()}>
          {editable ? (
            editable.renderValue(
              'protein',
              <span className="font-mono text-protein font-medium text-xs tabular-nums whitespace-nowrap">
                {protein} g
              </span>
            )
          ) : (
            <span className="font-mono text-protein font-medium text-xs tabular-nums whitespace-nowrap">
              {protein} g
            </span>
          )}
        </div>
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
            <span className="text-fat text-xs font-medium">{t('diet.fat')}</span>
            {hasFatSub && (
              <ChevronRight
                className={cn(
                  "size-3 text-muted-foreground/50 transition-transform duration-200",
                  isFatExpanded && "rotate-90"
                )}
              />
            )}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            {editable ? (
              editable.renderValue(
                'fat',
                <span className="font-mono text-fat font-medium text-xs tabular-nums whitespace-nowrap">
                  {fat} g
                </span>
              )
            ) : (
              <span className="font-mono text-fat font-medium text-xs tabular-nums whitespace-nowrap">
                {fat} g
              </span>
            )}
          </div>
        </div>

        {hasFatSub && isFatExpanded && (
          <div className="px-4 pb-2.5 pt-0.5 space-y-1 text-xs font-mono text-muted-foreground">
            {/* 飽和脂肪 */}
            <div className="relative pl-6 py-0.5 min-h-8 flex items-center justify-between">
              <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />
              <div className="absolute left-2.5 top-1/2 w-2.5 h-px bg-border" />
              <span className="font-sans text-muted-foreground text-xs">{t('diet.saturatedFat')}</span>
              <div onClick={(e) => e.stopPropagation()}>
                {editable ? (
                  editable.renderValue(
                    'saturatedFat',
                    <span className="tabular-nums whitespace-nowrap text-foreground/80">
                      {typeof satFatVal === 'number' ? (
                        `${satFatVal} g`
                      ) : (
                        <span className="text-muted-foreground/40 select-none font-mono">-</span>
                      )}
                    </span>
                  )
                ) : (
                  <span className="tabular-nums whitespace-nowrap text-foreground/80">
                    {typeof satFatVal === 'number' ? (
                      `${satFatVal} g`
                    ) : (
                      <span className="text-muted-foreground/40 select-none font-mono">-</span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* 反式脂肪 */}
            <div className="relative pl-6 py-0.5 min-h-8 flex items-center justify-between">
              <div className="absolute left-2.5 top-0 h-1/2 w-2.5 border-l border-b border-border rounded-bl-[3px]" />
              <span className="font-sans text-muted-foreground text-xs">{t('diet.transFat')}</span>
              <div onClick={(e) => e.stopPropagation()}>
                {editable ? (
                  editable.renderValue(
                    'transFat',
                    <span className="tabular-nums whitespace-nowrap text-foreground/80">
                      {typeof transFatVal === 'number' ? (
                        `${transFatVal} g`
                      ) : (
                        <span className="text-muted-foreground/40 select-none font-mono">-</span>
                      )}
                    </span>
                  )
                ) : (
                  <span className="tabular-nums whitespace-nowrap text-foreground/80">
                    {typeof transFatVal === 'number' ? (
                      `${transFatVal} g`
                    ) : (
                      <span className="text-muted-foreground/40 select-none font-mono">-</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. 鈉獨立指標行 (h-10) */}
      <div className="h-10 px-4 flex items-center justify-between">
        <span className="text-foreground text-xs font-medium">{t('diet.sodium')}</span>
        <div onClick={(e) => e.stopPropagation()}>
          {editable ? (
            editable.renderValue(
              'sodium',
              <span className="font-mono text-foreground font-medium text-xs tabular-nums whitespace-nowrap">
                {typeof sodiumVal === 'number' ? (
                  `${sodiumVal} mg`
                ) : (
                  <span className="text-muted-foreground/40 select-none font-mono">-</span>
                )}
              </span>
            )
          ) : (
            <span className="font-mono text-foreground font-medium text-xs tabular-nums whitespace-nowrap">
              {typeof sodiumVal === 'number' ? (
                `${sodiumVal} mg`
              ) : (
                <span className="text-muted-foreground/40 select-none font-mono">-</span>
              )}
            </span>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
