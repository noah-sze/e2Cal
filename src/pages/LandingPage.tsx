import { useMemo, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/ThemeProvider';
import {
  Sun,
  Moon,
  Globe,
} from 'lucide-react';
import { SetupProfileDialog } from '@/components/welcome/SetupProfileDialog';
import { WelcomeTransitionOverlay } from '@/components/welcome/WelcomeTransitionOverlay';
import { LaunchAppMenu } from '@/components/welcome/LaunchAppMenu';
import { LocalImportDialog } from '@/components/welcome/LocalImportDialog';
import { DropboxSyncDialog } from '@/components/settings/dialogs/DropboxSyncDialog';
import { InitialSyncModal } from '@/components/sync/InitialSyncModal';
import { Toaster, toast } from '@/components/ui/toast';
import { Logo, BrandWordmark, BrandText } from '@/components/ui/Logo';
import { getDemoDashboardData, DEMO_DASHBOARD_DATA } from '@/components/dashboard/DashboardView';
import {
  WorkoutRecoveryDashboard,
  WorkoutExerciseCard,
  getDemoWorkoutExercisesData,
  ExerciseOverviewCard,
  getDemoExerciseOverviewData,
} from '@/components/workout';
import type { BodyWeightUnit } from '@/types';
import { DietView, getDemoDietData } from '@/components/diet/DietView';
import {
  WeightTrendChart,
  DEMO_WEIGHT_TREND_DATA,
  BodyTodayDataCard,
  DEMO_BODY_TODAY_DATA,
  BodyMetricsOverviewCard,
  DEMO_BODY_METRICS_DATA,
} from '@/components/body';
import { ShareShowcaseCards } from '@/components/common/ShareShowcaseCards';
import { SyncTopologyDiagram } from '@/components/common/SyncTopologyDiagram';
import { HeroShowcaseDeck } from '@/components/common/HeroShowcaseDeck';
import { WireframeGlobe } from '@/components/welcome/WireframeGlobe';
import {
  useUserProfile,
  isBaseInfoComplete,
  syncUserProfileCache,
} from '@/hooks/useUserProfile';
import { db } from '@/services/db/db';
import { PRIMARY_USER_ID } from '@/services/db/defaultData';
import {
  getDropboxAppKey,
  initiateDropboxAuth,
  consumePendingDropboxOAuthCallback,
} from '@/services/sync/dropboxAuth';
import { startInitialSync } from '@/services/sync/initialSyncManager';
import { formatSyncErrorMessage } from '@/services/sync/syncEngine';

const SHOWCASE_DOT_GRID_STYLE = {
  backgroundImage: 'radial-gradient(var(--canvas-dot) 1px, transparent 1px)',
  backgroundSize: '16px 16px',
} as const;

function ShowcaseFrameWindow({
  footerLeft,
  footerRight,
  className = '',
  bodyClassName = 'p-4',
  children,
}: {
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-card text-card-foreground flex flex-col overflow-hidden shadow-none ${className}`}
    >
      <div
        className={`flex-1 flex flex-col justify-center ${bodyClassName}`}
        style={SHOWCASE_DOT_GRID_STYLE}
      >
        {children}
      </div>

      {footerLeft || footerRight ? (
        <div className="min-h-9 px-4 py-2 border-t border-border bg-muted flex items-center justify-between gap-2 text-xs font-mono text-muted-foreground shrink-0">
          <span className="truncate">{footerLeft}</span>
          {footerRight ? (
            <span className="tabular-nums text-neutral-500 dark:text-neutral-400 shrink-0">{footerRight}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [isCloudImportDialogOpen, setIsCloudImportDialogOpen] = useState(false);
  const [isLocalImportDialogOpen, setIsLocalImportDialogOpen] = useState(false);
  const [isTransitionOpen, setIsTransitionOpen] = useState(false);
  const [welcomeUserName, setWelcomeUserName] = useState('');

  const isSetupReady = !isProfileLoading && profile.isSetupCompleted;

  const handleOpenApp = () => {
    setWelcomeUserName(profile.name || '');
    setIsTransitionOpen(true);
  };

  const handleConfirmCloudImport = async () => {
    const appKey = getDropboxAppKey();
    if (!appKey) {
      toast.show(t('settings.missingAppKey', '未配置 Dropbox App Key'));
      return;
    }

    try {
      await initiateDropboxAuth('restore');
    } catch (err: unknown) {
      console.error('Failed to initiate Dropbox restore auth:', err);
      const reason = formatSyncErrorMessage(err, t);
      toast.show(t('syncStatus.authFailedToast', { reason }));
    }
  };

  const handleDataRestored = async () => {
    const restoredBaseInfo = (await db.user_base_info.get(PRIMARY_USER_ID)) ?? null;
    syncUserProfileCache(restoredBaseInfo);
    if (isBaseInfoComplete(restoredBaseInfo)) {
      setWelcomeUserName(restoredBaseInfo?.name || '');
      setIsTransitionOpen(true);
    } else {
      setIsSetupDialogOpen(true);
    }
  };

  // 全新裝置從 Dropbox 授權返回 /app 被 SetupGuard 導回落地頁時，於此無縫接手 OAuth 回調
  useEffect(() => {
    const callback = consumePendingDropboxOAuthCallback();
    if (!callback) return;

    if (callback.kind === 'error') {
      if (callback.error === 'access_denied') {
        toast.show(t('initialSync.cancelToast', '已取消同步'));
      } else {
        const reason = formatSyncErrorMessage(callback.errorDescription || callback.error, t);
        toast.show(t('syncStatus.authFailedToast', { reason }));
      }
      return;
    }

    startInitialSync(callback.code, { mode: callback.mode }).catch((err) => {
      console.error('Failed to start cloud import sync:', err);
    });
  }, [t]);

  const currentLang = i18n.language?.startsWith('zh-CN')
    ? 'zh-CN'
    : i18n.language?.startsWith('en')
      ? 'en'
      : 'zh-TW';

  const toggleLanguage = () => {
    const nextLang =
      currentLang === 'zh-TW'
        ? 'en'
        : currentLang === 'en'
          ? 'zh-CN'
          : 'zh-TW';
    i18n.changeLanguage(nextLang);
  };

  const languageLabel =
    currentLang === 'zh-TW'
      ? '繁中'
      : currentLang === 'zh-CN'
        ? '简中'
        : 'EN';

  useEffect(() => {
    const prevTitle = document.title;
    document.title = t('landing.metaTitle', 'e2Cal - 飲食、訓練記錄');
    return () => {
      document.title = prevTitle;
    };
  }, [t]);

  const tr = (k: string, fb?: string) => (fb !== undefined ? t(k, fb) : t(k));
  const demoDashboardData = useMemo(() => getDemoDashboardData(tr), [t]);
  const demoDietData = useMemo(() => getDemoDietData(tr), [t]);
  const demoWorkoutExercisesData = useMemo(() => getDemoWorkoutExercisesData(tr), [t]);

  const demoExerciseOverview = useMemo(
    () =>
      getDemoExerciseOverviewData(
        (DEMO_DASHBOARD_DATA.bodyWeightUnit as BodyWeightUnit) || 'kg',
        tr
      ),
    [t]
  );

  const demoBodyTrendSummary = useMemo(() => {
    const rawWeight = DEMO_BODY_TODAY_DATA.weight ?? 69;
    const trendWeight = DEMO_BODY_METRICS_DATA.trendWeight ?? 68.85;
    const delta = Math.round((trendWeight - rawWeight) * 100) / 100;
    const deltaText = `${delta > 0 ? '+' : ''}${delta.toFixed(2)} ${demoDashboardData.bodyWeightUnit}`;
    return { deltaText };
  }, [demoDashboardData.bodyWeightUnit]);

  const isDarkTheme = resolvedTheme === 'dark';

  const toggleTheme = () => {
    setTheme(isDarkTheme ? 'light' : 'dark');
  };

  const scrollToSection = (id: string) => {
    const container = document.getElementById('landing-container');
    if (id === 'hero' && container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(id);
    if (el && container) {
      const top = el.offsetTop - 56;
      container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    } else if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div
      id="landing-container"
      className="fixed inset-0 h-full w-full overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden bg-background text-foreground antialiased selection:bg-foreground selection:text-background font-sans"
    >
      

  {/*  =========================================================================  */}
  {/*  TOP NAVIGATION HEADER                                                      */}
  {/*  =========================================================================  */}
  <header className="sticky top-0 z-50 bg-header-bg backdrop-blur-md border-y border-border transition-colors duration-200">
    <div className="w-full flex items-center h-14 divide-x divide-border">

      {/*  Logo & Identity: Full-bleed Left Cell  */}
      <a
        href="#hero"
        onClick={(e) => {
          e.preventDefault();
          scrollToSection("hero");
        }}
        className="h-full px-4 sm:px-6 lg:px-12 flex-1 min-w-0 md:flex-initial lg:min-w-[240px] flex items-center space-x-2.5 shrink-0 hover:bg-hover transition-colors group cursor-pointer"
      >
        <Logo
          size={28}
          showBorder={false}
          className="w-7 h-7 border border-transparent dark:border-border"
        />
        <BrandWordmark className="text-base text-foreground" />
      </a>

      {/*  Navigation Links: Full-width Edge-to-Edge Grid  */}
      <nav className="hidden md:flex items-center h-full flex-1 min-w-0 divide-x divide-border font-mono text-2xs lg:text-xs text-muted-foreground">
        <a onClick={(e) => { e.preventDefault(); scrollToSection("diet"); }} href="#diet" className="h-full flex-1 px-1.5 whitespace-nowrap flex items-center justify-center hover:text-foreground hover:bg-hover transition-colors">{t('landing.nav.diet', '飲食')}</a>
        <a onClick={(e) => { e.preventDefault(); scrollToSection("workout"); }} href="#workout" className="h-full flex-1 px-1.5 whitespace-nowrap flex items-center justify-center hover:text-foreground hover:bg-hover transition-colors">{t('landing.nav.workout', '訓練')}</a>
        <a onClick={(e) => { e.preventDefault(); scrollToSection("body"); }} href="#body" className="h-full flex-1 px-1.5 whitespace-nowrap flex items-center justify-center hover:text-foreground hover:bg-hover transition-colors">{t('landing.nav.body', '體態')}</a>
        <a onClick={(e) => { e.preventDefault(); scrollToSection("analytics"); }} href="#analytics" className="h-full flex-1 px-1.5 whitespace-nowrap flex items-center justify-center hover:text-foreground hover:bg-hover transition-colors">{t('landing.nav.analytics', '分析')}</a>
        <a onClick={(e) => { e.preventDefault(); scrollToSection("sync"); }} href="#sync" className="h-full flex-1 px-1.5 whitespace-nowrap flex items-center justify-center hover:text-foreground hover:bg-hover transition-colors">{t('landing.nav.sync', '同步')}</a>
        <a onClick={(e) => { e.preventDefault(); scrollToSection("non-goals"); }} href="#non-goals" className="h-full flex-1 px-1.5 whitespace-nowrap flex items-center justify-center hover:text-foreground hover:bg-hover transition-colors">{t('landing.nav.principles', '原則')}</a>
        <a onClick={(e) => { e.preventDefault(); scrollToSection("tech"); }} href="#tech" className="h-full flex-1 px-1.5 whitespace-nowrap flex items-center justify-center hover:text-foreground hover:bg-hover transition-colors">{t('landing.nav.tech', '技術')}</a>
      </nav>

      {/*  Action Area: Full-bleed Right Cells (Symmetrical Equal-width Twin Cells)  */}
      <div className="flex items-center h-full shrink-0 ml-auto md:ml-0 divide-x divide-border font-mono text-xs">
        <button
          type="button"
          onClick={toggleLanguage}
          id="language-toggle-btn"
          className="h-full px-3 lg:px-0 lg:w-32 flex items-center justify-center space-x-1.5 hover:bg-hover text-muted-foreground transition-colors cursor-pointer whitespace-nowrap"
          title={t('settings.language', '語言設定')}
        >
          <Globe className="w-3.5 h-3.5 shrink-0" />
          <span>{languageLabel}</span>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          id="theme-toggle-btn"
          className="h-full px-3 lg:px-0 lg:w-32 flex items-center justify-center space-x-1.5 hover:bg-hover text-muted-foreground transition-colors cursor-pointer whitespace-nowrap"
          title={t('landing.themeToggle', '切換淺色/深色模式')}
        >
          <span id="theme-icon" className="flex items-center justify-center">
            {isDarkTheme ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </span>
          <span id="theme-text">{isDarkTheme ? t('settings.themeDark', '深色') : t('settings.themeLight', '淺色')}</span>
        </button>

        <LaunchAppMenu
          label={t('common.openApp', '開啟應用')}
          isSetupCompleted={isSetupReady}
          onOpenApp={handleOpenApp}
          onSelectFirstTime={() => setIsSetupDialogOpen(true)}
          onSelectCloudImport={() => setIsCloudImportDialogOpen(true)}
          onSelectLocalImport={() => setIsLocalImportDialogOpen(true)}
          align="end"
          side="bottom"
          sideOffset={6}
          triggerClassName="relative -my-[1px] h-[calc(100%+2px)] px-3.5 lg:px-0 lg:w-32 py-0 rounded-none flex items-center justify-center space-x-1.5 bg-foreground text-background hover:opacity-90 font-semibold transition-colors cursor-pointer border border-foreground z-10 whitespace-nowrap"
          iconClassName="w-3.5 h-3.5 shrink-0"
        />
      </div>

    </div>
  </header>

  {/*  =========================================================================  */}
  {/*  01. HERO / ABOVE-THE-FOLD MAIN SHOWCASE (主流內容展示)                     */}
  {/*  =========================================================================  */}
  <section id="hero" className="relative border-b border-border bg-grid-theme overflow-hidden transition-colors duration-200">

    <div className="w-full grid grid-cols-1 md:grid-cols-12 min-h-0 md:min-h-[calc(100vh-56px)]">
      
      {/*  Left Column: Manifesto & Value Proposition  */}
      <div className="relative overflow-hidden md:col-span-5 pt-36 pb-8 px-6 sm:p-12 md:p-8 lg:p-16 xl:p-20 border-b-0 md:border-r border-border flex flex-col justify-center space-y-8 bg-background transition-colors duration-200">
        <WireframeGlobe
          centerXRatio={0.68}
          centerYRatio={0.42}
          radiusRatio={1.44}
          desktopRadiusRatio={1.44}
        />
        
        <div className="relative z-10 space-y-6">
          <div>
            <div className="mb-3 sm:mb-4">
              <Logo
                size={80}
                showBorder={false}
                className="w-16 h-16 sm:w-20 sm:h-20 shadow-none"
              />
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight font-sans text-foreground leading-[1.12]">
              {t('landing.hero.titleLine1', '只記數據，')}<br />
              <span className="text-muted-foreground font-sans font-normal">{t('landing.hero.titleLine2', '絕不對你指手畫腳')}</span>
            </h1>
          </div>

          <p className="text-muted-foreground font-sans text-sm sm:text-base leading-relaxed">
            <BrandText text={t('landing.hero.desc', '記錄身體不該帶來壓力。今天吃了多少、練了幾組，軟體只如實告訴你真實數字，絕不批判你吃多吃少，更不強迫打卡斷簽。完全支援離線使用，每一次輸入都乾脆俐落。')} />
          </p>

          {/*  CTAs  */}
          <div className="pt-2 flex flex-wrap items-center gap-3 font-mono text-xs">
            <LaunchAppMenu
              label={t('common.openApp', '開啟應用')}
              isSetupCompleted={isSetupReady}
              onOpenApp={handleOpenApp}
              onSelectFirstTime={() => setIsSetupDialogOpen(true)}
              onSelectCloudImport={() => setIsCloudImportDialogOpen(true)}
              onSelectLocalImport={() => setIsLocalImportDialogOpen(true)}
              align="start"
            />
            <div className="px-4 py-3 bg-muted border border-border text-muted-foreground rounded">
              {t('landing.hero.ctaPwa', 'PWA 離線安裝 · 100% 數據私有化')}
            </div>
          </div>
        </div>

        {/*  Core Characteristics List (一行兩個排版)  */}
        <div className="relative z-10 pt-6 border-t border-border font-mono text-xs text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="text-foreground">{t('landing.hero.traits.localFirst', '100% 本地優先')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
            <span className="text-foreground">{t('landing.hero.traits.crossPlatform', '全平台支援')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
            <span className="text-foreground">{t('landing.hero.traits.dropboxSync', 'Dropbox 同步')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-telemetry-accent shrink-0"></span>
            <span className="text-foreground">{t('landing.hero.traits.nonPreachy', '客觀無說教')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-600 shrink-0"></span>
            <span className="text-foreground">{t('landing.hero.traits.minimalDesign', '極簡設計')}</span>
          </div>
        </div>

      </div>

      
      {/* Right Column: 100% Live Real Component of App Dashboard (Single Source of Truth) */}
      <div className="hidden md:flex md:col-span-7 p-4 md:p-6 lg:p-8 xl:p-12 bg-muted flex-col justify-center items-center transition-colors duration-200 overflow-hidden">
        <HeroShowcaseDeck />
      </div>

    </div>
  </section>

  <section id="diet" className="py-14 sm:py-20 px-4 sm:px-8 border-b border-border bg-background transition-colors duration-200">
    <div className="max-w-6xl mx-auto space-y-5 md:space-y-10">
      
      {/*  標題區塊 (單獨成行，居於上方)  */}
      <div className="space-y-3 max-w-3xl">
        <div className="font-mono text-xs text-telemetry-accent uppercase tracking-widest">
          {t('landing.diet.tag', '[ 01 / 飲食]')}
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight font-sans text-foreground leading-tight">
          {t('landing.diet.titleLine1', '零摩擦記錄飲食')}
          <span className="block mt-1 text-muted-foreground font-sans text-xl sm:text-2xl font-normal">{t('landing.diet.titleLine2', '準確食物、一鍵複製、快速估算、滾動均值')}</span>
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base leading-relaxed font-sans">
          <BrandText text={t('landing.diet.desc', '記錄飲食不該是繁瑣負擔。e2Cal 針對真實生活打造零阻力記錄流：自煮時依托 420+ 種原型食物準確秤重；規律進餐時一鍵複製昨日餐點；外食聚餐時支援快速粗估。')} />
        </p>
      </div>

      {/*  數據指標看板、四大記錄類型介紹與真實飲食展示視窗 (手機版橫向滑動查看，平板／桌面版並列排版)  */}
      <div className="flex flex-row overflow-x-auto snap-x snap-mandatory scroll-smooth items-start gap-4 sm:gap-6 font-mono pb-1 -mr-4 pr-4 sm:-mr-8 sm:pr-8 md:mr-0 md:pr-0 md:pb-0 md:overflow-visible md:grid md:grid-cols-12 md:gap-6 lg:gap-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        
        {/*  左側欄：四大記錄模式介紹 + 底部三大核心指標 (手機端橫向吸附，平板／桌面端自適應雙欄)  */}
        <div className="w-[85vw] max-w-[360px] sm:max-w-[400px] md:w-auto md:max-w-none md:col-span-6 lg:col-span-5 shrink-0 snap-start space-y-4">
          
          {/*  四大記錄類型介紹單元格 (食物、複製、估算、平均)  */}
          <div className="border border-border divide-y divide-border rounded-lg bg-background overflow-hidden shadow-none">
            {/*  類型 1: 原型食物  */}
            <div className="p-4 flex flex-col justify-between space-y-1 hover:bg-hover transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  {t('landing.diet.types.raw.tag', '01 // 原型食物')}
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {t('landing.diet.types.raw.title', '自煮精準記錄')}
                </span>
              </div>
              <div className="font-sans text-xs text-muted-foreground leading-relaxed">
                {t('landing.diet.types.raw.desc', '自煮秤重基準。內置 420+ 種原型食物未烹生重常數，以物理克數 (g) 錄入，杜絕吸水與出水誤差。')}
              </div>
            </div>

            {/*  類型 2: 一鍵複製  */}
            <div className="p-4 flex flex-col justify-between space-y-1 hover:bg-hover transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  {t('landing.diet.types.copy.tag', '02 // 一鍵複製')}
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {t('landing.diet.types.copy.title', '複用記錄')}
                </span>
              </div>
              <div className="font-sans text-xs text-muted-foreground leading-relaxed">
                {t('landing.diet.types.copy.desc', '規律飲食無摩擦。當進餐內容高度重複時，一鍵帶入昨日或歷史同餐所有食物配方，零重複手動錄入。')}
              </div>
            </div>

            {/*  類型 3: 快速估算  */}
            <div className="p-4 flex flex-col justify-between space-y-1 hover:bg-hover transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  {t('landing.diet.types.estimate.tag', '03 // 快速估算')}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-foreground bg-foreground text-background font-mono text-3xs font-semibold leading-none whitespace-nowrap">
                    {t('landing.diet.types.estimate.aiBadge')}
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {t('landing.diet.types.estimate.title', '外賣、聚餐')}
                  </span>
                </div>
              </div>
              <div className="font-sans text-xs text-muted-foreground leading-relaxed">
                {t('landing.diet.types.estimate.desc', '社交聚餐零焦慮。外食或無法秤重情境，依連鎖門市與場景秒級預設熱量與三大元素，過濾記錄壓力。')}
              </div>
            </div>

            {/*  類型 4: 滾動平均  */}
            <div className="p-4 flex flex-col justify-between space-y-1 hover:bg-hover transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  {t('landing.diet.types.average.tag', '04 // 滾動平均')}
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {t('landing.diet.types.average.title', '懶得記')}
                </span>
              </div>
              <div className="font-sans text-xs text-muted-foreground leading-relaxed">
                {t('landing.diet.types.average.desc', '算我正常吃模式。依 7 日與 30 日歷史攝入自動代入平均預算，客觀平滑水分滯留與單日進食波動。')}
              </div>
            </div>
          </div>

          {/*  飲食核心數據指標單元格 (3 欄水平並列底座)  */}
          <div className="grid grid-cols-3 divide-x divide-border border border-border rounded-lg bg-background overflow-hidden shadow-none">
            {/*  指標 1: 內置食物數量  */}
            <div className="p-3 bg-background flex flex-col space-y-1 hover:bg-hover transition-colors">
              <div className="text-xs text-muted-foreground uppercase tracking-wider h-4 flex items-center">
                {t('landing.diet.metrics.foodDb.label', '內置食物庫')}
              </div>
              <div className="h-7 sm:h-8 flex items-baseline gap-1 text-xl sm:text-2xl font-semibold tabular-nums text-foreground font-mono">
                {t('landing.diet.metrics.foodDb.value', '420+')} <span className="text-xs font-normal text-muted-foreground font-sans">{t('landing.diet.metrics.foodDb.unit', '項')}</span>
              </div>
              <div className="font-sans text-xs text-muted-foreground leading-snug">
                {t('landing.diet.metrics.foodDb.desc', '標準原型生重，杜絕熟重偏差')}
              </div>
            </div>

            {/*  指標 2: 允許自定食譜  */}
            <div className="p-3 bg-background flex flex-col space-y-1 hover:bg-hover transition-colors">
              <div className="text-xs text-muted-foreground uppercase tracking-wider h-4 flex items-center">
                {t('landing.diet.metrics.recipes.label', '複合菜餚')}
              </div>
              <div className="h-7 sm:h-8 flex items-baseline gap-1 text-xl sm:text-2xl font-semibold tabular-nums text-foreground font-mono">
                {t('landing.diet.metrics.recipes.value', '∞')} <span className="text-xs font-normal text-muted-foreground font-sans">{t('landing.diet.metrics.recipes.unit', '自訂')}</span>
              </div>
              <div className="font-sans text-xs text-muted-foreground leading-snug">
                {t('landing.diet.metrics.recipes.desc', '自由組合食物，純 ID 引用無漂移')}
              </div>
            </div>

            {/*  指標 3: 烹調油黑盒歸零  */}
            <div className="p-3 bg-background flex flex-col space-y-1 hover:bg-hover transition-colors">
              <div className="text-xs text-muted-foreground uppercase tracking-wider h-4 flex items-center">
                {t('landing.diet.metrics.oil.label', '烹調黑盒')}
              </div>
              <div className="h-7 sm:h-8 flex items-baseline gap-1 text-xl sm:text-2xl font-semibold tabular-nums text-foreground font-mono">
                {t('landing.diet.metrics.oil.value', '0')} <span className="text-xs font-normal text-muted-foreground font-sans">{t('landing.diet.metrics.oil.unit', '隱藏油')}</span>
              </div>
              <div className="font-sans text-xs text-muted-foreground leading-snug">
                {t('landing.diet.metrics.oil.desc', '用油獨立計量，終結熱量盲區')}
              </div>
            </div>
          </div>

        </div>

        {/*  右側欄：飲食頁面展示 (手機端橫向吸附，平板／桌面端自適應雙欄)  */}
        <div className="w-[85vw] max-w-[360px] sm:max-w-[400px] md:w-auto md:max-w-none md:col-span-6 lg:col-span-7 lg:max-w-[460px] shrink-0 snap-start">
          <div className="w-full rounded-xl border border-border bg-background overflow-hidden shadow-none transition-colors duration-200">
            
            {/* 模擬視窗狀態列 (Window Chrome Bar) */}
            <div className="px-4 py-2 border-b border-border flex items-center justify-between font-mono text-xs bg-muted select-none pointer-events-none">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-border"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-border"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-border"></span>
              </div>
              <div className="flex items-center space-x-1 font-sans text-xs text-muted-foreground">
                <BrandWordmark className="text-foreground" />
                <span className="text-muted-foreground">/</span>
                <span>{t('landing.diet.windowBar.module', '飲食')}</span>
              </div>
              <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full border border-border bg-background text-xs font-sans text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                <span className="font-medium">{t('landing.diet.windowBar.synced', '已同步')}</span>
              </div>
            </div>

            {/* 核心真實 React 飲食頁面元件 (等比縮放 78%，早餐展開飲食分流選單) */}
            <div className="p-3 sm:p-4 bg-background select-none pointer-events-none" style={{ zoom: 0.78 }}>
              <DietView {...demoDietData} interactive={false} expandedMealPopover="breakfast" />
            </div>

          </div>
        </div>

      </div>

    </div>
  </section>

  {/*  =========================================================================  */}
  {/*  03. STRENGTH & BIOMECHANICS (訓練記錄)                                     */}
  {/*  =========================================================================  */}
  <section id="workout" className="py-14 sm:py-20 px-4 sm:px-8 border-b border-border bg-muted transition-colors duration-200">
    <div className="max-w-6xl mx-auto space-y-5 md:space-y-10">
      
      <div className="space-y-3 max-w-3xl">
        <div className="font-mono text-xs text-telemetry-accent uppercase tracking-widest">
          {t('landing.workout.tag', '[ 02 / 訓練 ]')}
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight font-sans text-foreground leading-tight">
          {t('landing.workout.titleLine1', '肌力生物力學與組數表')}
          <span className="block mt-1 text-muted-foreground font-sans text-xl sm:text-2xl font-normal">{t('landing.workout.titleLine2', '解剖熱圖、有效組數與純數學 e1RM')}</span>
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base leading-relaxed font-sans">
          {t('landing.workout.desc', '嚴格區分熱身組與正式組，真實記錄重量與次數。透過成熟的 Brzycki / Epley 公式估算極限力量，自動統計每週有效訓練組數分佈，拒絕未經科學驗證的隨意評分。')}
        </p>
      </div>

      {/* 方案 3：三欄等高點陣畫布視窗（桌面版三欄齊底；手機版左右橫向滑動） */}
      <div className="-mr-4 pr-4 sm:-mr-8 sm:pr-8 md:mr-0 md:pr-0 flex flex-row items-stretch gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1 md:pb-0 md:overflow-visible md:grid md:grid-cols-3 md:gap-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[
          {
            key: 'anatomy',
            content: (
              <WorkoutRecoveryDashboard
                recoverySummary={demoDashboardData.recoverySummary}
                exerciseCount={demoDashboardData.stats.exerciseCount}
                setCount={demoDashboardData.stats.setCount}
                totalVolume={demoDashboardData.stats.totalVolume}
                weightUnit={demoDashboardData.bodyWeightUnit}
                interactive={true}
              />
            ),
          },
          {
            key: 'sets',
            content: (
              <div className="space-y-3">
                {demoWorkoutExercisesData.map((ex) => (
                  <WorkoutExerciseCard
                    key={ex.exerciseName}
                    exerciseName={ex.exerciseName}
                    sets={ex.sets}
                    bodyWeightUnit={ex.bodyWeightUnit}
                    interactive={false}
                  />
                ))}
              </div>
            ),
          },
          {
            key: 'analytics',
            content: (
              <ExerciseOverviewCard
                exerciseName={demoExerciseOverview.exerciseName}
                equipmentName={demoExerciseOverview.equipmentName}
                isArchived={demoExerciseOverview.isArchived}
                bestE1RM={demoExerciseOverview.bestE1RM}
                totalSets={demoExerciseOverview.totalSets}
                totalVolume={demoExerciseOverview.totalVolume}
                bodyWeightUnit={demoExerciseOverview.bodyWeightUnit}
                heatmapDays={demoExerciseOverview.heatmapDays}
                totalWeeks={demoExerciseOverview.totalWeeks}
                overviewPeriod={demoExerciseOverview.overviewPeriod}
                interactive={false}
              />
            ),
          },
        ].map((win) => (
          <ShowcaseFrameWindow
            key={win.key}
            className="w-[85vw] max-w-[360px] sm:max-w-[400px] md:w-full md:max-w-none md:min-w-0 shrink-0 snap-start"
            bodyClassName="p-3 lg:p-4"
          >
            <div className="w-full md:max-[900px]:[zoom:0.72] min-[900px]:max-lg:[zoom:0.84]">
              {win.content}
            </div>
          </ShowcaseFrameWindow>
        ))}
      </div>

    </div>
  </section>

  {/*  =========================================================================  */}
  {/*  04. BODY & PHYSIOLOGICAL EMA FILTER (體態記錄)                             */}
  {/*  =========================================================================  */}
  <section id="body" className="py-14 sm:py-20 px-4 sm:px-8 border-b border-border bg-background transition-colors duration-200">
    <div className="max-w-6xl mx-auto space-y-5 md:space-y-10">
      
      <div className="space-y-3 max-w-3xl">
        <div className="font-mono text-xs text-telemetry-accent uppercase tracking-widest">
          {t('landing.body.tag', '[ 03 / 體態 ]')}
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight font-sans text-foreground leading-tight">
          {t('landing.body.titleLine1', '過濾水分波動，看懂真實體態')}
          <span className="block mt-1 text-muted-foreground font-sans text-xl sm:text-2xl font-normal">{t('landing.body.titleLine2', '7 天平滑曲線、身體圍度追蹤與客觀進展')}</span>
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base leading-relaxed font-sans">
          <BrandText text={t('landing.body.desc', '喝水多寡與重鹹飲食，常讓單日體重上下跳動 1～2 公斤。e2Cal 自動過濾水分干擾，幫你算出身體的真實增減趨勢；同步支援胸圍、腰圍等圍度追蹤，只擺客觀事實，告別體重焦慮。')} />
        </p>
      </div>

      {/* 桌面版：7:5 非對稱雙欄（三張實物元件均以統一點陣畫布視窗包裹，左右頂底等高齊平） */}
      <div className="hidden md:grid md:grid-cols-12 gap-4 items-stretch">
        <ShowcaseFrameWindow
          footerLeft={t('landing.body.chartFooter', '實線為 7 天抗噪平滑體重 · 空心點為每日原始稱重')}
          footerRight={`Δ ${demoBodyTrendSummary.deltaText}`}
          className="md:col-span-7"
          bodyClassName="p-5"
        >
          <WeightTrendChart
            data={DEMO_WEIGHT_TREND_DATA}
            unit={demoDashboardData.bodyWeightUnit}
            interactive={false}
          />
        </ShowcaseFrameWindow>

        <div className="md:col-span-5 flex flex-col gap-4">
          <ShowcaseFrameWindow bodyClassName="p-4">
            <BodyTodayDataCard
              {...DEMO_BODY_TODAY_DATA}
              interactive={false}
            />
          </ShowcaseFrameWindow>

          <ShowcaseFrameWindow bodyClassName="p-4">
            <BodyMetricsOverviewCard
              {...DEMO_BODY_METRICS_DATA}
              interactive={false}
            />
          </ShowcaseFrameWindow>
        </div>
      </div>

      {/* 手機版：左右橫向滑動三張等高點陣畫布視窗（左側與其他區塊嚴格對齊） */}
      <div className="md:hidden -mr-4 pr-4 sm:-mr-8 sm:pr-8 flex flex-row items-stretch gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ShowcaseFrameWindow
          footerLeft={t('landing.body.chartFooter', '實線為 7 天抗噪平滑體重 · 空心點為每日原始稱重')}
          footerRight={`Δ ${demoBodyTrendSummary.deltaText}`}
          className="w-[85vw] max-w-[360px] sm:max-w-[400px] shrink-0 snap-start"
          bodyClassName="p-4"
        >
          <WeightTrendChart
            data={DEMO_WEIGHT_TREND_DATA}
            unit={demoDashboardData.bodyWeightUnit}
            interactive={false}
          />
        </ShowcaseFrameWindow>

        <ShowcaseFrameWindow
          className="w-[85vw] max-w-[360px] sm:max-w-[400px] shrink-0 snap-start"
          bodyClassName="p-4"
        >
          <BodyTodayDataCard
            {...DEMO_BODY_TODAY_DATA}
            interactive={false}
          />
        </ShowcaseFrameWindow>

        <ShowcaseFrameWindow
          className="w-[85vw] max-w-[360px] sm:max-w-[400px] shrink-0 snap-start"
          bodyClassName="p-4"
        >
          <BodyMetricsOverviewCard
            {...DEMO_BODY_METRICS_DATA}
            interactive={false}
          />
        </ShowcaseFrameWindow>
      </div>

    </div>
  </section>

  {/*  =========================================================================  */}
  {/*  05. ANALYTICS & DATA SHARING (分析功能：不接黑盒 AI，數據自由給外部)            */}
  {/*  =========================================================================  */}
  <section id="analytics" className="py-14 sm:py-20 px-4 sm:px-8 border-b border-border bg-muted transition-colors duration-200">
    <div className="max-w-6xl mx-auto">
      {/* 方案 1：12 欄互動式格式檢視器（左 5 欄標題＋格式切換 · 右 7 欄等高預覽窗；手機版橫向滑動三張格式卡） */}
      <ShareShowcaseCards
        header={
          <div className="space-y-3">
            <div className="font-mono text-xs text-telemetry-accent uppercase tracking-widest">
              {t('landing.analytics.tag', '[ 04 / 分析 ]')}
            </div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight font-sans text-foreground leading-tight">
              {t('landing.analytics.titleLine1', '內部零黑盒 AI')}
              <span className="block mt-1 text-muted-foreground font-sans text-xl sm:text-2xl font-normal">
                {t('landing.analytics.titleLine2', '外部開放自由分析')}
              </span>
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed font-sans">
              <BrandText text={t('landing.analytics.desc', '我們不在軟體裡塞入未經科學驗證的 AI 評分機制。e2Cal 的職責是提供毫秒級的客觀事實，並主動幫你整理好格式：一鍵導出為適合 ChatGPT 與 Claude 的對話文字，或一張精緻的長圖。分析的自由與決策權，始終 100% 握在你手裡。')} />
            </p>
          </div>
        }
      />
    </div>
  </section>

  {/*  =========================================================================  */}
  {/*  06. SYNC & UNIVERSAL PWA (Dropbox 同步與 PWA 通用)                          */}
  {/*  =========================================================================  */}
  <section id="sync" className="py-14 sm:py-20 px-4 sm:px-8 border-b border-border bg-background transition-colors duration-200">
    <div className="max-w-6xl mx-auto">
      {/* 方案 1：左文右圖 5:7 非對稱分欄（與下方 06 / 原則 12 欄結構同頻） */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-8 lg:gap-12 items-start">
        {/* 左欄：標題、說明與 3 行核心規格卡 */}
        <div className="md:col-span-5 space-y-5">
          <div className="space-y-3">
            <div className="font-mono text-xs text-telemetry-accent uppercase tracking-widest">
              {t('landing.sync.tag', '[ 05 / 同步 ]')}
            </div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight font-sans text-foreground leading-tight">
              {t('landing.sync.titleLine1', '數據完全歸你，斷網也能秒開記錄')}
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed font-sans">
              {t('landing.sync.desc', '你的身體數據不經過任何第三方雲端伺服器，直接保存在手機與電腦中。需要多設備同步時直連你的個人 Dropbox，斷網依然流暢好用，隨時都能一鍵完整打包帶走。')}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background overflow-hidden divide-y divide-border font-mono text-xs">
            {[
              {
                label: t('landing.sync.specs.engineLabel', '本地引擎'),
                value: t('landing.sync.specs.engineValue', 'IndexedDB · 離線秒開'),
              },
              {
                label: t('landing.sync.specs.syncLabel', '多端同步'),
                value: t('landing.sync.specs.syncValue', '個人 Dropbox · PKCE 直連'),
              },
              {
                label: t('landing.sync.specs.exportLabel', '遷移自由'),
                value: t('landing.sync.specs.exportValue', '單檔 ZIP 匯出 · 零鎖定'),
              },
            ].map((row) => (
              <div
                key={row.label}
                className="min-h-9 py-2 px-4 flex items-center justify-between gap-3"
              >
                <span className="text-muted-foreground shrink-0">{row.label}</span>
                <span className="text-foreground text-right">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 右欄：滿格同步拓撲圖 */}
        <div className="md:col-span-7">
          <SyncTopologyDiagram />
        </div>
      </div>
    </div>
  </section>

  {/*  =========================================================================  */}
  {/*  07. WHY WE DON'T DO XX (為什麼我們不做 xx)                                  */}
  {/*  =========================================================================  */}
  <section id="non-goals" className="py-14 sm:py-20 px-4 sm:px-8 border-b border-border bg-muted transition-colors duration-200">
    <div className="max-w-6xl mx-auto">
      {/* 方案 3：Editorial Manifesto Split（左宣言 + 四項 0 規格卡，右 Diff 帳本；手機端右側支援橫向 snap 滾動） */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-8 lg:gap-12 items-start">
        {/* 左欄：宣言與 4 項「0」邊界計數卡 */}
        <div className="md:col-span-4 md:sticky md:top-24 space-y-5">
          <div className="space-y-3">
            <div className="font-mono text-xs text-telemetry-accent uppercase tracking-widest">
              {t('landing.principles.tag', '[ 06 / 原則 ]')}
            </div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight font-sans text-foreground leading-tight">
              {t('landing.principles.titleLine1', '拒絕製造焦慮')}
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed font-sans">
              <BrandText
                text={t(
                  'landing.principles.manifestoDesc',
                  '不搞社交、不催打卡、不給指令、不做成品黑盒。e2Cal 是一把冷靜的記錄工具，刻意切除所有消耗注意力的套路。'
                )}
              />
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background overflow-hidden divide-y divide-border font-mono text-xs">
            {[
              t('landing.principles.summary.grading', '評分與指令'),
              t('landing.principles.summary.social', '社交與排行'),
              t('landing.principles.summary.streaks', '斷簽與催促'),
              t('landing.principles.summary.blackbox', '成品菜黑盒'),
            ].map((label) => (
              <div
                key={label}
                className="h-9 px-4 flex items-center justify-between text-muted-foreground"
              >
                <span>{label}</span>
                <span className="text-foreground font-medium tabular-nums">0</span>
              </div>
            ))}
          </div>
        </div>

        {/* 右欄：桌面端為垂直 Diff 帳本，手機端支援左右滑動切換卡片 */}
        <div className="md:col-span-8 flex flex-row overflow-x-auto snap-x snap-mandatory scroll-smooth gap-3 sm:gap-4 pb-1 -mr-4 pr-4 sm:-mr-8 sm:pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mr-0 md:pr-0 md:pb-0 md:block md:overflow-visible md:divide-y md:divide-border">
          {[
            {
              index: '01',
              title: t('landing.principles.items.item1.title', '拒絕黑盒說教與主觀評判'),
              desc: t(
                'landing.principles.items.item1.desc',
                '我們嚴禁在軟體中指示「你少吃了」、「你吃超標了」或「你退步了」；絕對不設置帶有羞辱感的紅色警報卡片。軟體是冷靜的鏡子，決策權 100% 歸還使用者。'
              ),
              legacyBad: t(
                'landing.principles.items.item1.legacyBad',
                '今天碳水太高了，明天多跑 40 分鐘消耗。'
              ),
              diffGood: t(
                'landing.principles.items.item1.diffGood',
                '2,180 / 2,000 kcal · 超出 +180 kcal（僅呈現客觀事實）'
              ),
            },
            {
              index: '02',
              title: t('landing.principles.items.item2.title', '拒絕同儕焦慮與動態打擾'),
              desc: t(
                'landing.principles.items.item2.desc',
                '沒有動態廣場、沒有點讚排行、沒有同儕比較。自我量化是一場自己與物理事實的嚴肅對話，無須向外界表演自律。'
              ),
              legacyBad: t(
                'landing.principles.items.item2.legacyBad',
                '小陳的體脂高於 90% 同齡人，努力加油超越他吧。'
              ),
              diffGood: t(
                'landing.principles.items.item2.diffGood',
                '僅儲存於本機 IndexedDB · 無公開動態'
              ),
            },
            {
              index: '03',
              title: t('landing.principles.items.item3.title', '真正的自律不需要外部羞恥機制'),
              desc: t(
                'landing.principles.items.item3.desc',
                '不設置斷簽警告或紅點催促。今天記錄，今天就是事實；今天沒記，明天打開依舊是一把乾淨、隨時待命的記錄工具。'
              ),
              legacyBad: t(
                'landing.principles.items.item3.legacyBad',
                '已斷簽，看廣告或花費 50 鑽石補簽。'
              ),
              diffGood: t(
                'landing.principles.items.item3.diffGood',
                '記或不記都是事實 · 隨時安靜待命'
              ),
            },
            {
              index: '04',
              title: t(
                'landing.principles.items.item4.title',
                '拒絕「一碗紅燒牛肉麵 = 750 大卡」的黑盒謊言'
              ),
              desc: t(
                'landing.principles.items.item4.desc',
                '成品菜估算充滿了不可控的烹調油與吸水率偏差。e2Cal 堅持以原子食物生重為唯一真理源，引導使用者建立真正的克數秤重感知。'
              ),
              legacyBad: t(
                'landing.principles.items.item4.legacyBad',
                '固定計算：紅燒牛肉麵 1 碗 = 750 大卡'
              ),
              diffGood: t(
                'landing.principles.items.item4.diffGood',
                '牛腱 150 g · 麵 80 g · 橄欖油 8 g'
              ),
            },
          ].map((item) => (
            <article
              key={item.index}
              className="w-[85vw] max-w-[360px] sm:max-w-[400px] shrink-0 snap-start rounded-lg border border-border bg-background p-4 flex flex-col justify-between gap-4 md:w-auto md:max-w-none md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-6 md:first:pt-0"
            >
              <div className="space-y-3">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-muted-foreground shrink-0">
                    {item.index}
                  </span>
                  <h3 className="text-sm sm:text-base font-sans font-semibold tracking-tight text-foreground leading-snug">
                    {item.title}
                  </h3>
                </div>
                <p className="md:pl-7 text-xs sm:text-sm text-muted-foreground font-sans leading-relaxed">
                  <BrandText text={item.desc} />
                </p>
              </div>

              <div className="md:ml-7 rounded-lg border border-border overflow-hidden font-mono text-xs">
                <div className="px-3 py-2 bg-destructive-subtle border-b border-border flex items-start gap-2 text-muted-foreground">
                  <span className="text-destructive font-semibold shrink-0 select-none">-</span>
                  <span className="line-through leading-relaxed">{item.legacyBad}</span>
                </div>
                <div className="px-3 py-2 bg-background flex items-start gap-2 text-foreground">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold shrink-0 select-none">+</span>
                  <span className="leading-relaxed">{item.diffGood}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  </section>

  {/*  =========================================================================  */}
  {/*  08. TECHNICAL ARCHITECTURE & LAUNCH CTA (技術棧與收尾啟動)                   */}
  {/*  =========================================================================  */}
  <section id="tech" className="py-14 sm:py-20 px-4 sm:px-8 border-b border-border bg-background transition-colors duration-200">
    <div className="max-w-6xl mx-auto">
      {/* 方案 1：12 欄左宣言＋開啟應用 CTA · 右 5 列精簡技術棧表 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-8 lg:gap-12 md:items-stretch">
        {/* 左欄：精簡技術宣言與最終啟動按鈕 */}
        <div className="md:col-span-5 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <div className="font-mono text-xs text-telemetry-accent uppercase tracking-widest">
              {t('landing.tech.tag', '[ 07 / 技術 ]')}
            </div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight font-sans text-foreground leading-tight">
              {t('landing.tech.titleLine1', '可靠，源自極致克制')}
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed font-sans">
              <BrandText
                text={t(
                  'landing.tech.summaryDesc',
                  '零第三方追蹤、純本地計算、永不損毀數據。e2Cal 採用極簡現代 Web 技術棧，確保每一次點擊都毫秒級確定響應。'
                )}
              />
            </p>
          </div>

          <div className="space-y-3">
            <LaunchAppMenu
              label={t('common.openApp', '開啟應用')}
              isSetupCompleted={isSetupReady}
              onOpenApp={handleOpenApp}
              onSelectFirstTime={() => setIsSetupDialogOpen(true)}
              onSelectCloudImport={() => setIsCloudImportDialogOpen(true)}
              onSelectLocalImport={() => setIsLocalImportDialogOpen(true)}
              align="start"
              triggerClassName="w-full sm:w-auto"
            />
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>{t('landing.tech.ctaNote', '無須註冊 · 離線可用 · 數據 100% 存於本機')}</span>
            </div>
          </div>
        </div>

        {/* 右欄：桌面版 5 列技術棧表 · 手機版 2 列橫向滑動卡片 */}
        <div className="md:col-span-7">
          {(() => {
            const techStackRows = [
              {
                key: 'core',
                label: t('landing.tech.stack.core.label', '前端核心'),
                desc: t('landing.tech.stack.core.desc', '嚴格型別約束與極速打包構建'),
                chips: ['React 19', 'TypeScript', 'Vite 8'],
              },
              {
                key: 'ui',
                label: t('landing.tech.stack.ui.label', '介面與字體'),
                desc: t('landing.tech.stack.ui.desc', '極簡無陰影系統與離線等寬字體'),
                chips: ['Tailwind CSS 4', 'Base UI', 'Geist'],
              },
              {
                key: 'storage',
                label: t('landing.tech.stack.storage.label', '本地資料庫'),
                desc: t('landing.tech.stack.storage.desc', '原生持久化儲存與平滑版本遷移'),
                chips: ['IndexedDB', 'Dexie.js', 'Zustand'],
              },
              {
                key: 'sync',
                label: t('landing.tech.stack.sync.label', '離線與同步'),
                desc: t('landing.tech.stack.sync.desc', '全靜態快取、直連私密同步與整包匯出'),
                chips: ['PWA / Workbox', 'Dropbox PKCE', 'JSZip'],
              },
              {
                key: 'quality',
                label: t('landing.tech.stack.quality.label', '數學與測試防線'),
                desc: t('landing.tech.stack.quality.desc', '純函數演算與 546 項自動化單元測試'),
                chips: ['Vitest', 'Zod', 'Oxlint'],
              },
            ];

            return (
              <>
                {/* 平板／桌面版：單一 5 列垂直規格表 */}
                <div className="hidden md:flex h-full rounded-lg border border-border bg-card overflow-hidden divide-y divide-border flex-col">
                  {techStackRows.map((row) => (
                    <div
                      key={row.key}
                      className="flex-1 px-4 py-3 flex flex-row items-center justify-between gap-4 hover:bg-hover transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground font-sans">
                          {row.label}
                        </div>
                        <div className="text-xs text-muted-foreground font-sans mt-0.5">
                          {row.desc}
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
                        {row.chips.map((chip) => (
                          <span
                            key={chip}
                            className="inline-flex items-center px-2 py-0.5 rounded border border-border bg-card font-mono text-xs text-foreground whitespace-nowrap"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 手機版：兩列橫向滑動卡片（左側與其他區塊嚴格對齊） */}
                <div className="md:hidden -mr-4 sm:-mr-8 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="grid grid-flow-col grid-rows-2 auto-cols-[78vw] sm:auto-cols-[310px] gap-3 w-max pr-4 sm:pr-8">
                    {techStackRows.map((row) => (
                      <div
                        key={row.key}
                        className="snap-start rounded-lg border border-border bg-card p-4 flex flex-col justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground font-sans">
                            {row.label}
                          </div>
                          <div className="text-xs text-muted-foreground font-sans mt-0.5 leading-snug">
                            {row.desc}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {row.chips.map((chip) => (
                            <span
                              key={chip}
                              className="inline-flex items-center px-2 py-0.5 rounded border border-border bg-card font-mono text-xs text-foreground whitespace-nowrap"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  </section>

  {/*  =========================================================================  */}
  {/*  FOOTER                                                                     */}
  {/*  =========================================================================  */}
  <footer className="py-12 px-4 sm:px-8 bg-muted border-t border-border font-mono text-xs text-muted-foreground transition-colors duration-200">
    <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-6">
      
      <div className="flex items-center gap-2">
        <Logo
          size={24}
          showBorder={false}
          className="w-6 h-6 border border-transparent dark:border-border"
        />
        <BrandWordmark className="text-sm text-foreground" />
      </div>

      <div className="flex items-center space-x-6 text-xs">
        <a
          href="#hero"
          onClick={(e) => {
            e.preventDefault();
            scrollToSection("hero");
          }}
          className="hover:text-foreground transition-colors cursor-pointer"
        >
          {t('landing.nav.backToTop', '回到頂部 ↑')}
        </a>
        <a onClick={(e) => { e.preventDefault(); scrollToSection("diet"); }} href="#diet" className="hover:text-foreground transition-colors">{t('landing.nav.diet', '飲食')}</a>
        <a onClick={(e) => { e.preventDefault(); scrollToSection("workout"); }} href="#workout" className="hover:text-foreground transition-colors">{t('landing.nav.workout', '訓練')}</a>
        <a onClick={(e) => { e.preventDefault(); scrollToSection("body"); }} href="#body" className="hover:text-foreground transition-colors">{t('landing.nav.body', '體態')}</a>
        <a onClick={(e) => { e.preventDefault(); scrollToSection("tech"); }} href="#tech" className="hover:text-foreground transition-colors">{t('landing.nav.specs', '規格')}</a>
      </div>

      <div>
        {t('landing.footer.license', 'MIT License · Local-First Architecture · 2026')}
      </div>

    </div>
  </footer>

  <SetupProfileDialog
    open={isSetupDialogOpen}
    onOpenChange={setIsSetupDialogOpen}
    onComplete={(name) => {
      setIsSetupDialogOpen(false);
      setWelcomeUserName(name || profile.name || '');
      setIsTransitionOpen(true);
    }}
  />

  <DropboxSyncDialog
    open={isCloudImportDialogOpen}
    onOpenChange={setIsCloudImportDialogOpen}
    isAuthenticated={false}
    title={t('landing.launchMenu.cloudDialogTitle', '雲端導入')}
    description={t(
      'landing.launchMenu.cloudDialogDesc',
      '連線至個人 Dropbox，將既有飲食、訓練與體態資料還原至此裝置。'
    )}
    actionLabel={t('landing.launchMenu.cloudConnectAction', '連線 Dropbox')}
    onConnectDropbox={() => {
      void handleConfirmCloudImport();
    }}
  />

  <LocalImportDialog
    open={isLocalImportDialogOpen}
    onOpenChange={setIsLocalImportDialogOpen}
    onComplete={handleDataRestored}
  />

  <InitialSyncModal onCompleted={handleDataRestored} />

  <WelcomeTransitionOverlay
    open={isTransitionOpen}
    userName={welcomeUserName}
    onFinish={() => navigate('/app')}
  />

  <Toaster />

  {/*  =========================================================================  */}
  {/*  JAVASCRIPT CONTROLLERS (LIGHT / DARK THEME MANAGER)                        */}
  {/*  =========================================================================  */}
  


    </div>
  );
}
