import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { setWebDavConfig } from './adapters/webdavAdapter';
import { setS3Config } from './adapters/s3Adapter';
import { setStoredTokens } from './dropboxAuth';
import {
  setActiveSyncProviderId,
  setBackupProviderId,
  isSameWebDavAccount,
  isSameS3Account,
  isSameDropboxAccount,
  checkWebDavAccountConflict,
  checkS3AccountConflict,
  checkDropboxAccountConflict,
  hasOppositeProviderConnected,
} from './syncRouter';

describe('syncAccountConflict (雙通道禁止同帳戶隔離)', () => {
  beforeEach(() => {
    memoryStorage.clear();
  });

  it('isSameWebDavAccount 應嚴格比對主機 origin 與 username，忽略子路徑差異', () => {
    expect(
      isSameWebDavAccount(
        { baseUrl: 'https://nas.example.com/dav/sync', username: 'Noah', password: 'a' },
        { baseUrl: 'https://nas.example.com/dav/backup/', username: 'noah', password: 'b' }
      )
    ).toBe(true);

    expect(
      isSameWebDavAccount(
        { baseUrl: 'https://nas.example.com/dav', username: 'user1', password: 'a' },
        { baseUrl: 'https://nas.example.com/dav', username: 'user2', password: 'a' }
      )
    ).toBe(false);
  });

  it('isSameS3Account 應嚴格比對 endpoint 與 accessKeyId，忽略 bucket/prefix 差異', () => {
    expect(
      isSameS3Account(
        {
          endpoint: 'https://r2.example.com/',
          region: 'auto',
          bucket: 'bucket-sync',
          accessKeyId: 'AKIA_SAME',
          secretAccessKey: 'sec1',
          prefix: 'sync',
        },
        {
          endpoint: 'https://r2.example.com',
          region: 'auto',
          bucket: 'bucket-backup',
          accessKeyId: 'AKIA_SAME',
          secretAccessKey: 'sec2',
          prefix: 'backup',
        }
      )
    ).toBe(true);

    expect(
      isSameS3Account(
        {
          region: 'us-east-1',
          bucket: 'same-bucket',
          accessKeyId: 'AKIA_1',
          secretAccessKey: 'sec1',
        },
        {
          region: 'us-east-1',
          bucket: 'same-bucket',
          accessKeyId: 'AKIA_2',
          secretAccessKey: 'sec2',
        }
      )
    ).toBe(false);
  });

  it('isSameDropboxAccount 比對非空 account_id', () => {
    expect(isSameDropboxAccount('dbid:123', 'dbid:123')).toBe(true);
    expect(isSameDropboxAccount('dbid:123', 'dbid:456')).toBe(false);
    expect(isSameDropboxAccount(undefined, 'dbid:123')).toBe(false);
  });

  it('WebDAV 與 S3 應支援雙向帳號衝突偵測', () => {
    setActiveSyncProviderId('webdav');
    setWebDavConfig(
      { baseUrl: 'https://nas.example.com/sync', username: 'alice', password: '123' },
      'primary'
    );

    expect(hasOppositeProviderConnected('webdav', 'backup')).toBe(true);
    expect(hasOppositeProviderConnected('s3', 'backup')).toBe(false);

    expect(
      checkWebDavAccountConflict(
        { baseUrl: 'https://nas.example.com/backup', username: 'alice', password: '456' },
        'backup'
      )
    ).toBe(true);

    expect(
      checkWebDavAccountConflict(
        { baseUrl: 'https://nas.example.com/backup', username: 'bob', password: '456' },
        'backup'
      )
    ).toBe(false);

    // 反向：備份端先連 S3，主同步欲連同一 S3 帳號也應被攔截
    setBackupProviderId('s3');
    setS3Config(
      {
        endpoint: 'https://s3.custom.dev',
        region: 'auto',
        bucket: 'b1',
        accessKeyId: 'KEY_A',
        secretAccessKey: 'SEC_A',
      },
      'backup'
    );

    expect(
      checkS3AccountConflict(
        {
          endpoint: 'https://s3.custom.dev/',
          region: 'auto',
          bucket: 'b2',
          accessKeyId: 'KEY_A',
          secretAccessKey: 'SEC_B',
        },
        'primary'
      )
    ).toBe(true);
  });

  it('Dropbox 應支援雙向 account_id 衝突偵測', () => {
    setActiveSyncProviderId('dropbox');
    setStoredTokens(
      {
        access_token: 'tok',
        expires_in: 3600,
        expires_at: Date.now() + 3600_000,
        account_id: 'dbid:PRIMARY',
      },
      'primary'
    );

    expect(checkDropboxAccountConflict('dbid:PRIMARY', 'backup')).toBe(true);
    expect(checkDropboxAccountConflict('dbid:OTHER', 'backup')).toBe(false);
  });
});
