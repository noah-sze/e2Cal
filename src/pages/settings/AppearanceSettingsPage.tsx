import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTheme } from '@/components/ThemeProvider';
import { useUiScale } from '@/hooks/useUiScale';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { triggerHaptic } from '@/lib/haptics';

export default function AppearanceSettingsPage() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { scale, setScale } = useUiScale();
  const {
    showSettingsToggle: showPwaInstallSetting,
    hidePwaInstallPrompt,
    setHidePwaInstallPrompt,
  } = usePwaInstall();

  const currentLang = i18n.resolvedLanguage || i18n.language || 'en';

  const getThemeLabel = (tVal: string) => {
    if (tVal === 'light') return t('settings.themeLight');
    if (tVal === 'dark') return t('settings.themeDark');
    return t('settings.themeSystem');
  };

  const getScaleLabel = (s: string) => {
    if (s === 'compact') return t('settings.uiScaleCompact');
    if (s === 'large') return t('settings.uiScaleLarge');
    return t('settings.uiScaleDefault');
  };

  const getLanguageLabel = (lang: string) => {
    if (lang === 'zh-TW' || lang.startsWith('zh-TW') || lang.startsWith('zh-Hant')) {
      return '繁體中文 (台灣)';
    }
    if (lang === 'zh-CN' || lang.startsWith('zh-CN') || lang.startsWith('zh-Hans')) {
      return '简体中文';
    }
    return 'English';
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-7 pb-20 select-none">
      <section className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start">
        <div className="sm:col-span-4 space-y-0.5 px-1 sm:px-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
            {t('settings.preferencesSection')}
          </h2>
          <p className="text-2xs text-muted-foreground font-mono leading-relaxed">
            {t('settings.preferencesDesc')}
          </p>
        </div>
        <div className="sm:col-span-8 border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
          {/* 外觀主題 */}
          <div className="usage-row">
            <span className="text-sm font-normal text-foreground">{t('settings.theme')}</span>
            <Select
              value={theme}
              onValueChange={(v) => {
                if (v === 'light' || v === 'dark' || v === 'system') setTheme(v);
              }}
            >
              <SelectTrigger
                size="custom"
                className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <SelectValue className="flex-none text-right">
                  {getThemeLabel(theme)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="system">{t('settings.themeSystem')}</SelectItem>
                <SelectItem value="light">{t('settings.themeLight')}</SelectItem>
                <SelectItem value="dark">{t('settings.themeDark')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 介面縮放 */}
          <div className="usage-row">
            <span className="text-sm font-normal text-foreground">{t('settings.uiScale')}</span>
            <Select
              value={scale}
              onValueChange={(v) => {
                if (v === 'compact' || v === 'default' || v === 'large') setScale(v);
              }}
            >
              <SelectTrigger
                size="custom"
                className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <SelectValue className="flex-none text-right">
                  {getScaleLabel(scale)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="compact">{t('settings.uiScaleCompact')}</SelectItem>
                <SelectItem value="default">{t('settings.uiScaleDefault')}</SelectItem>
                <SelectItem value="large">{t('settings.uiScaleLarge')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 介面語言 */}
          <div className="usage-row">
            <span className="text-sm font-normal text-foreground">{t('settings.language')}</span>
            <Select
              value={currentLang}
              onValueChange={(v) => i18n.changeLanguage(v || 'en')}
            >
              <SelectTrigger
                size="custom"
                className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <SelectValue className="flex-none text-right">
                  {getLanguageLabel(currentLang)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="min-w-44">
                <SelectItem value="zh-TW">繁體中文 (台灣)</SelectItem>
                <SelectItem value="zh-CN">简体中文</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* PWA 安裝按鈕顯示開關 */}
          {showPwaInstallSetting && (
            <div className="usage-row">
              <span className="text-sm font-normal text-foreground">
                {t('settings.pwaInstallButton')}
              </span>
              <Select
                value={hidePwaInstallPrompt ? 'hide' : 'show'}
                onValueChange={(v) => {
                  if (!v) return;
                  triggerHaptic('selection');
                  setHidePwaInstallPrompt(v === 'hide');
                }}
              >
                <SelectTrigger
                  size="custom"
                  className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <SelectValue className="flex-none text-right">
                    {hidePwaInstallPrompt ? t('settings.hide') : t('settings.show')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end" className="min-w-28">
                  <SelectItem value="show">{t('settings.show')}</SelectItem>
                  <SelectItem value="hide">{t('settings.hide')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
