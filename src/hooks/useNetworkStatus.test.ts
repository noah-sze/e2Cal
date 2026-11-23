import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkConnectivity,
  getNetworkStatus,
  isDeviceOffline,
  reportNetworkError,
  reportNetworkSuccess,
} from './useNetworkStatus';

describe('useNetworkStatus', () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
  });

  it('should not fetch origin _ping and should return true when navigator.onLine is true', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      configurable: true,
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const online = await checkConnectivity();
    expect(online).toBe(true);
    expect(getNetworkStatus()).toBe(true);
    expect(isDeviceOffline()).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should return false when navigator.onLine is false', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      configurable: true,
    });

    const online = await checkConnectivity();
    expect(online).toBe(false);
    expect(getNetworkStatus()).toBe(false);
    expect(isDeviceOffline()).toBe(true);
  });

  it('should transition to offline on reportNetworkError and recover on reportNetworkSuccess when browser is online', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      configurable: true,
    });
    await checkConnectivity();
    expect(getNetworkStatus()).toBe(true);

    reportNetworkError();
    expect(getNetworkStatus()).toBe(false);

    reportNetworkSuccess();
    expect(getNetworkStatus()).toBe(true);
  });

  it('should stay offline on reportNetworkSuccess if navigator.onLine is false', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      configurable: true,
    });
    await checkConnectivity();
    expect(getNetworkStatus()).toBe(false);

    reportNetworkSuccess();
    expect(getNetworkStatus()).toBe(false);
  });
});
