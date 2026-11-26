import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO, subDays } from 'date-fns';
import { db } from '@/services/db/db';
import {
  calculateBodyRecovery,
  LARGE_MUSCLE_RECOVERY_DAYS,
  type BodyRecoverySummary,
} from '@/utils/recoveryMath';
import type { Exercise } from '@/types';

function getRecoveryLookbackStartDate(referenceDate: string): string {
  const parsed = parseISO(referenceDate);
  if (Number.isNaN(parsed.getTime())) return referenceDate;
  return format(subDays(parsed, LARGE_MUSCLE_RECOVERY_DAYS), 'yyyy-MM-dd');
}

/**
 * 人體肌肉恢復狀態 Hook (純粹客觀日曆天數模型 - 方案 A)
 * @param referenceDate 選定日期 (YYYY-MM-DD)
 */
export function useBodyRecovery(referenceDate: string) {
  // 僅查詢恢復窗口內的訓練記錄 (避免全表掃描) 與動作庫
  const liveData = useLiveQuery(
    async () => {
      const startDate = getRecoveryLookbackStartDate(referenceDate);
      const [logs, exercises] = await Promise.all([
        db.workout_logs.where('date').between(startDate, referenceDate, true, true).toArray(),
        db.exercises.toArray(),
      ]);
      return { logs, exercises };
    },
    [referenceDate]
  );

  const recoverySummary: BodyRecoverySummary = useMemo(() => {
    if (!liveData) {
      return calculateBodyRecovery([], { referenceDate });
    }

    const { logs, exercises } = liveData;

    // 構建最新動作字典 Map
    const exerciseMap = new Map<string, Exercise>();
    for (const ex of exercises) {
      exerciseMap.set(ex.id, ex);
    }

    return calculateBodyRecovery(logs, {
      referenceDate,
      exerciseMap,
    });
  }, [liveData, referenceDate]);

  return {
    recoverySummary,
    isLoading: liveData === undefined,
  };
}
