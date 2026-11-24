import { describe, it, expect } from 'vitest';
import {
  getLocalizedFoodName,
  getLocalizedExerciseName,
} from './defaultLocalization';
import { DEFAULT_EXERCISE_IDS, DEFAULT_EXERCISES } from '@/services/db/defaultExercises';

describe('defaultLocalization', () => {
  it('能正確解析食物名稱，不論語言皆完整保留使用者與權威庫原名', () => {
    const potato = { id: 'some-id', name: '馬鈴薯', isCustom: false };
    expect(getLocalizedFoodName(potato, 'zh-TW')).toBe('馬鈴薯');
    expect(getLocalizedFoodName(potato, 'zh-CN')).toBe('馬鈴薯');
    expect(getLocalizedFoodName(potato, 'en')).toBe('馬鈴薯');

    const customFood = { id: 'custom-id', name: '私房雞胸', isCustom: true };
    expect(getLocalizedFoodName(customFood, 'en')).toBe('私房雞胸');
  });

  it('能為系統預設動作依語系返回對應翻譯（繁中 / 簡中 / 英文）', () => {
    const bench = { id: DEFAULT_EXERCISE_IDS.bench_press, name: '槓鈴臥推', isCustom: false };
    expect(getLocalizedExerciseName(bench, 'zh-TW')).toBe('槓鈴臥推');
    expect(getLocalizedExerciseName(bench, 'zh-CN')).toBe('杠铃卧推');
    expect(getLocalizedExerciseName(bench, 'en')).toBe('Barbell Bench Press');
  });

  it('應完整覆蓋所有預設動作 ID', () => {
    for (const ex of DEFAULT_EXERCISES) {
      expect(getLocalizedExerciseName(ex, 'en')).not.toBe(ex.name);
      expect(getLocalizedExerciseName(ex, 'zh-CN').length).toBeGreaterThan(0);
    }
  });
});
