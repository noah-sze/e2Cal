/**
 * 飲食餐別時段判定與預設摺疊純函數庫 (Diet Meal Period & Auto-Collapse Engine)
 * 遵循 Precision Metric Testing 準則：純函數無副作用，防護跨夜、無效時間與各邊界值
 *
 * 核心規則：
 * 1. 04:00 ～ 10:59 (4 <= hour <= 10): 早餐 (breakfast)
 * 2. 11:00 ～ 15:59 (11 <= hour <= 15): 午餐 (lunch)
 * 3. 16:00 ～ 23:59 (16 <= hour <= 23): 晚餐 (dinner)
 * 4. 00:00 ～ 03:59 (0 <= hour <= 3): 深夜非主餐時段 (null，所有主餐均摺疊)
 * 5. 加餐 (snack): 始終展開 (collapsed: false)
 * 6. 歷史/非當天日期: 預設全展開供使用者查閱
 */

import type { MealType } from '@/types';

/**
 * 根據給定小時數（0～23）判定當前處於哪一個主餐時段
 * 若不在三餐常規時段（例如 00:00～03:59），返回 null
 */
export function getActiveMealTypeByHour(hour: number): MealType | null {
  if (typeof hour !== 'number' || isNaN(hour) || !isFinite(hour)) {
    return null;
  }
  const h = Math.floor(hour);
  if (h >= 4 && h < 11) {
    return 'breakfast';
  }
  if (h >= 11 && h < 16) {
    return 'lunch';
  }
  if (h >= 16 && h < 24) {
    return 'dinner';
  }
  return null;
}

/**
 * 取得當前日期的餐別預設摺疊狀態字典
 * @param isToday 是否為今日
 * @param currentHour 當前小時（預設 new Date().getHours()）
 */
export function getDefaultCollapsedMeals(
  isToday: boolean,
  currentHour: number = new Date().getHours()
): Record<MealType, boolean> {
  // 歷史日期或非今日：全部展開，方便查閱完整記錄
  if (!isToday) {
    return {
      breakfast: false,
      lunch: false,
      dinner: false,
      snack: false,
    };
  }

  const activeMeal = getActiveMealTypeByHour(currentHour);

  return {
    breakfast: activeMeal !== 'breakfast',
    lunch: activeMeal !== 'lunch',
    dinner: activeMeal !== 'dinner',
    snack: false, // 加餐始終展開
  };
}
