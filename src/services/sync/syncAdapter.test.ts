import { describe, expect, it, vi } from 'vitest';
import {
  APP_SYNC_FOLDER,
  withSyncBasePath,
  type RemoteFileMetadata,
  type SyncStorageAdapter,
} from './syncAdapter';

describe('withSyncBasePath', () => {
  it('應為所有讀寫與列舉自動加上 /app 前綴，並剝除回傳中繼資料前綴且隔離 /backup', async () => {
    const listMock = vi.fn(async (): Promise<RemoteFileMetadata[]> => [
      {
        name: 'manifest.json',
        path_lower: '/app/manifest.json',
        path_display: '/app/manifest.json',
        id: '1',
        client_modified: '',
        server_modified: '',
        rev: 'r1',
        size: 100,
      },
      {
        name: 'e2cal-backup-2026-11-28.zip',
        path_lower: '/backup/e2cal-backup-2026-11-28.zip',
        path_display: '/backup/e2cal-backup-2026-11-28.zip',
        id: '2',
        client_modified: '',
        server_modified: '',
        rev: 'r2',
        size: 500,
      },
    ]);
    const downloadMock = vi.fn(async (_filePath: string) => ({ ok: true }));
    const uploadMock = vi.fn(async () => 'rev-new');
    const deleteMock = vi.fn(async () => undefined);

    const baseAdapter: SyncStorageAdapter = {
      providerId: 's3',
      isConnected: () => true,
      listRemoteFolder: listMock,
      downloadJsonFile: async <T>(filePath: string) =>
        (await downloadMock(filePath)) as unknown as T | null,
      uploadJsonFile: uploadMock,
      deleteRemotePath: deleteMock,
      disconnect: vi.fn(),
    };

    const scoped = withSyncBasePath(baseAdapter, APP_SYNC_FOLDER);

    const listed = await scoped.listRemoteFolder();
    expect(listMock).toHaveBeenCalledWith('/app');
    expect(listed).toHaveLength(1);
    expect(listed[0]?.path_lower).toBe('/manifest.json');
    expect(listed[0]?.path_display).toBe('/manifest.json');

    await scoped.downloadJsonFile('/user/base_info.json');
    expect(downloadMock).toHaveBeenCalledWith('/app/user/base_info.json');

    await scoped.uploadJsonFile('/nutrition/foods.json', [], 'r1');
    expect(uploadMock).toHaveBeenCalledWith('/app/nutrition/foods.json', [], 'r1');

    await scoped.deleteRemotePath('/deleted_entities.json');
    expect(deleteMock).toHaveBeenCalledWith('/app/deleted_entities.json');
  });
});
