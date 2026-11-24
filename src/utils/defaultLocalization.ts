import i18n from '@/i18n/config';
import { DEFAULT_EXERCISE_I18N } from '@/services/db/defaultExerciseLocalization';

export type SupportedLocale = 'zh-TW' | 'zh-CN' | 'en';

export function resolveSupportedLocale(lang?: string): SupportedLocale {
  const raw = (lang || i18n.language || 'zh-TW').toLowerCase();
  if (raw.startsWith('en')) return 'en';
  if (raw.includes('cn') || raw.includes('hans') || raw === 'zh') return 'zh-CN';
  return 'zh-TW';
}

export interface LocalizableItem {
  id?: string | null;
  name?: string | null;
  isCustom?: boolean;
}

/**
 * 解析食物名稱：
 * 食物庫 100% 由使用者自建與權威庫導入，直接呈現實體名稱
 */
export function getLocalizedFoodName(item: LocalizableItem, _lang?: string): string {
  return item.name?.trim() || '';
}

/**
 * 解析預設動作之動態語系名稱：
 * - 自定義動作（isCustom: true）保留原名稱
 * - 系統預設動作依當前語系返回對應譯名（若使用者曾手動改名則保留改名結果）
 */
export function getLocalizedExerciseName(item: LocalizableItem, lang?: string): string {
  const rawName = item.name?.trim() || '';
  if (item.isCustom || !item.id) return rawName;

  const entry = DEFAULT_EXERCISE_I18N[item.id];
  if (!entry) return rawName;

  if (rawName && rawName !== entry.zhTW && rawName !== entry.zhCN && rawName !== entry.en) {
    return rawName;
  }

  const locale = resolveSupportedLocale(lang);
  if (locale === 'en') return entry.en;
  if (locale === 'zh-CN') return entry.zhCN;
  return entry.zhTW;
}
