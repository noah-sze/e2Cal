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
import { formatDisplayAmount, parseKeypadDisplayAmount } from '@/lib/utils';
import { triggerHaptic } from '@/lib/haptics';
import { roundTo, gToOz, ozToG, flOzToMl, mlToFlOz } from '@/utils/unitMath';
import { useUnitPreferences } from '@/hooks/useUnitPreferences';
import { calculateEffectiveGrams, type WeighingForm } from '@/utils/nutritionMath';
import { calculateIngredientMacros } from '@/utils/recipeMath';
import { evaluateNutritionalHighlight } from '@/utils/nutritionEvaluation';
import { resolveFoodLogTitle } from '@/utils/foodNaming';
import { NutritionFactsCard, type NutritionFactsData } from '@/components/food/NutritionFactsCard';
import { MetricValue } from '@/components/ui/metric-value';
import { KeypadWeighingDisplayCard } from '@/components/diet/KeypadWeighingDisplayCard';
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
      grossQuantity?: number;
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

  // 本地狀態：用量與基準食物資訊
  const { energyUnit } = useUnitPreferences();
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
  const [weighingForm, setWeighingForm] = useState<WeighingForm>(
    log?.grossQuantity && log.grossQuantity > 0 ? 'gross' : 'net'
  );
  const [grossQuantity, setGrossQuantity] = useState<number | undefined>(log?.grossQuantity);
  const initialQuantityRef = useRef<number>(quantity);
  const initialGrossQuantityRef = useRef<number | undefined>(log?.grossQuantity);
  const isKeypadConfirmedRef = useRef(false);

  // 當 log 變更時同步初始狀態與查詢原食物實體，並預熱詳情頁所需快取
  useEffect(() => {
    if (log && open) {
      const safeQty = isSystemEntry ? (log.quantity ?? 1) : (log.quantity ?? 100);
      setQuantity(safeQty);
      setGrossQuantity(log.grossQuantity);
      if (log.grossQuantity && log.grossQuantity > 0) {
        setWeighingForm('gross');
      } else {
        setWeighingForm('net');
      }
      initialQuantityRef.current = safeQty;
      initialGrossQuantityRef.current = log.grossQuantity;

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
    const hasGross = Boolean(grossQuantity && grossQuantity > 0);
    const initialVal = hasGross && weighingForm === 'gross' ? (grossQuantity as number) : quantity;
    setKeypadInitialQuantity(initialVal);
    initialQuantityRef.current = quantity;
    initialGrossQuantityRef.current = grossQuantity;
    isKeypadConfirmedRef.current = false;
    setIsKeypadOpen(true);
  };

  // 數字鍵盤即時鏡像聯動
  const handleKeypadLiveChange = useCallback((val: number) => {
    const rawVal = val > 0 ? val : 0;
    if (weighingForm === 'gross' && Boolean(baseFood?.edibleRate && baseFood.edibleRate < 1)) {
      setQuantity(calculateEffectiveGrams(rawVal, 'gross', baseFood?.edibleRate));
      setGrossQuantity(rawVal);
    } else {
      setQuantity(rawVal);
      setGrossQuantity(undefined);
    }
  }, [weighingForm, baseFood?.edibleRate]);

  // 數字鍵盤確認
  const handleKeypadConfirm = useCallback((val: number) => {
    isKeypadConfirmedRef.current = true;
    const inputVal = val > 0 ? val : 1;
    if (weighingForm === 'gross' && Boolean(baseFood?.edibleRate && baseFood.edibleRate < 1)) {
      const effective = calculateEffectiveGrams(inputVal, 'gross', baseFood?.edibleRate);
      setQuantity(effective);
      setGrossQuantity(inputVal);
    } else {
      setQuantity(inputVal);
      setGrossQuantity(undefined);
    }
    setIsKeypadOpen(false);
  }, [weighingForm, baseFood?.edibleRate]);

  // 數字鍵盤取消
  const handleKeypadCancel = useCallback(() => {
    if (isKeypadConfirmedRef.current) return;
    setQuantity(initialQuantityRef.current);
    setGrossQuantity(initialGrossQuantityRef.current);
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
      const isGross = weighingForm === 'gross' && Boolean(grossQuantity && grossQuantity > 0);
      await onSave(log.id, {
        ...(isSystemEntry ? {} : { quantity: quantity > 0 ? quantity : 1 }),
        ...(isGross ? { grossQuantity } : { grossQuantity: undefined }),
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

  // 基準份量大小與單位 (用於加一份快捷按鈕)
  const currentUnit = log.unit || baseFood?.servingUnit || 'g';
  const baseServingSize = baseFood?.servingSize && baseFood.servingSize > 0 ? baseFood.servingSize : 100;
  const baseServingUnit = baseFood?.servingUnit || currentUnit;

  // 快捷步長數值 (依單位區分，公制 g/ml 為 50/100，英制 oz 為 1/2，kg 為 0.05/0.1)
  const isOunceUnit = currentUnit === 'oz' || currentUnit === 'fl oz' || currentUnit === 'floz';
  const isKgUnit = currentUnit === 'kg';
  const step1 = isOunceUnit ? 1 : isKgUnit ? 0.05 : 50;
  const step2 = isOunceUnit ? 2 : isKgUnit ? 0.1 : 100;

  // 共用增量邏輯：依當前稱重模式決定加在「毛重」或「淨重」上，並同步折算另一方
  const applyDelta = (delta: number) => {
    if (weighingForm === 'gross' && baseFood?.edibleRate && baseFood.edibleRate > 0 && baseFood.edibleRate < 1) {
      const currentGross = grossQuantity && grossQuantity > 0
        ? grossQuantity
        : roundTo(quantity / baseFood.edibleRate, 2);
      const nextGross = roundTo(currentGross + delta, 2);
      setGrossQuantity(nextGross);
      setQuantity(calculateEffectiveGrams(nextGross, 'gross', baseFood.edibleRate));
      return;
    }

    setQuantity((prev) => roundTo((prev || 0) + delta, 2));
  };

  // 快捷加一份處理 (單位若一致直接相加；若不一致則轉換)
  const handleAddOneServing = () => {
    triggerHaptic('light');
    let added = baseServingSize;
    if (baseServingUnit !== currentUnit) {
      if (baseServingUnit === 'g' && currentUnit === 'oz') {
        added = gToOz(baseServingSize);
      } else if (baseServingUnit === 'oz' && currentUnit === 'g') {
        added = ozToG(baseServingSize);
      } else if (baseServingUnit === 'ml' && (currentUnit === 'fl oz' || currentUnit === 'floz')) {
        added = mlToFlOz(baseServingSize);
      } else if ((baseServingUnit === 'fl oz' || baseServingUnit === 'floz') && currentUnit === 'ml') {
        added = flOzToMl(baseServingSize);
      }
    }
    applyDelta(added);
  };

  const handleMultiplyTwo = () => {
    triggerHaptic('light');
    if (weighingForm === 'gross' && grossQuantity && grossQuantity > 0) {
      const nextGross = roundTo(grossQuantity * 2, 2);
      setGrossQuantity(nextGross);
      setQuantity(calculateEffectiveGrams(nextGross, 'gross', baseFood?.edibleRate));
      return;
    }
    setQuantity((prev) => roundTo((prev || 0) * 2, 2));
  };

  const handleAddStep = (stepVal: number) => {
    triggerHaptic('light');
    applyDelta(stepVal);
  };

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

            {/* 食用份量調節與快捷增量複合卡片 (實體食物條目) */}
            {!isSystemEntry && (
              <div className="border border-border rounded-lg bg-card divide-y divide-border overflow-hidden shrink-0">
                {/* 1. 快捷增量操作按鈕組 (嚴格遵循微排版標準) */}
                <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={handleAddOneServing}
                    className="h-7 px-2.5 rounded-md border border-border/80 bg-background hover:bg-hover active:scale-95 text-xs text-foreground transition-colors whitespace-nowrap shrink-0 flex items-center select-none cursor-pointer"
                  >
                    <span className="text-muted-foreground font-mono mr-0.5">+</span>
                    <span className="font-sans mr-1">{t('diet.oneServingLabel', '1 份')}</span>
                    <span className="inline-flex items-center text-muted-foreground/50 font-sans text-xs">
                      (
                      <MetricValue
                        value={formatDisplayAmount(String(baseServingSize))}
                        unit={baseServingUnit}
                        valueClassName="font-normal text-muted-foreground/65 text-xs"
                        unitClassName="text-2xs text-muted-foreground/50"
                      />
                      )
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleMultiplyTwo}
                    className="h-7 px-2.5 rounded-md border border-border/80 bg-background hover:bg-hover active:scale-95 text-xs text-foreground font-mono transition-colors whitespace-nowrap shrink-0 flex items-center select-none cursor-pointer"
                  >
                    <span className="text-muted-foreground mr-0.5">×</span>
                    <span className="text-foreground tabular-nums">2</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddStep(step1)}
                    className="h-7 px-2.5 rounded-md border border-border/80 bg-background hover:bg-hover active:scale-95 text-xs text-foreground transition-colors whitespace-nowrap shrink-0 flex items-center select-none cursor-pointer"
                  >
                    <span className="text-muted-foreground font-mono mr-0.5">+</span>
                    <MetricValue
                      value={formatDisplayAmount(String(step1))}
                      unit={currentUnit}
                      valueClassName="font-normal text-foreground text-xs"
                      unitClassName="text-2xs"
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddStep(step2)}
                    className="h-7 px-2.5 rounded-md border border-border/80 bg-background hover:bg-hover active:scale-95 text-xs text-foreground transition-colors whitespace-nowrap shrink-0 flex items-center select-none cursor-pointer"
                  >
                    <span className="text-muted-foreground font-mono mr-0.5">+</span>
                    <MetricValue
                      value={formatDisplayAmount(String(step2))}
                      unit={currentUnit}
                      valueClassName="font-normal text-foreground text-xs"
                      unitClassName="text-2xs"
                    />
                  </button>
                </div>

                {/* 2. 份量顯示與數字鍵盤喚起按鈕 */}
                <div className="h-11 px-3.5 flex items-center justify-between">
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
                    {weighingForm === 'gross' && grossQuantity && grossQuantity > 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-2xs font-sans text-muted-foreground">
                          {t('diet.grossWeightLabel', '毛重')}
                        </span>
                        <span className="h-3 w-px bg-border/80 shrink-0" aria-hidden="true" />
                        <MetricValue
                          value={formatDisplayAmount(String(grossQuantity)) || '0'}
                          unit={log.unit || 'g'}
                          valueClassName="font-normal text-foreground"
                          unitClassName="text-2xs"
                        />
                      </span>
                    ) : (
                      <MetricValue
                        value={formatDisplayAmount(String(quantity)) || '0'}
                        unit={log.unit || 'g'}
                        valueClassName="font-normal text-foreground"
                        unitClassName="text-2xs"
                      />
                    )}
                    <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                  </button>
                </div>
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
          renderContextRow={(valStr, currentU) => {
            const rawQty = parseKeypadDisplayAmount(valStr);
            const effectiveQty = calculateEffectiveGrams(rawQty, weighingForm, baseFood?.edibleRate);
            const hasRefuse = Boolean(baseFood?.refuseRate && baseFood.refuseRate > 0);
            const displayCalories = baseFood
              ? calculateIngredientMacros(baseFood, effectiveQty).calories
              : roundTo(((log.calories || 0) / Math.max(log.quantity || 1, 1)) * effectiveQty, 1);

            return (
              <KeypadWeighingDisplayCard
                weighingForm={weighingForm}
                hasRefuse={hasRefuse}
                edibleRate={baseFood?.edibleRate}
                refuseRate={baseFood?.refuseRate}
                onSelectNet={() => {
                  setWeighingForm('net');
                  setQuantity(rawQty);
                  setGrossQuantity(undefined);
                }}
                onSelectGross={() => {
                  setWeighingForm('gross');
                  setQuantity(effectiveQty);
                  setGrossQuantity(rawQty);
                }}
                calories={displayCalories}
                energyUnit={energyUnit}
                valueText={valStr}
                unit={currentU}
                effectiveQty={effectiveQty}
              />
            );
          }}
        />
      )}
    </>
  );
}
