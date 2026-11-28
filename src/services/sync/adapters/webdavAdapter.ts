import { fetchWithTimeout } from '../dropboxClient';
import { assertSecureTransportUrl } from '../syncSchema';
import {
  normalizeSyncPath,
  stripLeadingSlash,
  runWithConcurrency,
  safeLocalStorage,
  extractXmlBlocks,
  extractXmlTagText,
  hasXmlTag,
  APP_SYNC_FOLDER,
  type RemoteFileMetadata,
  type SyncChannelScope,
  type SyncStorageAdapter,
} from '../syncAdapter';

const WEBDAV_CONFIG_KEY = 'e2cal_webdav_config';

function getWebDavConfigKey(scope: SyncChannelScope = 'primary'): string {
  return scope === 'backup' ? `${WEBDAV_CONFIG_KEY}_backup` : WEBDAV_CONFIG_KEY;
}

export interface WebDavConfig {
  baseUrl: string;
  username: string;
  password: string;
}

const KNOWN_SYNC_SUBDIRS = [
  '',
  '/database',
  '/logs',
] as const;

const ensuredDirsCache = new Set<string>();
const stagingWebDavConfigs: Partial<Record<SyncChannelScope, WebDavConfig>> = {};

function normalizeWebDavConfig(config: WebDavConfig): WebDavConfig {
  return {
    baseUrl: normalizeBaseUrl(config.baseUrl),
    username: config.username.trim(),
    password: config.password,
  };
}

export function setStagingWebDavConfig(
  config: WebDavConfig,
  scope: SyncChannelScope = 'primary'
): void {
  ensuredDirsCache.clear();
  stagingWebDavConfigs[scope] = normalizeWebDavConfig(config);
}

export function getStagingWebDavConfig(
  scope: SyncChannelScope = 'primary'
): WebDavConfig | null {
  return stagingWebDavConfigs[scope] ?? null;
}

export function clearStagingWebDavConfig(scope: SyncChannelScope = 'primary'): void {
  ensuredDirsCache.clear();
  delete stagingWebDavConfigs[scope];
}

export function commitStagingWebDavConfig(scope: SyncChannelScope = 'primary'): void {
  const staged = stagingWebDavConfigs[scope];
  if (!staged) return;
  setWebDavConfig(staged, scope);
  delete stagingWebDavConfigs[scope];
}

export function getWebDavConfig(scope: SyncChannelScope = 'primary'): WebDavConfig | null {
  const raw = safeLocalStorage.getItem(getWebDavConfigKey(scope));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WebDavConfig>;
    if (!parsed.baseUrl) return null;
    return {
      baseUrl: normalizeBaseUrl(parsed.baseUrl),
      username: parsed.username ?? '',
      password: parsed.password ?? '',
    };
  } catch {
    return null;
  }
}

export function setWebDavConfig(
  config: WebDavConfig,
  scope: SyncChannelScope = 'primary'
): void {
  ensuredDirsCache.clear();
  safeLocalStorage.setItem(
    getWebDavConfigKey(scope),
    JSON.stringify({
      baseUrl: normalizeBaseUrl(config.baseUrl),
      username: config.username.trim(),
      password: config.password,
    })
  );
}

export function clearWebDavConfig(scope: SyncChannelScope = 'primary'): void {
  ensuredDirsCache.clear();
  safeLocalStorage.removeItem(getWebDavConfigKey(scope));
}

function normalizeBaseUrl(url: string): string {
  const normalized = url.trim().replace(/\/+$/, '');
  assertSecureTransportUrl(normalized);
  return normalized;
}

function encodeBasicAuth(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `Basic ${btoa(binary)}`;
}

function buildTargetUrl(baseUrl: string, relPath: string): string {
  const cleanRel = stripLeadingSlash(relPath);
  if (!cleanRel) return `${baseUrl}/`;
  const encoded = cleanRel
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${baseUrl}/${encoded}`;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetchWithTimeout(url, options, 15000);
    if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
      attempt += 1;
      await new Promise((r) => setTimeout(r, 300 * attempt));
      continue;
    }
    return res;
  }
}

async function ensureDirExists(
  config: WebDavConfig,
  dirPath: string
): Promise<void> {
  const cleanDir = normalizeSyncPath(dirPath);
  if (!cleanDir) return;
  const cacheKey = `${config.baseUrl}|${cleanDir}`;
  if (ensuredDirsCache.has(cacheKey)) return;

  const segments = stripLeadingSlash(cleanDir).split('/').filter(Boolean);
  let current = '';
  for (const seg of segments) {
    current += `/${seg}`;
    const segCacheKey = `${config.baseUrl}|${current}`;
    if (ensuredDirsCache.has(segCacheKey)) continue;

    const url = `${buildTargetUrl(config.baseUrl, current).replace(/\/+$/, '')}/`;
    const res = await fetchWithRetry(url, {
      method: 'MKCOL',
      headers: {
        Authorization: encodeBasicAuth(config.username, config.password),
      },
    });

    // 200/201/204 為新建成功；405 代表目錄已存在，皆視為冪等成功
    if (res.ok || res.status === 405) {
      ensuredDirsCache.add(segCacheKey);
    } else if (res.status === 401 || res.status === 403) {
      throw new Error(`WebDAV MKCOL auth/permission error (${res.status})`);
    } else {
      throw new Error(`WebDAV MKCOL failed (${res.status}) for ${current}`);
    }
  }
}

/**
 * 解析 WebDAV PROPFIND (Depth: 1) 回傳的 XML，相容各家伺服器的 Namespace 前綴
 */
export function parsePropfindXml(
  xmlText: string,
  baseUrl: string,
  folderPath: string
): RemoteFileMetadata[] {
  const responses = extractXmlBlocks(xmlText, 'response');

  const basePath = new URL(baseUrl).pathname.replace(/\/+$/, '');
  const cleanFolder = normalizeSyncPath(folderPath);
  const fullFolderPath = `${basePath}${cleanFolder}`.replace(/\/+$/, '');

  const results: RemoteFileMetadata[] = [];

  for (const resp of responses) {
    let rawHref = extractXmlTagText(resp, 'href');
    if (!rawHref) continue;

    try {
      if (rawHref.startsWith('http://') || rawHref.startsWith('https://')) {
        rawHref = new URL(rawHref).pathname;
      }
      rawHref = decodeURIComponent(rawHref);
    } catch {
      // 保留原始路徑
    }

    const normalizedHref = rawHref.replace(/\/+$/, '');
    // 過濾目錄本身節點
    if (normalizedHref === fullFolderPath) continue;

    // 判斷是否為目錄（collection）
    if (hasXmlTag(resp, 'collection') || rawHref.endsWith('/')) continue;

    const relPath = normalizedHref.startsWith(basePath)
      ? normalizedHref.slice(basePath.length)
      : normalizedHref;
    const normRel = normalizeSyncPath(relPath);
    if (!normRel) continue;

    const etagText = extractXmlTagText(resp, 'getetag');
    const lastModText = extractXmlTagText(resp, 'getlastmodified');
    const lenText = extractXmlTagText(resp, 'getcontentlength');

    const name = normRel.split('/').pop() || '';
    const rev = etagText || `mtime_${lastModText || '0'}`;
    const size = Number(lenText || 0) || 0;

    results.push({
      name,
      path_lower: normRel.toLowerCase(),
      path_display: normRel,
      id: normRel,
      client_modified: lastModText,
      server_modified: lastModText,
      rev,
      size,
    });
  }

  return results;
}

async function listSingleWebDavDir(
  config: WebDavConfig,
  folderPath: string
): Promise<RemoteFileMetadata[]> {
  const url = `${buildTargetUrl(config.baseUrl, folderPath).replace(/\/+$/, '')}/`;
  const res = await fetchWithRetry(url, {
    method: 'PROPFIND',
    headers: {
      Authorization: encodeBasicAuth(config.username, config.password),
      Depth: '1',
      'Content-Type': 'application/xml; charset=utf-8',
    },
    body: '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/><d:getcontentlength/><d:getlastmodified/><d:resourcetype/></d:prop></d:propfind>',
  });

  if (res.status === 404) {
    return [];
  }
  if (!res.ok && res.status !== 207) {
    throw new Error(`WebDAV PROPFIND failed (${res.status}) for ${folderPath || '/'}`);
  }

  const xmlText = await res.text();
  return parsePropfindXml(xmlText, config.baseUrl, folderPath);
}

export function createWebDavAdapter(
  scope: SyncChannelScope = 'primary'
): SyncStorageAdapter {
  const requireConfig = (): WebDavConfig => {
    const config = stagingWebDavConfigs[scope] ?? getWebDavConfig(scope);
    if (!config) throw new Error('WebDAV not connected');
    return config;
  };

  return {
    providerId: 'webdav',

    isConnected: () => Boolean(getWebDavConfig(scope)),

    async listRemoteFolder(folderPath = ''): Promise<RemoteFileMetadata[]> {
      const config = requireConfig();

      const cleanFolder = normalizeSyncPath(folderPath);
      if (cleanFolder && cleanFolder.toLowerCase() !== APP_SYNC_FOLDER) {
        return await listSingleWebDavDir(config, cleanFolder);
      }

      // 全量掃描：若為 '/app' 或根目錄，依既定分桶目錄樹分批以 Depth: 1 查詢，相容禁止 Depth: infinity 的伺服器
      const basePrefix = cleanFolder.toLowerCase() === APP_SYNC_FOLDER ? APP_SYNC_FOLDER : '';
      const batches = await runWithConcurrency(KNOWN_SYNC_SUBDIRS, 3, (subDir) =>
        listSingleWebDavDir(config, `${basePrefix}${subDir}`)
      );
      const deduped = new Map<string, RemoteFileMetadata>();
      for (const items of batches) {
        for (const item of items) {
          deduped.set(item.path_lower, item);
        }
      }
      return Array.from(deduped.values());
    },

    async downloadJsonFile<T>(filePath: string): Promise<T | null> {
      const config = requireConfig();

      const url = buildTargetUrl(config.baseUrl, filePath);
      const res = await fetchWithRetry(url, {
        method: 'GET',
        headers: {
          Authorization: encodeBasicAuth(config.username, config.password),
        },
      });

      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`WebDAV download failed (${res.status}) for ${filePath}`);
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

      const cleanPath = normalizeSyncPath(filePath);
      const lastSlash = cleanPath.lastIndexOf('/');
      if (lastSlash > 0) {
        await ensureDirExists(config, cleanPath.slice(0, lastSlash));
      }

      const url = buildTargetUrl(config.baseUrl, cleanPath);
      const headers: Record<string, string> = {
        Authorization: encodeBasicAuth(config.username, config.password),
        'Content-Type': 'application/json; charset=utf-8',
      };
      if (expectedRev && !expectedRev.startsWith('mtime_')) {
        headers['If-Match'] = expectedRev;
      }

      const res = await fetchWithRetry(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });

      if (res.status === 412 || res.status === 409) {
        throw new Error(`WEBDAV_CONFLICT: File ${cleanPath} modified on remote (${res.status})`);
      }
      if (!res.ok) {
        throw new Error(`WebDAV upload failed (${res.status}) for ${cleanPath}`);
      }

      let newEtag = res.headers.get('ETag')?.trim();
      if (!newEtag) {
        const headRes = await fetchWithRetry(url, {
          method: 'HEAD',
          headers: {
            Authorization: encodeBasicAuth(config.username, config.password),
          },
        });
        if (headRes.ok) {
          newEtag = headRes.headers.get('ETag')?.trim() || undefined;
        }
      }

      return newEtag || `ts_${Date.now()}`;
    },

    async uploadBinaryFile(filePath: string, data: Blob | Uint8Array): Promise<string> {
      const config = requireConfig();

      const cleanPath = normalizeSyncPath(filePath);
      const lastSlash = cleanPath.lastIndexOf('/');
      if (lastSlash > 0) {
        await ensureDirExists(config, cleanPath.slice(0, lastSlash));
      }

      const url = buildTargetUrl(config.baseUrl, cleanPath);
      const bodyBuffer =
        data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : new Uint8Array(data);

      const res = await fetchWithRetry(url, {
        method: 'PUT',
        headers: {
          Authorization: encodeBasicAuth(config.username, config.password),
          'Content-Type': 'application/zip',
        },
        body: bodyBuffer.buffer,
      });

      if (!res.ok) {
        throw new Error(`WebDAV binary upload failed (${res.status}) for ${cleanPath}`);
      }

      return res.headers.get('ETag')?.trim() || `ts_${Date.now()}`;
    },

    async downloadBinaryFile(filePath: string): Promise<Blob | null> {
      const config = requireConfig();

      const url = buildTargetUrl(config.baseUrl, filePath);
      const res = await fetchWithRetry(url, {
        method: 'GET',
        headers: {
          Authorization: encodeBasicAuth(config.username, config.password),
        },
      });

      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`WebDAV binary download failed (${res.status}) for ${filePath}`);
      }
      return await res.blob();
    },

    async deleteRemotePath(path: string): Promise<void> {
      const config = requireConfig();

      const url = buildTargetUrl(config.baseUrl, path);
      const res = await fetchWithRetry(url, {
        method: 'DELETE',
        headers: {
          Authorization: encodeBasicAuth(config.username, config.password),
        },
      });

      if (res.status === 404) return;
      if (!res.ok) {
        throw new Error(`WebDAV delete failed (${res.status}) for ${path}`);
      }
    },

    async testConnection(): Promise<void> {
      const config = requireConfig();
      await listSingleWebDavDir(config, '');
    },

    disconnect(): void {
      clearWebDavConfig(scope);
    },
  };
}

export const webdavAdapter: SyncStorageAdapter = createWebDavAdapter('primary');
export const backupWebdavAdapter: SyncStorageAdapter = createWebDavAdapter('backup');
