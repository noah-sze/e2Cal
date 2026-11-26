import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Check } from 'lucide-react';
import { Dialog, PrecisionDialogContent } from '@/components/ui/dialog';
import { triggerHaptic } from '@/lib/haptics';
import { SectionCard } from '@/components/ui/section-card';
import { MetricValue } from '@/components/ui/metric-value';
import { NutritionFactsCard } from '@/components/food/NutritionFactsCard';
import {
  getCachedAuthorityFood,
  findAuthorityFood,
} from '@/services/authorityFoodService';
import type { FoodItem, FoodMicronutrients } from '@/types';

export interface AuthorityFoodDetailsDialogProps {
  food: FoodItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 若提供，於標頭右上角顯示添加按鈕（未導入顯示 +，已導入顯示 ✓） */
  onAdd?: (food: FoodItem) => void;
  /** 標記該食物是否已在食物庫 */
  isImported?: boolean;
  overlayClassName?: string;
  className?: string;
}

interface MicronutrientItemConfig {
  key: keyof FoodMicronutrients;
  unit: string;
}

const MICRONUTRIENT_CONFIG: MicronutrientItemConfig[] = [
  // 電解質與礦物質
  { key: 'potassium', unit: 'mg' },
  { key: 'calcium', unit: 'mg' },
  { key: 'magnesium', unit: 'mg' },
  { key: 'iron', unit: 'mg' },
  { key: 'zinc', unit: 'mg' },
  { key: 'selenium', unit: 'mcg' },

  // 維生素群
  { key: 'vitaminA', unit: 'mcg' },
  { key: 'vitaminC', unit: 'mg' },
  { key: 'vitaminD', unit: 'mcg' },
  { key: 'vitaminE', unit: 'mg' },
  { key: 'vitaminB1', unit: 'mg' },
  { key: 'vitaminB2', unit: 'mg' },
  { key: 'vitaminB3', unit: 'mg' },
  { key: 'vitaminB6', unit: 'mg' },
  { key: 'vitaminB12', unit: 'mcg' },
  { key: 'folate', unit: 'mcg' },

  // 脂類與其他生物活性物
  { key: 'cholesterol', unit: 'mg' },
  { key: 'omega3EPA', unit: 'g' },
  { key: 'omega3DHA', unit: 'g' },
  { key: 'omega3ALA', unit: 'g' },
  { key: 'leucine', unit: 'mg' },
];

/**
 * 食物元素數據詳細彈窗 (Authority Food Elements & Micronutrients Dialog)
 * 嚴格符合 e2Cal 核心準則：
 * 1. 鎖定標準 320px 寬度、16px 緊湊邊距、0 陰影、Instant Pop。
 * 2. 宏量與次級營養素遵循 C -> P -> F 核心律動。
 * 3. 完整溯源權威科研資料庫（USDA / MEXT / TFDA / CFCT）憑證與可食部損耗率。
 */
export function AuthorityFoodDetailsDialog({
  food,
  open,
  onOpenChange,
  onAdd,
  isImported = false,
  overlayClassName,
  className,
}: AuthorityFoodDetailsDialogProps) {
  const { t } = useTranslation();

  // 始終查找並展示權威科研庫的官方原始 100g 數據，不受使用者自訂份量或編輯影響
  const cachedRaw = getCachedAuthorityFood(
    food.id,
    food.dataSource?.authority,
    food.dataSource?.sourceId
  );
  const [fetchedRaw, setFetchedRaw] = useState<FoodItem | undefined>(cachedRaw);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const syncMatch = getCachedAuthorityFood(
      food.id,
      food.dataSource?.authority,
      food.dataSource?.sourceId
    );
    if (syncMatch) {
      setFetchedRaw(syncMatch);
      return;
    }
    if (food.dataSource) {
      findAuthorityFood(
        food.id,
        food.dataSource.authority,
        food.dataSource.sourceId
      ).then((matched) => {
        if (active && matched) {
          setFetchedRaw(matched);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [open, food.id, food.dataSource]);

  const rawFood = fetchedRaw ?? food;

  const dataSource = rawFood.dataSource ?? food.dataSource;
  const micros = rawFood.micros ?? food.micros;
  const refuseRate = rawFood.refuseRate ?? food.refuseRate ?? 0;
  const edibleRate = rawFood.edibleRate ?? food.edibleRate ?? 1.0;

  // 始終以每 100g/100ml 的 macros 為唯一真理源展示
  const displayNutrition = useMemo(() => {
    const source = fetchedRaw ?? food;
    const baseUnit = source.servingUnit || (source.category === 'beverage' ? 'ml' : 'g');
    return {
      servingSize: 100,
      servingUnit: baseUnit,
      calories: source.macros.calories,
      carbs: source.macros.carbs.total,
      protein: source.macros.protein,
      fat: source.macros.fat.total,
      fiber: source.macros.carbs.fiber,
      sugar: source.macros.carbs.sugar,
      saturatedFat: source.macros.fat.saturated,
      transFat: source.macros.fat.trans,
      sodium: source.macros.sodium,
    };
  }, [fetchedRaw, food]);

  // 過濾具有測定記錄的微量營養素
  const activeMicros = useMemo(() => {
    if (!micros) return [];
    return MICRONUTRIENT_CONFIG.filter(
      ({ key }) => micros[key] !== undefined && micros[key] !== null
    );
  }, [micros]);

  const headerRightAction = onAdd ? (
    isImported ? (
      <span
        title={t('diet.importedShort')}
        aria-label={t('diet.importedShort')}
        className="size-7 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 inline-flex items-center justify-center select-none shrink-0"
      >
        <Check className="size-3.5" strokeWidth={2.2} />
      </span>
    ) : (
      <button
        type="button"
        onClick={() => {
          triggerHaptic('selection');
          onAdd(fetchedRaw ?? food);
        }}
        title={t('diet.importShort')}
        aria-label={t('diet.importShort')}
        className="size-7 rounded-full border border-border bg-card text-foreground hover:border-foreground hover:bg-hover active:scale-95 transition-all cursor-pointer inline-flex items-center justify-center shrink-0"
      >
        <Plus className="size-3.5" />
      </button>
    )
  ) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PrecisionDialogContent
        title={t('diet.authorityDetails.title')}
        onClose={() => onOpenChange(false)}
        cancelAriaLabel={t('common.close')}
        rightAction={headerRightAction}
        overlayClassName={overlayClassName}
        className={className}
      >
        <div className="pt-3.5 pb-0 space-y-3 select-none max-h-[70vh] overflow-y-auto pr-0.5">
          {/* 1. 權威來源憑證卡片 */}
          {dataSource && (
            <SectionCard
              title={t('diet.authorityDetails.sourceSection')}
              bodyClassName="text-xs font-sans"
            >
              <div className="min-h-9 py-2 px-3.5 flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs shrink-0">
                  {t('diet.authorityDetails.authority')}
                </span>
                <span className="text-foreground font-medium text-right text-xs">
                  {t(
                    `diet.authorityDetails.authorities.${dataSource.authority}`,
                    dataSource.authority
                  )}
                </span>
              </div>

              <div className="min-h-9 py-2 px-3.5 flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs shrink-0">
                  {t('diet.authorityDetails.sourceId')}
                </span>
                <span className="text-foreground font-mono text-xs text-right">
                  {dataSource.sourceId}
                </span>
              </div>

              {dataSource.sourceName && (
                <div className="min-h-9 py-2 px-3.5 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">
                    {t('diet.authorityDetails.sourceName')}
                  </span>
                  <span
                    className="text-foreground text-xs text-right truncate max-w-[170px]"
                    title={dataSource.sourceName}
                  >
                    {dataSource.sourceName}
                  </span>
                </div>
              )}

              {dataSource.authority && (
                <div className="min-h-9 py-2 px-3.5 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">
                    {t('diet.authorityDetails.edition')}
                  </span>
                  <span className="text-foreground font-mono text-xs text-right">
                    {t(`diet.authorityDetails.editions.${dataSource.authority}`, '')}
                  </span>
                </div>
              )}

              <div className="min-h-9 py-2 px-3.5 flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs shrink-0">
                  {t('diet.authorityDetails.standardBasis')}
                </span>
                <span className="inline-flex items-baseline gap-1.5 text-foreground text-xs text-right">
                  <span>{t('diet.authoritySpecUnitPrefix', '每')}</span>
                  <MetricValue value={100} unit="g" unitClassName="text-foreground" />
                  <span>{t('diet.authoritySpecUnitSuffix', '純可食部')}</span>
                </span>
              </div>

              {refuseRate > 0 && (
                <div className="min-h-9 py-2 px-3.5 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">
                    {t('diet.authorityDetails.refuseRate')}
                  </span>
                  <MetricValue
                    value={Math.round(refuseRate * 100)}
                    unit="%"
                    className="text-foreground shrink-0"
                  />
                </div>
              )}

              <div className="min-h-9 py-2 px-3.5 flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs shrink-0">
                  {t('diet.authorityDetails.edibleRate')}
                </span>
                <MetricValue
                  value={Math.round(edibleRate * 100)}
                  unit="%"
                  className="text-foreground shrink-0"
                />
              </div>
            </SectionCard>
          )}

          {/* 2. 核心與次級營養素 (統一由 NutritionFactsCard 渲染，始終顯示官方 100g 原值) */}
          <NutritionFactsCard
            title={t('diet.authorityDetails.macrosSection')}
            action={null}
            showFatSub={true}
            data={displayNutrition}
          />

          {/* 3. 微量元素與礦物質 */}
          <SectionCard
            title={t('diet.authorityDetails.microsSection')}
            bodyClassName="text-xs font-sans"
          >
            {activeMicros.length > 0 ? (
              activeMicros.map(({ key, unit }: MicronutrientItemConfig) => {
                const val = micros![key];
                return (
                  <div
                    key={key}
                    className="h-10 px-4 flex items-center justify-between gap-2"
                  >
                    <span className="text-muted-foreground truncate">
                      {t(`diet.authorityDetails.micros.${key}`)}
                    </span>
                    <MetricValue
                      value={Number(val).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                      unit={unit}
                      className="text-foreground shrink-0"
                    />
                  </div>
                );
              })
            ) : (
              <div className="py-4 px-3 text-center text-xs font-mono text-muted-foreground">
                {t('diet.authorityDetails.noMicros')}
              </div>
            )}
          </SectionCard>
        </div>
      </PrecisionDialogContent>
    </Dialog>
  );
}
