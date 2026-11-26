export interface InMemoryCache<T> {
  get: () => T[] | null;
  set: (items: T[]) => void;
  clear: () => void;
  prewarm: () => Promise<T[]>;
}

/**
 * 建立模組級記憶體注水快取 (In-Memory Hydration Cache)，
 * 解決彈窗與組件掛載時等待 IndexedDB 異步查詢造成的閃爍，實現第 0 幀滿數據同步秒開。
 */
export function createInMemoryCache<T>(fetcher: () => Promise<T[]>): InMemoryCache<T> {
  let cache: T[] | null = null;

  return {
    get: () => cache,
    set: (items: T[]) => {
      cache = items;
    },
    clear: () => {
      cache = null;
    },
    prewarm: async () => {
      if (cache !== null) return cache;
      try {
        if (typeof indexedDB === 'undefined') return [];
        const items = await fetcher();
        cache = items;
        return items;
      } catch {
        return [];
      }
    },
  };
}
