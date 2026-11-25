import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MetricValue } from '@/components/ui/metric-value';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { NutritionBasisToggle } from '@/components/food/NutritionBasisToggle';
import { NutritionFactsCard, type NutritionFactsData } from '@/components/food/NutritionFactsCard';
import {
  SubNutrientsPopover,
  buildCarbsSubRows,
  buildFatSubRows,
} from '@/components/food/SubNutrientsPopover';
import {
  RecipeIngredientsCard,
  type RecipeIngredientItem,
} from '@/components/food/RecipeIngredientsCard';
import { evaluateNutritionalHighlight } from '@/utils/nutritionEvaluation';
import type { BodyHighlighterGender } from '@/components/workout/BodyHighlighter';
import { AdaptiveMuscleBadgeGroup } from '@/components/workout/AdaptiveMuscleBadgeGroup';
import { TargetMusclesCard } from '@/components/workout/TargetMusclesCard';
import { SyncStatusPill } from '@/components/sync/SyncStatusPill';
import { CopySnippet } from '../components/CopySnippet';
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

// Mock 構成食物清單（雞胸肉義大利麵範例）
const MOCK_RECIPE_INGREDIENTS: RecipeIngredientItem[] = [
  {
    id: 'mock-ing-1',
    foodName: '雞胸肉',
    quantity: 150,
    unit: 'g',
    macros: { calories: 248, carbs: 0, protein: 46.5, fat: 5.4 },
    evalResult: evaluateNutritionalHighlight({
      calories: 248,
      carbs: 0,
      protein: 46.5,
      fat: 5.4,
      servingSize: 150,
      servingUnit: 'g',
      category: 'natural',
    }),
  },
  {
    id: 'mock-ing-2',
    foodName: '義大利麵',
    quantity: 80,
    unit: 'g',
    macros: { calories: 288, carbs: 59.2, protein: 10.4, fat: 1.2, fiber: 2.8 },
    evalResult: evaluateNutritionalHighlight({
      calories: 288,
      carbs: 59.2,
      protein: 10.4,
      fat: 1.2,
      fiber: 2.8,
      servingSize: 80,
      servingUnit: 'g',
      category: 'natural',
    }),
  },
  {
    id: 'mock-ing-3',
    foodName: '特級初榨橄欖油',
    quantity: 10,
    unit: 'ml',
    isOptional: true,
    macros: { calories: 82, carbs: 0, protein: 0, fat: 9.3, saturatedFat: 1.3 },
    evalResult: evaluateNutritionalHighlight({
      calories: 82,
      carbs: 0,
      protein: 0,
      fat: 9.3,
      servingSize: 10,
      servingUnit: 'ml',
      category: 'oil',
    }),
  },
];

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
  const { t } = useTranslation();
  // 人體解剖模型性別狀態
  const [highlighterGender, setHighlighterGender] = useState<BodyHighlighterGender>('male');

  return (
    <div className="space-y-6">
      {/* 標題與客觀說明 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground font-sans">
            共用組件
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-sans">
            跨模組共用複合元件與領域模式（L3 領域架構真理源），扁平無陰影、數值基線平齊、嚴格三大元素與解剖機能學規範。
          </p>
        </div>
        <div className="text-2xs font-mono text-muted-foreground tabular-nums">
          L3 複合模式
        </div>
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
              <div className="flex items-center gap-1.5">
                <CopySnippet variant="subtle" value="<MetricValue />" className="text-xs font-medium text-foreground">
                  MetricValue
                </CopySnippet>
                <span className="text-2xs text-muted-foreground">(數值精密對齊)</span>
              </div>
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
            title={
              <div className="flex items-center gap-1.5">
                <CopySnippet variant="subtle" value="<SectionCard />" className="text-xs uppercase font-medium text-foreground">
                  SectionCard
                </CopySnippet>
                <span className="text-3xs lowercase font-normal text-muted-foreground">(內嵌表頭扁平容器)</span>
              </div>
            }
            action={<Badge variant="outline" className="text-3xs font-mono">2 筆記錄</Badge>}
          >
            <div className="p-3 flex items-center justify-between hover:bg-hover transition-colors">
              <div className="min-w-0">
                <div className="text-xs font-normal text-foreground truncate">雞胸肉</div>
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
          {/* 左側欄：NutritionBasisToggle + SubNutrientsPopover */}
          <div className="space-y-3">
            {/* NutritionBasisToggle */}
            <div className="p-4 rounded-lg border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <CopySnippet variant="subtle" value="<NutritionBasisToggle />" className="text-xs font-medium text-foreground">
                  NutritionBasisToggle
                </CopySnippet>
                <span className="text-3xs font-mono text-muted-foreground">ZUSTAND SSOT</span>
              </div>
              <p className="text-2xs text-muted-foreground leading-normal">
                全域基準切換微型膠囊（每份 vs 每 100g），即時穿透至全站營養素計算。
              </p>
              <div className="pt-2 flex justify-center">
                <NutritionBasisToggle />
              </div>
            </div>

            {/* SubNutrientsPopover */}
            <div className="p-4 rounded-lg border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <CopySnippet variant="subtle" value="<SubNutrientsPopover />" className="text-xs font-medium text-foreground">
                  SubNutrientsPopover
                </CopySnippet>
                <span className="text-3xs font-mono text-muted-foreground">CLICK POPOVER</span>
              </div>
              <p className="text-2xs text-muted-foreground leading-normal">
                共用於進度條、方形膠囊與營養成分表之次要營養素純點擊浮層（含色塊圖例 Swatch）。
              </p>
              <div className="pt-1 flex items-center justify-center gap-2">
                <SubNutrientsPopover
                  align="start"
                  rows={buildCarbsSubRows(t, 18.4, 12.6)}
                >
                  <span className="inline-flex items-center h-7 px-3 rounded-full border border-carbs-subtle-border bg-carbs-subtle-bg hover:bg-hover text-carbs font-mono text-xs cursor-pointer transition-colors">
                    碳水次級
                  </span>
                </SubNutrientsPopover>
                <SubNutrientsPopover
                  align="end"
                  rows={buildFatSubRows(t, 9.2, 0.4)}
                >
                  <span className="inline-flex items-center h-7 px-3 rounded-full border border-fat-subtle-border bg-fat-subtle-bg hover:bg-hover text-fat font-mono text-xs cursor-pointer transition-colors">
                    脂肪次級
                  </span>
                </SubNutrientsPopover>
              </div>
            </div>
          </div>

          {/* NutritionFactsCard */}
          <div className="md:col-span-2">
            <NutritionFactsCard
              title="NutritionFactsCard"
              action={
                <div className="flex items-center gap-1.5">
                  <CopySnippet variant="subtle" value="<NutritionFactsCard />" className="text-3xs">
                    複製標籤
                  </CopySnippet>
                  <NutritionBasisToggle />
                </div>
              }
              data={MOCK_NUTRITION_DATA}
              highlights={{ calories: true, fat: true }}
            />
          </div>
        </div>

        {/* RecipeIngredientsCard (詳情 / 編輯雙模式並排) */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <CopySnippet variant="subtle" value="<RecipeIngredientsCard />" className="text-xs font-medium text-foreground">
                RecipeIngredientsCard
              </CopySnippet>
              <span className="text-2xs text-muted-foreground">(共用於 RecipeDetails 與 RecipeDialog)</span>
            </div>
            <span className="text-3xs font-mono text-muted-foreground">DETAIL / EDIT MODES</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <RecipeIngredientsCard
              title="詳情模式 (detail)"
              showCount={true}
              mode="detail"
              items={MOCK_RECIPE_INGREDIENTS}
              onItemClick={() => {}}
            />
            <RecipeIngredientsCard
              title="編輯模式 (edit)"
              showCount={true}
              mode="edit"
              items={MOCK_RECIPE_INGREDIENTS}
              onAddIngredient={() => {}}
              onReplaceItem={() => {}}
              onEditQuantity={() => {}}
              onRemoveItem={() => {}}
            />
          </div>
        </div>
      </div>

      {/* 3. 人體解剖熱力圖與機能學 (Anatomy & Workout Kinematics) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <CopySnippet variant="subtle" value="<TargetMusclesCard />" className="text-xs font-medium text-foreground">
                TargetMusclesCard
              </CopySnippet>
              <span className="text-2xs text-muted-foreground">(17 解剖肌群熱力圖與機能學量表)</span>
            </div>
            <p className="text-2xs font-mono text-muted-foreground mt-0.5">
              點選肌群觸發原生 Popover 提示 · 赤陶磚紅強度階梯映射
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-2xs font-mono text-muted-foreground">性別模型</span>
            <SegmentedControl
              value={highlighterGender}
              onChange={(v) => setHighlighterGender(v as BodyHighlighterGender)}
              options={[
                { value: 'male', label: '男' },
                { value: 'female', label: '女' },
              ]}
              className="w-20"
            />
          </div>
        </div>

        <div className="space-y-3">
          <TargetMusclesCard
            gender={highlighterGender}
            muscles={MOCK_MUSCLE_MAP}
          />

          <div className="p-4 rounded-lg border border-border bg-card space-y-2.5">
            <div className="flex items-center justify-between">
              <CopySnippet variant="subtle" value="<AdaptiveMuscleBadgeGroup />" className="text-xs font-medium text-foreground">
                AdaptiveMuscleBadgeGroup
              </CopySnippet>
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

      {/* 4. 同步狀態與高階物理選擇器 (Sync Status & Physics Pickers) */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-mono text-muted-foreground">
          System telemetry & physics pickers
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* SyncStatusPill */}
          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CopySnippet variant="subtle" value="<SyncStatusPill />" className="text-xs font-medium text-foreground">
                  SyncStatusPill
                </CopySnippet>
                <span className="text-2xs text-muted-foreground">(雲端同步狀態膠囊)</span>
              </div>
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
        </div>
      </div>
    </div>
  );
};
