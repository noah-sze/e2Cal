import { db, clearDatabaseMutationListeners, withAutoSyncSuppressed } from '@/services/db/db';
import { cancelScheduledAutoSync } from '@/services/sync/syncEngine';
import { clearDropboxTokens } from '@/services/sync/dropboxAuth';
import { clearFoodsCache } from '@/hooks/useFoods';
import { clearRecipesCache } from '@/hooks/useRecipes';
import { clearExercisesCache } from '@/hooks/useExercises';
import { clearDailyDietLogsCache } from '@/hooks/useFoodLogs';
import { clearWorkoutLogsCache } from '@/hooks/useWorkoutLogs';
import { clearRoutinesCache } from '@/hooks/useRoutines';
import { clearUserProfileCache } from '@/hooks/useUserProfile';
import { clearRecentFoodsCache } from '@/hooks/useRecentFoods';
import { clearRecentExercisesCache } from '@/hooks/useRecentExercises';

export interface WipeSiteDataResult {
  deletedDatabases: string[];
  blockedDatabases: string[];
  clearedCachesCount: number;
  unregisteredServiceWorkersCount: number;
  skippedCacheAndSwDueToOffline: boolean;
}

const DEFAULT_IDB_DELETE_TIMEOUT_MS = 1500;

/**
 * 清空所有模組級記憶體快取，確保重載前不會回讀或回寫舊資料
 */
export function clearAllInMemoryCaches(): void {
  clearFoodsCache();
  clearRecipesCache();
  clearExercisesCache();
  clearDailyDietLogsCache();
  clearWorkoutLogsCache();
  clearRoutinesCache();
  clearUserProfileCache();
  clearRecentFoodsCache();
  clearRecentExercisesCache();
}

/**
 * 刪除指定名稱的 IndexedDB 資料庫（附帶 blocked 超時保護，防止其他分頁開啟時永久掛起）
 */
async function deleteIndexedDbByName(
  idbFactory: IDBFactory,
  name: string,
  timeoutMs: number = DEFAULT_IDB_DELETE_TIMEOUT_MS
): Promise<'deleted' | 'blocked'> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (status: 'deleted' | 'blocked') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(status);
    };

    const timer = setTimeout(() => {
      finish('blocked');
    }, timeoutMs);

    try {
      const request = idbFactory.deleteDatabase(name);
      request.onsuccess = () => finish('deleted');
      request.onerror = () => finish('blocked');
      request.onblocked = () => {
        // 等待超時或他頁關閉後自動解除阻塞
      };
    } catch {
      finish('blocked');
    }
  });
}

/**
 * 關閉現有 Dexie 連線並刪除同源下所有 IndexedDB 資料庫
 */
async function wipeAllIndexedDatabases(): Promise<{
  deletedDatabases: string[];
  blockedDatabases: string[];
}> {
  const deletedDatabases: string[] = [];
  const blockedDatabases: string[] = [];

  try {
    db.close();
  } catch {
    // 忽略關閉資料庫時的非關鍵例外
  }

  if (typeof indexedDB === 'undefined') {
    return { deletedDatabases, blockedDatabases };
  }

  const dbNames = new Set<string>([db.name]);

  // 若瀏覽器支援 indexedDB.databases()，枚舉並納入所有同源資料庫
  if (typeof indexedDB.databases === 'function') {
    try {
      const infos = await indexedDB.databases();
      for (const info of infos) {
        if (info.name) {
          dbNames.add(info.name);
        }
      }
    } catch {
      // 忽略部分隱私模式瀏覽器拒絕枚舉的例外
    }
  }

  for (const name of dbNames) {
    const status = await deleteIndexedDbByName(indexedDB, name);
    if (status === 'deleted') {
      deletedDatabases.push(name);
    } else {
      blockedDatabases.push(name);
    }
  }

  return { deletedDatabases, blockedDatabases };
}

/**
 * 全量清空同源下 localStorage 與 sessionStorage
 */
function wipeWebStorages(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage?.clear();
  } catch {
    // 忽略受限環境存儲例外
  }

  try {
    window.sessionStorage?.clear();
  } catch {
    // 忽略受限環境存儲例外
  }
}

/**
 * 清除同源下所有可存取的 Cookies
 */
function wipeAllCookies(): void {
  if (typeof document === 'undefined' || !document.cookie) return;

  try {
    const cookies = document.cookie.split(';');
    const paths = new Set<string>(['/']);
    if (typeof window !== 'undefined' && window.location?.pathname) {
      paths.add(window.location.pathname);
    }

    for (const rawCookie of cookies) {
      const eqIdx = rawCookie.indexOf('=');
      const name = (eqIdx > -1 ? rawCookie.slice(0, eqIdx) : rawCookie).trim();
      if (!name) continue;

      for (const path of paths) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; path=${path}`;
      }
    }
  } catch {
    // 忽略 Cookie 存取例外
  }
}

/**
 * 清理同源 Cache Storage 與註銷 Service Worker（僅於在線時執行，避免離線重載白屏）
 */
async function wipeCachesAndServiceWorkers(): Promise<{
  clearedCachesCount: number;
  unregisteredServiceWorkersCount: number;
  skippedCacheAndSwDueToOffline: boolean;
}> {
  const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!isOnline) {
    return {
      clearedCachesCount: 0,
      unregisteredServiceWorkersCount: 0,
      skippedCacheAndSwDueToOffline: true,
    };
  }

  let clearedCachesCount = 0;
  let unregisteredServiceWorkersCount = 0;

  if (typeof window !== 'undefined' && 'caches' in window && window.caches) {
    try {
      const keys = await window.caches.keys();
      await Promise.all(
        keys.map(async (key) => {
          const deleted = await window.caches.delete(key);
          if (deleted) clearedCachesCount += 1;
        })
      );
    } catch {
      // 忽略 Cache Storage 例外
    }
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (reg) => {
          try {
            const ok = await reg.unregister();
            if (ok) unregisteredServiceWorkersCount += 1;
          } catch {
            // 忽略單一 SW 註銷失敗
          }
        })
      );
    } catch {
      // 忽略 Service Worker API 例外
    }
  }

  return {
    clearedCachesCount,
    unregisteredServiceWorkersCount,
    skippedCacheAndSwDueToOffline: false,
  };
}

/**
 * 瀏覽器級全量網站數據抹除 (Site Data Wipe)
 * 依序執行：靜默同步與快取清理 -> 刪除所有 IndexedDB -> 清空 Web Storage & Cookies -> 在線清理 Cache/SW -> 最終防護重清
 * 執行完畢後應立即以 window.location.replace('/') 重載，以 100% 全新空白瀏覽器狀態啟動。
 */
export async function wipeAllSiteData(): Promise<WipeSiteDataResult> {
  return await withAutoSyncSuppressed(async () => {
    // 1. 中止背景自動同步與資料變更監聽，清空所有記憶體快取
    cancelScheduledAutoSync();
    clearDatabaseMutationListeners();
    clearDropboxTokens();
    clearAllInMemoryCaches();

    // 2. 釋放連線並徹底刪除同源所有 IndexedDB（不在當下重新寫入預設資料）
    const { deletedDatabases, blockedDatabases } = await wipeAllIndexedDatabases();

    // 3. 全量清空 localStorage、sessionStorage 與 Cookies
    wipeWebStorages();
    wipeAllCookies();

    // 4. 在線時清空 Cache Storage 並註銷 Service Worker（離線時保留以避免重載斷網白屏）
    const cacheSwResult = await wipeCachesAndServiceWorkers();

    // 5. 最終防線：再次清空 Storage 防止清理期間的非同步微任務回寫
    wipeWebStorages();

    return {
      deletedDatabases,
      blockedDatabases,
      ...cacheSwResult,
    };
  });
}
