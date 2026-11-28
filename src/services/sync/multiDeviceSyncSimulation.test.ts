import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  BodyMetric,
  DailyDietLog,
  Equipment,
  Exercise,
  FoodItem,
  FoodRecipe,
  UserBaseInfo,
  WorkoutLog,
  WorkoutRoutine,
} from '@/types';
import type { EntityTombstoneMap } from '@/services/db/db';

interface TableMap {
  user_base_info: UserBaseInfo[];
  foods: FoodItem[];
  recipes: FoodRecipe[];
  daily_diet_logs: DailyDietLog[];
  exercises: Exercise[];
  equipments: Equipment[];
  routines: WorkoutRoutine[];
  workout_logs: WorkoutLog[];
  body_metrics: BodyMetric[];
}

interface DeviceState {
  name: string;
  tables: TableMap;
  storage: Record<string, string>;
  tombstones: EntityTombstoneMap;
}

const {
  activeDeviceRef,
  dropboxFiles,
  dropboxRevCounter,
} = vi.hoisted(() => ({
  activeDeviceRef: {
    current: null as DeviceState | null,
  },
  dropboxFiles: new Map<string, { content: string; rev: string }>(),
  dropboxRevCounter: { value: 0 },
}));

function makeTableOps<K extends keyof TableMap>(key: K) {
  const getRows = (): TableMap[K] => {
    if (!activeDeviceRef.current) throw new Error('No active device');
    return activeDeviceRef.current.tables[key];
  };
  const setRows = (rows: TableMap[K]) => {
    if (!activeDeviceRef.current) throw new Error('No active device');
    activeDeviceRef.current.tables[key] = rows;
  };

  return {
    toArray: vi.fn(async () => structuredClone(getRows())),
    count: vi.fn(async () => getRows().length),
    get: vi.fn(async (id: string) => {
      const found = (getRows() as Array<{ id: string }>).find((r) => r.id === id);
      return found ? structuredClone(found) : undefined;
    }),
    clear: vi.fn(async () => {
      setRows([] as TableMap[K]);
    }),
    bulkPut: vi.fn(async (items: Array<{ id: string }>) => {
      const current = [...(getRows() as Array<{ id: string }>)];
      const map = new Map(current.map((r) => [r.id, r]));
      for (const item of items) {
        map.set(item.id, structuredClone(item));
      }
      setRows(Array.from(map.values()) as TableMap[K]);
    }),
    put: vi.fn(async (item: { id: string }) => {
      const current = [...(getRows() as Array<{ id: string }>)];
      const map = new Map(current.map((r) => [r.id, r]));
      map.set(item.id, structuredClone(item));
      setRows(Array.from(map.values()) as TableMap[K]);
    }),
    bulkDelete: vi.fn(async (ids: string[]) => {
      const idSet = new Set(ids);
      const filtered = (getRows() as Array<{ id: string }>).filter((r) => !idSet.has(r.id));
      setRows(filtered as TableMap[K]);
    }),
    where: vi.fn((field: string) => ({
      equals: (value: unknown) => ({
        first: async () => {
          const found = (getRows() as unknown as Array<Record<string, unknown>>).find(
            (r) => r[field] === value
          );
          return found ? structuredClone(found) : undefined;
        },
        toArray: async () => {
          return structuredClone(
            (getRows() as unknown as Array<Record<string, unknown>>).filter(
              (r) => r[field] === value
            )
          );
        },
      }),
    })),
    filter: vi.fn((predicate: (item: unknown) => boolean) => ({
      toArray: async () => structuredClone((getRows() as unknown[]).filter(predicate)),
      count: async () => (getRows() as unknown[]).filter(predicate).length,
    })),
  };
}

vi.mock('@/services/db/db', () => ({
  db: {
    user_base_info: makeTableOps('user_base_info'),
    user_profile: {
      toArray: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      get: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
      bulkPut: vi.fn(async () => undefined),
      bulkDelete: vi.fn(async () => undefined),
    },
    foods: makeTableOps('foods'),
    recipes: makeTableOps('recipes'),
    daily_diet_logs: makeTableOps('daily_diet_logs'),
    exercises: makeTableOps('exercises'),
    equipments: makeTableOps('equipments'),
    routines: makeTableOps('routines'),
    workout_logs: makeTableOps('workout_logs'),
    body_metrics: makeTableOps('body_metrics'),
    transaction: vi.fn(async (_mode: string, _tables: unknown[], cb: () => Promise<void>) => cb()),
  },
  withAutoSyncSuppressed: vi.fn(async <T>(fn: () => Promise<T>) => fn()),
  getLocalEntityTombstones: vi.fn(() => {
    if (!activeDeviceRef.current) return {};
    return structuredClone(activeDeviceRef.current.tombstones);
  }),
  setLocalEntityTombstones: vi.fn((map: EntityTombstoneMap) => {
    if (!activeDeviceRef.current) return;
    activeDeviceRef.current.tombstones = structuredClone(map);
  }),
}));

vi.mock('./dropboxAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dropboxAuth')>();
  return {
    ...actual,
    commitStagingTokens: vi.fn(),
    clearStagingTokens: vi.fn(),
    setStagingTokens: vi.fn(),
    exchangeCodeForTokensOnly: vi.fn().mockResolvedValue({
      access_token: 'sim_access',
      refresh_token: 'sim_refresh',
      expires_in: 14400,
      expires_at: Date.now() + 14400 * 1000,
    }),
    getValidAccessToken: vi.fn().mockResolvedValue('sim_access'),
    isDropboxConnected: vi.fn(() => true),
  };
});

vi.mock('./dropboxClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dropboxClient')>();
  return {
    ...actual,
    listRemoteFolder: vi.fn(async () => {
      return Array.from(dropboxFiles.entries()).map(([path, file]) => ({
        '.tag': 'file' as const,
        name: path.split('/').pop() || path,
        path_lower: path.toLowerCase(),
        rev: file.rev,
      }));
    }),
    downloadJsonFile: vi.fn(async <T>(path: string): Promise<T | null> => {
      const entry = dropboxFiles.get(path.toLowerCase());
      if (!entry) return null;
      return JSON.parse(entry.content) as T;
    }),
    uploadJsonFile: vi.fn(async (path: string, data: unknown, expectedRev?: string): Promise<string> => {
      const key = path.toLowerCase();
      const existing = dropboxFiles.get(key);
      if (expectedRev && existing && existing.rev !== expectedRev) {
        throw new Error(`DROPBOX_CONFLICT: File ${path} has a newer version on remote`);
      }
      dropboxRevCounter.value += 1;
      const newRev = `rev_${dropboxRevCounter.value}`;
      dropboxFiles.set(key, { content: JSON.stringify(data), rev: newRev });
      return newRev;
    }),
    deleteRemotePath: vi.fn(async (path: string): Promise<void> => {
      dropboxFiles.delete(path.toLowerCase());
    }),
  };
});

import { executeSync, _resetConflictRetryCount } from './syncEngine';
import { startInitialSync, selectStrategy } from './initialSyncManager';

function createDevice(name: string, partial?: Partial<TableMap>): DeviceState {
  return {
    name,
    tables: {
      user_base_info: partial?.user_base_info ? structuredClone(partial.user_base_info) : [],
      foods: partial?.foods ? structuredClone(partial.foods) : [],
      recipes: partial?.recipes ? structuredClone(partial.recipes) : [],
      daily_diet_logs: partial?.daily_diet_logs ? structuredClone(partial.daily_diet_logs) : [],
      exercises: partial?.exercises ? structuredClone(partial.exercises) : [],
      equipments: partial?.equipments ? structuredClone(partial.equipments) : [],
      routines: partial?.routines ? structuredClone(partial.routines) : [],
      workout_logs: partial?.workout_logs ? structuredClone(partial.workout_logs) : [],
      body_metrics: partial?.body_metrics ? structuredClone(partial.body_metrics) : [],
    },
    storage: {},
    tombstones: {},
  };
}

function activateDevice(dev: DeviceState) {
  activeDeviceRef.current = dev;
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => dev.storage[k] ?? null,
    setItem: (k: string, v: string) => {
      dev.storage[k] = String(v);
    },
    removeItem: (k: string) => {
      delete dev.storage[k];
    },
    clear: () => {
      for (const k of Object.keys(dev.storage)) delete dev.storage[k];
    },
  });
}

async function syncDevice(dev: DeviceState) {
  activateDevice(dev);
  const res = await executeSync('auto');
  expect(res.success).toBe(true);
  return res;
}

async function initialMergeDevice(dev: DeviceState) {
  activateDevice(dev);
  await startInitialSync('auth_code', { mode: 'sync' });
  await selectStrategy('merge');
}

describe('Multi-Device Dropbox Sync Simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dropboxFiles.clear();
    dropboxRevCounter.value = 0;
    _resetConflictRetryCount();
    activeDeviceRef.current = null;
  });

  it('1. Authority Food & Metadata Roundtrip across Devices A and B', async () => {
    const devA = createDevice('Device A', {
      foods: [
        {
          id: 'food-wing-1',
          name: '帶骨雞翅',
          category: 'natural',
          servingSize: 100,
          servingUnit: 'g',
          macros: {
            calories: 191,
            protein: 18.3,
            carbs: { total: 0 },
            fat: { total: 12.6 },
          },
          refuseRate: 0.31,
          edibleRate: 0.69,
          refuseDescription: 'bone 31%',
          dataSource: {
            authority: 'TFDA',
            sourceId: 'TFDA-W01',
            sourceName: '肉雞翅',
            verifiedAt: '2026-01-01',
          },
          micros: { potassium: 210, iron: 0.9 },
          isCustom: false,
          createdAt: 1000,
          updatedAt: 1000,
          rev: 1,
        },
      ],
    });
    const devB = createDevice('Device B');

    await syncDevice(devA);
    await syncDevice(devB);

    expect(devB.tables.foods).toHaveLength(1);
    expect(devB.tables.foods[0]).toMatchObject({
      id: 'food-wing-1',
      refuseRate: 0.31,
      edibleRate: 0.69,
      refuseDescription: 'bone 31%',
      dataSource: { authority: 'TFDA', sourceId: 'TFDA-W01' },
      micros: { potassium: 210, iron: 0.9 },
    });

    // B edits the food (e.g. adjusts calories & rev) with a fresh timestamp > pushedTimes['foods']
    devB.tables.foods[0] = {
      ...devB.tables.foods[0],
      macros: {
        ...devB.tables.foods[0].macros,
        calories: 195,
      },
      updatedAt: Date.now() + 5000,
      rev: 2,
    };

    await syncDevice(devB);
    await syncDevice(devA);

    expect(devA.tables.foods[0].macros.calories).toBe(195);
    expect(devA.tables.foods[0].refuseRate).toBe(0.31);
    expect(devA.tables.foods[0].dataSource?.authority).toBe('TFDA');
    expect(devA.tables.foods[0].micros?.potassium).toBe(210);
  });

  it('2. Concurrent Same-Date DailyDietLog Edits converge on A, B, and Dropbox', async () => {
    const devA = createDevice('Device A', {
      daily_diet_logs: [
        {
          id: 'diet-2026-11-26-a',
          date: '2026-11-26',
          meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
          entries: [
            {
              id: 'entry-a1',
              date: '2026-11-26',
              mealType: 'breakfast',
              entryType: 'item',
              foodId: 'food-1',
              quantity: 150,
              unit: 'g',
              createdAt: 1000,
              updatedAt: 1000,
              rev: 1,
            },
          ],
          createdAt: 1000,
          updatedAt: 1000,
          rev: 1,
        },
      ],
    });
    const devB = createDevice('Device B', {
      daily_diet_logs: [
        {
          id: 'diet-2026-11-26-b',
          date: '2026-11-26',
          meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
          entries: [
            {
              id: 'entry-b1',
              date: '2026-11-26',
              mealType: 'lunch',
              entryType: 'item',
              foodId: 'food-2',
              quantity: 200,
              unit: 'g',
              createdAt: 1500,
              updatedAt: 1500,
              rev: 1,
            },
          ],
          createdAt: 1500,
          updatedAt: 1500,
          rev: 1,
        },
      ],
    });

    await syncDevice(devA);
    await syncDevice(devB);
    await syncDevice(devA);

    const aIds = devA.tables.daily_diet_logs[0].entries.map((e) => e.id).sort();
    const bIds = devB.tables.daily_diet_logs[0].entries.map((e) => e.id).sort();
    const remoteRaw = dropboxFiles.get('/app/logs/2026-11.json');
    const remoteBucket = JSON.parse(remoteRaw!.content) as {
      dailyDietLogs: DailyDietLog[];
    };
    const rIds = remoteBucket.dailyDietLogs[0].entries.map((e) => e.id).sort();

    expect(aIds).toEqual(['entry-a1', 'entry-b1']);
    expect(bIds).toEqual(['entry-a1', 'entry-b1']);
    expect(rIds).toEqual(['entry-a1', 'entry-b1']);
  });

  it('3. Concurrent Same-Date WorkoutLog & WorkoutSet Edits converge with rev-first LWW', async () => {
    const devA = createDevice('Device A', {
      workout_logs: [
        {
          id: 'wlog-1',
          date: '2026-11-26',
          exercises: [
            {
              exerciseId: 'ex-squat',
              sets: [
                { id: 'set-shared', setNumber: 1, weight: 100, reps: 5, isCompleted: true, updatedAt: 5000, rev: 1 },
                { id: 'set-a-only', setNumber: 2, weight: 110, reps: 5, isCompleted: true, updatedAt: 2000, rev: 1 },
              ],
            },
          ],
          createdAt: 1000,
          updatedAt: 2000,
          rev: 1,
        },
      ],
    });
    const devB = createDevice('Device B', {
      workout_logs: [
        {
          id: 'wlog-1',
          date: '2026-11-26',
          exercises: [
            {
              exerciseId: 'ex-squat',
              sets: [
                { id: 'set-shared', setNumber: 1, weight: 105, reps: 5, isCompleted: true, updatedAt: 2000, rev: 2 },
                { id: 'set-b-only', setNumber: 2, weight: 120, reps: 3, isCompleted: true, updatedAt: 2500, rev: 1 },
              ],
            },
          ],
          createdAt: 1000,
          updatedAt: 2500,
          rev: 1,
        },
      ],
    });

    await syncDevice(devA);
    await syncDevice(devB);
    await syncDevice(devA);

    const aSets = devA.tables.workout_logs[0].exercises[0].sets;
    const bSets = devB.tables.workout_logs[0].exercises[0].sets;

    expect(aSets.map((s) => s.id).sort()).toEqual(['set-a-only', 'set-b-only', 'set-shared']);
    expect(bSets.map((s) => s.id).sort()).toEqual(['set-a-only', 'set-b-only', 'set-shared']);
    // set-shared on B had higher rev (2 > 1) even with lower updatedAt (2000 < 5000)
    expect(aSets.find((s) => s.id === 'set-shared')?.weight).toBe(105);
    expect(bSets.find((s) => s.id === 'set-shared')?.weight).toBe(105);
  });

  it('4. Deletion & Tombstone Propagation across Auto Sync (B) and initialSyncManager merge (C)', async () => {
    const sharedFood: FoodItem = {
      id: 'food-del',
      name: 'Old Food',
      category: 'natural',
      servingSize: 100,
      servingUnit: 'g',
      macros: {
        calories: 100,
        protein: 10,
        carbs: { total: 10 },
        fat: { total: 2 },
      },
      isCustom: true,
      createdAt: 1000,
      updatedAt: 1000,
      rev: 1,
    };
    const sharedDiet: DailyDietLog = {
      id: 'diet-1',
      date: '2026-11-26',
      meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
      entries: [
        {
          id: 'entry-del',
          date: '2026-11-26',
          mealType: 'breakfast',
          entryType: 'item',
          foodId: 'food-keep',
          quantity: 100,
          unit: 'g',
          createdAt: 1000,
          updatedAt: 1000,
          rev: 1,
        },
        {
          id: 'entry-keep',
          date: '2026-11-26',
          mealType: 'lunch',
          entryType: 'item',
          foodId: 'food-keep',
          quantity: 100,
          unit: 'g',
          createdAt: 1000,
          updatedAt: 1000,
          rev: 1,
        },
      ],
      createdAt: 1000,
      updatedAt: 1000,
      rev: 1,
    };
    const sharedWorkout: WorkoutLog = {
      id: 'wlog-del',
      date: '2026-11-26',
      exercises: [],
      createdAt: 1000,
      updatedAt: 1000,
      rev: 1,
    };
    const sharedMetric: BodyMetric = {
      id: 'bm-del',
      date: '2026-11-26',
      weight: 70,
      createdAt: 1000,
      updatedAt: 1000,
      rev: 1,
    };

    const devA = createDevice('Device A', {
      foods: [sharedFood],
      daily_diet_logs: [sharedDiet],
      workout_logs: [sharedWorkout],
      body_metrics: [sharedMetric],
    });
    const devB = createDevice('Device B', {
      foods: [sharedFood],
      daily_diet_logs: [sharedDiet],
      workout_logs: [sharedWorkout],
      body_metrics: [sharedMetric],
    });
    const devC = createDevice('Device C', {
      foods: [sharedFood],
      daily_diet_logs: [sharedDiet],
      workout_logs: [sharedWorkout],
      body_metrics: [sharedMetric],
    });

    // Initial sync establishes baseline on Dropbox before A deletes
    await syncDevice(devA);

    // A deletes FoodItem, FoodLog entry, WorkoutLog, BodyMetric and records tombstones
    const delTs = Date.now() + 1000;
    devA.tables.foods = [];
    devA.tables.daily_diet_logs[0].entries = devA.tables.daily_diet_logs[0].entries.filter(
      (e) => e.id !== 'entry-del'
    );
    devA.tables.daily_diet_logs[0].deletedEntries = { 'entry-del': delTs };
    devA.tables.daily_diet_logs[0].updatedAt = delTs;
    devA.tables.daily_diet_logs[0].rev = 2;
    devA.tables.workout_logs = [];
    devA.tables.body_metrics = [];
    devA.tombstones = {
      foods: { 'food-del': delTs },
      workout_logs: { 'wlog-del': delTs },
      body_metrics: { 'bm-del': delTs },
    };

    await syncDevice(devA);
    await syncDevice(devB);
    await initialMergeDevice(devC);

    // Zero resurrection across A, B, and C
    for (const dev of [devA, devB, devC]) {
      expect(dev.tables.foods).toHaveLength(0);
      expect(dev.tables.workout_logs).toHaveLength(0);
      expect(dev.tables.body_metrics).toHaveLength(0);
      expect(dev.tables.daily_diet_logs[0].entries.map((e) => e.id)).toEqual(['entry-keep']);
    }
  });

  it('4b. Deleting offline before first-ever sync uploads /deleted_entities.json in uploadInitialSnapshot', async () => {
    const food: FoodItem = {
      id: 'food-pre-sync-del',
      name: 'Pre-Sync Deleted Food',
      category: 'natural',
      servingSize: 100,
      servingUnit: 'g',
      macros: {
        calories: 100,
        protein: 10,
        carbs: { total: 10 },
        fat: { total: 2 },
      },
      isCustom: true,
      createdAt: 1000,
      updatedAt: 1000,
      rev: 1,
    };
    const devA = createDevice('Device A', { foods: [] });
    devA.tombstones = { foods: { 'food-pre-sync-del': Date.now() } };
    const devB = createDevice('Device B', { foods: [food] });

    await syncDevice(devA); // hits uploadInitialSnapshot
    await syncDevice(devB);

    expect(devB.tables.foods).toHaveLength(0);
  });

  it('5. Deleting Last WorkoutLog & BodyMetric on 2026-11-25 clears remote bucket and propagates to B and C', async () => {
    const workout25: WorkoutLog = {
      id: 'wlog-25',
      date: '2026-11-25',
      exercises: [],
      createdAt: 1000,
      updatedAt: 1000,
      rev: 1,
    };
    const metric25: BodyMetric = {
      id: 'bm-25',
      date: '2026-11-25',
      weight: 69.5,
      createdAt: 1000,
      updatedAt: 1000,
      rev: 1,
    };

    const devA = createDevice('Device A', {
      workout_logs: [workout25],
      body_metrics: [metric25],
    });
    await syncDevice(devA);

    const devB = createDevice('Device B');
    await syncDevice(devB);
    expect(devB.tables.workout_logs).toHaveLength(1);
    expect(devB.tables.body_metrics).toHaveLength(1);

    // A deletes the only logs for 2026-11-25
    const delTs = Date.now();
    devA.tables.workout_logs = [];
    devA.tables.body_metrics = [];
    devA.tombstones = {
      workout_logs: { 'wlog-25': delTs },
      body_metrics: { 'bm-25': delTs },
    };

    await syncDevice(devA);

    // Remote monthly bucket should have empty workoutLogs and bodyMetrics
    const monthBucket = JSON.parse(dropboxFiles.get('/app/logs/2026-11.json')!.content) as {
      workoutLogs: unknown[];
      bodyMetrics: unknown[];
    };
    expect(monthBucket.workoutLogs).toEqual([]);
    expect(monthBucket.bodyMetrics).toEqual([]);

    await syncDevice(devB);
    expect(devB.tables.workout_logs).toHaveLength(0);
    expect(devB.tables.body_metrics).toHaveLength(0);

    const devC = createDevice('Device C');
    await initialMergeDevice(devC);
    expect(devC.tables.workout_logs).toHaveLength(0);
    expect(devC.tables.body_metrics).toHaveLength(0);
  });

  it('6. Concurrent UserBaseInfo / WorkoutRoutine / FoodRecipe & Tie-Breaking / Clock Skew', async () => {
    const devA = createDevice('Device A', {
      user_base_info: [
        {
          id: 'primary_user',
          name: 'Alice-Local',
          gender: 'female',
          birthDate: '1995-03',
          heightCm: 165,
          createdAt: 1000,
          updatedAt: 9000, // higher clock, lower rev
          rev: 1,
        },
      ],
      routines: [
        {
          id: 'rt-1',
          name: 'Push Day A',
          exercises: [{ exerciseId: 'ex-1' }],
          isCustom: true,
          createdAt: 1000,
          updatedAt: 2000,
          rev: 1,
        },
      ],
      recipes: [
        {
          id: 'rec-1',
          name: 'Oat Bowl',
          ingredients: [{ foodId: 'f1', quantity: 50, unit: 'g' }],
          isCustom: true,
          createdAt: 1000,
          updatedAt: 2000,
          rev: 1,
        },
      ],
      body_metrics: [
        {
          id: 'bm-1',
          date: '2026-11-26',
          weight: 60.2,
          createdAt: 1000,
          updatedAt: 2000,
          rev: 1,
        },
      ],
    });

    const devB = createDevice('Device B', {
      user_base_info: [
        {
          id: 'primary_user',
          name: 'Alice-Remote',
          gender: 'female',
          birthDate: '1995-03',
          heightCm: 166,
          createdAt: 1000,
          updatedAt: 1500, // lower clock (clock skew), higher rev
          rev: 2,
        },
      ],
      routines: [
        {
          id: 'rt-1',
          name: 'Push Day B',
          exercises: [{ exerciseId: 'ex-1' }, { exerciseId: 'ex-2' }],
          isCustom: true,
          createdAt: 1000,
          updatedAt: 3000,
          rev: 1,
        },
      ],
      recipes: [
        {
          id: 'rec-1',
          name: 'Oat Bowl', // exact rev + updatedAt tie
          ingredients: [{ foodId: 'f1', quantity: 50, unit: 'g' }],
          isCustom: true,
          createdAt: 1000,
          updatedAt: 2000,
          rev: 1,
        },
      ],
      body_metrics: [
        {
          id: 'bm-1',
          date: '2026-11-26',
          weight: 60.0,
          bodyFat: 21.5,
          createdAt: 1000,
          updatedAt: 2500,
          rev: 2,
        },
      ],
    });

    await syncDevice(devA);
    await syncDevice(devB);
    await syncDevice(devA);

    // Clock skew: higher rev (2 > 1) wins despite lower updatedAt (1500 < 9000)
    expect(devA.tables.user_base_info[0].name).toBe('Alice-Remote');
    expect(devB.tables.user_base_info[0].name).toBe('Alice-Remote');
    expect(devA.tables.user_base_info[0].heightCm).toBe(166);

    // Same rev, higher updatedAt wins
    expect(devA.tables.routines[0].name).toBe('Push Day B');
    expect(devB.tables.routines[0].name).toBe('Push Day B');

    // Exact tie converges cleanly
    expect(devA.tables.recipes[0].name).toBe('Oat Bowl');
    expect(devB.tables.recipes[0].name).toBe('Oat Bowl');

    // BodyMetric higher rev wins
    expect(devA.tables.body_metrics[0].weight).toBe(60.0);
    expect(devA.tables.body_metrics[0].bodyFat).toBe(21.5);
  });
});
