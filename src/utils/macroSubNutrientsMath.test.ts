import { describe, it, expect } from 'vitest';
import {
  sumSubNutrients,
  syncParentWithSubNutrients,
  clampParentToSubNutrients,
} from './macroSubNutrientsMath';

describe('macroSubNutrientsMath', () => {
  describe('sumSubNutrients', () => {
    it('正常相加並消除浮點誤差', () => {
      expect(sumSubNutrients(0.1, 0.2)).toBe(0.3);
      expect(sumSubNutrients(5.45, 2.55)).toBe(8);
    });

    it('處理 null、undefined、0、負數與 NaN', () => {
      expect(sumSubNutrients(null, undefined)).toBe(0);
      expect(sumSubNutrients(-5, 8)).toBe(8);
      expect(sumSubNutrients(Number.NaN, 3.5)).toBe(3.5);
      expect(sumSubNutrients(0, 0)).toBe(0);
    });
  });

  describe('syncParentWithSubNutrients', () => {
    it('當主級為 null 或 0，輸入次級時自動抬升主級', () => {
      expect(syncParentWithSubNutrients(null, 0, 8)).toBe(8);
      expect(syncParentWithSubNutrients(0, 5, 3)).toBe(8);
    });

    it('當主級小於次級總和時，自動抬升至次級總和', () => {
      expect(syncParentWithSubNutrients(5, 4, 6)).toBe(10);
    });

    it('當主級原本大於等於次級總和時，維持原主級數值', () => {
      expect(syncParentWithSubNutrients(25, 5, 8)).toBe(25);
      expect(syncParentWithSubNutrients(8, 5, 3)).toBe(8);
    });

    it('當次級皆為 0 或 null 時，維持原本主級狀態', () => {
      expect(syncParentWithSubNutrients(null, null, 0)).toBeNull();
      expect(syncParentWithSubNutrients(0, 0, 0)).toBe(0);
      expect(syncParentWithSubNutrients(12, 0, null)).toBe(12);
    });

    it('負數與 NaN 輸入會被安全正規化為 0 或 null', () => {
      expect(syncParentWithSubNutrients(-10, 0, 0)).toBe(0);
      expect(syncParentWithSubNutrients(Number.NaN, 2, 3)).toBe(5);
    });
  });

  describe('clampParentToSubNutrients (A1 下限夾緊)', () => {
    it('輸入主級小於次級總和時，下限夾緊為次級總和', () => {
      expect(clampParentToSubNutrients(0, 0, 8)).toBe(8);
      expect(clampParentToSubNutrients(5, 3, 6)).toBe(9);
      expect(clampParentToSubNutrients(null, 2, 4)).toBe(6);
    });

    it('輸入主級大於等於次級總和時，保留輸入數值', () => {
      expect(clampParentToSubNutrients(20, 3, 6)).toBe(20);
      expect(clampParentToSubNutrients(9, 3, 6)).toBe(9);
    });

    it('沒有次級數值時，允許主級設為 0 或 null', () => {
      expect(clampParentToSubNutrients(0, 0, 0)).toBe(0);
      expect(clampParentToSubNutrients(null, null, null)).toBeNull();
    });
  });
});
