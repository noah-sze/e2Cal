import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUnitPreferences } from '@/hooks/useUnitPreferences';
import { useBodyPreferences } from '@/hooks/useBodyPreferences';
import { triggerHaptic } from '@/lib/haptics';
import type {
  UnitSystemPreset,
  BodyWeightUnit,
  FoodWeightUnit,
  FoodVolumeUnit,
  LengthUnit,
  EnergyUnit,
} from '@/types';

export default function UnitsAndBodySettingsPage() {
  const { t } = useTranslation();
  const { preferences, updatePreset, updatePreference } = useUnitPreferences();
  const { bodyPreferences, updateBodyPreference } = useBodyPreferences();

  const getPresetLabel = (p: UnitSystemPreset) => {
    if (p === 'metric') return t('settings.unitPresetMetric');
    if (p === 'imperial') return t('settings.unitPresetImperial');
    return t('settings.unitPresetCustom');
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-7 pb-20 select-none">
      {/* 度量衡單位偏好 */}
      <section className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start">
        <div className="sm:col-span-4 space-y-0.5 px-1 sm:px-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
            {t('settings.unitsSection')}
          </h2>
          <p className="text-2xs text-muted-foreground font-mono leading-relaxed">
            {t('settings.unitsDesc')}
          </p>
        </div>
        <div className="sm:col-span-8 border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
          {/* 制式模板 */}
          <div className="usage-row">
            <span className="text-sm font-normal text-foreground">{t('settings.unitPreset')}</span>
            <Select
              value={preferences.preset}
              onValueChange={(v) => {
                triggerHaptic('selection');
                updatePreset(v as UnitSystemPreset);
              }}
            >
              <SelectTrigger
                size="custom"
                className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <SelectValue className="flex-none text-right">
                  {getPresetLabel(preferences.preset)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="min-w-48">
                <SelectItem value="metric">{t('settings.unitPresetMetric')}</SelectItem>
                <SelectItem value="imperial">{t('settings.unitPresetImperial')}</SelectItem>
                <SelectItem value="custom">{t('settings.unitPresetCustom')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 體重與訓練重量 */}
          <div className="usage-row">
            <span className="text-sm font-normal text-foreground">{t('settings.unitBodyWeight')}</span>
            <Select
              value={preferences.bodyWeight}
              onValueChange={(v) => {
                triggerHaptic('selection');
                updatePreference('bodyWeight', v as BodyWeightUnit);
              }}
            >
              <SelectTrigger
                size="custom"
                className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <SelectValue className="flex-none text-right">
                  {preferences.bodyWeight}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="min-w-28">
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="lbs">lbs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 食物重量 */}
          <div className="usage-row">
            <span className="text-sm font-normal text-foreground">{t('settings.unitFoodWeight')}</span>
            <Select
              value={preferences.foodWeight}
              onValueChange={(v) => {
                triggerHaptic('selection');
                updatePreference('foodWeight', v as FoodWeightUnit);
              }}
            >
              <SelectTrigger
                size="custom"
                className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <SelectValue className="flex-none text-right">
                  {preferences.foodWeight}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="min-w-28">
                <SelectItem value="g">g</SelectItem>
                <SelectItem value="oz">oz</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 液體容量 */}
          <div className="usage-row">
            <span className="text-sm font-normal text-foreground">{t('settings.unitFoodVolume')}</span>
            <Select
              value={preferences.foodVolume}
              onValueChange={(v) => {
                triggerHaptic('selection');
                updatePreference('foodVolume', v as FoodVolumeUnit);
              }}
            >
              <SelectTrigger
                size="custom"
                className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <SelectValue className="flex-none text-right">
                  {preferences.foodVolume}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="min-w-28">
                <SelectItem value="ml">ml</SelectItem>
                <SelectItem value="fl oz">fl oz</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 身高與圍度 */}
          <div className="usage-row">
            <span className="text-sm font-normal text-foreground">{t('settings.unitLength')}</span>
            <Select
              value={preferences.length}
              onValueChange={(v) => {
                triggerHaptic('selection');
                updatePreference('length', v as LengthUnit);
              }}
            >
              <SelectTrigger
                size="custom"
                className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <SelectValue className="flex-none text-right">
                  {preferences.length}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="min-w-28">
                <SelectItem value="cm">cm</SelectItem>
                <SelectItem value="in">in</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 熱量能量 */}
          <div className="usage-row">
            <span className="text-sm font-normal text-foreground">{t('settings.unitEnergy')}</span>
            <Select
              value={preferences.energy}
              onValueChange={(v) => {
                triggerHaptic('selection');
                updatePreference('energy', v as EnergyUnit);
              }}
            >
              <SelectTrigger
                size="custom"
                className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <SelectValue className="flex-none text-right">
                  {preferences.energy}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="min-w-28">
                <SelectItem value="kcal">kcal</SelectItem>
                <SelectItem value="kJ">kJ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* 分割線 */}
      <div className="border-t border-border" />

      {/* 體態指標追蹤與忽略設定 */}
      <section className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start">
        <div className="sm:col-span-4 space-y-0.5 px-1 sm:px-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
            {t('settings.bodyTrackingSection', '體態指標')}
          </h2>
          <p className="text-2xs text-muted-foreground font-mono leading-relaxed">
            {t('settings.bodyTrackingDesc', '自訂需記錄或忽略的圍度範圍')}
          </p>
        </div>
        <div className="sm:col-span-8 border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
          {/* 胸腰臀 */}
          <div className="usage-row">
            <span className="text-sm font-normal text-foreground">
              {t('settings.torsoCircumference', '胸腰臀')}
            </span>
            <Select
              value={bodyPreferences.ignoreTorsoCircumferences ? 'ignore' : 'track'}
              onValueChange={(v) => {
                triggerHaptic('selection');
                updateBodyPreference('ignoreTorsoCircumferences', v === 'ignore');
              }}
            >
              <SelectTrigger
                size="custom"
                className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <SelectValue className="flex-none text-right">
                  {bodyPreferences.ignoreTorsoCircumferences
                    ? t('settings.ignore', '忽略')
                    : t('settings.track', '記錄')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="min-w-28">
                <SelectItem value="track">{t('settings.track', '記錄')}</SelectItem>
                <SelectItem value="ignore">{t('settings.ignore', '忽略')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 手臂、大腿圍 */}
          <div className="usage-row">
            <span className="text-sm font-normal text-foreground">
              {t('settings.limbCircumference', '手臂、大腿圍')}
            </span>
            <Select
              value={bodyPreferences.ignoreLimbCircumferences ? 'ignore' : 'track'}
              onValueChange={(v) => {
                triggerHaptic('selection');
                updateBodyPreference('ignoreLimbCircumferences', v === 'ignore');
              }}
            >
              <SelectTrigger
                size="custom"
                className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <SelectValue className="flex-none text-right">
                  {bodyPreferences.ignoreLimbCircumferences
                    ? t('settings.ignore', '忽略')
                    : t('settings.track', '記錄')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="min-w-28">
                <SelectItem value="track">{t('settings.track', '記錄')}</SelectItem>
                <SelectItem value="ignore">{t('settings.ignore', '忽略')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>
    </div>
  );
}
