import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FoodItem, WorkoutLog } from '@/types';
import type { EntityTombstoneMap } from '@/services/db/db';

const {
  mockBulkPut,
  mockBulkDelete,
  mockFoodsToArray,
  mockWorkoutLogsToArray,
  mockListRemoteFolder,
  mockDownloadJsonFile,
  mockUploadJsonFile,
  mockUploadAllLocalData,
  localTombstonesRef,
} = vi.hoisted(() => ({
  mockBulkPut: vi.fn().mockResolvedValue(undefined),
  mockBulkDelete: vi.fn().mockResolvedValue(undefined),
  mockFoodsToArray: vi.fn<() => Promise<FoodItem[]>>().mockResolvedValue([]),
  mockWorkoutLogsToArray: vi.fn<() => Promise<WorkoutLog[]>>().mockResolvedValue([]),
  mockListRemoteFolder: vi.fn(),
  mockDownloadJsonFile: vi.fn(),
  mockUploadJsonFile: vi.fn().mockResolvedValue('rev_uploaded'),
  mockUploadAllLocalData: vi.fn().mockResolvedValue(undefined),
  localTombstonesRef: { current: {} as EntityTombstoneMap },
}));

vi.mock('@/services/db/db', () => {
  const emptyTable = () => ({
    toArray: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    get: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    bulkPut: mockBulkPut,
    bulkDelete: mockBulkDelete,
  });

  return {
    db: {
      user_base_info: emptyTable(),
      user_profile: emptyTable(),
      foods: { ...emptyTable(), toArray: mockFoodsToArray },
      recipes: emptyTable(),
      daily_diet_logs: { ...emptyTable(), count: vi.fn().mockResolvedValue(1) },
      exercises: emptyTable(),
      equipments: emptyTable(),
      routines: emptyTable(),
      workout_logs: { ...emptyTable(), toArray: mockWorkoutLogsToArray },
      body_metrics: emptyTable(),
      transaction: vi.fn(async (_mode: string, _tables: unknown[], cb: () => Promise<void>) => cb()),
    },
    withAutoSyncSuppressed: vi.fn(async <T>(fn: () => Promise<T>) => fn()),
    getLocalEntityTombstones: vi.fn(() => localTombstonesRef.current),
    setLocalEntityTombstones: vi.fn((map: EntityTombstoneMap) => {
      localTombstonesRef.current = map;
    }),
  };
});

vi.mock('./dropboxAuth', () => ({
  commitStagingTokens: vi.fn(),
  clearStagingTokens: vi.fn(),
  setStagingTokens: vi.fn(),
  exchangeCodeForTokensOnly: vi.fn().mockResolvedValue({
    accessToken: 'test_access',
    refreshToken: 'test_refresh',
    expiresAt: Date.now() + 3600_000,
  }),
}));

vi.mock('./dropboxClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dropboxClient')>();
  return {
    ...actual,
    listRemoteFolder: mockListRemoteFolder,
    downloadJsonFile: mockDownloadJsonFile,
    uploadJsonFile: mockUploadJsonFile,
  };
});

vi.mock('./syncEngine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./syncEngine')>();
  return {
    ...actual,
    uploadAllLocalData: mockUploadAllLocalData,
  };
});

import { startInitialSync, selectStrategy, getInitialSyncState } from './initialSyncManager';
import { setLocalEntityTombstones } from '@/services/db/db';

describe('initialSyncManager tombstone handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localTombstonesRef.current = {};
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    });
  });

  it('deletes locally-present entities tombstoned in remote /deleted_entities.json on merge instead of resurrecting them', async () => {
    const nowTs = Date.now();
    const deletedFoodId = 'food-deleted-on-other-device';
    const keptFoodId = 'food-kept';

    mockFoodsToArray.mockResolvedValue([
      {
        id: deletedFoodId,
        name: 'Deleted Chicken',
        category: 'natural',
        macros: {
          calories: 165,
          carbs: { total: 0 },
          protein: 31,
          fat: { total: 3.6 },
        },
        servingSize: 100,
        servingUnit: 'g',
        isCustom: true,
        createdAt: nowTs - 10_000,
        updatedAt: nowTs - 5_000,
        rev: 1,
      },
      {
        id: keptFoodId,
        name: 'Kept Oats',
        category: 'natural',
        macros: {
          calories: 370,
          carbs: { total: 66 },
          protein: 14,
          fat: { total: 7 },
        },
        servingSize: 100,
        servingUnit: 'g',
        isCustom: true,
        createdAt: nowTs - 10_000,
        updatedAt: nowTs - 5_000,
        rev: 1,
      },
    ]);

    const remoteTombstones: EntityTombstoneMap = {
      foods: {
        [deletedFoodId]: nowTs - 1_000,
      },
    };

    mockListRemoteFolder.mockResolvedValue([
      { name: 'manifest.json', path_lower: '/app/manifest.json', rev: 'r_manifest' },
      { name: 'foods.json', path_lower: '/app/nutrition/foods.json', rev: 'r_foods' },
      { name: 'deleted_entities.json', path_lower: '/app/deleted_entities.json', rev: 'r_tomb' },
    ]);

    mockDownloadJsonFile.mockImplementation(async (path: string) => {
      if (path === '/app/manifest.json') {
        return {
          version: 1,
          updatedAt: new Date(nowTs).toISOString(),
          stats: { dailyDietLogsCount: 1, workoutLogsCount: 0, bodyMetricsCount: 0 },
        };
      }
      if (path === '/app/nutrition/foods.json') {
        return [];
      }
      if (path === '/app/deleted_entities.json') {
        return remoteTombstones;
      }
      return null;
    });

    await startInitialSync('oauth_code', { mode: 'sync' });
    expect(getInitialSyncState().step).toBe('STRATEGY');

    await selectStrategy('merge');

    expect(mockBulkDelete).toHaveBeenCalledWith([deletedFoodId]);
    expect(mockBulkPut).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: keptFoodId })])
    );
    expect(mockBulkPut).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: deletedFoodId })])
    );
    expect(setLocalEntityTombstones).toHaveBeenCalledWith(
      expect.objectContaining({
        foods: expect.objectContaining({ [deletedFoodId]: nowTs - 1_000 }),
      })
    );
    expect(getInitialSyncState().step).toBe('COMPLETED');
  });

  it('應支援統一雲端流程前置與阻斷狀態轉換 (CONNECTING / SOURCE_PICKER / BLOCKED / closeCloudFlow)', async () => {
    const {
      openCloudFlowConnecting,
      openCloudFlowSourcePicker,
      openCloudFlowBlocked,
      closeCloudFlow,
    } = await import('./initialSyncManager');

    openCloudFlowConnecting('dropbox');
    expect(getInitialSyncState()).toMatchObject({
      isOpen: true,
      step: 'CONNECTING',
      connectingProvider: 'dropbox',
      sourcePicker: null,
      blocked: null,
    });

    openCloudFlowSourcePicker({
      providerId: 'dropbox',
      hasPrimarySync: true,
      backupItems: [
        {
          name: 'e2cal-backup-2026-11-28.zip',
          path: '/backup/e2cal-backup-2026-11-28.zip',
          date: '2026-11-28',
          size: 1024,
          serverModified: '2026-11-28T00:00:00Z',
        },
      ],
      onSelectRollingBackup: async () => {},
    });
    expect(getInitialSyncState()).toMatchObject({
      isOpen: true,
      step: 'SOURCE_PICKER',
      connectingProvider: null,
      blocked: null,
    });
    expect(getInitialSyncState().sourcePicker?.backupItems).toHaveLength(1);

    openCloudFlowBlocked({
      providerId: 's3',
      reason: 'no_restorable_data',
      accountLabel: 'my-bucket',
    });
    expect(getInitialSyncState()).toMatchObject({
      isOpen: true,
      step: 'BLOCKED',
      sourcePicker: null,
      blocked: {
        providerId: 's3',
        reason: 'no_restorable_data',
        accountLabel: 'my-bucket',
      },
    });

    closeCloudFlow();
    expect(getInitialSyncState()).toMatchObject({
      isOpen: false,
      step: 'AUTH',
      connectingProvider: null,
      sourcePicker: null,
      blocked: null,
    });
  });

  it('在達到 COMPLETED 前，不應覆寫 e2cal_sync_provider 亦不應提交憑證；下載失敗應自動回滾', async () => {
    const { commitStagingTokens, clearStagingTokens } = await import('./dropboxAuth');
    const { setActiveSyncProviderId, getActiveSyncProviderId } = await import('./syncRouter');
    const { setStagingWebDavConfig, getWebDavConfig } = await import('./adapters/webdavAdapter');

    // 先模擬使用者原本已使用 dropbox
    setActiveSyncProviderId('dropbox');
    setStagingWebDavConfig(
      { baseUrl: 'https://nas.example.com/dav', username: 'u1', password: 'p1' },
      'primary'
    );

    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/app/') || url.endsWith('/app/database/') || url.endsWith('/app/logs/')) {
        return new Response(
          `<?xml version="1.0" encoding="utf-8"?>
          <D:multistatus xmlns:D="DAV:">
            <D:response>
              <D:href>/dav/app/manifest.json</D:href>
              <D:propstat><D:prop><D:getetag>"m1"</D:getetag></D:prop></D:propstat>
            </D:response>
            <D:response>
              <D:href>/dav/app/database/foods.json</D:href>
              <D:propstat><D:prop><D:getetag>"f1"</D:getetag></D:prop></D:propstat>
            </D:response>
          </D:multistatus>`,
          { status: 207 }
        );
      }
      if (url.endsWith('/app/manifest.json')) {
        return new Response(
          JSON.stringify({
            version: 1,
            updatedAt: new Date().toISOString(),
            stats: { dailyDietLogsCount: 2, workoutLogsCount: 0, bodyMetricsCount: 0 },
          }),
          { status: 200 }
        );
      }
      // 模擬下載 foods.json 時網路失敗
      return new Response(null, { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await startInitialSync('', { mode: 'sync', providerId: 'webdav' });

    // STRATEGY 階段：不應改動 localStorage 中的 active provider，也不應持久化 WebDAV 設定
    expect(getInitialSyncState().step).toBe('STRATEGY');
    expect(getActiveSyncProviderId()).toBe('dropbox');
    expect(getWebDavConfig('primary')).toBeNull();
    expect(commitStagingTokens).not.toHaveBeenCalled();

    // 選擇策略進入下載並失敗：應回滾 Staging，保留原有 dropbox provider
    await selectStrategy('merge');
    expect(getInitialSyncState().error).toBeTruthy();
    expect(getActiveSyncProviderId()).toBe('dropbox');
    expect(getWebDavConfig('primary')).toBeNull();
    expect(clearStagingTokens).not.toHaveBeenCalled();
  });

  it('應支援每日滾動備份連線完成狀態 (BACKUP_CONNECTED)', async () => {
    const { openCloudFlowBackupConnected, closeCloudFlow } = await import('./initialSyncManager');

    openCloudFlowBackupConnected('webdav');
    expect(getInitialSyncState()).toMatchObject({
      isOpen: true,
      step: 'BACKUP_CONNECTED',
      backupConnectedProvider: 'webdav',
      blocked: null,
      sourcePicker: null,
    });

    closeCloudFlow();
    expect(getInitialSyncState()).toMatchObject({
      isOpen: false,
      step: 'AUTH',
      backupConnectedProvider: null,
    });
  });
});
