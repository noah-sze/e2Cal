import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { APP_ROUTES } from '@/utils/navigation';
import {
  Dialog,
  PrecisionDialogContent,
} from '@/components/ui/dialog';
import { NumericKeypadDialog } from '@/components/ui/NumericKeypadDialog';
import { HoldToDeleteButton } from '@/components/ui/HoldToDeleteButton';
import { db } from '@/services/db/db';
import type { HydratedFoodLog, FoodItem } from '@/types';
import { formatDisplayAmount } from '@/lib/utils';
import { triggerHaptic } from '@/lib/haptics';
import { calculateIngredientMacros } from '@/utils/recipeMath';
import { evaluateNutritionalHighlight } from '@/utils/nutritionEvaluation';
import { resolveFoodLogTitle } from '@/utils/foodNaming';
import { NutritionFactsCard, type NutritionFactsData } from '@/components/food/NutritionFactsCard';
import { MetricValue } from '@/components/ui/metric-value';
import { getInMemoryFoodsCache, prewarmFoodsCache } from '@/hooks/useFoods';
import { prewarmRecipesCache } from '@/hooks/useRecipes';
import { prewarmDailyDietLogsCache } from '@/hooks/useFoodLogs';

export interface EditFoodLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: HydratedFoodLog | null;
  onSave: (
    id: string,
    updates: {
      quantity?: number;
      calories?: number;
      carbs?: number;
      protein?: number;
      fat?: number;
      foodName?: string;
      scenario?: string;
      customTitle?: string;
    }
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function EditFoodLogDialog({
  open,
  onOpenChange,
  log,
  onSave,
  onDelete,
}: EditFoodLogDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // 本地狀態：用量與基準食材資訊
  const [quantity, setQuantity] = useState<number>(log?.quantity || 100);
  const [baseFood, setBaseFood] = useState<FoodItem | null>(() => {
    if (!log?.foodId) return null;
    return getInMemoryFoodsCache()?.find((f) => f.id === log.foodId) ?? null;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSystemEntry = Boolean(
    log?.entryType === 'as_planned' ||
    log?.entryType === 'estimate' ||
    log?.isAsPlanned ||
    log?.isPlaceholder
  );

  // 數字鍵盤狀態
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [keypadInitialQuantity, setKeypadInitialQuantity] = useState<number>(quantity);
  const initialQuantityRef = useRef<number>(quantity);
  const isKeypadConfirmedRef = useRef(false);

  // 當 log 變更時同步初始狀態與查詢原食物實體，並預熱詳情頁所需快取
  useEffect(() => {
    if (log && open) {
      const safeQty = isSystemEntry ? (log.quantity ?? 1) : (log.quantity ?? 100);
      setQuantity(safeQty);
      initialQuantityRef.current = safeQty;

      void prewarmFoodsCache();
      void prewarmRecipesCache();
      void prewarmDailyDietLogsCache();

      if (!isSystemEntry && log.foodId) {
        const cached = getInMemoryFoodsCache()?.find((f) => f.id === log.foodId);
        if (cached) {
          setBaseFood(cached);
        }
        db.foods.get(log.foodId).then((food) => {
          if (food) {
            setBaseFood(food);
          } else if (!cached) {
            setBaseFood(null);
          }
        });
      } else {
        setBaseFood(null);
      }
    }
  }, [log, open, isSystemEntry]);

  // 動態推算即時營養素 (包含微量元素)
  const nutritionFactsData = useMemo<NutritionFactsData | null>(() => {
    if (!log) {
      return null;
    }

    // 系統條目 (歷史均值 / 快速估算) 無物理克數，直接原樣呈現既有數值，嚴禁等比縮放
    if (isSystemEntry) {
      return {
        servingSize: log.quantity || 1,
        servingUnit: log.unit || '份',
        calories: Math.round(log.calories || 0),
        carbs: Math.round((log.carbs || 0) * 10) / 10,
        protein: Math.round((log.protein || 0) * 10) / 10,
        fat: Math.round((log.fat || 0) * 10) / 10,
      };
    }

    if (baseFood) {
      const macros = calculateIngredientMacros(baseFood, quantity);
      return {
        servingSize: quantity,
        servingUnit: log.unit || baseFood.servingUnit || 'g',
        calories: macros.calories,
        carbs: macros.carbs,
        protein: macros.protein,
        fat: macros.fat,
        sugar: macros.sugar,
        fiber: macros.fiber,
        saturatedFat: macros.saturatedFat,
        transFat: macros.transFat,
        sodium: macros.sodium,
      };
    }

    // 若無原始 FoodItem 定義，依原記錄等比縮放
    const baseQty = log.quantity || 1;
    const ratio = quantity / baseQty;
    return {
      servingSize: quantity,
      servingUnit: log.unit || 'g',
      calories: Math.round((log.calories || 0) * ratio),
      carbs: Math.round((log.carbs || 0) * ratio * 10) / 10,
      protein: Math.round((log.protein || 0) * ratio * 10) / 10,
      fat: Math.round((log.fat || 0) * ratio * 10) / 10,
    };
  }, [log, isSystemEntry, baseFood, quantity]);

  // 營養素高亮狀態推算 (依據當前份量動態推算)
  const evalHighlights = useMemo(() => {
    if (!nutritionFactsData) return undefined;
    return evaluateNutritionalHighlight({
      calories: nutritionFactsData.calories,
      carbs: nutritionFactsData.carbs,
      protein: nutritionFactsData.protein,
      fat: nutritionFactsData.fat,
      servingSize: nutritionFactsData.servingSize,
      servingUnit: nutritionFactsData.servingUnit,
      category: baseFood?.category,
    }).highlights;
  }, [nutritionFactsData, baseFood?.category]);

  // 打開數字鍵盤
  const handleOpenKeypad = (el: HTMLElement) => {
    triggerHaptic('selection');
    setAnchorEl(el);
    setKeypadInitialQuantity(quantity);
    initialQuantityRef.current = quantity;
    isKeypadConfirmedRef.current = false;
    setIsKeypadOpen(true);
  };

  // 數字鍵盤即時鏡像聯動
  const handleKeypadLiveChange = useCallback((val: number) => {
    setQuantity(val > 0 ? val : 0);
  }, []);

  // 數字鍵盤確認
  const handleKeypadConfirm = useCallback((val: number) => {
    isKeypadConfirmedRef.current = true;
    setQuantity(val > 0 ? val : 1);
    setIsKeypadOpen(false);
  }, []);

  // 數字鍵盤取消
  const handleKeypadCancel = useCallback(() => {
    if (isKeypadConfirmedRef.current) return;
    setQuantity(initialQuantityRef.current);
    setIsKeypadOpen(false);
  }, []);

  // 主彈窗開關保護 (若次級鍵盤開啟中，阻斷關閉)
  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isKeypadOpen) {
      return;
    }
    onOpenChange(nextOpen);
  };

  // 送出保存
  const handleSubmit = async () => {
    if (!log || isSubmitting || (!isSystemEntry && quantity <= 0)) return;
    setIsSubmitting(true);
    try {
      await onSave(log.id, {
        ...(isSystemEntry ? {} : { quantity: quantity > 0 ? quantity : 1 }),
        calories: nutritionFactsData?.calories ?? 0,
        carbs: nutritionFactsData?.carbs ?? 0,
        protein: nutritionFactsData?.protein ?? 0,
        fat: nutritionFactsData?.fat ?? 0,
      });
      triggerHaptic('success');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 刪除記錄
  const handleDelete = async () => {
    if (!log || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onDelete(log.id);
      triggerHaptic('medium');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!log) return null;

  const dialogTitle = log ? resolveFoodLogTitle(log, t, baseFood) : '';
  const canNavigateToFood = !isSystemEntry && Boolean(log.foodId && baseFood);

  const handleTitleClick = () => {
    if (!canNavigateToFood || !log.foodId) return;
    triggerHaptic('selection');
    onOpenChange(false);
    navigate(APP_ROUTES.foodDetail(log.foodId));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <PrecisionDialogContent
          title={dialogTitle}
          onTitleClick={canNavigateToFood ? handleTitleClick : undefined}
          onSubmit={handleSubmit}
          submitDisabled={isSubmitting || (!isSystemEntry && quantity <= 0)}
          submitAriaLabel={t('common.save')}
          cancelAriaLabel={t('common.cancel')}
          overlayClassName="z-[70]"
          className="z-[70] flex flex-col max-h-[85vh] overflow-hidden"
          initialFocus={false}
        >
          {/* 表單主體 (支援滑動檢視完整營養素) */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3 pt-3.5 pr-0.5">
            {/* 即時營養成分卡片 (共用通用規格卡片，下方已有份量調整故隱藏基準行) */}
            <NutritionFactsCard
              title={t('diet.servingNutrients', '營養成分')}
              data={nutritionFactsData}
              highlights={evalHighlights}
              action={null}
              showServingRow={false}
            />

            {/* 食用份量調節卡片 (實體食材條目) */}
            {!isSystemEntry && (
              <div className="h-11 px-3.5 flex items-center justify-between border border-border rounded-lg bg-card text-sm shrink-0">
                <span className="text-muted-foreground text-xs font-sans">
                  {t('diet.serving', '食用份量')}
                </span>

                {/* e2Cal 專案標準數字輸入框膠囊 */}
                <button
                  type="button"
                  onClick={(e) => handleOpenKeypad(e.currentTarget)}
                  className="h-7 px-2.5 rounded-full border border-border/80 bg-background hover:bg-hover font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 select-none"
                  title={t('diet.clickToEnter', '點擊輸入數值')}
                >
                  <MetricValue
                    value={formatDisplayAmount(String(quantity)) || '0'}
                    unit={log.unit || 'g'}
                    valueClassName="font-normal text-foreground"
                    unitClassName="text-[11px]"
                  />
                  <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                </button>
              </div>
            )}

            {/* 底部破壞性按鈕 (長按 0.5s 防誤觸刪除) */}
            <HoldToDeleteButton
              onConfirm={handleDelete}
              disabled={isSubmitting}
              text={t('common.delete', '刪除')}
            />
          </div>
        </PrecisionDialogContent>
      </Dialog>

      {/* 次級懸浮鍵盤 (平級兄弟節點聲明，層級 zIndex={70} 高於主彈窗) */}
      {isKeypadOpen && (
        <NumericKeypadDialog
          open={isKeypadOpen}
          onOpenChange={(kOpen) => {
            if (!kOpen) {
              if (!isKeypadConfirmedRef.current) {
                handleKeypadCancel();
              } else {
                setIsKeypadOpen(false);
              }
            }
          }}
          title={dialogTitle}
          value={keypadInitialQuantity}
          unit={log.unit || 'g'}
          allowDecimals={true}
          maxDecimals={2}
          anchorEl={anchorEl}
          onLiveChange={handleKeypadLiveChange}
          onConfirm={handleKeypadConfirm}
          onCancel={handleKeypadCancel}
        />
      )}
    </>
  );
}
