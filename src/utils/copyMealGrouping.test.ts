import { describe, it, expect } from 'vitest';
import {
  groupCopyableMealEntries,
  countSelectedCopyableEntries,
  type GroupableMealEntry,
} from './copyMealGrouping';

describe('copyMealGrouping', () => {
  it('應將相同 bundleId 的食譜食材合併為單一列，並優先以毛重累計顯示總重量', () => {
    const items: GroupableMealEntry[] = [
      { id: '1', quantity: 100, calories: 186, unit: 'g' },
      { id: '2', bundleId: 'recipe-1', bundleTitle: '測試食譜', quantity: 100, calories: 388, unit: 'g' },
      { id: '3', bundleId: 'recipe-1', bundleTitle: '測試食譜', quantity: 74, grossQuantity: 100, calories: 108, unit: 'g' },
    ];

    const grouped = groupCopyableMealEntries(items, '食譜');
    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({ kind: 'single', index: 0 });
    expect(grouped[1]).toMatchObject({
      kind: 'bundle',
      bundleId: 'recipe-1',
      bundleTitle: '測試食譜',
      totalCalories: 496,
      totalDisplayWeight: 200,
      unit: 'g',
    });
    if (grouped[1].kind === 'bundle') {
      expect(grouped[1].logs).toHaveLength(2);
    }
  });

  it('應正確計算合併後的已選條目數', () => {
    const items: GroupableMealEntry[] = [
      { id: '1', quantity: 100, calories: 186 },
      { id: '2', bundleId: 'r1', bundleTitle: 'R1', quantity: 50, calories: 100 },
      { id: '3', bundleId: 'r1', bundleTitle: 'R1', quantity: 50, calories: 100 },
    ];
    const grouped = groupCopyableMealEntries(items);

    expect(countSelectedCopyableEntries(grouped, new Set(['1', '2', '3']))).toBe(2);
    expect(countSelectedCopyableEntries(grouped, new Set(['2', '3']))).toBe(1);
    expect(countSelectedCopyableEntries(grouped, new Set())).toBe(0);
  });
});
