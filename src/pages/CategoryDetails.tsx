import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { Edit2, Archive, RefreshCcw, Trash2, Layers, ChevronRight } from 'lucide-react';
import { useFoods } from '@/hooks/useFoods';
import { useRecipes } from '@/hooks/useRecipes';
import {
  getInMemoryDailyDietLogsCache,
  setInMemoryDailyDietLogsCache,
} from '@/hooks/useFoodLogs';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/db/db';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { MetricValue } from '@/components/ui/metric-value';
import { SectionCard } from '@/components/ui/section-card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toast';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { formatFoodDisplayName } from '@/utils/foodNaming';
import { getLocalizedFoodName } from '@/utils/defaultLocalization';
import { useAppStore } from '@/store/useAppStore';
import { calculateScaledNutrition } from '@/utils/nutritionMath';
import { NutritionFactsCard } from '@/components/food/NutritionFactsCard';
import { AuthorityFoodDetailsDialog } from '@/components/food/AuthorityFoodDetailsDialog';
import { FoodFormDialog, type FoodFormData } from '@/components/food/FoodFormDialog';
import { useUnitPreferences } from '@/hooks/useUnitPreferences';
import { formatEnergy, formatFoodServing } from '@/utils/unitMath';
import type { NutritionTag, FoodLog } from '@/types';
import { evaluateNutritionalHighlight } from '@/utils/nutritionEvaluation';
import {
  type OverviewPeriod,
  calculateTotalWeeks,
  calculateFootprintData,
  getInitialMatrixContainerWidth,
} from '@/utils/heatmapMath';
import { useSafeNavigate } from '@/hooks/useSafeNavigate';
import { APP_ROUTES } from '@/utils/navigation';
import {
  OverviewPeriodSelector,
  IntakeFootprintHeatmap,
} from '@/components/food/IntakeFootprintHeatmap';

export interface CategoryDetailsProps {
  id: string;
}

export default function CategoryDetails({ id }: CategoryDetailsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { goBack } = useSafeNavigate();
  const confirm = useConfirm();
  const isExitingRef = useRef(false);

  useEffect(() => {
    isExitingRef.current = false;
  }, [id]);
  const { allFoods, isLoading, updateFood, archiveFood, unarchiveFood, deleteFood } = useFoods();
  const { allRecipes } = useRecipes();
  const { nutritionDisplayMode } = useAppStore();
  const { foodWeightUnit, foodVolumeUnit, energyUnit } = useUnitPreferences();
  const [overviewPeriod, setOverviewPeriod] = useState<OverviewPeriod>('30d');

  const food = useMemo(() => {
    return allFoods.find((f) => f.id === id);
  }, [allFoods, id]);

  const scaledNutrition = useMemo(() => {
    if (!food) return null;
    return calculateScaledNutrition(food, nutritionDisplayMode, {
      foodWeightUnit,
      foodVolumeUnit,
    });
  }, [food, nutritionDisplayMode, foodWeightUnit, foodVolumeUnit]);

  const evalRes = useMemo(() => {
    if (!food) return null;
    return evaluateNutritionalHighlight(food);
  }, [food]);

  const getNutritionTagBadgeClass = (tag: NutritionTag) => {
    switch (tag) {
      case 'high-protein':
        return 'text-protein border-protein-subtle-border bg-protein-subtle';
      case 'carb-source':
      case 'high-fiber':
        return 'text-carbs border-carbs-subtle-border bg-carbs-subtle';
      case 'fat-source':
        return 'text-fat border-fat-subtle-border bg-fat-subtle';
      case 'low-calorie':
        return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10';
      case 'high-calorie':
        return 'text-rose-500 border-rose-500/30 bg-rose-500/10';
      default:
        return 'text-muted-foreground border-border bg-muted/30';
    }
  };



  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSourceDetailsOpen, setIsSourceDetailsOpen] = useState(false);

  const effectiveFood = food;
  const effectiveDataSource = food?.dataSource;

  const [headerActionEl, setHeaderActionEl] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' ? document.getElementById('subpage-header-action') : null
  );

  useEffect(() => {
    if (!headerActionEl) {
      // oxlint-disable-next-line react/set-state-in-effect
      setHeaderActionEl(document.getElementById('subpage-header-action'));
    }
  }, [headerActionEl]);

  const handleEditSubmit = async (formData: FoodFormData) => {
    if (!food) return;

    await updateFood(food.id, formData);

    triggerHaptic('success');
    toast.show(t('common.saved'));
    setIsEditOpen(false);
  };

  // 取得每日飲食日誌（具備記憶體快取第 0 幀同步注水）
  const liveDailyLogs = useLiveQuery(
    async () => {
      const result = await db.daily_diet_logs.toArray();
      setInMemoryDailyDietLogsCache(result);
      return result;
    },
    []
  );
  const dailyLogs = liveDailyLogs ?? getInMemoryDailyDietLogsCache();

  // 取得此食物所有的歷史飲食記錄
  const foodLogs = useMemo(() => {
    if (!id || !food || !dailyLogs) return [];
    const logs: FoodLog[] = [];
    for (const daily of dailyLogs) {
      for (const entry of daily.entries) {
        if (entry.foodId === id) {
          logs.push({ ...entry, date: daily.date });
        }
      }
    }
    return logs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [dailyLogs, id, food]);

  // 檢查此食物是否被食譜組合引用（直接從記憶體快取 allRecipes 同步計算，0 IndexedDB 查詢）
  const referencingRecipes = useMemo(() => {
    if (!id) return [];
    return allRecipes.filter((r) => r.ingredients.some((ing) => ing.foodId === id));
  }, [allRecipes, id]);

  const hasUsage = foodLogs.length > 0 || referencingRecipes.length > 0;

  const handleToggleArchive = async () => {
    if (!food) return;
    const foodDisplayName = formatFoodDisplayName(food);
    if (food.isArchived) {
      const ok = await confirm({
        title: t('common.restore'),
        variant: 'restore',
        entitySpec: {
          entityLabel: t('diet.foodEntityLabel', '食物'),
          itemName: foodDisplayName,
        },
      });
      if (ok) {
        await unarchiveFood(food.id);
        triggerHaptic('success');
        toast.show(t('common.saved'));
      }
    } else {
      const ok = await confirm({
        title: t('common.archive'),
        variant: 'archive',
        entitySpec: {
          entityLabel: t('diet.foodEntityLabel', '食物'),
          itemName: foodDisplayName,
          affectedLabel: t('diet.archiveRemoveFromRecipes', '從食譜剔除'),
          affectedItems: referencingRecipes.map((r) => r.name),
        },
      });
      if (ok) {
        await archiveFood(food.id);
        triggerHaptic('selection');
        toast.show(t('common.archivedSuccess', '已歸檔'));
      }
    }
  };

  const handleDelete = async () => {
    if (!food || hasUsage) return;
    const ok = await confirm({
      title: t('common.delete'),
      variant: 'destructive',
      entitySpec: {
        entityLabel: t('diet.foodEntityLabel', '食物'),
        itemName: formatFoodDisplayName(food),
      },
    });
    if (ok) {
      isExitingRef.current = true;
      const res = await deleteFood(food.id);
      if (!res.success) {
        isExitingRef.current = false;
        if (res.reason === 'has_logs') {
          toast.show(t('settings.foodHasLogsCannotDelete'));
        } else if (res.reason === 'has_recipes') {
          toast.show(t('diet.foodHasRecipes', '已被菜餚引用'));
        } else {
          toast.show(t('common.error'));
        }
        return;
      }
      triggerHaptic('warning');
      toast.show(t('common.deleted'));
      goBack();
    }
  };


  const [matrixContainerWidth, setMatrixContainerWidth] = useState<number>(
    getInitialMatrixContainerWidth
  );

  const totalWeeks = useMemo(() => {
    return calculateTotalWeeks({
      logs: foodLogs,
      matrixContainerWidth,
    });
  }, [foodLogs, matrixContainerWidth]);

  const { heatmapDays, periodCalories, periodCount, periodMaxGrams } = useMemo(() => {
    return calculateFootprintData({
      logs: foodLogs,
      overviewPeriod,
      totalWeeks,
    });
  }, [foodLogs, overviewPeriod, totalWeeks]);

  useEffect(() => {
    if (!isExitingRef.current && (!id || (!isLoading && !food))) {
      isExitingRef.current = true;
      goBack();
    }
  }, [id, isLoading, food, goBack]);

  if (!id) return null;

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm font-mono text-muted-foreground">
        {t('common.loading')}
      </div>
    );
  }

  if (!food) {
    return null;
  }

  const refuseRate = food.refuseRate ?? 0;
  const edibleRate = food.edibleRate ?? Math.max(0, 1 - refuseRate);
  const ediblePct = Math.round(edibleRate * 100);
  const servingFormatted = formatFoodServing(
    food.servingSize || 100,
    food.servingUnit || 'g',
    foodWeightUnit,
    foodVolumeUnit
  );

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 pb-20">
      {/* 頂部操作按鈕 (Portal 映射至 AppLayout 頂部標頭右側) */}
      {headerActionEl &&
        createPortal(
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={hasUsage}
              className={cn(
                "size-8 text-muted-foreground transition-colors",
                hasUsage
                  ? "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground"
                  : "hover:text-destructive hover:bg-destructive-subtle cursor-pointer"
              )}
              title={hasUsage ? t('diet.foodHasUsageCannotDelete') : t('common.delete')}
              aria-label={t('common.delete')}
            >
              <Trash2 className="size-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleToggleArchive}
              className="size-8 text-muted-foreground hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
              title={food.isArchived ? t('common.restore') : t('common.archive')}
              aria-label={food.isArchived ? t('common.restore') : t('common.archive')}
            >
              {food.isArchived ? (
                <RefreshCcw className="size-4" />
              ) : (
                <Archive className="size-4" />
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsEditOpen(true)}
              className="size-8 text-muted-foreground hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
              title={t('common.edit')}
              aria-label={t('common.edit')}
            >
              <Edit2 className="size-4" />
            </Button>
          </div>,
          headerActionEl
        )}

      {/* 方案 B-1 + 10px 熱點圖全一體化卡片 */}
      <div className="border border-border rounded-lg overflow-hidden bg-card text-card-foreground shadow-none">
        {/* 第 1 層：B-1 極簡 HUD 規格條 (h-10，與下方 SectionCard 表頭等高) */}
        <div className="h-10 px-4 border-b border-border bg-muted/40 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="uppercase tracking-widest text-[10px] text-muted-foreground">
              {t(`diet.foodCategory.${food.category || 'natural'}`)}
            </span>
            {food.brand && (
              <>
                <span className="text-border select-none">·</span>
                <span className="text-muted-foreground text-[11px]">{food.brand}</span>
              </>
            )}
            {effectiveDataSource && (
              <>
                <span className="text-border select-none">·</span>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setIsSourceDetailsOpen(true);
                  }}
                  className="group px-1.5 py-0.5 rounded border border-transparent hover:border-border/80 hover:bg-background/80 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-all cursor-pointer select-none inline-flex items-center gap-0.5 active:scale-95"
                  title={t('diet.viewAuthorityDetails')}
                  aria-label={t('diet.viewAuthorityDetails')}
                >
                  <span>
                    {effectiveDataSource.authority} {effectiveDataSource.sourceId}
                  </span>
                  <ChevronRight className="size-2.5 hidden group-hover:inline-block shrink-0" />
                </button>
              </>
            )}
          </div>
          <div>
            {food.isArchived ? (
              <span className="text-[10px] font-mono text-destructive tracking-wide">
                {t('common.archived')}
              </span>
            ) : (
              <span className="text-[10px] font-mono text-emerald-500 tracking-wide">
                {t('common.active')}
              </span>
            )}
          </div>
        </div>

        {/* 第 2 層：B-1 大氣品名帶與可食率、特質微徽章（標題永遠優先，窄寬度自動摺疊標籤） */}
        <div className="min-h-[68px] py-3 px-3.5 sm:px-4 border-b border-border flex items-center justify-between gap-2.5 bg-card">
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate min-w-0">
              {getLocalizedFoodName(food)}
            </h1>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
                <span>{t('diet.perServing')}</span>
                <MetricValue
                  value={servingFormatted.size}
                  unit={servingFormatted.unit}
                  className="text-foreground"
                />
              </span>
              <span className="text-border select-none">·</span>
              <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
                <span>{t('diet.edibleRate')}</span>
                <MetricValue value={ediblePct} unit="%" className="text-foreground" />
              </span>
            </div>
          </div>
          {evalRes?.labels && evalRes.labels.length > 0 && (() => {
            const labels = evalRes.labels;
            return (
              <div className="shrink-0 max-w-[46%] sm:max-w-[55%] flex items-center justify-end gap-1.5">
                {labels.slice(0, 2).map((tag, idx) => (
                  <span
                    key={tag}
                    className={cn(
                      "text-[11px] font-mono border px-1.5 py-0.5 rounded font-medium whitespace-nowrap truncate",
                      idx === 1 && "hidden sm:inline-flex",
                      getNutritionTagBadgeClass(tag)
                    )}
                  >
                    {t(`diet.nutritionTags.${tag}`)}
                  </span>
                ))}

                {labels.length > 1 && (
                  <Popover>
                    <PopoverTrigger
                      render={
                        <button
                          type="button"
                          onClick={() => triggerHaptic('light')}
                          className={cn(
                            "text-[11px] font-mono border border-border bg-muted/40 hover:bg-hover text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors",
                            labels.length <= 2 ? "inline-flex sm:hidden" : "inline-flex"
                          )}
                        >
                          <span className="sm:hidden">+{labels.length - 1}</span>
                          <span className="hidden sm:inline">+{labels.length - 2}</span>
                        </button>
                      }
                    />
                    <PopoverContent
                      align="end"
                      side="bottom"
                      sideOffset={6}
                      className="w-auto max-w-[260px] p-2 bg-popover border border-border rounded-lg shadow-none"
                    >
                      <div className="flex flex-wrap gap-1.5">
                        {labels.map((tag) => (
                          <span
                            key={tag}
                            className={cn(
                              "text-[11px] font-mono border px-1.5 py-0.5 rounded font-medium whitespace-nowrap",
                              getNutritionTagBadgeClass(tag)
                            )}
                          >
                            {t(`diet.nutritionTags.${tag}`)}
                          </span>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            );
          })()}
        </div>

        {/* 第 3 層：三大指標三欄分割卡片 (高度 68px 與品名帶等高，支援 1w/30d/3m/6m/1y/all 切換) */}
        <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-card h-[68px]">
          {/* 1. 總攝入 */}
          <div className="h-[68px] px-2.5 sm:px-4 py-2.5 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-muted-foreground truncate">
                {t('stats.totalIntake')}
              </span>
              <OverviewPeriodSelector
                value={overviewPeriod}
                onChange={setOverviewPeriod}
              />
            </div>
            <div className="text-sm sm:text-base font-mono tracking-tight flex items-baseline whitespace-nowrap">
              <span className="font-normal text-foreground tabular-nums">
                {formatEnergy(periodCalories, energyUnit).value.toLocaleString()}
              </span>
              <span className="font-sans text-xs font-normal text-muted-foreground ml-0.5">
                {energyUnit}
              </span>
            </div>
          </div>

          {/* 2. 次數 */}
          <div className="h-[68px] px-2.5 sm:px-4 py-2.5 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-muted-foreground truncate">
                {t('stats.frequency')}
              </span>
              <OverviewPeriodSelector
                value={overviewPeriod}
                onChange={setOverviewPeriod}
              />
            </div>
            <div className="text-sm sm:text-base font-mono tracking-tight flex items-baseline whitespace-nowrap">
              <span className="font-normal text-foreground tabular-nums">
                {periodCount.toLocaleString()}
              </span>
              <span className="font-sans text-xs font-normal text-muted-foreground ml-0.5">
                {t('common.times')}
              </span>
            </div>
          </div>

          {/* 3. 最大量 */}
          <div className="h-[68px] px-2.5 sm:px-4 py-2.5 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-muted-foreground truncate">
                {t('stats.maxDaily')}
              </span>
              <OverviewPeriodSelector
                value={overviewPeriod}
                onChange={setOverviewPeriod}
              />
            </div>
            <div className="text-sm sm:text-base font-mono tracking-tight flex items-baseline whitespace-nowrap">
              <span className="font-normal text-foreground tabular-nums">
                {formatFoodServing(periodMaxGrams, 'g', foodWeightUnit, foodVolumeUnit).size.toLocaleString()}
              </span>
              <span className="font-sans text-xs font-normal text-muted-foreground ml-0.5">
                {formatFoodServing(periodMaxGrams, 'g', foodWeightUnit, foodVolumeUnit).unit}
              </span>
            </div>
          </div>
        </div>

        {/* 第 4 層：微型 GitHub 熱點矩陣 (可左右滾動查看更早歷史，預設對齊今天) + 選定日期數據檢測 */}
        <IntakeFootprintHeatmap
          heatmapDays={heatmapDays}
          totalWeeks={totalWeeks}
          isLoading={isLoading}
          onContainerWidthChange={setMatrixContainerWidth}
        />
      </div>

      {/* 每份營養素標籤基準卡片 (共用通用元件) */}
      <NutritionFactsCard
        title={t('diet.servingNutrients', '基準營養素')}
        data={scaledNutrition}
        fallbackData={food}
        highlights={evalRes?.highlights}
      />

      {/* 包含此食物的食譜組合 */}
      <SectionCard title={t('diet.relatedRecipes')}>
        {referencingRecipes.length === 0 ? (
          <div className="p-4 text-center text-xs font-mono text-muted-foreground">
            {t('diet.noRelatedRecipes')}
          </div>
        ) : (
          referencingRecipes.map((recipe) => (
            <button
              key={recipe.id}
              type="button"
              onClick={() => {
                triggerHaptic('light');
                navigate(APP_ROUTES.recipeDetail(recipe.id));
              }}
              className="w-full p-3.5 flex items-center justify-between gap-2 hover:bg-hover transition-colors group cursor-pointer text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="size-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-foreground truncate">
                  {recipe.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground group-hover:text-foreground shrink-0">
                <span>{t('diet.ingredientsCount', { count: recipe.ingredients.length })}</span>
                <ChevronRight className="size-4 opacity-50 group-hover:opacity-100" />
              </div>
            </button>
          ))
        )}
      </SectionCard>

      {/* 編輯食物 Dialog (FoodFormDialog 共用組件) */}
      <FoodFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        initialData={food}
        onSubmit={handleEditSubmit}
      />

      {/* 權威食物元素數據詳細 Dialog */}
      {effectiveFood && (
        <AuthorityFoodDetailsDialog
          food={effectiveFood}
          open={isSourceDetailsOpen}
          onOpenChange={setIsSourceDetailsOpen}
        />
      )}
    </div>
  );
}
