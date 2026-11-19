export type UiScale = 'compact' | 'default' | 'large';

export const UI_SCALE_STORAGE_KEY = 'e2cal-ui-scale';
export const UI_SCALE_CHANGE_EVENT = 'e2cal:ui-scale-change';

/**
 * Apple HIG 跨端自適應字級階梯映射
 * - 行動端 (< 768px)：採用 iOS HIG 標準（預設 17px Body，防止 Safari 聚焦放大）
 * - 桌面端 (>= 768px)：採用 macOS HIG 標準（預設 14px Body，保持高密度與緊湊測量儀質感）
 */
export const UI_SCALE_CONFIG: Record<UiScale, {
  fontSize: number;
  mobileFontSize: number;
  desktopFontSize: number;
  labelKey: string;
}> = {
  compact: { fontSize: 15, mobileFontSize: 15, desktopFontSize: 13, labelKey: 'settings.uiScaleCompact' },
  default: { fontSize: 17, mobileFontSize: 17, desktopFontSize: 14, labelKey: 'settings.uiScaleDefault' },
  large: { fontSize: 19, mobileFontSize: 19, desktopFontSize: 15, labelKey: 'settings.uiScaleLarge' },
};

export function parseStoredUiScale(value: string | null): UiScale {
  if (value === 'compact' || value === 'default' || value === 'large') {
    return value;
  }
  return 'default';
}

export function getUiScaleFontSize(scale: UiScale, target: 'mobile' | 'desktop' = 'mobile'): number {
  const config = UI_SCALE_CONFIG[scale] ?? UI_SCALE_CONFIG.default;
  return target === 'desktop' ? config.desktopFontSize : config.mobileFontSize;
}

export function getUiScaleFontSizes(scale: UiScale): { mobile: number; desktop: number } {
  const config = UI_SCALE_CONFIG[scale] ?? UI_SCALE_CONFIG.default;
  return { mobile: config.mobileFontSize, desktop: config.desktopFontSize };
}

export function applyUiScale(scale: UiScale): void {
  if (typeof document === 'undefined') return;
  const { mobile, desktop } = getUiScaleFontSizes(scale);
  const root = document.documentElement;
  if (root.style.fontSize) {
    root.style.fontSize = '';
  }
  root.style.setProperty('--ui-base-font-size', `${mobile}px`);
  root.style.setProperty('--ui-desktop-font-size', `${desktop}px`);
}

export function persistUiScale(scale: UiScale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UI_SCALE_STORAGE_KEY, scale);
    window.dispatchEvent(new CustomEvent(UI_SCALE_CHANGE_EVENT, { detail: scale }));
  } catch {
    // Ignore localStorage write failures in restricted contexts
  }
}

export function initUiScale(): UiScale {
  if (typeof window === 'undefined') return 'default';
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(UI_SCALE_STORAGE_KEY);
  } catch {
    stored = null;
  }
  const scale = parseStoredUiScale(stored);
  applyUiScale(scale);
  return scale;
}
