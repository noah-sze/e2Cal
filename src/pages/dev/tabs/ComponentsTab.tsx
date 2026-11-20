import React, { useState } from 'react';
import { MetricValue } from '@/components/ui/metric-value';
import { SectionCard } from '@/components/ui/section-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { NutritionBasisToggle } from '@/components/food/NutritionBasisToggle';
import { NutritionFactsCard, type NutritionFactsData } from '@/components/food/NutritionFactsCard';
import { BodyHighlighter, type BodyHighlighterGender, type BodyHighlighterView } from '@/components/workout/BodyHighlighter';
import { AdaptiveMuscleBadgeGroup } from '@/components/workout/AdaptiveMuscleBadgeGroup';
import { TargetMusclesCard } from '@/components/workout/TargetMusclesCard';
import { SyncStatusPill } from '@/components/sync/SyncStatusPill';
import { LiquidElevationPicker } from '@/components/ui/LiquidElevationPicker';
import type { DetailedMuscle, MuscleRole } from '@/types';

// Mock 營養成分數據（標準特級初榨橄欖油 15ml / 100ml）
const MOCK_NUTRITION_DATA: NutritionFactsData = {
  servingSize: 15,
  servingUnit: 'ml',
  calories: 124,
  carbs: 0,
  protein: 0,
  fat: 14.0,
  sugar: 0,
  fiber: 0,
  saturatedFat: 2.0,
  transFat: 0,
  sodium: 0,
};

// Mock 目標肌群機能學角色 (精準 17 解剖肌群)
const MOCK_MUSCLE_MAP: Partial<Record<DetailedMuscle, MuscleRole | number>> = {
  upper_chest: 'primary',
  mid_lower_chest: 'primary',
  front_delts: 'secondary',
  triceps: 'secondary',
  rear_delts: 'stabilizer',
};

const MOCK_ADAPTIVE_ENTRIES: [DetailedMuscle, MuscleRole | number][] = [
  ['upper_chest', 'primary'],
  ['mid_lower_chest', 'primary'],
  ['front_delts', 'secondary'],
  ['triceps', 'secondary'],
  ['rear_delts', 'stabilizer'],
  ['lats', 'stabilizer'],
  ['abs', 'stabilizer'],
];

export const ComponentsTab: React.FC = () => {
  // 人體解剖模型交互狀態
  const [highlighterGender, setHighlighterGender] = useState<BodyHighlighterGender>('male');
  const [highlighterView, setHighlighterView] = useState<BodyHighlighterView>('both');
  const [selectedMuscle, setSelectedMuscle] = useState<DetailedMuscle | null>(null);

  // 升降選擇器交互狀態
  const [isLiquidPickerOpen, setIsLiquidPickerOpen] = useState(false);
  const [liquidValue, setLiquidValue] = useState(120);

  return (
    <div className="space-y-6">
      {/* 標題與定位 */}
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Shared Components & Domain Patterns
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          跨模組共用複合元件與領域模式（L3 領域架構真理源），扁平無陰影、數值基線平齊、嚴格三大元素與解剖機能學規範。
        </p>
      </div>

      {/* 1. 數值微排版與卡片容器 (Metric Values & Containers) */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-mono text-muted-foreground">
          Precision metric values & containers
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* MetricValue 展示 */}
          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">MetricValue (數值精密對齊)</span>
              <span className="text-3xs font-mono text-muted-foreground">BASELINE ALIGNED</span>
            </div>
            <p className="text-2xs text-muted-foreground">
              等寬防抖數字（JetBrains Mono）與比例字體單位（font-sans）以 2px 間距精密平齊，絕對防折行。
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              <div className="p-2 rounded border border-border bg-background flex flex-col gap-0.5">
                <span className="text-3xs font-mono text-muted-foreground">WEIGHT</span>
                <MetricValue value="78.5" unit="kg" className="text-sm text-foreground font-semibold" />
              </div>
              <div className="p-2 rounded border border-border bg-background flex flex-col gap-0.5">
                <span className="text-3xs font-mono text-muted-foreground">CALORIES</span>
                <MetricValue value="2,450" unit="kcal" className="text-sm text-calories font-semibold" />
              </div>
              <div className="p-2 rounded border border-border bg-background flex flex-col gap-0.5">
                <span className="text-3xs font-mono text-muted-foreground">VOLUME</span>
                <MetricValue value="12,450" unit="kg" className="text-sm text-foreground font-semibold" />
              </div>
              <div className="p-2 rounded border border-border bg-background flex flex-col gap-0.5">
                <span className="text-3xs font-mono text-muted-foreground">e1RM</span>
                <MetricValue value="162.5" unit="kg" className="text-sm text-foreground font-semibold" />
              </div>
              <div className="p-2 rounded border border-border bg-background flex flex-col gap-0.5">
                <span className="text-3xs font-mono text-muted-foreground">SERIES</span>
                <MetricValue value="5" unit="reps" className="text-sm text-foreground font-semibold" />
              </div>
              <div className="p-2 rounded border border-border bg-background flex flex-col gap-0.5">
                <span className="text-3xs font-mono text-muted-foreground">RATIO</span>
                <MetricValue value="45" unit="%" className="text-sm text-carbs font-semibold" />
              </div>
            </div>
          </div>

          {/* SectionCard 展示 */}
          <SectionCard
            title="SectionCard (內嵌表頭扁平容器)"
            action={<Badge variant="outline" className="text-3xs font-mono">2 筆記錄</Badge>}
          >
            <div className="p-3 flex items-center justify-between hover:bg-hover transition-colors">
              <div className="min-w-0">
                <div className="text-xs font-normal text-foreground truncate">去骨生雞胸肉</div>
                <div className="text-2xs font-mono text-muted-foreground">蛋白質核心來源</div>
              </div>
              <MetricValue value="250" unit="g" className="text-xs text-foreground shrink-0" />
            </div>
            <div className="p-3 flex items-center justify-between hover:bg-hover transition-colors">
              <div className="min-w-0">
                <div className="text-xs font-normal text-foreground truncate">特級初榨橄欖油</div>
                <div className="text-2xs font-mono text-muted-foreground">健康單元不飽和脂肪</div>
              </div>
              <MetricValue value="15" unit="ml" className="text-xs text-foreground shrink-0" />
            </div>
          </SectionCard>
        </div>
      </div>

      {/* 2. 營養與飲食展示 (Nutrition & Diet Components) */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-mono text-muted-foreground">
          Nutrition & macro standards
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* NutritionBasisToggle */}
          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">NutritionBasisToggle</span>
              <span className="text-3xs font-mono text-muted-foreground">ZUSTAND SSOT</span>
            </div>
            <p className="text-2xs text-muted-foreground leading-normal">
              全域基準切換微型膠囊（每份 vs 每 100g），即時穿透至全站營養素計算。
            </p>
            <div className="pt-2 flex justify-center">
              <NutritionBasisToggle />
            </div>
          </div>

          {/* NutritionFactsCard */}
          <div className="md:col-span-2">
            <NutritionFactsCard
              title="NutritionFactsCard (標準食品營養規格卡)"
              data={MOCK_NUTRITION_DATA}
              highlights={{ calories: true, fat: true }}
            />
          </div>
        </div>
      </div>

      {/* 3. 人體解剖熱力圖與機能學 (Anatomy & Workout Kinematics) */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-mono text-muted-foreground">
          Anatomy & muscle kinematics
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* BodyHighlighter 互動熱力圖 */}
          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-xs font-medium text-foreground">BodyHighlighter (17 解剖肌群熱力圖)</span>
                <p className="text-2xs font-mono text-muted-foreground mt-0.5">
                  點選肌群互動 · 赤陶磚紅強度階梯映射
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <SegmentedControl
                  value={highlighterGender}
                  onChange={(v) => setHighlighterGender(v as BodyHighlighterGender)}
                  options={[
                    { value: 'male', label: '男' },
                    { value: 'female', label: '女' },
                  ]}
                  className="w-20"
                />
                <SegmentedControl
                  value={highlighterView}
                  onChange={(v) => setHighlighterView(v as BodyHighlighterView)}
                  options={[
                    { value: 'both', label: '並排' },
                    { value: 'anterior', label: '前' },
                    { value: 'posterior', label: '後' },
                  ]}
                  className="w-28"
                />
              </div>
            </div>

            <div className="p-3 rounded border border-border bg-background flex flex-col items-center justify-center min-h-[300px]">
              <BodyHighlighter
                gender={highlighterGender}
                view={highlighterView}
                muscles={MOCK_MUSCLE_MAP}
                selectedMuscle={selectedMuscle}
                interactive={true}
                onMuscleClick={(muscle) => {
                  setSelectedMuscle((prev) => (prev === muscle ? null : muscle));
                }}
              />
              <div className="mt-2 text-2xs font-mono text-muted-foreground">
                選中肌群：<span className="text-foreground font-semibold">{selectedMuscle ?? '無 (點擊人體肌群以檢視)'}</span>
              </div>
            </div>
          </div>

          {/* TargetMusclesCard & AdaptiveMuscleBadgeGroup */}
          <div className="space-y-3">
            <TargetMusclesCard
              gender={highlighterGender}
              muscles={MOCK_MUSCLE_MAP}
            />

            <div className="p-4 rounded-lg border border-border bg-card space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">AdaptiveMuscleBadgeGroup</span>
                <span className="text-3xs font-mono text-muted-foreground">AUTO-TRUNCATE</span>
              </div>
              <p className="text-2xs text-muted-foreground">
                依據容器寬度動態自適應計算可見膠囊數，主動肌在最前、協同肌居中、穩定肌在後，溢出自動收折為「+N」膠囊。
              </p>
              <div className="p-3 rounded border border-border bg-background">
                <AdaptiveMuscleBadgeGroup entries={MOCK_ADAPTIVE_ENTRIES} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. 同步狀態與高階物理選擇器 (Sync Status & Physics Pickers) */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-mono text-muted-foreground">
          System telemetry & physics pickers
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* SyncStatusPill */}
          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">SyncStatusPill (雲端同步狀態膠囊)</span>
              <span className="text-3xs font-mono text-muted-foreground">DROPBOX PKCE</span>
            </div>
            <p className="text-2xs text-muted-foreground leading-normal">
              整合網路偵測、認證狀態、進行中旋轉與時間戳格式化，單一膠囊即插即用。
            </p>
            <div className="pt-2 flex items-center justify-start gap-3">
              <SyncStatusPill />
              <span className="text-2xs font-mono text-muted-foreground">點擊膠囊可喚起連線或手動同步</span>
            </div>
          </div>

          {/* LiquidElevationPicker */}
          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">LiquidElevationPicker (物理升降刻度盤)</span>
              <span className="text-3xs font-mono text-muted-foreground">PHYSICS TOUCH</span>
            </div>
            <p className="text-2xs text-muted-foreground leading-normal">
              微重力擬真物理手勢滑動刻度盤，支援步進對齊與單位鎖定。
            </p>
            <div className="pt-2 flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsLiquidPickerOpen(true)}
                className="h-8 text-xs font-mono border-border"
              >
                開啟刻度盤（當前：{liquidValue} ml）
              </Button>
            </div>

            <LiquidElevationPicker
              open={isLiquidPickerOpen}
              onOpenChange={setIsLiquidPickerOpen}
              value={liquidValue}
              onConfirm={(val) => {
                setLiquidValue(val);
                setIsLiquidPickerOpen(false);
              }}
              allowedUnits={['ml', 'g']}
              unit="ml"
              min={0}
              max={500}
              step={5}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
