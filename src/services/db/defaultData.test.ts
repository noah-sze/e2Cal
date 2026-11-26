import { describe, it, expect } from 'vitest';
import {
  DEFAULT_EQUIPMENTS,
  DEFAULT_EXERCISES,
  PRIMARY_USER_ID,
  DEFAULT_USER_PROFILE_ID,
} from './defaultData';

describe('系統預設數據完整性與零預設食物架構測試', () => {

  it('所有默認器械與動作實體之 ID 均必須符合標準 RFC 4122 UUID 格式', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const eq of DEFAULT_EQUIPMENTS) {
      expect(eq.id).toMatch(uuidRegex);
    }
    for (const ex of DEFAULT_EXERCISES) {
      expect(ex.id).toMatch(uuidRegex);
      if (ex.equipment) {
        expect(ex.equipment).toMatch(uuidRegex);
      }
    }
    expect(PRIMARY_USER_ID).toMatch(uuidRegex);
    expect(DEFAULT_USER_PROFILE_ID).toMatch(uuidRegex);
  });

  it('所有默認器械應具備唯一 ID 與非空名稱', () => {
    const ids = new Set<string>();
    for (const eq of DEFAULT_EQUIPMENTS) {
      expect(eq.id).toBeTruthy();
      expect(eq.name.trim()).toBeTruthy();
      expect(ids.has(eq.id)).toBe(false);
      ids.add(eq.id);
    }
  });

  it('所有默認動作必須符合肌肉群配置規範', () => {
    const ids = new Set<string>();
    for (const ex of DEFAULT_EXERCISES) {
      expect(ids.has(ex.id)).toBe(false);
      ids.add(ex.id);
      expect(ex.name.trim()).toBeTruthy();
      expect(['free_weight', 'machine', 'cable', 'bodyweight', 'other']).toContain(ex.category);
      expect(Object.keys(ex.targetMuscles || {}).length).toBeGreaterThan(0);
    }
  });

  describe('Factory Reset (徹底出廠重置契約)', () => {
    it('resetDatabaseToFactory 應重置業務資料且食物庫維持純粹清空態', async () => {
      const mockClearMap: Record<string, boolean> = {};
      const mockDeletedCustom: Record<string, boolean> = {};
      const mockUnarchived: Record<string, boolean> = {};
      const mockAddedItems: Record<string, any[]> = {};

      const createMockTable = (name: string, items: any[] = []) => ({
        clear: async () => {
          mockClearMap[name] = true;
        },
        filter: (_fn: any) => ({
          delete: async () => {
            mockDeletedCustom[name] = true;
          },
          first: async () => null,
        }),
        toCollection: () => ({
          modify: async (_updates: any) => {
            mockUnarchived[name] = true;
          },
        }),
        get: async () => null,
        where: () => ({
          equals: () => ({
            first: async () => null,
          }),
        }),
        add: async (item: any) => {
          if (!mockAddedItems[name]) mockAddedItems[name] = [];
          mockAddedItems[name].push(item);
        },
        bulkAdd: async () => {},
        toArray: async () => items,
      });

      const mockDb: any = {
        daily_diet_logs: createMockTable('daily_diet_logs'),
        workout_logs: createMockTable('workout_logs'),
        body_metrics: createMockTable('body_metrics'),
        routines: createMockTable('routines'),
        foods: createMockTable('foods', []),
        recipes: createMockTable('recipes', []),
        exercises: createMockTable('exercises', DEFAULT_EXERCISES),
        equipments: createMockTable('equipments', DEFAULT_EQUIPMENTS),
        user_profile: createMockTable('user_profile'),
        user_base_info: createMockTable('user_base_info'),
      };

      const { resetDatabaseToFactory } = await import('./defaultData');
      await resetDatabaseToFactory(mockDb);

      expect(mockClearMap.daily_diet_logs).toBe(true);
      expect(mockClearMap.workout_logs).toBe(true);
      expect(mockClearMap.body_metrics).toBe(true);
      expect(mockClearMap.routines).toBe(true);
      expect(mockClearMap.foods).toBe(true);
      expect(mockClearMap.recipes).toBe(true);
      expect(mockDeletedCustom.exercises).toBe(true);
      expect(mockDeletedCustom.equipments).toBe(true);

      // 驗證個人資料重置為出廠空白態
      expect(mockClearMap.user_profile).toBe(true);
      expect(mockClearMap.user_base_info).toBe(true);
      expect(mockAddedItems.user_profile?.[0]?.name).toBe('');
      expect(mockAddedItems.user_profile?.[0]?.heightCm).toBe(0);
      expect(mockAddedItems.user_profile?.[0]?.currentWeightKg).toBe(0);
      expect(mockAddedItems.user_profile?.[0]?.isSetupCompleted).toBe(false);
      expect(mockAddedItems.user_base_info?.[0]?.name).toBe('');
      expect(mockAddedItems.user_base_info?.[0]?.birthDate).toBe('');
      expect(mockAddedItems.user_base_info?.[0]?.heightCm).toBe(0);
    });
  });
});
