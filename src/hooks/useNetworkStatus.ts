import { useState, useEffect } from 'react';

// 全域單例狀態，確保跨頁面與多個 Hook 間的網路狀態嚴格同步
let globalIsOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
const listeners = new Set<(online: boolean) => void>();

function notifyListeners(online: boolean) {
  if (globalIsOnline !== online) {
    globalIsOnline = online;
    listeners.forEach((listener) => listener(online));
  }
}

/** 取得目前全域網路在線狀態（同步讀取最新單例值） */
export function getNetworkStatus(): boolean {
  return globalIsOnline;
}

/** 由真實業務請求成功呼叫：當裝置處於聯網介面時，立即恢復在線狀態 */
export function reportNetworkSuccess(): void {
  const browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (browserOnline) {
    notifyListeners(true);
  }
}

/** 由真實業務請求遇到網路層失敗時呼叫：降級為離線狀態 */
export function reportNetworkError(): void {
  notifyListeners(false);
}

/**
 * 檢查裝置聯網狀態（純本地訊號，不依賴部署源站 `_ping`）
 * 確保 PWA 離線於部署伺服器時，只要設備本身有網路即可正常與 Dropbox／AI 通訊
 */
export async function checkConnectivity(): Promise<boolean> {
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  notifyListeners(online);
  return online;
}

/**
 * 監聽瀏覽器全域網路在線/離線狀態（純本地事件 + 真實請求回饋修正）
 */
export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(globalIsOnline);

  useEffect(() => {
    listeners.add(setIsOnline);

    const handleOnline = () => {
      notifyListeners(true);
    };

    const handleOffline = () => {
      notifyListeners(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && typeof navigator !== 'undefined') {
        notifyListeners(navigator.onLine);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      listeners.delete(setIsOnline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isOnline;
}
