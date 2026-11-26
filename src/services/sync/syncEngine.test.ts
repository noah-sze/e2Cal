import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mergeEntities,
  mergeEntityTombstoneMaps,
  mergeWorkoutLogs,
  mergeDietLogsByDate,
  groupFoodLogsByDate,
  groupWorkoutLogsByDate,
  groupBodyMetricsByDate,
  getSyncErrorReasonKey,
  formatSyncErrorMessage,
  executeSync,
  _resetConflictRetryCount,
  _getConflictRetryCount,
  getCachedRevs,
} from './syncEngine';
import {
  getDropboxAppKey,
  getDropboxRedirectUri,
  generateCodeVerifier,
  generateOAuthState,
  captureDropboxOAuthCallback,
  consumePendingDropboxOAuthCallback,
  getStagingTokens,
  setStagingTokens,
  commitStagingTokens,
  clearStagingTokens,
  clearDropboxTokens,
  setStoredTokens,
  isDropboxConnected,
  type DropboxTokens,
} from './dropboxAuth';
import i18n from '@/i18n/config';
import { toast } from '@/components/ui/toast';
import { db } from '@/services/db/db';
import { _resetNetworkStatus } from '@/hooks/useNetworkStatus';
import type { FoodLog, WorkoutLog, BodyMetric, DailyDietLog } from '@/types';

class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string) {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.store[key] = value.toString();
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('syncEngine', () => {
  describe('mergeEntities algorithm', () => {
    it('returns empty list when both local and remote are empty', () => {
      const result = mergeEntities([], []);
      expect(result.merged).toEqual([]);
      expect(result.hasLocalChanges).toBe(false);
      expect(result.hasRemoteChanges).toBe(false);
    });

    it('merges remote-only items and marks hasLocalChanges', () => {
      const remote = [{ id: 'item1', name: 'Apple', updatedAt: 1000 }];
      const result = mergeEntities([], remote);
      expect(result.merged).toEqual(remote);
      expect(result.hasLocalChanges).toBe(true);
      expect(result.hasRemoteChanges).toBe(false);
    });

    it('keeps local-only items and marks hasRemoteChanges', () => {
      const local = [{ id: 'item1', name: 'Banana', updatedAt: 1000 }];
      const result = mergeEntities(local, []);
      expect(result.merged).toEqual(local);
      expect(result.hasLocalChanges).toBe(false);
      expect(result.hasRemoteChanges).toBe(true);
    });

    it('prioritizes higher rev regardless of timestamp', () => {
      const local = [{ id: 'item1', name: 'LocalOld', rev: 2, updatedAt: 5000 }];
      const remote = [{ id: 'item1', name: 'RemoteNew', rev: 3, updatedAt: 1000 }];

      const result = mergeEntities(local, remote);
      expect(result.merged[0].name).toBe('RemoteNew');
      expect(result.hasLocalChanges).toBe(true);
      expect(result.hasRemoteChanges).toBe(false);

      // 反向：本地 rev 較高
      const local2 = [{ id: 'item1', name: 'LocalNew', rev: 4, updatedAt: 1000 }];
      const remote2 = [{ id: 'item1', name: 'RemoteOld', rev: 3, updatedAt: 5000 }];
      const result2 = mergeEntities(local2, remote2);
      expect(result2.merged[0].name).toBe('LocalNew');
      expect(result2.hasLocalChanges).toBe(false);
      expect(result2.hasRemoteChanges).toBe(true);
    });

    it('resolves by updatedAt when rev is equal or undefined', () => {
      const local = [{ id: 'item1', name: 'Local', updatedAt: 2000 }];
      const remote = [{ id: 'item1', name: 'Remote', updatedAt: 3000 }];

      const result = mergeEntities(local, remote);
      expect(result.merged[0].name).toBe('Remote');
      expect(result.hasLocalChanges).toBe(true);
      expect(result.hasRemoteChanges).toBe(false);

      const localNewer = [{ id: 'item1', name: 'LocalNewer', updatedAt: 5000 }];
      const remoteOlder = [{ id: 'item1', name: 'RemoteOlder', updatedAt: 3000 }];
      const result2 = mergeEntities(localNewer, remoteOlder);
      expect(result2.merged[0].name).toBe('LocalNewer');
      expect(result2.hasLocalChanges).toBe(false);
      expect(result2.hasRemoteChanges).toBe(true);
    });

    it('當合併實體時，若一邊缺少次級營養素而另一邊存在，應保留次級營養素（防止歷史殘損覆蓋）', () => {
      interface TestFoodEntity {
        id: string;
        name: string;
        macros: {
          calories: number;
          carbs: { total: number; sugar?: number };
          protein: number;
          fat: { total: number };
        };
        updatedAt: number;
      }
      const localWithSugar: TestFoodEntity = {
        id: 'coca_cola_id',
        name: 'Coca-Cola · 可口可樂',
        macros: { calories: 140, carbs: { total: 35, sugar: 35 }, protein: 0, fat: { total: 0 } },
        updatedAt: 1000,
      };
      const remoteWithoutSugar: TestFoodEntity = {
        id: 'coca_cola_id',
        name: 'Coca-Cola · 可口可樂',
        macros: { calories: 140, carbs: { total: 35 }, protein: 0, fat: { total: 0 } },
        updatedAt: 2000, // remote is newer
      };
      const result = mergeEntities([localWithSugar], [remoteWithoutSugar]);
      expect(result.merged[0].macros.carbs.sugar).toBe(35);

      // 反向：本地較新但缺少 sugar，遠端有 sugar
      const localWithoutSugar: TestFoodEntity = {
        id: 'coca_cola_id_2',
        name: 'Coca-Cola · 可口可樂',
        macros: { calories: 140, carbs: { total: 35 }, protein: 0, fat: { total: 0 } },
        updatedAt: 3000,
      };
      const remoteWithSugar: TestFoodEntity = {
        id: 'coca_cola_id_2',
        name: 'Coca-Cola · 可口可樂',
        macros: { calories: 140, carbs: { total: 35, sugar: 35 }, protein: 0, fat: { total: 0 } },
        updatedAt: 1000,
      };
      const result2 = mergeEntities([localWithoutSugar], [remoteWithSugar]);
      expect(result2.merged[0].macros.carbs.sugar).toBe(35);
    });

    it('prevents deleted entities from resurrecting via tombstones and reports deletedIds for local cleanup', () => {
      const now = 40 * 24 * 60 * 60 * 1000;
      const local = [
        { id: 'food-deleted-remote', updatedAt: now - 5000, rev: 1 },
        { id: 'food-recreated', updatedAt: now - 500, rev: 2 },
      ];
      const remote = [
        { id: 'food-deleted-local', updatedAt: now - 4000, rev: 1 },
        { id: 'food-keep', updatedAt: now - 3000, rev: 1 },
      ];
      const tombstones = {
        'food-deleted-remote': now - 2000,
        'food-deleted-local': now - 1000,
        'food-recreated': now - 3000,
      };

      const result = mergeEntities(local, remote, tombstones, now);
      expect(result.merged.map((i) => i.id)).toEqual(['food-recreated', 'food-keep']);
      expect(result.deletedIds).toEqual(['food-deleted-remote']);
      expect(result.hasLocalChanges).toBe(true);
      expect(result.hasRemoteChanges).toBe(true);
    });

    it('merges entity tombstone maps and prunes entries older than 30 days', () => {
      const now = 40 * 24 * 60 * 60 * 1000;
      const { merged, changedLocal, changedRemote } = mergeEntityTombstoneMaps(
        { foods: { f1: now - 1000, old: 1000 } },
        { foods: { f2: now - 2000 }, recipes: { r1: now - 500 } },
        now
      );

      expect(changedLocal).toBe(true);
      expect(changedRemote).toBe(true);
      expect(merged).toEqual({
        foods: { f1: now - 1000, f2: now - 2000 },
        recipes: { r1: now - 500 },
      });
    });
  });

  describe('mergeDietLogsByDate algorithm', () => {
    it('returns empty list when both local and remote are empty', () => {
      const result = mergeDietLogsByDate([], []);
      expect(result.merged).toEqual([]);
      expect(result.hasLocalChanges).toBe(false);
      expect(result.hasRemoteChanges).toBe(false);
    });

    it('merges remote-only items and marks hasLocalChanges', () => {
      const remote: DailyDietLog[] = [
        {
          id: 'remote-1',
          date: '2026-11-10',
          meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
          entries: [],
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];
      const result = mergeDietLogsByDate([], remote);
      expect(result.merged).toEqual(remote);
      expect(result.hasLocalChanges).toBe(true);
      expect(result.hasRemoteChanges).toBe(false);
    });

    it('keeps local-only items and marks hasRemoteChanges', () => {
      const local: DailyDietLog[] = [
        {
          id: 'local-1',
          date: '2026-11-10',
          meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
          entries: [],
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];
      const result = mergeDietLogsByDate(local, []);
      expect(result.merged).toEqual(local);
      expect(result.hasLocalChanges).toBe(false);
      expect(result.hasRemoteChanges).toBe(true);
    });

    it('merges same date with different ids by preserving local id and deduplicating', () => {
      const local: DailyDietLog[] = [
        {
          id: 'local-id-preserve',
          date: '2026-11-11',
          meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
          entries: [],
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];
      const remote: DailyDietLog[] = [
        {
          id: 'remote-different-id',
          date: '2026-11-11',
          meta: { activityLevel: 1.725, macroSplit: { carbs: 50, protein: 25, fat: 25 } },
          entries: [],
          createdAt: 1000,
          updatedAt: 2000, // remote is newer
        },
      ];

      const result = mergeDietLogsByDate(local, remote);
      // 必須去重且只保留一筆
      expect(result.merged).toHaveLength(1);
      // 關鍵：必須保留本地 id 避免 Dexie &date 唯一約束衝突
      expect(result.merged[0].id).toBe('local-id-preserve');
      expect(result.merged[0].date).toBe('2026-11-11');
      expect(result.merged[0].meta.activityLevel).toBe(1.725);
      expect(result.hasLocalChanges).toBe(true);
      expect(result.hasRemoteChanges).toBe(false);
    });

    it('prioritizes higher rev regardless of timestamp', () => {
      const local: DailyDietLog[] = [
        {
          id: 'local-id',
          date: '2026-11-11',
          meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
          entries: [],
          rev: 1,
          createdAt: 1000,
          updatedAt: 9999, // newer timestamp, but lower rev
        },
      ];
      const remote: DailyDietLog[] = [
        {
          id: 'remote-id',
          date: '2026-11-11',
          meta: { activityLevel: 1.9, macroSplit: { carbs: 50, protein: 25, fat: 25 } },
          entries: [],
          rev: 2, // higher rev wins
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];

      const result = mergeDietLogsByDate(local, remote);
      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].id).toBe('local-id');
      expect(result.merged[0].meta.activityLevel).toBe(1.9);
      expect(result.hasLocalChanges).toBe(true);
      expect(result.hasRemoteChanges).toBe(false);

      // 反向：本地 rev 較高
      const local2: DailyDietLog[] = [{ ...local[0], rev: 3, updatedAt: 1000 }];
      const remote2: DailyDietLog[] = [{ ...remote[0], rev: 2, updatedAt: 9999 }];
      const result2 = mergeDietLogsByDate(local2, remote2);
      expect(result2.merged[0].id).toBe('local-id');
      expect(result2.merged[0].meta.activityLevel).toBe(1.55);
      expect(result2.hasLocalChanges).toBe(false);
      expect(result2.hasRemoteChanges).toBe(true);
    });

    it('resolves by updatedAt when rev is equal or undefined', () => {
      const local: DailyDietLog[] = [
        {
          id: 'local-id',
          date: '2026-11-11',
          meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
          entries: [],
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];
      const remote: DailyDietLog[] = [
        {
          id: 'remote-id',
          date: '2026-11-11',
          meta: { activityLevel: 1.9, macroSplit: { carbs: 50, protein: 25, fat: 25 } },
          entries: [],
          createdAt: 1000,
          updatedAt: 3000, // remote is newer
        },
      ];

      const result = mergeDietLogsByDate(local, remote);
      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].id).toBe('local-id');
      expect(result.merged[0].meta.activityLevel).toBe(1.9);
      expect(result.hasLocalChanges).toBe(true);
      expect(result.hasRemoteChanges).toBe(false);

      // 本地 timestamp 較新
      const localNewer: DailyDietLog[] = [{ ...local[0], updatedAt: 5000 }];
      const remoteOlder: DailyDietLog[] = [{ ...remote[0], updatedAt: 3000 }];
      const result2 = mergeDietLogsByDate(localNewer, remoteOlder);
      expect(result2.merged[0].id).toBe('local-id');
      expect(result2.merged[0].meta.activityLevel).toBe(1.55);
      expect(result2.hasLocalChanges).toBe(false);
      expect(result2.hasRemoteChanges).toBe(true);
    });

    it('merges distinct entries created offline on two devices on the same day without data loss', () => {
      const local: DailyDietLog[] = [
        {
          id: 'local-id',
          date: '2026-11-25',
          meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
          entries: [
            { id: 'd1-e1', date: '2026-11-25', mealType: 'breakfast', foodId: 'f1', quantity: 100, unit: 'g', createdAt: 1000, updatedAt: 1000 },
            { id: 'd1-e2', date: '2026-11-25', mealType: 'breakfast', foodId: 'f2', quantity: 50, unit: 'g', createdAt: 1100, updatedAt: 1100 },
          ],
          createdAt: 1000,
          updatedAt: 1100,
          rev: 2,
        },
      ];
      const remote: DailyDietLog[] = [
        {
          id: 'remote-id',
          date: '2026-11-25',
          meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
          entries: [
            { id: 'd2-e1', date: '2026-11-25', mealType: 'lunch', foodId: 'f3', quantity: 200, unit: 'g', createdAt: 2000, updatedAt: 2000 },
          ],
          createdAt: 2000,
          updatedAt: 2000,
          rev: 3,
        },
      ];

      const result = mergeDietLogsByDate(local, remote, 3000);
      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].entries.map((e) => e.id)).toEqual(['d1-e1', 'd1-e2', 'd2-e1']);
      expect(result.hasLocalChanges).toBe(true);
      expect(result.hasRemoteChanges).toBe(true);
    });

    it('prevents deleted entries from resurrecting via deletedEntries tombstones and prunes expired ones', () => {
      const now = 40 * 24 * 60 * 60 * 1000;
      const local: DailyDietLog[] = [
        {
          id: 'local-id',
          date: '2026-11-25',
          meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
          entries: [],
          deletedEntries: {
            'entry-del': now - 1000,
            'entry-expired': 1000,
          },
          createdAt: 1000,
          updatedAt: now - 1000,
        },
      ];
      const remote: DailyDietLog[] = [
        {
          id: 'remote-id',
          date: '2026-11-25',
          meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
          entries: [
            { id: 'entry-del', date: '2026-11-25', mealType: 'breakfast', foodId: 'f1', quantity: 100, unit: 'g', createdAt: 1000, updatedAt: now - 5000 },
            { id: 'entry-keep', date: '2026-11-25', mealType: 'lunch', foodId: 'f2', quantity: 100, unit: 'g', createdAt: 2000, updatedAt: now - 2000 },
          ],
          createdAt: 1000,
          updatedAt: now - 2000,
        },
      ];

      const result = mergeDietLogsByDate(local, remote, now);
      expect(result.merged[0].entries.map((e) => e.id)).toEqual(['entry-keep']);
      expect(result.merged[0].deletedEntries).toEqual({ 'entry-del': now - 1000 });
      expect(result.hasLocalChanges).toBe(true);
      expect(result.hasRemoteChanges).toBe(true);
    });
  });

  describe('mergeWorkoutLogs algorithm', () => {
    it('merges distinct exercises and sets edited offline on two devices for the same WorkoutLog id', () => {
      const local: WorkoutLog[] = [
        {
          id: 'w-1',
          date: '2026-11-25',
          exercises: [
            {
              exerciseId: 'squat',
              sets: [{ id: 's1', setNumber: 1, weight: 100, reps: 5, isCompleted: true, updatedAt: 1000 }],
            },
          ],
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];
      const remote: WorkoutLog[] = [
        {
          id: 'w-1',
          date: '2026-11-25',
          exercises: [
            {
              exerciseId: 'squat',
              sets: [{ id: 's2', setNumber: 2, weight: 105, reps: 5, isCompleted: true, updatedAt: 2000 }],
            },
            {
              exerciseId: 'bench',
              sets: [{ id: 'b1', setNumber: 1, weight: 80, reps: 8, isCompleted: true, updatedAt: 2000 }],
            },
          ],
          createdAt: 1000,
          updatedAt: 2000,
        },
      ];

      const result = mergeWorkoutLogs(local, remote, undefined, 3000);
      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].exercises.map((g) => g.exerciseId)).toEqual(['squat', 'bench']);
      expect(result.merged[0].exercises[0].sets.map((s) => s.id)).toEqual(['s1', 's2']);
      expect(result.hasLocalChanges).toBe(true);
      expect(result.hasRemoteChanges).toBe(true);
    });

    it('prevents deleted sets from resurrecting via deletedSetIds tombstones', () => {
      const now = 40 * 24 * 60 * 60 * 1000;
      const local: WorkoutLog[] = [
        {
          id: 'w-1',
          date: '2026-11-25',
          exercises: [
            {
              exerciseId: 'squat',
              sets: [{ id: 's1', setNumber: 1, weight: 100, reps: 5, isCompleted: true, updatedAt: now - 5000 }],
            },
          ],
          deletedSetIds: { 's2': now - 1000 },
          createdAt: 1000,
          updatedAt: now - 1000,
        },
      ];
      const remote: WorkoutLog[] = [
        {
          id: 'w-1',
          date: '2026-11-25',
          exercises: [
            {
              exerciseId: 'squat',
              sets: [
                { id: 's1', setNumber: 1, weight: 100, reps: 5, isCompleted: true, updatedAt: now - 5000 },
                { id: 's2', setNumber: 2, weight: 110, reps: 5, isCompleted: true, updatedAt: now - 4000 },
              ],
            },
          ],
          createdAt: 1000,
          updatedAt: now - 4000,
        },
      ];

      const result = mergeWorkoutLogs(local, remote, undefined, now);
      expect(result.merged[0].exercises[0].sets.map((s) => s.id)).toEqual(['s1']);
      expect(result.merged[0].deletedSetIds).toEqual({ 's2': now - 1000 });
    });
  });

  describe('grouping functions', () => {
    it('groups food logs by YYYY-MM-DD', () => {
      const logs: FoodLog[] = [
        {
          id: '1',
          date: '2026-11-06',
          mealType: 'breakfast',
          foodId: 'food-1',
          quantity: 100,
          unit: 'g',
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: '2',
          date: '2026-11-06',
          mealType: 'lunch',
          foodId: 'food-2',
          quantity: 200,
          unit: 'g',
          createdAt: 2000,
          updatedAt: 2000,
        },
        {
          id: '3',
          date: '2026-10-15',
          mealType: 'dinner',
          foodId: 'food-3',
          quantity: 150,
          unit: 'g',
          createdAt: 3000,
          updatedAt: 3000,
        },
      ];

      const grouped = groupFoodLogsByDate(logs);
      expect(Object.keys(grouped).sort()).toEqual(['2026-10-15', '2026-11-06']);
      expect(grouped['2026-11-06']).toHaveLength(2);
      expect(grouped['2026-10-15']).toHaveLength(1);
    });

    it('groups workout logs by YYYY-MM-DD', () => {
      const logs: WorkoutLog[] = [
        {
          id: 'w1',
          date: '2026-11-06',
          exercises: [],
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: 'w2',
          date: '2026-09-20',
          exercises: [],
          createdAt: 2000,
          updatedAt: 2000,
        },
      ];

      const grouped = groupWorkoutLogsByDate(logs);
      expect(grouped['2026-11-06']).toHaveLength(1);
      expect(grouped['2026-09-20']).toHaveLength(1);
    });

    it('groups body metrics by YYYY-MM-DD', () => {
      const metrics: BodyMetric[] = [
        { id: 'm1', date: '2026-01-01', weight: 70, createdAt: 1000, updatedAt: 1000 },
        { id: 'm2', date: '2026-11-06', weight: 74, createdAt: 2000, updatedAt: 2000 },
        { id: 'm3', date: '2025-12-31', weight: 68, createdAt: 3000, updatedAt: 3000 },
      ];

      const grouped = groupBodyMetricsByDate(metrics);
      expect(grouped['2026-11-06']).toHaveLength(1);
      expect(grouped['2026-01-01']).toHaveLength(1);
      expect(grouped['2025-12-31']).toHaveLength(1);
    });
  });
});

describe('dropboxAuth', () => {
  beforeEach(() => {
    const mockStorage = new LocalStorageMock();
    const mockSessionStorage = new LocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
      configurable: true,
    });
    clearDropboxTokens();
  });

  it('generates random code verifier with base64url characters', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toBeDefined();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    // Base64URL should not have +, /, or =
    expect(verifier).not.toContain('+');
    expect(verifier).not.toContain('/');
    expect(verifier).not.toContain('=');
  });

  it('generates dropbox-prefixed random OAuth state with base64url characters', () => {
    const state = generateOAuthState();
    expect(state.startsWith('dropbox_')).toBe(true);
    expect(state.length).toBeGreaterThan(20);
    expect(state).not.toContain('+');
    expect(state).not.toContain('/');
    expect(state).not.toContain('=');
  });

  it('uses single-URL /app as Dropbox OAuth redirect URI', () => {
    expect(new URL(getDropboxRedirectUri()).pathname).toBe('/app');
  });

  it('captures valid OAuth callback before router rewrites URL and consumes it only once', () => {
    const state = generateOAuthState();
    sessionStorage.setItem('e2cal_dropbox_code_verifier', 'test_verifier');
    sessionStorage.setItem('e2cal_dropbox_oauth_state', state);

    const captured = captureDropboxOAuthCallback(`?code=auth_code_123&state=${state}`, '/app');
    expect(captured).toEqual({ kind: 'code', code: 'auth_code_123', mode: 'sync' });
    // state 驗證通過後立即移除，防止重放
    expect(sessionStorage.getItem('e2cal_dropbox_oauth_state')).toBeNull();
    // verifier 留待 exchangeCodeForTokensOnly 消費
    expect(sessionStorage.getItem('e2cal_dropbox_code_verifier')).toBe('test_verifier');

    // 即使 AppRouter 隨後清理網址列，Hook 仍能一次性消費已捕獲的 code
    expect(consumePendingDropboxOAuthCallback()).toEqual({
      kind: 'code',
      code: 'auth_code_123',
      mode: 'sync',
    });
    // 第二次消費（模擬 StrictMode 或雙 Hook 實例）必須回傳 null
    expect(consumePendingDropboxOAuthCallback()).toBeNull();
  });

  it('preserves restore OAuth mode when initiated from landing cloud import', () => {
    const state = generateOAuthState();
    sessionStorage.setItem('e2cal_dropbox_code_verifier', 'test_verifier');
    sessionStorage.setItem('e2cal_dropbox_oauth_state', state);
    sessionStorage.setItem('e2cal_dropbox_oauth_mode', 'restore');

    const captured = captureDropboxOAuthCallback(`?code=restore_code_99&state=${state}`, '/app');
    expect(captured).toEqual({ kind: 'code', code: 'restore_code_99', mode: 'restore' });
    expect(sessionStorage.getItem('e2cal_dropbox_oauth_mode')).toBeNull();
    expect(consumePendingDropboxOAuthCallback()).toEqual({
      kind: 'code',
      code: 'restore_code_99',
      mode: 'restore',
    });
  });

  it('rejects OAuth callback with mismatched state and cleans up session artifacts', () => {
    sessionStorage.setItem('e2cal_dropbox_code_verifier', 'test_verifier');
    sessionStorage.setItem('e2cal_dropbox_oauth_state', 'dropbox_expected_state');

    const captured = captureDropboxOAuthCallback(
      '?code=auth_code_123&state=dropbox_tampered_state',
      '/app'
    );
    expect(captured).toEqual({
      kind: 'error',
      error: 'oauth_state_mismatch',
      errorDescription: 'OAuth state verification failed',
    });
    expect(sessionStorage.getItem('e2cal_dropbox_code_verifier')).toBeNull();
    expect(sessionStorage.getItem('e2cal_dropbox_oauth_state')).toBeNull();
    expect(consumePendingDropboxOAuthCallback()).toEqual(captured);
    expect(consumePendingDropboxOAuthCallback()).toBeNull();
  });

  it('captures OAuth error callback (e.g. access_denied) and cleans up verifier/state', () => {
    sessionStorage.setItem('e2cal_dropbox_code_verifier', 'test_verifier');
    sessionStorage.setItem('e2cal_dropbox_oauth_state', 'dropbox_state_1');

    const captured = captureDropboxOAuthCallback(
      '?error=access_denied&error_description=The+user+chose+not+to+give+your+app+access',
      '/app'
    );
    expect(captured).toEqual({
      kind: 'error',
      error: 'access_denied',
      errorDescription: 'The user chose not to give your app access',
    });
    expect(sessionStorage.getItem('e2cal_dropbox_code_verifier')).toBeNull();
    expect(sessionStorage.getItem('e2cal_dropbox_oauth_state')).toBeNull();
    expect(consumePendingDropboxOAuthCallback()).toEqual(captured);
  });

  it('ignores non-callback paths and foreign provider states', () => {
    sessionStorage.setItem('e2cal_dropbox_code_verifier', 'test_verifier');
    sessionStorage.setItem('e2cal_dropbox_oauth_state', 'dropbox_state_1');

    expect(captureDropboxOAuthCallback('?code=abc&state=dropbox_state_1', '/')).toBeNull();
    expect(captureDropboxOAuthCallback('?code=abc&state=dropbox_state_1', '/settings')).toBeNull();
    expect(consumePendingDropboxOAuthCallback()).toBeNull();

    sessionStorage.removeItem('e2cal_dropbox_oauth_state');
    expect(captureDropboxOAuthCallback('?code=abc&state=gdrive_other', '/app')).toBeNull();
    expect(consumePendingDropboxOAuthCallback()).toBeNull();
  });

  it('reports explicit pkce_verifier_missing error when session verifier is lost', () => {
    const captured = captureDropboxOAuthCallback('?code=auth_code_456', '/app');
    expect(captured).toEqual({
      kind: 'error',
      error: 'pkce_verifier_missing',
      errorDescription: 'PKCE verification failed: Code verifier missing from session.',
    });
    expect(consumePendingDropboxOAuthCallback()).toEqual(captured);
  });

  it('reads app key from environment variable and disallows user customization', () => {
    // 預設由開發者環境變數提供，不允許使用者自訂修改
    expect(typeof getDropboxAppKey()).toBe('string');
  });

  it('handles staging tokens transactional commit and clear', () => {
    const mockTokens: DropboxTokens = {
      access_token: 'test_token',
      refresh_token: 'refresh_test',
      expires_in: 3600,
      expires_at: Date.now() + 3600000,
    };

    expect(isDropboxConnected()).toBe(false);
    expect(getStagingTokens()).toBeNull();

    setStagingTokens(mockTokens);
    expect(getStagingTokens()).toEqual(mockTokens);
    clearStagingTokens();
    expect(getStagingTokens()).toBeNull();

    setStagingTokens(mockTokens);
    expect(getStagingTokens()).toEqual(mockTokens);
    // Staging tokens are not committed yet to localStorage
    expect(isDropboxConnected()).toBe(false);

    commitStagingTokens();
    expect(getStagingTokens()).toBeNull();
    expect(isDropboxConnected()).toBe(true);

    clearDropboxTokens();
    expect(isDropboxConnected()).toBe(false);
  });
});

describe('syncErrorReason & Toast handling', () => {
  beforeEach(() => {
    _resetNetworkStatus();
    const mockStorage = new LocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    clearDropboxTokens();
    vi.restoreAllMocks();
  });

  it('classifies common Dropbox, network, and local errors accurately via getSyncErrorReasonKey', () => {
    expect(
      getSyncErrorReasonKey(
        new Error('NETWORK_TIMEOUT: Request to https://api.dropboxapi.com timed out after 12000ms')
      )
    ).toBe('timeout');
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    expect(getSyncErrorReasonKey(abortErr)).toBe('timeout');

    expect(getSyncErrorReasonKey(new TypeError('Failed to fetch'))).toBe('network');
    expect(getSyncErrorReasonKey('ERR_INTERNET_DISCONNECTED')).toBe('network');
    expect(getSyncErrorReasonKey('Load failed')).toBe('network');

    expect(
      getSyncErrorReasonKey(
        new Error(
          'Failed to upload file /nutrition/logs/2026-11-12.json (401): {"error_summary": "expired_access_token/..."}'
        )
      )
    ).toBe('auth');
    expect(getSyncErrorReasonKey(new Error('Dropbox not authenticated'))).toBe('auth');
    expect(getSyncErrorReasonKey('Dropbox not connected')).toBe('auth');
    expect(
      getSyncErrorReasonKey('PKCE verification failed: Code verifier missing from session.')
    ).toBe('auth');
    expect(getSyncErrorReasonKey('oauth_state_mismatch')).toBe('auth');
    expect(getSyncErrorReasonKey('OAuth state verification failed')).toBe('auth');
    expect(getSyncErrorReasonKey('pkce_verifier_missing')).toBe('auth');
    expect(getSyncErrorReasonKey('Dropbox token exchange failed (400): invalid_grant')).toBe(
      'auth'
    );

    expect(
      getSyncErrorReasonKey(
        new Error('Failed to upload file /foods.json (507): {"error_summary": "insufficient_space"}')
      )
    ).toBe('quota');

    expect(
      getSyncErrorReasonKey(
        new Error(
          'Failed to upload file /foods.json (429): {"error_summary": "too_many_write_operations"}'
        )
      )
    ).toBe('rate_limit');

    expect(
      getSyncErrorReasonKey(
        new Error('DROPBOX_CONFLICT: File /nutrition/foods.json has a newer version on remote')
      )
    ).toBe('conflict');

    expect(getSyncErrorReasonKey(new Error('Failed to list folder (503): Service Unavailable'))).toBe(
      'server'
    );
    expect(getSyncErrorReasonKey(new Error('Failed to list folder (500): internal_error'))).toBe(
      'server'
    );

    expect(
      getSyncErrorReasonKey(
        new Error('Failed to list folder (403): {"error_summary": "insufficient_permissions"}')
      )
    ).toBe('permission');

    expect(getSyncErrorReasonKey(new Error('Unexpected database glitch'))).toBe('unknown');
  });

  it('formats error messages in zh-TW, zh-CN, and en via formatSyncErrorMessage', async () => {
    const authErr = new Error('Failed to upload (401): expired_access_token');
    const timeoutErr = new Error('NETWORK_TIMEOUT: timed out after 12000ms');

    await i18n.changeLanguage('zh-TW');
    expect(formatSyncErrorMessage(authErr)).toBe('授權憑證已過期或失效，請重新連線');
    expect(formatSyncErrorMessage(timeoutErr)).toBe('連線逾時，請檢查網路環境');

    await i18n.changeLanguage('zh-CN');
    expect(formatSyncErrorMessage(authErr)).toBe('授权凭证已过期或失效，请重新连接');
    expect(formatSyncErrorMessage(timeoutErr)).toBe('连接超时，请检查网络环境');

    await i18n.changeLanguage('en');
    expect(formatSyncErrorMessage(authErr)).toBe('Session expired · Reconnect');
    expect(formatSyncErrorMessage(timeoutErr)).toBe('Connection timed out');

    await i18n.changeLanguage('zh-TW');
  });

  it('triggers localized toast when executeSync fails with network or API error', async () => {
    await i18n.changeLanguage('zh-TW');
    const toastSpy = vi.spyOn(toast, 'show');

    setStoredTokens({
      access_token: 'valid_token',
      expires_in: 14400,
      expires_at: Date.now() + 14400 * 1000,
    });

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const res = await executeSync('auto');
    expect(res.success).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith('Dropbox 同步失敗：網路連線不穩定，無法連接伺服器');
  });

  it('does not attempt sync, toast, or set error when device is offline', async () => {
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      configurable: true,
    });

    const toastSpy = vi.spyOn(toast, 'show');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    setStoredTokens({
      access_token: 'valid_token',
      expires_in: 14400,
      expires_at: Date.now() + 14400 * 1000,
    });

    try {
      const res = await executeSync('auto');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Device is offline');
      expect(toastSpy).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
      });
    }
  });

  it('handles DROPBOX_CONFLICT with retry limit, circuit breaker, and rev caching', async () => {
    await i18n.changeLanguage('zh-TW');
    _resetConflictRetryCount();
    const toastSpy = vi.spyOn(toast, 'show');

    // Mock db tables
    vi.spyOn(db.foods, 'count').mockResolvedValue(0 as never);
    vi.spyOn(db.recipes, 'count').mockResolvedValue(0 as never);
    vi.spyOn(db.daily_diet_logs, 'count').mockResolvedValue(1 as never);
    vi.spyOn(db.exercises, 'count').mockResolvedValue(0 as never);
    vi.spyOn(db.equipments, 'count').mockResolvedValue(0 as never);
    vi.spyOn(db.routines, 'count').mockResolvedValue(1 as never);
    vi.spyOn(db.workout_logs, 'count').mockResolvedValue(0 as never);
    vi.spyOn(db.body_metrics, 'count').mockResolvedValue(0 as never);
    vi.spyOn(db.user_base_info, 'toArray').mockResolvedValue([] as never);
    vi.spyOn(db.foods, 'toArray').mockResolvedValue([] as never);
    vi.spyOn(db.foods, 'bulkPut').mockResolvedValue([] as never);
    vi.spyOn(db.recipes, 'toArray').mockResolvedValue([] as never);
    vi.spyOn(db.exercises, 'toArray').mockResolvedValue([] as never);
    vi.spyOn(db.equipments, 'toArray').mockResolvedValue([] as never);
    vi.spyOn(db.routines, 'toArray').mockResolvedValue([] as never);
    vi.spyOn(db.daily_diet_logs, 'toArray').mockResolvedValue([] as never);
    vi.spyOn(db.workout_logs, 'toArray').mockResolvedValue([] as never);
    vi.spyOn(db.body_metrics, 'toArray').mockResolvedValue([] as never);

    setStoredTokens({
      access_token: 'valid_token',
      expires_in: 14400,
      expires_at: Date.now() + 14400 * 1000,
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('files/list_folder')) {
        return new Response(
          JSON.stringify({
            entries: [
              {
                '.tag': 'file',
                name: 'foods.json',
                path_lower: '/nutrition/foods.json',
                rev: 'rev_remote_999',
              },
            ],
            has_more: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (u.includes('files/download')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Dropbox-API-Result': JSON.stringify({ rev: 'rev_remote_999' }) },
        });
      }
      if (u.includes('files/upload')) {
        return new Response('{"error_summary":"path/conflict/file"}', {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 200 });
    });

    // 第一次衝突
    const res1 = await executeSync('auto');
    expect(res1.success).toBe(false);
    expect(_getConflictRetryCount()).toBe(1);
    expect(toastSpy).toHaveBeenCalledWith('資料版本衝突，正在重新合併');
    expect(getCachedRevs()['/nutrition/foods.json']).toBe('rev_remote_999');

    // 第二次衝突
    const res2 = await executeSync('auto');
    expect(res2.success).toBe(false);
    expect(_getConflictRetryCount()).toBe(2);

    // 第三次衝突，達到熔斷上限，自動終止並重置計數
    const res3 = await executeSync('auto');
    expect(res3.success).toBe(false);
    expect(_getConflictRetryCount()).toBe(0);
  });

  it('preserves refuseRate, edibleRate, refuseDescription, dataSource, and micros during mergeEntities', () => {
    interface TestFoodMeta {
      id: string;
      name: string;
      rev: number;
      updatedAt: number;
      refuseRate?: number;
      edibleRate?: number;
      refuseDescription?: string;
      dataSource?: { authority: 'USDA'; sourceId: string };
      micros?: { potassiumMg?: number };
    }
    const local: TestFoodMeta[] = [
      {
        id: 'food-meta-1',
        name: 'Chicken Wing',
        rev: 1,
        updatedAt: 1000,
        refuseRate: 0.35,
        edibleRate: 0.65,
        refuseDescription: 'bones',
        dataSource: { authority: 'USDA', sourceId: '171477' },
        micros: { potassiumMg: 210 },
      },
    ];
    const remote: TestFoodMeta[] = [
      {
        id: 'food-meta-1',
        name: 'Chicken Wing Updated',
        rev: 2,
        updatedAt: 2000,
      },
    ];
    const res = mergeEntities(local, remote);
    expect(res.merged[0].name).toBe('Chicken Wing Updated');
    expect(res.merged[0].refuseRate).toBe(0.35);
    expect(res.merged[0].edibleRate).toBe(0.65);
    expect(res.merged[0].refuseDescription).toBe('bones');
    expect(res.merged[0].dataSource).toEqual({ authority: 'USDA', sourceId: '171477' });
    expect(res.merged[0].micros).toEqual({ potassiumMg: 210 });
  });

  it('prioritizes rev over updatedAt for DietEntry and WorkoutSet LWW', () => {
    const localDiet: DailyDietLog[] = [
      {
        id: 'd-1',
        date: '2026-11-26',
        meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
        entries: [
          {
            id: 'e-1',
            date: '2026-11-26',
            mealType: 'breakfast',
            foodId: 'f1',
            quantity: 100,
            unit: 'g',
            rev: 3,
            createdAt: 1000,
            updatedAt: 1000,
          },
        ],
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];
    const remoteDiet: DailyDietLog[] = [
      {
        id: 'd-1',
        date: '2026-11-26',
        meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
        entries: [
          {
            id: 'e-1',
            date: '2026-11-26',
            mealType: 'breakfast',
            foodId: 'f1',
            quantity: 250,
            unit: 'g',
            rev: 2,
            createdAt: 1000,
            updatedAt: 9999,
          },
        ],
        createdAt: 1000,
        updatedAt: 9999,
      },
    ];
    const dietMerged = mergeDietLogsByDate(localDiet, remoteDiet);
    expect(dietMerged.merged[0].entries[0].quantity).toBe(100);
    expect(dietMerged.hasRemoteChanges).toBe(true);

    const localW: WorkoutLog[] = [
      {
        id: 'w-rev',
        date: '2026-11-26',
        exercises: [
          {
            exerciseId: 'ex-1',
            sets: [{ id: 's-1', setNumber: 1, weight: 80, reps: 8, isCompleted: true, rev: 4, updatedAt: 1000 } as WorkoutLog['exercises'][number]['sets'][number]],
          },
        ],
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];
    const remoteW: WorkoutLog[] = [
      {
        id: 'w-rev',
        date: '2026-11-26',
        exercises: [
          {
            exerciseId: 'ex-1',
            sets: [{ id: 's-1', setNumber: 1, weight: 60, reps: 10, isCompleted: true, rev: 2, updatedAt: 9999 } as WorkoutLog['exercises'][number]['sets'][number]],
          },
        ],
        createdAt: 1000,
        updatedAt: 9999,
      },
    ];
    const wMerged = mergeWorkoutLogs(localW, remoteW);
    expect(wMerged.merged[0].exercises[0].sets[0].weight).toBe(80);
    expect(wMerged.hasRemoteChanges).toBe(true);
  });

  it('uploads merged DailyDietLog on concurrent edit, sanitizes routines on Auto Pull, and empties deleted workout/body buckets', async () => {
    setStoredTokens({
      access_token: 'valid_token',
      expires_in: 14400,
      expires_at: Date.now() + 14400 * 1000,
    });
    localStorage.setItem(
      'e2cal_dropbox_cached_revs',
      JSON.stringify({
        '/workout/logs/2026-11-25.json': 'rev_w1',
        '/body/metrics/2026-11-25.json': 'rev_b1',
      })
    );
    localStorage.setItem(
      'e2cal_dropbox_pushed_times',
      JSON.stringify({
        'workout_log_2026-11-25_count': '1',
        'body_metric_2026-11-25_count': '1',
      })
    );

    const localDietLog: DailyDietLog = {
      id: 'diet-local',
      date: '2026-11-26',
      meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
      entries: [
        { id: 'local-e1', date: '2026-11-26', mealType: 'breakfast', foodId: 'f1', quantity: 100, unit: 'g', createdAt: 1000, updatedAt: 1000 },
      ],
      createdAt: 1000,
      updatedAt: 1000,
      rev: 1,
    };
    const remoteDietLog: DailyDietLog = {
      id: 'diet-remote',
      date: '2026-11-26',
      meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
      entries: [
        { id: 'remote-e2', date: '2026-11-26', mealType: 'lunch', foodId: 'f2', quantity: 150, unit: 'g', createdAt: 2000, updatedAt: 2000 },
      ],
      createdAt: 2000,
      updatedAt: 2000,
      rev: 2,
    };

    vi.spyOn(db.foods, 'count').mockResolvedValue(0 as never);
    vi.spyOn(db.recipes, 'count').mockResolvedValue(0 as never);
    vi.spyOn(db.daily_diet_logs, 'count').mockResolvedValue(1 as never);
    vi.spyOn(db.exercises, 'count').mockResolvedValue(0 as never);
    vi.spyOn(db.equipments, 'count').mockResolvedValue(0 as never);
    vi.spyOn(db.routines, 'count').mockResolvedValue(1 as never);
    vi.spyOn(db.workout_logs, 'count').mockResolvedValue(0 as never);
    vi.spyOn(db.body_metrics, 'count').mockResolvedValue(0 as never);
    vi.spyOn(db.user_base_info, 'toArray').mockResolvedValue([] as never);
    vi.spyOn(db.foods, 'toArray').mockResolvedValue([] as never);
    vi.spyOn(db.recipes, 'toArray').mockResolvedValue([] as never);
    vi.spyOn(db.exercises, 'toArray').mockResolvedValue([] as never);
    vi.spyOn(db.equipments, 'toArray').mockResolvedValue([] as never);
    vi.spyOn(db.routines, 'toArray').mockResolvedValue([] as never);
    const routinesBulkPut = vi.spyOn(db.routines, 'bulkPut').mockResolvedValue([] as never);
    vi.spyOn(db.daily_diet_logs, 'where').mockReturnValue({
      equals: () => ({ first: async () => localDietLog }),
    } as never);
    vi.spyOn(db.daily_diet_logs, 'put').mockResolvedValue('diet-local' as never);
    vi.spyOn(db.daily_diet_logs, 'toArray').mockResolvedValue([
      {
        ...localDietLog,
        entries: [...localDietLog.entries, ...remoteDietLog.entries],
        updatedAt: 2000,
        rev: 2,
      },
    ] as never);
    vi.spyOn(db.workout_logs, 'filter').mockReturnValue({ toArray: async () => [] } as never);
    vi.spyOn(db.workout_logs, 'toArray').mockResolvedValue([] as never);
    vi.spyOn(db.body_metrics, 'filter').mockReturnValue({ toArray: async () => [] } as never);
    vi.spyOn(db.body_metrics, 'toArray').mockResolvedValue([] as never);

    const uploadedPayloads: Record<string, unknown> = {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const u = String(url);
      if (u.includes('files/list_folder')) {
        return new Response(
          JSON.stringify({
            entries: [
              { '.tag': 'file', name: 'routines.json', path_lower: '/workout/routines.json', rev: 'rev_r1' },
              { '.tag': 'file', name: '2026-11-26.json', path_lower: '/nutrition/logs/2026-11-26.json', rev: 'rev_d1' },
              { '.tag': 'file', name: '2026-11-25.json', path_lower: '/workout/logs/2026-11-25.json', rev: 'rev_w1' },
              { '.tag': 'file', name: '2026-11-25.json', path_lower: '/body/metrics/2026-11-25.json', rev: 'rev_b1' },
            ],
            has_more: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const headers = (init?.headers ?? {}) as Record<string, string>;
      if (u.includes('files/download')) {
        const arg = String(headers['Dropbox-API-Arg'] || '');
        if (arg.includes('/workout/routines.json')) {
          return new Response(
            JSON.stringify([
              { id: 'rt-1', name: 'Push', exercises: [{ exerciseId: 'ex-1', defaultSets: 4 }], createdAt: 1000, updatedAt: 1000 },
            ]),
            { status: 200, headers: { 'Dropbox-API-Result': JSON.stringify({ rev: 'rev_r1' }) } }
          );
        }
        if (arg.includes('/nutrition/logs/2026-11-26.json')) {
          return new Response(JSON.stringify(remoteDietLog), {
            status: 200,
            headers: { 'Dropbox-API-Result': JSON.stringify({ rev: 'rev_d1' }) },
          });
        }
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Dropbox-API-Result': JSON.stringify({ rev: 'rev_empty' }) },
        });
      }
      if (u.includes('files/upload')) {
        const arg = JSON.parse(headers['Dropbox-API-Arg'] || '{}');
        const bodyText =
          init?.body instanceof Blob
            ? await init.body.text()
            : typeof init?.body === 'string'
              ? init.body
              : new TextDecoder().decode(init?.body as ArrayBuffer);
        uploadedPayloads[arg.path] = JSON.parse(bodyText);
        return new Response(JSON.stringify({ rev: 'rev_new' }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const res = await executeSync('auto');
    expect(res.success).toBe(true);
    // 1. Concurrent DailyDietLog merge uploaded
    const uploadedDiet = uploadedPayloads['/nutrition/logs/2026-11-26.json'] as DailyDietLog;
    expect(uploadedDiet).toBeDefined();
    expect(uploadedDiet.entries.map((e) => e.id)).toEqual(['local-e1', 'remote-e2']);
    // 2. Routine sanitized on Auto Pull (no defaultSets)
    expect(routinesBulkPut).toHaveBeenCalled();
    const savedRoutines = routinesBulkPut.mock.calls[0][0];
    expect('defaultSets' in savedRoutines[0].exercises[0]).toBe(false);
    // 3. Empty workout & body buckets uploaded as []
    expect(uploadedPayloads['/workout/logs/2026-11-25.json']).toEqual([]);
    expect(uploadedPayloads['/body/metrics/2026-11-25.json']).toEqual([]);
  });
});

