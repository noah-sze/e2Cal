import type { E2CalDatabase } from './db';
import { clearDropboxTokens } from '@/services/sync/dropboxAuth';
import { clearFoodsCache } from '@/hooks/useFoods';
import { clearRecipesCache } from '@/hooks/useRecipes';
import { clearExercisesCache } from '@/hooks/useExercises';
import { DEFAULT_EQUIPMENT_IDS, DEFAULT_EQUIPMENTS } from './defaultEquipments';
import { DEFAULT_EXERCISE_IDS, DEFAULT_EXERCISES } from './defaultExercises';

export { DEFAULT_EQUIPMENT_IDS, DEFAULT_EQUIPMENTS };
export { DEFAULT_EXERCISE_IDS, DEFAULT_EXERCISES };

// ============================================================================
// 系統預設實體確定性靜態 UUID (Deterministic Static UUIDs)
// 確保多設備分散式同步與初次種子初始化時 ID 始終恆定一致，杜絕分叉與重複
// ============================================================================

export const PRIMARY_USER_ID = '2848673b-dd09-4d1c-893a-bc501b79122a';
export const DEFAULT_USER_PROFILE_ID = '36789f9a-551b-4b58-9984-dd26b50a2e71';

/**
 * 恢復預設數據 (無害補齊缺失項目，不覆蓋用戶已修改內容與自訂項目)
 */
export async function restoreMissingDefaultData(db: E2CalDatabase): Promise<{
  totalRestored: number;
  details: { foods: number; exercises: number; equipments: number; recipes: number };
}> {
  const now = Date.now();
  let foodsRestored = 0;
  let exercisesRestored = 0;
  let equipmentsRestored = 0;
  let recipesRestored = 0;

  // 1. 補齊器械
  for (const eq of DEFAULT_EQUIPMENTS) {
    const existingById = await db.equipments.get(eq.id);
    const existingByName = await db.equipments.where('name').equals(eq.name).first();
    if (!existingById && !existingByName) {
      await db.equipments.add({ ...eq, createdAt: now, updatedAt: now });
      equipmentsRestored += 1;
    }
  }

  // 2. 補齊動作
  for (const ex of DEFAULT_EXERCISES) {
    const existingById = await db.exercises.get(ex.id);
    const existingByName = await db.exercises.where('name').equals(ex.name).first();
    const existingByLegacyName = await db.exercises
      .filter((item) => item.name.startsWith(ex.name) && item.name.includes('('))
      .first();
    if (!existingById && !existingByName && !existingByLegacyName) {
      await db.exercises.add({ ...ex, createdAt: now, updatedAt: now });
      exercisesRestored += 1;
    }
  }

  // 3. 菜餚與食材 100% 由使用者自主建立或自 1.8 萬筆權威庫選取導入，不作工廠強制填補
  const totalRestored = foodsRestored + exercisesRestored + equipmentsRestored + recipesRestored;
  return {
    totalRestored,
    details: {
      foods: foodsRestored,
      exercises: exercisesRestored,
      equipments: equipmentsRestored,
      recipes: recipesRestored,
    },
  };
}

/**
 * 徹底出廠重置 (Factory Reset)
 * 1. 清空所有業務日誌 (飲食記錄 daily_diet_logs、訓練日誌 workout_logs、身體指標 body_metrics、課表 routines)
 * 2. 清空飲食與食譜（回歸出廠純淨空白態，零寫死預設食材庫）
 * 3. 系統動作與器械庫 100% 保留並解除歸檔 (isArchived: false)；若有缺失自動補齊出廠數據
 * 4. 個人基本資料與檔案重置為初始出廠狀態 (空白未設定態)
 * 5. 徹底中斷 Dropbox 雲端同步並清除本地授權 Token 與中繼資料
 * 6. 清理記憶體快取與本地偏好存儲
 */
export async function resetDatabaseToFactory(db: E2CalDatabase): Promise<void> {
  const now = Date.now();

  // 1. 清空所有業務日誌與課表
  await Promise.all([
    db.daily_diet_logs.clear(),
    db.workout_logs.clear(),
    db.body_metrics.clear(),
    db.routines.clear(),
  ]);

  // 2. 清空飲食與食譜（零寫死食材庫），清除器械與動作的自定義項目
  await Promise.all([
    db.foods.clear(),
    db.recipes.clear(),
    db.exercises.filter((e) => Boolean(e.isCustom)).delete(),
    db.equipments.filter((eq) => Boolean(eq.isCustom)).delete(),
  ]);

  // 3. 系統器械與動作庫解除歸檔
  await Promise.all([
    db.exercises.toCollection().modify({ isArchived: false }),
    db.equipments.toCollection().modify({ isArchived: false }),
  ]);

  // 4. 補齊出廠預設實體（若預設項目曾被意外刪除）
  await restoreMissingDefaultData(db);

  // 5. 重置個人資料與基本生理常數 (純粹出廠空白態：無姓名、無捏造體重)
  await Promise.all([
    db.user_profile.clear(),
    db.user_base_info.clear(),
  ]);

  await db.user_profile.add({
    id: DEFAULT_USER_PROFILE_ID,
    name: '',
    gender: 'male',
    heightCm: 0,
    currentWeightKg: 0,
    activityLevel: 1.2,
    goalType: 'lose_fat',
    weightUnit: 'kg',
    isSetupCompleted: false,
    updatedAt: now,
  });

  await db.user_base_info.add({
    id: PRIMARY_USER_ID,
    name: '',
    gender: 'male',
    birthDate: '',
    heightCm: 0,
    createdAt: now,
    updatedAt: now,
  });

  // 6. 清理 Dropbox 憑證與同步中繼鍵
  clearDropboxTokens();
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('e2cal_dropbox_last_sync');
    localStorage.removeItem('e2cal_dropbox_cached_revs');
    localStorage.removeItem('e2cal_dropbox_pushed_times');
    localStorage.removeItem('e2cal-app-storage');
    localStorage.removeItem('e2cal-in-app-nav-storage');
    localStorage.removeItem('e2cal-ui-theme');
    localStorage.removeItem('e2cal_date_session');
    localStorage.removeItem('e2cal_max_observed_time');
  }

  // 7. 清空執行時期記憶體注水快取
  clearFoodsCache();
  clearRecipesCache();
  clearExercisesCache();
}
