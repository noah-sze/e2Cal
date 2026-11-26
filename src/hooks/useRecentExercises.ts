import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/db/db';
import type { WorkoutLog } from '@/types';

let inMemoryRecentExerciseIds: string[] | null = null;
let inMemoryRecentRoutineIds: string[] | null = null;
let inMemoryExerciseLastUsedMap: Map<string, number> | null = null;
let inMemoryRoutineLastUsedMap: Map<string, number> | null = null;

/**
 * 清空最近使用動作與課表的記憶體快取
 */
export function clearRecentExercisesCache(): void {
  inMemoryRecentExerciseIds = null;
  inMemoryRecentRoutineIds = null;
  inMemoryExerciseLastUsedMap = null;
  inMemoryRoutineLastUsedMap = null;
}

/**
 * 從歷史訓練日誌中提取去重、按最後訓練時間倒序排列的動作與組合 ID 列表及最後使用時間映射 (Pure Function)
 */
export function extractRecentExerciseAndRoutineIds(workoutLogs: WorkoutLog[]): {
  recentExerciseIds: string[];
  recentRoutineIds: string[];
  exerciseLastUsedMap: Map<string, number>;
  routineLastUsedMap: Map<string, number>;
} {
  const exerciseLastUsedMap = new Map<string, number>();
  const routineLastUsedMap = new Map<string, number>();

  for (const log of workoutLogs) {
    const time =
      Math.max(log.createdAt || 0, log.updatedAt || 0) ||
      new Date(log.date).getTime() ||
      0;

    if (log.routineId) {
      const existing = routineLastUsedMap.get(log.routineId) || 0;
      if (time > existing) {
        routineLastUsedMap.set(log.routineId, time);
      }
    }

    const exercises = log.exercises || [];
    for (const group of exercises) {
      if (group.exerciseId) {
        const existing = exerciseLastUsedMap.get(group.exerciseId) || 0;
        if (time > existing) {
          exerciseLastUsedMap.set(group.exerciseId, time);
        }
      }
    }
  }

  const recentExerciseIds = Array.from(exerciseLastUsedMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const recentRoutineIds = Array.from(routineLastUsedMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  return { recentExerciseIds, recentRoutineIds, exerciseLastUsedMap, routineLastUsedMap };
}

const EMPTY_LAST_USED_MAP = new Map<string, number>();

/**
 * 樂觀同步更新記憶體中的最近動作使用時間映射（於選擇彈窗關閉期間靜默完成排序，避免下次開啟時才重排閃跳）
 */
export function touchRecentExercise(exerciseId: string): void {
  const now = Date.now();
  const nextMap = new Map(inMemoryExerciseLastUsedMap ?? EMPTY_LAST_USED_MAP);
  nextMap.set(exerciseId, now);
  inMemoryExerciseLastUsedMap = nextMap;

  const prevIds = inMemoryRecentExerciseIds ?? [];
  inMemoryRecentExerciseIds = [exerciseId, ...prevIds.filter((id) => id !== exerciseId)];
}

/**
 * 樂觀同步更新記憶體中的最近組合使用時間映射
 */
export function touchRecentRoutine(routineId: string): void {
  const now = Date.now();
  const nextMap = new Map(inMemoryRoutineLastUsedMap ?? EMPTY_LAST_USED_MAP);
  nextMap.set(routineId, now);
  inMemoryRoutineLastUsedMap = nextMap;

  const prevIds = inMemoryRecentRoutineIds ?? [];
  inMemoryRecentRoutineIds = [routineId, ...prevIds.filter((id) => id !== routineId)];
}

interface RecentExercisesSnapshot {
  recentExerciseIds: string[];
  recentRoutineIds: string[];
  exerciseLastUsedMap: Map<string, number>;
  routineLastUsedMap: Map<string, number>;
}

export function useRecentExercises(freezeSort = false) {
  const result = useLiveQuery(
    async () => {
      if (typeof indexedDB === 'undefined') {
        return {
          recentExerciseIds: [],
          recentRoutineIds: [],
          exerciseLastUsedMap: new Map<string, number>(),
          routineLastUsedMap: new Map<string, number>(),
        };
      }

      // 倒序獲取最近 50 次訓練記錄
      const workoutLogs = await db.workout_logs.orderBy('date').reverse().limit(50).toArray();
      const extracted = extractRecentExerciseAndRoutineIds(workoutLogs);

      inMemoryRecentExerciseIds = extracted.recentExerciseIds;
      inMemoryRecentRoutineIds = extracted.recentRoutineIds;
      inMemoryExerciseLastUsedMap = extracted.exerciseLastUsedMap;
      inMemoryRoutineLastUsedMap = extracted.routineLastUsedMap;

      return extracted;
    },
    []
  );

  const liveExerciseLastUsedMap =
    result?.exerciseLastUsedMap ?? inMemoryExerciseLastUsedMap ?? EMPTY_LAST_USED_MAP;
  const liveRoutineLastUsedMap =
    result?.routineLastUsedMap ?? inMemoryRoutineLastUsedMap ?? EMPTY_LAST_USED_MAP;
  const liveRecentExerciseIds = result?.recentExerciseIds ?? inMemoryRecentExerciseIds ?? [];
  const liveRecentRoutineIds = result?.recentRoutineIds ?? inMemoryRecentRoutineIds ?? [];

  const [prevFreeze, setPrevFreeze] = useState(freezeSort);
  const [frozenSnapshot, setFrozenSnapshot] = useState<RecentExercisesSnapshot | null>(() =>
    freezeSort
      ? {
          recentExerciseIds: liveRecentExerciseIds,
          recentRoutineIds: liveRecentRoutineIds,
          exerciseLastUsedMap: liveExerciseLastUsedMap,
          routineLastUsedMap: liveRoutineLastUsedMap,
        }
      : null
  );

  if (freezeSort !== prevFreeze) {
    setPrevFreeze(freezeSort);
    if (freezeSort) {
      setFrozenSnapshot({
        recentExerciseIds: inMemoryRecentExerciseIds ?? liveRecentExerciseIds,
        recentRoutineIds: inMemoryRecentRoutineIds ?? liveRecentRoutineIds,
        exerciseLastUsedMap: inMemoryExerciseLastUsedMap ?? liveExerciseLastUsedMap,
        routineLastUsedMap: inMemoryRoutineLastUsedMap ?? liveRoutineLastUsedMap,
      });
    } else {
      setFrozenSnapshot(null);
    }
  }

  const active = freezeSort && frozenSnapshot ? frozenSnapshot : null;

  return {
    recentExerciseIds: active ? active.recentExerciseIds : liveRecentExerciseIds,
    recentRoutineIds: active ? active.recentRoutineIds : liveRecentRoutineIds,
    exerciseLastUsedMap: active ? active.exerciseLastUsedMap : liveExerciseLastUsedMap,
    routineLastUsedMap: active ? active.routineLastUsedMap : liveRoutineLastUsedMap,
    isLoading: result === undefined && inMemoryRecentExerciseIds === null,
  };
}

// 模組載入時主動發起一次非同步預熱，在使用者點擊開啟彈窗前完成內存常駐
if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
  db.workout_logs.orderBy('date').reverse().limit(50).toArray()
    .then((workoutLogs) => {
      const extracted = extractRecentExerciseAndRoutineIds(workoutLogs);
      inMemoryRecentExerciseIds = extracted.recentExerciseIds;
      inMemoryRecentRoutineIds = extracted.recentRoutineIds;
      inMemoryExerciseLastUsedMap = extracted.exerciseLastUsedMap;
      inMemoryRoutineLastUsedMap = extracted.routineLastUsedMap;
    })
    .catch(() => {});
}
