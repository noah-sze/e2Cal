import { fetchWithTimeout } from '../dropboxClient';
import { assertSecureTransportUrl } from '../syncSchema';
import {
  normalizeSyncPath,
  stripLeadingSlash,
  safeLocalStorage,
  extractXmlBlocks,
  extractXmlTagText,
  type RemoteFileMetadata,
  type SyncChannelScope,
  type SyncStorageAdapter,
} from '../syncAdapter';
import { signS3Request } from './s3Signer';

const S3_CONFIG_KEY = 'e2cal_s3_config';

function getS3ConfigKey(scope: SyncChannelScope = 'primary'): string {
  return scope === 'backup' ? `${S3_CONFIG_KEY}_backup` : S3_CONFIG_KEY;
}

export interface S3Config {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix?: string;
  forcePathStyle?: boolean;
}

const stagingS3Configs: Partial<Record<SyncChannelScope, S3Config>> = {};

function normalizeS3Config(config: S3Config): S3Config {
  return {
    endpoint: config.endpoint?.trim().replace(/\/+$/, '') || undefined,
    region: config.region.trim() || 'us-east-1',
    bucket: config.bucket.trim(),
    accessKeyId: config.accessKeyId.trim(),
    secretAccessKey: config.secretAccessKey,
    prefix: normalizePrefix(config.prefix),
    forcePathStyle: Boolean(config.forcePathStyle),
  };
}

export function setStagingS3Config(
  config: S3Config,
  scope: SyncChannelScope = 'primary'
): void {
  stagingS3Configs[scope] = normalizeS3Config(config);
}

export function getStagingS3Config(scope: SyncChannelScope = 'primary'): S3Config | null {
  return stagingS3Configs[scope] ?? null;
}

export function clearStagingS3Config(scope: SyncChannelScope = 'primary'): void {
  delete stagingS3Configs[scope];
}

export function commitStagingS3Config(scope: SyncChannelScope = 'primary'): void {
  const staged = stagingS3Configs[scope];
  if (!staged) return;
  setS3Config(staged, scope);
  delete stagingS3Configs[scope];
}

export function getS3Config(scope: SyncChannelScope = 'primary'): S3Config | null {
  const raw = safeLocalStorage.getItem(getS3ConfigKey(scope));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<S3Config>;
    if (!parsed.bucket || !parsed.accessKeyId || !parsed.secretAccessKey) {
      return null;
    }
    return {
      endpoint: parsed.endpoint?.trim().replace(/\/+$/, '') || undefined,
      region: parsed.region?.trim() || 'us-east-1',
      bucket: parsed.bucket.trim(),
      accessKeyId: parsed.accessKeyId.trim(),
      secretAccessKey: parsed.secretAccessKey,
      prefix: normalizePrefix(parsed.prefix),
      forcePathStyle: Boolean(parsed.forcePathStyle),
    };
  } catch {
    return null;
  }
}

export function setS3Config(
  config: S3Config,
  scope: SyncChannelScope = 'primary'
): void {
  safeLocalStorage.setItem(
    getS3ConfigKey(scope),
    JSON.stringify({
      endpoint: config.endpoint?.trim().replace(/\/+$/, '') || '',
      region: config.region.trim() || 'us-east-1',
      bucket: config.bucket.trim(),
      accessKeyId: config.accessKeyId.trim(),
      secretAccessKey: config.secretAccessKey,
      prefix: normalizePrefix(config.prefix),
      forcePathStyle: Boolean(config.forcePathStyle),
    })
  );
}

export function clearS3Config(scope: SyncChannelScope = 'primary'): void {
  safeLocalStorage.removeItem(getS3ConfigKey(scope));
}

function normalizePrefix(prefix?: string): string {
  const cleaned = (prefix || 'e2cal').replace(/^\/+|\/+$/g, '').trim();
  return cleaned ? `${cleaned}/` : '';
}

function buildS3Url(config: S3Config, objectKey = ''): URL {
  const cleanKey = objectKey.replace(/^\/+/, '');
  const baseEndpoint = config.endpoint
    ? config.endpoint.replace(/\/+$/, '')
    : `https://s3.${config.region}.amazonaws.com`;
  assertSecureTransportUrl(baseEndpoint);
  const parsed = new URL(baseEndpoint);

  if (config.forcePathStyle) {
    const basePath = parsed.pathname.replace(/\/+$/, '');
    parsed.pathname = cleanKey
      ? `${basePath}/${config.bucket}/${cleanKey}`
      : `${basePath}/${config.bucket}`;
    return parsed;
  }

  parsed.hostname = `${config.bucket}.${parsed.hostname}`;
  const basePath = parsed.pathname.replace(/\/+$/, '');
  parsed.pathname = cleanKey ? `${basePath}/${cleanKey}` : basePath || '/';
  return parsed;
}

function buildFullObjectKey(config: S3Config, filePath: string): string {
  const prefix = normalizePrefix(config.prefix);
  const rel = stripLeadingSlash(filePath);
  return `${prefix}${rel}`;
}

export function parseS3ListXml(
  xmlText: string,
  prefix: string
): { files: RemoteFileMetadata[]; nextToken?: string } {
  const contents = extractXmlBlocks(xmlText, 'Contents');
  const isTruncated = extractXmlTagText(xmlText, 'IsTruncated') === 'true';
  const nextToken = extractXmlTagText(xmlText, 'NextContinuationToken') || undefined;

  const files: RemoteFileMetadata[] = [];
  for (const node of contents) {
    const rawKey = extractXmlTagText(node, 'Key');
    if (!rawKey || rawKey.endsWith('/')) continue;

    const relKey = prefix && rawKey.startsWith(prefix) ? rawKey.slice(prefix.length) : rawKey;
    const normPath = normalizeSyncPath(relKey);
    if (!normPath) continue;

    const etag = extractXmlTagText(node, 'ETag') || rawKey;
    const lastMod = extractXmlTagText(node, 'LastModified');
    const size = Number(extractXmlTagText(node, 'Size') || 0) || 0;

    files.push({
      name: normPath.split('/').pop() || '',
      path_lower: normPath.toLowerCase(),
      path_display: normPath,
      id: rawKey,
      client_modified: lastMod,
      server_modified: lastMod,
      rev: etag,
      size,
    });
  }

  return { files, nextToken: isTruncated ? nextToken : undefined };
}

async function listWithMaxKeys(
  config: S3Config,
  folderPath = '',
  maxKeys?: number
): Promise<RemoteFileMetadata[]> {
  const basePrefix = normalizePrefix(config.prefix);
  const sub = stripLeadingSlash(folderPath);
  const queryPrefix = sub ? `${basePrefix}${sub.replace(/\/+$/, '')}/` : basePrefix;

  const allFiles: RemoteFileMetadata[] = [];
  let continuationToken: string | undefined;

  do {
    const url = buildS3Url(config);
    url.searchParams.set('list-type', '2');
    if (queryPrefix) url.searchParams.set('prefix', queryPrefix);
    if (maxKeys) url.searchParams.set('max-keys', String(maxKeys));
    if (continuationToken) url.searchParams.set('continuation-token', continuationToken);

    const headers = await signS3Request({
      method: 'GET',
      url,
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    });

    const res = await fetchWithTimeout(url.toString(), { method: 'GET', headers }, 15000);
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`S3 ListObjectsV2 failed (${res.status}): ${errBody.slice(0, 200)}`);
    }

    const parsed = parseS3ListXml(await res.text(), basePrefix);
    allFiles.push(...parsed.files);
    continuationToken = maxKeys ? undefined : parsed.nextToken;
  } while (continuationToken);

  return allFiles;
}

export function createS3Adapter(
  scope: SyncChannelScope = 'primary'
): SyncStorageAdapter {
  const requireConfig = (): S3Config => {
    const config = stagingS3Configs[scope] ?? getS3Config(scope);
    if (!config) throw new Error('S3 not connected');
    return config;
  };

  return {
    providerId: 's3',

    isConnected: () => Boolean(getS3Config(scope)),

    async listRemoteFolder(folderPath = ''): Promise<RemoteFileMetadata[]> {
      const config = requireConfig();
      return await listWithMaxKeys(config, folderPath);
    },

    async downloadJsonFile<T>(filePath: string): Promise<T | null> {
      const config = requireConfig();

      const objectKey = buildFullObjectKey(config, filePath);
      const url = buildS3Url(config, objectKey);
      const headers = await signS3Request({
        method: 'GET',
        url,
        region: config.region,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      });

      const res = await fetchWithTimeout(url.toString(), { method: 'GET', headers }, 15000);
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`S3 download failed (${res.status}) for ${filePath}`);
      }

      const text = await res.text();
      if (!text.trim()) return null;
      return JSON.parse(text) as T;
    },

    async uploadJsonFile<T>(
      filePath: string,
      data: T,
      expectedRev?: string
    ): Promise<string> {
      const config = requireConfig();

      const objectKey = buildFullObjectKey(config, filePath);
      const url = buildS3Url(config, objectKey);
      const body = JSON.stringify(data);
      const extraHeaders: Record<string, string> = {
        'content-type': 'application/json; charset=utf-8',
      };
      if (expectedRev && !expectedRev.startsWith('ts_') && expectedRev !== objectKey) {
        extraHeaders['if-match'] = expectedRev.replace(/&quot;|&#34;/g, '"');
      }

      const headers = await signS3Request({
        method: 'PUT',
        url,
        region: config.region,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        body,
        extraHeaders,
      });

      const res = await fetchWithTimeout(
        url.toString(),
        { method: 'PUT', headers, body },
        15000
      );

      if (res.status === 412 || res.status === 409) {
        throw new Error(`S3_CONFLICT: Object ${filePath} modified on remote (${res.status})`);
      }
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`S3 upload failed (${res.status}): ${errBody.slice(0, 200)}`);
      }

      return res.headers.get('ETag')?.trim() || `ts_${Date.now()}`;
    },

    async uploadBinaryFile(filePath: string, data: Blob | Uint8Array): Promise<string> {
      const config = requireConfig();

      const objectKey = buildFullObjectKey(config, filePath);
      const url = buildS3Url(config, objectKey);
      const bodyBytes =
        data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : new Uint8Array(data);

      const headers = await signS3Request({
        method: 'PUT',
        url,
        region: config.region,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        body: bodyBytes,
        extraHeaders: {
          'content-type': 'application/zip',
        },
      });

      const res = await fetchWithTimeout(
        url.toString(),
        { method: 'PUT', headers, body: bodyBytes.buffer },
        20000
      );

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`S3 binary upload failed (${res.status}): ${errBody.slice(0, 200)}`);
      }

      return res.headers.get('ETag')?.trim() || `ts_${Date.now()}`;
    },

    async downloadBinaryFile(filePath: string): Promise<Blob | null> {
      const config = requireConfig();

      const objectKey = buildFullObjectKey(config, filePath);
      const url = buildS3Url(config, objectKey);
      const headers = await signS3Request({
        method: 'GET',
        url,
        region: config.region,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      });

      const res = await fetchWithTimeout(url.toString(), { method: 'GET', headers }, 20000);
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`S3 binary download failed (${res.status}) for ${filePath}`);
      }
      return await res.blob();
    },

    async deleteRemotePath(path: string): Promise<void> {
      const config = requireConfig();

      const objectKey = buildFullObjectKey(config, path);
      const url = buildS3Url(config, objectKey);
      const headers = await signS3Request({
        method: 'DELETE',
        url,
        region: config.region,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      });

      const res = await fetchWithTimeout(url.toString(), { method: 'DELETE', headers }, 15000);
      if (res.status === 404 || res.status === 204 || res.ok) return;
      throw new Error(`S3 delete failed (${res.status}) for ${path}`);
    },

    async testConnection(): Promise<void> {
      const config = requireConfig();
      await listWithMaxKeys(config, '', 1);
    },

    disconnect(): void {
      clearS3Config(scope);
    },
  };
}

export const s3Adapter: SyncStorageAdapter = createS3Adapter('primary');
export const backupS3Adapter: SyncStorageAdapter = createS3Adapter('backup');
