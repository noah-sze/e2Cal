import { roundTo } from '@/utils/unitMath';

export interface GroupableMealEntry {
  id: string;
  bundleId?: string;
  bundleTitle?: string;
  quantity?: number;
  grossQuantity?: number;
  unit?: string;
  calories?: number;
}

export type CopyableDisplayEntry<T extends GroupableMealEntry> =
  | {
      kind: 'bundle';
      bundleId: string;
      bundleTitle: string;
      logs: T[];
      totalCalories: number;
      totalDisplayWeight: number;
      unit: string;
    }
  | {
      kind: 'single';
      item: T;
      index: number;
    };

/**
 * 將同一次複製餐點清單中相同 `bundleId` 的食譜食材合併為單一列，
 * 同時保留原始條目陣列索引供單品編輯回寫。
 */
export function groupCopyableMealEntries<T extends GroupableMealEntry>(
  items: T[],
  fallbackRecipeTitle = '食譜'
): CopyableDisplayEntry<T>[] {
  const entries: CopyableDisplayEntry<T>[] = [];
  const bundleMap = new Map<string, Extract<CopyableDisplayEntry<T>, { kind: 'bundle' }>>();

  items.forEach((item, index) => {
    if (item.bundleId) {
      let group = bundleMap.get(item.bundleId);
      if (!group) {
        group = {
          kind: 'bundle',
          bundleId: item.bundleId,
          bundleTitle: item.bundleTitle || fallbackRecipeTitle,
          logs: [],
          totalCalories: 0,
          totalDisplayWeight: 0,
          unit: item.unit || 'g',
        };
        bundleMap.set(item.bundleId, group);
        entries.push(group);
      }
      group.logs.push(item);
      group.totalCalories += item.calories || 0;
      const displayQty =
        typeof item.grossQuantity === 'number' && item.grossQuantity > 0
          ? item.grossQuantity
          : item.quantity || 0;
      group.totalDisplayWeight = roundTo(group.totalDisplayWeight + displayQty, 2);
    } else {
      entries.push({ kind: 'single', item, index });
    }
  });

  return entries;
}

/**
 * 計算已勾選的顯示條目數量（合併後的食譜計為 1 項）
 */
export function countSelectedCopyableEntries<T extends GroupableMealEntry>(
  displayEntries: CopyableDisplayEntry<T>[],
  selectedIds: Set<string>
): number {
  return displayEntries.filter((entry) =>
    entry.kind === 'bundle'
      ? entry.logs.some((l) => selectedIds.has(l.id))
      : selectedIds.has(entry.item.id)
  ).length;
}
