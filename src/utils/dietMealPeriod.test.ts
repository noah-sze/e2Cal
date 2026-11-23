import { describe, it, expect } from 'vitest';
import { getActiveMealTypeByHour, getDefaultCollapsedMeals } from './dietMealPeriod';

describe('dietMealPeriod', () => {
  describe('getActiveMealTypeByHour', () => {
    it('應正確判定 04:00 ～ 10:59 為早餐', () => {
      expect(getActiveMealTypeByHour(4)).toBe('breakfast');
      expect(getActiveMealTypeByHour(7)).toBe('breakfast');
      expect(getActiveMealTypeByHour(10)).toBe('breakfast');
      expect(getActiveMealTypeByHour(10.99)).toBe('breakfast');
    });

    it('應正確判定 11:00 ～ 15:59 為午餐', () => {
      expect(getActiveMealTypeByHour(11)).toBe('lunch');
      expect(getActiveMealTypeByHour(13)).toBe('lunch');
      expect(getActiveMealTypeByHour(15)).toBe('lunch');
      expect(getActiveMealTypeByHour(15.99)).toBe('lunch');
    });

    it('應正確判定 16:00 ～ 23:59 為晚餐', () => {
      expect(getActiveMealTypeByHour(16)).toBe('dinner');
      expect(getActiveMealTypeByHour(19)).toBe('dinner');
      expect(getActiveMealTypeByHour(23)).toBe('dinner');
      expect(getActiveMealTypeByHour(23.99)).toBe('dinner');
    });

    it('應正確判定 00:00 ～ 03:59 為非主餐時段 (null)', () => {
      expect(getActiveMealTypeByHour(0)).toBeNull();
      expect(getActiveMealTypeByHour(1)).toBeNull();
      expect(getActiveMealTypeByHour(3)).toBeNull();
      expect(getActiveMealTypeByHour(3.99)).toBeNull();
    });

    it('面對異常輸入時應安全返回 null', () => {
      expect(getActiveMealTypeByHour(-1)).toBeNull();
      expect(getActiveMealTypeByHour(24)).toBeNull();
      expect(getActiveMealTypeByHour(25)).toBeNull();
      expect(getActiveMealTypeByHour(NaN)).toBeNull();
      expect(getActiveMealTypeByHour(Infinity)).toBeNull();
    });
  });

  describe('getDefaultCollapsedMeals', () => {
    it('非今日 (isToday = false) 時，所有餐別均應展開 (collapsed = false)', () => {
      const result = getDefaultCollapsedMeals(false, 8);
      expect(result).toEqual({
        breakfast: false,
        lunch: false,
        dinner: false,
        snack: false,
      });
    });

    it('今日早餐時段 (e.g. 08:00)，僅早餐與加餐展開，午餐與晚餐摺疊', () => {
      const result = getDefaultCollapsedMeals(true, 8);
      expect(result).toEqual({
        breakfast: false, // 展開
        lunch: true, // 摺疊
        dinner: true, // 摺疊
        snack: false, // 加餐始終展開
      });
    });

    it('今日午餐時段 (e.g. 12:30)，僅午餐與加餐展開，早餐與晚餐摺疊', () => {
      const result = getDefaultCollapsedMeals(true, 12);
      expect(result).toEqual({
        breakfast: true, // 摺疊
        lunch: false, // 展開
        dinner: true, // 摺疊
        snack: false, // 加餐始終展開
      });
    });

    it('今日晚餐時段 (e.g. 18:00)，僅晚餐與加餐展開，早餐與午餐摺疊', () => {
      const result = getDefaultCollapsedMeals(true, 18);
      expect(result).toEqual({
        breakfast: true, // 摺疊
        lunch: true, // 摺疊
        dinner: false, // 展開
        snack: false, // 加餐始終展開
      });
    });

    it('今日深夜非主餐時段 (e.g. 02:00)，三餐均摺疊，加餐始終展開', () => {
      const result = getDefaultCollapsedMeals(true, 2);
      expect(result).toEqual({
        breakfast: true, // 摺疊
        lunch: true, // 摺疊
        dinner: true, // 摺疊
        snack: false, // 加餐始終展開
      });
    });
  });
});
