/**
 * 次級營養素與主級營養素聯動純數學計算工具 (方案 1 + A1)
 * - 碳水化合物 (carbs) >= 糖 (sugar) + 膳食纖維 (fiber)
 * - 脂肪 (fat) >= 飽和脂肪 (saturatedFat) + 反式脂肪 (transFat)
 */

function sanitizeNonNegative(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value;
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 計算兩個次級營養素之非負總和（保留最多 2 位小數，消除浮點精度誤差）
 */
export function sumSubNutrients(
  subA: number | null | undefined,
  subB: number | null | undefined
): number {
  return roundTo2(sanitizeNonNegative(subA) + sanitizeNonNegative(subB));
}

/**
 * 編輯次級營養素時，計算保底抬升後的主級營養素數值（Auto-Floor）：
 * - 若同組次級總和 > 0 且主級為空或小於次級總和，自動抬升至次級總和；
 * - 若主級原本已 >= 次級總和，則維持原值不變。
 */
export function syncParentWithSubNutrients(
  parentVal: number | null | undefined,
  subA: number | null | undefined,
  subB: number | null | undefined
): number | null {
  const subSum = sumSubNutrients(subA, subB);
  const hasParent = typeof parentVal === 'number' && Number.isFinite(parentVal);
  const safeParent = hasParent ? roundTo2(Math.max(0, parentVal)) : null;

  if (subSum <= 0) {
    return safeParent;
  }
  if (safeParent === null || safeParent < subSum) {
    return subSum;
  }
  return safeParent;
}

/**
 * 編輯主級營養素時（A1 下限夾緊規則）：
 * - 若同組次級總和 > 0 且輸入之主級數值小於次級總和，強制夾緊為次級總和；
 * - 否則回傳正規化後的非負數值。
 */
export function clampParentToSubNutrients(
  nextParentVal: number | null | undefined,
  subA: number | null | undefined,
  subB: number | null | undefined
): number | null {
  return syncParentWithSubNutrients(nextParentVal, subA, subB);
}
