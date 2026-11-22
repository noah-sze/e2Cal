import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
  addDays,
  subDays
} from "date-fns"
import { zhTW, zhCN, enUS } from "date-fns/locale"

export type CalendarProps = {
  selected?: Date
  onSelect?: (date: Date) => void
  onClose?: () => void
  className?: string
}

function getDateFnsLocale(lang: string) {
  if (lang.startsWith("zh-TW") || lang.startsWith("zh-HK")) return zhTW
  if (lang.startsWith("zh")) return zhCN
  return enUS
}

export function Calendar({ selected, onSelect, onClose, className }: CalendarProps) {
  const { t, i18n } = useTranslation()
  const currentLocale = getDateFnsLocale(i18n.language)

  const [tempSelected, setTempSelected] = React.useState<Date>(selected || new Date())
  const [currentMonth, setCurrentMonth] = React.useState<Date>(selected || new Date())

  React.useEffect(() => {
    if (selected) {
      setTempSelected(selected)
      setCurrentMonth(selected)
    }
  }, [selected])

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1))
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  let days = eachDayOfInterval({
    start: startDate,
    end: endDate
  })

  // Ensure exactly 6 weeks (42 days) to prevent height jumps
  if (days.length < 42) {
    const extraDaysNeeded = 42 - days.length
    const nextDays = eachDayOfInterval({
      start: addDays(endDate, 1),
      end: addDays(endDate, extraDaysNeeded)
    })
    days = [...days, ...nextDays]
  }

  const weekdays = [
    t("calendar.weekdays.sun", "日"),
    t("calendar.weekdays.mon", "一"),
    t("calendar.weekdays.tue", "二"),
    t("calendar.weekdays.wed", "三"),
    t("calendar.weekdays.thu", "四"),
    t("calendar.weekdays.fri", "五"),
    t("calendar.weekdays.sat", "六")
  ]

  const handleDayClick = (day: Date) => {
    setTempSelected(day)
    if (!isSameMonth(day, currentMonth)) {
      setCurrentMonth(startOfMonth(day))
    }
  }

  const handlePresetClick = (daysAgo: number) => {
    const targetDate = subDays(new Date(), daysAgo)
    setTempSelected(targetDate)
    setCurrentMonth(startOfMonth(targetDate))
  }

  const handleConfirm = () => {
    onSelect?.(tempSelected)
    onClose?.()
  }

  const isPresetActive = (daysAgo: number) => {
    return isSameDay(tempSelected, subDays(new Date(), daysAgo))
  }

  return (
    <div
      className={cn(
        "w-full max-w-[340px] select-none rounded-lg bg-card text-card-foreground border border-border overflow-hidden shadow-none",
        className
      )}
    >
      {/* 1. Header: 滿寬三欄月份步進器（比照 CopyMealDialog 設計，刪除 × 按鈕） */}
      <div className="h-11 bg-muted/40 border-b border-border grid grid-cols-[44px_1fr_44px] divide-x divide-border items-stretch select-none">
        <button
          type="button"
          onClick={handlePreviousMonth}
          aria-label={t("calendar.previousMonth", "上個月")}
          className="w-full h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <div className="w-full h-full px-3 font-mono text-xs font-medium text-foreground flex items-center justify-center truncate">
          {format(currentMonth, t("calendar.monthYearFormat", "yyyy 年 M 月"), { locale: currentLocale })}
        </div>
        <button
          type="button"
          onClick={handleNextMonth}
          aria-label={t("calendar.nextMonth", "下個月")}
          className="w-full h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      {/* 2. Weekdays Header */}
      <div className="px-4 pt-3 grid grid-cols-7 gap-1">
        {weekdays.map((day, idx) => (
          <div key={idx} className="text-center text-xs font-medium text-muted-foreground select-none">
            {day}
          </div>
        ))}
      </div>


      {/* 3. Days Grid (42 Cells) */}
      <div className="p-4 grid grid-cols-7 gap-1.5">
        {days.map((day, idx) => {
          const isSelected = isSameDay(day, tempSelected)
          const isCurrentMonth = isSameMonth(day, monthStart)
          const isCurrentToday = isToday(day)

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleDayClick(day)}
              className={cn(
                "h-9 w-9 flex flex-col items-center justify-center text-xs font-mono rounded-lg transition-all cursor-pointer relative",
                !isCurrentMonth && "text-muted-foreground/30 hover:text-muted-foreground/60",
                isCurrentMonth && !isSelected && "text-foreground hover:bg-muted/60",
                isSelected && "bg-foreground text-background font-semibold hover:bg-foreground/90",
                isCurrentToday && !isSelected && "border border-foreground/20 text-foreground"
              )}
            >
              <span>{format(day, "d")}</span>
              {isCurrentToday && (
                <span
                  className={cn(
                    "w-1 h-1 rounded-full absolute bottom-1",
                    isSelected ? "bg-background" : "bg-foreground"
                  )}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* 4. Quick Presets Capsule Bar */}
      <div className="px-3.5 py-2 border-t border-border bg-muted/15 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handlePresetClick(0)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
              isPresetActive(0)
                ? "bg-foreground text-background"
                : "border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {t("calendar.today", "今天")}
          </button>
          <button
            type="button"
            onClick={() => handlePresetClick(1)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
              isPresetActive(1)
                ? "bg-foreground text-background"
                : "border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {t("calendar.yesterday", "昨天")}
          </button>
        </div>
        <span className="text-xs font-mono text-muted-foreground select-none">
          {format(tempSelected, "yyyy-MM-dd")}
        </span>
      </div>

      {/* 5. Dual Action Buttons (50% / 50% Cancel / Confirm) */}
      <div className="p-3 border-t border-border bg-card grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 rounded-lg text-xs font-medium border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-center"
        >
          {t("common.cancel", "取消")}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full py-2 rounded-lg text-xs font-medium bg-foreground text-background hover:opacity-90 transition-opacity cursor-pointer text-center font-medium"
        >
          {t("common.confirm", "確認")}
        </button>
      </div>
    </div>
  )
}
