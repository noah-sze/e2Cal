import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, PrecisionDialogContent } from '@/components/ui/dialog';
import { SectionCard } from '@/components/ui/section-card';
import { MetricValue } from '@/components/ui/metric-value';
import { DEFAULT_NATURAL_FOODS } from '@/services/db/defaultNaturalFoods';
import type { FoodItem, FoodMicronutrients } from '@/types';

export interface AuthorityFoodDetailsDialogProps {
  food: FoodItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
 * 食材元素數據詳細彈窗 (Authority Food Elements & Micronutrients Dialog)
 * 嚴格符合 e2Cal 核心準則：
 * 1. 鎖定標準 320px 寬度、16px 緊湊邊距、0 陰影、Instant Pop。
 * 2. 宏量與次級營養素遵循 C -> P -> F 核心律動。
 * 3. 完整溯源權威科研資料庫（USDA / MEXT / TFDA / CFCT）憑證與可食部損耗率。
 */
export function AuthorityFoodDetailsDialog({
  food,
  open,
  onOpenChange,
}: AuthorityFoodDetailsDialogProps) {
  const { t } = useTranslation();

  // 若目前 food 缺少元數據，嘗試自預設庫自然食材中回填對齊
  const defaultItem = useMemo(() => {
    if (food.dataSource && food.micros) return null;
    return DEFAULT_NATURAL_FOODS.find((f) => f.id === food.id) || null;
  }, [food.id, food.dataSource, food.micros]);

  const dataSource = food.dataSource || defaultItem?.dataSource;
  const micros = food.micros || defaultItem?.micros;
  const refuseRate = food.refuseRate ?? defaultItem?.refuseRate ?? 0;
  const edibleRate = food.edibleRate ?? defaultItem?.edibleRate ?? 1.0;
  const refuseDescription = food.refuseDescription ?? defaultItem?.refuseDescription;

  // 過濾具有測定記錄的微量營養素
  const activeMicros = useMemo(() => {
    if (!micros) return [];
    return MICRONUTRIENT_CONFIG.filter(
      ({ key }) => micros[key] !== undefined && micros[key] !== null
    );
  }, [micros]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PrecisionDialogContent
        title={t('diet.authorityDetails.title')}
        onClose={() => onOpenChange(false)}
        cancelAriaLabel={t('common.close')}
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

              {dataSource.verifiedAt && (
                <div className="min-h-9 py-2 px-3.5 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">
                    {t('diet.authorityDetails.verifiedAt')}
                  </span>
                  <span className="text-foreground font-mono text-xs text-right">
                    {dataSource.verifiedAt}
                  </span>
                </div>
              )}

              <div className="min-h-9 py-2 px-3.5 flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs shrink-0">
                  {t('diet.authorityDetails.standardBasis')}
                </span>
                <span className="text-foreground text-xs text-right">
                  {t('diet.authorityDetails.standardBasisValue')}
                </span>
              </div>

              {refuseRate > 0 && (
                <div className="min-h-9 py-2 px-3.5 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">
                    {t('diet.authorityDetails.refuseRate')}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <MetricValue
                      value={Math.round(refuseRate * 100)}
                      unit="%"
                      className="text-foreground"
                    />
                    {refuseDescription && (
                      <span className="text-muted-foreground text-2xs truncate max-w-[120px]">
                        ({refuseDescription})
                      </span>
                    )}
                  </div>
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

          {/* 2. 核心與次級營養素 (C -> P -> F 律動) */}
          <SectionCard
            title={t('diet.authorityDetails.macrosSection')}
            bodyClassName="text-xs font-sans"
          >
            {/* 熱量 */}
            <div className="h-9 px-3.5 flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t('diet.calories')}</span>
              <MetricValue
                value={food.calories}
                unit="kcal"
                className="text-foreground shrink-0 font-medium"
              />
            </div>

            {/* 碳水化合物 */}
            <div className="h-9 px-3.5 flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t('diet.carbs')}</span>
              <MetricValue
                value={food.carbs}
                unit="g"
                className="text-foreground shrink-0"
              />
            </div>

            {/* 膳食纖維 */}
            {food.fiber !== undefined && food.fiber !== null && (
              <div className="h-8 px-3.5 flex items-center justify-between gap-2 bg-muted/20">
                <span className="text-muted-foreground/80 pl-3">└ {t('diet.fiber')}</span>
                <MetricValue
                  value={food.fiber}
                  unit="g"
                  className="text-muted-foreground shrink-0"
                />
              </div>
            )}

            {/* 糖 */}
            {food.sugar !== undefined && food.sugar !== null && (
              <div className="h-8 px-3.5 flex items-center justify-between gap-2 bg-muted/20">
                <span className="text-muted-foreground/80 pl-3">└ {t('diet.sugar')}</span>
                <MetricValue
                  value={food.sugar}
                  unit="g"
                  className="text-muted-foreground shrink-0"
                />
              </div>
            )}

            {/* 蛋白質 */}
            <div className="h-9 px-3.5 flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t('diet.protein')}</span>
              <MetricValue
                value={food.protein}
                unit="g"
                className="text-foreground shrink-0"
              />
            </div>

            {/* 脂肪 */}
            <div className="h-9 px-3.5 flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t('diet.fat')}</span>
              <MetricValue
                value={food.fat}
                unit="g"
                className="text-foreground shrink-0"
              />
            </div>

            {/* 飽和脂肪 */}
            {food.saturatedFat !== undefined && food.saturatedFat !== null && (
              <div className="h-8 px-3.5 flex items-center justify-between gap-2 bg-muted/20">
                <span className="text-muted-foreground/80 pl-3">└ {t('diet.saturatedFat')}</span>
                <MetricValue
                  value={food.saturatedFat}
                  unit="g"
                  className="text-muted-foreground shrink-0"
                />
              </div>
            )}

            {/* 反式脂肪 */}
            {food.transFat !== undefined && food.transFat !== null && (
              <div className="h-8 px-3.5 flex items-center justify-between gap-2 bg-muted/20">
                <span className="text-muted-foreground/80 pl-3">└ {t('diet.transFat')}</span>
                <MetricValue
                  value={food.transFat}
                  unit="g"
                  className="text-muted-foreground shrink-0"
                />
              </div>
            )}

            {/* 鈉 */}
            {food.sodium !== undefined && food.sodium !== null && (
              <div className="h-9 px-3.5 flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t('diet.sodium')}</span>
                <MetricValue
                  value={food.sodium}
                  unit="mg"
                  className="text-foreground shrink-0"
                />
              </div>
            )}
          </SectionCard>

          {/* 3. 微量元素與礦物質 */}
          <SectionCard
            title={t('diet.authorityDetails.microsSection')}
            bodyClassName="text-xs font-sans"
          >
            {activeMicros.length > 0 ? (
              activeMicros.map(({ key, unit }) => {
                const val = micros![key];
                return (
                  <div
                    key={key}
                    className="h-9 px-3.5 flex items-center justify-between gap-2"
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
