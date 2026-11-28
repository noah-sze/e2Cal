import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  webdavAdapter,
  setWebDavConfig,
  clearWebDavConfig,
  setStagingWebDavConfig,
  clearStagingWebDavConfig,
  commitStagingWebDavConfig,
  getWebDavConfig,
  parsePropfindXml,
} from './webdavAdapter';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
}

describe('webdavAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', createMemoryStorage());
    clearWebDavConfig();
  });

  it('parsePropfindXml 應正確解析不同 Namespace 前綴並過濾目錄節點', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <D:multistatus xmlns:D="DAV:">
        <D:response>
          <D:href>/dav/e2cal/nutrition/logs/</D:href>
          <D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop></D:propstat>
        </D:response>
        <D:response>
          <D:href>/dav/e2cal/nutrition/logs/2026-11-27.json</D:href>
          <D:propstat>
            <D:prop>
              <D:getetag>"abc-123"</D:getetag>
              <D:getcontentlength>512</D:getcontentlength>
              <D:getlastmodified>Fri, 27 Nov 2026 09:00:00 GMT</D:getlastmodified>
            </D:prop>
          </D:propstat>
        </D:response>
      </D:multistatus>`;

    const files = parsePropfindXml(
      xml,
      'https://nas.example.com/dav/e2cal',
      '/nutrition/logs'
    );
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      name: '2026-11-27.json',
      path_lower: '/nutrition/logs/2026-11-27.json',
      rev: '"abc-123"',
      size: 512,
    });
  });

  it('uploadJsonFile 應逐層 MKCOL（405 視為已存在）並在缺少 ETag 時補發 HEAD', async () => {
    setWebDavConfig({
      baseUrl: 'https://nas.example.com/dav',
      username: 'u1',
      password: 'p1',
    });

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method || 'GET';
      if (method === 'MKCOL') {
        return new Response(null, { status: url.endsWith('/nutrition/') ? 405 : 201 });
      }
      if (method === 'PUT') {
        return new Response(null, { status: 201 });
      }
      if (method === 'HEAD') {
        return new Response(null, { status: 200, headers: { ETag: '"etag-99"' } });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const rev = await webdavAdapter.uploadJsonFile('/nutrition/logs/2026-11-27.json', { ok: true });
    expect(rev).toBe('"etag-99"');
    const methods = fetchMock.mock.calls.map((c) => c[1]?.method);
    expect(methods).toEqual(['MKCOL', 'MKCOL', 'PUT', 'HEAD']);
  });

  it('uploadJsonFile 收到 412 Precondition Failed 應拋出衝突錯誤', async () => {
    setWebDavConfig({
      baseUrl: 'https://nas.example.com/dav',
      username: 'u1',
      password: 'p1',
    });

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'MKCOL') return new Response(null, { status: 405 });
      if (init?.method === 'PUT') return new Response(null, { status: 412 });
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      webdavAdapter.uploadJsonFile('/user/base_info.json', { name: 'A' }, '"old-etag"')
    ).rejects.toThrow('WEBDAV_CONFLICT');
  });

  it('Staging 暫存憑證不應寫入 localStorage 或使 isConnected() 為 true，僅 commit 後才持久化', async () => {
    clearStagingWebDavConfig('primary');
    setStagingWebDavConfig(
      { baseUrl: 'https://nas.example.com/dav', username: 'u1', password: 'p1' },
      'primary'
    );

    expect(webdavAdapter.isConnected()).toBe(false);
    expect(getWebDavConfig('primary')).toBeNull();

    const fetchMock = vi.fn(async () => new Response('<D:multistatus xmlns:D="DAV:"/>', { status: 207 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(webdavAdapter.testConnection?.()).resolves.toBeUndefined();
    expect(webdavAdapter.isConnected()).toBe(false);

    commitStagingWebDavConfig('primary');
    expect(webdavAdapter.isConnected()).toBe(true);
    expect(getWebDavConfig('primary')?.username).toBe('u1');
  });
});
