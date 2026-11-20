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
import { Button } from '@/components/ui/button';
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

const PLATFORM_OPTIONS: readonly { value: PwaGuidePlatform; labelKey: string }[] = [
  { value: 'ios-safari', labelKey: 'pwa.platforms.iosSafari' },
  { value: 'ios-chrome', labelKey: 'pwa.platforms.iosChrome' },
  { value: 'android-chrome', labelKey: 'pwa.platforms.androidChrome' },
  { value: 'macos-safari', labelKey: 'pwa.platforms.macosSafari' },
  { value: 'desktop-chromium', labelKey: 'pwa.platforms.desktopChromium' },
];

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
}

function ActionPill({ icon, label }: ActionPillProps) {
  return (
    <span className="inline-flex items-center gap-1 h-5 px-1.5 mx-1 rounded border border-border bg-muted font-sans text-2xs leading-none font-medium text-foreground align-middle -translate-y-0.5 whitespace-nowrap">
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

  const [selectedPlatform, setSelectedPlatform] = useState<PwaGuidePlatform>(
    detection.platform
  );
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedPlatform(detection.platform);
    }
  }, [open, detection.platform]);

  const isIosPlatform =
    selectedPlatform === 'ios-safari' || selectedPlatform === 'ios-chrome';

  const currentPlatformOption =
    PLATFORM_OPTIONS.find((opt) => opt.value === selectedPlatform) ??
    PLATFORM_OPTIONS[0];
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
        <div className="pt-3.5 space-y-3 max-h-[75dvh] overflow-y-auto">
          {/* App 內建瀏覽器（微信、LINE、IG 等）第 0 步引導卡 */}
          {detection.isInAppBrowser && (
            <div className="border border-foreground rounded-lg p-3 bg-muted space-y-1.5">
              <div className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-widest text-foreground font-semibold">
                <span>{t('pwa.inAppBadge')}</span>
                <span>·</span>
                <span className="font-sans normal-case tracking-normal">
                  {t('pwa.inAppTitle')}
                </span>
              </div>
              <p className="font-sans text-xs text-foreground leading-6">
                {t('pwa.inAppPrefix')}
                <ActionPill icon="ellipsis" label={t('pwa.badges.moreMenu')} />
                {t('pwa.inAppMiddle')}
                <ActionPill
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

          {/* 設備與瀏覽器選擇列 */}
          <div className="border border-border rounded-lg bg-card h-10 px-3 flex items-center justify-between gap-2">
            <span className="font-sans text-xs text-muted-foreground shrink-0">
              {t('pwa.deviceLabel')}
            </span>
            <Select
              value={selectedPlatform}
              onValueChange={(val) => {
                if (val) {
                  triggerHaptic('selection');
                  setSelectedPlatform(val as PwaGuidePlatform);
                }
              }}
            >
              <SelectTrigger
                size="custom"
                className="flex items-center gap-1 font-mono text-xs text-foreground hover:opacity-80 cursor-pointer transition-opacity min-w-0"
              >
                <SelectValue className="flex-none text-right truncate">
                  {t(currentPlatformOption.labelKey)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="min-w-48">
                {PLATFORM_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* iOS 數據隔離提示與匯出按鈕 */}
          {isIosPlatform && (
            <div className="border border-border rounded-lg p-3 bg-muted/40 space-y-2">
              <div className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-widest text-foreground font-semibold">
                <span>{t('pwa.iosNotice.title')}</span>
              </div>
              <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                {t('pwa.iosNotice.desc')}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportBackup}
                disabled={isExporting}
                className="w-full font-mono text-xs cursor-pointer h-8"
              >
                <Download className="size-3.5" />
                <span>{isExporting ? '...' : t('pwa.iosNotice.export')}</span>
              </Button>
            </div>
          )}

          {/* 傻瓜式編號步驟卡片 */}
          <ol className="border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
            {steps.map((step, index) => (
              <li key={step.prefixKey} className="p-3 flex items-start gap-2.5">
                <span className="size-5 rounded-full border border-border bg-muted font-mono text-2xs font-semibold text-foreground flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                  {index + 1}
                </span>
                <p className="font-sans text-xs text-foreground leading-6 flex-1 min-w-0">
                  {t(step.prefixKey)}
                  <ActionPill
                    icon={step.badgeIcon}
                    label={t(step.badgeKey)}
                  />
                  {t(step.suffixKey)}
                </p>
              </li>
            ))}
          </ol>

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
