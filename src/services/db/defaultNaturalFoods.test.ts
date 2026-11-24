import { describe, it, expect } from 'vitest';
import { DEFAULT_NATURAL_FOODS, NATURAL_FOOD_IDS } from './defaultNaturalFoods';

describe('DEFAULT_NATURAL_FOODS 精密客觀測量儀審計', () => {
  it('必須包含全部 412 項雙權威驗證的天然原型食材', () => {
    expect(DEFAULT_NATURAL_FOODS.length).toBe(412);
    expect(Object.keys(NATURAL_FOOD_IDS).length).toBe(412);
  });

  it('每一項食材 ID 均需符合確定性 UUID 格式且無重複', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const seenIds = new Set<string>();

    for (const food of DEFAULT_NATURAL_FOODS) {
      expect(food.id).toMatch(uuidRegex);
      expect(seenIds.has(food.id)).toBe(false);
      seenIds.add(food.id);
    }
  });

  it('所有天然食材 100% 嚴格以未烹調生重為唯一常數，嚴禁包含「生」前綴、「乾重」後綴、純麵條泛稱與熟重副本', () => {
    const forbiddenPrefixes = ['水煮', '香煎', '清蒸', '油炸', '生白米', '生糙米', '生義大利麵', '生核桃', '生杏仁', '生鮮', '純麵條', '純米粉'];
    const forbiddenCookedVariants = ['糙米飯', '熟白米', '熟義大利麵', '水煮蛋', '煎蛋'];
    const forbiddenSuffixes = ['乾重', '生重'];

    for (const food of DEFAULT_NATURAL_FOODS) {
      for (const prefix of forbiddenPrefixes) {
        expect(food.name.startsWith(prefix)).toBe(false);
      }
      for (const suffix of forbiddenSuffixes) {
        expect(food.name.endsWith(suffix)).toBe(false);
      }
      for (const variant of forbiddenCookedVariants) {
        expect(food.name.includes(variant)).toBe(false);
      }
    }
  });

  it('所有天然食材必須通過生物物理 Atwater 能量平衡公式校驗 (|calories - (4C + 4P + 9F)| <= 容許值)', () => {
    for (const food of DEFAULT_NATURAL_FOODS) {
      const theoreticalKcal = 4.0 * food.carbs + 4.0 * food.protein + 9.0 * food.fat;
      const diff = Math.abs(food.calories - theoreticalKcal);
      const maxAllowed = Math.max(15.0, theoreticalKcal * 0.12);
      expect(diff).toBeLessThanOrEqual(maxAllowed);
    }
  });

  it('所有食材計量單位均為公制 g 或 ml，且 servingSize 為 100', () => {
    for (const food of DEFAULT_NATURAL_FOODS) {
      expect(['g', 'ml']).toContain(food.servingUnit);
      expect(food.servingSize).toBe(100);
      expect(food.calories).toBeGreaterThan(0);
      expect(food.protein).toBeGreaterThanOrEqual(0);
      expect(food.carbs).toBeGreaterThanOrEqual(0);
      expect(food.fat).toBeGreaterThanOrEqual(0);
    }
  });

  it('所有天然食材必須 100% 完整定義 5 項次級營養素且符合物理守恆與上限防護', () => {
    for (const food of DEFAULT_NATURAL_FOODS) {
      // 確保 5 項次級營養素全部顯式定義
      expect(food.sugar).toBeDefined();
      expect(food.fiber).toBeDefined();
      expect(food.saturatedFat).toBeDefined();
      expect(food.transFat).toBeDefined();
      expect(food.sodium).toBeDefined();

      // 糖分
      expect(food.sugar).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(food.sugar)).toBe(false);
      expect(food.sugar!).toBeLessThanOrEqual(food.carbs + 0.05);

      // 膳食纖維
      expect(food.fiber).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(food.fiber)).toBe(false);

      // 飽和脂肪與反式脂肪
      expect(food.saturatedFat).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(food.saturatedFat)).toBe(false);
      expect(food.transFat).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(food.transFat)).toBe(false);
      expect(food.saturatedFat! + food.transFat!).toBeLessThanOrEqual(food.fat + 0.05);

      // 鈉
      expect(food.sodium).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(food.sodium)).toBe(false);
    }
  });

  it('所有天然食材必須包含權威資料庫溯源憑證 (dataSource) 與微量元素儲備 (micros)', () => {
    const validAuthorities = ['USDA', 'CFCT', 'TFDA', 'MEXT'];
    for (const food of DEFAULT_NATURAL_FOODS) {
      expect(food.dataSource).toBeDefined();
      expect(validAuthorities).toContain(food.dataSource!.authority);
      expect(typeof food.dataSource!.sourceId).toBe('string');
      expect(food.dataSource!.sourceId.length).toBeGreaterThan(0);

      // 微量元素儲備
      expect(food.micros).toBeDefined();
      if (food.micros) {
        for (const val of Object.values(food.micros)) {
          expect(typeof val).toBe('number');
          expect(Number.isNaN(val)).toBe(false);
          expect(val).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('解剖學物理損耗率審計：帶骨/帶殼部位必須具備客觀損耗率 (refuseRate > 0)', () => {
    // 凡包含明確帶骨/帶殼解剖部位且未標明「去骨/去殼/純肉/仁」者，物理上必定存在損耗殘渣
    const boneOrShellKeywords = ['翅', '小排', '排骨', '文蛤', '帶殼', '鳳爪', '雞爪', '鴨掌', '雞腿'];
    for (const food of DEFAULT_NATURAL_FOODS) {
      if (food.name.includes('雞腿菇')) continue;
      const isBoneOrShell = boneOrShellKeywords.some((kw) => food.name.includes(kw));
      const isExplicitlyDeboned =
        food.name.includes('去骨') ||
        food.name.includes('去殼') ||
        food.name.includes('純肉') ||
        food.name.includes('肉絲') ||
        food.name.includes('絞肉') ||
        food.name.includes('腿肉') ||
        (food.dataSource?.sourceName?.toLowerCase().includes('boneless') ?? false) ||
        (food.dataSource?.sourceName?.includes('無骨') ?? false);

      if (isBoneOrShell && !isExplicitlyDeboned) {
        expect(
          food.refuseRate,
          `食材「${food.name}」為帶骨/帶殼部位，refuseRate 必須大於 0`
        ).toBeGreaterThan(0);
        expect(
          food.edibleRate,
          `食材「${food.name}」標準可食率必須小於 1.0`
        ).toBeLessThan(1.0);
      }
    }
  });

  it('解剖部位語意對齊審計：部位食材溯源品名嚴禁出現全身泛稱或跨部位混充', () => {
    // 檢查「翅」字食材不得映射到無 wing 的全身泛肉
    for (const food of DEFAULT_NATURAL_FOODS) {
      if (food.name.includes('翅') && food.dataSource?.authority === 'USDA') {
        const sourceLower = (food.dataSource.sourceName || '').toLowerCase();
        expect(
          sourceLower.includes('wing'),
          `食材「${food.name}」來源品名「${food.dataSource.sourceName}」必須包含 wing，嚴禁以全身泛肉混充`
        ).toBe(true);
      }
      // 檢查「雞腿」不得映射到 breast (雞胸)
      if (food.name.includes('雞腿') && !food.name.includes('菇')) {
        const sourceLower = (food.dataSource?.sourceName || '').toLowerCase();
        expect(
          sourceLower.includes('breast'),
          `食材「${food.name}」來源品名「${food.dataSource?.sourceName}」嚴禁混充為雞胸 (breast)`
        ).toBe(false);
      }
    }
  });

  it('水果皮核與瓜類解剖損耗率審計：帶皮/帶核水果必須具備客觀損耗率 (refuseRate > 0)', () => {
    const peelPitFruitKeywords = [
      '香蕉', '蘋果', '橘子', '柳橙', '西瓜', '鳳梨', '木瓜', '芒果', '荔枝', '龍眼',
      '葡萄柚', '酪梨', '奇異果', '火龍果', '枇杷', '水蜜桃', '桃', '李', '櫻桃', '檸檬',
      '百香果', '甜柿', '柿', '哈密瓜', '甜瓜', '冬棗', '沃柑', '沙田柚', '紅心柚'
    ];
    for (const food of DEFAULT_NATURAL_FOODS) {
      // 堅果 (如核桃、胡桃) 非水果桃類，排除
      const isNut = food.name.includes('胡桃') || food.name.includes('核桃');
      const isPeelPitFruit = !isNut && peelPitFruitKeywords.some((kw) => food.name.includes(kw));
      // 若標明為果汁/乾貨/仁/純肉則除外
      const isLiquidOrKernel =
        food.name.includes('汁') ||
        food.name.includes('水') ||
        food.name.includes('乾') ||
        food.name.includes('仁');

      if (isPeelPitFruit && !isLiquidOrKernel) {
        expect(
          food.refuseRate,
          `水果「${food.name}」具備果皮或果核，refuseRate 必須大於 0`
        ).toBeGreaterThan(0);
        expect(
          food.edibleRate,
          `水果「${food.name}」標準可食率必須小於 1.0`
        ).toBeLessThan(1.0);
      }
    }
  });

  it('鮮果蔬菜與原型食材語意嚴格性審計：嚴禁鮮果/蔬菜映射至加工果汁、檸檬水、番茄醬料或跨界品項', () => {
    for (const food of DEFAULT_NATURAL_FOODS) {
      const sName = food.dataSource?.sourceName || '';
      const sLower = sName.toLowerCase();

      // 鮮果蔬菜不可映射到果汁/cocktail（除非食物名稱本身是汁/水）
      if (!food.name.includes('汁') && !food.name.includes('水') && !food.name.includes('茶')) {
        expect(
          sLower.includes('juice') || sName.includes('汁') || sLower.includes('cocktail'),
          `食材「${food.name}」不得映射至加工汁飲料或雞尾酒飲料「${sName}」`
        ).toBe(false);
      }

      // 不可映射到 lemonade
      if (!food.name.includes('檸檬水')) {
        expect(
          sLower.includes('lemonade'),
          `食材「${food.name}」不得映射至檸檬水「${sName}」`
        ).toBe(false);
      }

      // 不可映射到 sauce（醬）
      if (!food.name.includes('醬')) {
        expect(
          sLower.includes('sauce'),
          `食材「${food.name}」不得映射至醬料調味品「${sName}」`
        ).toBe(false);
      }

      // 不可映射到 babyfood
      expect(
        sLower.includes('babyfood'),
        `食材「${food.name}」不得映射至嬰兒食品「${sName}」`
      ).toBe(false);

      // 蝦類嚴禁映射至魚類
      if (
        food.name.includes('蝦') &&
        !food.name.includes('皮皮蝦') &&
        !food.name.includes('龍蝦') &&
        food.dataSource?.authority === 'USDA'
      ) {
        expect(
          sLower.includes('fish'),
          `蝦類食材「${food.name}」不得映射至魚類「${sName}」`
        ).toBe(false);
      }
    }
  });
});
