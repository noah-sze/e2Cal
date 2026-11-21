import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/haptics';
import { calculateAgeFromBirth } from '@/utils/weightMath';
import { MetricValue } from '@/components/ui/metric-value';
import { SectionCard } from '@/components/ui/section-card';

export interface MonthCalendarProps {
  value?: string; // "YYYY-MM"
  onChange?: (yearMonth: string) => void;
  className?: string;
}

const MIN_YEAR = 1920;

function parseYearMonth(
  val: string | undefined,
  fallbackYear: number,
  fallbackMonth: number
): { year: number; month: number } {
  if (val && val.includes('-')) {
    const [y, m] = val.split('-');
    const parsedY = parseInt(y, 10);
    const parsedM = parseInt(m, 10);
    if (!isNaN(parsedY) && !isNaN(parsedM) && parsedM >= 1 && parsedM <= 12) {
      return { year: parsedY, month: parsedM };
    }
  }
  return { year: fallbackYear, month: fallbackMonth };
}

/**
 * e2Cal 精密出生年月選擇器 (方案 A：十年矩陣 + 月份網格)
 * 單卡整合已選年月與即時歲數換算、5×2 十年年份矩陣與 4×3 月份全顯網格。
 */
export function MonthCalendar({ value, onChange, className }: MonthCalendarProps) {
  const { t } = useTranslation();

  const [nowMeta] = React.useState(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    };
  });

  const initial = parseYearMonth(value, nowMeta.year, nowMeta.month);
  const [selectedYear, setSelectedYear] = React.useState<number>(initial.year);
  const [selectedMonth, setSelectedMonth] = React.useState<number>(initial.month);
  const [decadeStart, setDecadeStart] = React.useState<number>(
    Math.floor(initial.year / 10) * 10
  );

  // 若外部 value 變更時同步更新內部狀態（render-time 派生對齊，避免 effect setState）
  const [prevValue, setPrevValue] = React.useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    const next = parseYearMonth(value, nowMeta.year, nowMeta.month);
    setSelectedYear(next.year);
    setSelectedMonth(next.month);
    setDecadeStart(Math.floor(next.year / 10) * 10);
  }

  const currentYM = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const calculatedAge = calculateAgeFromBirth(currentYM);

  const maxDecadeStart = Math.floor(nowMeta.year / 10) * 10;
  const minDecadeStart = Math.floor(MIN_YEAR / 10) * 10;
  const decadeEnd = Math.min(nowMeta.year, decadeStart + 9);

  const decadeYears = React.useMemo(() => {
    const years: number[] = [];
    for (let y = decadeStart; y < decadeStart + 10; y++) {
      if (y >= MIN_YEAR && y <= nowMeta.year) {
        years.push(y);
      }
    }
    return years;
  }, [decadeStart, nowMeta.year]);

  const monthNames = [
    t('monthPicker.months.0', '1 月'),
    t('monthPicker.months.1', '2 月'),
    t('monthPicker.months.2', '3 月'),
    t('monthPicker.months.3', '4 月'),
    t('monthPicker.months.4', '5 月'),
    t('monthPicker.months.5', '6 月'),
    t('monthPicker.months.6', '7 月'),
    t('monthPicker.months.7', '8 月'),
    t('monthPicker.months.8', '9 月'),
    t('monthPicker.months.9', '10 月'),
    t('monthPicker.months.10', '11 月'),
    t('monthPicker.months.11', '12 月'),
  ];

  const handleSelectYear = (y: number) => {
    setSelectedYear(y);
    const nextYM = `${y}-${String(selectedMonth).padStart(2, '0')}`;
    onChange?.(nextYM);
    triggerHaptic('selection');
  };

  const handleSelectMonth = (m: number) => {
    setSelectedMonth(m);
    const nextYM = `${selectedYear}-${String(m).padStart(2, '0')}`;
    onChange?.(nextYM);
    triggerHaptic('selection');
  };

  const handlePrevDecade = () => {
    setDecadeStart((prev) => Math.max(minDecadeStart, prev - 10));
    triggerHaptic('light');
  };

  const handleNextDecade = () => {
    setDecadeStart((prev) => Math.min(maxDecadeStart, prev + 10));
    triggerHaptic('light');
  };

  return (
    <div className={cn('w-full pt-3.5 select-none', className)}>
      <SectionCard
        title=""
        showHeader={false}
        bodyClassName="text-xs font-sans"
      >
        {/* 1. 頂部已選年月與即時歲數換算 */}
        <div className="min-h-9 px-3 py-1.5 bg-muted/40 flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-semibold text-foreground tracking-tight tabular-nums">
            {currentYM}
          </span>
          <MetricValue
            value={Math.max(0, calculatedAge)}
            unit={t('profileSettings.yearsOld', '歲')}
            className="text-xs font-medium text-foreground"
            unitClassName="text-2xs"
          />
        </div>

        {/* 2. 年份區：十年區間切換 + 5×2 年份矩陣 */}
        <div>
          <div className="px-2.5 py-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handlePrevDecade}
              disabled={decadeStart <= minDecadeStart}
              aria-label={t('common.previous', '上一個')}
              className="size-6 rounded-md border border-border bg-card hover:bg-hover text-muted-foreground hover:text-foreground inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="font-mono text-2xs font-semibold text-foreground tabular-nums">
              {decadeStart} – {decadeEnd}
            </span>
            <button
              type="button"
              onClick={handleNextDecade}
              disabled={decadeStart >= maxDecadeStart}
              aria-label={t('common.next', '下一個')}
              className="size-6 rounded-md border border-border bg-card hover:bg-hover text-muted-foreground hover:text-foreground inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-5 gap-1 px-2 pb-2.5">
            {decadeYears.map((y) => {
              const isSelected = selectedYear === y;
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => handleSelectYear(y)}
                  className={cn(
                    'min-h-8.5 py-1 rounded-md font-mono text-xs tabular-nums inline-flex items-center justify-center transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'text-foreground hover:bg-hover'
                  )}
                >
                  {y}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. 月份區：標題列 + 4×3 全顯矩陣 */}
        <div>
          <div className="px-3 py-1.5 bg-muted/20 border-b border-border text-3xs uppercase tracking-wider text-muted-foreground">
            {t('monthPicker.month', '月份')}
          </div>
          <div className="grid grid-cols-4 gap-1 p-2">
            {monthNames.map((label, idx) => {
              const m = idx + 1;
              const isSelected = selectedMonth === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelectMonth(m)}
                  className={cn(
                    'min-h-8.5 py-1 rounded-md text-xs font-mono tabular-nums inline-flex items-center justify-center transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'text-foreground hover:bg-hover'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
