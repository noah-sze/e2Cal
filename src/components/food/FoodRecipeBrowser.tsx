import { useState, useMemo, useRef, useEffect, useCallback, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ChevronDown, X, SlidersHorizontal, ArrowUpDown, Plus, LayoutGrid, Database, PenLine } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NutritionBasisToggle } from '@/components/food/NutritionBasisToggle';
import { FoodListItem } from '@/components/food/FoodListItem';
import { RecipeListItem } from '@/components/food/RecipeListItem';
import { AuthorityFoodSearchDialog } from '@/components/food/AuthorityFoodSearchDialog';
import { useFoods } from '@/hooks/useFoods';
import { useRecipes } from '@/hooks/useRecipes';
import { useRecentFoods } from '@/hooks/useRecentFoods';
import type { FoodItem, FoodRecipe, FoodCategory, NutritionTag } from '@/types';
import { evaluateNutritionalHighlight } from '@/utils/nutritionEvaluation';
import { calculateScaledNutrition } from '@/utils/nutritionMath';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { matchesMultilingual } from '@/utils/multilingualSearch';
import { compareByRecentActivityThenName } from '@/utils/activitySorting';
import { useBrowserStateStore, type FoodSortOption } from '@/store/useBrowserStateStore';
import { useAppStore } from '@/store/useAppStore';
import { useUnitPreferences } from '@/hooks/useUnitPreferences';

export type FoodSelectMode = 'all' | 'foods' | 'recipes';
export type FoodInteractiveMode = 'manage' | 'select';

export interface FoodRecipeBrowserProps {
  /** 模式：全部 (可切換)、僅食材、或僅食譜 @default 'all' */
  mode?: FoodSelectMode;
  /** 當前選中的 Tab (受控模式) */
  activeTab?: 'foods' | 'recipes';
  /** Tab 切換回調 (受控模式) */
  onTabChange?: (tab: 'foods' | 'recipes') => void;
  /** 交互模式：管理 (可跳轉與歸檔操作) 或選擇 (單擊回傳) @default 'select' */
  interactiveMode?: FoodInteractiveMode;
  /** 項目點擊回調 */
  onItemClick?: (item: FoodItem | FoodRecipe, type: 'food' | 'recipe') => void;
  /** 是否允許查看歸檔 @default interactiveMode === 'manage' */
  showArchivedOption?: boolean;
  /** 禁用的項目 ID 陣列（將反灰顯示且無法點擊選取） */
  disabledIds?: string[];
  /** 自訂項目是否禁用的判斷函數 */
  isItemDisabled?: (item: FoodItem | FoodRecipe, type: 'food' | 'recipe') => boolean;
  /** 當前在選擇模式下被選中的項目 ID */
  selectedId?: string;
  /** 新增食材回調 (若提供則在食材工具列右側顯示「新增」按鈕) */
  onAddFood?: () => void;
  /** 新增權威食材回調 (若提供則在新增選單中觸發) */
  /** 點擊「權威科研庫搜索添加」或從搜尋列跳轉權威搜尋 */
  onAddAuthorityFood?: (initialQuery?: string) => void;
  /** 新增食譜回調 (若提供則在食譜工具列右側顯示「新增」按鈕) */
  onAddRecipe?: () => void;
  /** 整合的新增回調 (根據當前 Tab 自動派發) */
  onAdd?: (type: 'food' | 'recipe') => void;
  /** 歸檔管理操作回調 */
  onDeleteFood?: (food: FoodItem) => void;
  onUnarchiveFood?: (food: FoodItem) => void;
  onDeleteRecipe?: (recipe: FoodRecipe) => void;
  onUnarchiveRecipe?: (recipe: FoodRecipe) => void;
  /** 是否凍結最近使用排序快照（用於彈窗開啟期間防止重排跳動） */
  freezeSort?: boolean;
  /** 自訂容器類名 */
  className?: string;
  /** 自訂列表滾動容器類名 */
  listContainerClassName?: string;
}

export function FoodRecipeBrowser({
  mode = 'all',
  activeTab: controlledTab,
  onTabChange: setControlledTab,
  interactiveMode = 'select',
  onItemClick,
  showArchivedOption = interactiveMode === 'manage',
  disabledIds,
  isItemDisabled,
  selectedId,
  onAddFood,
  onAddAuthorityFood,
  onAddRecipe,
  onAdd,
  onDeleteFood: _onDeleteFood,
  onUnarchiveFood: _onUnarchiveFood,
  onDeleteRecipe: _onDeleteRecipe,
  onUnarchiveRecipe: _onUnarchiveRecipe,
  freezeSort = false,
  className,
  listContainerClassName,
}: FoodRecipeBrowserProps) {
  const { t } = useTranslation();
  const [isInternalAuthorityOpen, setIsInternalAuthorityOpen] = useState(false);
  const [internalAuthorityQuery, setInternalAuthorityQuery] = useState('');

  // 建立快速查詢已禁用 ID 集合
  const disabledIdSet = useMemo(() => new Set(disabledIds || []), [disabledIds]);

  const checkIsFoodDisabled = (food: FoodItem) => {
    if (disabledIdSet.has(food.id)) return true;
    if (isItemDisabled && isItemDisabled(food, 'food')) return true;
    return false;
  };

  const checkIsRecipeDisabled = (recipe: FoodRecipe) => {
    if (disabledIdSet.has(recipe.id)) return true;
    if (isItemDisabled && isItemDisabled(recipe, 'recipe')) return true;
    return false;
  };

  // 頂部視圖：支援外部受控，若未傳則使用內部狀態
  const [internalTab, setInternalTab] = useState<'foods' | 'recipes'>(
    mode === 'recipes' ? 'recipes' : 'foods'
  );
  
  const currentTab = controlledTab ?? internalTab;
  const viewTab = mode === 'all' ? currentTab : mode;

  // 雙 Tab 惰性掛載 + 保活隱藏（切換食譜 ⇄ 食材時不銷毀重建 DOM，消除切回卡頓）
  const [hasMountedFoods, setHasMountedFoods] = useState(viewTab === 'foods');
  const [hasMountedRecipes, setHasMountedRecipes] = useState(viewTab === 'recipes');
  if (viewTab === 'foods' && !hasMountedFoods) {
    setHasMountedFoods(true);
  }
  if (viewTab === 'recipes' && !hasMountedRecipes) {
    setHasMountedRecipes(true);
  }

  const handleTabChange = (tab: 'foods' | 'recipes') => {
    triggerHaptic('selection');
    if (setControlledTab) {
      setControlledTab(tab);
    } else {
      setInternalTab(tab);
    }
  };

  // ==========================================
  // 食物原子庫 (Foods)
  // ==========================================
  const {
    customFoods,
    presetFoods,
    archivedCustomFoods,
    archivedPresetFoods,
  } = useFoods();

  const isManage = interactiveMode === 'manage';
  const { foodBrowser, setFoodBrowserState } = useBrowserStateStore();

  // 父層統一取得偏好，避免 40+ 個列表子元件各自重複調用 Hook 訂閱
  const { nutritionDisplayMode } = useAppStore();
  const { foodWeightUnit, foodVolumeUnit, energyUnit } = useUnitPreferences();

  // 提取最後使用時間映射（用於預設排序置頂）
  const {
    foodLastUsedMap,
    recipeLastUsedMap,
  } = useRecentFoods(freezeSort);

  // 穩定的選擇回調（100% 避免行內匿名函數參照抖動，啟動 React.memo）
  const handleSelectFood = useCallback(
    (food: FoodItem) => {
      onItemClick?.(food, 'food');
    },
    [onItemClick]
  );

  const handleSelectRecipe = useCallback(
    (recipe: FoodRecipe) => {
      onItemClick?.(recipe, 'recipe');
    },
    [onItemClick]
  );

  const [localCategory, setLocalCategory] = useState<'all' | FoodCategory>('all');
  const [localNutritionTag, setLocalNutritionTag] = useState<'all' | NutritionTag>('all');
  const [localFoodSortBy, setLocalFoodSortBy] = useState<FoodSortOption>('default');
  const [localFoodSearchQuery, setLocalFoodSearchQuery] = useState('');
  const [localShowFoodArchived, setLocalShowFoodArchived] = useState(false);

  const selectedCategory = isManage ? foodBrowser.selectedCategory : localCategory;
  const setSelectedCategory = isManage
    ? (cat: 'all' | FoodCategory) => setFoodBrowserState({ selectedCategory: cat })
    : setLocalCategory;

  const selectedNutritionTag = isManage ? foodBrowser.selectedNutritionTag : localNutritionTag;
  const setSelectedNutritionTag = isManage
    ? (tag: 'all' | NutritionTag) => setFoodBrowserState({ selectedNutritionTag: tag })
    : setLocalNutritionTag;

  const foodSortBy = isManage ? (foodBrowser.foodSortBy ?? 'default') : localFoodSortBy;
  const setFoodSortBy = isManage
    ? (sort: FoodSortOption) => setFoodBrowserState({ foodSortBy: sort })
    : setLocalFoodSortBy;

  const foodSearchQuery = isManage ? foodBrowser.foodSearchQuery : localFoodSearchQuery;
  const setFoodSearchQuery = isManage
    ? (query: string) => setFoodBrowserState({ foodSearchQuery: query })
    : setLocalFoodSearchQuery;

  const showFoodArchived = isManage ? foodBrowser.showFoodArchived : localShowFoodArchived;
  const setShowFoodArchived = isManage
    ? (updater: boolean | ((prev: boolean) => boolean)) => {
        const next = typeof updater === 'function' ? updater(foodBrowser.showFoodArchived) : updater;
        setFoodBrowserState({ showFoodArchived: next });
      }
    : setLocalShowFoodArchived;

  const totalActiveFoodsCount = useMemo(() => {
    return customFoods.length + presetFoods.length;
  }, [customFoods, presetFoods]);

  const totalArchivedFoods = useMemo(() => {
    return [...archivedCustomFoods, ...archivedPresetFoods];
  }, [archivedCustomFoods, archivedPresetFoods]);

  const tabBaseFoods = useMemo(() => {
    if (!showFoodArchived) {
      return [...customFoods, ...presetFoods];
    }
    return totalArchivedFoods;
  }, [showFoodArchived, customFoods, presetFoods, totalArchivedFoods]);

  const categoryCounts = useMemo(() => {
    const counts: Record<'all' | FoodCategory, number> = {
      all: tabBaseFoods.length,
      natural: 0,
      processed: 0,
      beverage: 0,
      oil: 0,
      condiment: 0,
    };
    tabBaseFoods.forEach((food) => {
      const cat = food.category || 'natural';
      if (counts[cat] !== undefined) {
        counts[cat] += 1;
      }
    });
    return counts;
  }, [tabBaseFoods]);

  // 針對 tabBaseFoods 建立 O(1) 營養特徵標籤快取 Map，徹底避免每次選單切換或過濾時對 422 筆食材全量重複進行昂貴的浮點運算
  const foodNutritionTagMap = useMemo(() => {
    const map = new Map<string, NutritionTag[]>();
    for (const food of tabBaseFoods) {
      map.set(food.id, evaluateNutritionalHighlight(food).labels);
    }
    return map;
  }, [tabBaseFoods]);

  const nutritionTagCounts = useMemo(() => {
    const counts: Record<NutritionTag, number> = {
      'high-protein': 0,
      'carb-source': 0,
      'fat-source': 0,
      'high-fiber': 0,
      'low-calorie': 0,
      'high-calorie': 0,
    };
    foodNutritionTagMap.forEach((labels) => {
      for (const tag of labels) {
        if (counts[tag] !== undefined) {
          counts[tag] += 1;
        }
      }
    });
    return counts;
  }, [foodNutritionTagMap]);

  const deferredFoodSearch = useDeferredValue(foodSearchQuery);
  const effectiveFoodSearch = foodSearchQuery === '' ? '' : deferredFoodSearch;

  const filteredFoods = useMemo(() => {
    let list = tabBaseFoods;
    const isSearching = Boolean(effectiveFoodSearch.trim());

    if (!isSearching && selectedCategory !== 'all') {
      list = list.filter((food) => (food.category || 'natural') === selectedCategory);
    }

    if (selectedNutritionTag !== 'all') {
      list = list.filter((food) => {
        const labels = foodNutritionTagMap.get(food.id);
        return labels ? labels.includes(selectedNutritionTag) : false;
      });
    }

    if (isSearching) {
      list = list.filter((food) =>
        matchesMultilingual(
          effectiveFoodSearch,
          { id: food.id, name: food.name, brand: food.brand },
          'food'
        )
      );
    }

    // 預先對列表項目計算對應當前 displayMode 的營養數值，避免在 sort O(N log N) 比較中重複多次計算
    const scaledMap = new Map<string, { calories: number; protein: number; carbs: number; fat: number; fiber?: number }>();
    if (foodSortBy !== 'default') {
      for (const item of list) {
        scaledMap.set(item.id, calculateScaledNutrition(item, nutritionDisplayMode));
      }
    }

    return list.slice().sort((a, b) => {
      if (foodSortBy !== 'default') {
        const valA = scaledMap.get(a.id);
        const valB = scaledMap.get(b.id);
        if (valA && valB) {
          if (foodSortBy === 'calories-desc') {
            const diff = valB.calories - valA.calories;
            if (Math.abs(diff) > 0.001) return diff;
          } else if (foodSortBy === 'calories-asc') {
            const diff = valA.calories - valB.calories;
            if (Math.abs(diff) > 0.001) return diff;
          } else if (foodSortBy === 'protein-desc') {
            const diff = valB.protein - valA.protein;
            if (Math.abs(diff) > 0.001) return diff;
          } else if (foodSortBy === 'carbs-desc') {
            const diff = valB.carbs - valA.carbs;
            if (Math.abs(diff) > 0.001) return diff;
          } else if (foodSortBy === 'fat-desc') {
            const diff = valB.fat - valA.fat;
            if (Math.abs(diff) > 0.001) return diff;
          } else if (foodSortBy === 'fiber-desc') {
            const diff = (valB.fiber ?? 0) - (valA.fiber ?? 0);
            if (Math.abs(diff) > 0.001) return diff;
          }
        }
      }

      return compareByRecentActivityThenName(a, b, foodLastUsedMap);
    });
  }, [tabBaseFoods, selectedCategory, selectedNutritionTag, effectiveFoodSearch, foodSortBy, nutritionDisplayMode, foodLastUsedMap, foodNutritionTagMap]);

  // ==========================================
  // 食材分批漸進加載 (Incremental Windowing)
  // 首屏渲染 20 筆，滾動觸底無感追加，消除大量 DOM 節點一次性渲染卡頓
  // 使用 Callback Ref 確保在 Tab 切換或 DOM 重新掛載時 100% 重新綁定 Observer
  // ==========================================
  const FOOD_BATCH_SIZE = 20;
  const [visibleFoodCount, setVisibleFoodCount] = useState(FOOD_BATCH_SIZE);
  const foodObserverRef = useRef<IntersectionObserver | null>(null);
  const filteredFoodsLengthRef = useRef(filteredFoods.length);
  useEffect(() => {
    filteredFoodsLengthRef.current = filteredFoods.length;
  }, [filteredFoods.length]);

  useEffect(() => {
    setVisibleFoodCount(FOOD_BATCH_SIZE);
  }, [selectedCategory, selectedNutritionTag, foodSortBy, foodSearchQuery, showFoodArchived]);

  const foodSentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (foodObserverRef.current) {
      foodObserverRef.current.disconnect();
      foodObserverRef.current = null;
    }

    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisibleFoodCount(filteredFoodsLengthRef.current);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleFoodCount((prev) => Math.min(prev + FOOD_BATCH_SIZE, filteredFoodsLengthRef.current));
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(node);
    foodObserverRef.current = observer;
  }, []);

  useEffect(() => {
    return () => {
      foodObserverRef.current?.disconnect();
    };
  }, []);

  const visibleFoods = useMemo(() => {
    return filteredFoods.slice(0, visibleFoodCount);
  }, [filteredFoods, visibleFoodCount]);

  // ==========================================
  // 食譜庫 (Recipes)
  // ==========================================
  const {
    customRecipes,
    presetRecipes,
    archivedCustomRecipes,
    archivedPresetRecipes,
    getRecipeMacros,
  } = useRecipes();

  const [localRecipeSearchQuery, setLocalRecipeSearchQuery] = useState('');
  const [localShowRecipeArchived, setLocalShowRecipeArchived] = useState(false);
  const [localSelectedRecipeNutritionTag, setLocalSelectedRecipeNutritionTag] = useState<'all' | NutritionTag>('all');

  const recipeSearchQuery = isManage ? foodBrowser.recipeSearchQuery : localRecipeSearchQuery;
  const setRecipeSearchQuery = isManage
    ? (query: string) => setFoodBrowserState({ recipeSearchQuery: query })
    : setLocalRecipeSearchQuery;

  const showRecipeArchived = isManage ? foodBrowser.showRecipeArchived : localShowRecipeArchived;
  const setShowRecipeArchived = isManage
    ? (updater: boolean | ((prev: boolean) => boolean)) => {
        const next = typeof updater === 'function' ? updater(foodBrowser.showRecipeArchived) : updater;
        setFoodBrowserState({ showRecipeArchived: next });
      }
    : setLocalShowRecipeArchived;

  const selectedRecipeNutritionTag = isManage
    ? foodBrowser.selectedRecipeNutritionTag
    : localSelectedRecipeNutritionTag;
  const setSelectedRecipeNutritionTag = isManage
    ? (tag: 'all' | NutritionTag) => setFoodBrowserState({ selectedRecipeNutritionTag: tag })
    : setLocalSelectedRecipeNutritionTag;

  const [localRecipeSortBy, setLocalRecipeSortBy] = useState<FoodSortOption>('default');
  const recipeSortBy = isManage ? (foodBrowser.recipeSortBy ?? 'default') : localRecipeSortBy;
  const setRecipeSortBy = isManage
    ? (sort: FoodSortOption) => setFoodBrowserState({ recipeSortBy: sort })
    : setLocalRecipeSortBy;

  const sortOptions = useMemo(
    () =>
      [
        { id: 'default' as const, label: t('diet.sort.default', '預設') },
        { id: 'calories-desc' as const, label: t('diet.sort.caloriesDesc', '熱量最高') },
        { id: 'calories-asc' as const, label: t('diet.sort.caloriesAsc', '熱量最低') },
        { id: 'carbs-desc' as const, label: t('diet.sort.carbsDesc', '碳水最高') },
        { id: 'protein-desc' as const, label: t('diet.sort.proteinDesc', '蛋白質最高') },
        { id: 'fat-desc' as const, label: t('diet.sort.fatDesc', '脂肪最高') },
        { id: 'fiber-desc' as const, label: t('diet.sort.fiberDesc', '膳食纖維最高') },
      ] as const,
    [t]
  );

  const totalActiveRecipes = useMemo(() => {
    return [...customRecipes, ...presetRecipes];
  }, [customRecipes, presetRecipes]);

  const totalArchivedRecipes = useMemo(() => {
    return [...archivedCustomRecipes, ...archivedPresetRecipes];
  }, [archivedCustomRecipes, archivedPresetRecipes]);

  const tabBaseRecipes = useMemo(() => {
    return showRecipeArchived ? totalArchivedRecipes : totalActiveRecipes;
  }, [showRecipeArchived, totalArchivedRecipes, totalActiveRecipes]);

  // 針對 tabBaseRecipes 建立 O(1) 營養特徵標籤快取 Map
  const recipeNutritionTagMap = useMemo(() => {
    const map = new Map<string, NutritionTag[]>();
    for (const recipe of tabBaseRecipes) {
      const macros = getRecipeMacros(recipe);
      const evalRes = evaluateNutritionalHighlight({
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        fiber: macros.fiber,
        servingSize: macros.totalWeightGrams || 100,
        servingUnit: 'g',
      });
      map.set(recipe.id, evalRes.labels);
    }
    return map;
  }, [tabBaseRecipes, getRecipeMacros]);

  const recipeNutritionTagCounts = useMemo(() => {
    const counts: Record<NutritionTag, number> = {
      'high-protein': 0,
      'carb-source': 0,
      'fat-source': 0,
      'high-fiber': 0,
      'low-calorie': 0,
      'high-calorie': 0,
    };
    recipeNutritionTagMap.forEach((labels) => {
      for (const tag of labels) {
        if (counts[tag] !== undefined) {
          counts[tag] += 1;
        }
      }
    });
    return counts;
  }, [recipeNutritionTagMap]);

  const deferredRecipeSearch = useDeferredValue(recipeSearchQuery);
  const effectiveRecipeSearch = recipeSearchQuery === '' ? '' : deferredRecipeSearch;

  const filteredRecipes = useMemo(() => {
    let list = tabBaseRecipes;
    const isSearching = Boolean(effectiveRecipeSearch.trim());

    if (selectedRecipeNutritionTag !== 'all') {
      list = list.filter((recipe) => {
        const labels = recipeNutritionTagMap.get(recipe.id);
        return labels ? labels.includes(selectedRecipeNutritionTag) : false;
      });
    }

    if (isSearching) {
      list = list.filter((recipe) =>
        matchesMultilingual(
          effectiveRecipeSearch,
          { id: recipe.id, name: recipe.name },
          'food'
        )
      );
    }

    return list.slice().sort((a, b) => {
      if (recipeSortBy !== 'default') {
        const macrosA = getRecipeMacros(a);
        const macrosB = getRecipeMacros(b);

        if (recipeSortBy === 'calories-desc') {
          const diff = macrosB.calories - macrosA.calories;
          if (Math.abs(diff) > 0.001) return diff;
        } else if (recipeSortBy === 'calories-asc') {
          const diff = macrosA.calories - macrosB.calories;
          if (Math.abs(diff) > 0.001) return diff;
        } else if (recipeSortBy === 'protein-desc') {
          const diff = macrosB.protein - macrosA.protein;
          if (Math.abs(diff) > 0.001) return diff;
        } else if (recipeSortBy === 'carbs-desc') {
          const diff = macrosB.carbs - macrosA.carbs;
          if (Math.abs(diff) > 0.001) return diff;
        } else if (recipeSortBy === 'fat-desc') {
          const diff = macrosB.fat - macrosA.fat;
          if (Math.abs(diff) > 0.001) return diff;
        } else if (recipeSortBy === 'fiber-desc') {
          const diff = (macrosB.fiber ?? 0) - (macrosA.fiber ?? 0);
          if (Math.abs(diff) > 0.001) return diff;
        }
      }

      return compareByRecentActivityThenName(a, b, recipeLastUsedMap);
    });
  }, [tabBaseRecipes, selectedRecipeNutritionTag, effectiveRecipeSearch, recipeSortBy, recipeLastUsedMap, recipeNutritionTagMap, getRecipeMacros]);

  // ==========================================
  // 食譜分批漸進加載 (Incremental Windowing)
  // 使用 Callback Ref 確保在 Tab 切換或 DOM 重新掛載時 100% 重新綁定 Observer
  // ==========================================
  const RECIPE_BATCH_SIZE = 20;
  const [visibleRecipeCount, setVisibleRecipeCount] = useState(RECIPE_BATCH_SIZE);
  const recipeObserverRef = useRef<IntersectionObserver | null>(null);
  const filteredRecipesLengthRef = useRef(filteredRecipes.length);
  useEffect(() => {
    filteredRecipesLengthRef.current = filteredRecipes.length;
  }, [filteredRecipes.length]);

  useEffect(() => {
    setVisibleRecipeCount(RECIPE_BATCH_SIZE);
  }, [recipeSearchQuery, selectedRecipeNutritionTag, recipeSortBy, showRecipeArchived]);

  const recipeSentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (recipeObserverRef.current) {
      recipeObserverRef.current.disconnect();
      recipeObserverRef.current = null;
    }

    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisibleRecipeCount(filteredRecipesLengthRef.current);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleRecipeCount((prev) => Math.min(prev + RECIPE_BATCH_SIZE, filteredRecipesLengthRef.current));
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(node);
    recipeObserverRef.current = observer;
  }, []);

  useEffect(() => {
    return () => {
      recipeObserverRef.current?.disconnect();
    };
  }, []);

  const visibleRecipes = useMemo(() => {
    return filteredRecipes.slice(0, visibleRecipeCount);
  }, [filteredRecipes, visibleRecipeCount]);

  return (
    <div className={cn('space-y-3 flex flex-col', className)}>
      {/* 頂部雙列切換與搜尋一體卡（方案 D：管理頁與選擇彈窗共用） */}
      {mode === 'all' && (
        <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border shrink-0">
          <div
            className={cn(
              'grid grid-cols-2 divide-x divide-border items-stretch select-none',
              isManage ? 'h-12' : 'h-10'
            )}
            role="tablist"
            aria-label={t('diet.foodItems')}
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewTab === 'foods'}
              onClick={() => handleTabChange('foods')}
              className="w-full h-full px-2 flex items-center justify-center group cursor-pointer outline-none"
            >
              <span
                className={cn(
                  'rounded-full text-xs font-sans transition-colors inline-flex items-center justify-center whitespace-nowrap',
                  isManage ? 'h-7 px-5' : 'h-6.5 px-4',
                  viewTab === 'foods'
                    ? 'bg-foreground text-background font-semibold'
                    : 'text-muted-foreground group-hover:text-foreground group-hover:bg-hover'
                )}
              >
                {t('diet.ingredientsTab', '食材')}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewTab === 'recipes'}
              onClick={() => handleTabChange('recipes')}
              className="w-full h-full px-2 flex items-center justify-center group cursor-pointer outline-none"
            >
              <span
                className={cn(
                  'rounded-full text-xs font-sans transition-colors inline-flex items-center justify-center whitespace-nowrap',
                  isManage ? 'h-7 px-5' : 'h-6.5 px-4',
                  viewTab === 'recipes'
                    ? 'bg-foreground text-background font-semibold'
                    : 'text-muted-foreground group-hover:text-foreground group-hover:bg-hover'
                )}
              >
                {t('diet.recipesTab', '食譜')}
              </span>
            </button>
          </div>
          <div className="relative h-10 flex items-center rounded-b-lg focus-within:ring-1 focus-within:ring-inset focus-within:ring-foreground focus-within:z-[1] transition-shadow duration-100">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={viewTab === 'foods' ? foodSearchQuery : recipeSearchQuery}
              onChange={(e) =>
                viewTab === 'foods'
                  ? setFoodSearchQuery(e.target.value)
                  : setRecipeSearchQuery(e.target.value)
              }
              placeholder={
                viewTab === 'foods'
                  ? t('diet.searchFoodPlaceholder', '搜尋食材名稱或品牌...')
                  : t('diet.searchRecipePlaceholder', '搜尋食譜名稱...')
              }
              className="w-full h-full pl-9 pr-9 bg-transparent text-xs font-sans text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {(viewTab === 'foods' ? foodSearchQuery : recipeSearchQuery) && (
              <button
                type="button"
                onClick={() =>
                  viewTab === 'foods' ? setFoodSearchQuery('') : setRecipeSearchQuery('')
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 視圖 1：單品食材 (Foods) */}
      {/* ========================================================================= */}
      {hasMountedFoods && (
        <div className={cn('space-y-2.5 flex-1 min-h-0 flex flex-col', viewTab !== 'foods' && 'hidden')}>
          {/* 搜尋輸入框 (僅單 Tab 模式時獨立渲染) */}
          {mode !== 'all' && (
            <div className="relative flex items-center shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                value={foodSearchQuery}
                onChange={(e) => setFoodSearchQuery(e.target.value)}
                placeholder={t('diet.searchFoodPlaceholder', '搜尋食材名稱或品牌...')}
                className="h-10 pl-9 pr-9 text-xs rounded-lg border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-foreground focus:ring-0 focus-visible:ring-0 shadow-none"
              />
              {foodSearchQuery && (
                <button
                  type="button"
                  onClick={() => setFoodSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}

          {/* 工具過濾與排序列 */}
          <div
            className={cn(
              'flex items-center gap-1.5 shrink-0 py-0.5 overflow-x-auto no-scrollbar min-w-0',
              interactiveMode === 'manage' && '-mx-4 px-4 md:mx-0 md:px-0'
            )}
          >
            {/* 整合分類下拉按鈕（置於營養特徵左側） */}
            <div
              className={cn(
                'inline-flex items-center rounded-full text-xs font-sans transition-all border shrink-0',
                showFoodArchived || selectedCategory !== 'all'
                  ? 'bg-foreground text-background border-foreground font-medium'
                  : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className={cn(
                          'flex items-center gap-1.5 py-1 pl-2.5 cursor-pointer focus:outline-none whitespace-nowrap',
                          showFoodArchived || selectedCategory !== 'all' ? 'pr-1' : 'pr-2'
                        )}
                      >
                        <LayoutGrid className="size-3 opacity-60 shrink-0" />
                        <span className="truncate">
                          {showFoodArchived
                            ? t('common.archived', '已歸檔')
                            : selectedCategory === 'all'
                              ? t('diet.foodCategory.title', '分類')
                              : t(`diet.foodCategory.${selectedCategory}`)}
                        </span>
                        {!(showFoodArchived || selectedCategory !== 'all') && (
                          <ChevronDown className="size-3 opacity-60 shrink-0" />
                        )}
                      </button>
                    }
                  />
                  <DropdownMenuContent align="start" className="w-[160px] text-xs font-sans">
                    <DropdownMenuItem
                      onClick={() => {
                        triggerHaptic('selection');
                        setShowFoodArchived(false);
                        setSelectedCategory('all');
                      }}
                      className={cn(
                        'cursor-pointer flex items-center justify-between',
                        !showFoodArchived && selectedCategory === 'all' && 'font-semibold bg-muted'
                      )}
                    >
                      <span>{t('diet.foodCategory.all', '全部')}</span>
                      <span className="font-mono text-[10px] opacity-60 tabular-nums">
                        {totalActiveFoodsCount}
                      </span>
                    </DropdownMenuItem>
                    {(
                      [
                        { id: 'natural', label: t('diet.foodCategory.natural') },
                        { id: 'processed', label: t('diet.foodCategory.processed') },
                        { id: 'beverage', label: t('diet.foodCategory.beverage') },
                        { id: 'oil', label: t('diet.foodCategory.oil') },
                        { id: 'condiment', label: t('diet.foodCategory.condiment') },
                      ] as const
                    ).map((cat) => (
                      <DropdownMenuItem
                        key={cat.id}
                        onClick={() => {
                          triggerHaptic('selection');
                          setShowFoodArchived(false);
                          setSelectedCategory(cat.id);
                        }}
                        className={cn(
                          'cursor-pointer flex items-center justify-between',
                          !showFoodArchived && selectedCategory === cat.id && 'font-semibold bg-muted'
                        )}
                      >
                        <span>{cat.label}</span>
                        <span className="font-mono text-[10px] opacity-60 tabular-nums">
                          {categoryCounts[cat.id]}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    {showArchivedOption && (
                      <DropdownMenuItem
                        onClick={() => {
                          triggerHaptic('selection');
                          setShowFoodArchived(true);
                          setSelectedCategory('all');
                        }}
                        className={cn(
                          'cursor-pointer flex items-center justify-between',
                          showFoodArchived && 'font-semibold bg-muted'
                        )}
                      >
                        <span>{t('common.archived', '已歸檔')}</span>
                        <span className="font-mono text-[10px] opacity-60 tabular-nums">
                          {totalArchivedFoods.length}
                        </span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                {(showFoodArchived || selectedCategory !== 'all') && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic('light');
                      setShowFoodArchived(false);
                      setSelectedCategory('all');
                    }}
                    className="p-1 pr-2 hover:opacity-70 cursor-pointer shrink-0"
                    title={t('diet.resetFilter', '重設')}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

            {/* 營養特徵選單 */}
            <div
              className={cn(
                'inline-flex items-center rounded-full text-xs font-mono transition-all border shrink-0',
                selectedNutritionTag !== 'all'
                  ? 'bg-foreground text-background border-foreground font-medium'
                  : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className={cn(
                        'flex items-center gap-1.5 py-1 pl-2.5 cursor-pointer focus:outline-none whitespace-nowrap',
                        selectedNutritionTag !== 'all' ? 'pr-1' : 'pr-2'
                      )}
                    >
                      <SlidersHorizontal className="size-3 opacity-60 shrink-0" />
                      <span className="truncate">
                        {selectedNutritionTag === 'all'
                          ? t('diet.nutritionTags.title', '營養特徵')
                          : t(`diet.nutritionTags.${selectedNutritionTag}`)}
                      </span>
                      {selectedNutritionTag === 'all' && (
                        <ChevronDown className="size-3 opacity-60 shrink-0" />
                      )}
                    </button>
                  }
                />
                <DropdownMenuContent align="start" className="w-[180px] font-mono text-xs">
                  <DropdownMenuItem
                    onClick={() => {
                      triggerHaptic('selection');
                      setSelectedNutritionTag('all');
                    }}
                    className={cn(
                      'cursor-pointer flex items-center justify-between',
                      selectedNutritionTag === 'all' && 'font-semibold bg-muted'
                    )}
                  >
                    <span>{t('diet.nutritionTags.all', '全部')}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {tabBaseFoods.length}
                    </span>
                  </DropdownMenuItem>
                  {(
                    [
                      { id: 'carb-source', label: t('diet.nutritionTags.carb-source') },
                      { id: 'high-protein', label: t('diet.nutritionTags.high-protein') },
                      { id: 'fat-source', label: t('diet.nutritionTags.fat-source') },
                      { id: 'high-fiber', label: t('diet.nutritionTags.high-fiber') },
                      { id: 'low-calorie', label: t('diet.nutritionTags.low-calorie') },
                      { id: 'high-calorie', label: t('diet.nutritionTags.high-calorie') },
                    ] as const
                  ).map((tag) => (
                    <DropdownMenuItem
                      key={tag.id}
                      onClick={() => {
                        triggerHaptic('selection');
                        setSelectedNutritionTag(tag.id);
                      }}
                      className={cn(
                        'cursor-pointer flex items-center justify-between',
                        selectedNutritionTag === tag.id && 'font-semibold bg-muted'
                      )}
                    >
                      <span>{tag.label}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {nutritionTagCounts[tag.id]}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {selectedNutritionTag !== 'all' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('light');
                    setSelectedNutritionTag('all');
                  }}
                  className="p-1 pr-2 hover:opacity-70 cursor-pointer"
                  title={t('diet.resetFilter', '重設')}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* 排序功能選單 */}
            <div
              className={cn(
                'inline-flex items-center rounded-full text-xs font-mono transition-all border shrink-0',
                foodSortBy !== 'default'
                  ? 'bg-foreground text-background border-foreground font-medium'
                  : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className={cn(
                        'flex items-center gap-1.5 py-1 pl-2.5 cursor-pointer focus:outline-none whitespace-nowrap',
                        foodSortBy !== 'default' ? 'pr-1' : 'pr-2'
                      )}
                    >
                      <ArrowUpDown className="size-3 opacity-60 shrink-0" />
                      <span className="truncate">
                        {foodSortBy === 'default'
                          ? t('diet.sort.title', '排序')
                          : sortOptions.find((o) => o.id === foodSortBy)?.label ?? t('diet.sort.title', '排序')}
                      </span>
                      {foodSortBy === 'default' && (
                        <ChevronDown className="size-3 opacity-60 shrink-0" />
                      )}
                    </button>
                  }
                />
                <DropdownMenuContent align="start" className="w-[180px] font-mono text-xs">
                  {sortOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.id}
                      onClick={() => {
                        triggerHaptic('selection');
                        setFoodSortBy(opt.id);
                      }}
                      className={cn(
                        'cursor-pointer flex items-center justify-between',
                        foodSortBy === opt.id && 'font-semibold bg-muted'
                      )}
                    >
                      <span>{opt.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {foodSortBy !== 'default' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('light');
                    setFoodSortBy('default');
                  }}
                  className="p-1 pr-2 hover:opacity-70 cursor-pointer"
                  title={t('diet.resetFilter', '重設')}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* 新增食材按鈕 (靠右對齊，精確匹配過濾列高度與膠囊風格，分流權威科研庫與手動添加) */}
            {(onAddFood || onAdd || onAddAuthorityFood) && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className={cn(
                        'ml-auto items-center gap-1 py-1 px-2.5 rounded-full text-xs font-mono border border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border transition-all cursor-pointer shrink-0 active:scale-95 whitespace-nowrap',
                        interactiveMode === 'manage' ? 'hidden md:inline-flex' : 'inline-flex'
                      )}
                      title={t('common.add', '新增')}
                      aria-label={t('common.add', '新增')}
                    >
                      <Plus className="size-3" />
                      <span>{t('common.add', '新增')}</span>
                      <ChevronDown className="size-2.5 opacity-60 ml-0.5" />
                    </button>
                  }
                />
                <DropdownMenuContent align="end" className="w-[230px] p-1 font-sans">
                  <DropdownMenuItem
                    onClick={() => {
                      triggerHaptic('light');
                      if (onAddFood) {
                        onAddFood();
                      } else if (onAdd) {
                        onAdd('food');
                      }
                    }}
                    className="flex items-start gap-2.5 p-2 cursor-pointer rounded-md"
                  >
                    <PenLine className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium text-xs text-foreground">
                        {t('diet.addManualFood', '手動添加')}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {t('diet.addManualFoodDesc', '自行填寫營養素與自定義食材')}
                      </span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      triggerHaptic('light');
                      if (onAddAuthorityFood) {
                        onAddAuthorityFood();
                      } else {
                        setIsInternalAuthorityOpen(true);
                      }
                    }}
                    className="flex items-start gap-2.5 p-2 cursor-pointer rounded-md"
                  >
                    <Database className="size-4 mt-0.5 text-primary shrink-0" />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium text-xs text-foreground">
                        {t('diet.addAuthorityFood', '從權威數據庫搜索添加')}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {t('diet.addAuthorityFoodDesc', '六大權威庫 · 18,635 項')}
                      </span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* 食材清單容器 */}
          <div
            className={cn(
              'border border-border rounded-lg overflow-hidden bg-card text-card-foreground flex-1 min-h-0 flex flex-col',
              listContainerClassName
            )}
          >
            {/* 內嵌儀表表頭 */}
            <div className="h-10 px-4 bg-muted/40 border-b border-border flex items-center justify-between text-xs font-mono text-muted-foreground shrink-0">
              <span className="text-xs uppercase tracking-wider font-medium text-foreground">
                {t('common.itemCount', { count: filteredFoods.length })}
              </span>
              <NutritionBasisToggle />
            </div>

            {/* 滾動內容區 */}
            <div className="divide-y divide-border overflow-y-auto flex-1 min-h-0">
              {(() => {
                const trimmedFoodQuery = foodSearchQuery.trim();
                const authoritySearchButton =
                  !showFoodArchived && trimmedFoodQuery.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        if (onAddAuthorityFood) {
                          onAddAuthorityFood(trimmedFoodQuery);
                        } else {
                          setInternalAuthorityQuery(trimmedFoodQuery);
                          setIsInternalAuthorityOpen(true);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full text-xs font-mono transition-all border border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border py-1 px-3 cursor-pointer select-none active:scale-95"
                    >
                      <Search className="size-3 opacity-60 shrink-0" />
                      <span>{t('diet.searchInAuthority', { query: trimmedFoodQuery })}</span>
                    </button>
                  ) : null;

                if (filteredFoods.length === 0) {
                  return (
                    <div className="p-8 flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                      <span>
                        {trimmedFoodQuery
                          ? t('common.noResults', '無搜尋結果')
                          : showFoodArchived
                          ? t('settings.noArchivedFoods')
                          : t('settings.noCustomFoods')}
                      </span>
                      {authoritySearchButton}
                    </div>
                  );
                }

                return (
                  <>
                    {visibleFoods.map((food) => {
                      const isDisabled = checkIsFoodDisabled(food);
                      return (
                        <FoodListItem
                          key={food.id}
                          food={food}
                          disabled={isDisabled}
                          selected={interactiveMode === 'select' && selectedId === food.id}
                          onSelect={handleSelectFood}
                          nutritionDisplayMode={nutritionDisplayMode}
                          foodWeightUnit={foodWeightUnit}
                          foodVolumeUnit={foodVolumeUnit}
                          energyUnit={energyUnit}
                        />
                      );
                    })}
                    {visibleFoodCount < filteredFoods.length && (
                      <div
                        ref={foodSentinelRef}
                        className="h-8 flex items-center justify-center text-xs text-muted-foreground font-mono shrink-0 pointer-events-none"
                        aria-hidden="true"
                      />
                    )}
                    {authoritySearchButton && (
                      <div className="p-3 flex justify-center">{authoritySearchButton}</div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 視圖 2：食譜配方 (Recipes) */}
      {/* ========================================================================= */}
      {hasMountedRecipes && (
        <div className={cn('space-y-2.5 flex-1 min-h-0 flex flex-col', viewTab !== 'recipes' && 'hidden')}>
          {/* 搜尋輸入框 (僅單 Tab 模式時獨立渲染) */}
          {mode !== 'all' && (
            <div className="relative flex items-center shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                value={recipeSearchQuery}
                onChange={(e) => setRecipeSearchQuery(e.target.value)}
                placeholder={t('diet.searchRecipePlaceholder', '搜尋食譜名稱...')}
                className="h-10 pl-9 pr-9 text-xs rounded-lg border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-foreground focus:ring-0 focus-visible:ring-0 shadow-none"
              />
              {recipeSearchQuery && (
                <button
                  type="button"
                  onClick={() => setRecipeSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}

          {/* 工具過濾與排序列 */}
          <div
            className={cn(
              'flex items-center gap-1.5 shrink-0 py-0.5 overflow-x-auto no-scrollbar min-w-0',
              interactiveMode === 'manage' && '-mx-4 px-4 md:mx-0 md:px-0'
            )}
          >
            {/* 狀態下拉膠囊：全部 vs 已歸檔（有歸檔選項時置於營養特徵左側） */}
            {showArchivedOption && (
              <div
                className={cn(
                  'inline-flex items-center rounded-full text-xs font-sans transition-all border shrink-0',
                  showRecipeArchived
                    ? 'bg-foreground text-background border-foreground font-medium'
                    : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className={cn(
                          'flex items-center gap-1.5 py-1 pl-2.5 cursor-pointer focus:outline-none whitespace-nowrap',
                          showRecipeArchived ? 'pr-1' : 'pr-2'
                        )}
                      >
                        <LayoutGrid className="size-3 opacity-60 shrink-0" />
                        <span className="truncate">
                          {showRecipeArchived
                            ? t('common.archived', '已歸檔')
                            : t('diet.foodCategory.all', '全部')}
                        </span>
                        {!showRecipeArchived && (
                          <ChevronDown className="size-3 opacity-60 shrink-0" />
                        )}
                      </button>
                    }
                  />
                  <DropdownMenuContent align="start" className="w-[150px] text-xs font-sans">
                    <DropdownMenuItem
                      onClick={() => {
                        triggerHaptic('selection');
                        setShowRecipeArchived(false);
                      }}
                      className={cn(
                        'cursor-pointer flex items-center justify-between',
                        !showRecipeArchived && 'font-semibold bg-muted'
                      )}
                    >
                      <span>{t('diet.foodCategory.all', '全部')}</span>
                      <span className="font-mono text-[10px] opacity-60 tabular-nums">
                        {totalActiveRecipes.length}
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        triggerHaptic('selection');
                        setShowRecipeArchived(true);
                      }}
                      className={cn(
                        'cursor-pointer flex items-center justify-between',
                        showRecipeArchived && 'font-semibold bg-muted'
                      )}
                    >
                      <span>{t('common.archived', '已歸檔')}</span>
                      <span className="font-mono text-[10px] opacity-60 tabular-nums">
                        {totalArchivedRecipes.length}
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {showRecipeArchived && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic('light');
                      setShowRecipeArchived(false);
                    }}
                    className="p-1 pr-2 hover:opacity-70 cursor-pointer shrink-0"
                    title={t('diet.resetFilter', '重設')}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            )}

            {/* 營養特徵選單 */}
            <div
              className={cn(
                'inline-flex items-center rounded-full text-xs font-mono transition-all border shrink-0',
                selectedRecipeNutritionTag !== 'all'
                  ? 'bg-foreground text-background border-foreground font-medium'
                  : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className={cn(
                        'flex items-center gap-1.5 py-1 pl-2.5 cursor-pointer focus:outline-none whitespace-nowrap',
                        selectedRecipeNutritionTag !== 'all' ? 'pr-1' : 'pr-2'
                      )}
                    >
                      <SlidersHorizontal className="size-3 opacity-60 shrink-0" />
                      <span className="truncate">
                        {selectedRecipeNutritionTag === 'all'
                          ? t('diet.nutritionTags.title', '營養特徵')
                          : t(`diet.nutritionTags.${selectedRecipeNutritionTag}`)}
                      </span>
                      {selectedRecipeNutritionTag === 'all' && (
                        <ChevronDown className="size-3 opacity-60 shrink-0" />
                      )}
                    </button>
                  }
                />
                <DropdownMenuContent align="start" className="w-[180px] font-mono text-xs">
                  <DropdownMenuItem
                    onClick={() => {
                      triggerHaptic('selection');
                      setSelectedRecipeNutritionTag('all');
                    }}
                    className={cn(
                      'cursor-pointer flex items-center justify-between',
                      selectedRecipeNutritionTag === 'all' && 'font-semibold bg-muted'
                    )}
                  >
                    <span>{t('diet.nutritionTags.all', '全部')}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {tabBaseRecipes.length}
                    </span>
                  </DropdownMenuItem>
                  {(
                    [
                      { id: 'carb-source', label: t('diet.nutritionTags.carb-source') },
                      { id: 'high-protein', label: t('diet.nutritionTags.high-protein') },
                      { id: 'fat-source', label: t('diet.nutritionTags.fat-source') },
                      { id: 'high-fiber', label: t('diet.nutritionTags.high-fiber') },
                      { id: 'low-calorie', label: t('diet.nutritionTags.low-calorie') },
                      { id: 'high-calorie', label: t('diet.nutritionTags.high-calorie') },
                    ] as const
                  ).map((tag) => (
                    <DropdownMenuItem
                      key={tag.id}
                      onClick={() => {
                        triggerHaptic('selection');
                        setSelectedRecipeNutritionTag(tag.id);
                      }}
                      className={cn(
                        'cursor-pointer flex items-center justify-between',
                        selectedRecipeNutritionTag === tag.id && 'font-semibold bg-muted'
                      )}
                    >
                      <span>{tag.label}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {recipeNutritionTagCounts[tag.id]}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {selectedRecipeNutritionTag !== 'all' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('light');
                    setSelectedRecipeNutritionTag('all');
                  }}
                  className="p-1 pr-2 hover:opacity-70 cursor-pointer"
                  title={t('diet.resetFilter', '重設')}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* 排序功能選單 */}
            <div
              className={cn(
                'inline-flex items-center rounded-full text-xs font-mono transition-all border shrink-0',
                recipeSortBy !== 'default'
                  ? 'bg-foreground text-background border-foreground font-medium'
                  : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className={cn(
                        'flex items-center gap-1.5 py-1 pl-2.5 cursor-pointer focus:outline-none whitespace-nowrap',
                        recipeSortBy !== 'default' ? 'pr-1' : 'pr-2'
                      )}
                    >
                      <ArrowUpDown className="size-3 opacity-60 shrink-0" />
                      <span className="truncate">
                        {recipeSortBy === 'default'
                          ? t('diet.sort.title', '排序')
                          : sortOptions.find((o) => o.id === recipeSortBy)?.label ?? t('diet.sort.title', '排序')}
                      </span>
                      {recipeSortBy === 'default' && (
                        <ChevronDown className="size-3 opacity-60 shrink-0" />
                      )}
                    </button>
                  }
                />
                <DropdownMenuContent align="start" className="w-[180px] font-mono text-xs">
                  {sortOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.id}
                      onClick={() => {
                        triggerHaptic('selection');
                        setRecipeSortBy(opt.id);
                      }}
                      className={cn(
                        'cursor-pointer flex items-center justify-between',
                        recipeSortBy === opt.id && 'font-semibold bg-muted'
                      )}
                    >
                      <span>{opt.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {recipeSortBy !== 'default' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('light');
                    setRecipeSortBy('default');
                  }}
                  className="p-1 pr-2 hover:opacity-70 cursor-pointer"
                  title={t('diet.resetFilter', '重設')}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* 新增食譜按鈕 (靠右對齊，精確匹配過濾列高度與膠囊風格) */}
            {(onAddRecipe || onAdd) && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  if (onAddRecipe) {
                    onAddRecipe();
                  } else if (onAdd) {
                    onAdd('recipe');
                  }
                }}
                className={cn(
                  'ml-auto items-center gap-1 py-1 px-2.5 rounded-full text-xs font-mono border border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border transition-all cursor-pointer shrink-0 active:scale-95 whitespace-nowrap',
                  interactiveMode === 'manage' ? 'hidden md:inline-flex' : 'inline-flex'
                )}
                title={t('common.add', '新增')}
                aria-label={t('common.add', '新增')}
              >
                <Plus className="size-3" />
                <span>{t('common.add', '新增')}</span>
              </button>
            )}
          </div>

          {/* 食譜清單容器 */}
          <div
            className={cn(
              'border border-border rounded-lg overflow-hidden bg-card text-card-foreground flex-1 min-h-0 flex flex-col',
              listContainerClassName
            )}
          >
            {/* 內嵌儀表表頭 */}
            <div className="h-10 px-4 bg-muted/40 border-b border-border flex items-center justify-between text-xs font-mono text-muted-foreground shrink-0">
              <span className="text-xs uppercase tracking-wider font-medium text-foreground">
                {t('common.itemCount', { count: filteredRecipes.length })}
              </span>
              <NutritionBasisToggle />
            </div>

            {/* 滾動內容區 */}
            <div className="divide-y divide-border overflow-y-auto flex-1 min-h-0">
              {filteredRecipes.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {recipeSearchQuery.trim()
                    ? t('common.noResults', '無搜尋結果')
                    : showRecipeArchived
                    ? t('settings.noArchivedRecipes')
                    : t('diet.noRecipes')}
                </div>
              ) : (
                <>
                  {visibleRecipes.map((recipe) => {
                    const isDisabled = checkIsRecipeDisabled(recipe);
                    return (
                      <RecipeListItem
                        key={recipe.id}
                        recipe={recipe}
                        macros={getRecipeMacros(recipe)}
                        disabled={isDisabled}
                        selected={interactiveMode === 'select' && selectedId === recipe.id}
                        onSelect={handleSelectRecipe}
                        nutritionDisplayMode={nutritionDisplayMode}
                        foodWeightUnit={foodWeightUnit}
                        foodVolumeUnit={foodVolumeUnit}
                        energyUnit={energyUnit}
                      />
                    );
                  })}
                  {visibleRecipeCount < filteredRecipes.length && (
                    <div
                      ref={recipeSentinelRef}
                      className="h-8 flex items-center justify-center text-xs text-muted-foreground font-mono shrink-0 pointer-events-none"
                      aria-hidden="true"
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 內部權威科研庫搜索添加彈窗 */}
      <AuthorityFoodSearchDialog
        open={isInternalAuthorityOpen}
        onOpenChange={setIsInternalAuthorityOpen}
        initialQuery={internalAuthorityQuery}
        onSelectFood={handleSelectFood}
      />
    </div>
  );
}
