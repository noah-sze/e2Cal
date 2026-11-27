import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { NutritionTag } from '@/types';
import type { FoodSortOption } from '@/store/useBrowserStateStore';

const NUTRITION_TAG_IDS: readonly NutritionTag[] = [
  'carb-source',
  'high-protein',
  'fat-source',
  'high-fiber',
  'low-calorie',
  'high-calorie',
];

export interface NutritionTagFilterMenuProps {
  value: 'all' | NutritionTag;
  onChange: (tag: 'all' | NutritionTag) => void;
  counts?: Record<NutritionTag, number>;
  allCount?: number;
  className?: string;
}

/**
 * 營養特徵過濾膠囊下拉選單（與飲食管理頁面共用單一真理源）
 */
export function NutritionTagFilterMenu({
  value,
  onChange,
  counts,
  allCount,
  className,
}: NutritionTagFilterMenuProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full text-xs font-mono transition-all border shrink-0',
        value !== 'all'
          ? 'bg-foreground text-background border-foreground font-medium'
          : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border',
        className
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={cn(
                'flex items-center gap-1.5 py-1 pl-2.5 cursor-pointer focus:outline-none whitespace-nowrap',
                value !== 'all' ? 'pr-1' : 'pr-2'
              )}
            >
              <SlidersHorizontal className="size-3 opacity-60 shrink-0" />
              <span className="truncate">
                {value === 'all'
                  ? t('diet.nutritionTags.title', '營養特徵')
                  : t(`diet.nutritionTags.${value}`)}
              </span>
              {value === 'all' && <ChevronDown className="size-3 opacity-60 shrink-0" />}
            </button>
          }
        />
        <DropdownMenuContent align="start" className="w-[180px] font-mono text-xs">
          <DropdownMenuItem
            onClick={() => {
              triggerHaptic('selection');
              onChange('all');
            }}
            className={cn(
              'cursor-pointer flex items-center justify-between',
              value === 'all' && 'font-semibold bg-muted'
            )}
          >
            <span>{t('diet.nutritionTags.all', '全部')}</span>
            {typeof allCount === 'number' && (
              <span className="text-3xs text-muted-foreground font-mono">{allCount}</span>
            )}
          </DropdownMenuItem>
          {NUTRITION_TAG_IDS.map((tagId) => (
            <DropdownMenuItem
              key={tagId}
              onClick={() => {
                triggerHaptic('selection');
                onChange(tagId);
              }}
              className={cn(
                'cursor-pointer flex items-center justify-between',
                value === tagId && 'font-semibold bg-muted'
              )}
            >
              <span>{t(`diet.nutritionTags.${tagId}`)}</span>
              {counts && (
                <span className="text-3xs text-muted-foreground font-mono">
                  {counts[tagId]}
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {value !== 'all' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerHaptic('light');
            onChange('all');
          }}
          className="p-1 pr-2 hover:opacity-70 cursor-pointer"
          title={t('diet.resetFilter', '重設')}
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

export interface FoodSortFilterMenuProps {
  value: FoodSortOption;
  onChange: (sort: FoodSortOption) => void;
  className?: string;
}

/**
 * 食物營養排序膠囊下拉選單（與飲食管理頁面共用單一真理源）
 */
export function FoodSortFilterMenu({
  value,
  onChange,
  className,
}: FoodSortFilterMenuProps) {
  const { t } = useTranslation();

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

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full text-xs font-mono transition-all border shrink-0',
        value !== 'default'
          ? 'bg-foreground text-background border-foreground font-medium'
          : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border',
        className
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={cn(
                'flex items-center gap-1.5 py-1 pl-2.5 cursor-pointer focus:outline-none whitespace-nowrap',
                value !== 'default' ? 'pr-1' : 'pr-2'
              )}
            >
              <ArrowUpDown className="size-3 opacity-60 shrink-0" />
              <span className="truncate">
                {value === 'default'
                  ? t('diet.sort.title', '排序')
                  : sortOptions.find((o) => o.id === value)?.label ?? t('diet.sort.title', '排序')}
              </span>
              {value === 'default' && <ChevronDown className="size-3 opacity-60 shrink-0" />}
            </button>
          }
        />
        <DropdownMenuContent align="start" className="w-[180px] font-mono text-xs">
          {sortOptions.map((opt) => (
            <DropdownMenuItem
              key={opt.id}
              onClick={() => {
                triggerHaptic('selection');
                onChange(opt.id);
              }}
              className={cn(
                'cursor-pointer flex items-center justify-between',
                value === opt.id && 'font-semibold bg-muted'
              )}
            >
              <span>{opt.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {value !== 'default' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerHaptic('light');
            onChange('default');
          }}
          className="p-1 pr-2 hover:opacity-70 cursor-pointer"
          title={t('diet.resetFilter', '重設')}
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
