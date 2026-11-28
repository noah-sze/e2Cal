import type { DailyDietLog, WorkoutLog, BodyMetric } from '@/types';
import { sanitizeDailyDietLog, sanitizeWorkoutLog } from './syncSanitizers';

export const CURRENT_SYNC_SCHEMA_VERSION = 3;

export const SYNC_PATHS = {
  MANIFEST: '/manifest.json',
  DELETED_ENTITIES: '/deleted_entities.json',
  BASE_INFO: '/database/base_info.json',
  FOODS: '/database/foods.json',
  RECIPES: '/database/recipes.json',
  EXERCISES: '/database/exercises.json',
  EQUIPMENTS: '/database/equipments.json',
  ROUTINES: '/database/routines.json',
  LOGS_DIR: '/logs',
} as const;

export const SYNC_KNOWN_SUBDIRS = ['/database', '/logs'] as const;

export interface MonthlySyncLogBucket {
  month: string;
  updatedAt: string;
  dailyDietLogs: DailyDietLog[];
  workoutLogs: WorkoutLog[];
  bodyMetrics: BodyMetric[];
}

export function getMonthKey(date: string): string {
  return date.slice(0, 7);
}

export function getMonthLogPath(month: string): string {
  return `${SYNC_PATHS.LOGS_DIR}/${month}.json`;
}

export function isMonthlyLogFilePath(pathLower: string, fileName: string): boolean {
  return (
    pathLower.startsWith(`${SYNC_PATHS.LOGS_DIR}/`) &&
    /^\d{4}-\d{2}\.json$/i.test(fileName)
  );
}

export function groupRecordsByMonth(
  params: {
    dailyDietLogs: DailyDietLog[];
    workoutLogs: WorkoutLog[];
    bodyMetrics: BodyMetric[];
  },
  updatedAt: string
): Map<string, MonthlySyncLogBucket> {
  const map = new Map<string, MonthlySyncLogBucket>();
  const ensure = (month: string): MonthlySyncLogBucket => {
    let bucket = map.get(month);
    if (!bucket) {
      bucket = {
        month,
        updatedAt,
        dailyDietLogs: [],
        workoutLogs: [],
        bodyMetrics: [],
      };
      map.set(month, bucket);
    }
    return bucket;
  };

  for (const log of params.dailyDietLogs) {
    if (!log.date) continue;
    ensure(getMonthKey(log.date)).dailyDietLogs.push(sanitizeDailyDietLog(log));
  }
  for (const log of params.workoutLogs) {
    if (!log.date) continue;
    ensure(getMonthKey(log.date)).workoutLogs.push(sanitizeWorkoutLog(log));
  }
  for (const metric of params.bodyMetrics) {
    if (!metric.date) continue;
    ensure(getMonthKey(metric.date)).bodyMetrics.push(metric);
  }
  return map;
}

export function parseMonthlyLogBucket(
  raw: unknown,
  fallbackMonth = ''
): MonthlySyncLogBucket {
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const rawDiet = Array.isArray(obj.dailyDietLogs) ? obj.dailyDietLogs : [];
  const rawWorkout = Array.isArray(obj.workoutLogs) ? obj.workoutLogs : [];
  const rawBody = Array.isArray(obj.bodyMetrics) ? obj.bodyMetrics : [];

  return {
    month: typeof obj.month === 'string' ? obj.month : fallbackMonth,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : '',
    dailyDietLogs: rawDiet
      .filter(
        (item): item is DailyDietLog =>
          typeof item === 'object' && item !== null && 'entries' in item
      )
      .map(sanitizeDailyDietLog),
    workoutLogs: rawWorkout
      .filter(
        (item): item is WorkoutLog =>
          typeof item === 'object' && item !== null && 'id' in item
      )
      .map(sanitizeWorkoutLog),
    bodyMetrics: rawBody.filter(
      (item): item is BodyMetric =>
        typeof item === 'object' && item !== null && 'id' in item
    ),
  };
}

/**
 * 嚴格校驗遠端月度日誌結構：防止壞檔或非預期格式被誤當空陣列覆寫本機資料
 */
export function parseMonthlyLogBucketStrict(
  raw: unknown,
  fallbackMonth = ''
): MonthlySyncLogBucket {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('SYNC_INVALID_PAYLOAD: monthly log must be a JSON object');
  }
  const obj = raw as Record<string, unknown>;
  const hasValidShape =
    Array.isArray(obj.dailyDietLogs) ||
    Array.isArray(obj.workoutLogs) ||
    Array.isArray(obj.bodyMetrics) ||
    typeof obj.month === 'string';
  if (!hasValidShape) {
    throw new Error('SYNC_INVALID_PAYLOAD: monthly log missing expected fields');
  }
  return parseMonthlyLogBucket(raw, fallbackMonth);
}

/**
 * 嚴格校驗遠端陣列主檔：防止壞檔回傳物件/字串時被靜默清空
 */
export function assertValidArrayPayload<T>(raw: unknown, label: string): T[] {
  if (!Array.isArray(raw)) {
    throw new Error(`SYNC_INVALID_PAYLOAD: ${label} must be a JSON array`);
  }
  return raw as T[];
}

/**
 * 版本門檻檢查：若雲端 schemaVersion 高於本機支援版本，拒絕讀寫並提示更新 App
 */
export function assertCompatibleSchemaVersion(manifest: { schemaVersion?: number } | null | undefined): void {
  if (
    manifest &&
    typeof manifest.schemaVersion === 'number' &&
    manifest.schemaVersion > CURRENT_SYNC_SCHEMA_VERSION
  ) {
    throw new Error(
      `SYNC_SCHEMA_VERSION_UNSUPPORTED: remote v${manifest.schemaVersion} > supported v${CURRENT_SYNC_SCHEMA_VERSION}`
    );
  }
}

/**
 * 強制傳輸安全檢核：公網端點必須使用 HTTPS，僅本地開發環回位址允許 HTTP
 */
export function assertSecureTransportUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('INSECURE_TRANSPORT_URL: invalid URL format');
  }

  if (parsed.protocol === 'https:') return;

  const host = parsed.hostname.toLowerCase();
  const isLoopback =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host === '::1' ||
    host.endsWith('.localhost');

  if (parsed.protocol === 'http:' && isLoopback) return;

  throw new Error('INSECURE_TRANSPORT_URL: HTTPS is required for non-local sync endpoints');
}

/**
 * 憑證脫敏：遮罩錯誤訊息與日誌中可能夾帶的 Bearer / Basic / Query Token 或 AWS 簽章
 */
export function redactSyncSecrets(input: string): string {
  return input
    .replace(/(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]')
    .replace(/(access_token|refresh_token|password|secretAccessKey)=([^&\s]+)/gi, '$1=[REDACTED]')
    .replace(/(X-Amz-Credential|X-Amz-Signature)=([^&\s]+)/gi, '$1=[REDACTED]');
}
