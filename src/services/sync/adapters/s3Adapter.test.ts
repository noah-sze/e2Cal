import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signS3Request } from './s3Signer';
import {
  s3Adapter,
  setS3Config,
  clearS3Config,
  setStagingS3Config,
  clearStagingS3Config,
  commitStagingS3Config,
  getS3Config,
  parseS3ListXml,
} from './s3Adapter';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
}

describe('s3Signer & s3Adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', createMemoryStorage());
    clearS3Config();
  });

  it('signS3Request 應生成符合 AWS SigV4 格式的 Authorization 標頭', async () => {
    const url = new URL('https://my-bucket.s3.us-east-1.amazonaws.com/?list-type=2&prefix=e2cal%2F');
    const headers = await signS3Request({
      method: 'GET',
      url,
      region: 'us-east-1',
      accessKeyId: 'AKIAEXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      now: new Date('2026-11-27T08:00:00Z'),
    });

    expect(headers['x-amz-date']).toBe('20261127T080000Z');
    expect(headers['x-amz-content-sha256']).toHaveLength(64);
    expect(headers.Authorization).toContain(
      'AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE/20261127/us-east-1/s3/aws4_request'
    );
    expect(headers.Authorization).toContain('SignedHeaders=host;x-amz-content-sha256;x-amz-date');
  });

  it('parseS3ListXml 應正確剝除 prefix 並解析 NextContinuationToken', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
        <IsTruncated>true</IsTruncated>
        <NextContinuationToken>token-page-2</NextContinuationToken>
        <Contents>
          <Key>e2cal/user/base_info.json</Key>
          <LastModified>2026-11-27T08:00:00.000Z</LastModified>
          <ETag>"etag-s3-1"</ETag>
          <Size>128</Size>
        </Contents>
      </ListBucketResult>`;

    const parsed = parseS3ListXml(xml, 'e2cal/');
    expect(parsed.nextToken).toBe('token-page-2');
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]).toMatchObject({
      name: 'base_info.json',
      path_lower: '/user/base_info.json',
      rev: '"etag-s3-1"',
      size: 128,
    });
  });

  it('s3Adapter 應支援自訂 Endpoint 與 Path-Style 請求', async () => {
    setS3Config({
      endpoint: 'https://r2.example.com',
      region: 'auto',
      bucket: 'fit-sync',
      accessKeyId: 'ak1',
      secretAccessKey: 'sk1',
      prefix: 'e2cal',
      forcePathStyle: true,
    });

    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      return new Response(null, { status: 200, headers: { ETag: '"r2-etag-1"' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const rev = await s3Adapter.uploadJsonFile('/user/base_info.json', { name: 'Noah' });
    expect(rev).toBe('"r2-etag-1"');
    const calledUrl = String(fetchMock.mock.calls[0]?.[0] ?? '');
    expect(calledUrl).toBe('https://r2.example.com/fit-sync/e2cal/user/base_info.json');
  });

  it('parseS3ListXml 應解碼 &quot; ETag 實體，且 uploadJsonFile 不應將 ts_* 佔位 rev 傳入 If-Match', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
        <IsTruncated>false</IsTruncated>
        <Contents>
          <Key>e2cal/manifest.json</Key>
          <LastModified>2026-11-28T03:00:00.000Z</LastModified>
          <ETag>&quot;abc123def456&quot;</ETag>
          <Size>256</Size>
        </Contents>
      </ListBucketResult>`;

    const parsed = parseS3ListXml(xml, 'e2cal/');
    expect(parsed.files[0]?.rev).toBe('"abc123def456"');

    setS3Config({
      endpoint: 'https://r2.example.com',
      region: 'auto',
      bucket: 'fit-sync',
      accessKeyId: 'ak1',
      secretAccessKey: 'sk1',
      prefix: 'e2cal',
      forcePathStyle: true,
    });

    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    // 1. ts_* 佔位 rev 不應送出 If-Match（避免 CORS 未暴露 ETag 時觸發 412）
    const fallbackRev = await s3Adapter.uploadJsonFile('/manifest.json', { ok: true }, 'ts_1700000000');
    expect(fallbackRev.startsWith('ts_')).toBe(true);
    const firstHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(firstHeaders['if-match']).toBeUndefined();

    // 2. 舊快取殘留的 &quot; ETag 應自動解碼為標準雙引號再送出 If-Match
    await s3Adapter.uploadJsonFile('/manifest.json', { ok: true }, '&quot;abc123def456&quot;');
    const secondHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(secondHeaders['if-match']).toBe('"abc123def456"');
  });

  it('Staging 暫存憑證不應寫入 localStorage 或使 isConnected() 為 true，僅 commit 後才持久化', async () => {
    clearStagingS3Config('primary');
    setStagingS3Config(
      {
        endpoint: 'https://r2.example.com',
        region: 'auto',
        bucket: 'fit-sync',
        accessKeyId: 'ak1',
        secretAccessKey: 'sk1',
      },
      'primary'
    );

    expect(s3Adapter.isConnected()).toBe(false);
    expect(getS3Config('primary')).toBeNull();

    const fetchMock = vi.fn(async () => new Response('<ListBucketResult></ListBucketResult>', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(s3Adapter.testConnection?.()).resolves.toBeUndefined();
    expect(s3Adapter.isConnected()).toBe(false);

    commitStagingS3Config('primary');
    expect(s3Adapter.isConnected()).toBe(true);
    expect(getS3Config('primary')?.bucket).toBe('fit-sync');
  });
});
