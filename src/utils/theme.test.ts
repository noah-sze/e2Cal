import { describe, expect, it } from 'vitest';
import {
  normalizeLandingTheme,
  parseStoredAppTheme,
  parseStoredLandingTheme,
  resolveEffectiveTheme,
} from './theme';

describe('theme utils', () => {
  it('parses app theme with system fallback', () => {
    expect(parseStoredAppTheme(null)).toBe('system');
    expect(parseStoredAppTheme('invalid')).toBe('system');
    expect(parseStoredAppTheme('light')).toBe('light');
    expect(parseStoredAppTheme('dark')).toBe('dark');
    expect(parseStoredAppTheme('system')).toBe('system');
    expect(parseStoredAppTheme(null, 'light')).toBe('light');
  });

  it('parses landing theme with light default and ignores system', () => {
    expect(parseStoredLandingTheme(null)).toBe('light');
    expect(parseStoredLandingTheme('system')).toBe('light');
    expect(parseStoredLandingTheme('light')).toBe('light');
    expect(parseStoredLandingTheme('dark')).toBe('dark');
  });

  it('normalizes landing theme to light/dark only', () => {
    expect(normalizeLandingTheme('dark')).toBe('dark');
    expect(normalizeLandingTheme('light')).toBe('light');
    expect(normalizeLandingTheme('system')).toBe('light');
  });

  it('resolves landing scope independently of OS dark mode and app theme', () => {
    expect(
      resolveEffectiveTheme({
        scope: 'landing',
        appTheme: 'dark',
        landingTheme: 'light',
        systemTheme: 'dark',
      })
    ).toBe('light');

    expect(
      resolveEffectiveTheme({
        scope: 'landing',
        appTheme: 'light',
        landingTheme: 'dark',
        systemTheme: 'light',
      })
    ).toBe('dark');
  });

  it('resolves app scope independently of landing theme', () => {
    expect(
      resolveEffectiveTheme({
        scope: 'app',
        appTheme: 'system',
        landingTheme: 'light',
        systemTheme: 'dark',
      })
    ).toBe('dark');

    expect(
      resolveEffectiveTheme({
        scope: 'app',
        appTheme: 'system',
        landingTheme: 'dark',
        systemTheme: 'light',
      })
    ).toBe('light');

    expect(
      resolveEffectiveTheme({
        scope: 'app',
        appTheme: 'light',
        landingTheme: 'dark',
        systemTheme: 'dark',
      })
    ).toBe('light');
  });
});
