import React from 'react';
import { type DevTokenConfig } from '../useDevTokens';
import { BrandWordmark, BrandText } from '@/components/ui/Logo';
import { Button } from '@/components/ui/button';
import { MetricValue } from '@/components/ui/metric-value';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CopySnippet } from '../components/CopySnippet';

interface TokensTabProps {
  tokens: DevTokenConfig;
  updateToken: (key: keyof DevTokenConfig, value: string) => void;
  resetTokens: () => void;
  exportCss: () => string;
  hasModifications: boolean;
}

interface ColorControlProps {
  label: string;
  tokenKey: keyof DevTokenConfig;
  fallback: string;
  currentValue?: string;
  onChange: (val: string) => void;
}

const BRAND_PRESETS = [
  { label: 'Geist Sans (預設)', value: "'Geist Variable', 'Geist', sans-serif" },
  { label: 'Inter (無襯線)', value: "'Inter Variable', 'Inter', sans-serif" },
  { label: 'Apple SF Pro', value: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" },
  { label: 'Segoe UI (Windows)', value: "'Segoe UI', -apple-system, sans-serif" },
  { label: 'Roboto', value: "Roboto, -apple-system, sans-serif" },
];

const SANS_PRESETS = [
  { label: 'Inter + 系統中黑 (預設)', value: "'Inter Variable', 'Inter', -apple-system, 'PingFang TC', 'PingFang SC', 'Microsoft JhengHei', sans-serif" },
  { label: 'Apple SF + 蘋方', value: "-apple-system, BlinkMacSystemFont, 'PingFang TC', 'PingFang SC', sans-serif" },
  { label: '微軟正黑 / 雅黑', value: "'Segoe UI', 'Microsoft JhengHei', 'Microsoft YaHei', sans-serif" },
  { label: '思源黑體 (Noto Sans)', value: "'Noto Sans CJK TC', 'Noto Sans CJK SC', 'Noto Sans', sans-serif" },
  { label: 'System UI 原生', value: "system-ui, -apple-system, sans-serif" },
];

const MONO_PRESETS = [
  { label: 'JetBrains Mono (預設)', value: "'JetBrains Mono Variable', 'JetBrains Mono', monospace" },
  { label: 'Apple SF Mono / Menlo', value: "SFMono-Regular, Menlo, Monaco, monospace" },
  { label: 'Consolas (Windows)', value: "Consolas, 'Liberation Mono', 'Courier New', monospace" },
  { label: 'Roboto Mono', value: "'Roboto Mono', monospace" },
  { label: 'System Monospace', value: "ui-monospace, monospace" },
];

const SERIF_PRESETS = [
  { label: 'Georgia (預設)', value: "Georgia, Cambria, serif" },
  { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { label: '思源宋體 (Noto Serif)', value: "'Noto Serif TC', 'Noto Serif SC', serif" },
  { label: 'Cambria', value: "Cambria, Georgia, serif" },
];

interface FontFamilyControlProps {
  label: string;
  tokenKey: keyof DevTokenConfig;
  fallback: string;
  presets: { label: string; value: string }[];
  currentValue?: string;
  onChange: (val: string) => void;
  fontFamilyClass: string;
}

const FontFamilyControl: React.FC<FontFamilyControlProps> = ({
  label,
  tokenKey,
  fallback,
  presets,
  currentValue,
  onChange,
  fontFamilyClass,
}) => {
  const activeValue = currentValue || fallback;
  const matchedPreset = presets.find((p) => p.value === currentValue);

  return (
    <div className="p-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-hover transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">{label}</span>
          <CopySnippet variant="subtle" className="text-3xs" value={tokenKey}>
            {tokenKey}
          </CopySnippet>
        </div>
        <div className="text-2xs text-muted-foreground mt-0.5 truncate font-mono">
          <span className="text-foreground/70">有效值：</span>
          <span className={fontFamilyClass}>{activeValue}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <Select
          value={matchedPreset?.value ?? ''}
          onValueChange={(val) => {
            if (val) onChange(val);
          }}
        >
          <SelectTrigger
            size="sm"
            className="h-7 text-2xs font-mono border-border bg-background w-[140px] sm:w-[170px]"
          >
            <SelectValue placeholder="選擇預設字型..." />
          </SelectTrigger>
          <SelectContent align="end">
            {presets.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={currentValue ?? ''}
          placeholder="自訂 font-family..."
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-32 sm:w-48 text-2xs font-mono px-2 rounded border-border bg-background"
        />

        {currentValue && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange('')}
            className="h-7 px-2 text-2xs font-mono text-muted-foreground hover:text-foreground shrink-0"
            title="還原預設"
          >
            ✕
          </Button>
        )}
      </div>
    </div>
  );
};

const ColorControl: React.FC<ColorControlProps> = ({
  label,
  tokenKey,
  fallback,
  currentValue,
  onChange,
}) => {
  const value = currentValue || fallback;
  return (
    <div className="flex items-center justify-between p-2 rounded border border-border bg-card hover:bg-hover transition-colors">
      <div className="min-w-0 pr-2">
        <div className="text-xs font-normal text-foreground truncate">{label}</div>
        <CopySnippet variant="subtle" className="text-3xs" value={tokenKey}>
          {tokenKey}
        </CopySnippet>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <label className="relative flex items-center justify-center w-6 h-6 rounded border border-border cursor-pointer overflow-hidden shrink-0">
          <span
            className="absolute inset-0"
            style={{ backgroundColor: value }}
          />
          <input
            type="color"
            value={value.startsWith('#') && value.length === 7 ? value : '#888888'}
            onChange={(e) => onChange(e.target.value)}
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
          />
        </label>
        <Input
          value={currentValue ?? ''}
          placeholder={fallback}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-20 text-2xs font-mono px-1.5 rounded border-border"
        />
        {currentValue && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-2xs font-mono text-muted-foreground hover:text-foreground shrink-0 px-1"
            title="還原"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

export const TokensTab: React.FC<TokensTabProps> = ({
  tokens,
  updateToken,
  resetTokens,
  exportCss,
  hasModifications,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(exportCss());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 頂部極簡控制列 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground font-sans">
            Design Tokens
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-sans">
            全域 CSS 變數即時微調。所有變更即刻穿透至頁面與彈窗。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasModifications && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetTokens}
              className="h-7 text-xs font-mono text-destructive hover:bg-destructive/10 border-border shadow-none"
            >
              全部還原
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleCopy}
            className="h-7 text-xs font-mono shadow-none"
          >
            {copied ? '已複製' : '複製 CSS'}
          </Button>
        </div>
      </div>

      {/* 實體化即時標尺矩陣 (Moments) */}
      <div className="p-4 rounded-lg border border-border bg-card space-y-3">
        <div className="text-xs font-mono text-muted-foreground">
          Live metric preview
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 標尺 1: 品牌標誌與等寬數字 */}
          <div className="p-3 rounded border border-border bg-background space-y-2">
            <div className="flex items-center justify-between">
              <BrandWordmark variant="lockup" />
              <span className="text-3xs font-mono text-muted-foreground">GEIST SANS</span>
            </div>
            <div className="text-xs text-muted-foreground leading-normal">
              <BrandText text="正文字體：e2Cal 本地優先飲食、訓練記錄工具" />
            </div>
            <div className="text-xs font-mono text-foreground tabular-nums">
              1,850 kcal · 145.0 kg · 5 reps
            </div>
          </div>

          {/* 標尺 2: 營養素實體比例 (嚴格順序：碳水、蛋白質、脂肪) */}
          <div className="p-3 rounded border border-border bg-background space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Macronutrients</span>
              <span className="text-3xs font-mono text-muted-foreground">C · P · F</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-1.5 py-0.5 text-2xs font-mono font-medium rounded border border-carbs/20 bg-carbs/10 text-carbs">
                碳水 <MetricValue value="210" unit="g" unitClassName="text-current opacity-80" />
              </span>
              <span className="px-1.5 py-0.5 text-2xs font-mono font-medium rounded border border-protein/20 bg-protein/10 text-protein">
                蛋白質 <MetricValue value="150" unit="g" unitClassName="text-current opacity-80" />
              </span>
              <span className="px-1.5 py-0.5 text-2xs font-mono font-medium rounded border border-fat/20 bg-fat/10 text-fat">
                脂肪 <MetricValue value="55" unit="g" unitClassName="text-current opacity-80" />
              </span>
              <span className="px-1.5 py-0.5 text-2xs font-mono font-medium rounded border border-sodium/20 bg-sodium/10 text-sodium">
                鈉 <MetricValue value="1,800" unit="mg" unitClassName="text-current opacity-80" />
              </span>
            </div>
            <div className="text-2xs font-mono text-muted-foreground flex items-baseline gap-1">
              Calories: <MetricValue value="2,150" unit="kcal" valueClassName="text-calories font-semibold" unitClassName="text-current opacity-80" />
            </div>
          </div>

          {/* 標尺 3: 按鈕圓角與邊框交互 */}
          <div className="p-3 rounded border border-border bg-background space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Controls</span>
              <span className="text-3xs font-mono text-muted-foreground">RADIUS & BORDER</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" className="h-6 text-2xs px-2.5">Primary</Button>
              <Button size="sm" variant="outline" className="h-6 text-2xs px-2.5">Outline</Button>
              <Button size="sm" variant="destructive" className="h-6 text-2xs px-2.5">Alert</Button>
            </div>
          </div>
        </div>
      </div>

      {/* 色彩群組 1: 核心色彩 */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-mono text-muted-foreground">
          Core tokens
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <ColorControl
            label="Background"
            tokenKey="--background"
            fallback="#ffffff"
            currentValue={tokens['--background']}
            onChange={(v) => updateToken('--background', v)}
          />
          <ColorControl
            label="Foreground"
            tokenKey="--foreground"
            fallback="#000000"
            currentValue={tokens['--foreground']}
            onChange={(v) => updateToken('--foreground', v)}
          />
          <ColorControl
            label="Card"
            tokenKey="--card"
            fallback="#ffffff"
            currentValue={tokens['--card']}
            onChange={(v) => updateToken('--card', v)}
          />
          <ColorControl
            label="Border"
            tokenKey="--border"
            fallback="#eaeaea"
            currentValue={tokens['--border']}
            onChange={(v) => updateToken('--border', v)}
          />
          <ColorControl
            label="Primary"
            tokenKey="--primary"
            fallback="#000000"
            currentValue={tokens['--primary']}
            onChange={(v) => updateToken('--primary', v)}
          />
          <ColorControl
            label="Destructive"
            tokenKey="--destructive"
            fallback="#ff0000"
            currentValue={tokens['--destructive']}
            onChange={(v) => updateToken('--destructive', v)}
          />
          <ColorControl
            label="Muted"
            tokenKey="--muted"
            fallback="#fafafa"
            currentValue={tokens['--muted']}
            onChange={(v) => updateToken('--muted', v)}
          />
          <ColorControl
            label="Muted Foreground"
            tokenKey="--muted-foreground"
            fallback="#666666"
            currentValue={tokens['--muted-foreground']}
            onChange={(v) => updateToken('--muted-foreground', v)}
          />
        </div>
      </div>

      {/* 色彩群組 2: 宏量與微量營養素 */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-mono text-muted-foreground">
          Calories, macronutrients & electrolytes
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <ColorControl
            label="Calories"
            tokenKey="--calories"
            fallback="#e11d48"
            currentValue={tokens['--calories']}
            onChange={(v) => updateToken('--calories', v)}
          />
          <ColorControl
            label="Carbs"
            tokenKey="--carbs"
            fallback="#d97706"
            currentValue={tokens['--carbs']}
            onChange={(v) => updateToken('--carbs', v)}
          />
          <ColorControl
            label="Protein"
            tokenKey="--protein"
            fallback="#0284c7"
            currentValue={tokens['--protein']}
            onChange={(v) => updateToken('--protein', v)}
          />
          <ColorControl
            label="Fat"
            tokenKey="--fat"
            fallback="#7c3aed"
            currentValue={tokens['--fat']}
            onChange={(v) => updateToken('--fat', v)}
          />
          <ColorControl
            label="Sodium"
            tokenKey="--sodium"
            fallback="#0d9488"
            currentValue={tokens['--sodium']}
            onChange={(v) => updateToken('--sodium', v)}
          />
        </div>
      </div>

      {/* 色彩群組 3: 肌群刺激強度 */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-mono text-muted-foreground">
          Muscle intensity spectrum
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <ColorControl
            label="Primary mover (High)"
            tokenKey="--muscle-intensity-high-bg"
            fallback="rgba(255, 36, 83, 0.75)"
            currentValue={tokens['--muscle-intensity-high-bg']}
            onChange={(v) => updateToken('--muscle-intensity-high-bg', v)}
          />
          <ColorControl
            label="Synergist (Medium)"
            tokenKey="--muscle-intensity-med-bg"
            fallback="rgba(255, 149, 92, 0.75)"
            currentValue={tokens['--muscle-intensity-med-bg']}
            onChange={(v) => updateToken('--muscle-intensity-med-bg', v)}
          />
          <ColorControl
            label="Stabilizer (Low)"
            tokenKey="--muscle-intensity-low-bg"
            fallback="rgba(221, 169, 141, 0.70)"
            currentValue={tokens['--muscle-intensity-low-bg']}
            onChange={(v) => updateToken('--muscle-intensity-low-bg', v)}
          />
        </div>
      </div>

      {/* 容器幾何 */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-mono text-muted-foreground">
          Corner radius
        </h3>
        <div className="p-3 rounded-lg border border-border bg-card flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span>全域圓角值：</span>
            <CopySnippet variant="code" value={tokens['--radius'] ?? '0.5rem'}>
              {tokens['--radius'] ?? '0.5 rem (8 px 預設)'}
            </CopySnippet>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { label: '0 px', value: '0rem' },
              { label: '4 px', value: '0.25rem' },
              { label: '6 px', value: '0.375rem' },
              { label: '8 px', value: '0.5rem' },
              { label: '12 px', value: '0.75rem' },
              { label: '16 px', value: '1rem' },
            ].map((option) => (
              <Button
                key={option.value}
                variant={tokens['--radius'] === option.value ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs font-mono px-2.5 border-border shadow-none"
                onClick={() => updateToken('--radius', option.value)}
              >
                {option.label}
              </Button>
            ))}
            {tokens['--radius'] && (
              <button
                type="button"
                onClick={() => updateToken('--radius', '')}
                className="text-2xs font-mono text-muted-foreground hover:text-foreground px-2"
              >
                還原
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 字型系統 (Font Families) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono text-muted-foreground">
            Font families
          </h3>
          <span className="text-3xs font-mono text-muted-foreground">
            100% 離線完備 · 4 大字族
          </span>
        </div>

        {/* 專屬即時字型對比預覽 (Typography Live Preview) */}
        <div className="p-3.5 rounded-lg border border-border bg-card space-y-3">
          <div className="text-2xs font-mono text-muted-foreground">
            Typography comparison preview
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 品牌與正文 */}
            <div className="p-3 rounded border border-border bg-background space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-mono text-muted-foreground">BRAND & SANS</span>
                <BrandWordmark variant="lockup" />
              </div>
              <p className="text-xs font-sans text-foreground leading-relaxed">
                <BrandText text="e2Cal" /> 是一款本地優先飲食、訓練記錄工具。嚴格遵循中英數排版規範，支援 100% 離線可用。
              </p>
            </div>

            {/* 等寬與襯線 */}
            <div className="p-3 rounded border border-border bg-background space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-mono text-muted-foreground">MONO & SERIF</span>
                <span className="text-2xs font-mono text-foreground">1,850 kcal · 145.0 kg</span>
              </div>
              <div className="font-mono text-xs text-foreground tabular-nums">
                C: 210 g · P: 150 g · F: 55 g (e1RM 163.1 kg)
              </div>
              <div className="font-serif italic text-xs text-muted-foreground pt-1 border-t border-border">
                "What gets measured gets managed." — 客觀度量紀錄
              </div>
            </div>
          </div>
        </div>

        {/* 四大字型設定清單 (Usage List) */}
        <div className="divide-y divide-border rounded-lg border border-border bg-card overflow-hidden">
          <FontFamilyControl
            label="Brand Font (品牌字型)"
            tokenKey="--font-brand"
            fallback="'Geist Variable', 'Geist', sans-serif"
            presets={BRAND_PRESETS}
            currentValue={tokens['--font-brand']}
            onChange={(v) => updateToken('--font-brand', v)}
            fontFamilyClass="font-brand"
          />
          <FontFamilyControl
            label="Body Sans (正文字型)"
            tokenKey="--font-sans"
            fallback="'Inter Variable', 'Inter', sans-serif"
            presets={SANS_PRESETS}
            currentValue={tokens['--font-sans']}
            onChange={(v) => updateToken('--font-sans', v)}
            fontFamilyClass="font-sans"
          />
          <FontFamilyControl
            label="Monospace (等寬數字與數據)"
            tokenKey="--font-mono"
            fallback="'JetBrains Mono Variable', 'JetBrains Mono', monospace"
            presets={MONO_PRESETS}
            currentValue={tokens['--font-mono']}
            onChange={(v) => updateToken('--font-mono', v)}
            fontFamilyClass="font-mono"
          />
          <FontFamilyControl
            label="Serif (襯線引言體)"
            tokenKey="--font-serif"
            fallback="Georgia, Cambria, 'Times New Roman', 'Noto Serif TC', serif"
            presets={SERIF_PRESETS}
            currentValue={tokens['--font-serif']}
            onChange={(v) => updateToken('--font-serif', v)}
            fontFamilyClass="font-serif"
          />
        </div>
      </div>

      {/* 字體比例尺 */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-mono text-muted-foreground">
          Type scale
        </h3>
        <div className="divide-y divide-border rounded-lg border border-border bg-card overflow-hidden">
          {[
            { token: 'text-3xs', px: '9.1px', sample: 'DELTOID 0.6' },
            { token: 'text-2xs', px: '10.1px', sample: 'CARBS 210G · PROTEIN 150G' },
            { token: 'text-xs', px: '11.2px', sample: '新增食材與課表記錄' },
            { token: 'text-sm', px: '14.0px', sample: '特級初榨橄欖油 100 g 884 kcal' },
            { token: 'text-base', px: '16.0px', sample: '今日熱量盈餘 +250 kcal' },
            { token: 'text-lg', px: '18.0px', sample: '78.5 kg · EWMA' },
            { token: 'text-xl', px: '20.0px', sample: '2,450 kcal' },
            { token: 'text-2xl', px: '24.0px', sample: '100% 離線完備' },
          ].map((item) => (
            <div key={item.token} className="px-3.5 py-2.5 flex items-center justify-between gap-4">
              <div className="w-48 shrink-0 flex items-center gap-1.5">
                <CopySnippet variant="code" value={item.token}>
                  {item.token}
                </CopySnippet>
                <CopySnippet variant="subtle" value={item.px} className="text-3xs">
                  ({item.px})
                </CopySnippet>
              </div>
              <div className={`font-mono text-foreground ${item.token} truncate text-right`}>
                {item.sample}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
