import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Dialog, PrecisionDialogContent } from '@/components/ui/dialog';
import { SectionCard } from '@/components/ui/section-card';
import { MetricValue } from '@/components/ui/metric-value';
import { triggerHaptic } from '@/lib/haptics';

export interface RawWeightGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const RICE_STEPS = [
  { methodKey: 'riceSteamed', methodFb: '正常蒸煮', weight: 250, scale: 0.76, kcal: 142 },
  { methodKey: 'ricePorridge', methodFb: '軟爛稀飯', weight: 320, scale: 0.97, kcal: 111 },
  { methodKey: 'riceFried', methodFb: '乾硬炒飯', weight: 210, scale: 0.64, kcal: 170 },
] as const;

const MEAT_STEPS = [
  { methodKey: 'meatBoiled', methodFb: '水煮', weight: 82, scale: 0.82, kcal: 134 },
  { methodKey: 'meatPanSeared', methodFb: '香煎', weight: 74, scale: 0.74, kcal: 149 },
  { methodKey: 'meatAirFried', methodFb: '氣炸烘烤', weight: 66, scale: 0.66, kcal: 167 },
] as const;

/**
 * 首次記錄食材 / 食譜時顯示的生重計算基準說明彈窗（方案 1：動態烹飪手法輪播）
 * 須輸入關鍵字（生重 / raw）方可解鎖確認按鈕
 */
export function RawWeightGuideDialog({
  open,
  onOpenChange,
  onConfirm,
}: RawWeightGuideDialogProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [step, setStep] = useState(0);

  const keyword = t('diet.rawWeightGuide.keyword', '生重');
  const trimmed = inputValue.trim();
  const isValid = trimmed.toLowerCase() === keyword.toLowerCase();
  const targetLen = keyword.length;
  const currentLen = Math.min(targetLen, trimmed.length);

  useEffect(() => {
    if (!open) return;
    setInputValue('');
    setStep(0);
    const timer = window.setInterval(() => {
      setStep((prev) => (prev + 1) % 3);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [open]);

  const rice = RICE_STEPS[step];
  const meat = MEAT_STEPS[step];

  const handleConfirm = () => {
    if (!isValid) return;
    triggerHaptic('success');
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PrecisionDialogContent
        title={t('diet.rawWeightGuide.title', '生重計算基準')}
        onClose={() => onOpenChange(false)}
        onSubmit={handleConfirm}
        submitDisabled={!isValid}
        submitAriaLabel={t('common.confirm', '確認')}
        cancelAriaLabel={t('common.cancel', '取消')}
      >
        <div className="pt-3.5 pb-0 space-y-3.5 select-none">
          <p className="font-sans text-xs text-muted-foreground leading-relaxed">
            {t('diet.rawWeightGuide.introPrefix', '所有食材一律以「')}
            <span className="text-foreground font-medium">
              {t('diet.rawWeightGuide.introHighlight', '未經烹調之生重')}
            </span>
            {t(
              'diet.rawWeightGuide.introSuffix',
              '」計算。相同生重因烹飪手法等因素，導致熟重會大幅漂移：'
            )}
          </p>

          {/* 1. 動態烹飪手法對比卡片 (共用 SectionCard 規格) */}
          <SectionCard
            title={t('diet.rawWeightGuide.comparisonTitle', '熟重漂移對比')}
            bodyClassName="text-xs font-sans"
          >
            {/* 1a. 白米動態輪播 */}
            <div className="px-4 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-muted-foreground shrink-0">
                    {t('diet.rawWeightGuide.riceRaw', '白米 100g')}
                  </span>
                  <span className="text-border select-none">·</span>
                  <span className="text-foreground font-medium truncate">
                    {t(`diet.rawWeightGuide.${rice.methodKey}`, rice.methodFb)}
                  </span>
                </div>
                <MetricValue
                  value={rice.weight}
                  unit="g"
                  className="text-foreground font-medium shrink-0"
                  unitClassName="text-xs"
                />
              </div>
              <div className="relative h-2 w-full rounded-full border border-dashed border-border overflow-hidden bg-background">
                <div
                  className="absolute inset-y-0 left-0 w-full bg-muted-foreground/30 origin-left transition-transform duration-500 ease-out"
                  style={{ transform: `scaleX(${rice.scale})` }}
                />
                <div className="relative h-full w-[30%] bg-foreground" />
              </div>
              <div className="flex items-center justify-between text-2xs text-muted-foreground">
                <span>
                  {t('diet.rawWeightGuide.riceDensityLabel', '每 100g 熟飯熱量')}
                </span>
                <MetricValue
                  value={rice.kcal}
                  unit="kcal"
                  className="text-telemetry-accent font-medium"
                  unitClassName="text-2xs"
                />
              </div>
            </div>

            {/* 1b. 雞胸肉動態輪播 */}
            <div className="px-4 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-muted-foreground shrink-0">
                    {t('diet.rawWeightGuide.meatRaw', '雞胸 100g')}
                  </span>
                  <span className="text-border select-none">·</span>
                  <span className="text-foreground font-medium truncate">
                    {t(`diet.rawWeightGuide.${meat.methodKey}`, meat.methodFb)}
                  </span>
                </div>
                <MetricValue
                  value={meat.weight}
                  unit="g"
                  className="text-foreground font-medium shrink-0"
                  unitClassName="text-xs"
                />
              </div>
              <div className="relative h-2 w-full rounded-full bg-track overflow-hidden">
                <div
                  className="h-full w-full bg-foreground origin-left transition-transform duration-500 ease-out"
                  style={{ transform: `scaleX(${meat.scale})` }}
                />
              </div>
              <div className="flex items-center justify-between text-2xs text-muted-foreground">
                <span>
                  {t('diet.rawWeightGuide.meatDensityLabel', '每 100g 熟肉熱量')}
                </span>
                <MetricValue
                  value={meat.kcal}
                  unit="kcal"
                  className="text-telemetry-accent font-medium"
                  unitClassName="text-2xs"
                />
              </div>
            </div>

            {/* 1c. 烹調用油 */}
            <div className="h-10 px-4 flex items-center justify-between text-xs gap-2">
              <span className="text-muted-foreground truncate">
                {t('diet.rawWeightGuide.oilRule', '烹調用油獨立計量')}
              </span>
              <MetricValue
                value="+5"
                unit="g"
                className="text-telemetry-accent font-medium shrink-0"
                unitClassName="text-xs"
              />
            </div>
          </SectionCard>

          {/* 2. 門檻輸入框（內嵌於 SectionCard，表頭右側顯示即時字數校準進度） */}
          <SectionCard
            title={`${t('diet.rawWeightGuide.inputHintPrefix', '輸入「')}${keyword}${t('diet.rawWeightGuide.inputHintSuffix', '」後點擊右上角確認')}`}
            action={
              <span className="font-mono text-2xs tabular-nums flex items-center text-muted-foreground">
                {isValid ? (
                  <Check className="size-3.5 text-foreground" strokeWidth={2.5} />
                ) : (
                  <span>
                    {currentLen}/{targetLen}
                  </span>
                )}
              </span>
            }
            bodyClassName="text-xs font-sans"
          >
            <div className="h-10 relative flex items-stretch min-w-0 rounded-b-lg focus-within:ring-1 focus-within:ring-inset focus-within:ring-foreground focus-within:z-[1] transition-shadow duration-100">
              <input
                id="raw-weight-confirm-input"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isValid) {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
                placeholder={keyword}
                aria-label={keyword}
                className="w-full h-full px-4 bg-transparent text-center text-xs font-sans text-foreground font-normal focus:outline-none placeholder:text-muted-foreground/40"
              />
            </div>
          </SectionCard>
        </div>
      </PrecisionDialogContent>
    </Dialog>
  );
}
