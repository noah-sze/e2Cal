import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import type { DetailedMuscle, MuscleRole } from '@/types';
import {
  BodyHighlighter,
  type BodyHighlighterGender,
  type BodyHighlighterSize,
  type BodyHighlighterView,
} from '@/components/workout/BodyHighlighter';
import { SectionCard } from '@/components/ui/section-card';
import { Button } from '@/components/ui/button';
import { CopySnippet } from '../components/CopySnippet';
import { cn } from '@/lib/utils';

const ALL_MUSCLES: readonly DetailedMuscle[] = [
  'upper_chest',
  'mid_lower_chest',
  'lats',
  'upper_back_traps',
  'lower_back',
  'front_delts',
  'side_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'obliques',
];

type PresetId = 'biceps_curl' | 'squat' | 'bench' | 'all_high' | 'clear';

const PRESETS: Record<
  PresetId,
  { label: string; muscles: Partial<Record<DetailedMuscle, MuscleRole | number>> }
> = {
  biceps_curl: {
    label: '二頭彎舉',
    muscles: { biceps: 'primary', forearms: 'stabilizer' },
  },
  squat: {
    label: '槓鈴深蹲',
    muscles: {
      quads: 'primary',
      glutes: 'primary',
      hamstrings: 'secondary',
      lower_back: 'stabilizer',
      abs: 'stabilizer',
    },
  },
  bench: {
    label: '平板臥推',
    muscles: {
      mid_lower_chest: 'primary',
      upper_chest: 'secondary',
      front_delts: 'secondary',
      triceps: 'secondary',
    },
  },
  all_high: {
    label: '全肌群熱圖',
    muscles: {
      upper_chest: 95,
      mid_lower_chest: 90,
      lats: 80,
      upper_back_traps: 70,
      lower_back: 60,
      front_delts: 85,
      side_delts: 50,
      rear_delts: 40,
      biceps: 75,
      triceps: 65,
      forearms: 35,
      quads: 100,
      hamstrings: 80,
      glutes: 90,
      calves: 45,
      abs: 55,
      obliques: 30,
    },
  },
  clear: {
    label: '清空',
    muscles: {},
  },
};

interface VisualStyleConfig {
  highBg: string;
  highStroke: string;
  highStrokeWidth: number;
  medBg: string;
  medStroke: string;
  medStrokeWidth: number;
  lowBg: string;
  lowStroke: string;
  lowStrokeWidth: number;
  unselectedBg: string;
  unselectedStroke: string;
  unselectedStrokeWidth: number;
  activeBg: string;
  nonColor: string;
  nonOpacity: number;
  outlineStroke: string;
  outlineStrokeWidth: number;
}

const DEFAULT_STYLE_LIGHT: VisualStyleConfig = {
  highBg: 'rgba(255, 36, 83, 0.75)',
  highStroke: '#ff2453',
  highStrokeWidth: 0,
  medBg: 'rgba(255, 149, 92, 0.75)',
  medStroke: '#ff955c',
  medStrokeWidth: 0,
  lowBg: 'rgba(221, 169, 141, 0.70)',
  lowStroke: '#dda98d',
  lowStrokeWidth: 0,
  unselectedBg: 'rgba(9, 9, 11, 0.13)',
  unselectedStroke: 'rgba(9, 9, 11, 0.22)',
  unselectedStrokeWidth: 0,
  activeBg: 'rgba(9, 9, 11, 0.82)',
  nonColor: '#09090b',
  nonOpacity: 0.04,
  outlineStroke: 'rgba(9, 9, 11, 0.50)',
  outlineStrokeWidth: 3,
};

const DEFAULT_STYLE_DARK: VisualStyleConfig = {
  highBg: 'rgba(251, 113, 133, 0.72)',
  highStroke: '#fda4af',
  highStrokeWidth: 0,
  medBg: 'rgba(251, 146, 60, 0.65)',
  medStroke: '#fdba74',
  medStrokeWidth: 0,
  lowBg: 'rgba(148, 163, 184, 0.45)',
  lowStroke: '#cbd5e1',
  lowStrokeWidth: 0,
  unselectedBg: 'rgba(250, 250, 250, 0.18)',
  unselectedStroke: 'rgba(250, 250, 250, 0.18)',
  unselectedStrokeWidth: 0,
  activeBg: 'rgba(250, 250, 250, 0.85)',
  nonColor: '#fafafa',
  nonOpacity: 0.07,
  outlineStroke: 'rgba(250, 250, 250, 0.48)',
  outlineStrokeWidth: 3,
};

function toHexForPicker(val: string, fallback = '#09090b'): string {
  const trimmed = val.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    const r = Math.min(255, Number(rgb[1])).toString(16).padStart(2, '0');
    const g = Math.min(255, Number(rgb[2])).toString(16).padStart(2, '0');
    const b = Math.min(255, Number(rgb[3])).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return fallback;
}

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
}

const ColorField: React.FC<ColorFieldProps> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-2 text-xs">
    <span className="font-mono text-2xs text-muted-foreground truncate">{label}</span>
    <div className="flex items-center gap-1.5 shrink-0">
      <input
        type="color"
        value={toHexForPicker(value)}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="size-6 p-0 rounded border border-border bg-transparent cursor-pointer shrink-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-36 h-7 px-2 rounded border border-border bg-background font-mono text-2xs text-foreground focus:outline-none focus:border-foreground"
      />
    </div>
  </div>
);

interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (val: number) => void;
}

const RangeField: React.FC<RangeFieldProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit = 'px',
  onChange,
}) => (
  <div className="flex items-center justify-between gap-3 text-xs">
    <span className="font-mono text-2xs text-muted-foreground truncate">{label}</span>
    <div className="flex items-center gap-2 shrink-0">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-28 accent-foreground cursor-pointer"
      />
      <span className="w-12 text-right font-mono text-2xs tabular-nums text-foreground">
        {value}
        {unit}
      </span>
    </div>
  </div>
);

export const BodyMapTab: React.FC = () => {
  const { t } = useTranslation();

  // BodyHighlighter Props 狀態
  const [gender, setGender] = useState<BodyHighlighterGender>('male');
  const [view, setView] = useState<BodyHighlighterView>('both');
  const [size, setSize] = useState<BodyHighlighterSize>('md');
  const [interactive, setInteractive] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showOutline, setShowOutline] = useState(true);
  const [highlightColor, setHighlightColor] = useState('');
  const [baseColor, setBaseColor] = useState('');

  // 詳細視覺 CSS 變數設定
  const [styleConfig, setStyleConfig] = useState<VisualStyleConfig>(DEFAULT_STYLE_LIGHT);
  const [useCustomCssVars, setUseCustomCssVars] = useState(false);

  const [muscles, setMuscles] = useState<Partial<Record<DetailedMuscle, MuscleRole | number>>>(
    PRESETS.squat.muscles
  );
  const [selectedMuscle, setSelectedMuscle] = useState<DetailedMuscle | null>('quads');
  const [inputMode, setInputMode] = useState<'role' | 'score'>('role');
  const [clickAction, setClickAction] = useState<
    'select' | 'paint_primary' | 'paint_secondary' | 'paint_clear'
  >('select');
  const [codeTab, setCodeTab] = useState<'jsx' | 'css'>('jsx');

  const updateStyle = <K extends keyof VisualStyleConfig>(
    key: K,
    val: VisualStyleConfig[K]
  ) => {
    setUseCustomCssVars(true);
    setStyleConfig((prev) => ({ ...prev, [key]: val }));
  };

  const resetStyle = () => {
    const isDarkTheme = document.documentElement.classList.contains('dark');
    setStyleConfig(isDarkTheme ? DEFAULT_STYLE_DARK : DEFAULT_STYLE_LIGHT);
    setUseCustomCssVars(false);
    setHighlightColor('');
    setBaseColor('');
  };

  const getMuscleLabel = (m: DetailedMuscle) => {
    const key = `workout.muscle${m
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('')}`;
    return t(key, m);
  };

  const handleMapClick = (muscle: DetailedMuscle) => {
    if (clickAction === 'select') {
      setSelectedMuscle((prev) => (prev === muscle ? null : muscle));
      return;
    }
    setMuscles((prev) => {
      const next = { ...prev };
      if (clickAction === 'paint_clear') {
        delete next[muscle];
      } else if (clickAction === 'paint_primary') {
        next[muscle] = inputMode === 'role' ? 'primary' : 100;
      } else if (clickAction === 'paint_secondary') {
        next[muscle] = inputMode === 'role' ? 'secondary' : 60;
      }
      return next;
    });
    setSelectedMuscle(muscle);
  };

  const handleSetMuscleRole = (m: DetailedMuscle, role: MuscleRole | 'none') => {
    setMuscles((prev) => {
      const next = { ...prev };
      if (role === 'none') {
        delete next[m];
      } else {
        next[m] = role;
      }
      return next;
    });
  };

  const handleSetMuscleScore = (m: DetailedMuscle, score: number) => {
    setMuscles((prev) => {
      const next = { ...prev };
      if (score <= 0) {
        delete next[m];
      } else {
        next[m] = Math.min(100, Math.round(score));
      }
      return next;
    });
  };

  const cssVarsMap = useMemo(
    () => ({
      '--muscle-intensity-high-bg': styleConfig.highBg,
      '--muscle-intensity-high-stroke': styleConfig.highStroke,
      '--muscle-intensity-high-stroke-width': `${styleConfig.highStrokeWidth}px`,
      '--muscle-intensity-med-bg': styleConfig.medBg,
      '--muscle-intensity-med-stroke': styleConfig.medStroke,
      '--muscle-intensity-med-stroke-width': `${styleConfig.medStrokeWidth}px`,
      '--muscle-intensity-low-bg': styleConfig.lowBg,
      '--muscle-intensity-low-stroke': styleConfig.lowStroke,
      '--muscle-intensity-low-stroke-width': `${styleConfig.lowStrokeWidth}px`,
      '--muscle-unselected-bg': styleConfig.unselectedBg,
      '--muscle-unselected-stroke': styleConfig.unselectedStroke,
      '--muscle-unselected-stroke-width': `${styleConfig.unselectedStrokeWidth}px`,
      '--muscle-active-bg': styleConfig.activeBg,
      '--muscle-non-color': styleConfig.nonColor,
      '--muscle-non-opacity': String(styleConfig.nonOpacity),
      '--muscle-outline-stroke': styleConfig.outlineStroke,
      '--muscle-outline-stroke-width': `${styleConfig.outlineStrokeWidth}px`,
    }),
    [styleConfig]
  );

  const jsxSnippet = useMemo(() => {
    const propsLines = [
      `gender="${gender}"`,
      `view="${view}"`,
      `size="${size}"`,
      `interactive={${interactive}}`,
      `showLabels={${showLabels}}`,
      `showOutline={${showOutline}}`,
      highlightColor.trim() ? `highlightColor="${highlightColor.trim()}"` : null,
      baseColor.trim() ? `baseColor="${baseColor.trim()}"` : null,
      `muscles={${JSON.stringify(muscles)}}`,
    ].filter(Boolean);
    return `<BodyHighlighter\n  ${propsLines.join('\n  ')}\n/>`;
  }, [gender, view, size, interactive, showLabels, showOutline, highlightColor, baseColor, muscles]);

  const cssSnippet = useMemo(() => {
    const lines = Object.entries(cssVarsMap).map(([k, v]) => `  ${k}: ${v};`);
    return `:root {\n${lines.join('\n')}\n}`;
  }, [cssVarsMap]);

  const activeCount = Object.keys(muscles).length;
  const activeCode = codeTab === 'jsx' ? jsxSnippet : cssSnippet;

  return (
    <div className="space-y-6">
      {/* 標題與預設情境 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground font-sans">
            人體地圖工作台
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-sans">
            即時調整 BodyHighlighter Props、肌群顏色、線條粗細與外框輪廓，並一鍵複製 JSX / CSS 代碼。
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.keys(PRESETS) as PresetId[]).map((pid) => (
            <Button
              key={pid}
              variant="outline"
              size="sm"
              onClick={() => {
                setMuscles(PRESETS[pid].muscles);
                setSelectedMuscle(null);
              }}
              className="h-7 px-2.5 text-2xs font-mono border-border shadow-none"
            >
              {PRESETS[pid].label}
            </Button>
          ))}
        </div>
      </div>

      {/* 主畫布 + 參數面板 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* 左側：人體地圖預覽區 + 代碼複製 */}
        <div className="lg:col-span-5 lg:sticky lg:top-16 space-y-4">
          <SectionCard
            title="即時預覽"
            action={
              <span className="font-mono text-2xs text-muted-foreground tabular-nums">
                {selectedMuscle ? getMuscleLabel(selectedMuscle) : `${activeCount} 項高亮`}
              </span>
            }
          >
            <div
              className="p-4 sm:p-6 flex items-center justify-center min-h-[340px] bg-card overflow-hidden"
              style={useCustomCssVars ? (cssVarsMap as React.CSSProperties) : undefined}
            >
              <BodyHighlighter
                gender={gender}
                view={view}
                size={size}
                interactive={interactive}
                showLabels={showLabels}
                showOutline={showOutline}
                highlightColor={highlightColor.trim() || undefined}
                baseColor={baseColor.trim() || undefined}
                muscles={muscles}
                selectedMuscle={selectedMuscle}
                onMuscleClick={handleMapClick}
                onClearSelection={() => setSelectedMuscle(null)}
              />
            </div>

            {/* 地圖點擊行為切換 */}
            <div className="px-4 py-2.5 bg-muted/20 flex flex-wrap items-center justify-between gap-2 text-2xs">
              <span className="text-muted-foreground">地圖點擊</span>
              <div className="flex items-center gap-1 flex-wrap">
                {(
                  [
                    { id: 'select', label: '選中' },
                    { id: 'paint_primary', label: '塗主動' },
                    { id: 'paint_secondary', label: '塗協同' },
                    { id: 'paint_clear', label: '擦除' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setClickAction(item.id)}
                    className={cn(
                      'px-2 py-0.5 rounded-full border text-2xs transition-colors cursor-pointer',
                      clickAction === item.id
                        ? 'bg-foreground text-background border-foreground font-medium'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* 代碼輸出與複製 */}
          <SectionCard
            title={
              <div className="flex items-center gap-1.5">
                {(['jsx', 'css'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setCodeTab(tab)}
                    className={cn(
                      'px-2 py-0.5 rounded text-2xs font-mono uppercase cursor-pointer transition-colors',
                      codeTab === tab
                        ? 'bg-foreground text-background font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tab === 'jsx' ? 'JSX Props' : 'CSS Vars'}
                  </button>
                ))}
              </div>
            }
            action={
              <CopySnippet value={activeCode} variant="badge">
                複製代碼
              </CopySnippet>
            }
          >
            <pre className="p-3 max-h-56 overflow-auto text-2xs font-mono text-muted-foreground leading-relaxed">
              {activeCode}
            </pre>
          </SectionCard>
        </div>

        {/* 右側：參數控制台 */}
        <div className="lg:col-span-7 space-y-4">
          {/* 1. 基礎 Props */}
          <SectionCard title="基礎參數 (Props)">
            <div className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
              <span className="font-mono text-muted-foreground">gender</span>
              <div className="flex items-center gap-1">
                {(['male', 'female'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={cn(
                      'px-2.5 py-1 rounded-md border text-2xs font-mono cursor-pointer transition-colors',
                      gender === g
                        ? 'bg-foreground text-background border-foreground font-semibold'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
              <span className="font-mono text-muted-foreground">view</span>
              <div className="flex items-center gap-1">
                {(['both', 'anterior', 'posterior'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={cn(
                      'px-2.5 py-1 rounded-md border text-2xs font-mono cursor-pointer transition-colors',
                      view === v
                        ? 'bg-foreground text-background border-foreground font-semibold'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
              <span className="font-mono text-muted-foreground">size</span>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {(['sm', 'md', 'lg', 'responsive'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={cn(
                      'px-2.5 py-1 rounded-md border text-2xs font-mono cursor-pointer transition-colors',
                      size === s
                        ? 'bg-foreground text-background border-foreground font-semibold'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-mono text-muted-foreground">flags</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { label: 'interactive', val: interactive, toggle: () => setInteractive((v) => !v) },
                    { label: 'showLabels', val: showLabels, toggle: () => setShowLabels((v) => !v) },
                    { label: 'showOutline', val: showOutline, toggle: () => setShowOutline((v) => !v) },
                  ] as const
                ).map((flag) => (
                  <button
                    key={flag.label}
                    type="button"
                    onClick={flag.toggle}
                    className={cn(
                      'px-2.5 py-1 rounded-md border text-2xs font-mono cursor-pointer transition-colors',
                      flag.val
                        ? 'bg-foreground text-background border-foreground font-semibold'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {flag.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 py-2.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="flex items-center justify-between gap-2">
                <span className="font-mono text-2xs text-muted-foreground shrink-0">highlightColor</span>
                <input
                  type="text"
                  value={highlightColor}
                  onChange={(e) => setHighlightColor(e.target.value)}
                  placeholder="預設"
                  className="w-28 h-7 px-2 rounded border border-border bg-background font-mono text-2xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground"
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="font-mono text-2xs text-muted-foreground shrink-0">baseColor</span>
                <input
                  type="text"
                  value={baseColor}
                  onChange={(e) => setBaseColor(e.target.value)}
                  placeholder="預設"
                  className="w-28 h-7 px-2 rounded border border-border bg-background font-mono text-2xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground"
                />
              </label>
            </div>
          </SectionCard>

          {/* 2. 顏色與線條細節調整 */}
          <SectionCard
            title="顏色與線條細節 (CSS Tokens)"
            action={
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setStyleConfig(DEFAULT_STYLE_LIGHT);
                    setUseCustomCssVars(true);
                  }}
                  className="px-2 py-0.5 rounded border border-border bg-card hover:bg-hover text-2xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  亮色預設
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStyleConfig(DEFAULT_STYLE_DARK);
                    setUseCustomCssVars(true);
                  }}
                  className="px-2 py-0.5 rounded border border-border bg-card hover:bg-hover text-2xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  深色預設
                </button>
                <button
                  type="button"
                  onClick={resetStyle}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-card hover:bg-hover text-2xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <RotateCcw className="size-3" />
                  <span>重設</span>
                </button>
              </div>
            }
          >
            {/* 外圍輪廓與選中填充高亮 */}
            <div className="px-4 py-3 space-y-2.5">
              <div className="text-3xs uppercase tracking-wider text-muted-foreground font-mono">
                輪廓線與選中填充高亮
              </div>
              <ColorField
                label="--muscle-outline-stroke"
                value={styleConfig.outlineStroke}
                onChange={(v) => updateStyle('outlineStroke', v)}
              />
              <RangeField
                label="--muscle-outline-stroke-width"
                value={styleConfig.outlineStrokeWidth}
                min={0}
                max={5}
                step={0.1}
                onChange={(v) => updateStyle('outlineStrokeWidth', v)}
              />
              <ColorField
                label="--muscle-active-bg"
                value={styleConfig.activeBg}
                onChange={(v) => updateStyle('activeBg', v)}
              />
            </div>

            {/* 高強度 / 主動肌 */}
            <div className="px-4 py-3 space-y-2.5">
              <div className="text-3xs uppercase tracking-wider text-muted-foreground font-mono">
                高強度 / 主動肌 (High)
              </div>
              <ColorField
                label="--muscle-intensity-high-bg"
                value={styleConfig.highBg}
                onChange={(v) => updateStyle('highBg', v)}
              />
              <ColorField
                label="--muscle-intensity-high-stroke"
                value={styleConfig.highStroke}
                onChange={(v) => updateStyle('highStroke', v)}
              />
              <RangeField
                label="--muscle-intensity-high-stroke-width"
                value={styleConfig.highStrokeWidth}
                min={0}
                max={3}
                step={0.1}
                onChange={(v) => updateStyle('highStrokeWidth', v)}
              />
            </div>

            {/* 中強度 / 協同肌 */}
            <div className="px-4 py-3 space-y-2.5">
              <div className="text-3xs uppercase tracking-wider text-muted-foreground font-mono">
                中強度 / 協同肌 (Medium)
              </div>
              <ColorField
                label="--muscle-intensity-med-bg"
                value={styleConfig.medBg}
                onChange={(v) => updateStyle('medBg', v)}
              />
              <ColorField
                label="--muscle-intensity-med-stroke"
                value={styleConfig.medStroke}
                onChange={(v) => updateStyle('medStroke', v)}
              />
              <RangeField
                label="--muscle-intensity-med-stroke-width"
                value={styleConfig.medStrokeWidth}
                min={0}
                max={3}
                step={0.1}
                onChange={(v) => updateStyle('medStrokeWidth', v)}
              />
            </div>

            {/* 低強度 / 穩定肌 */}
            <div className="px-4 py-3 space-y-2.5">
              <div className="text-3xs uppercase tracking-wider text-muted-foreground font-mono">
                低強度 / 穩定肌 (Low)
              </div>
              <ColorField
                label="--muscle-intensity-low-bg"
                value={styleConfig.lowBg}
                onChange={(v) => updateStyle('lowBg', v)}
              />
              <ColorField
                label="--muscle-intensity-low-stroke"
                value={styleConfig.lowStroke}
                onChange={(v) => updateStyle('lowStroke', v)}
              />
              <RangeField
                label="--muscle-intensity-low-stroke-width"
                value={styleConfig.lowStrokeWidth}
                min={0}
                max={3}
                step={0.1}
                onChange={(v) => updateStyle('lowStrokeWidth', v)}
              />
            </div>

            {/* 未選中肌肉 & 非肌肉部位 */}
            <div className="px-4 py-3 space-y-2.5">
              <div className="text-3xs uppercase tracking-wider text-muted-foreground font-mono">
                未選中與非肌肉結構
              </div>
              <ColorField
                label="--muscle-unselected-bg"
                value={styleConfig.unselectedBg}
                onChange={(v) => updateStyle('unselectedBg', v)}
              />
              <ColorField
                label="--muscle-unselected-stroke"
                value={styleConfig.unselectedStroke}
                onChange={(v) => updateStyle('unselectedStroke', v)}
              />
              <RangeField
                label="--muscle-unselected-stroke-width"
                value={styleConfig.unselectedStrokeWidth}
                min={0}
                max={2}
                step={0.1}
                onChange={(v) => updateStyle('unselectedStrokeWidth', v)}
              />
              <ColorField
                label="--muscle-non-color"
                value={styleConfig.nonColor}
                onChange={(v) => updateStyle('nonColor', v)}
              />
              <RangeField
                label="--muscle-non-opacity"
                value={styleConfig.nonOpacity}
                min={0}
                max={0.5}
                step={0.01}
                unit=""
                onChange={(v) => updateStyle('nonOpacity', v)}
              />
            </div>
          </SectionCard>

          {/* 3. 17 個肌群強度與角色控制台 */}
          <SectionCard
            title="17 肌群刺激設定"
            action={
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'role', label: '角色' },
                    { id: 'score', label: '數值 (0–100)' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setInputMode(m.id)}
                    className={cn(
                      'px-2 py-0.5 rounded-full border text-2xs cursor-pointer transition-colors',
                      inputMode === m.id
                        ? 'bg-foreground text-background border-foreground font-medium'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            }
            bodyClassName="max-h-[320px] overflow-y-auto"
          >
            {ALL_MUSCLES.map((m) => {
              const rawVal = muscles[m];
              const isSelected = selectedMuscle === m;
              const numVal =
                typeof rawVal === 'number'
                  ? rawVal
                  : rawVal === 'primary'
                  ? 100
                  : rawVal === 'secondary'
                  ? 60
                  : rawVal === 'stabilizer'
                  ? 30
                  : 0;

              return (
                <div
                  key={m}
                  className={cn(
                    'min-h-10 px-3 py-1.5 flex items-center justify-between gap-2 text-xs',
                    isSelected && 'bg-muted/40'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedMuscle((prev) => (prev === m ? null : m))}
                    className="flex items-center gap-2 text-left min-w-0 cursor-pointer hover:underline"
                  >
                    <span className="font-medium text-foreground truncate">
                      {getMuscleLabel(m)}
                    </span>
                    <span className="font-mono text-3xs text-muted-foreground truncate hidden sm:inline">
                      {m}
                    </span>
                  </button>

                  {inputMode === 'role' ? (
                    <div className="flex items-center gap-1 shrink-0">
                      {(
                        [
                          { id: 'none', label: '-' },
                          { id: 'primary', label: '主動' },
                          { id: 'secondary', label: '協同' },
                          { id: 'stabilizer', label: '穩定' },
                        ] as const
                      ).map((opt) => {
                        const active =
                          opt.id === 'none' ? rawVal === undefined : rawVal === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSetMuscleRole(m, opt.id)}
                            className={cn(
                              'px-2 py-0.5 rounded border text-2xs cursor-pointer transition-colors',
                              active
                                ? 'bg-foreground text-background border-foreground font-medium'
                                : 'bg-card border-border text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={numVal}
                        onChange={(e) => handleSetMuscleScore(m, Number(e.target.value))}
                        className="w-24 accent-foreground cursor-pointer"
                      />
                      <span className="w-7 text-right font-mono text-2xs tabular-nums text-foreground">
                        {numVal}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </SectionCard>
        </div>
      </div>
    </div>
  );
};
