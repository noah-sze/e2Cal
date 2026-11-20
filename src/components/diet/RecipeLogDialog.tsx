import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, ChevronRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { APP_ROUTES } from '@/utils/navigation';
import {
  Dialog,
  PrecisionDialogContent,
} from '@/components/ui/dialog';
import { NumericKeypadDialog } from '@/components/ui/NumericKeypadDialog';
import { FoodRecipeSelectDialog } from '@/components/food/FoodRecipeSelectDialog';
import { HoldToDeleteButton } from '@/components/ui/HoldToDeleteButton';
import { db } from '@/services/db/db';
import type { HydratedFoodLog, FoodItem, FoodRecipe, MealType } from '@/types';
import { cn, formatDisplayAmount } from '@/lib/utils';
import { triggerHaptic } from '@/lib/haptics';
import { calculateIngredientMacros } from '@/utils/recipeMath';
import { useUnitPreferences } from '@/hooks/useUnitPreferences';
import { formatEnergy } from '@/utils/unitMath';
import { formatFoodDisplayName } from '@/utils/foodNaming';
import { getInMemoryFoodsCache, prewarmFoodsCache, useFoods } from '@/hooks/useFoods';
import { getInMemoryRecipesCache, prewarmRecipesCache } from '@/hooks/useRecipes';
import { prewarmDailyDietLogsCache, useFoodLogs } from '@/hooks/useFoodLogs';

export interface EditableRecipeIngredient {
  id: string; // 唯一列識別碼
  originalLogId?: string; // 原 FoodLog ID (若為新增則無)
  foodId?: string;
  foodName: string;
  quantity: number;
  unit: string;
  baseFood?: FoodItem | null;
  baseRatio?: { calories: number; carbs: number; protein: number; fat: number };
}

export interface RecipeLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 操作模式：預設依據是否傳入 logs / onDeleteBundle 自動判定 */
  mode?: 'create' | 'edit';
  /** 新增模式：待記錄之食譜原型 */
  recipe?: FoodRecipe | null;
  /** 新增模式：餐別 (breakfast, lunch, dinner, snack) */
  mealType?: MealType;
  /** 新增模式：記錄日期 (YYYY-MM-DD) */
  date?: string;
  /** 完成回調（新增成功或外部自訂儲存後呼叫） */
  onSuccess?: () => void;
  /** 編輯模式：既有菜餚 Bundle ID */
  bundleId?: string | null;
  /** 編輯模式：菜餚顯示名稱（若傳入 recipe 則優先使用 recipe.name） */
  bundleTitle?: string;
  /** 編輯模式：既有飲食日誌清單 */
  logs?: HydratedFoodLog[];
  /** 自訂保存回調（若未傳入且在新增模式，內部會自動調用 addFoodLogBundle 寫入 DB） */
  onSave?: (
    bundleId: string,
    items: Array<{
      id?: string;
      foodId?: string;
      quantity: number;
      unit: string;
    }>
  ) => Promise<void>;
  /** 刪除整組菜餚記錄回調（僅在編輯模式展示長按刪除按鈕） */
  onDeleteBundle?: (bundleId: string) => Promise<void>;
  /** 多層彈窗層級 @default 70 */
  zIndex?: number;
  overlayClassName?: string;
  className?: string;
}

/**
 * 全域菜餚組合日誌管理彈窗（單一真理源通用元件）
 * 兼具「記錄前暫存秤重（Staging）」與「已記錄菜餚日誌編輯（Edit）」雙模式。
 * 遵循 e2Cal 視覺與排版標準：
 * 1. 4 欄即時巨量素 HUD Banner + 供能比標尺（C -> P -> F 嚴格順序）
 * 2. 食材列表支援點擊名稱替換、點擊右側膠囊呼出懸浮數字鍵盤
 * 3. 兄弟節點平鋪彈窗聲明，無嵌套 Dialog
 */
export function RecipeLogDialog({
  open,
  onOpenChange,
  mode: explicitMode,
  recipe,
  mealType,
  date,
  onSuccess,
  bundleId: explicitBundleId,
  bundleTitle: explicitBundleTitle,
  logs,
  onSave,
  onDeleteBundle,
  zIndex = 70,
  overlayClassName,
  className,
}: RecipeLogDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { allFoods } = useFoods();
  const { addFoodLogBundle } = useFoodLogs(date || '');
  const { energyUnit, foodWeightUnit, foodVolumeUnit } = useUnitPreferences();

  const isCreateMode = explicitMode ? explicitMode === 'create' : Boolean(recipe && !logs);
  const effectiveBundleId = explicitBundleId || recipe?.id || null;
  const effectiveTitle = recipe?.name || explicitBundleTitle || '';

  const [ingredients, setIngredients] = useState<EditableRecipeIngredient[]>([]);
  const [hasRecipeInDb, setHasRecipeInDb] = useState(() => {
    if (!effectiveBundleId) return false;
    return Boolean(getInMemoryRecipesCache()?.some((r) => r.id === effectiveBundleId));
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 次級鍵盤與食物選擇器狀態
  const [keypadConfig, setKeypadConfig] = useState<{
    index: number;
    title: string;
    value: number;
    unit: string;
    anchorEl?: HTMLElement | null;
  } | null>(null);
  const initialKeypadValueRef = useRef<number>(0);
  const isKeypadConfirmedRef = useRef(false);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

  // 建立全量食材索引 Map
  const foodMap = useMemo(() => {
    const map = new Map<string, FoodItem>();
    allFoods.forEach((f) => map.set(f.id, f));
    return map;
  }, [allFoods]);

  // 檢查 bundleId 是否存在對應的食譜於資料庫中，並預熱詳情頁快取
  useEffect(() => {
    if (open && effectiveBundleId) {
      void prewarmRecipesCache();
      void prewarmFoodsCache();
      void prewarmDailyDietLogsCache();

      const cachedHas = getInMemoryRecipesCache()?.some((r) => r.id === effectiveBundleId);
      if (cachedHas) {
        setHasRecipeInDb(true);
      }
      db.recipes.get(effectiveBundleId).then((rec) => {
        setHasRecipeInDb(Boolean(rec || cachedHas));
      });
    } else {
      setHasRecipeInDb(false);
    }
  }, [open, effectiveBundleId]);

  // 初始化食材清單（支援從 recipe 或既有 logs 載入）
  useEffect(() => {
    if (!open) {
      setIngredients([]);
      setKeypadConfig(null);
      setIsPickerOpen(false);
      setReplacingIndex(null);
      return;
    }

    if (isCreateMode && recipe) {
      // 新增模式：從食譜原型初始化
      const initialStaged: EditableRecipeIngredient[] = recipe.ingredients.map((ing) => {
        const baseFood = foodMap.get(ing.foodId) || null;
        return {
          id: `${ing.foodId}-${uuidv4()}`,
          foodId: ing.foodId,
          foodName: baseFood ? formatFoodDisplayName(baseFood) : '',
          quantity: ing.quantity,
          unit: ing.unit || 'g',
          baseFood,
        };
      });
      setIngredients(initialStaged);
    } else if (logs && logs.length > 0) {
      // 編輯模式：從既有日誌條目初始化
      const cachedFoods = getInMemoryFoodsCache();
      const cachedFoodMap = cachedFoods ? new Map(cachedFoods.map((f) => [f.id, f])) : null;
      const initRows: EditableRecipeIngredient[] = logs.map((log) => {
        const qty = log.quantity ?? 100;
        return {
          id: log.id,
          originalLogId: log.id,
          foodId: log.foodId,
          foodName: log.foodName || '未知食材',
          quantity: qty,
          unit: log.unit || 'g',
          baseFood: log.foodId && cachedFoodMap ? cachedFoodMap.get(log.foodId) || null : null,
          baseRatio: qty > 0 ? {
            calories: (log.calories || 0) / qty,
            carbs: (log.carbs || 0) / qty,
            protein: (log.protein || 0) / qty,
            fat: (log.fat || 0) / qty,
          } : undefined,
        };
      });

      // 異步拉取所有已知 foodId 的最新基準 FoodItem
      const foodIds = logs.map((l) => l.foodId).filter(Boolean) as string[];
      if (foodIds.length > 0) {
        db.foods.where('id').anyOf(foodIds).toArray().then((foods) => {
          const map = new Map(foods.map((f) => [f.id, f]));
          setIngredients(
            initRows.map((row) => ({
              ...row,
              baseFood: row.foodId ? map.get(row.foodId) || null : null,
            }))
          );
        });
      } else {
        setIngredients(initRows);
      }
    }
  }, [open, isCreateMode, recipe, logs, foodMap]);

  // 單項食材即時營養素計算
  const getIngredientMacros = useCallback((item: EditableRecipeIngredient) => {
    const targetFood = item.baseFood || (item.foodId ? foodMap.get(item.foodId) : null);
    if (targetFood) {
      return calculateIngredientMacros(targetFood, item.quantity);
    }
    if (item.baseRatio) {
      return {
        calories: Math.round(item.baseRatio.calories * item.quantity),
        carbs: Math.round(item.baseRatio.carbs * item.quantity * 10) / 10,
        protein: Math.round(item.baseRatio.protein * item.quantity * 10) / 10,
        fat: Math.round(item.baseRatio.fat * item.quantity * 10) / 10,
      };
    }
    return { calories: 0, carbs: 0, protein: 0, fat: 0 };
  }, [foodMap]);

  // 全菜餚總營養素累計 (C -> P -> F 順序)
  const totals = useMemo(() => {
    return ingredients.reduce(
      (acc, item) => {
        const macros = getIngredientMacros(item);
        acc.calories += macros.calories;
        acc.carbs += macros.carbs;
        acc.protein += macros.protein;
        acc.fat += macros.fat;
        return acc;
      },
      { calories: 0, carbs: 0, protein: 0, fat: 0 }
    );
  }, [ingredients, getIngredientMacros]);

  // 供能比比例條推算
  const energyRatios = useMemo(() => {
    const carbCals = totals.carbs * 4;
    const proteinCals = totals.protein * 4;
    const fatCals = totals.fat * 9;
    const totalCal = carbCals + proteinCals + fatCals;

    if (totalCal <= 0) {
      return { carbs: 33.3, protein: 33.3, fat: 33.4 };
    }

    return {
      carbs: (carbCals / totalCal) * 100,
      protein: (proteinCals / totalCal) * 100,
      fat: (fatCals / totalCal) * 100,
    };
  }, [totals]);

  // 食材清單反灰清單（防重複添加）
  const disabledFoodIds = useMemo(() => {
    return ingredients
      .map((row) => row.foodId)
      .filter(Boolean) as string[];
  }, [ingredients]);

  // 打開數字鍵盤編輯用量
  const handleOpenKeypad = (index: number, anchorEl: HTMLElement) => {
    const row = ingredients[index];
    if (!row) return;
    triggerHaptic('selection');
    initialKeypadValueRef.current = row.quantity;
    isKeypadConfirmedRef.current = false;
    setKeypadConfig({
      index,
      title: row.foodName,
      value: row.quantity,
      unit: row.unit,
      anchorEl,
    });
  };

  const handleKeypadLiveChange = useCallback((val: number) => {
    setIngredients((prev) => {
      if (!keypadConfig) return prev;
      return prev.map((row, idx) =>
        idx === keypadConfig.index ? { ...row, quantity: val > 0 ? val : 0 } : row
      );
    });
  }, [keypadConfig]);

  const handleKeypadConfirm = useCallback((val: number, unit?: string) => {
    isKeypadConfirmedRef.current = true;
    setIngredients((prev) => {
      if (!keypadConfig) return prev;
      return prev.map((row, idx) =>
        idx === keypadConfig.index
          ? { ...row, quantity: val > 0 ? val : 1, unit: unit || row.unit }
          : row
      );
    });
    setKeypadConfig(null);
  }, [keypadConfig]);

  const handleKeypadCancel = useCallback(() => {
    if (isKeypadConfirmedRef.current) return;
    if (!keypadConfig) return;
    const prevVal = initialKeypadValueRef.current;
    setIngredients((prev) =>
      prev.map((row, idx) =>
        idx === keypadConfig.index ? { ...row, quantity: prevVal } : row
      )
    );
    setKeypadConfig(null);
  }, [keypadConfig]);

  // 打開新增食材選擇器
  const handleOpenAddIngredient = () => {
    triggerHaptic('light');
    setReplacingIndex(null);
    setIsPickerOpen(true);
  };

  // 打開替換食材選擇器
  const handleOpenReplaceIngredient = (index: number) => {
    triggerHaptic('light');
    setReplacingIndex(index);
    setIsPickerOpen(true);
  };

  // 選擇食材回調
  const handleSelectFood = (item: FoodItem | FoodRecipe) => {
    const food = item as FoodItem;
    const isLiquid =
      (food.servingUnit || 'g').toLowerCase().includes('ml') ||
      food.category === 'beverage';
    const prefUnit = isLiquid ? foodVolumeUnit : foodWeightUnit;
    const defaultQty = isLiquid ? (prefUnit === 'fl oz' ? 8 : 250) : (prefUnit === 'oz' ? 3.5 : 100);

    if (replacingIndex !== null && replacingIndex >= 0 && replacingIndex < ingredients.length) {
      setIngredients((prev) =>
        prev.map((row, idx) =>
          idx === replacingIndex
            ? {
                ...row,
                foodId: food.id,
                foodName: formatFoodDisplayName(food),
                unit: prefUnit,
                quantity: row.quantity || defaultQty,
                baseFood: food,
                baseRatio: undefined,
              }
            : row
        )
      );
    } else {
      const newRow: EditableRecipeIngredient = {
        id: `${food.id}-${uuidv4()}`,
        foodId: food.id,
        foodName: formatFoodDisplayName(food),
        quantity: defaultQty,
        unit: prefUnit,
        baseFood: food,
      };
      setIngredients((prev) => [...prev, newRow]);
    }

    triggerHaptic('selection');
    setReplacingIndex(null);
    setIsPickerOpen(false);
  };

  // 移除食材 (至少保留 1 項)
  const handleRemoveIngredient = (index: number) => {
    if (ingredients.length <= 1) return;
    triggerHaptic('light');
    setIngredients((prev) => prev.filter((_, idx) => idx !== index));
  };

  // 主彈窗開關保護
  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (keypadConfig || isPickerOpen)) {
      return;
    }
    onOpenChange(nextOpen);
  };

  // 保存整組菜餚記錄
  const handleSubmit = async () => {
    if (!effectiveBundleId || isSubmitting || ingredients.length === 0) return;
    setIsSubmitting(true);
    try {
      if (onSave) {
        const updatedItems = ingredients.map((item) => ({
          id: item.originalLogId,
          foodId: item.foodId,
          quantity: item.quantity,
          unit: item.unit,
        }));
        await onSave(effectiveBundleId, updatedItems);
      } else if (date && mealType) {
        const logItems = ingredients.map((item) => ({
          date,
          mealType,
          foodId: item.foodId || '',
          quantity: item.quantity,
          unit: item.unit,
        }));
        await addFoodLogBundle(effectiveBundleId, logItems);
      }

      triggerHaptic('success');
      onOpenChange(false);
      onSuccess?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  // 刪除整組菜餚記錄
  const handleDeleteAll = async () => {
    if (!effectiveBundleId || isSubmitting || !onDeleteBundle) return;
    setIsSubmitting(true);
    try {
      await onDeleteBundle(effectiveBundleId);
      triggerHaptic('medium');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!effectiveBundleId && !recipe) return null;

  const handleTitleClick = () => {
    if (!hasRecipeInDb || !effectiveBundleId) return;
    triggerHaptic('selection');
    onOpenChange(false);
    navigate(APP_ROUTES.recipeDetail(effectiveBundleId));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <PrecisionDialogContent
          title={effectiveTitle}
          onTitleClick={hasRecipeInDb ? handleTitleClick : undefined}
          onSubmit={handleSubmit}
          submitDisabled={isSubmitting || ingredients.length === 0}
          submitAriaLabel={t('common.save')}
          cancelAriaLabel={t('common.cancel')}
          overlayClassName={overlayClassName ?? `z-[${zIndex}]`}
          className={cn(`z-[${zIndex}]`, "flex flex-col max-h-[85vh] overflow-hidden", className)}
          initialFocus={false}
        >
          {/* 表單主體 (聯合滾動區域) */}
          <div className="flex-1 min-h-0 flex flex-col space-y-3 pt-3.5 overflow-hidden">
            {/* 4 欄即時 HUD Banner 與供能比標尺組合 */}
            <div className="space-y-1.5 shrink-0">
              <div className="border border-border rounded-lg overflow-hidden bg-card grid grid-cols-4 divide-x divide-border select-none text-center shrink-0">
                {/* 熱量 */}
                <div className="py-2 px-1 flex flex-col items-center justify-center min-w-0">
                  <span className="text-[10px] font-medium text-calories uppercase tracking-wider truncate">
                    {t('diet.calories')}
                  </span>
                  <div className="font-mono text-xs font-normal text-calories mt-0.5 truncate flex items-baseline gap-0.5">
                    <span>{formatEnergy(totals.calories, energyUnit).value}</span>
                    <span className="font-sans text-[9px] font-normal opacity-75">{formatEnergy(totals.calories, energyUnit).unit}</span>
                  </div>
                </div>

                {/* 碳水化合物 */}
                <div className="py-2 px-1 flex flex-col items-center justify-center min-w-0">
                  <span className="text-[10px] font-medium text-carbs uppercase tracking-wider truncate">
                    {t('diet.macroMicro.carbs', '碳')}
                  </span>
                  <div className="font-mono text-xs font-normal text-carbs mt-0.5 truncate flex items-baseline gap-0.5">
                    <span>{Math.round(totals.carbs * 10) / 10}</span>
                    <span className="font-sans text-[9px] font-normal opacity-75">g</span>
                  </div>
                </div>

                {/* 蛋白質 */}
                <div className="py-2 px-1 flex flex-col items-center justify-center min-w-0">
                  <span className="text-[10px] font-medium text-protein uppercase tracking-wider truncate">
                    {t('diet.macroMicro.protein', '蛋')}
                  </span>
                  <div className="font-mono text-xs font-normal text-protein mt-0.5 truncate flex items-baseline gap-0.5">
                    <span>{Math.round(totals.protein * 10) / 10}</span>
                    <span className="font-sans text-[9px] font-normal opacity-75">g</span>
                  </div>
                </div>

                {/* 脂肪 */}
                <div className="py-2 px-1 flex flex-col items-center justify-center min-w-0">
                  <span className="text-[10px] font-medium text-fat uppercase tracking-wider truncate">
                    {t('diet.macroMicro.fat', '脂')}
                  </span>
                  <div className="font-mono text-xs font-normal text-fat mt-0.5 truncate flex items-baseline gap-0.5">
                    <span>{Math.round(totals.fat * 10) / 10}</span>
                    <span className="font-sans text-[9px] font-normal opacity-75">g</span>
                  </div>
                </div>
              </div>

              {/* 供能比標尺 (Ratio Bar: 嚴格固定 C -> P -> F 順序) */}
              <div className="h-1 w-full rounded-full overflow-hidden flex bg-track shrink-0" title="供能比標尺">
                <div className="bg-carbs transition-all duration-150" style={{ width: `${energyRatios.carbs}%` }} />
                <div className="bg-protein transition-all duration-150" style={{ width: `${energyRatios.protein}%` }} />
                <div className="bg-fat transition-all duration-150" style={{ width: `${energyRatios.fat}%` }} />
              </div>
            </div>

            {/* 構成食材段落 */}
            <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between px-0 shrink-0">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
                  {t('diet.recipeIngredients', '構成食材')} ({ingredients.length})
                </div>

                {/* 微型膠囊按鈕：新增食材 */}
                <button
                  type="button"
                  onClick={handleOpenAddIngredient}
                  className="h-6 px-2.5 rounded-full border border-border/80 bg-background hover:bg-hover font-mono text-[11px] flex items-center gap-1 transition-colors cursor-pointer text-foreground active:scale-95 select-none"
                >
                  <Plus className="size-3 text-muted-foreground" />
                  <span>{t('diet.addIngredient', '新增食材')}</span>
                </button>
              </div>

              {/* 食材清單滾動容器 */}
              <div className="border border-border rounded-lg overflow-y-auto bg-card divide-y divide-border text-sm flex-1 min-h-0">
                {ingredients.map((item, index) => (
                  <div
                    key={item.id}
                    className="min-h-12 py-2 px-3 sm:px-4 flex items-center justify-between gap-2 bg-card shrink-0"
                  >
                    {/* 左側：食材品名 (點擊可替換食材) */}
                    <button
                      type="button"
                      onClick={() => handleOpenReplaceIngredient(index)}
                      className="text-left min-w-0 flex-1 truncate text-xs font-medium text-foreground hover:opacity-75 transition-opacity cursor-pointer outline-none"
                      title={item.foodName}
                    >
                      <div className="truncate">{item.foodName}</div>
                    </button>

                    {/* 右側：常用數字輸入框膠囊 */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenKeypad(index, e.currentTarget)}
                      className="h-7 px-2.5 rounded-full border border-border/80 bg-background hover:bg-hover font-mono text-xs flex items-center gap-1 transition-colors cursor-pointer active:scale-95 select-none shrink-0"
                    >
                      <span className="font-normal text-foreground">
                        {formatDisplayAmount(String(item.quantity)) || '0'}
                      </span>
                      <span className="font-sans text-muted-foreground text-[11px]">
                        {item.unit}
                      </span>
                      <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 底部破壞性按鈕 (長按 0.5s 防誤觸刪除 · 僅在提供 onDeleteBundle 之編輯模式展示) */}
            {onDeleteBundle && !isCreateMode && (
              <HoldToDeleteButton
                onConfirm={handleDeleteAll}
                disabled={isSubmitting}
                text={t('common.delete', '刪除')}
                className="shrink-0"
              />
            )}
          </div>
        </PrecisionDialogContent>
      </Dialog>

      {/* 次級懸浮鍵盤 (平級兄弟節點聲明，層級高於主彈窗) */}
      {keypadConfig && (
        <NumericKeypadDialog
          open={!!keypadConfig}
          onOpenChange={(kOpen) => {
            if (!kOpen) {
              if (!isKeypadConfirmedRef.current) {
                handleKeypadCancel();
              } else {
                setKeypadConfig(null);
              }
            }
          }}
          title={keypadConfig.title}
          value={keypadConfig.value}
          unit={keypadConfig.unit}
          allowDecimals={true}
          maxDecimals={2}
          anchorEl={keypadConfig.anchorEl}
          onDelete={ingredients.length > 1 ? () => {
            const idx = keypadConfig.index;
            setKeypadConfig(null);
            handleRemoveIngredient(idx);
          } : undefined}
          onLiveChange={handleKeypadLiveChange}
          onConfirm={handleKeypadConfirm}
          onCancel={handleKeypadCancel}
        />
      )}

      {/* 次級食材選擇器 (平級兄弟節點聲明，層級 zIndex={zIndex + 10}) */}
      <FoodRecipeSelectDialog
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        mode="foods"
        zIndex={zIndex + 10}
        disabledIds={replacingIndex !== null ? disabledFoodIds.filter((id) => id !== ingredients[replacingIndex]?.foodId) : disabledFoodIds}
        onSelect={handleSelectFood}
      />
    </>
  );
}

// 別名匯出，確保向後相容
export { RecipeLogDialog as EditRecipeLogDialog };
