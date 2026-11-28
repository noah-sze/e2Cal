import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteFileMetadata } from './syncAdapter';

const memoryStorage = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => memoryStorage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memoryStorage.set(key, value);
  },
  removeItem: (key: string) => {
    memoryStorage.delete(key);
  },
  clear: () => {
    memoryStorage.clear();
  },
};

vi.stubGlobal('localStorage', localStorageStub);

const mockExportBackupZip = vi.fn(async () => new Blob(['zip-content'], { type: 'application/zip' }));
vi.mock('@/services/backup/exportBackupZip', () => ({
  exportBackupZip: () => mockExportBackupZip(),
}));

const mockState = {
  connected: true,
  uploadedPaths: [] as string[],
  deletedPaths: [] as string[],
  remoteBackupFiles: [] as RemoteFileMetadata[],
  shouldFailUpload: false,
};

function createMockMeta(name: string, size = 1024): RemoteFileMetadata {
  return {
    name,
    path_lower: `/backup/${name.toLowerCase()}`,
    path_display: `/backup/${name}`,
    id: name,
    client_modified: '2026-11-27T00:00:00Z',
    server_modified: '2026-11-27T00:00:00Z',
    rev: 'rev-1',
    size,
  };
}

vi.mock('./syncRouter', async () => {
  const actual = await vi.importActual<typeof import('./syncRouter')>('./syncRouter');
  return {
    ...actual,
    getBackupProviderId: () => (mockState.connected ? 'webdav' : null),
    isRollingBackupConnected: () => mockState.connected,
    getBackupAdapter: () =>
      mockState.connected
        ? {
            providerId: 'webdav' as const,
            isConnected: () => mockState.connected,
            listRemoteFolder: vi.fn(async () => mockState.remoteBackupFiles),
            downloadJsonFile: vi.fn(async () => null),
            uploadJsonFile: vi.fn(async () => 'rev-1'),
            uploadBinaryFile: vi.fn(async (filePath: string) => {
              if (mockState.shouldFailUpload) {
                throw new Error('Network error');
              }
              mockState.uploadedPaths.push(filePath);
              const name = filePath.split('/').pop()!;
              mockState.remoteBackupFiles.push(createMockMeta(name, 2048));
              return 'rev-zip';
            }),
            downloadBinaryFile: vi.fn(async (filePath: string) => {
              if (filePath.includes('missing')) return null;
              return new Blob(['restored-zip'], { type: 'application/zip' });
            }),
            deleteRemotePath: vi.fn(async (filePath: string) => {
              mockState.deletedPaths.push(filePath);
              mockState.remoteBackupFiles = mockState.remoteBackupFiles.filter(
                (f) => f.path_display !== filePath
              );
            }),
            disconnect: vi.fn(),
          }
        : null,
  };
});

import {
  clearBackupDirtyFlag,
  downloadRollingBackupBlob,
  getLastBackupZipDateKey,
  getLastBackupZipTime,
  hasBackupDirtyFlag,
  inspectCloudImportSources,
  isRollingBackupDueToday,
  listRollingBackups,
  markBackupDirty,
  parseRollingBackupItems,
  runRollingBackup,
} from './rollingBackupService';

describe('rollingBackupService', () => {
  beforeEach(() => {
    memoryStorage.clear();
    mockState.connected = true;
    mockState.uploadedPaths = [];
    mockState.deletedPaths = [];
    mockState.remoteBackupFiles = [];
    mockState.shouldFailUpload = false;
    mockExportBackupZip.mockClear();
  });

  it('依備份渠道隔離異動標記', () => {
    markBackupDirty('webdav');
    expect(hasBackupDirtyFlag('webdav')).toBe(true);
    expect(hasBackupDirtyFlag('dropbox')).toBe(false);

    clearBackupDirtyFlag('webdav');
    expect(hasBackupDirtyFlag('webdav')).toBe(false);
  });

  it('先上傳今日備份再刪除超過 3 份的最舊備份（安全滾動保留）', async () => {
    mockState.remoteBackupFiles = [
      createMockMeta('e2cal-backup-2026-11-24.zip'),
      createMockMeta('e2cal-backup-2026-11-25.zip'),
      createMockMeta('e2cal-backup-2026-11-26.zip'),
      createMockMeta('unrelated-note.txt'),
    ];

    const result = await runRollingBackup({
      force: true,
      now: new Date('2026-11-27T10:00:00'),
    });

    expect(result.uploaded).toBe(true);
    expect(result.fileName).toBe('e2cal-backup-2026-11-27.zip');
    expect(result.path).toBe('/backup/e2cal-backup-2026-11-27.zip');
    expect(result.deletedCount).toBe(1);
    expect(mockState.uploadedPaths).toEqual(['/backup/e2cal-backup-2026-11-27.zip']);
    expect(mockState.deletedPaths).toEqual(['/backup/e2cal-backup-2026-11-24.zip']);
    expect(getLastBackupZipDateKey('webdav')).toBe('2026-11-27');
    expect(getLastBackupZipTime('webdav')).not.toBeNull();
    expect(hasBackupDirtyFlag('webdav')).toBe(false);
  });

  it('上傳失敗時不應刪除任何既有舊備份', async () => {
    mockState.remoteBackupFiles = [
      createMockMeta('e2cal-backup-2026-11-24.zip'),
      createMockMeta('e2cal-backup-2026-11-25.zip'),
      createMockMeta('e2cal-backup-2026-11-26.zip'),
    ];
    mockState.shouldFailUpload = true;

    await expect(
      runRollingBackup({ force: true, now: new Date('2026-11-27T10:00:00') })
    ).rejects.toThrow('Network error');

    expect(mockState.deletedPaths).toEqual([]);
    expect(getLastBackupZipDateKey('webdav')).toBeNull();
  });

  it('同日非強制模式下不重複打包，隔日有異動才重新觸發', async () => {
    const day1 = new Date('2026-11-27T09:00:00');
    expect(isRollingBackupDueToday(day1, 'webdav')).toBe(true);

    const first = await runRollingBackup({ force: false, now: day1 });
    expect(first.uploaded).toBe(true);

    markBackupDirty('webdav');
    expect(isRollingBackupDueToday(day1, 'webdav')).toBe(false);
    const sameDay = await runRollingBackup({ force: false, now: day1 });
    expect(sameDay.uploaded).toBe(false);
    expect(sameDay.skippedReason).toBe('not_due');

    const day2 = new Date('2026-11-28T09:00:00');
    expect(isRollingBackupDueToday(day2, 'webdav')).toBe(true);
    const nextDay = await runRollingBackup({ force: false, now: day2 });
    expect(nextDay.uploaded).toBe(true);
    expect(nextDay.fileName).toBe('e2cal-backup-2026-11-28.zip');
  });

  it('parseRollingBackupItems 與 listRollingBackups 只回傳合法檔名並由新到舊排序', async () => {
    mockState.remoteBackupFiles = [
      createMockMeta('e2cal-backup-2026-11-24.zip', 100),
      createMockMeta('other.zip', 999),
      createMockMeta('e2cal-backup-2026-11-27.zip', 300),
      createMockMeta('e2cal-backup-2026-11-25.zip', 200),
    ];

    const parsed = parseRollingBackupItems(mockState.remoteBackupFiles);
    expect(parsed.map((i) => i.date)).toEqual(['2026-11-27', '2026-11-25', '2026-11-24']);

    const listed = await listRollingBackups();
    expect(listed.map((i) => i.name)).toEqual([
      'e2cal-backup-2026-11-27.zip',
      'e2cal-backup-2026-11-25.zip',
      'e2cal-backup-2026-11-24.zip',
    ]);
  });

  it('downloadRollingBackupBlob 可下載既有檔案，找不到時拋錯', async () => {
    const blob = await downloadRollingBackupBlob('/backup/e2cal-backup-2026-11-27.zip');
    expect(blob.size).toBeGreaterThan(0);

    await expect(
      downloadRollingBackupBlob('/backup/e2cal-backup-missing.zip')
    ).rejects.toThrow('ROLLING_BACKUP_NOT_FOUND');
  });

  it('inspectCloudImportSources 應準確區分只有主同步、只有備份、兩者皆有與空目錄四種情境', async () => {
    const makeAdapter = (appFiles: RemoteFileMetadata[], backup: RemoteFileMetadata[]) => ({
      providerId: 'webdav' as const,
      isConnected: () => true,
      listRemoteFolder: vi.fn(async (folder = '') =>
        folder === '/backup' ? backup : folder === '/app' ? appFiles : [...appFiles, ...backup]
      ),
      downloadJsonFile: vi.fn(async () => null),
      uploadJsonFile: vi.fn(async () => 'rev'),
      deleteRemotePath: vi.fn(async () => undefined),
      disconnect: vi.fn(),
    });

    const primaryMeta: RemoteFileMetadata = {
      name: 'manifest.json',
      path_lower: '/app/manifest.json',
      path_display: '/app/manifest.json',
      id: 'm1',
      client_modified: '',
      server_modified: '',
      rev: 'r1',
      size: 120,
    };

    const backupOnly = await inspectCloudImportSources(
      makeAdapter([], [createMockMeta('e2cal-backup-2026-11-27.zip')])
    );
    expect(backupOnly.hasPrimarySync).toBe(false);
    expect(backupOnly.hasRollingBackup).toBe(true);
    expect(backupOnly.backupItems).toHaveLength(1);

    const primaryOnly = await inspectCloudImportSources(makeAdapter([primaryMeta], []));
    expect(primaryOnly.hasPrimarySync).toBe(true);
    expect(primaryOnly.hasRollingBackup).toBe(false);

    const both = await inspectCloudImportSources(
      makeAdapter([primaryMeta], [createMockMeta('e2cal-backup-2026-11-27.zip')])
    );
    expect(both.hasPrimarySync).toBe(true);
    expect(both.hasRollingBackup).toBe(true);

    const empty = await inspectCloudImportSources(makeAdapter([], []));
    expect(empty.hasPrimarySync).toBe(false);
    expect(empty.hasRollingBackup).toBe(false);
  });
});
