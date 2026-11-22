import { useTranslation } from 'react-i18next';
import { RecordedDatePickerDialog } from '@/components/common/RecordedDatePickerDialog';

export interface CopyWorkoutDatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetDate: string;
  selectedDate: string | null;
  recordedDates: string[];
  onSelectDate: (date: string) => void;
}

/**
 * 複製訓練專用：歷史記錄日期選擇二級彈窗
 */
export function CopyWorkoutDatePickerDialog(props: CopyWorkoutDatePickerDialogProps) {
  const { t } = useTranslation();

  return (
    <RecordedDatePickerDialog
      {...props}
      title={t('workout.copyWorkout.selectDateTitle', '選擇日期')}
      allowSameDay={false}
    />
  );
}
