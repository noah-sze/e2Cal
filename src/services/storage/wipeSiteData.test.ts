import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockDbClose = vi.fn();
const mockClearDbListeners = vi.fn();
const mockCancelScheduledAutoSync = vi.fn();
const mockClearDropboxTokens = vi.fn();
const mockClearFoodsCache = vi.fn();
const mockClearRecipesCache = vi.fn();
const mockClearExercisesCache = vi.fn();
const mockClearDailyDietLogsCache = vi.fn();
const mockClearWorkoutLogsCache = vi.fn();
const mockClearRoutinesCache = vi.fn();
const mockClearUserProfileCache = vi.fn();
const mockClearRecentFoodsCache = vi.fn();
const mockClearRecentExercisesCache = vi.fn();

vi.mock('@/services/db/db', () => ({
  db: {
    name: 'e2CalDB',
    close: mockDbClose,
  },
  clearDatabaseMutationListeners: mockClearDbListeners,
  withAutoSyncSuppressed: async <T>(fn: () => Promise<T>): Promise<T> => await fn(),
}));

vi.mock('@/services/sync/syncEngine', () => ({
  cancelScheduledAutoSync: mockCancelScheduledAutoSync,
}));

vi.mock('@/services/sync/dropboxAuth', () => ({
  clearDropboxTokens: mockClearDropboxTokens,
}));

vi.mock('@/hooks/useFoods', () => ({ clearFoodsCache: mockClearFoodsCache }));
vi.mock('@/hooks/useRecipes', () => ({ clearRecipesCache: mockClearRecipesCache }));
vi.mock('@/hooks/useExercises', () => ({ clearExercisesCache: mockClearExercisesCache }));
vi.mock('@/hooks/useFoodLogs', () => ({ clearDailyDietLogsCache: mockClearDailyDietLogsCache }));
vi.mock('@/hooks/useWorkoutLogs', () => ({ clearWorkoutLogsCache: mockClearWorkoutLogsCache }));
vi.mock('@/hooks/useRoutines', () => ({ clearRoutinesCache: mockClearRoutinesCache }));
vi.mock('@/hooks/useUserProfile', () => ({ clearUserProfileCache: mockClearUserProfileCache }));
vi.mock('@/hooks/useRecentFoods', () => ({ clearRecentFoodsCache: mockClearRecentFoodsCache }));
vi.mock('@/hooks/useRecentExercises', () => ({ clearRecentExercisesCache: mockClearRecentExercisesCache }));

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

describe('wipeAllSiteData (瀏覽器級全量網站數據抹除)', () => {
  let localStore: MemoryStorage;
  let sessionStore: MemoryStorage;
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const originalIndexedDB = globalThis.indexedDB;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    vi.clearAllMocks();
    localStore = new MemoryStorage();
    sessionStore = new MemoryStorage();

    localStore.setItem('e2cal_seed_initialized', 'true');
    localStore.setItem('e2cal_ai_geminiApiKey', 'AIza-secret');
    localStore.setItem('e2cal_deleted_entity_tombstones', '{"foods":{"1":123}}');
    localStore.setItem('arbitrary_unknown_key', 'residue');
    sessionStore.setItem('e2cal_dropbox_oauth_verifier', 'verifier-123');
    sessionStore.setItem('e2cal_date_session', '2026-11-26');
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true });
    Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
    Object.defineProperty(globalThis, 'indexedDB', { value: originalIndexedDB, configurable: true });
    Object.defineProperty(globalThis, 'document', { value: originalDocument, configurable: true });
  });

  function setupBrowserMocks(options?: {
    onLine?: boolean;
    extraDbNames?: string[];
    blockedDbNames?: string[];
    cacheKeys?: string[];
    swCount?: number;
  }) {
    const deletedDbNames: string[] = [];
    const deletedCacheKeys: string[] = [];
    let swUnregisteredCount = 0;
    const cookieWrites: string[] = [];

    const mockCaches = {
      keys: vi.fn(async () => options?.cacheKeys ?? ['workbox-precache-v2', 'runtime-cache']),
      delete: vi.fn(async (key: string) => {
        deletedCacheKeys.push(key);
        return true;
      }),
    };

    const swRegs = Array.from({ length: options?.swCount ?? 1 }, () => ({
      unregister: vi.fn(async () => {
        swUnregisteredCount += 1;
        return true;
      }),
    }));

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: localStore,
        sessionStorage: sessionStore,
        caches: mockCaches,
        location: { pathname: '/app' },
      },
    });

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        onLine: options?.onLine ?? true,
        serviceWorker: {
          getRegistrations: vi.fn(async () => swRegs),
        },
      },
    });

    const dbList = ['e2CalDB', ...(options?.extraDbNames ?? [])].map((name) => ({ name }));
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        databases: vi.fn(async () => dbList),
        deleteDatabase: vi.fn((name: string) => {
          const req: Record<string, unknown> = {};
          setTimeout(() => {
            if (options?.blockedDbNames?.includes(name)) {
              const onblocked = req.onblocked as (() => void) | undefined;
              onblocked?.();
            } else {
              deletedDbNames.push(name);
              const onsuccess = req.onsuccess as (() => void) | undefined;
              onsuccess?.();
            }
          }, 0);
          return req;
        }),
      },
    });

    const docMock = {
      _cookie: 'session_id=abc; pref=dark',
      get cookie() {
        return this._cookie;
      },
      set cookie(val: string) {
        cookieWrites.push(val);
      },
    };
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: docMock,
    });

    return {
      deletedDbNames,
      deletedCacheKeys,
      getSwUnregisteredCount: () => swUnregisteredCount,
      cookieWrites,
    };
  }

  it('在線時應徹底清除所有儲存、同源 IndexedDB、Cookies、Cache Storage、Service Worker 與記憶體快取', async () => {
    const mocks = setupBrowserMocks({
      onLine: true,
      extraDbNames: ['legacy_other_db'],
      cacheKeys: ['precache-v1', 'fonts-cache'],
      swCount: 2,
    });

    const { wipeAllSiteData } = await import('./wipeSiteData');
    const result = await wipeAllSiteData();

    // 1. 停止同步與清空記憶體快取
    expect(mockCancelScheduledAutoSync).toHaveBeenCalledTimes(1);
    expect(mockClearDbListeners).toHaveBeenCalledTimes(1);
    expect(mockClearDropboxTokens).toHaveBeenCalledTimes(1);
    expect(mockClearFoodsCache).toHaveBeenCalledTimes(1);
    expect(mockClearRecipesCache).toHaveBeenCalledTimes(1);
    expect(mockClearExercisesCache).toHaveBeenCalledTimes(1);
    expect(mockClearDailyDietLogsCache).toHaveBeenCalledTimes(1);
    expect(mockClearWorkoutLogsCache).toHaveBeenCalledTimes(1);
    expect(mockClearRoutinesCache).toHaveBeenCalledTimes(1);
    expect(mockClearUserProfileCache).toHaveBeenCalledTimes(1);
    expect(mockClearRecentFoodsCache).toHaveBeenCalledTimes(1);
    expect(mockClearRecentExercisesCache).toHaveBeenCalledTimes(1);

    // 2. IndexedDB 全庫關閉與刪除
    expect(mockDbClose).toHaveBeenCalledTimes(1);
    expect(result.deletedDatabases).toEqual(['e2CalDB', 'legacy_other_db']);
    expect(result.blockedDatabases).toEqual([]);
    expect(mocks.deletedDbNames).toEqual(['e2CalDB', 'legacy_other_db']);

    // 3. localStorage & sessionStorage 100% 清空（包含未知鍵值與敏感金鑰）
    expect(localStore.length).toBe(0);
    expect(sessionStore.length).toBe(0);

    // 4. Cookies 清除
    expect(mocks.cookieWrites.some((c) => c.startsWith('session_id=;'))).toBe(true);
    expect(mocks.cookieWrites.some((c) => c.startsWith('pref=;'))).toBe(true);

    // 5. Cache Storage & Service Worker 清理
    expect(result.skippedCacheAndSwDueToOffline).toBe(false);
    expect(result.clearedCachesCount).toBe(2);
    expect(result.unregisteredServiceWorkersCount).toBe(2);
    expect(mocks.deletedCacheKeys).toEqual(['precache-v1', 'fonts-cache']);
    expect(mocks.getSwUnregisteredCount()).toBe(2);
  });

  it('離線時應保留 Service Worker 與 Cache Storage，同時照常清空所有資料儲存', async () => {
    const mocks = setupBrowserMocks({
      onLine: false,
      cacheKeys: ['precache-v1'],
      swCount: 1,
    });

    const { wipeAllSiteData } = await import('./wipeSiteData');
    const result = await wipeAllSiteData();

    expect(result.skippedCacheAndSwDueToOffline).toBe(true);
    expect(result.clearedCachesCount).toBe(0);
    expect(result.unregisteredServiceWorkersCount).toBe(0);
    expect(mocks.deletedCacheKeys).toEqual([]);
    expect(mocks.getSwUnregisteredCount()).toBe(0);

    // 資料與儲存仍必須 100% 清空
    expect(result.deletedDatabases).toEqual(['e2CalDB']);
    expect(localStore.length).toBe(0);
    expect(sessionStore.length).toBe(0);
  });

  it('當 IndexedDB 刪除被其他分頁阻塞 (onblocked) 時，應在超時後安全返回而不永久掛起', async () => {
    vi.useFakeTimers();
    setupBrowserMocks({
      onLine: true,
      blockedDbNames: ['e2CalDB'],
    });

    const { wipeAllSiteData } = await import('./wipeSiteData');
    const promise = wipeAllSiteData();

    await vi.advanceTimersByTimeAsync(1600);
    const result = await promise;

    expect(result.deletedDatabases).toEqual([]);
    expect(result.blockedDatabases).toEqual(['e2CalDB']);
    expect(localStore.length).toBe(0);
    expect(sessionStore.length).toBe(0);
  });
});
