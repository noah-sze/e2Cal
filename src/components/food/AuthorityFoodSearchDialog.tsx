import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Plus, Check, Leaf } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogPrecisionHeader,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SectionCard } from '@/components/ui/section-card';
import { MetricValue } from '@/components/ui/metric-value';
import { MacroSquares } from '@/components/food/MacroSquares';
import { AuthorityFoodDetailsDialog } from '@/components/food/AuthorityFoodDetailsDialog';
import { FoodFormDialog, type FoodFormData } from '@/components/food/FoodFormDialog';
import { toast } from '@/components/ui/toast';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { FoodItem, AuthoritySource } from '@/types';
import { useFoods } from '@/hooks/useFoods';
import {
  searchAuthorityFoodsWithTotal,
  getAuthorityStats,
  importAuthorityFoodToDatabase,
  type AuthorityStats,
} from '@/services/authorityFoodService';

export interface AuthorityFoodSearchDialogProps {
  /** 控制彈窗開關 */
  open: boolean;
  /** 彈窗開關狀態變更回調 */
  onOpenChange: (open: boolean) => void;
  /** 選取回調：單筆導入後回傳該食物物件（例如在食物選擇彈窗中直接選取並繼續記錄） */
  onSelectFood?: (food: FoodItem) => void;
  /** 自訂初始搜尋關鍵字 */
  initialQuery?: string;
  /** 多層彈窗層級（Rule 4 規範） @default 80 */
  zIndex?: number;
  /** 自訂覆蓋樣式 */
  overlayClassName?: string;
  className?: string;
}

type AuthorityFilter = 'all' | AuthoritySource;

const AUTHORITY_FILTERS: readonly AuthorityFilter[] = [
  'all',
  'USDA',
  'TFDA',
  'CFCT',
  'MEXT',
  'AFCD',
  'CoFID',
];

const AUTHORITY_SOURCES: readonly AuthoritySource[] = [
  'USDA',
  'CoFID',
  'MEXT',
  'TFDA',
  'CFCT',
  'AFCD',
];

const AUTHORITY_SPEC_ROWS = [
  {
    labelKey: 'diet.authoritySpecStateLabel',
    labelFallback: '預設狀態',
    valueKey: 'diet.authoritySpecStateValue',
    valueFallback: '未標註熟製者，一律為生重',
  },
  {
    labelKey: 'diet.authoritySpecScopeLabel',
    labelFallback: '檢索範圍',
    valueKey: 'diet.authoritySpecScopeValue',
    valueFallback: '六大機構 · 100% 離線',
  },
] as const;

const SEARCH_MIN_DURATION_MS = 1000;
const SKELETON_NAME_WIDTHS = ['w-28', 'w-36', 'w-32', 'w-40', 'w-32'] as const;

export function AuthorityFoodSearchDialog({
  open,
  onOpenChange,
  onSelectFood,
  initialQuery = '',
  zIndex = 80,
  overlayClassName,
  className,
}: AuthorityFoodSearchDialogProps) {
  const { t } = useTranslation();
  const { allFoods } = useFoods();

  const [query, setQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<AuthorityFilter>('all');
  const [rawOnly, setRawOnly] = useState(true);
  const [stats, setStats] = useState<AuthorityStats | null>(null);
  const [results, setResults] = useState<FoodItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [displayLimit, setDisplayLimit] = useState(80);
  const [isSearching, setIsSearching] = useState(false);
  const [settledQuery, setSettledQuery] = useState('');
  const [locallyImportedIds, setLocallyImportedIds] = useState<Set<string>>(new Set());
  const [previewFood, setPreviewFood] = useState<FoodItem | null>(null);
  const [importDraftFood, setImportDraftFood] = useState<FoodItem | null>(null);
  const searchSeqRef = useRef(0);
  const lastExecutedRef = useRef<{
    query: string;
    filter: AuthorityFilter;
    rawOnly: boolean;
    limit: number;
  } | null>(null);

  // 現存本機食物 ID 集合（快速比對「已在食物庫」）
  const existingFoodIdSet = useMemo(() => {
    const set = new Set<string>();
    allFoods.forEach((f) => set.add(f.id));
    locallyImportedIds.forEach((id) => set.add(id));
    return set;
  }, [allFoods, locallyImportedIds]);

  const executeSearch = async (
    searchTerm: string,
    filter: AuthorityFilter,
    isRawOnly: boolean,
    limitCount: number,
    skipAnimation = false
  ) => {
    const trimmed = searchTerm.trim();
    const seq = ++searchSeqRef.current;

    if (!trimmed) {
      lastExecutedRef.current = null;
      setIsSearching(false);
      setResults([]);
      setTotalCount(0);
      setSettledQuery('');
      return;
    }

    lastExecutedRef.current = { query: trimmed, filter, rawOnly: isRawOnly, limit: limitCount };
    if (!skipAnimation) {
      setIsSearching(true);
    }

    try {
      const data = skipAnimation
        ? await searchAuthorityFoodsWithTotal(trimmed, limitCount, filter, undefined, isRawOnly)
        : (
            await Promise.all([
              searchAuthorityFoodsWithTotal(trimmed, limitCount, filter, undefined, isRawOnly),
              new Promise<void>((resolve) => setTimeout(resolve, SEARCH_MIN_DURATION_MS)),
            ])
          )[0];
      if (seq !== searchSeqRef.current) return;
      setResults(data.items);
      setTotalCount(data.total);
      setSettledQuery(trimmed);
    } catch (err) {
      if (seq !== searchSeqRef.current) return;
      console.error('[AuthoritySearch] 搜尋出錯:', err);
      setResults([]);
      setTotalCount(0);
      setSettledQuery(trimmed);
    } finally {
      if (seq === searchSeqRef.current) {
        setIsSearching(false);
      }
    }
  };

  // 重置狀態（嚴格禁止自動聚焦輸入框，避免手機鍵盤遮擋）
  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setDisplayLimit(80);
      setLocallyImportedIds(new Set());
      setPreviewFood(null);
      setImportDraftFood(null);
      if (initialQuery.trim()) {
        executeSearch(initialQuery, activeFilter, rawOnly, 80, false);
      } else {
        searchSeqRef.current += 1;
        lastExecutedRef.current = null;
        setIsSearching(false);
        setResults([]);
        setTotalCount(0);
        setSettledQuery('');
      }
      if (!stats) {
        getAuthorityStats().then(setStats).catch(() => {});
      }
    } else {
      searchSeqRef.current += 1;
      lastExecutedRef.current = null;
      setIsSearching(false);
      setResults([]);
      setTotalCount(0);
      setSettledQuery('');
    }
  }, [open, initialQuery]);

  // 關鍵字 / 來源 / 生重過濾變更時重設分頁上限
  useEffect(() => {
    setDisplayLimit(80);
  }, [query, activeFilter, rawOnly]);

  // 響應式搜尋：關鍵字變更時播放至少 1s 搜索動畫；僅切換來源分類 / 生重開關 / 載入更多時即時重篩不播放動畫
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      searchSeqRef.current += 1;
      lastExecutedRef.current = null;
      setIsSearching(false);
      setResults([]);
      setTotalCount(0);
      setSettledQuery('');
      return;
    }

    if (
      lastExecutedRef.current?.query === trimmed &&
      lastExecutedRef.current?.filter === activeFilter &&
      lastExecutedRef.current?.rawOnly === rawOnly &&
      lastExecutedRef.current?.limit === displayLimit
    ) {
      return;
    }

    if (settledQuery === trimmed) {
      executeSearch(trimmed, activeFilter, rawOnly, displayLimit, true);
      return;
    }

    const timer = setTimeout(() => {
      executeSearch(trimmed, activeFilter, rawOnly, displayLimit, false);
    }, 160);

    return () => clearTimeout(timer);
  }, [query, activeFilter, rawOnly, displayLimit, open, settledQuery]);

  // 經由 FoodFormDialog 編輯名稱、分類與確認後寫入資料庫
  const handleFormImportSubmit = async (formData: FoodFormData) => {
    if (!importDraftFood) return;
    const targetFood = importDraftFood;
    const mergedFood: FoodItem = {
      ...targetFood,
      ...formData,
      id: targetFood.id,
      dataSource: targetFood.dataSource ?? formData.dataSource,
    };

    try {
      const imported = await importAuthorityFoodToDatabase(mergedFood);
      triggerHaptic('success');
      toast.show(t('diet.importedFoodToast', { name: mergedFood.name }));

      setLocallyImportedIds((prev) => new Set(prev).add(targetFood.id));
      setImportDraftFood(null);

      if (onSelectFood) {
        onSelectFood(imported);
        onOpenChange(false);
      }
    } catch (err) {
      console.error('[AuthoritySearch] 導入失敗:', err);
      toast.show(t('common.error'));
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (previewFood || importDraftFood)) return;
    onOpenChange(nextOpen);
  };

  const zIndexClass = `z-[${zIndex}]`;
  const detailZIndexClass = `z-[${zIndex + 10}]`;
  const trimmedQuery = query.trim();
  const isInitialEmpty = !trimmedQuery;
  const isLoadingView = !isInitialEmpty && (isSearching || settledQuery !== trimmedQuery);

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          showCloseButton={false}
          initialFocus={false}
          className={cn(
            'flex flex-col w-[440px] max-w-[calc(100vw-24px)] sm:w-[440px] sm:max-w-[440px] h-[580px] max-h-[85vh] p-0 sm:p-0 gap-0 overflow-hidden bg-card border border-border shadow-none select-none',
            zIndexClass,
            className
          )}
          overlayClassName={cn(zIndexClass, overlayClassName)}
        >
          {/* 1 & 2. 頂部標頭與搜尋過濾區 */}
          <div data-slot="dialog-header" className="shrink-0 bg-card">
            {/* 1. 標準精密標頭 (h-7，無分割線) */}
            <div className="px-4 pt-4 pb-1">
              <DialogPrecisionHeader
                title={t('diet.authorityTitleShort', '食物資料庫')}
                onClose={() => onOpenChange(false)}
                cancelAriaLabel={t('common.close')}
              />
            </div>

            {/* 2. 搜尋欄與機構單行過濾條 */}
            <div className="px-4 py-2.5 border-b border-border space-y-2 bg-card">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('diet.authoritySearchPlaceholder')}
                  className="h-9 pl-8 pr-8 text-xs rounded-md border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus-visible:border-foreground focus:ring-0 focus-visible:ring-0 shadow-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label={t('common.clear', '清除')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 size-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-hover cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {AUTHORITY_FILTERS.map((auth) => (
                  <button
                    key={auth}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setActiveFilter(auth);
                    }}
                    className={cn(
                      'h-6 px-2 rounded text-[11px] font-mono transition-colors shrink-0 cursor-pointer',
                      activeFilter === auth
                        ? 'bg-foreground text-background font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-hover'
                    )}
                  >
                    {auth === 'all' ? t('common.all', '全部') : auth}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. 內容區域 */}
          <div
            className={cn(
              'flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-4 bg-background/40',
              isInitialEmpty ? 'pt-4' : 'pt-2.5 space-y-2.5'
            )}
          >
            {!isInitialEmpty && (
              <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setRawOnly((prev) => !prev);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-sans transition-all border shrink-0 cursor-pointer whitespace-nowrap',
                    rawOnly
                      ? 'bg-foreground text-background border-foreground font-medium'
                      : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border'
                  )}
                >
                  <Leaf className={cn('size-3 shrink-0', !rawOnly && 'opacity-60')} />
                  <span>{t('diet.rawOnlyFilter', '生重原型')}</span>
                </button>
              </div>
            )}
            {/* 搜尋中狀態（方案 A：1:1 等高骨架屏掃描，含 debounce 等待零空白過渡） */}
            {isLoadingView && (
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <div className="h-10 px-4 bg-muted/40 border-b border-border flex items-center justify-between text-xs text-muted-foreground font-mono">
                  <span>-</span>
                  <span>{t('common.loading')}</span>
                </div>

                <div className="divide-y divide-border">
                  {SKELETON_NAME_WIDTHS.map((widthClass, idx) => (
                    <div
                      key={idx}
                      className="min-h-16 py-2.5 px-4 flex items-center justify-between gap-2.5"
                    >
                      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                        <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
                        <div className={cn('h-3.5 rounded bg-muted animate-pulse', widthClass)} />
                        <div className="h-2.5 w-12 rounded bg-muted animate-pulse" />
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* 桌面端三格骨架 */}
                        <div className="hidden md:flex items-center gap-2">
                          <div className="w-11 h-9 rounded border border-border bg-muted/40 animate-pulse" />
                          <div className="w-11 h-9 rounded border border-border bg-muted/40 animate-pulse" />
                          <div className="w-11 h-9 rounded border border-border bg-muted/40 animate-pulse" />
                        </div>

                        {/* 手機端垂直三階微堆疊骨架 */}
                        <div className="flex md:hidden flex-col items-end gap-1 w-[50px]">
                          <div className="h-2.5 w-11 rounded bg-muted animate-pulse" />
                          <div className="h-2.5 w-11 rounded bg-muted animate-pulse" />
                          <div className="h-2.5 w-11 rounded bg-muted animate-pulse" />
                        </div>

                        <div className="size-7 rounded-full border border-border bg-muted/40 animate-pulse shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 首頁卡片：採用標準 SectionCard 呈現化驗基準與權威庫數據分佈 */}
            {isInitialEmpty && (
              <div className="space-y-3">
                <SectionCard title={t('diet.authorityDataSpecTitle', '化驗基準')}>
                  <div className="min-h-10 py-2 px-4 flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground shrink-0">
                      {t('diet.authoritySpecUnitLabel', '計量基準')}
                    </span>
                    <span className="inline-flex items-baseline gap-1.5 font-sans text-foreground text-right">
                      <span>{t('diet.authoritySpecUnitPrefix', '每')}</span>
                      <MetricValue value={100} unit="g" unitClassName="text-foreground" />
                      <span>{t('diet.authoritySpecUnitSuffix', '純可食部')}</span>
                    </span>
                  </div>
                  {AUTHORITY_SPEC_ROWS.map((row) => (
                    <div
                      key={row.labelKey}
                      className="min-h-10 py-2 px-4 flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-muted-foreground shrink-0">
                        {t(row.labelKey, row.labelFallback)}
                      </span>
                      <span className="font-mono text-foreground text-right">
                        {t(row.valueKey, row.valueFallback)}
                      </span>
                    </div>
                  ))}
                </SectionCard>

                <SectionCard
                  title={t('diet.authorityDataCoverage', '收錄範圍')}
                  action={
                    <span className="font-mono tabular-nums">
                      {stats ? (
                        <MetricValue
                          value={stats.total.toLocaleString()}
                          unit={t('common.items')}
                        />
                      ) : (
                        '-'
                      )}
                    </span>
                  }
                >
                  {AUTHORITY_SOURCES.map((auth) => {
                    const count = stats?.byAuthority[auth];
                    return (
                      <div
                        key={auth}
                        onClick={() => {
                          triggerHaptic('light');
                          setActiveFilter(auth);
                        }}
                        className={cn(
                          'min-h-10 py-2 px-4 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer hover:bg-hover',
                          activeFilter === auth && 'bg-muted/40'
                        )}
                      >
                        <span className="text-foreground truncate">
                          {t(`diet.authorityDetails.authorities.${auth}`, auth)}
                        </span>
                        <span className="font-mono tabular-nums text-muted-foreground shrink-0">
                          {count !== undefined ? count.toLocaleString() : '-'}
                        </span>
                      </div>
                    );
                  })}
                </SectionCard>
              </div>
            )}

            {/* 搜尋結果卡片 (0 筆時亦保留卡片骨架，僅顯示 0 項與單破折號) */}
            {!isInitialEmpty && !isLoadingView && (
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <div className="h-10 px-4 bg-muted/40 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono tabular-nums">
                    {t('common.itemCount', { count: totalCount })}
                  </span>
                  <span className="text-[11px] font-mono inline-flex items-baseline gap-1">
                    {activeFilter !== 'all' && <span>{activeFilter} ·</span>}
                    <MetricValue value={100} unit="g" />
                  </span>
                </div>

                {results.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    {t('common.noResults', '無搜尋結果')}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                  {results.map((food) => {
                    const isImported = existingFoodIdSet.has(food.id);
                    const refuseRate = food.refuseRate ?? 0;
                    const edibleRate = food.edibleRate ?? Math.max(0, 1 - refuseRate);
                    const ediblePct = Math.round(edibleRate * 100);
                    const authority = food.dataSource?.authority || 'USDA';

                    return (
                      <div
                        key={food.id}
                        onClick={() => {
                          triggerHaptic('light');
                          setPreviewFood(food);
                        }}
                        className={cn(
                          'min-h-16 py-2.5 px-4 flex items-center justify-between gap-2.5 transition-colors cursor-pointer',
                          isImported
                            ? 'bg-muted/20 hover:bg-hover'
                            : 'hover:bg-hover active:bg-muted/50'
                        )}
                      >
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <div className="text-[10px] font-mono tabular-nums text-muted-foreground flex items-center gap-1.5 leading-none">
                            <span>{authority}</span>
                            {ediblePct < 100 && (
                              <>
                                <span>·</span>
                                <span>
                                  {t('diet.edibleShort')} {ediblePct}%
                                </span>
                              </>
                            )}
                          </div>

                          <div className="font-medium text-sm text-foreground tracking-tight leading-snug">
                            {food.name}
                          </div>

                          {food.dataSource?.sourceName && food.dataSource.sourceName !== food.name && (
                            <div
                              className="text-[11px] text-muted-foreground/75 truncate leading-tight"
                              title={food.dataSource.sourceName}
                            >
                              {food.dataSource.sourceName}
                            </div>
                          )}

                          <div className="text-[11px] font-mono tabular-nums text-muted-foreground leading-none">
                            <MetricValue
                              value={food.macros.calories}
                              unit="kcal"
                              valueClassName="text-foreground/90"
                              unitClassName="text-muted-foreground"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <MacroSquares
                            protein={food.macros.protein}
                            carbs={food.macros.carbs.total}
                            fat={food.macros.fat.total}
                            sugar={food.macros.carbs.sugar}
                            fiber={food.macros.carbs.fiber}
                            saturatedFat={food.macros.fat.saturated}
                            transFat={food.macros.fat.trans}
                          />

                          {isImported ? (
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
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerHaptic('selection');
                                setImportDraftFood(food);
                              }}
                              title={onSelectFood ? t('diet.importAndSelect') : t('diet.importShort')}
                              aria-label={onSelectFood ? t('diet.importAndSelect') : t('diet.importShort')}
                              className="size-7 rounded-full border border-border bg-card text-foreground hover:border-foreground hover:bg-hover active:scale-95 transition-all cursor-pointer inline-flex items-center justify-center shrink-0"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {results.length < totalCount && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setDisplayLimit((prev) => prev + 80);
                      }}
                      className="w-full py-2.5 px-4 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-hover transition-colors cursor-pointer text-center"
                    >
                      {t('common.loadMore', '載入更多')} ({results.length} / {totalCount})
                    </button>
                  )}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 平級兄弟節點：權威元素數據預覽彈窗 */}
      {previewFood && (
        <AuthorityFoodDetailsDialog
          food={previewFood}
          open={Boolean(previewFood)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setPreviewFood(null);
          }}
          isImported={existingFoodIdSet.has(previewFood.id)}
          onAdd={(targetFood) => {
            setPreviewFood(null);
            setImportDraftFood(targetFood);
          }}
          overlayClassName={detailZIndexClass}
          className={detailZIndexClass}
        />
      )}

      {/* 平級兄弟節點：編輯名稱、分類後再添加至食物庫 */}
      {importDraftFood && (
        <FoodFormDialog
          open={Boolean(importDraftFood)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setImportDraftFood(null);
          }}
          initialData={importDraftFood}
          prefillBlankBasics
          zIndex={zIndex + 10}
          overlayClassName={detailZIndexClass}
          className={detailZIndexClass}
          onSubmit={handleFormImportSubmit}
        />
      )}
    </>
  );
}
