import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { APP_ROUTES } from '@/utils/navigation';
import { forceRefreshApp, formatBuildTime } from '@/utils/pwaRefresh';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  PrecisionDialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { useTheme } from '@/components/ThemeProvider';
import { toast } from '@/components/ui/toast';
import { triggerHaptic } from '@/lib/haptics';
import { useUnitPreferences } from '@/hooks/useUnitPreferences';
import { useBodyPreferences } from '@/hooks/useBodyPreferences';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useDropboxSync } from '@/hooks/useDropboxSync';
import { useAISettings } from '@/hooks/useAISettings';
import { DropboxSyncDialog } from '@/components/settings/dialogs/DropboxSyncDialog';
import { BrandWordmark } from '@/components/ui/Logo';
import type { UnitSystemPreset } from '@/types';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { preferences } = useUnitPreferences();
  const { bodyPreferences } = useBodyPreferences();
  const { profile } = useUserProfile();
  const { profiles: aiProfiles, activeProfile: activeAIProfile } = useAISettings();

  const [isDropboxDialogOpen, setIsDropboxDialogOpen] = useState(false);
  const [forceRefreshDialogOpen, setForceRefreshDialogOpen] = useState(false);
  const [isRefreshingApp, setIsRefreshingApp] = useState(false);

  const {
    isAuthenticated: isDropboxAuth,
    isSyncing: isDropboxSyncing,
    lastSyncTime: dropboxLastSyncTime,
    isOnline,
    connectDropbox,
    disconnectDropbox,
    syncNow: dropboxSyncNow,
    overwriteRemote: dropboxOverwriteRemote,
  } = useDropboxSync();

  const handleForceRefresh = async () => {
    if (isRefreshingApp) return;
    setIsRefreshingApp(true);
    const result = await forceRefreshApp();
    if (result === 'offline') {
      setIsRefreshingApp(false);
      setForceRefreshDialogOpen(false);
      toast.show(t('settings.forceRefreshOffline'));
    }
  };

  const currentLang = i18n.resolvedLanguage || i18n.language || 'en';

  const getThemeLabel = (tVal: string) => {
    if (tVal === 'light') return t('settings.themeLight');
    if (tVal === 'dark') return t('settings.themeDark');
    return t('settings.themeSystem');
  };

  const getLanguageShortLabel = (lang: string) => {
    if (lang === 'zh-TW' || lang.startsWith('zh-TW') || lang.startsWith('zh-Hant')) {
      return '繁體中文';
    }
    if (lang === 'zh-CN' || lang.startsWith('zh-CN') || lang.startsWith('zh-Hans')) {
      return '简体中文';
    }
    return 'English';
  };

  const getPresetLabel = (p: UnitSystemPreset) => {
    if (p === 'metric') return t('settings.unitPresetMetric');
    if (p === 'imperial') return t('settings.unitPresetImperial');
    return t('settings.unitPresetCustom');
  };

  const appearanceSummary = `${getThemeLabel(theme)} · ${getLanguageShortLabel(currentLang)}`;
  const hasIgnoredBody =
    bodyPreferences.ignoreTorsoCircumferences || bodyPreferences.ignoreLimbCircumferences;
  const unitsAndBodySummary = `${getPresetLabel(preferences.preset)} · ${
    hasIgnoredBody ? t('settings.bodyPartialIgnored') : t('settings.bodyAllTracked')
  }`;
  const aiSummary = activeAIProfile
    ? activeAIProfile.name
    : aiProfiles.length > 0
      ? String(aiProfiles.length)
      : '-';

  return (
    <div className="w-full max-w-xl mx-auto space-y-7 pb-20 select-none">
      {/* 區塊 1：個人與顯示 */}
      <section className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start">
        <div className="sm:col-span-4 space-y-0.5 px-1 sm:px-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
            {t('settings.personalAndDisplaySection')}
          </h2>
          <p className="text-2xs text-muted-foreground font-mono leading-relaxed">
            {t('settings.personalAndDisplayDesc')}
          </p>
        </div>
        <div className="sm:col-span-8 border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
          {/* 個人資料 */}
          <div
            onClick={() => {
              triggerHaptic('light');
              navigate(APP_ROUTES.profile);
            }}
            className="usage-row hover:bg-hover transition-colors group cursor-pointer"
          >
            <span className="text-sm font-normal text-foreground">{t('settings.profile')}</span>
            <div className="flex items-center gap-1.5 text-sm font-mono text-muted-foreground group-hover:text-foreground transition-colors">
              <span>{profile.name || '-'}</span>
              <ChevronRight className="size-4 opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* 外觀與語言 */}
          <div
            onClick={() => {
              triggerHaptic('light');
              navigate(APP_ROUTES.settingsAppearance);
            }}
            className="usage-row hover:bg-hover transition-colors group cursor-pointer"
          >
            <span className="text-sm font-normal text-foreground shrink-0">
              {t('settings.appearanceAndLanguage')}
            </span>
            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors min-w-0">
              <span className="truncate">{appearanceSummary}</span>
              <ChevronRight className="size-4 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* 度量衡與體態指標 */}
          <div
            onClick={() => {
              triggerHaptic('light');
              navigate(APP_ROUTES.settingsUnits);
            }}
            className="usage-row hover:bg-hover transition-colors group cursor-pointer"
          >
            <span className="text-sm font-normal text-foreground shrink-0">
              {t('settings.unitsAndBody')}
            </span>
            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors min-w-0">
              <span className="truncate">{unitsAndBodySummary}</span>
              <ChevronRight className="size-4 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
      </section>

      {/* 分割線 */}
      <div className="border-t border-border" />

      {/* 區塊 2：資料庫 */}
      <section className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start">
        <div className="sm:col-span-4 space-y-0.5 px-1 sm:px-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
            {t('settings.databaseSection')}
          </h2>
          <p className="text-2xs text-muted-foreground font-mono leading-relaxed">
            {t('settings.databaseDesc')}
          </p>
        </div>
        <div className="sm:col-span-8 border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
          {/* 飲食資料管理 */}
          <div
            onClick={() => {
              triggerHaptic('light');
              navigate(APP_ROUTES.foods);
            }}
            className="usage-row cursor-pointer group hover:bg-hover transition-colors"
          >
            <span className="text-sm font-normal text-foreground">
              {t('settings.dietSection')}
            </span>
            <ChevronRight className="size-4 opacity-50 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* 訓練資料管理 */}
          <div
            onClick={() => {
              triggerHaptic('light');
              navigate(APP_ROUTES.exercises);
            }}
            className="usage-row cursor-pointer group hover:bg-hover transition-colors"
          >
            <span className="text-sm font-normal text-foreground">
              {t('settings.workoutSection')}
            </span>
            <ChevronRight className="size-4 opacity-50 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* 食物數據庫 */}
          <div
            onClick={() => {
              triggerHaptic('light');
              navigate(APP_ROUTES.authorityFoods);
            }}
            className="usage-row cursor-pointer group hover:bg-hover transition-colors"
          >
            <span className="text-sm font-normal text-foreground">
              {t('settings.authorityFoodSection')}
            </span>
            <ChevronRight className="size-4 opacity-50 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </section>

      {/* 分割線 */}
      <div className="border-t border-border" />

      {/* 區塊 3：工具與資料（Dropbox 同步保留於一級頁） */}
      <section className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start">
        <div className="sm:col-span-4 space-y-0.5 px-1 sm:px-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
            {t('settings.extensionsAndDataSection')}
          </h2>
          <p className="text-2xs text-muted-foreground font-mono leading-relaxed">
            {t('settings.dataVaultDesc')}
          </p>
        </div>
        <div className="sm:col-span-8 border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
          {/* Dropbox 雲端同步（一級頁直達） */}
          <div
            onClick={() => {
              triggerHaptic('selection');
              setIsDropboxDialogOpen(true);
            }}
            className="usage-row cursor-pointer group hover:bg-hover transition-colors"
          >
            <span className="text-sm font-normal text-foreground">
              {t('settings.dropboxSync', 'Dropbox 同步')}
            </span>
            <div className="flex items-center gap-1.5 text-sm font-mono text-muted-foreground group-hover:text-foreground">
              {!isDropboxAuth ? (
                <span>{t('settings.disconnected', '未連線')}</span>
              ) : isDropboxSyncing ? (
                <span className="text-primary">{t('settings.syncing', '同步中…')}</span>
              ) : (
                <span className="text-emerald-500 font-medium">{t('settings.connected', '已連線')}</span>
              )}
              <ChevronRight className="size-4 opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* AI 助手 */}
          <div
            onClick={() => {
              triggerHaptic('light');
              navigate(APP_ROUTES.settingsAi);
            }}
            className="usage-row cursor-pointer group hover:bg-hover transition-colors"
          >
            <span className="text-sm font-normal text-foreground">
              {t('settings.aiAssistant')}
            </span>
            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors">
              <span>{aiSummary}</span>
              <ChevronRight className="size-4 opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* 備份與系統 */}
          <div
            onClick={() => {
              triggerHaptic('light');
              navigate(APP_ROUTES.settingsData);
            }}
            className="usage-row cursor-pointer group hover:bg-hover transition-colors"
          >
            <span className="text-sm font-normal text-foreground">
              {t('settings.dataAndSystem')}
            </span>
            <ChevronRight className="size-4 opacity-50 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </section>

      {/* 分割線 */}
      <div className="border-t border-border" />

      {/* 區塊 4：關於 */}
      <section className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start">
        <div className="sm:col-span-4 space-y-0.5 px-1 sm:px-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
            {t('settings.aboutSection')}
          </h2>
          <p className="text-2xs text-muted-foreground font-mono leading-relaxed">
            {t('settings.aboutDesc')}
          </p>
        </div>
        <div className="sm:col-span-8 border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
          <a
            href="/landing.html"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => triggerHaptic('light')}
            className="usage-row hover:bg-hover transition-colors group cursor-pointer"
          >
            <span className="text-sm font-normal text-foreground">
              {t('settings.productIntro')}
            </span>
            <div className="flex items-center gap-1.5 text-sm font-mono text-muted-foreground group-hover:text-foreground transition-colors">
              <ChevronRight className="size-4 opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
          </a>
        </div>
      </section>

      {/* 頁尾版本標記 */}
      <div className="pt-4 flex justify-center">
        <button
          type="button"
          onClick={() => setForceRefreshDialogOpen(true)}
          className="flex flex-col items-center gap-1 text-center font-mono text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <div>
            <BrandWordmark variant="inline" /> v{__APP_VERSION__} · {__COMMIT_HASH__}
          </div>
          <div className="text-2xs tabular-nums opacity-80">
            {formatBuildTime(__BUILD_TIME__)}
          </div>
        </button>
      </div>

      {/* 強制刷新確認彈窗 */}
      <Dialog
        open={forceRefreshDialogOpen}
        onOpenChange={(open) => {
          if (!isRefreshingApp) setForceRefreshDialogOpen(open);
        }}
      >
        <PrecisionDialogContent
          title={t('settings.forceRefresh')}
          onClose={() => {
            if (!isRefreshingApp) setForceRefreshDialogOpen(false);
          }}
          cancelDisabled={isRefreshingApp}
          onSubmit={() => void handleForceRefresh()}
          submitDisabled={isRefreshingApp}
          submitAriaLabel={isRefreshingApp ? t('settings.forceRefreshing') : t('settings.forceRefresh')}
          cancelAriaLabel={t('common.cancel')}
        >
          <div className="pt-3.5 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('settings.forceRefreshConfirmDesc')}
            </p>
            <div className="rounded border border-border bg-muted px-3 py-2 font-mono text-2xs text-muted-foreground space-y-0.5 tabular-nums">
              <div>
                <BrandWordmark variant="inline" /> v{__APP_VERSION__} · {__COMMIT_HASH__}
              </div>
              <div>{formatBuildTime(__BUILD_TIME__)}</div>
            </div>
            <DialogFooter className="flex-row gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRefreshingApp}
                onClick={() => setForceRefreshDialogOpen(false)}
                className="flex-1 h-8 text-xs font-mono shadow-none"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isRefreshingApp}
                onClick={() => void handleForceRefresh()}
                className="flex-1 h-8 text-xs font-mono shadow-none"
              >
                {isRefreshingApp ? t('settings.forceRefreshing') : t('settings.forceRefresh')}
              </Button>
            </DialogFooter>
          </div>
        </PrecisionDialogContent>
      </Dialog>

      {/* Dropbox 同步設定彈窗 */}
      <DropboxSyncDialog
        open={isDropboxDialogOpen}
        onOpenChange={setIsDropboxDialogOpen}
        isAuthenticated={isDropboxAuth}
        isSyncing={isDropboxSyncing}
        lastSyncTime={dropboxLastSyncTime}
        isOnline={isOnline}
        onConnectDropbox={connectDropbox}
        onDisconnectDropbox={disconnectDropbox}
        onSyncNow={dropboxSyncNow}
        onOverwriteRemote={dropboxOverwriteRemote}
      />
    </div>
  );
}
