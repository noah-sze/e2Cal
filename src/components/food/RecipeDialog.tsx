import { useState, useEffect, useMemo, useId, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { APP_ROUTES } from '@/utils/navigation';
import {
  Dialog,
  PrecisionDialogContent,
} from '@/components/ui/dialog';
import { NumericKeypadDialog } from '@/components/ui/NumericKeypadDialog';
import { FoodRecipeSelectDialog } from '@/components/food/FoodRecipeSelectDialog';
import { HoldToDeleteButton } from '@/components/ui/HoldToDeleteButton';
import { NutritionFactsCard } from '@/components/food/NutritionFactsCard';
import { RecipeIngredientsCard } from '@/components/food/RecipeIngredientsCard';
import { db } from '@/services/db/db';
import type {
  FoodItem,
  FoodRecipe,
  HydratedFoodLog,
  MealType,
  RecipeIngredient,
} from '@/types';
import { useFoods, getInMemoryFoodsCache, prewarmFoodsCache } from '@/hooks/useFoods';
import { getInMemoryRecipesCache, prewarmRecipesCache } from '@/hooks/useRecipes';
import { prewarmDailyDietLogsCache, useFoodLogs } from '@/hooks/useFoodLogs';
import { useUnitPreferences } from '@/hooks/useUnitPreferences';
import { calculateIngredientMacros } from '@/utils/recipeMath';
import { evaluateNutritionalHighlight } from '@/utils/nutritionEvaluation';
import { formatFoodDisplayName } from '@/utils/foodNaming';
import { ozToG, gToOz, flOzToMl, mlToFlOz } from '@/utils/unitMath';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export type RecipeFormData = Omit<
  FoodRecipe,
  'id' | 'createdAt' | 'updatedAt' | 'isCustom' | 'isArchived'
>;

export interface RecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * 操作情景：
   * - 'recipe': 建立或編輯食譜原型（顯示名稱輸入框，儲存為 FoodRecipe）
   * - 'log': 飲食日誌秤重暫存或編輯已記錄之菜餚組合
   * 若未指定，將依據是否傳入 `onSubmit` 自動推斷。
   */
  variant?: 'recipe' | 'log';

  // --- 食譜定義模式專用 ---
  initialData?: FoodRecipe | null;
  onSubmit?: (data: RecipeFormData) => Promise<void> | void;

  // --- 飲食日誌模式專用 ---
  mode?: 'create' | 'edit';
  recipe?: FoodRecipe | null;
  mealType?: MealType;
  date?: string;
  onSuccess?: () => void;
  bundleId?: string | null;
  bundleTitle?: string;
  logs?: HydratedFoodLog[];
  onSave?: (
    bundleId: string,
    items: Array<{
      id?: string;
      foodId?: string;
      quantity: number;
      unit: string;
    }>
  ) => Promise<void>;
  onDeleteBundle?: (bundleId: string) => Promise<void>;

  // --- 彈窗層級與樣式 ---
  zIndex?: number;
  overlayClassName?: string;
  className?: string;
}

interface UnifiedIngredientRow {
  id: string;
  originalLogId?: string;
  foodId?: string;
  foodName: string;
  quantity: number;
  unit: string;
  baseFood?: FoodItem | null;
  baseRatio?: { calories: number; carbs: number; protein: number; fat: number };
}

interface KeypadConfig {
  index: number;
  title: string;
  value: number;
  unit: string;
  anchorEl?: HTMLElement | null;
}

/**
 * 將顯示份量正規化為公制基礎單位（g / ml），確保營養素計算與資料庫儲存一致
 */
function normalizeToMetric(quantity: number, unit: string): { quantity: number; unit: string } {
  if (unit === 'oz') {
    return { quantity: ozToG(quantity, 2), unit: 'g' };
  }
  if (unit === 'fl oz') {
    return { quantity: flOzToMl(quantity, 2), unit: 'ml' };
  }
  return { quantity, unit };
}

/**
 * 全域統一菜餚／食譜彈窗（單一真理源）
 * 統一涵蓋：
 * 1. 食譜定義與編輯（variant="recipe"）
 * 2. 飲食記錄前暫存秤重與已記錄菜餚編輯（variant="log"）
 */
export function RecipeDialog({
  open,
  onOpenChange,
  variant: explicitVariant,
  initialData,
  onSubmit,
  mode: explicitLogMode,
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
}: RecipeDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const formId = useId();

  const { allFoods } = useFoods();
  const { addFoodLogBundle } = useFoodLogs(date || '');
  const { foodWeightUnit, foodVolumeUnit } = useUnitPreferences();

  // 模式解析
  const variant: 'recipe' | 'log' = explicitVariant ?? (onSubmit ? 'recipe' : 'log');
  const isRecipeVariant = variant === 'recipe';
  const isRecipeEdit = isRecipeVariant && Boolean(initialData);
  const isLogCreateMode = !isRecipeVariant && (explicitLogMode ? explicitLogMode === 'create' : Boolean(recipe && !logs));

  const effectiveBundleId = explicitBundleId || recipe?.id || null;
  const effectiveLogTitle = recipe?.name || explicitBundleTitle || '';

  // 表單核心狀態
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState<UnifiedIngredientRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 日誌模式：檢查 bundleId 是否對應於資料庫中的食譜
  const [hasRecipeInDb, setHasRecipeInDb] = useState(() => {
    if (isRecipeVariant || !effectiveBundleId) return false;
    return Boolean(getInMemoryRecipesCache()?.some((r) => r.id === effectiveBundleId));
  });

  // 次級彈窗狀態（數字鍵盤、食材選擇器）
  const [keypadConfig, setKeypadConfig] = useState<KeypadConfig | null>(null);
  const initialKeypadValueRef = useRef<number>(0);
  const isKeypadConfirmedRef = useRef(false);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

  // 全量食材快速查詢索引
  const foodMap = useMemo(() => {
    const map = new Map<string, FoodItem>();
    allFoods.forEach((f) => map.set(f.id, f));
    return map;
  }, [allFoods]);

  // 日誌模式預熱與食譜關聯檢查
  useEffect(() => {
    if (!isRecipeVariant && open && effectiveBundleId) {
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
  }, [isRecipeVariant, open, effectiveBundleId]);

  // 初始化表單與食材清單
  useEffect(() => {
    if (!open) {
      setKeypadConfig(null);
      setIsPickerOpen(false);
      setReplacingIndex(null);
      if (!isRecipeVariant) {
        setIngredients([]);
      }
      return;
    }

    if (isRecipeVariant) {
      if (initialData) {
        // oxlint-disable-next-line react/set-state-in-effect
        setName(initialData.name || '');
        const rows: UnifiedIngredientRow[] = initialData.ingredients.map((ing, idx) => {
          const food = foodMap.get(ing.foodId) || null;
          const isLiquid =
            (food?.servingUnit || ing.unit || 'g').toLowerCase().includes('ml') ||
            food?.category === 'beverage';

          let displayQty = ing.quantity;
          let displayUnit = isLiquid ? 'ml' : 'g';

          if (isLiquid && foodVolumeUnit === 'fl oz') {
            displayQty = mlToFlOz(ing.quantity, 2);
            displayUnit = 'fl oz';
          } else if (!isLiquid && foodWeightUnit === 'oz') {
            displayQty = gToOz(ing.quantity, 2);
            displayUnit = 'oz';
          }

          return {
            id: `${ing.foodId}-${idx}-${Date.now()}`,
            foodId: ing.foodId,
            foodName: food ? formatFoodDisplayName(food) : '',
            quantity: displayQty > 0 ? displayQty : 100,
            unit: displayUnit,
            baseFood: food,
          };
        });
        setIngredients(rows);
      } else {
        setName('');
        setIngredients([]);
      }
      return;
    }

    // 飲食日誌模式初始化
    if (isLogCreateMode && recipe) {
      const initialStaged: UnifiedIngredientRow[] = recipe.ingredients.map((ing) => {
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
      const cachedFoods = getInMemoryFoodsCache();
      const cachedFoodMap = cachedFoods ? new Map(cachedFoods.map((f) => [f.id, f])) : null;
      const initRows: UnifiedIngredientRow[] = logs.map((log) => {
        const qty = log.quantity ?? 100;
        return {
          id: log.id,
          originalLogId: log.id,
          foodId: log.foodId,
          foodName: log.foodName || '未知食材',
          quantity: qty,
          unit: log.unit || 'g',
          baseFood: log.foodId && cachedFoodMap ? cachedFoodMap.get(log.foodId) || null : null,
          baseRatio:
            qty > 0
              ? {
                  calories: (log.calories || 0) / qty,
                  carbs: (log.carbs || 0) / qty,
                  protein: (log.protein || 0) / qty,
                  fat: (log.fat || 0) / qty,
                }
              : undefined,
        };
      });

      const foodIds = logs.map((l) => l.foodId).filter(Boolean) as string[];
      if (foodIds.length > 0) {
        db.foods
          .where('id')
          .anyOf(foodIds)
          .toArray()
          .then((foods) => {
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
  }, [
    open,
    isRecipeVariant,
    initialData,
    isLogCreateMode,
    recipe,
    logs,
    foodMap,
    foodWeightUnit,
    foodVolumeUnit,
  ]);

  // 單項食材即時營養素計算（自動折算英制為公制）
  const getIngredientMacros = useCallback(
    (item: UnifiedIngredientRow) => {
      const targetFood = item.baseFood || (item.foodId ? foodMap.get(item.foodId) : null);
      const { quantity: metricQty } = normalizeToMetric(item.quantity, item.unit);

      if (targetFood) {
        return calculateIngredientMacros(targetFood, metricQty);
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
    },
    [foodMap]
  );

  // 全菜餚總營養素累計 (C -> P -> F 嚴格順序與微量素)
  const totals = useMemo(() => {
    return ingredients.reduce(
      (acc, item) => {
        const macros = getIngredientMacros(item);
        const { quantity: metricQty } = normalizeToMetric(item.quantity || 0, item.unit);
        acc.totalWeightGrams += metricQty;
        acc.calories += macros.calories;
        acc.carbs += macros.carbs;
        acc.protein += macros.protein;
        acc.fat += macros.fat;
        if (typeof macros.sugar === 'number') acc.sugar = (acc.sugar || 0) + macros.sugar;
        if (typeof macros.fiber === 'number') acc.fiber = (acc.fiber || 0) + macros.fiber;
        if (typeof macros.saturatedFat === 'number') {
          acc.saturatedFat = (acc.saturatedFat || 0) + macros.saturatedFat;
        }
        if (typeof macros.transFat === 'number') acc.transFat = (acc.transFat || 0) + macros.transFat;
        if (typeof macros.sodium === 'number') acc.sodium = (acc.sodium || 0) + macros.sodium;
        return acc;
      },
      {
        totalWeightGrams: 0,
        calories: 0,
        carbs: 0,
        protein: 0,
        fat: 0,
        sugar: undefined as number | undefined,
        fiber: undefined as number | undefined,
        saturatedFat: undefined as number | undefined,
        transFat: undefined as number | undefined,
        sodium: undefined as number | undefined,
      }
    );
  }, [ingredients, getIngredientMacros]);

  // 全菜餚營養評價高亮推算
  const recipeHighlights = useMemo(() => {
    return evaluateNutritionalHighlight({
      calories: totals.calories,
      carbs: totals.carbs,
      protein: totals.protein,
      fat: totals.fat,
      servingSize: totals.totalWeightGrams > 0 ? totals.totalWeightGrams : 100,
      servingUnit: 'g',
    }).highlights;
  }, [totals]);

  // 食材清單防重複禁用 ID 列表
  const disabledFoodIds = useMemo(() => {
    const filtered =
      replacingIndex !== null && replacingIndex >= 0 && replacingIndex < ingredients.length
        ? ingredients.filter((_, idx) => idx !== replacingIndex)
        : ingredients;
    return filtered.map((row) => row.foodId).filter(Boolean) as string[];
  }, [ingredients, replacingIndex]);

  // 新增／替換食材觸發
  const handleOpenAddIngredient = () => {
    if (!isRecipeVariant) triggerHaptic('light');
    setReplacingIndex(null);
    setIsPickerOpen(true);
  };

  const handleOpenReplaceIngredient = (index: number) => {
    if (!isRecipeVariant) triggerHaptic('light');
    setReplacingIndex(index);
    setIsPickerOpen(true);
  };

  // 食材選擇回調
  const handleSelectFood = (item: FoodItem | FoodRecipe) => {
    const food = item as FoodItem;
    if (disabledFoodIds.includes(food.id)) return;

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
                quantity: row.quantity > 0 ? row.quantity : defaultQty,
                baseFood: food,
                baseRatio: undefined,
              }
            : row
        )
      );
    } else {
      setIngredients((prev) => {
        if (prev.some((row) => row.foodId === food.id)) return prev;
        const newRow: UnifiedIngredientRow = {
          id: `${food.id}-${uuidv4()}`,
          foodId: food.id,
          foodName: formatFoodDisplayName(food),
          quantity: defaultQty,
          unit: prefUnit,
          baseFood: food,
        };
        return [...prev, newRow];
      });
    }

    triggerHaptic('selection');
    setReplacingIndex(null);
    if (!isRecipeVariant) {
      setIsPickerOpen(false);
    }
  };

  // 移除食材（至少保留 1 項）
  const handleRemoveIngredient = (index: number) => {
    if (ingredients.length <= 1) return;
    triggerHaptic('light');
    setIngredients((prev) => prev.filter((_, idx) => idx !== index));
  };

  // 數字鍵盤開啟與交互
  const handleOpenKeypad = (index: number, anchorEl: HTMLElement) => {
    const row = ingredients[index];
    if (!row) return;

    if (!isRecipeVariant) triggerHaptic('selection');
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

  const handleKeypadLiveChange = useCallback(
    (val: number) => {
      if (!keypadConfig) return;
      setIngredients((prev) =>
        prev.map((row, idx) =>
          idx === keypadConfig.index ? { ...row, quantity: val > 0 ? val : 0 } : row
        )
      );
    },
    [keypadConfig]
  );

  const handleKeypadConfirm = useCallback(
    (val: number, unit?: string) => {
      isKeypadConfirmedRef.current = true;
      if (!keypadConfig) return;
      setIngredients((prev) =>
        prev.map((row, idx) =>
          idx === keypadConfig.index
            ? {
                ...row,
                quantity: val > 0 ? val : isRecipeVariant ? 0 : 1,
                unit: unit || row.unit,
              }
            : row
        )
      );
      setKeypadConfig(null);
    },
    [keypadConfig, isRecipeVariant]
  );

  const handleKeypadCancel = useCallback(() => {
    if (isKeypadConfirmedRef.current || !keypadConfig) return;
    const prevVal = initialKeypadValueRef.current;
    setIngredients((prev) =>
      prev.map((row, idx) =>
        idx === keypadConfig.index ? { ...row, quantity: prevVal } : row
      )
    );
    setKeypadConfig(null);
  }, [keypadConfig]);

  // 主彈窗關閉保護（次級鍵盤或選擇器開啟時阻斷關閉）
  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (keypadConfig || isPickerOpen)) {
      return;
    }
    onOpenChange(nextOpen);
  };

  // 食譜模式提交
  const handleRecipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmit || !name.trim() || isSubmitting || ingredients.length === 0) return;

    const validIngredients: RecipeIngredient[] = [];
    for (const item of ingredients) {
      if (item.quantity > 0 && item.foodId) {
        const normalized = normalizeToMetric(item.quantity, item.unit);
        validIngredients.push({
          foodId: item.foodId,
          quantity: normalized.quantity,
          unit: normalized.unit,
        });
      }
    }

    if (validIngredients.length === 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        ingredients: validIngredients,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 日誌模式提交
  const handleLogSubmit = async () => {
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

  // 刪除整組菜餚日誌
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

  // 日誌模式標題點擊跳轉食譜詳情
  const handleTitleClick = () => {
    if (isRecipeVariant || !hasRecipeInDb || !effectiveBundleId) return;
    triggerHaptic('selection');
    onOpenChange(false);
    navigate(APP_ROUTES.recipeDetail(effectiveBundleId));
  };

  if (!isRecipeVariant && !effectiveBundleId && !recipe) {
    return null;
  }

  const dialogTitle = isRecipeVariant
    ? isRecipeEdit
      ? t('diet.editRecipe')
      : t('diet.addRecipe')
    : effectiveLogTitle;

  const submitDisabled =
    isSubmitting ||
    ingredients.length === 0 ||
    (isRecipeVariant && !name.trim());

  const submitAriaLabel = isRecipeVariant
    ? isRecipeEdit
      ? t('common.save')
      : t('common.add')
    : t('common.save');

  const bodyContent = (
    <>
      {/* 表格段落 1 (僅食譜定義模式)：基本資訊與菜餚名稱 */}
      {isRecipeVariant && (
        <div className="space-y-1.5 shrink-0">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground px-0 font-semibold">
            {t('diet.basicInfo')}
          </div>
          <div className="border border-border rounded-lg overflow-hidden bg-card text-sm font-sans">
            <div className="h-10 px-4 flex items-center justify-between gap-2 bg-card shrink-0">
              <span className="text-muted-foreground text-xs shrink-0">
                {t('diet.recipeName')}
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('diet.recipeNamePlaceholder')}
                className="h-7 px-3 rounded-full border border-border/80 bg-background text-right text-xs font-sans text-foreground font-medium focus:outline-none placeholder:text-muted-foreground/40 focus:border-foreground transition-all duration-100 w-36"
              />
            </div>
          </div>
        </div>
      )}

      {/* 表格段落 2：配方總計指標規格卡片 */}
      <NutritionFactsCard
        title={t('diet.servingNutrients', '基準營養素')}
        action={null}
        showServingRow={isRecipeVariant}
        highlights={recipeHighlights}
        data={{
          servingSize: Math.round(totals.totalWeightGrams * 10) / 10,
          servingUnit: 'g',
          calories: Math.round(totals.calories),
          carbs: Math.round(totals.carbs * 10) / 10,
          protein: Math.round(totals.protein * 10) / 10,
          fat: Math.round(totals.fat * 10) / 10,
          sugar: totals.sugar !== undefined ? Math.round(totals.sugar * 10) / 10 : undefined,
          fiber: totals.fiber !== undefined ? Math.round(totals.fiber * 10) / 10 : undefined,
          saturatedFat:
            totals.saturatedFat !== undefined
              ? Math.round(totals.saturatedFat * 10) / 10
              : undefined,
          transFat:
            totals.transFat !== undefined ? Math.round(totals.transFat * 10) / 10 : undefined,
          sodium: totals.sodium !== undefined ? Math.round(totals.sodium) : undefined,
        }}
      />

      {/* 表格段落 3：構成食材清單 (共用 RecipeIngredientsCard) */}
      <RecipeIngredientsCard
        mode="edit"
        showCount={true}
        items={ingredients}
        onAddIngredient={handleOpenAddIngredient}
        onReplaceItem={(_, index) => handleOpenReplaceIngredient(index)}
        onEditQuantity={(_, index, anchorEl) => handleOpenKeypad(index, anchorEl)}
      />

      {/* 底部破壞性按鈕（僅日誌編輯模式且提供 onDeleteBundle 時展示） */}
      {!isRecipeVariant && onDeleteBundle && !isLogCreateMode && (
        <HoldToDeleteButton
          onConfirm={handleDeleteAll}
          disabled={isSubmitting}
          text={t('common.delete', '刪除')}
          className="shrink-0"
        />
      )}
    </>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <PrecisionDialogContent
          title={dialogTitle}
          onTitleClick={!isRecipeVariant && hasRecipeInDb ? handleTitleClick : undefined}
          form={isRecipeVariant ? formId : undefined}
          onSubmit={isRecipeVariant ? undefined : handleLogSubmit}
          submitDisabled={submitDisabled}
          submitAriaLabel={submitAriaLabel}
          cancelAriaLabel={t('common.cancel')}
          overlayClassName={overlayClassName ?? `z-[${zIndex}]`}
          className={cn(`z-[${zIndex}]`, 'flex flex-col max-h-[85vh] overflow-hidden', className)}
          initialFocus={false}
        >
          {isRecipeVariant ? (
            <form
              id={formId}
              onSubmit={handleRecipeSubmit}
              className="flex-1 min-h-0 flex flex-col pt-3.5"
            >
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3.5 pr-1">
                {bodyContent}
              </div>
            </form>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3 pt-3.5 pr-0.5">
              {bodyContent}
            </div>
          )}
        </PrecisionDialogContent>
      </Dialog>

      {/* 次級懸浮鍵盤（平鋪兄弟節點聲明，層級高於主彈窗） */}
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
          zIndex={zIndex + 10}
          onDelete={
            ingredients.length > 1
              ? () => {
                  const idx = keypadConfig.index;
                  setKeypadConfig(null);
                  handleRemoveIngredient(idx);
                }
              : undefined
          }
          onLiveChange={handleKeypadLiveChange}
          onConfirm={handleKeypadConfirm}
          onCancel={handleKeypadCancel}
        />
      )}

      {/* 次級食材選擇器（平鋪兄弟節點聲明，停用巢狀新增以防組件遞迴） */}
      {isPickerOpen && (
        <FoodRecipeSelectDialog
          open={isPickerOpen}
          onOpenChange={setIsPickerOpen}
          mode="foods"
          zIndex={zIndex + 10}
          disabledIds={disabledFoodIds}
          onSelect={handleSelectFood}
          allowAdd={false}
        />
      )}
    </>
  );
}
