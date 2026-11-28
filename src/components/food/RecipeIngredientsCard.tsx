import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { WeighingAmountPill } from '@/components/diet/WeighingAmountPill';
import { MacroSquares } from '@/components/food/MacroSquares';
import { useUnitPreferences } from '@/hooks/useUnitPreferences';
import { formatEnergy, formatFoodServing } from '@/utils/unitMath';
import type { NutritionEvaluationResult } from '@/utils/nutritionEvaluation';
import { cn } from '@/lib/utils';

export interface RecipeIngredientItem {
  id: string;
  foodId?: string;
  foodName: string;
  quantity: number;
  grossQuantity?: number;
  unit: string;
  isOptional?: boolean;
  /** 單項計算後營養素（用於詳情頁副標與 MacroSquares 展示） */
  macros?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    sugar?: number;
    fiber?: number;
    saturatedFat?: number;
    transFat?: number;
  };
  /** 高／低熱量與三大營養素高亮評價結果 */
  evalResult?: NutritionEvaluationResult;
}

export interface RecipeIngredientsCardProps {
  items: RecipeIngredientItem[];
  title?: string;
  /** 是否於標題右側顯示項目數 (N) */
  showCount?: boolean;
  /**
   * 顯示模式：
   * - 'detail'：食譜詳情頁模式（顯示 份量 · 熱量 副標與右側 MacroSquares，點擊整行觸發 onItemClick）
   * - 'edit'：彈窗編輯模式（緊湊列高，點擊名稱觸發 onReplaceItem，右側用量膠囊觸發 onEditQuantity）
   */
  mode?: 'detail' | 'edit';
  /** 新增食物按鈕回調（提供時於右上角顯示「+ 新增食物」膠囊） */
  onAddIngredient?: () => void;
  /** 詳情模式：點擊整行觸發 */
  onItemClick?: (item: RecipeIngredientItem, index: number) => void;
  /** 編輯模式：點擊左側名稱替換食物 */
  onReplaceItem?: (item: RecipeIngredientItem, index: number) => void;
  /** 編輯模式：點擊右側用量膠囊開啟數字鍵盤 */
  onEditQuantity?: (item: RecipeIngredientItem, index: number, anchorEl: HTMLElement) => void;
  /** 編輯模式：點擊右側刪除按鈕移除食物 */
  onRemoveItem?: (item: RecipeIngredientItem, index: number) => void;
  className?: string;
}

/**
 * 單一真理源：構成食物清單卡片元件
 * 共用於「食譜詳情頁（RecipeDetails）」與「菜餚／食譜彈窗（RecipeDialog）」，
 * 統一 SectionCard 內嵌表頭、新增食物膠囊與條目列表規範。
 */
export function RecipeIngredientsCard({
  items,
  title,
  showCount = false,
  mode = 'detail',
  onAddIngredient,
  onItemClick,
  onReplaceItem,
  onEditQuantity,
  onRemoveItem,
  className,
}: RecipeIngredientsCardProps) {
  const { t } = useTranslation();
  const { foodWeightUnit, foodVolumeUnit, energyUnit } = useUnitPreferences();

  const resolvedTitle = title ?? t('diet.recipeIngredients', '構成食物');
  const displayTitle = showCount ? `${resolvedTitle} (${items.length})` : resolvedTitle;

  const addButton = onAddIngredient ? (
    <button
      type="button"
      onClick={onAddIngredient}
      className="h-6 px-2.5 rounded-full border border-border/80 bg-card hover:bg-hover font-mono text-xs flex items-center gap-1 transition-colors cursor-pointer text-muted-foreground hover:text-foreground active:scale-95 select-none"
    >
      <Plus className="size-3 text-muted-foreground" />
      <span>{t('diet.addIngredient', '新增食物')}</span>
    </button>
  ) : undefined;

  return (
    <SectionCard
      title={displayTitle}
      action={addButton}
      className={className}
      bodyClassName="text-sm"
    >
      {items.length === 0 ? (
        <div className="min-h-12 py-2 px-3 sm:px-4 flex items-center justify-center shrink-0">
          {onAddIngredient ? (
            <button
              type="button"
              onClick={onAddIngredient}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none font-mono"
            >
              <Plus className="size-3.5" />
              <span>{t('diet.addIngredient', '新增食物')}</span>
            </button>
          ) : (
            <span className="text-xs text-muted-foreground font-mono">-</span>
          )}
        </div>
      ) : (
        items.map((item, idx) => {
          if (mode === 'edit') {
            return (
              <div
                key={item.id}
                className="min-h-12 py-2 px-3 sm:px-4 flex items-center justify-between gap-2 bg-card shrink-0"
              >
                {/* 左側：食物品名（點擊替換食物） */}
                <button
                  type="button"
                  onClick={() => onReplaceItem?.(item, idx)}
                  className="text-left min-w-0 flex-1 truncate text-xs font-normal text-foreground hover:opacity-75 transition-opacity cursor-pointer outline-none"
                  title={item.foodName}
                >
                  <span className="block truncate">{item.foodName || t('common.unknown')}</span>
                </button>

                {/* 右側：用量膠囊 + 刪除按鈕 */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <WeighingAmountPill
                    quantity={item.quantity}
                    grossQuantity={item.grossQuantity}
                    unit={item.unit}
                    emptyFallback="-"
                    onClick={(e) => onEditQuantity?.(item, idx, e.currentTarget)}
                  />
                  {onRemoveItem && (
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item, idx)}
                      className="size-7 rounded-full border border-border/80 bg-background flex items-center justify-center transition-colors shrink-0 text-muted-foreground hover:text-destructive hover:bg-hover cursor-pointer active:scale-95"
                      title={t('common.delete')}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          }

          // mode === 'detail'（食譜詳情頁模式）
          const macros = item.macros ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
          const isLowCalorie = item.evalResult?.labels.includes('low-calorie') ?? false;
          const isHighCalorie = item.evalResult?.labels.includes('high-calorie') ?? false;

          return (
            <div
              key={item.id}
              onClick={() => onItemClick?.(item, idx)}
              className="min-h-16 py-2.5 px-4 flex items-center justify-between hover:bg-hover transition-colors cursor-pointer group"
            >
              <div className="flex-1 min-w-0 pr-3 select-none">
                <div className="truncate text-foreground font-medium text-sm">
                  {item.foodName || t('common.unknown')}
                </div>
                <div className="text-2xs font-mono text-muted-foreground truncate mt-0.5 flex items-center gap-1.5">
                  <span>
                    {
                      formatFoodServing(
                        typeof item.grossQuantity === 'number' && item.grossQuantity > 0
                          ? item.grossQuantity
                          : item.quantity,
                        item.unit,
                        foodWeightUnit,
                        foodVolumeUnit
                      ).formatted
                    }
                  </span>
                  <span className="opacity-40">·</span>
                  <span
                    className={cn(
                      isLowCalorie &&
                        'text-emerald-500 px-1 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20',
                      isHighCalorie &&
                        'text-rose-500 px-1 py-0.5 rounded bg-rose-500/10 border border-rose-500/20'
                    )}
                  >
                    {formatEnergy(macros.calories, energyUnit).formatted}
                  </span>
                </div>
              </div>

              <div className="flex items-center shrink-0">
                <MacroSquares
                  protein={macros.protein}
                  carbs={macros.carbs}
                  fat={macros.fat}
                  sugar={item.macros?.sugar}
                  fiber={item.macros?.fiber}
                  saturatedFat={item.macros?.saturatedFat}
                  transFat={item.macros?.transFat}
                  highlights={item.evalResult?.highlights}
                />
              </div>
            </div>
          );
        })
      )}
    </SectionCard>
  );
}
