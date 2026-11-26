/**
 * 安全強制刷新 PWA：僅在線上時更新並註銷 Service Worker、清理 Cache Storage 後重載，
 * 絕不觸碰 IndexedDB 與 localStorage。
 */
export async function forceRefreshApp(): Promise<'offline' | 'reloading'> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'offline';
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (reg) => {
          try {
            await reg.update();
          } catch {
            // 忽略單一 SW 更新失敗
          }
          try {
            await reg.unregister();
          } catch {
            // 忽略單一 SW 註銷失敗
          }
        })
      );
    } catch {
      // 忽略 SW API 例外
    }
  }

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    } catch {
      // 忽略 Cache Storage 例外
    }
  }

  if (typeof window !== 'undefined') {
    window.location.reload();
  }

  return 'reloading';
}

/**
 * 將建置 ISO 時間字串格式化為本地 YYYY-MM-DD HH:mm，無效值返回 '-'
 */
export function formatBuildTime(iso: string): string {
  if (!iso || typeof iso !== 'string') return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';

  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
