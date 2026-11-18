export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';
export type ThemeScope = 'landing' | 'app';

export const APP_THEME_STORAGE_KEY = 'e2cal-ui-theme';
export const LANDING_THEME_STORAGE_KEY = 'e2cal-landing-theme';

export function parseStoredAppTheme(
  value: string | null,
  fallback: Theme = 'system'
): Theme {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return fallback;
}

export function parseStoredLandingTheme(value: string | null): ResolvedTheme {
  return value === 'dark' ? 'dark' : 'light';
}

export function normalizeLandingTheme(theme: Theme): ResolvedTheme {
  return theme === 'dark' ? 'dark' : 'light';
}

export function resolveEffectiveTheme(params: {
  scope: ThemeScope;
  appTheme: Theme;
  landingTheme: ResolvedTheme;
  systemTheme: ResolvedTheme;
}): ResolvedTheme {
  if (params.scope === 'landing') {
    return params.landingTheme;
  }
  return params.appTheme === 'system' ? params.systemTheme : params.appTheme;
}
