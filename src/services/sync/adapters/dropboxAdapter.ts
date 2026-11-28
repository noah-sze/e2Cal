import type { SyncChannelScope, SyncStorageAdapter } from '../syncAdapter';
import {
  listRemoteFolder,
  downloadJsonFile,
  uploadJsonFile,
  uploadBinaryFile,
  downloadBinaryFile,
  deleteRemotePath,
} from '../dropboxClient';
import { isDropboxConnected, clearDropboxTokens } from '../dropboxAuth';

/**
 * 建立指定通道用途的 Dropbox 適配器（'primary' 為主同步，'backup' 為每日滾動備份）
 */
export function createDropboxAdapter(
  scope: SyncChannelScope = 'primary'
): SyncStorageAdapter {
  return {
    providerId: 'dropbox',
    isConnected: () => isDropboxConnected(scope),
    listRemoteFolder: (folderPath = '') => listRemoteFolder(folderPath, scope),
    downloadJsonFile: <T>(filePath: string) => downloadJsonFile<T>(filePath, scope),
    uploadJsonFile: <T>(filePath: string, data: T, expectedRev?: string) =>
      uploadJsonFile<T>(filePath, data, expectedRev, scope),
    uploadBinaryFile: (filePath: string, data: Blob | Uint8Array) =>
      uploadBinaryFile(filePath, data, scope),
    downloadBinaryFile: (filePath: string) => downloadBinaryFile(filePath, scope),
    deleteRemotePath: (path: string) => deleteRemotePath(path, scope),
    disconnect: () => {
      clearDropboxTokens(scope);
    },
  };
}

/**
 * Dropbox 雲端同步適配器（包裝既有 dropboxClient 與 dropboxAuth，維持 100% 向下相容）
 */
export const dropboxAdapter: SyncStorageAdapter = createDropboxAdapter('primary');
export const backupDropboxAdapter: SyncStorageAdapter = createDropboxAdapter('backup');
