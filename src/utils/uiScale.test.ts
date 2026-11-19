import { describe, expect, it } from 'vitest';
import {
  getUiScaleFontSize,
  getUiScaleFontSizes,
  parseStoredUiScale,
  UI_SCALE_CONFIG,
  type UiScale,
} from './uiScale';

describe('uiScale utils (Apple HIG responsive typography standard)', () => {
  it('parses stored ui scale with default fallback', () => {
    expect(parseStoredUiScale(null)).toBe('default');
    expect(parseStoredUiScale('invalid')).toBe('default');
    expect(parseStoredUiScale('compact')).toBe('compact');
    expect(parseStoredUiScale('default')).toBe('default');
    expect(parseStoredUiScale('large')).toBe('large');
  });

  it('maps scales accurately to Apple HIG mobile and desktop font sizes', () => {
    expect(getUiScaleFontSize('compact')).toBe(15);
    expect(getUiScaleFontSize('default')).toBe(17);
    expect(getUiScaleFontSize('large')).toBe(19);
    expect(getUiScaleFontSize('unknown' as UiScale)).toBe(17);

    expect(getUiScaleFontSize('compact', 'desktop')).toBe(13);
    expect(getUiScaleFontSize('default', 'desktop')).toBe(14);
    expect(getUiScaleFontSize('large', 'desktop')).toBe(15);
    expect(getUiScaleFontSize('unknown' as UiScale, 'desktop')).toBe(14);
  });

  it('provides consistent scale configurations across devices', () => {
    expect(UI_SCALE_CONFIG.default.mobileFontSize).toBe(17);
    expect(UI_SCALE_CONFIG.default.desktopFontSize).toBe(14);
    expect(UI_SCALE_CONFIG.compact.mobileFontSize).toBe(15);
    expect(UI_SCALE_CONFIG.compact.desktopFontSize).toBe(13);
    expect(UI_SCALE_CONFIG.large.mobileFontSize).toBe(19);
    expect(UI_SCALE_CONFIG.large.desktopFontSize).toBe(15);

    expect(getUiScaleFontSizes('default')).toEqual({ mobile: 17, desktop: 14 });
    expect(getUiScaleFontSizes('compact')).toEqual({ mobile: 15, desktop: 13 });
    expect(getUiScaleFontSizes('large')).toEqual({ mobile: 19, desktop: 15 });
  });
});
