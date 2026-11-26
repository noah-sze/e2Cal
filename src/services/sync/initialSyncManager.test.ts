import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FoodItem, WorkoutLog } from '@/types';
import type { EntityTombstoneMap } from '@/services/db/db';

const {
  mockBulkPut,
  mockBulkDelete,
  mockFoodsToArray,
  mockWorkoutLogsToArray,
  mockListRemoteFolder,
  mockDownloadJsonFile,
  mockUploadJsonFile,
  mockUploadAllLocalData,
  localTombstonesRef,
} = vi.hoisted(() => ({
  mockBulkPut: vi.fn().mockResolvedValue(undefined),
  mockBulkDelete: vi.fn().mockResolvedValue(undefined),
  mockFoodsToArray: vi.fn<() => Promise<FoodItem[]>>().mockResolvedValue([]),
  mockWorkoutLogsToArray: vi.fn<() => Promise<WorkoutLog[]>>().mockResolvedValue([]),
  mockListRemoteFolder: vi.fn(),
  mockDownloadJsonFile: vi.fn(),
  mockUploadJsonFile: vi.fn().mockResolvedValue('rev_uploaded'),
  mockUploadAllLocalData: vi.fn().mockResolvedValue(undefined),
  localTombstonesRef: { current: {} as EntityTombstoneMap },
}));

vi.mock('@/services/db/db', () => {
  const emptyTable = () => ({
    toArray: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    get: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    bulkPut: mockBulkPut,
    bulkDelete: mockBulkDelete,
  });

  return {
    db: {
      user_base_info: emptyTable(),
      user_profile: emptyTable(),
      foods: { ...emptyTable(), toArray: mockFoodsToArray },
      recipes: emptyTable(),
      daily_diet_logs: { ...emptyTable(), count: vi.fn().mockResolvedValue(1) },
      exercises: emptyTable(),
      equipments: emptyTable(),
      routines: emptyTable(),
      workout_logs: { ...emptyTable(), toArray: mockWorkoutLogsToArray },
      body_metrics: emptyTable(),
      transaction: vi.fn(async (_mode: string, _tables: unknown[], cb: () => Promise<void>) => cb()),
    },
    withAutoSyncSuppressed: vi.fn(async <T>(fn: () => Promise<T>) => fn()),
    getLocalEntityTombstones: vi.fn(() => localTombstonesRef.current),
    setLocalEntityTombstones: vi.fn((map: EntityTombstoneMap) => {
      localTombstonesRef.current = map;
    }),
  };
});

vi.mock('./dropboxAuth', () => ({
  commitStagingTokens: vi.fn(),
  clearStagingTokens: vi.fn(),
  setStagingTokens: vi.fn(),
  exchangeCodeForTokensOnly: vi.fn().mockResolvedValue({
    accessToken: 'test_access',
    refreshToken: 'test_refresh',
    expiresAt: Date.now() + 3600_000,
  }),
}));

vi.mock('./dropboxClient', () => ({
  listRemoteFolder: mockListRemoteFolder,
  downloadJsonFile: mockDownloadJsonFile,
  uploadJsonFile: mockUploadJsonFile,
}));

vi.mock('./syncEngine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./syncEngine')>();
  return {
    ...actual,
    uploadAllLocalData: mockUploadAllLocalData,
  };
});

import { startInitialSync, selectStrategy, getInitialSyncState } from './initialSyncManager';
import { setLocalEntityTombstones } from '@/services/db/db';

describe('initialSyncManager tombstone handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localTombstonesRef.current = {};
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    });
  });

  it('deletes locally-present entities tombstoned in remote /deleted_entities.json on merge instead of resurrecting them', async () => {
    const nowTs = Date.now();
    const deletedFoodId = 'food-deleted-on-other-device';
    const keptFoodId = 'food-kept';

    mockFoodsToArray.mockResolvedValue([
      {
        id: deletedFoodId,
        name: 'Deleted Chicken',
        category: 'natural',
        calories: 165,
        carbs: 0,
        protein: 31,
        fat: 3.6,
        servingSize: 100,
        servingUnit: 'g',
        isCustom: true,
        createdAt: nowTs - 10_000,
        updatedAt: nowTs - 5_000,
        rev: 1,
      },
      {
        id: keptFoodId,
        name: 'Kept Oats',
        category: 'natural',
        calories: 370,
        carbs: 66,
        protein: 14,
        fat: 7,
        servingSize: 100,
        servingUnit: 'g',
        isCustom: true,
        createdAt: nowTs - 10_000,
        updatedAt: nowTs - 5_000,
        rev: 1,
      },
    ]);

    const remoteTombstones: EntityTombstoneMap = {
      foods: {
        [deletedFoodId]: nowTs - 1_000,
      },
    };

    mockListRemoteFolder.mockResolvedValue([
      { name: 'manifest.json', path_lower: '/manifest.json', rev: 'r_manifest' },
      { name: 'foods.json', path_lower: '/nutrition/foods.json', rev: 'r_foods' },
      { name: 'deleted_entities.json', path_lower: '/deleted_entities.json', rev: 'r_tomb' },
    ]);

    mockDownloadJsonFile.mockImplementation(async (path: string) => {
      if (path === '/manifest.json') {
        return {
          version: 1,
          updatedAt: new Date(nowTs).toISOString(),
          stats: { dailyDietLogsCount: 1, workoutLogsCount: 0, bodyMetricsCount: 0 },
        };
      }
      if (path === '/nutrition/foods.json') {
        return [];
      }
      if (path === '/deleted_entities.json') {
        return remoteTombstones;
      }
      return null;
    });

    await startInitialSync('oauth_code', { mode: 'sync' });
    expect(getInitialSyncState().step).toBe('STRATEGY');

    await selectStrategy('merge');

    expect(mockBulkDelete).toHaveBeenCalledWith([deletedFoodId]);
    expect(mockBulkPut).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: keptFoodId })])
    );
    expect(mockBulkPut).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: deletedFoodId })])
    );
    expect(setLocalEntityTombstones).toHaveBeenCalledWith(
      expect.objectContaining({
        foods: expect.objectContaining({ [deletedFoodId]: nowTs - 1_000 }),
      })
    );
    expect(getInitialSyncState().step).toBe('COMPLETED');
  });
});
