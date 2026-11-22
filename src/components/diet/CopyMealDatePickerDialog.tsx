import { useTranslation } from 'react-i18next';
import { RecordedDatePickerDialog } from '@/components/common/RecordedDatePickerDialog';
import type { MealType } from '@/types';

export interface CopyMealDatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetMealType?: MealType;
  targetDate: string;
  selectedDate: string | null;
  recordedDates: string[];
  onSelectDate: (date: string) => void;
}

/**
 * 複製餐點專用：歷史記錄日期選擇二級彈窗
 */
export function CopyMealDatePickerDialog({
  targetMealType: _targetMealType,
  ...rest
}: CopyMealDatePickerDialogProps) {
  const { t } = useTranslation();

  return (
    <RecordedDatePickerDialog
      {...rest}
      title={t('diet.copyMeal.selectDateTitle', '選擇日期')}
      allowSameDay
    />
  );
}
