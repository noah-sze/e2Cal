import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Compass,
  Download,
  Ellipsis,
  MoreVertical,
  PlusSquare,
  Share,
  SquarePlus,
} from 'lucide-react';
import { Dialog, PrecisionDialogContent } from '@/components/ui/dialog';
import { SectionCard } from '@/components/ui/section-card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { useHoldToDelete } from '@/hooks/useHoldToDelete';
import { downloadBackupZip } from '@/services/backup/exportBackupZip';
import {
  detectPwaPlatform,
  type PwaGuidePlatform,
} from '@/utils/pwaPlatform';

export interface PwaInstallGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHidePrompt: () => void;
}

type GuideBadgeIcon =
  | 'share'
  | 'plusSquare'
  | 'moreVertical'
  | 'ellipsis'
  | 'download'
  | 'compass'
  | 'dock'
  | 'none';

interface GuideStepConfig {
  prefixKey: string;
  badgeKey: string;
  badgeIcon: GuideBadgeIcon;
  suffixKey: string;
}

type GuideOs = 'ios' | 'android' | 'macos' | 'windows';

interface BrowserOption {
  value: string;
  label: string;
  target: PwaGuidePlatform;
}

const OS_OPTIONS: readonly { value: GuideOs; label: string }[] = [
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
  { value: 'macos', label: 'macOS' },
  { value: 'windows', label: 'Windows' },
];

const BROWSERS_BY_OS: Record<GuideOs, readonly BrowserOption[]> = {
  ios: [
    { value: 'safari', label: 'Safari', target: 'ios-safari' },
    { value: 'chrome', label: 'Chrome', target: 'ios-chrome' },
  ],
  android: [{ value: 'chrome', label: 'Chrome · Edge', target: 'android-chrome' }],
  macos: [
    { value: 'safari', label: 'Safari', target: 'macos-safari' },
    { value: 'chromium', label: 'Chrome · Edge', target: 'desktop-chromium' },
  ],
  windows: [{ value: 'chromium', label: 'Chrome · Edge', target: 'desktop-chromium' }],
};

function mapPlatformToOsAndBrowser(platform: PwaGuidePlatform): { os: GuideOs; browser: string } {
  switch (platform) {
    case 'ios-safari':
      return { os: 'ios', browser: 'safari' };
    case 'ios-chrome':
      return { os: 'ios', browser: 'chrome' };
    case 'android-chrome':
      return { os: 'android', browser: 'chrome' };
    case 'macos-safari':
      return { os: 'macos', browser: 'safari' };
    case 'desktop-chromium':
      return { os: 'windows', browser: 'chromium' };
  }
}

const PLATFORM_STEPS: Record<PwaGuidePlatform, readonly GuideStepConfig[]> = {
  'ios-safari': [
    {
      prefixKey: 'pwa.steps.iosSafari.s1Prefix',
      badgeKey: 'pwa.badges.share',
      badgeIcon: 'share',
      suffixKey: 'pwa.steps.iosSafari.s1Suffix',
    },
    {
      prefixKey: 'pwa.steps.iosSafari.s2Prefix',
      badgeKey: 'pwa.badges.addToHomeScreen',
      badgeIcon: 'plusSquare',
      suffixKey: 'pwa.steps.iosSafari.s2Suffix',
    },
    {
      prefixKey: 'pwa.steps.iosSafari.s3Prefix',
      badgeKey: 'pwa.badges.add',
      badgeIcon: 'none',
      suffixKey: 'pwa.steps.iosSafari.s3Suffix',
    },
  ],
  'ios-chrome': [
    {
      prefixKey: 'pwa.steps.iosChrome.s1Prefix',
      badgeKey: 'pwa.badges.share',
      badgeIcon: 'share',
      suffixKey: 'pwa.steps.iosChrome.s1Suffix',
    },
    {
      prefixKey: 'pwa.steps.iosChrome.s2Prefix',
      badgeKey: 'pwa.badges.addToHomeScreen',
      badgeIcon: 'plusSquare',
      suffixKey: 'pwa.steps.iosChrome.s2Suffix',
    },
    {
      prefixKey: 'pwa.steps.iosChrome.s3Prefix',
      badgeKey: 'pwa.badges.add',
      badgeIcon: 'none',
      suffixKey: 'pwa.steps.iosChrome.s3Suffix',
    },
  ],
  'android-chrome': [
    {
      prefixKey: 'pwa.steps.androidChrome.s1Prefix',
      badgeKey: 'pwa.badges.browserMenu',
      badgeIcon: 'moreVertical',
      suffixKey: 'pwa.steps.androidChrome.s1Suffix',
    },
    {
      prefixKey: 'pwa.steps.androidChrome.s2Prefix',
      badgeKey: 'pwa.badges.installApp',
      badgeIcon: 'download',
      suffixKey: 'pwa.steps.androidChrome.s2Suffix',
    },
    {
      prefixKey: 'pwa.steps.androidChrome.s3Prefix',
      badgeKey: 'pwa.badges.install',
      badgeIcon: 'none',
      suffixKey: 'pwa.steps.androidChrome.s3Suffix',
    },
  ],
  'macos-safari': [
    {
      prefixKey: 'pwa.steps.macosSafari.s1Prefix',
      badgeKey: 'pwa.badges.share',
      badgeIcon: 'share',
      suffixKey: 'pwa.steps.macosSafari.s1Suffix',
    },
    {
      prefixKey: 'pwa.steps.macosSafari.s2Prefix',
      badgeKey: 'pwa.badges.addToDock',
      badgeIcon: 'dock',
      suffixKey: 'pwa.steps.macosSafari.s2Suffix',
    },
    {
      prefixKey: 'pwa.steps.macosSafari.s3Prefix',
      badgeKey: 'pwa.badges.add',
      badgeIcon: 'none',
      suffixKey: 'pwa.steps.macosSafari.s3Suffix',
    },
  ],
  'desktop-chromium': [
    {
      prefixKey: 'pwa.steps.desktopChromium.s1Prefix',
      badgeKey: 'pwa.badges.installIcon',
      badgeIcon: 'download',
      suffixKey: 'pwa.steps.desktopChromium.s1Suffix',
    },
    {
      prefixKey: 'pwa.steps.desktopChromium.s2Prefix',
      badgeKey: 'pwa.badges.browserMenu',
      badgeIcon: 'moreVertical',
      suffixKey: 'pwa.steps.desktopChromium.s2Suffix',
    },
    {
      prefixKey: 'pwa.steps.desktopChromium.s3Prefix',
      badgeKey: 'pwa.badges.install',
      badgeIcon: 'none',
      suffixKey: 'pwa.steps.desktopChromium.s3Suffix',
    },
  ],
};

function renderBadgeIcon(icon: GuideBadgeIcon) {
  switch (icon) {
    case 'share':
      return <Share className="size-3 shrink-0" />;
    case 'plusSquare':
      return <PlusSquare className="size-3 shrink-0" />;
    case 'moreVertical':
      return <MoreVertical className="size-3 shrink-0" />;
    case 'ellipsis':
      return <Ellipsis className="size-3 shrink-0" />;
    case 'download':
      return <Download className="size-3 shrink-0" />;
    case 'compass':
      return <Compass className="size-3 shrink-0" />;
    case 'dock':
      return <SquarePlus className="size-3 shrink-0" />;
    default:
      return null;
  }
}

interface ActionPillProps {
  icon: GuideBadgeIcon;
  label: string;
  inverted?: boolean;
}

function ActionPill({ icon, label, inverted = false }: ActionPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 h-5 px-1.5 mx-1 rounded border font-sans text-2xs leading-none font-medium align-middle -translate-y-0.5 whitespace-nowrap',
        inverted
          ? 'border-background/30 bg-background/15 text-background'
          : 'border-border bg-muted text-foreground'
      )}
    >
      {renderBadgeIcon(icon)}
      <span>{label}</span>
    </span>
  );
}

export function PwaInstallGuideDialog({
  open,
  onOpenChange,
  onHidePrompt,
}: PwaInstallGuideDialogProps) {
  const { t } = useTranslation();

  const detection = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return detectPwaPlatform({ userAgent: '' });
    }
    return detectPwaPlatform({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
    });
  }, []);

  const initialSelection = useMemo(
    () => mapPlatformToOsAndBrowser(detection.platform),
    [detection.platform]
  );

  const [selectedOs, setSelectedOs] = useState<GuideOs>(initialSelection.os);
  const [selectedBrowser, setSelectedBrowser] = useState<string>(initialSelection.browser);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedOs(initialSelection.os);
      setSelectedBrowser(initialSelection.browser);
    }
  }, [open, initialSelection.os, initialSelection.browser]);

  const availableBrowsers = BROWSERS_BY_OS[selectedOs];
  const activeBrowserOption =
    availableBrowsers.find((b) => b.value === selectedBrowser) ?? availableBrowsers[0];
  const selectedPlatform = activeBrowserOption.target;
  const isIosPlatform = selectedOs === 'ios';
  const currentOsLabel = OS_OPTIONS.find((o) => o.value === selectedOs)?.label ?? 'iOS';
  const steps = PLATFORM_STEPS[selectedPlatform];

  const handleExportBackup = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await downloadBackupZip();
      triggerHaptic('success');
      toast.show(t('settings.exported'));
    } catch {
      toast.show(t('common.error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleHidePrompt = () => {
    onHidePrompt();
    onOpenChange(false);
    toast.show(t('pwa.hiddenToast'));
  };

  const {
    progress: hideProgress,
    isHolding: isHoldingHide,
    handlers: holdToHideHandlers,
  } = useHoldToDelete({
    onConfirm: handleHidePrompt,
    durationMs: 500,
    hintText: t('pwa.dontShowAgain'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PrecisionDialogContent
        title={t('pwa.guideTitle')}
        onClose={() => onOpenChange(false)}
        cancelAriaLabel={t('common.close')}
      >
        <div className="pt-3.5 space-y-3 max-h-[78dvh] overflow-y-auto">
          {/* App 內建瀏覽器（微信、LINE、IG 等）高對比反白第 0 步引導卡 */}
          {detection.isInAppBrowser && (
            <div className="border border-foreground rounded-lg p-3 bg-foreground text-background space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center h-[18px] px-1.5 rounded bg-background text-foreground font-mono text-3xs font-bold uppercase tracking-widest">
                  {t('pwa.inAppBadge')}
                </span>
                <span className="font-sans text-xs font-semibold text-background">
                  {t('pwa.inAppTitle')}
                </span>
              </div>
              <p className="font-sans text-xs text-background/90 leading-6">
                {t('pwa.inAppPrefix')}
                <ActionPill inverted icon="ellipsis" label={t('pwa.badges.moreMenu')} />
                {t('pwa.inAppMiddle')}
                <ActionPill
                  inverted
                  icon="compass"
                  label={
                    detection.isIos
                      ? t('pwa.badges.openInSafari')
                      : t('pwa.badges.openInBrowser')
                  }
                />
                {t('pwa.inAppSuffix')}
              </p>
            </div>
          )}

          {/* 段落 1: 裝置環境（平台與瀏覽器拆分為兩個獨立列） */}
          <SectionCard title={t('pwa.environmentTitle', '裝置環境')} bodyClassName="text-xs font-sans">
            <div className="h-10 px-4 flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs shrink-0">
                {t('pwa.platformLabel', '平台')}
              </span>
              <Select
                value={selectedOs}
                onValueChange={(val) => {
                  if (!val) return;
                  const nextOs = val as GuideOs;
                  triggerHaptic('selection');
                  setSelectedOs(nextOs);
                  const nextBrowsers = BROWSERS_BY_OS[nextOs];
                  if (!nextBrowsers.some((b) => b.value === selectedBrowser)) {
                    setSelectedBrowser(nextBrowsers[0].value);
                  }
                }}
              >
                <SelectTrigger
                  size="custom"
                  iconClassName="size-3 text-muted-foreground/60"
                  className="h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-sans text-xs flex items-center gap-1.5 transition-colors cursor-pointer text-foreground active:scale-95 min-w-0"
                >
                  <SelectValue className="flex-none text-right truncate">
                    {currentOsLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  align="end"
                  className="min-w-36 z-[110]"
                  positionerClassName="z-[110]"
                  backdropClassName="z-[110]"
                >
                  {OS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="h-10 px-4 flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs shrink-0">
                {t('pwa.browserLabel', '瀏覽器')}
              </span>
              <Select
                value={activeBrowserOption.value}
                onValueChange={(val) => {
                  if (!val) return;
                  triggerHaptic('selection');
                  setSelectedBrowser(val);
                }}
              >
                <SelectTrigger
                  size="custom"
                  iconClassName="size-3 text-muted-foreground/60"
                  className="h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-sans text-xs flex items-center gap-1.5 transition-colors cursor-pointer text-foreground active:scale-95 min-w-0"
                >
                  <SelectValue className="flex-none text-right truncate">
                    {activeBrowserOption.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  align="end"
                  className="min-w-40 z-[110]"
                  positionerClassName="z-[110]"
                  backdropClassName="z-[110]"
                >
                  {availableBrowsers.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SectionCard>

          {/* 段落 2: 安裝步驟（SectionCard 單屏同構 + iOS 緊湊匯出列） */}
          <SectionCard
            title={t('pwa.stepsTitle', '安裝步驟')}
            action={
              <span className="font-mono text-3xs text-muted-foreground tracking-wider">
                {t('pwa.stepsCount', '3 STEPS')}
              </span>
            }
            bodyClassName="text-xs font-sans"
          >
            {steps.map((step, index) => (
              <div key={step.prefixKey} className="px-4 py-2.5 flex items-start gap-2.5">
                <span className="font-mono text-2xs text-muted-foreground pt-0.5 shrink-0 tabular-nums">
                  0{index + 1}
                </span>
                <p className="font-sans text-xs text-foreground leading-6 flex-1 min-w-0">
                  {t(step.prefixKey)}
                  <ActionPill icon={step.badgeIcon} label={t(step.badgeKey)} />
                  {t(step.suffixKey)}
                </p>
              </div>
            ))}

            {isIosPlatform && (
              <div className="px-4 py-2.5 bg-muted/50 flex items-center justify-between gap-2">
                <span className="text-2xs text-muted-foreground leading-snug">
                  {t('pwa.iosNotice.shortDesc', 'iOS 沙盒獨立，建議先備份')}
                </span>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  disabled={isExporting}
                  className="h-6 px-2.5 rounded-full border border-border bg-card hover:bg-foreground hover:text-background hover:border-foreground font-mono text-2xs text-foreground flex items-center gap-1 shrink-0 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="size-3" />
                  <span>{isExporting ? '...' : t('pwa.iosNotice.exportShort', '匯出')}</span>
                </button>
              </div>
            )}
          </SectionCard>

          {/* 底部低調快捷操作：長按不再提示 */}
          <button
            type="button"
            {...holdToHideHandlers}
            className="w-full h-8 rounded-md font-sans text-xs text-muted-foreground hover:text-foreground border border-border/40 hover:border-border transition-colors cursor-pointer select-none relative overflow-hidden flex items-center justify-center active:scale-[0.99]"
            aria-label={t('pwa.dontShowAgain')}
          >
            {/* 蓄力進度填充層 */}
            <div
              className={cn(
                'absolute inset-y-0 left-0 bg-foreground/10 pointer-events-none',
                isHoldingHide ? 'transition-none' : 'transition-[width] duration-150 ease-out'
              )}
              style={{ width: `${hideProgress * 100}%` }}
            />
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              <span>{t('pwa.dontShowAgain')}</span>
            </span>
          </button>
        </div>
      </PrecisionDialogContent>
    </Dialog>
  );
}
