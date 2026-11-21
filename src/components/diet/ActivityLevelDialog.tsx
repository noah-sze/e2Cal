import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, PrecisionDialogContent } from '@/components/ui/dialog';
import { SectionCard } from '@/components/ui/section-card';
import { MetricValue } from '@/components/ui/metric-value';
import { useUnitPreferences } from '@/hooks/useUnitPreferences';
import { formatEnergy } from '@/utils/unitMath';
import {
  calculateAgeFromBirth,
  calculateBMR,
  calculateTDEE,
} from '@/utils/weightMath';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/types';

interface ActivityOption {
  value: number;
  shortLabelKey: string;
  defaultLabel: string;
  descKey: string;
  defaultDesc: string;
}

const ACTIVITY_OPTIONS: readonly ActivityOption[] = [
  {
    value: 1.2,
    shortLabelKey: 'dietPlan.sedentaryShort',
    defaultLabel: '久坐辦公',
    descKey: 'dietPlan.sedentaryDesc',
    defaultDesc: '日常靜態工作，無規律運動',
  },
  {
    value: 1.375,
    shortLabelKey: 'dietPlan.lightShort',
    defaultLabel: '輕度活動',
    descKey: 'dietPlan.lightDesc',
    defaultDesc: '每週輕量運動 1–3 天',
  },
  {
    value: 1.45,
    shortLabelKey: 'dietPlan.lightExerciseShort',
    defaultLabel: '輕度運動',
    descKey: 'dietPlan.lightExerciseDesc',
    defaultDesc: '日常走動較多，偶爾運動',
  },
  {
    value: 1.55,
    shortLabelKey: 'dietPlan.moderateShort',
    defaultLabel: '中度活動',
    descKey: 'dietPlan.moderateDesc',
    defaultDesc: '每週規律運動 3–5 天',
  },
  {
    value: 1.725,
    shortLabelKey: 'dietPlan.heavyShort',
    defaultLabel: '高強度活動',
    descKey: 'dietPlan.heavyDesc',
    defaultDesc: '每週訓練 6–7 天',
  },
  {
    value: 1.8,
    shortLabelKey: 'dietPlan.intenseExerciseShort',
    defaultLabel: '高強度訓練',
    descKey: 'dietPlan.intenseExerciseDesc',
    defaultDesc: '高容量肌力或有氧訓練',
  },
  {
    value: 1.9,
    shortLabelKey: 'dietPlan.athleteShort',
    defaultLabel: '極重度活動',
    descKey: 'dietPlan.athleteDesc',
    defaultDesc: '每日雙練或高耗能體力工作',
  },
  {
    value: 2.0,
    shortLabelKey: 'dietPlan.extremeShort',
    defaultLabel: '極限體能',
    descKey: 'dietPlan.extremeDesc',
    defaultDesc: '極高強度持續耐力訓練',
  },
  {
    value: 999,
    shortLabelKey: 'dietPlan.bingeShort',
    defaultLabel: '放縱',
    descKey: 'dietPlan.bingeDesc',
    defaultDesc: '不設熱量上限',
  },
];

export interface ActivityLevelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentActivity: number;
  profile: UserProfile;
  onSave: (newLevel: number) => Promise<void> | void;
}

/**
 * 活動係數精密彈窗 (方案 B1：極簡分割算式卡 + 說明列 + 單選清單)
 * 清楚呈現：1. 身體基礎代謝 (BMR) 2. 活動係數計算過程 3. 最終熱量消耗 (TDEE)
 */
export function ActivityLevelDialog({
  isOpen,
  onClose,
  currentActivity,
  profile,
  onSave,
}: ActivityLevelDialogProps) {
  const { t } = useTranslation();
  const { energyUnit } = useUnitPreferences();

  const [selectedLevel, setSelectedLevel] = useState<number>(currentActivity || 1.2);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const prevIsOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setSelectedLevel(currentActivity || 1.2);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, currentActivity]);

  const age = profile.birthDate
    ? calculateAgeFromBirth(profile.birthDate)
    : profile.age || 25;

  const currentBMR = useMemo(
    () =>
      calculateBMR(
        profile.currentWeightKg,
        profile.heightCm,
        profile.gender,
        age
      ),
    [profile.currentWeightKg, profile.heightCm, profile.gender, age]
  );

  const isBinge = selectedLevel === 999;

  const tdeeKcal = useMemo(() => {
    if (isBinge || currentBMR <= 0) return 0;
    return calculateTDEE(currentBMR, selectedLevel);
  }, [isBinge, currentBMR, selectedLevel]);

  const bmrDisplay = formatEnergy(currentBMR, energyUnit);
  const tdeeDisplay = formatEnergy(tdeeKcal, energyUnit);

  const bodySpecSummary = useMemo(() => {
    const parts: string[] = [];
    if (profile.heightCm > 0) parts.push(`${Math.round(profile.heightCm)}cm`);
    if (profile.currentWeightKg > 0) {
      parts.push(`${Number(profile.currentWeightKg.toFixed(1))}kg`);
    }
    return parts.join(' · ');
  }, [profile.heightCm, profile.currentWeightKg]);

  const handleSelect = (val: number) => {
    setSelectedLevel(val);
    triggerHaptic('selection');
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSave(selectedLevel);
      triggerHaptic('success');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <PrecisionDialogContent
        title={t('dietPlan.activityLevel', '活動係數')}
        onSubmit={handleSubmit}
        submitDisabled={isSubmitting}
        submitAriaLabel={t('common.save', '儲存')}
        cancelAriaLabel={t('common.cancel', '取消')}
        overlayClassName="z-[60]"
        className="z-[60]"
        initialFocus={false}
      >
        <div className="flex flex-col space-y-3 pt-3.5 select-none">
          {/* 上方規格算式卡：基礎代謝 × 係數 = 最終消耗 + 底部公式來源說明 */}
          <SectionCard
            title=""
            showHeader={false}
            bodyClassName="text-xs font-sans"
          >
            <div className="grid grid-cols-[1fr_0.78fr_1.12fr] divide-x divide-border">
              {/* 1. 身體基礎代謝 */}
              <div className="px-2 py-2.5 flex flex-col items-center justify-center gap-0.5 text-center">
                <span className="text-3xs text-muted-foreground">
                  {t('dietPlan.bmrLabel', '基礎代謝')}
                </span>
                <MetricValue
                  value={currentBMR > 0 ? bmrDisplay.value.toLocaleString() : '-'}
                  unit={currentBMR > 0 ? bmrDisplay.unit : undefined}
                  className="text-sm font-semibold text-foreground"
                  unitClassName="text-3xs"
                />
              </div>

              {/* 2. 活動係數 */}
              <div className="relative px-2 py-2.5 flex flex-col items-center justify-center gap-0.5 text-center">
                <span
                  aria-hidden="true"
                  className="absolute -left-2 top-1/2 -translate-y-1/2 size-4 rounded-full bg-card border border-border text-muted-foreground font-mono text-3xs leading-none inline-flex items-center justify-center z-10"
                >
                  ×
                </span>
                <span className="text-3xs text-muted-foreground">
                  {t('dietPlan.factorLabel', '係數')}
                </span>
                <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
                  {isBinge ? '999x' : selectedLevel}
                </span>
              </div>

              {/* 3. 最終熱量消耗 */}
              <div className="relative px-2 py-2.5 bg-muted/30 flex flex-col items-center justify-center gap-0.5 text-center">
                <span
                  aria-hidden="true"
                  className="absolute -left-2 top-1/2 -translate-y-1/2 size-4 rounded-full bg-card border border-border text-muted-foreground font-mono text-3xs leading-none inline-flex items-center justify-center z-10"
                >
                  =
                </span>
                <span className="text-3xs text-muted-foreground">
                  {t('dietPlan.tdeeLabel', '最終消耗')}
                </span>
                {isBinge ? (
                  <MetricValue
                    value={(energyUnit === 'kJ' ? 99999 : 9999).toLocaleString()}
                    unit={tdeeDisplay.unit}
                    className="text-sm font-semibold text-foreground"
                    unitClassName="text-3xs"
                  />
                ) : (
                  <MetricValue
                    value={tdeeKcal > 0 ? tdeeDisplay.value.toLocaleString() : '-'}
                    unit={tdeeKcal > 0 ? tdeeDisplay.unit : undefined}
                    className="text-sm font-semibold text-foreground"
                    unitClassName="text-3xs"
                  />
                )}
              </div>
            </div>

            {/* 公式來源與身體基準列 */}
            <div className="px-3 py-2 flex items-center justify-between gap-2 text-2xs text-muted-foreground">
              <span className="leading-snug">
                {isBinge
                  ? t('dietPlan.bingeNote', '放縱日模式不設熱量上限')
                  : t('dietPlan.bmrFormulaNote', '基礎代謝依 Mifflin-St Jeor 公式推算')}
              </span>
              {bodySpecSummary && (
                <span className="font-mono tabular-nums shrink-0 text-muted-foreground/80">
                  {bodySpecSummary}
                </span>
              )}
            </div>
          </SectionCard>

          {/* 下方活動強度單選清單 */}
          <SectionCard
            title=""
            showHeader={false}
            bodyClassName="max-h-60 overflow-y-auto text-xs font-sans"
          >
            {ACTIVITY_OPTIONS.map((opt) => {
              const isSelected = selectedLevel === opt.value;
              const isOptBinge = opt.value === 999;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    'w-full min-h-11 py-2 px-3 flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer',
                    isSelected ? 'bg-muted/35' : 'hover:bg-hover'
                  )}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-medium text-foreground leading-snug">
                      {t(opt.shortLabelKey, opt.defaultLabel)}
                    </span>
                    <span className="text-2xs text-muted-foreground leading-snug">
                      {t(opt.descKey, opt.defaultDesc)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        'font-mono text-2xs tabular-nums',
                        isSelected
                          ? 'text-foreground font-semibold'
                          : 'text-muted-foreground'
                      )}
                    >
                      {isOptBinge ? '999x' : `×${opt.value}`}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-4 rounded-full border inline-flex items-center justify-center shrink-0 transition-colors',
                        isSelected
                          ? 'border-primary bg-primary'
                          : 'border-border bg-card'
                      )}
                    >
                      {isSelected && (
                        <span className="size-1.5 rounded-full bg-primary-foreground" />
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </SectionCard>
        </div>
      </PrecisionDialogContent>
    </Dialog>
  );
}
