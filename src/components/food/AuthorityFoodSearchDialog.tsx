import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Database, Plus, Check, Loader2, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { FoodItem } from '@/types';
import { useFoods } from '@/hooks/useFoods';
import {
  searchAuthorityFoods,
  importAuthorityFoodToDatabase,
} from '@/services/authorityFoodService';

export interface AuthorityFoodSearchDialogProps {
  /** 控制彈窗開關 */
  open: boolean;
  /** 彈窗開關狀態變更回調 */
  onOpenChange: (open: boolean) => void;
  /** 選取回調：單筆導入後回傳該食材物件（例如在食物選擇彈窗中直接選取並繼續記錄） */
  onSelectFood?: (food: FoodItem) => void;
  /** 自訂初始搜尋關鍵字 */
  initialQuery?: string;
  /** 多層彈窗層級（Rule 4 規範） @default 80 */
  zIndex?: number;
  /** 自訂覆蓋樣式 */
  overlayClassName?: string;
  className?: string;
}

type AuthorityFilter = 'all' | 'USDA' | 'TFDA' | 'CFCT';

const POPULAR_RECOMMENDATIONS = [
  '去皮雞胸肉',
  '雞蛋',
  '牛腱',
  '鮭魚',
  '燕麥片',
  '西蘭花',
  '酪梨',
  '糙米飯',
];

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
  const { customFoods, presetFoods } = useFoods();

  const [query, setQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<AuthorityFilter>('all');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [locallyImportedIds, setLocallyImportedIds] = useState<Set<string>>(new Set());

  const searchInputRef = useRef<HTMLInputElement>(null);

  // 現存本機食物 ID 集合（快速比對「已在食物庫」）
  const existingFoodIdSet = useMemo(() => {
    const set = new Set<string>();
    customFoods.forEach((f) => set.add(f.id));
    presetFoods.forEach((f) => set.add(f.id));
    locallyImportedIds.forEach((id) => set.add(id));
    return set;
  }, [customFoods, presetFoods, locallyImportedIds]);

  // 重置狀態與聚焦
  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setLocallyImportedIds(new Set());
      if (initialQuery.trim()) {
        executeSearch(initialQuery, activeFilter);
      } else {
        setResults([]);
        setHasSearched(false);
      }
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open, initialQuery]);

  // 搜尋函式
  const executeSearch = async (searchTerm: string, filter: AuthorityFilter) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const data = await searchAuthorityFoods(trimmed, 60, filter);
      setResults(data);
    } catch (err) {
      console.error('[AuthoritySearch] 搜尋出錯:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 延遲響應式搜尋
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (query.trim()) {
        executeSearch(query, activeFilter);
      } else {
        setResults([]);
        setHasSearched(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query, activeFilter, open]);

  // 處理單筆導入
  const handleImport = async (food: FoodItem) => {
    triggerHaptic('selection');
    setImportingId(food.id);

    try {
      const imported = await importAuthorityFoodToDatabase(food);
      triggerHaptic('success');
      toast.show(
        t('diet.importedFoodToast', '已導入「{{name}}」至食物庫', { name: food.name })
      );

      setLocallyImportedIds((prev) => new Set(prev).add(food.id));

      if (onSelectFood) {
        onSelectFood(imported);
        onOpenChange(false);
      }
    } catch (err) {
      console.error('[AuthoritySearch] 導入失敗:', err);
      toast.show(t('common.error', '導入失敗'));
    } finally {
      setImportingId(null);
    }
  };

  const zIndexClass = `z-[${zIndex}]`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex flex-col max-h-[85vh] h-[640px] sm:max-w-lg p-0 gap-0 overflow-hidden',
          zIndexClass,
          className
        )}
        overlayClassName={cn(zIndexClass, overlayClassName)}
      >
        {/* 標頭區域 */}
        <DialogHeader className="p-4 pb-3 border-b border-border/60 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Database className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground">
                  {t('diet.authoritySearchTitle', '權威科研庫搜索添加')}
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t(
                    'diet.authoritySearchSubtitle',
                    '收錄 USDA、台灣 TFDA、中國 CDC 共 11,683 筆權威科研數據'
                  )}
                </p>
              </div>
            </div>
            <DialogClose className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              <X className="size-4" />
            </DialogClose>
          </div>

          {/* 搜尋欄 */}
          <div className="relative mt-3 flex items-center">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('diet.authoritySearchPlaceholder', '搜尋食材名稱（如：去皮雞胸、Salmon、牛腱、燕麥）...')}
              className="h-10 pl-9 pr-9 text-xs rounded-lg border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-foreground focus:ring-0 focus-visible:ring-0 shadow-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* 數據源切換過濾膠囊 */}
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto no-scrollbar py-0.5">
            {(
              [
                { id: 'all', label: t('diet.authoritySourceAll', '全部 (1.1 萬)') },
                { id: 'USDA', label: 'USDA (7,793)' },
                { id: 'TFDA', label: 'TFDA (2,213)' },
                { id: 'CFCT', label: '中國 CDC (1,677)' },
              ] as const
            ).map((src) => (
              <button
                key={src.id}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveFilter(src.id);
                }}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-mono transition-all border shrink-0 cursor-pointer',
                  activeFilter === src.id
                    ? 'bg-foreground text-background border-foreground font-medium shadow-xs'
                    : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >
                {src.label}
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* 搜尋結果列表 / 推薦列表 */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-3 space-y-2">
          {/* 搜尋中狀態 */}
          {isSearching && results.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-xs font-mono">
                {t('common.loading', '正在檢索 1.1 萬條權威科研數據...')}
              </span>
            </div>
          )}

          {/* 空查詢狀態：顯示推薦常用科研食材 */}
          {!query.trim() && !hasSearched && (
            <div className="py-4 px-1 space-y-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Sparkles className="size-3.5 text-primary" />
                <span>{t('diet.popularAuthorityStaples', '常用權威食材推薦')}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {POPULAR_RECOMMENDATIONS.map((foodName) => (
                  <button
                    key={foodName}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setQuery(foodName);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-border/70 hover:border-foreground/30 bg-card hover:bg-muted text-xs text-foreground cursor-pointer transition-colors active:scale-95"
                  >
                    {foodName}
                  </button>
                ))}
              </div>

              <div className="mt-6 p-3 rounded-lg bg-muted/30 border border-border/50 text-[11px] text-muted-foreground space-y-1">
                <div className="font-medium text-foreground">💡 權威食材庫特性</div>
                <ul className="list-disc list-inside space-y-0.5 opacity-90 pl-0.5">
                  <li>嚴格採用公制克重（100g 基準），精確科研化測量</li>
                  <li>自動標註骨頭、果皮等不可食損耗率（Refuse Rate），支援毛重稱重自動折算</li>
                  <li>單筆點選導入，保持本機食材庫極簡純淨，不污染日常清單</li>
                </ul>
              </div>
            </div>
          )}

          {/* 無匹配結果 */}
          {!isSearching && hasSearched && results.length === 0 && (
            <div className="py-16 text-center space-y-1">
              <p className="text-xs text-muted-foreground">
                {t('diet.noAuthorityFoodsFound', '在權威科研庫中未找到「{{query}}」', {
                  query,
                })}
              </p>
              <p className="text-[11px] text-muted-foreground/60">
                {t('diet.tryOtherKeywords', '可嘗試更換關鍵字、英文名稱或切換權威來源')}
              </p>
            </div>
          )}

          {/* 列表渲染 */}
          {results.map((food) => {
            const isImported = existingFoodIdSet.has(food.id);
            const isCurrentImporting = importingId === food.id;
            const authorityLabel =
              food.dataSource?.authority === 'CFCT'
                ? '中國 CDC'
                : food.dataSource?.authority || 'USDA';

            return (
              <div
                key={food.id}
                onClick={() => !isImported && !isCurrentImporting && handleImport(food)}
                className={cn(
                  'p-3 rounded-lg border border-border/70 bg-card transition-all flex items-center justify-between gap-2.5',
                  isImported
                    ? 'opacity-80 bg-muted/20'
                    : 'hover:border-foreground/30 hover:bg-hover active:bg-active cursor-pointer'
                )}
              >
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-xs text-foreground truncate">
                      {food.name}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono shrink-0">
                      {authorityLabel}
                    </span>
                    {Boolean(food.refuseRate && food.refuseRate > 0) && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-muted/60 text-muted-foreground/80 font-mono shrink-0">
                        損耗 {Math.round((food.refuseRate ?? 0) * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5 flex-wrap">
                    <span>{food.calories} kcal</span>
                    <span>·</span>
                    <span>P {food.protein}g</span>
                    <span>·</span>
                    <span>F {food.fat}g</span>
                    <span>·</span>
                    <span>C {food.carbs}g</span>
                    {Boolean(food.fiber && food.fiber > 0) && (
                      <>
                        <span>·</span>
                        <span>纖維 {food.fiber}g</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {isImported ? (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-muted text-muted-foreground font-medium select-none">
                      <Check className="size-3 text-emerald-500" />
                      <span>{t('diet.alreadyInLibrary', '已在食物庫')}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isCurrentImporting}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleImport(food);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 active:scale-95 transition-all cursor-pointer whitespace-nowrap shadow-xs"
                    >
                      {isCurrentImporting ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Plus className="size-3" />
                      )}
                      <span>
                        {onSelectFood
                          ? t('diet.importAndSelect', '選取導入')
                          : t('diet.importToLibrary', '導入食物庫')}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
