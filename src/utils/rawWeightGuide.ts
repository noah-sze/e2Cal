import { db } from '@/services/db/db';
import { useAppStore } from '@/store/useAppStore';
import type { DailyDietLog } from '@/types';

export interface DietActivitySnapshot {
  foodsCount?: number;
  recipesCount?: number;
  dailyDietLogs?: Array<Pick<DailyDietLog, 'entries'>>;
}

/**
 * 判斷記憶體快照或匯入資料中是否已存在實際飲食使用痕跡
 * （包含任一食材、食譜，或含進食項目的飲食日誌）
 */
export function hasDietActivityInSnapshot(snapshot: DietActivitySnapshot): boolean {
  if ((snapshot.foodsCount ?? 0) > 0) return true;
  if ((snapshot.recipesCount ?? 0) > 0) return true;
  if (
    snapshot.dailyDietLogs?.some(
      (log) => Array.isArray(log.entries) && log.entries.length > 0
    )
  ) {
    return true;
  }
  return false;
}

/**
 * 若目前尚未標記確認生重，且傳入資料已含飲食使用痕跡，則自動標記為已確認
 */
export function confirmRawWeightIfHasDietActivity(
  snapshot: DietActivitySnapshot
): boolean {
  const state = useAppStore.getState();
  if (state.hasConfirmedRawWeight) return true;
  if (!hasDietActivityInSnapshot(snapshot)) return false;
  state.setHasConfirmedRawWeight(true);
  return true;
}

/**
 * 點擊新增飲食時的兜底檢查：若本機尚未標記，但 IndexedDB 已有飲食記錄或食材，
 * 則自動靜默標記為已確認並放行，避免打斷老用戶操作
 */
export async function ensureRawWeightConfirmedFromDb(): Promise<boolean> {
  const state = useAppStore.getState();
  if (state.hasConfirmedRawWeight) return true;

  const [foodsCount, recipesCount] = await Promise.all([
    db.foods.count(),
    db.recipes.count(),
  ]);
  if (foodsCount > 0 || recipesCount > 0) {
    state.setHasConfirmedRawWeight(true);
    return true;
  }

  const dietLogsCount = await db.daily_diet_logs.count();
  if (dietLogsCount > 0) {
    const logs = await db.daily_diet_logs.toArray();
    if (hasDietActivityInSnapshot({ dailyDietLogs: logs })) {
      state.setHasConfirmedRawWeight(true);
      return true;
    }
  }

  return false;
}
