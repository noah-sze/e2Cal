import { describe, it, expect } from 'vitest';
import {
  sanitizeFoodItem,
  sanitizeRecipe,
  sanitizeFoodLog,
  sanitizeDailyDietLog,
  sanitizeWorkoutLog,
  sanitizeWorkoutRoutine,
  sanitizeUserBaseInfo,
} from './syncSanitizers';
import {
  DEFAULT_FOOD_IDS,
  DEFAULT_RECIPE_IDS,
  PRIMARY_USER_ID,
} from '../db/defaultData';

describe('syncSanitizers (同步與持久化邊界純粹度清洗)', () => {
  describe('sanitizeRecipe', () => {
    it('徹底剔除食材中的 foodName 快照與菜餚根級別的 description', () => {
      const dirtyRecipe = {
        id: DEFAULT_RECIPE_IDS.chicken_rice_box,
        name: '經典低脂雞胸便當',
        description: '標準乾淨減脂主食，可選配微量烹調油',
        ingredients: [
          {
            foodId: DEFAULT_FOOD_IDS.chicken_breast,
            foodName: '雞胸肉',
            quantity: 150,
            unit: 'g',
            isOptional: false,
          },
          {
            foodId: DEFAULT_FOOD_IDS.cooking_oil,
            foodName: '食用植物油',
            quantity: 5,
            unit: 'g',
            isOptional: true,
          },
        ],
        isCustom: false,
        isArchived: false,
        createdAt: 1793076065780,
        updatedAt: 1793076065780,
      };

      const cleaned = sanitizeRecipe(dirtyRecipe);

      expect(cleaned).toEqual({
        id: DEFAULT_RECIPE_IDS.chicken_rice_box,
        name: '經典低脂雞胸便當',
        ingredients: [
          { foodId: DEFAULT_FOOD_IDS.chicken_breast, quantity: 150, unit: 'g', isOptional: false },
          { foodId: DEFAULT_FOOD_IDS.cooking_oil, quantity: 5, unit: 'g', isOptional: true },
        ],
        isCustom: false,
        isArchived: false,
        createdAt: 1793076065780,
        updatedAt: 1793076065780,
      });

      expect((cleaned as any).description).toBeUndefined();
      expect((cleaned.ingredients[0] as any).foodName).toBeUndefined();
      expect((cleaned.ingredients[1] as any).foodName).toBeUndefined();
    });

    it('保留已是 UUID 的自訂菜餚 ID 與食材 ID', () => {
      const customRecipe = {
        id: '99999999-9999-4999-8999-999999999999',
        name: '自訂健康餐',
        ingredients: [
          {
            foodId: '88888888-8888-4888-8888-888888888888',
            quantity: 200,
            unit: 'g',
          },
        ],
        isCustom: true,
        createdAt: 2000,
        updatedAt: 2000,
      };

      const cleaned = sanitizeRecipe(customRecipe);
      expect(cleaned.id).toBe('99999999-9999-4999-8999-999999999999');
      expect(cleaned.ingredients[0].foodId).toBe('88888888-8888-4888-8888-888888888888');
    });
  });

  describe('sanitizeFoodLog', () => {
    it('徹底剔除食物名稱與靜態營養素快照', () => {
      const dirtyLog = {
        id: 'log-1',
        date: '2026-11-06',
        mealType: 'breakfast',
        foodId: DEFAULT_FOOD_IDS.chicken_breast,
        foodName: '雞胸肉',
        calories: 165,
        protein: 34.5,
        carbs: 0,
        fat: 1.8,
        quantity: 150,
        unit: 'g',
        notes: '[早餐]',
        createdAt: 1000,
        updatedAt: 1000,
      };

      const cleaned = sanitizeFoodLog(dirtyLog);

      expect(cleaned).toEqual({
        id: 'log-1',
        date: '2026-11-06',
        mealType: 'breakfast',
        entryType: 'item',
        foodId: DEFAULT_FOOD_IDS.chicken_breast,
        quantity: 150,
        unit: 'g',
        createdAt: 1000,
        updatedAt: 1000,
      });

      expect((cleaned as any).foodName).toBeUndefined();
      expect((cleaned as any).calories).toBeUndefined();
      expect((cleaned as any).protein).toBeUndefined();
      expect((cleaned as any).carbs).toBeUndefined();
      expect((cleaned as any).fat).toBeUndefined();
      expect((cleaned as any).notes).toBeUndefined();
    });

    it('完整支援系統分類條目原型 (System Entry Archetype) 並徹底移除虛構的 quantity 與 unit', () => {
      const placeholderLog = {
        id: 'p-1',
        date: '2026-11-10',
        mealType: 'lunch',
        scenario: 'hotpot',
        customTitle: '海底撈',
        calories: 850,
        carbs: 60,
        protein: 45,
        fat: 35,
        isPlaceholder: true,
        quantity: 1,
        unit: '份',
        createdAt: 2000,
        updatedAt: 2000,
      };

      const cleaned = sanitizeFoodLog(placeholderLog);
      expect(cleaned).toEqual({
        id: 'p-1',
        date: '2026-11-10',
        mealType: 'lunch',
        entryType: 'estimate',
        scenario: 'hotpot',
        customTitle: '海底撈',
        calories: 850,
        carbs: 60,
        protein: 45,
        fat: 35,
        isPlaceholder: true,
        createdAt: 2000,
        updatedAt: 2000,
      });
      expect(cleaned.quantity).toBeUndefined();
      expect(cleaned.unit).toBeUndefined();

      const asPlannedLog = {
        id: 'plan-1',
        date: '2026-11-10',
        mealType: 'breakfast',
        customTitle: '媽媽煮的早餐',
        calories: 500,
        carbs: 50,
        protein: 38,
        fat: 17,
        isAsPlanned: true,
        quantity: 1,
        unit: '份',
        createdAt: 2000,
        updatedAt: 2000,
      };

      const cleanedPlanned = sanitizeFoodLog(asPlannedLog);
      expect(cleanedPlanned).toEqual({
        id: 'plan-1',
        date: '2026-11-10',
        mealType: 'breakfast',
        entryType: 'as_planned',
        customTitle: '媽媽煮的早餐',
        calories: 500,
        carbs: 50,
        protein: 38,
        fat: 17,
        isAsPlanned: true,
        createdAt: 2000,
        updatedAt: 2000,
      });
      expect(cleanedPlanned.quantity).toBeUndefined();
      expect(cleanedPlanned.unit).toBeUndefined();
    });
  });

  describe('sanitizeWorkoutLog', () => {
    it('徹底剔除動作組內的 exerciseName、category 與 notes，以及日誌頂層的 title 快照', () => {
      const dirtyLog = {
        id: 'wlog-1',
        date: '2026-11-06',
        title: '胸部訓練',
        notes: '[課表日]',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: '槓鈴臥推',
            category: 'free_weight',
            notes: '熱身組完成',
            sets: [
              { id: 's1', setNumber: 1, weight: 100, reps: 5, isCompleted: true },
            ],
          },
        ],
        createdAt: 1000,
        updatedAt: 1000,
      };

      const cleaned = sanitizeWorkoutLog(dirtyLog);

      expect(cleaned).toEqual({
        id: 'wlog-1',
        date: '2026-11-06',
        exercises: [
          {
            exerciseId: 'ex_bench',
            sets: [
              { id: 's1', setNumber: 1, weight: 100, reps: 5, isCompleted: true },
            ],
          },
        ],
        createdAt: 1000,
        updatedAt: 1000,
      });

      expect((cleaned as any).title).toBeUndefined();
      expect((cleaned as any).notes).toBeUndefined();
      expect((cleaned.exercises[0] as any).exerciseName).toBeUndefined();
      expect((cleaned.exercises[0] as any).category).toBeUndefined();
      expect((cleaned.exercises[0] as any).notes).toBeUndefined();
    });
  });

  describe('sanitizeUserBaseInfo', () => {
    it('徹底剔除 weightUnit 與 activityLevel', () => {
      const dirtyInfo = {
        id: PRIMARY_USER_ID,
        name: 'Jason',
        gender: 'male',
        birthDate: '1999-01',
        heightCm: 175,
        weightUnit: 'kg',
        activityLevel: 1.55,
        createdAt: 1000,
        updatedAt: 1000,
      };

      const cleaned = sanitizeUserBaseInfo(dirtyInfo);

      expect(cleaned).toEqual({
        id: PRIMARY_USER_ID,
        name: 'Jason',
        gender: 'male',
        birthDate: '1999-01',
        heightCm: 175,
        createdAt: 1000,
        updatedAt: 1000,
      });

      expect((cleaned as any).weightUnit).toBeUndefined();
      expect((cleaned as any).activityLevel).toBeUndefined();
    });
  });

  describe('sanitizeDailyDietLog', () => {
    it('規範化自包含日誌頭部 meta 與內部 entries', () => {
      const dirtyDailyLog = {
        id: 'daily_1',
        date: '2026-11-06',
        meta: {
          activityLevel: 1.725,
          macroSplit: { carbs: 50, protein: 30, fat: 20 },
          planName: '高碳訓練日',
        },
        entries: [
          {
            id: 'e1',
            mealType: 'breakfast',
            foodId: DEFAULT_FOOD_IDS.chicken_breast,
            foodName: '雞胸肉',
            bundleId: DEFAULT_RECIPE_IDS.chicken_rice_box,
            bundleName: '經典低脂雞胸便當',
            quantity: 150,
            unit: 'g',
            calories: 165,
            notes: '[早餐]',
            createdAt: 1000,
            updatedAt: 1000,
          },
        ],
        createdAt: 1000,
        updatedAt: 1000,
      };

      const cleaned = sanitizeDailyDietLog(dirtyDailyLog);

      expect(cleaned.id).toBe('daily_1');
      expect(cleaned.date).toBe('2026-11-06');
      expect(cleaned.meta).toEqual({
        activityLevel: 1.725,
        macroSplit: { carbs: 50, protein: 30, fat: 20 },
      });
      expect(cleaned.entries.length).toBe(1);
      expect(cleaned.entries[0]).toEqual({
        id: 'e1',
        date: '',
        mealType: 'breakfast',
        entryType: 'item',
        foodId: DEFAULT_FOOD_IDS.chicken_breast,
        bundleId: DEFAULT_RECIPE_IDS.chicken_rice_box,
        quantity: 150,
        unit: 'g',
        createdAt: 1000,
        updatedAt: 1000,
      });
      expect((cleaned.entries[0] as any).foodName).toBeUndefined();
      expect((cleaned.entries[0] as any).calories).toBeUndefined();
      expect((cleaned.entries[0] as any).notes).toBeUndefined();
    });
  });

  describe('sanitizeWorkoutRoutine', () => {
    it('徹底剔除動作組內的 defaultSets 等組數設定，僅保留 exerciseId 純關聯', () => {
      const dirtyRoutine = {
        id: 'routine_1',
        name: '推力訓練',
        notes: '胸三頭',
        exercises: [
          { exerciseId: 'barbell_bench_press', defaultSets: 4, notes: '正式組' },
          { exerciseId: 'incline_dumbbell_press', defaultSets: 3 },
        ],
        isCustom: true,
        createdAt: 1000,
        updatedAt: 1000,
      };

      const cleaned = sanitizeWorkoutRoutine(dirtyRoutine);

      expect(cleaned.exercises).toEqual([
        { exerciseId: 'barbell_bench_press' },
        { exerciseId: 'incline_dumbbell_press' },
      ]);
      expect('defaultSets' in cleaned.exercises[0]).toBe(false);
      expect('notes' in cleaned.exercises[0]).toBe(false);
    });
  });

  describe('sanitizeFoodItem', () => {
    it('將殘留英制 oz / fl oz 轉為公制 g / ml，並徹底清除 rawNutrition 與 labelBasis* 記憶欄位', () => {
      const dirtyFood = {
        id: 'food_custom_1',
        name: '燕麥奶',
        category: 'beverage',
        servingSize: 8,
        servingUnit: 'fl oz',
        calories: 120,
        carbs: 16,
        protein: 3,
        fat: 5,
        labelBasisSize: 100,
        labelBasisUnit: 'ml',
        rawNutrition: { calories: 1000, carbs: 16, protein: 3, fat: 5 },
        isCustom: true,
        createdAt: 1000,
        updatedAt: 2000,
      };

      const cleaned = sanitizeFoodItem(dirtyFood);

      expect(cleaned.servingUnit).toBe('ml');
      expect(cleaned.servingSize).toBe(236.59);
      expect(cleaned.calories).toBe(120);
      expect('rawNutrition' in cleaned).toBe(false);
      expect('labelBasisSize' in cleaned).toBe(false);
      expect('labelBasisUnit' in cleaned).toBe(false);
    });

    it('應完整保留自訂食材次級營養素（sugar, fiber, saturatedFat, transFat, sodium）', () => {
      const foodWithSub = {
        id: 'food_custom_sub',
        name: '特製燕麥棒',
        category: 'processed',
        servingSize: 50,
        servingUnit: 'g',
        calories: 200,
        carbs: 30,
        protein: 10,
        fat: 5,
        sugar: 12.5,
        fiber: 4.2,
        saturatedFat: 1.1,
        transFat: 0,
        sodium: 80,
        isCustom: true,
      };

      const cleaned = sanitizeFoodItem(foodWithSub);
      expect(cleaned.sugar).toBe(12.5);
      expect(cleaned.fiber).toBe(4.2);
      expect(cleaned.saturatedFat).toBe(1.1);
      expect(cleaned.transFat).toBe(0);
      expect(cleaned.sodium).toBe(80);
    });

    it('當系統預設食材 (!isCustom) 次級營養素缺失時，應能自動自愈從預設庫補齊', () => {
      // 假設從遠端舊版同步回來的雞蛋（缺少 sugar, saturatedFat 等）
      const eggFromOldSync = {
        id: 'f57cb780-a0b1-4d41-bb80-8750fd9361cc', // whole_egg
        name: '雞蛋',
        category: 'natural',
        servingSize: 50,
        servingUnit: 'g',
        calories: 72,
        carbs: 0.4,
        protein: 6.3,
        fat: 4.8,
        fiber: 0,
        // sugar 缺失
        isCustom: false,
      };

      const cleaned = sanitizeFoodItem(eggFromOldSync);
      expect(cleaned.sugar).toBe(0.2); // 應自動補齊雞蛋的 0.2g sugar
      expect(cleaned.saturatedFat).toBe(1.6);
      expect(cleaned.transFat).toBe(0);
      expect(cleaned.sodium).toBe(71);
    });
  });
});
