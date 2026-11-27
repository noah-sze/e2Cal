import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hasDietActivityInSnapshot,
  confirmRawWeightIfHasDietActivity,
  ensureRawWeightConfirmedFromDb,
} from './rawWeightGuide';
import { useAppStore } from '@/store/useAppStore';
import { db } from '@/services/db/db';

vi.mock('@/services/db/db', () => ({
  db: {
    foods: { count: vi.fn() },
    recipes: { count: vi.fn() },
    daily_diet_logs: { count: vi.fn(), toArray: vi.fn() },
  },
}));

describe('rawWeightGuide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ hasConfirmedRawWeight: false });
  });

  describe('hasDietActivityInSnapshot', () => {
    it('無食材、無食譜且無進食項目時應回傳 false', () => {
      expect(hasDietActivityInSnapshot({})).toBe(false);
      expect(
        hasDietActivityInSnapshot({
          foodsCount: 0,
          recipesCount: 0,
          dailyDietLogs: [{ entries: [] }],
        })
      ).toBe(false);
    });

    it('存在任一食材或食譜時應回傳 true', () => {
      expect(hasDietActivityInSnapshot({ foodsCount: 1 })).toBe(true);
      expect(hasDietActivityInSnapshot({ recipesCount: 1 })).toBe(true);
    });

    it('存在含進食項目的飲食日誌時應回傳 true', () => {
      expect(
        hasDietActivityInSnapshot({
          dailyDietLogs: [
            { entries: [] },
            {
              entries: [
                {
                  id: 'e1',
                  date: '2026-11-27',
                  mealType: 'lunch',
                  entryType: 'item',
                  quantity: 100,
                  createdAt: 1,
                  updatedAt: 1,
                },
              ],
            },
          ],
        })
      ).toBe(true);
    });
  });

  describe('confirmRawWeightIfHasDietActivity', () => {
    it('含飲食痕跡時應自動將 hasConfirmedRawWeight 設為 true', () => {
      const result = confirmRawWeightIfHasDietActivity({ foodsCount: 2 });
      expect(result).toBe(true);
      expect(useAppStore.getState().hasConfirmedRawWeight).toBe(true);
    });

    it('完全空白快照不應自動設為 true', () => {
      const result = confirmRawWeightIfHasDietActivity({
        foodsCount: 0,
        recipesCount: 0,
        dailyDietLogs: [],
      });
      expect(result).toBe(false);
      expect(useAppStore.getState().hasConfirmedRawWeight).toBe(false);
    });
  });

  describe('ensureRawWeightConfirmedFromDb', () => {
    it('若 store 已確認應直接回傳 true 且不查詢 DB', async () => {
      useAppStore.setState({ hasConfirmedRawWeight: true });
      const result = await ensureRawWeightConfirmedFromDb();
      expect(result).toBe(true);
      expect(db.foods.count).not.toHaveBeenCalled();
    });

    it('若 DB 中已有食材或食譜應自動確認並回傳 true', async () => {
      vi.mocked(db.foods.count).mockResolvedValue(1);
      vi.mocked(db.recipes.count).mockResolvedValue(0);

      const result = await ensureRawWeightConfirmedFromDb();
      expect(result).toBe(true);
      expect(useAppStore.getState().hasConfirmedRawWeight).toBe(true);
      expect(db.daily_diet_logs.count).not.toHaveBeenCalled();
    });

    it('若僅有含進食項目的飲食日誌應自動確認並回傳 true', async () => {
      vi.mocked(db.foods.count).mockResolvedValue(0);
      vi.mocked(db.recipes.count).mockResolvedValue(0);
      vi.mocked(db.daily_diet_logs.count).mockResolvedValue(1);
      vi.mocked(db.daily_diet_logs.toArray).mockResolvedValue([
        {
          id: 'log-1',
          date: '2026-11-27',
          meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
          entries: [
            {
              id: 'e1',
              date: '2026-11-27',
              mealType: 'dinner',
              entryType: 'estimate',
              estimatePresetId: 'balanced',
              quantity: 500,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
          createdAt: 1,
          updatedAt: 1,
        },
      ]);

      const result = await ensureRawWeightConfirmedFromDb();
      expect(result).toBe(true);
      expect(useAppStore.getState().hasConfirmedRawWeight).toBe(true);
    });

    it('全新空白資料庫應回傳 false 且維持未確認', async () => {
      vi.mocked(db.foods.count).mockResolvedValue(0);
      vi.mocked(db.recipes.count).mockResolvedValue(0);
      vi.mocked(db.daily_diet_logs.count).mockResolvedValue(0);

      const result = await ensureRawWeightConfirmedFromDb();
      expect(result).toBe(false);
      expect(useAppStore.getState().hasConfirmedRawWeight).toBe(false);
    });
  });
});
