import { describe, it, expect, vi, afterEach } from 'vitest';
import { forceRefreshApp, formatBuildTime } from './pwaRefresh';

describe('pwaRefresh', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('formatBuildTime', () => {
    it('formats a valid ISO string to local YYYY-MM-DD HH:mm', () => {
      const iso = '2026-11-26T06:30:00.000Z';
      const formatted = formatBuildTime(iso);
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it('returns "-" for invalid or empty strings', () => {
      expect(formatBuildTime('')).toBe('-');
      expect(formatBuildTime('not-a-date')).toBe('-');
    });
  });

  describe('forceRefreshApp', () => {
    it('returns "offline" without touching Service Worker, caches, or reloading when offline', async () => {
      const getRegistrations = vi.fn();
      const cachesKeys = vi.fn();
      const reload = vi.fn();

      vi.stubGlobal('navigator', {
        onLine: false,
        serviceWorker: { getRegistrations },
      });
      vi.stubGlobal('window', {
        caches: { keys: cachesKeys },
        location: { reload },
      });

      const result = await forceRefreshApp();

      expect(result).toBe('offline');
      expect(getRegistrations).not.toHaveBeenCalled();
      expect(cachesKeys).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
    });

    it('updates & unregisters SW, clears Cache Storage, and reloads when online', async () => {
      const update = vi.fn().mockResolvedValue(undefined);
      const unregister = vi.fn().mockResolvedValue(true);
      const getRegistrations = vi.fn().mockResolvedValue([{ update, unregister }]);
      const cachesKeys = vi.fn().mockResolvedValue(['workbox-precache-v2', 'runtime-cache']);
      const cachesDelete = vi.fn().mockResolvedValue(true);
      const reload = vi.fn();

      vi.stubGlobal('navigator', {
        onLine: true,
        serviceWorker: { getRegistrations },
      });
      vi.stubGlobal('window', {
        caches: { keys: cachesKeys, delete: cachesDelete },
        location: { reload },
      });

      const result = await forceRefreshApp();

      expect(result).toBe('reloading');
      expect(getRegistrations).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledTimes(1);
      expect(unregister).toHaveBeenCalledTimes(1);
      expect(cachesKeys).toHaveBeenCalledTimes(1);
      expect(cachesDelete).toHaveBeenCalledWith('workbox-precache-v2');
      expect(cachesDelete).toHaveBeenCalledWith('runtime-cache');
      expect(reload).toHaveBeenCalledTimes(1);
    });
  });
});
