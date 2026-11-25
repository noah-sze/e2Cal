import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { MetricValue } from '@/components/ui/metric-value';
import { formatEnergy } from '@/utils/unitMath';
import type { EnergyUnit } from '@/types';
import type { WeighingForm } from '@/utils/nutritionMath';

export interface KeypadWeighingDisplayCardProps {
  /** 目前稱重形態（可食淨重 / 毛重） */
  weighingForm: WeighingForm;
  /** 是否存在不可食損耗（refuseRate > 0） */
  hasRefuse: boolean;
  /** 可食率（0~1） */
  edibleRate?: number;
  /** 不可食損耗率（0~1） */
  refuseRate?: number;
  /** 切換至可食淨重 */
  onSelectNet: () => void;
  /** 切換至毛重 */
  onSelectGross: () => void;
  /** 計算後之熱量（kcal） */
  calories: number;
  /** 使用者能量單位偏好 */
  energyUnit: EnergyUnit;
  /** 數字鍵盤目前輸入字串 */
  valueText: string;
  /** 顯示單位（g / ml / oz / fl oz 等） */
  unit: string;
  /** 折算後之可食淨重數值 */
  effectiveQty: number;
}

/**
 * 數字鍵盤稱重三合一整合儀表盒（方案 C）：
 * 單一邊框內以 divide-y 分層承載「可食淨重 / 毛重切換」、「熱量與重量顯示」及「可食率與淨重折算」。
 */
export function KeypadWeighingDisplayCard({
  weighingForm,
  hasRefuse,
  edibleRate,
  refuseRate,
  onSelectNet,
  onSelectGross,
  calories,
  energyUnit,
  valueText,
  unit,
  effectiveQty,
}: KeypadWeighingDisplayCardProps) {
  const { t } = useTranslation();

  const resolvedEdibleRate = edibleRate ?? (1 - (refuseRate || 0));
  const ediblePct = Math.min(100, Math.max(0, Math.round(resolvedEdibleRate * 100)));
  const isGrossActive = hasRefuse && weighingForm === 'gross';
  const energy = formatEnergy(calories, energyUnit);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
      {/* 頂層：可食淨重 / 毛重 切換器 */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-muted/40 text-xs">
        <button
          type="button"
          onClick={onSelectNet}
          className={cn(
            'py-1.5 px-2 rounded-md font-medium text-xs transition-colors',
            !isGrossActive
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
          )}
        >
          {t('diet.netWeightLabel')}
        </button>
        <button
          type="button"
          disabled={!hasRefuse}
          onClick={() => {
            if (!hasRefuse) return;
            onSelectGross();
          }}
          title={!hasRefuse ? t('diet.zeroRefuseTip') : undefined}
          className={cn(
            'py-1.5 px-2 rounded-md font-medium text-xs transition-colors',
            !hasRefuse
              ? 'opacity-35 cursor-not-allowed text-muted-foreground select-none pointer-events-none'
              : isGrossActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
          )}
        >
          {t('diet.grossWeightLabel')}
        </button>
      </div>

      {/* 中層：熱量與輸入數值主顯示區 */}
      <div className="px-3 py-2.5 flex items-baseline justify-between bg-card">
        <MetricValue
          value={energy.value.toLocaleString()}
          unit={energy.unit}
          className="text-xs font-medium"
          valueClassName="text-calories"
          unitClassName="text-muted-foreground"
        />
        <MetricValue
          value={valueText || '0'}
          unit={unit}
          valueClassName="text-xl font-semibold tracking-tight text-foreground"
          unitClassName="text-xs text-muted-foreground"
        />
      </div>

      {/* 底層：可食率與折算淨重（不加粗） */}
      <div className="px-3 py-1.5 min-h-7 bg-muted/20 flex items-center justify-between text-[11px] font-normal text-muted-foreground">
        <span className="font-mono tabular-nums">
          {t('diet.refuseRatePrefix')} {ediblePct}%
        </span>
        {isGrossActive ? (
          <span className="inline-flex items-baseline gap-1 font-normal text-foreground">
            <span>{t('diet.convertedNetWeightPrefix')} ≈</span>
            <MetricValue
              value={effectiveQty}
              unit={unit}
              className="font-normal text-foreground"
              valueClassName="font-normal"
              unitClassName="font-normal text-muted-foreground"
            />
          </span>
        ) : (
          <span className="font-normal text-muted-foreground/60">
            {hasRefuse ? t('diet.netWeightActiveHint') : t('diet.noInedibleRefuseHint')}
          </span>
        )}
      </div>
    </div>
  );
}
