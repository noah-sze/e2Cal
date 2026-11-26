import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockBetween, mockWhere, mockWorkoutToArray, mockExercisesToArray } = vi.hoisted(() => {
  const mockWorkoutToArray = vi.fn().mockResolvedValue([]);
  const mockBetween = vi.fn(() => ({ toArray: mockWorkoutToArray }));
  const mockWhere = vi.fn(() => ({ between: mockBetween }));
  const mockExercisesToArray = vi.fn().mockResolvedValue([]);
  return { mockBetween, mockWhere, mockWorkoutToArray, mockExercisesToArray };
});

let capturedQueryFn: (() => Promise<unknown>) | null = null;

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn((fn: () => Promise<unknown>) => {
    capturedQueryFn = fn;
    return undefined;
  }),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useMemo: <T>(fn: () => T) => fn(),
  };
});

vi.mock('@/services/db/db', () => ({
  db: {
    workout_logs: {
      where: mockWhere,
    },
    exercises: {
      toArray: mockExercisesToArray,
    },
  },
}));

import { useBodyRecovery } from './useBodyRecovery';

describe('useBodyRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedQueryFn = null;
  });

  it('queries workout_logs with a bounded 3-day inclusive date range instead of scanning the whole table', async () => {
    useBodyRecovery('2026-11-26');
    expect(capturedQueryFn).not.toBeNull();

    await capturedQueryFn!();

    expect(mockWhere).toHaveBeenCalledWith('date');
    expect(mockBetween).toHaveBeenCalledWith('2026-11-23', '2026-11-26', true, true);
    expect(mockWorkoutToArray).toHaveBeenCalledTimes(1);
    expect(mockExercisesToArray).toHaveBeenCalledTimes(1);
  });
});
