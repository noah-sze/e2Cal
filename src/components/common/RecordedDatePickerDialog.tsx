import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { enUS, zhCN, zhTW } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogPrecisionHeader,
} from '@/components/ui/dialog';
import { SectionCard } from '@/components/ui/section-card';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export interface RecordedDatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  targetDate: string;
  selectedDate: string | null;
  recordedDates: string[];
  onSelectDate: (date: string) => void;
  /** 是否允許選取與 targetDate 同一天的記錄（複製餐點允許、複製訓練僅限過往日） */
  allowSameDay?: boolean;
}

function getDateFnsLocale(lang: string) {
  if (lang.startsWith('zh-TW') || lang.startsWith('zh-HK')) return zhTW;
  if (lang.startsWith('zh')) return zhCN;
  return enUS;
}

/**
 * 歷史記錄日期選擇二級彈窗 (SSOT 共用於複製餐點與複製訓練)
 * 頂部採 CopyMealDialog 同款滿寬三欄月份步進器，下接恆定 42 格歷史有記錄高亮網格。
 */
export function RecordedDatePickerDialog({
  open,
  onOpenChange,
  title,
  targetDate,
  selectedDate,
  recordedDates,
  onSelectDate,
  allowSameDay = false,
}: RecordedDatePickerDialogProps) {
  const { t, i18n } = useTranslation();
  const currentLocale = getDateFnsLocale(i18n.language);

  const recordedDateSet = useMemo(() => new Set(recordedDates), [recordedDates]);

  const targetDateObj = useMemo(() => {
    if (!targetDate) return new Date();
    const parsed = parseISO(targetDate);
    return isValid(parsed) ? parsed : new Date();
  }, [targetDate]);

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (selectedDate) {
      const parsed = parseISO(selectedDate);
      if (isValid(parsed)) return parsed;
    }
    if (recordedDates.length > 0) {
      const parsed = parseISO(recordedDates[0]);
      if (isValid(parsed)) return parsed;
    }
    return targetDateObj;
  });

  useEffect(() => {
    if (!open) return;
    if (selectedDate) {
      const parsed = parseISO(selectedDate);
      if (isValid(parsed)) {
        setCurrentMonth(parsed);
        return;
      }
    }
    if (recordedDates.length > 0) {
      const parsed = parseISO(recordedDates[0]);
      if (isValid(parsed)) {
        setCurrentMonth(parsed);
        return;
      }
    }
    setCurrentMonth(targetDateObj);
  }, [open, selectedDate, recordedDates, targetDateObj]);

  const handlePreviousMonth = () => {
    triggerHaptic('selection');
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    triggerHaptic('selection');
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  const isNextMonthDisabled = useMemo(() => {
    const targetMonthStart = startOfMonth(targetDateObj);
    const currentMonthStart = startOfMonth(currentMonth);
    return !isBefore(currentMonthStart, targetMonthStart);
  }, [currentMonth, targetDateObj]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = useMemo(() => {
    let gridDays = eachDayOfInterval({ start: startDate, end: endDate });
    if (gridDays.length < 42) {
      const extraNeeded = 42 - gridDays.length;
      const nextDays = eachDayOfInterval({
        start: addDays(endDate, 1),
        end: addDays(endDate, extraNeeded),
      });
      gridDays = [...gridDays, ...nextDays];
    }
    return gridDays;
  }, [startDate, endDate]);

  const weekdays = [
    t('calendar.weekdays.sun', '日'),
    t('calendar.weekdays.mon', '一'),
    t('calendar.weekdays.tue', '二'),
    t('calendar.weekdays.wed', '三'),
    t('calendar.weekdays.thu', '四'),
    t('calendar.weekdays.fri', '五'),
    t('calendar.weekdays.sat', '六'),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="standard"
        showCloseButton={false}
        initialFocus={false}
        overlayClassName="z-[70]"
        className="z-[70] w-[320px] max-w-[calc(100vw-24px)] p-4 sm:p-4 bg-card text-card-foreground border border-border shadow-none font-mono text-xs select-none flex flex-col overflow-hidden"
      >
        <DialogPrecisionHeader
          title={title}
          onClose={() => onOpenChange(false)}
          cancelAriaLabel={t('common.cancel', '取消')}
        />

        <div className="pt-3.5">
          <SectionCard title="" showHeader={false} bodyClassName="text-xs font-mono">
            {/* CopyMealDialog 同款滿寬三欄月份步進器 */}
            <div className="h-11 bg-muted/40 grid grid-cols-[44px_1fr_44px] divide-x divide-border items-stretch select-none">
              <button
                type="button"
                onClick={handlePreviousMonth}
                aria-label={t('calendar.previousMonth', '上個月')}
                className="w-full h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <div className="w-full h-full px-3 font-mono text-xs font-medium text-foreground flex items-center justify-center truncate">
                {format(currentMonth, t('calendar.monthYearFormat', 'yyyy 年 M 月'), {
                  locale: currentLocale,
                })}
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                disabled={isNextMonthDisabled}
                aria-label={t('calendar.nextMonth', '下個月')}
                className="w-full h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-hover transition-colors cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>

            {/* 星期表頭 + 42 格日曆網格 */}
            <div className="p-2.5">
              <div className="grid grid-cols-7 gap-1 pb-1.5">
                {weekdays.map((w, idx) => (
                  <div
                    key={idx}
                    className="text-center text-2xs font-medium font-sans text-muted-foreground select-none"
                  >
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 justify-items-center">
                {days.map((day, idx) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const isSelected = selectedDate === dateStr;
                  const withinRange = allowSameDay
                    ? dateStr <= targetDate
                    : dateStr < targetDate;
                  const hasRecord =
                    isCurrentMonth && recordedDateSet.has(dateStr) && withinRange;

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!hasRecord}
                      onClick={() => {
                        if (hasRecord) {
                          triggerHaptic('selection');
                          onSelectDate(dateStr);
                          onOpenChange(false);
                        }
                      }}
                      className={cn(
                        'relative size-8 flex flex-col items-center justify-center text-xs font-mono rounded-lg transition-all',
                        hasRecord
                          ? isSelected
                            ? 'bg-foreground text-background font-semibold cursor-pointer hover:bg-foreground/90 active:scale-92'
                            : 'text-foreground font-medium cursor-pointer hover:bg-hover active:scale-92'
                          : 'text-muted-foreground opacity-20 pointer-events-none cursor-not-allowed select-none'
                      )}
                    >
                      <span>{format(day, 'd')}</span>
                      {hasRecord && (
                        <span
                          className={cn(
                            'size-1 rounded-full absolute bottom-1',
                            isSelected ? 'bg-background' : 'bg-foreground'
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </SectionCard>
        </div>
      </DialogContent>
    </Dialog>
  );
}
