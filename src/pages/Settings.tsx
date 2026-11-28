import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { useUserProfile } from '@/hooks/useUserProfile';
import { useDropboxSync } from '@/hooks/useDropboxSync';
import { useAISettings } from '@/hooks/useAISettings';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { CloudChannelDialog } from '@/components/settings/dialogs/CloudChannelDialog';
import { BrandWordmark } from '@/components/ui/Logo';
import type { UnitSystemPreset } from '@/types';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { preferences } = useUnitPreferences();
  const { profile } = useUserProfile();
  const { profiles: aiProfiles, activeProfile: activeAIProfile } = useAISettings();

  const [isDropboxDialogOpen, setIsDropboxDialogOpen] = useState(false);
  const [isBackupConnectDialogOpen, setIsBackupConnectDialogOpen] = useState(false);
  const [isRollingBackupDialogOpen, setIsRollingBackupDialogOpen] = useState(false);
  const [forceRefreshDialogOpen, setForceRefreshDialogOpen] = useState(false);
  const [isRefreshingApp, setIsRefreshingApp] = useState(false);

  const {
    activeProviderId,
    isAuthenticated: isDropboxAuth,
    isSyncing: isDropboxSyncing,
    lastSyncTime: dropboxLastSyncTime,
    isOnline,
    backupProviderId,
    isBackupConnected,
    isBackingUpZip,
    lastBackupZipTime,
    backupNow,
    connectDropbox,
    connectWebDav,
    connectS3,
    disconnectDropbox,
    connectBackupDropbox,
    connectBackupWebDav,
    connectBackupS3,
    disconnectBackup,
    syncNow: dropboxSyncNow,
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
    return 'EN';
  };

  const getPresetLabel = (p: UnitSystemPreset) => {
    if (p === 'metric') return t('settings.unitPresetMetric');
    if (p === 'imperial') return t('settings.unitPresetImperial');
    return t('settings.unitPresetCustom');
  };

  const appearanceSummary = `${getThemeLabel(theme)} · ${getLanguageShortLabel(currentLang)}`;
  const unitsAndBodySummary = getPresetLabel(preferences.preset);
  const aiSummary = activeAIProfile
    ? activeAIProfile.name
    : aiProfiles.length > 0
      ? String(aiProfiles.length)
      : '-';

  const dropboxSummary = !isDropboxAuth
    ? t('settings.disconnected', '未連線')
    : isDropboxSyncing
      ? t('settings.syncing', '同步中…')
      : t(`syncStatus.providers.${activeProviderId}`);

  const dropboxSummaryClassName = !isDropboxAuth
    ? undefined
    : isDropboxSyncing
      ? 'text-primary'
      : 'text-emerald-500 font-medium';

  const rollingBackupSummary = !isBackupConnected
    ? t('syncStatus.rollingBackup.disabledSummary')
    : isBackingUpZip
      ? t('syncStatus.rollingBackup.backingUp')
      : t(`syncStatus.providers.${backupProviderId ?? 'dropbox'}`);

  const rollingBackupSummaryClassName = !isBackupConnected
    ? undefined
    : isBackingUpZip
      ? 'text-primary'
      : 'text-emerald-500 font-medium';

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
          <SettingsRow
            label={t('settings.profile')}
            summary={profile.name || '-'}
            onClick={() => {
              triggerHaptic('light');
              navigate(APP_ROUTES.profile);
            }}
          />
          <SettingsRow
            label={t('settings.appearanceAndLanguage')}
            summary={appearanceSummary}
            onClick={() => {
              triggerHaptic('light');
              navigate(APP_ROUTES.settingsAppearance);
            }}
          />
          <SettingsRow
            label={t('settings.unitsAndBody')}
            summary={unitsAndBodySummary}
            onClick={() => {
              triggerHaptic('light');
              navigate(APP_ROUTES.settingsUnits);
            }}
          />
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
          <SettingsRow
            label={t('settings.dietSection')}
            onClick={() => {
              triggerHaptic('light');
              navigate(APP_ROUTES.foods);
            }}
          />
          <SettingsRow
            label={t('settings.workoutSection')}
            onClick={() => {
              triggerHaptic('light');
              navigate(APP_ROUTES.exercises);
            }}
          />
          <SettingsRow
            label={t('settings.authorityFoodSection')}
            onClick={() => {
              triggerHaptic('light');
              navigate(APP_ROUTES.authorityFoods);
            }}
          />
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
          <SettingsRow
            label={t('syncStatus.cloudSyncTitle')}
            summary={dropboxSummary}
            summaryClassName={dropboxSummaryClassName}
            onClick={() => {
              triggerHaptic('selection');
              setIsDropboxDialogOpen(true);
            }}
          />
          <SettingsRow
            label={t('syncStatus.rollingBackup.settingsRowTitle')}
            summary={rollingBackupSummary}
            summaryClassName={rollingBackupSummaryClassName}
            onClick={() => {
              triggerHaptic('selection');
              if (isBackupConnected) {
                setIsRollingBackupDialogOpen(true);
              } else {
                setIsBackupConnectDialogOpen(true);
              }
            }}
          />
          <SettingsRow
            label={t('settings.aiAssistant')}
            summary={aiSummary}
            onClick={() => {
              triggerHaptic('light');
              navigate(APP_ROUTES.settingsAi);
            }}
          />
          <SettingsRow
            label={t('settings.dataAndSystem')}
            onClick={() => {
              triggerHaptic('light');
              navigate(APP_ROUTES.settingsData);
            }}
          />
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
          <SettingsRow
            href="/landing.html"
            target="_blank"
            rel="noopener noreferrer"
            label={t('settings.productIntro')}
            onClick={() => triggerHaptic('light')}
          />
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

      {/* 雲端同步設定與管理彈窗 */}
      <CloudChannelDialog
        open={isDropboxDialogOpen}
        onOpenChange={setIsDropboxDialogOpen}
        activeProviderId={activeProviderId}
        isAuthenticated={isDropboxAuth}
        isSyncing={isDropboxSyncing}
        lastSyncTime={dropboxLastSyncTime}
        isOnline={isOnline}
        onConnectDropbox={connectDropbox}
        onConnectWebDav={connectWebDav}
        onConnectS3={connectS3}
        onDisconnect={disconnectDropbox}
        onSyncNow={dropboxSyncNow}
      />

      {/* 每日滾動備份設定與管理彈窗 */}
      <CloudChannelDialog
        open={isBackupConnectDialogOpen || isRollingBackupDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsBackupConnectDialogOpen(false);
            setIsRollingBackupDialogOpen(false);
          }
        }}
        channelScope="backup"
        activeProviderId={backupProviderId ?? 'dropbox'}
        isAuthenticated={isRollingBackupDialogOpen}
        isOnline={isOnline}
        isBackingUpZip={isBackingUpZip}
        lastBackupZipTime={lastBackupZipTime}
        isCloudSyncConnected={isDropboxAuth}
        onConnectDropbox={connectBackupDropbox}
        onConnectWebDav={connectBackupWebDav}
        onConnectS3={connectBackupS3}
        onBackupNow={backupNow}
        onDisconnect={disconnectBackup}
        onSyncAfterRestore={(mode) => dropboxSyncNow(mode)}
      />
    </div>
  );
}
