import { db } from '@/services/db/db';
import {
  sanitizeFoodItem,
  sanitizeUserBaseInfo,
  sanitizeRecipe,
  sanitizeWorkoutRoutine,
} from '@/services/sync/syncSanitizers';
import { type SyncManifest } from '@/services/sync/syncEngine';
import {
  SYNC_PATHS,
  getMonthLogPath,
  groupRecordsByMonth,
} from '@/services/sync/syncSchema';

/**
 * 匯出全量備份為 ZIP 檔案
 * 文件結構與雲端同步 /app 目錄 100% 嚴格一致：
 *
 * app/
 *   manifest.json
 *   database/
 *     base_info.json
 *     foods.json
 *     recipes.json
 *     exercises.json
 *     equipments.json
 *     routines.json
 *   logs/
 *     YYYY-MM.json
 */
export async function exportBackupZip(): Promise<Blob> {
  const [
    baseInfos,
    foods,
    recipes,
    dailyDietLogs,
    exercises,
    equipments,
    routines,
    workoutLogs,
    bodyMetrics,
  ] = await Promise.all([
    db.user_base_info.toArray(),
    db.foods.toArray(),
    db.recipes.toArray(),
    db.daily_diet_logs.toArray(),
    db.exercises.toArray(),
    db.equipments.toArray(),
    db.routines.toArray(),
    db.workout_logs.toArray(),
    db.body_metrics.toArray(),
  ]);

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const now = new Date().toISOString();

  // 1. 資料庫主檔: app/database/*.json
  zip.file(
    `app${SYNC_PATHS.BASE_INFO}`,
    JSON.stringify(baseInfos.map(sanitizeUserBaseInfo), null, 2)
  );
  zip.file(
    `app${SYNC_PATHS.FOODS}`,
    JSON.stringify(foods.map(sanitizeFoodItem), null, 2)
  );
  zip.file(
    `app${SYNC_PATHS.RECIPES}`,
    JSON.stringify(recipes.map(sanitizeRecipe), null, 2)
  );
  zip.file(`app${SYNC_PATHS.EXERCISES}`, JSON.stringify(exercises, null, 2));
  zip.file(`app${SYNC_PATHS.EQUIPMENTS}`, JSON.stringify(equipments, null, 2));
  zip.file(
    `app${SYNC_PATHS.ROUTINES}`,
    JSON.stringify(routines.map(sanitizeWorkoutRoutine), null, 2)
  );

  // 2. 月度合併日誌: app/logs/YYYY-MM.json
  const monthlyBuckets = groupRecordsByMonth(
    { dailyDietLogs, workoutLogs, bodyMetrics },
    now
  );
  for (const [month, bucket] of monthlyBuckets) {
    zip.file(`app${getMonthLogPath(month)}`, JSON.stringify(bucket, null, 2));
  }

  // 3. 全域根目錄 app/manifest.json
  const rootManifest: SyncManifest = {
    appName: 'e2Cal',
    schemaVersion: 2,
    exportedAt: now,
    stats: {
      foodsCount: foods.length,
      recipesCount: recipes.length,
      dailyDietLogsCount: dailyDietLogs.length,
      exercisesCount: exercises.length,
      equipmentsCount: equipments.length,
      routinesCount: routines.length,
      workoutLogsCount: workoutLogs.length,
      bodyMetricsCount: bodyMetrics.length,
    },
  };
  zip.file(`app${SYNC_PATHS.MANIFEST}`, JSON.stringify(rootManifest, null, 2));

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * 匯出備份 ZIP 並觸發瀏覽器下載
 */
export async function downloadBackupZip(): Promise<string> {
  const blob = await exportBackupZip();
  const url = URL.createObjectURL(blob);
  const fileName = `e2cal-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return fileName;
}
