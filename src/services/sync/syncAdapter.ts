export type SyncProviderId = 'dropbox' | 'webdav' | 's3';
export type SyncChannelScope = 'primary' | 'backup';

export const APP_SYNC_FOLDER = '/app';

export interface RemoteFileMetadata {
  name: string;
  path_lower: string;
  path_display: string;
  id: string;
  client_modified: string;
  server_modified: string;
  rev: string;
  size: number;
}

export interface SyncStorageAdapter {
  readonly providerId: SyncProviderId;
  isConnected(): boolean;
  listRemoteFolder(folderPath?: string): Promise<RemoteFileMetadata[]>;
  downloadJsonFile<T>(filePath: string): Promise<T | null>;
  uploadJsonFile<T>(filePath: string, data: T, expectedRev?: string): Promise<string>;
  uploadBinaryFile?(filePath: string, data: Blob | Uint8Array): Promise<string>;
  downloadBinaryFile?(filePath: string): Promise<Blob | null>;
  deleteRemotePath(path: string): Promise<void>;
  testConnection?(): Promise<void>;
  disconnect(): void;
}

/**
 * 將遠端同步路徑正規化為前導斜線格式（例如 '/user/base_info.json'）
 */
export function normalizeSyncPath(filePath: string): string {
  const cleaned = filePath.replace(/\\/g, '/').replace(/\/+/g, '/').trim();
  if (!cleaned || cleaned === '/') return '';
  const withLeading = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  return withLeading.length > 1 && withLeading.endsWith('/')
    ? withLeading.slice(0, -1)
    : withLeading;
}

/**
 * 將遠端路徑去除前導斜線（供 S3 Key / WebDAV 相對路徑 / OneDrive Graph 使用）
 */
export function stripLeadingSlash(filePath: string): string {
  return normalizeSyncPath(filePath).replace(/^\/+/, '');
}

/**
 * 有限併發執行池（防止 WebDAV / Graph API 短時間高併發觸發 429 限流）
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workerCount = Math.min(Math.max(1, limit), items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex++;
        results[currentIndex] = await worker(items[currentIndex]);
      }
    })
  );

  return results;
}

/**
 * 安全的瀏覽器 localStorage 讀寫工具
 */
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch {
      // 忽略無痕模式或空間限制錯誤
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch {
      // 忽略存取錯誤
    }
  },
};

/**
 * 輕量純字串 XML 區塊提取（相容任意 Namespace 前綴，零 DOMParser / jsdom 依賴）
 */
export function extractXmlBlocks(xml: string, localTag: string): string[] {
  const re = new RegExp(
    `<(?:[a-zA-Z0-9_-]+:)?${localTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${localTag}>`,
    'gi'
  );
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * 提取 XML 區塊內指定標籤的純文字內容（相容任意 Namespace 前綴並解碼基本 XML 實體）
 */
export function extractXmlTagText(xmlBlock: string, localTag: string): string {
  const re = new RegExp(
    `<(?:[a-zA-Z0-9_-]+:)?${localTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${localTag}>`,
    'i'
  );
  const match = re.exec(xmlBlock);
  return match ? decodeXmlEntities(match[1].trim()) : '';
}

/**
 * 檢查 XML 區塊內是否包含指定自閉合或成對標籤（例如 <D:collection/>）
 */
export function hasXmlTag(xmlBlock: string, localTag: string): boolean {
  const re = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${localTag}(?:\\s[^>]*)?\\/?>`, 'i');
  return re.test(xmlBlock);
}

/**
 * 將同步適配器包裝為限定於指定根目錄前綴（例如 '/app'）之隔離視圖：
 * - 所有讀寫、刪除與列舉路徑自動加上 basePath 前綴
 * - listRemoteFolder 回傳中繼資料僅保留 basePath 內的項目，並剝除 basePath 前綴供上層引擎統一處理
 */
export function withSyncBasePath(
  adapter: SyncStorageAdapter,
  basePath: string
): SyncStorageAdapter {
  const cleanBase = normalizeSyncPath(basePath);
  if (!cleanBase) return adapter;
  const lowerBase = cleanBase.toLowerCase();

  const prefixPath = (filePath: string): string => {
    const clean = normalizeSyncPath(filePath);
    if (!clean) return cleanBase;
    const lower = clean.toLowerCase();
    if (lower === lowerBase || lower.startsWith(`${lowerBase}/`)) {
      return clean;
    }
    return `${cleanBase}${clean}`;
  };

  const stripBaseFromMeta = (meta: RemoteFileMetadata): RemoteFileMetadata | null => {
    const normLower = normalizeSyncPath(meta.path_lower).toLowerCase();
    if (!normLower.startsWith(`${lowerBase}/`)) {
      return null;
    }
    const strippedLower = normLower.slice(lowerBase.length) || '/';
    const normDisplay = normalizeSyncPath(meta.path_display || meta.path_lower);
    const strippedDisplay = normDisplay.toLowerCase().startsWith(`${lowerBase}/`)
      ? normDisplay.slice(cleanBase.length) || '/'
      : strippedLower;

    return {
      ...meta,
      path_lower: strippedLower,
      path_display: strippedDisplay,
    };
  };

  return {
    providerId: adapter.providerId,
    isConnected: () => adapter.isConnected(),
    async listRemoteFolder(folderPath = ''): Promise<RemoteFileMetadata[]> {
      const target = prefixPath(folderPath);
      const items = await adapter.listRemoteFolder(target);
      const mapped: RemoteFileMetadata[] = [];
      for (const item of items) {
        const stripped = stripBaseFromMeta(item);
        if (stripped) mapped.push(stripped);
      }
      return mapped;
    },
    downloadJsonFile: <T>(filePath: string) =>
      adapter.downloadJsonFile<T>(prefixPath(filePath)),
    uploadJsonFile: <T>(filePath: string, data: T, expectedRev?: string) =>
      adapter.uploadJsonFile<T>(prefixPath(filePath), data, expectedRev),
    uploadBinaryFile: adapter.uploadBinaryFile
      ? (filePath: string, data: Blob | Uint8Array) =>
          adapter.uploadBinaryFile!(prefixPath(filePath), data)
      : undefined,
    downloadBinaryFile: adapter.downloadBinaryFile
      ? (filePath: string) => adapter.downloadBinaryFile!(prefixPath(filePath))
      : undefined,
    deleteRemotePath: (path: string) => adapter.deleteRemotePath(prefixPath(path)),
    testConnection: adapter.testConnection ? () => adapter.testConnection!() : undefined,
    disconnect: () => adapter.disconnect(),
  };
}
