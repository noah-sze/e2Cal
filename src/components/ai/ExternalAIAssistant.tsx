import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, XIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AIProviderDialog } from '@/components/settings/AIProviderDialog';
import { MetricValue } from '@/components/ui/metric-value';
import { useAISettings } from '@/hooks/useAISettings';
import { compressImage } from '@/utils/imageCompress';
import { estimateMeal, parseNutritionLabel, formatAiErrorMessage } from '@/services/ai/aiClient';
import { triggerHaptic } from '@/lib/haptics';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { MealEstimateResult, NutritionLabelParseResult } from '@/types/ai';

const BRAILLE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/** 9x8 像素小精靈 SVG (Zero-Emoji) */
function PixelSpriteIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 9 8"
      className={cn('w-4 h-3.5 shrink-0', className)}
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="2" y="0" width="1" height="1" />
      <rect x="6" y="0" width="1" height="1" />
      <rect x="1" y="1" width="7" height="1" />
      <rect x="0" y="2" width="9" height="3" />
      <rect x="1" y="5" width="7" height="1" />
      <rect x="2" y="3" width="1" height="1" className="fill-card group-hover:fill-foreground transition-colors" />
      <rect x="6" y="3" width="1" height="1" className="fill-card group-hover:fill-foreground transition-colors" />
      <rect x="2" y="6" width="1" height="1" />
      <rect x="6" y="6" width="1" height="1" />
    </svg>
  );
}

/** 8x8 像素停止方塊 SVG (Zero-Emoji) */
function PixelStopIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 8 8"
      className={cn('size-2.5 shrink-0', className)}
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="6" height="6" />
    </svg>
  );
}

/** 11x9 像素相機 SVG (Zero-Emoji) */
function PixelCameraIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 11 9"
      className={cn('w-3.5 h-3 shrink-0', className)}
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="3" y="0" width="5" height="1" />
      <rect x="0" y="1" width="11" height="1" />
      <rect x="0" y="2" width="1" height="6" />
      <rect x="10" y="2" width="1" height="6" />
      <rect x="0" y="8" width="11" height="1" />
      <rect x="4" y="3" width="3" height="1" />
      <rect x="3" y="4" width="1" height="2" />
      <rect x="7" y="4" width="1" height="2" />
      <rect x="4" y="6" width="3" height="1" />
      <rect x="8" y="2" width="1" height="1" />
    </svg>
  );
}

/** 7x7 像素向上發送箭頭 SVG (Zero-Emoji) */
function PixelArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 7 7"
      className={cn('w-2.5 h-2.5 shrink-0', className)}
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="3" y="0" width="1" height="7" />
      <rect x="2" y="1" width="1" height="1" />
      <rect x="4" y="1" width="1" height="1" />
      <rect x="1" y="2" width="1" height="1" />
      <rect x="5" y="2" width="1" height="1" />
    </svg>
  );
}

export interface ExternalAIAssistantProps {
  /** 外食估算模式 ('meal') 或食品標籤解析模式 ('foodLabel') */
  mode: 'meal' | 'foodLabel';
  /** 綁定外部彈窗開關狀態，關閉時清除所有草稿與結果 */
  dialogOpen: boolean;
  /** 受控焦點狀態（啟用空間焦點交接：true 時 AI 佔據視窗中央、原生彈窗退讓變淡；false 時收縮為頂部膠囊並保留草稿） */
  focused?: boolean;
  /** 受控焦點變更回調 */
  onFocusedChange?: (focused: boolean) => void;
  /** 注入外食估算結果至原生表單 */
  onInjectMeal?: (result: MealEstimateResult) => void;
  /** 注入營養標籤結果至原生表單 */
  onInjectFoodLabel?: (result: NutritionLabelParseResult) => void;
  /** Dev 測試專用：啟用模擬 AI 請求，無需真實 API Key */
  mockMode?: boolean;
  /** Dev 測試專用：模擬結果類型 ('success' | 'error') */
  mockScenario?: 'success' | 'error';
}

type WorkPhase = 'expanded' | 'loading' | 'done';

/**
 * 外部 AI 掛載助手 (方案 E1 + 空間焦點交接)
 * - 未配置 API Key（且非測試模擬模式）時不渲染任何 DOM
 * - 焦點切換回原生表單時自動收縮回頂部膠囊，保留文字與圖片草稿不丟失
 */
export function ExternalAIAssistant({
  mode,
  dialogOpen,
  focused,
  onFocusedChange,
  onInjectMeal,
  onInjectFoodLabel,
  mockMode = false,
  mockScenario = 'success',
}: ExternalAIAssistantProps) {
  const { t } = useTranslation();
  const { settings, profiles, activeProfile, setActiveProfile, addProfile, isConfigured } =
    useAISettings();
  const [addProviderOpen, setAddProviderOpen] = useState(false);

  const isSpatialMode = focused !== undefined;
  const [internalFocused, setInternalFocused] = useState(false);
  const isFocused = isSpatialMode ? focused : internalFocused;

  const setFocused = (next: boolean) => {
    if (onFocusedChange) {
      onFocusedChange(next);
    } else {
      setInternalFocused(next);
    }
  };

  const [workPhase, setWorkPhase] = useState<WorkPhase>('expanded');
  const [promptText, setPromptText] = useState('');
  const [attachedImage, setAttachedImage] = useState<{
    base64: string;
    dataUrl: string;
    name: string;
  } | null>(null);
  const [brailleIdx, setBrailleIdx] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lockedLoadingHeight, setLockedLoadingHeight] = useState<number | null>(null);
  const [mealResult, setMealResult] = useState<MealEstimateResult | null>(null);
  const [excludedComponentIndices, setExcludedComponentIndices] = useState<number[]>([]);
  const [foodResult, setFoodResult] = useState<NutritionLabelParseResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputCardRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 僅當整個 Dialog 關閉時才徹底重置草稿與狀態並中止進行中請求
  useEffect(() => {
    if (!dialogOpen) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setInternalFocused(false);
      setWorkPhase('expanded');
      setLockedLoadingHeight(null);
      setPromptText('');
      setAttachedImage(null);
      setMealResult(null);
      setExcludedComponentIndices([]);
      setFoodResult(null);
    }
  }, [dialogOpen]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  // Braille 動態旋轉進度字元與經過時間遙測
  useEffect(() => {
    if (workPhase !== 'loading') return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setBrailleIdx((prev) => (prev + 1) % BRAILLE_FRAMES.length);
      setElapsedMs(Date.now() - startedAt);
    }, 95);
    return () => window.clearInterval(timer);
  }, [workPhase]);

  const canSubmit = Boolean(attachedImage || promptText.trim());
  const hasDraft = Boolean(promptText.trim() || attachedImage || workPhase === 'done');

  const runAnalysis = async () => {
    const cleanText = promptText.trim();
    const imageBase64 = attachedImage?.base64;
    if (!imageBase64 && !cleanText) return;

    if (!isConfigured && !mockMode) {
      if (profiles.length === 0) {
        triggerHaptic('selection');
        setAddProviderOpen(true);
        return;
      }
      triggerHaptic('error');
      toast.show(formatAiErrorMessage('MISSING_API_KEY'));
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const measuredHeight = inputCardRef.current?.offsetHeight;
    setLockedLoadingHeight(measuredHeight && measuredHeight > 0 ? measuredHeight : null);
    setElapsedMs(0);
    setWorkPhase('loading');
    setMealResult(null);
    setExcludedComponentIndices([]);
    setFoodResult(null);

    try {
      if (mockMode) {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, 1100);
          controller.signal.addEventListener(
            'abort',
            () => {
              window.clearTimeout(timer);
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true }
          );
        });
        if (controller.signal.aborted) return;
        if (mockScenario === 'error') {
          throw new Error(
            formatAiErrorMessage(
              'This model is currently experiencing high demand. Spikes in demand are usually temporary.',
              503
            )
          );
        }

        if (mode === 'meal') {
          setMealResult({
            title: cleanText || '香煎雞胸便當',
            summary: '模擬結構化拆解結果',
            totalCalories: 645,
            totalCarbs: 68,
            totalProtein: 42,
            totalFat: 23,
            totalSugar: 4.5,
            totalFiber: 5.2,
            components: [
              {
                name: '白飯',
                estimatedWeightGrams: 180,
                calories: 234,
                carbs: 51,
                protein: 4.5,
                fat: 0.5,
              },
              {
                name: '香煎雞胸肉',
                estimatedWeightGrams: 150,
                calories: 248,
                carbs: 0,
                protein: 34,
                fat: 12,
              },
              {
                name: '炒時蔬與烹調油',
                estimatedWeightGrams: 120,
                calories: 163,
                carbs: 17,
                protein: 3.5,
                fat: 10.5,
              },
            ],
          });
        } else {
          setFoodResult({
            name: cleanText || '分離乳清蛋白粉',
            brand: 'Myprotein',
            servingSize: 25,
            servingUnit: 'g',
            calories: 94,
            carbs: 0.6,
            protein: 22.0,
            fat: 0.3,
            sugar: 0.2,
            fiber: 0,
            notes: 'Mock nutrition label result',
          });
        }
        abortControllerRef.current = null;
        triggerHaptic('success');
        setWorkPhase('done');
        return;
      }

      if (mode === 'meal') {
        const res = await estimateMeal(
          imageBase64,
          cleanText || undefined,
          settings,
          controller.signal
        );
        if (controller.signal.aborted) return;
        setMealResult(res);
      } else {
        const res = await parseNutritionLabel(
          imageBase64,
          settings,
          cleanText || undefined,
          controller.signal
        );
        if (controller.signal.aborted) return;
        setFoodResult(res);
      }
      abortControllerRef.current = null;
      triggerHaptic('success');
      setWorkPhase('done');
    } catch (err) {
      if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        return;
      }
      abortControllerRef.current = null;
      const msg = err instanceof Error ? err.message : String(err);
      triggerHaptic('error');
      toast.show(msg || t('diet.aiScanFailed', '辨識失敗，請確認圖片清晰度或重試'));
      setWorkPhase('expanded');
    }
  };

  /** 手動停止進行中的 AI 請求並回到輸入態（保留草稿） */
  const handleStopAnalysis = () => {
    triggerHaptic('selection');
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setWorkPhase('expanded');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, { maxDimension: 1024, quality: 0.8 });
      setAttachedImage({
        base64: compressed.base64,
        dataUrl: compressed.dataUrl,
        name: file.name || 'image.jpg',
      });
      triggerHaptic('selection');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      triggerHaptic('error');
      toast.show(msg);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 僅收合為膠囊，保留輸入草稿與結果
  const handleCollapsePreserveDraft = () => {
    triggerHaptic('selection');
    setFocused(false);
  };

  // 徹底清除草稿並收合
  const handleClearAndCollapse = () => {
    triggerHaptic('selection');
    setFocused(false);
    setWorkPhase('expanded');
    setPromptText('');
    setAttachedImage(null);
    setMealResult(null);
    setExcludedComponentIndices([]);
    setFoodResult(null);
  };

  const toggleMealComponent = (idx: number) => {
    triggerHaptic('selection');
    setExcludedComponentIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const activeMealSummary = (() => {
    if (!mealResult) {
      return {
        includedComponents: [],
        totalCalories: 0,
        totalCarbs: 0,
        totalProtein: 0,
        totalFat: 0,
        totalSugar: 0,
        totalFiber: 0,
        canInjectMeal: false,
      };
    }
    const components = mealResult.components || [];
    if (components.length === 0) {
      return {
        includedComponents: [],
        totalCalories: Math.round(mealResult.totalCalories || 0),
        totalCarbs: Math.round((mealResult.totalCarbs || 0) * 10) / 10,
        totalProtein: Math.round((mealResult.totalProtein || 0) * 10) / 10,
        totalFat: Math.round((mealResult.totalFat || 0) * 10) / 10,
        totalSugar: Math.round((mealResult.totalSugar || 0) * 10) / 10,
        totalFiber: Math.round((mealResult.totalFiber || 0) * 10) / 10,
        canInjectMeal: true,
      };
    }
    const includedComponents = components.filter(
      (_, idx) => !excludedComponentIndices.includes(idx)
    );
    return {
      includedComponents,
      totalCalories: Math.round(includedComponents.reduce((s, c) => s + (c.calories || 0), 0)),
      totalCarbs:
        Math.round(includedComponents.reduce((s, c) => s + (c.carbs || 0), 0) * 10) / 10,
      totalProtein:
        Math.round(includedComponents.reduce((s, c) => s + (c.protein || 0), 0) * 10) / 10,
      totalFat:
        Math.round(includedComponents.reduce((s, c) => s + (c.fat || 0), 0) * 10) / 10,
      totalSugar:
        Math.round(includedComponents.reduce((s, c) => s + (c.sugar || 0), 0) * 10) / 10,
      totalFiber:
        Math.round(includedComponents.reduce((s, c) => s + (c.fiber || 0), 0) * 10) / 10,
      canInjectMeal: includedComponents.length > 0,
    };
  })();

  const handleInject = () => {
    if (mode === 'meal' && !activeMealSummary.canInjectMeal) return;
    triggerHaptic('success');
    if (mode === 'meal' && mealResult && onInjectMeal) {
      const hasExcluded = excludedComponentIndices.length > 0;
      onInjectMeal({
        ...mealResult,
        totalCalories: activeMealSummary.totalCalories,
        totalCarbs: activeMealSummary.totalCarbs,
        totalProtein: activeMealSummary.totalProtein,
        totalFat: activeMealSummary.totalFat,
        totalSugar: activeMealSummary.totalSugar,
        totalFiber: activeMealSummary.totalFiber,
        components: activeMealSummary.includedComponents,
        title:
          hasExcluded && activeMealSummary.includedComponents.length > 0
            ? activeMealSummary.includedComponents.map((c) => c.name).join(' + ')
            : mealResult.title,
      });
      toast.show(t('diet.aiInjected', '已填入'));
    } else if (mode === 'foodLabel' && foodResult && onInjectFoodLabel) {
      onInjectFoodLabel(foodResult);
      toast.show(t('diet.aiInjected', '已填入'));
    }
    setFocused(false);
    setWorkPhase('expanded');
    setPromptText('');
    setAttachedImage(null);
    setMealResult(null);
    setExcludedComponentIndices([]);
    setFoodResult(null);
  };

  const pillLabel =
    mode === 'meal'
      ? t('diet.aiEstimatePill', 'AI 估算')
      : t('diet.aiScanPill', 'AI 掃描');

  const inputPlaceholder =
    mode === 'meal'
      ? t('diet.aiMealPlaceholder', '輸入餐點描述或拍照…')
      : t('diet.aiLabelPlaceholder', '輸入或拍攝營養標籤…');

  const renderWorkingCard = () => {
    if (workPhase === 'loading') {
      const cols = 28;
      const rows = 6;
      const waveCenter = ((elapsedMs / 95) * 1.35) % 36 - 4;
      const macroCols = ['var(--carbs)', 'var(--protein)', 'var(--fat)'];
      const statusLabel =
        mode === 'meal'
          ? t('diet.aiEstimating', '估算中...')
          : t('diet.aiScanning', '辨識中...');

      return (
        <div
          style={{ height: lockedLoadingHeight ? `${lockedLoadingHeight}px` : '86px' }}
          className="relative w-full rounded-xl border border-border bg-card text-card-foreground px-3 py-2.5 flex items-center justify-between gap-3 overflow-hidden"
        >
          {/* 方案 13：全幅營養三原色微光點陣聲場 */}
          <svg
            viewBox="0 0 312 76"
            className="pointer-events-none absolute inset-0 w-full h-full text-foreground"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {Array.from({ length: cols * rows }).map((_, idx) => {
              const x = Math.floor(idx / rows);
              const y = idx % rows;
              const d = Math.abs(x - waveCenter);
              const inWave = d < 3.5;
              const opacity = d < 1.4 ? 0.45 : inWave ? 0.2 : 0.045;
              const fill = inWave ? macroCols[(x + y) % 3] : 'currentColor';
              return (
                <circle
                  key={idx}
                  cx={x * 11 + 6}
                  cy={y * 12 + 8}
                  r={d < 1.4 ? 1.6 : 1.35}
                  fill={fill}
                  opacity={opacity}
                />
              );
            })}
          </svg>

          {/* 左側：左上角供應商標頭（與輸入框卡片一致）+ 左下角估算中與時間 */}
          <div className="relative z-10 h-full flex flex-col justify-between min-w-0">
            <div className="flex items-center gap-1.5 px-0.5 text-[11px] font-mono text-foreground">
              <PixelSpriteIcon />
              <span className="truncate">{activeProfile?.name ?? 'PIXEL_AI'}</span>
            </div>
            <div className="flex items-center gap-2 px-0.5 font-mono text-xs">
              <span className="text-foreground font-medium">{statusLabel}</span>
              <span className="tabular-nums text-[11px] text-muted-foreground">
                {(elapsedMs / 1000).toFixed(1)}s
              </span>
            </div>
          </div>

          {/* 右側：膠囊停止按鈕 */}
          <button
            type="button"
            onClick={handleStopAnalysis}
            aria-label={t('common.stop', '停止')}
            className="relative z-10 h-8 px-3.5 rounded-full bg-foreground text-background hover:opacity-85 flex items-center gap-1.5 text-xs font-mono shrink-0 cursor-pointer transition-opacity active:scale-95"
          >
            <PixelStopIcon />
            <span>{t('common.stop', '停止')}</span>
          </button>
        </div>
      );
    }

    if (workPhase === 'done' && (mealResult || foodResult)) {
      const foodTitle =
        foodResult &&
        ([foodResult.brand, foodResult.name].filter(Boolean).join(' · ') ||
          t('diet.aiLabelParsed', '標籤已解析'));

      return (
        <div className="w-full rounded-xl border border-border bg-card text-card-foreground p-3 space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border">
            <span className="flex items-center gap-1.5 font-mono font-medium text-foreground min-w-0">
              <PixelSpriteIcon />
              {mode === 'meal' && mealResult ? (
                <MetricValue
                  value={activeMealSummary.totalCalories}
                  unit="kcal"
                  valueClassName="font-semibold text-foreground"
                />
              ) : (
                <span className="truncate">
                  {foodTitle || t('diet.aiLabelParsed', '標籤已解析')}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={handleClearAndCollapse}
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
            >
              {t('common.clear', '清除')}
            </button>
          </div>

          {mode === 'meal' && mealResult && (
            <div className="space-y-2.5">
              {/* 方案 3：與標籤頁統一的 C → P → F 迷你營養三格 */}
              <div className="grid grid-cols-3 divide-x divide-border border border-border rounded-lg text-center bg-card">
                <div className="py-1.5 px-1">
                  <div className="text-[10px] text-muted-foreground">
                    {t('nutrients.carbs', '碳水')}
                  </div>
                  <div className="mt-0.5 flex justify-center">
                    <MetricValue
                      value={activeMealSummary.totalCarbs}
                      unit="g"
                      valueClassName="text-[11px] font-semibold text-[var(--carbs)]"
                    />
                  </div>
                </div>
                <div className="py-1.5 px-1">
                  <div className="text-[10px] text-muted-foreground">
                    {t('nutrients.protein', '蛋白質')}
                  </div>
                  <div className="mt-0.5 flex justify-center">
                    <MetricValue
                      value={activeMealSummary.totalProtein}
                      unit="g"
                      valueClassName="text-[11px] font-semibold text-[var(--protein)]"
                    />
                  </div>
                </div>
                <div className="py-1.5 px-1">
                  <div className="text-[10px] text-muted-foreground">
                    {t('nutrients.fat', '脂肪')}
                  </div>
                  <div className="mt-0.5 flex justify-center">
                    <MetricValue
                      value={activeMealSummary.totalFat}
                      unit="g"
                      valueClassName="text-[11px] font-semibold text-[var(--fat)]"
                    />
                  </div>
                </div>
              </div>

              {/* 可手動剔除/恢復的食材清單 */}
              {mealResult.components && mealResult.components.length > 0 ? (
                <div className="border border-border rounded-lg overflow-hidden divide-y divide-border max-h-36 overflow-y-auto">
                  {mealResult.components.map((c, idx) => {
                    const isExcluded = excludedComponentIndices.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleMealComponent(idx)}
                        className="w-full min-h-8 px-3 py-1 flex items-center justify-between gap-2 text-left hover:bg-hover transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              'size-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                              !isExcluded
                                ? 'bg-foreground border-foreground text-background'
                                : 'border-border text-transparent'
                            )}
                          >
                            <Check className="size-2.5 stroke-[3]" />
                          </span>
                          <span
                            className={cn(
                              'text-[11px] font-mono truncate flex items-center gap-1',
                              isExcluded ? 'line-through text-muted-foreground/50' : 'text-foreground'
                            )}
                          >
                            <span className="truncate">{c.name}</span>
                            {c.estimatedWeightGrams ? (
                              <>
                                <span>·</span>
                                <MetricValue value={c.estimatedWeightGrams} unit="g" />
                              </>
                            ) : null}
                          </span>
                        </span>
                        <MetricValue
                          value={Math.round(c.calories)}
                          unit="kcal"
                          className="shrink-0 text-[11px]"
                          valueClassName={
                            isExcluded ? 'line-through text-muted-foreground/40' : 'text-muted-foreground'
                          }
                        />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] font-mono text-muted-foreground">
                  {mealResult.summary || mealResult.title}
                </div>
              )}
            </div>
          )}

          {mode === 'foodLabel' && foodResult && (
            <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
              <div className="h-8 px-3 bg-muted/30 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <span>{t('diet.per', '每')}</span>
                  <MetricValue
                    value={foodResult.servingSize ?? '-'}
                    unit={foodResult.servingUnit || 'g'}
                    valueClassName="text-foreground"
                  />
                </span>
                <MetricValue
                  value={foodResult.calories ?? '-'}
                  unit="kcal"
                  valueClassName="font-semibold text-foreground"
                />
              </div>
              <div className="grid grid-cols-3 divide-x divide-border text-center bg-card">
                <div className="py-2 px-1">
                  <div className="text-[10px] text-muted-foreground">
                    {t('nutrients.carbs', '碳水')}
                  </div>
                  <div className="mt-0.5 flex justify-center">
                    <MetricValue
                      value={foodResult.carbs ?? '-'}
                      unit="g"
                      valueClassName="font-semibold text-[var(--carbs)]"
                    />
                  </div>
                </div>
                <div className="py-2 px-1">
                  <div className="text-[10px] text-muted-foreground">
                    {t('nutrients.protein', '蛋白質')}
                  </div>
                  <div className="mt-0.5 flex justify-center">
                    <MetricValue
                      value={foodResult.protein ?? '-'}
                      unit="g"
                      valueClassName="font-semibold text-[var(--protein)]"
                    />
                  </div>
                </div>
                <div className="py-2 px-1">
                  <div className="text-[10px] text-muted-foreground">
                    {t('nutrients.fat', '脂肪')}
                  </div>
                  <div className="mt-0.5 flex justify-center">
                    <MetricValue
                      value={foodResult.fat ?? '-'}
                      unit="g"
                      valueClassName="font-semibold text-[var(--fat)]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={mode === 'meal' && !activeMealSummary.canInjectMeal}
            onClick={handleInject}
            className={cn(
              'w-full h-8 rounded-lg text-xs font-mono font-medium transition-all flex items-center justify-center gap-1',
              mode === 'meal' && !activeMealSummary.canInjectMeal
                ? 'bg-muted text-muted-foreground opacity-40 cursor-not-allowed'
                : 'bg-foreground text-background hover:opacity-90 cursor-pointer active:scale-[0.98]'
            )}
          >
            <span>{t('diet.aiInjectToForm', '填入表單')}</span>
            <span>↓</span>
          </button>
        </div>
      );
    }

    // workPhase === 'expanded'
    return (
      <div
        ref={inputCardRef}
        className="w-full rounded-xl border border-border bg-card text-card-foreground p-2.5 space-y-2"
      >
        <div className="flex items-center justify-between px-0.5 text-[11px] font-mono text-muted-foreground">
          {profiles.length === 0 ? (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setAddProviderOpen(true);
              }}
              className="flex items-center gap-1.5 text-foreground hover:opacity-80 cursor-pointer transition-opacity"
            >
              <PixelSpriteIcon />
              <span>{t('common.add', '新增')}</span>
            </button>
          ) : (
            <Select
              value={activeProfile?.id ?? ''}
              onValueChange={(val) => {
                if (!val) return;
                triggerHaptic('selection');
                if (val === '__add__') {
                  setAddProviderOpen(true);
                  return;
                }
                setActiveProfile(val);
              }}
            >
              <SelectTrigger
                size="custom"
                iconClassName="size-3 text-muted-foreground/60"
                className="flex items-center gap-1.5 text-[11px] font-mono text-foreground hover:opacity-80 cursor-pointer transition-opacity max-w-[200px]"
              >
                <PixelSpriteIcon />
                <SelectValue className="flex-none truncate">
                  {activeProfile?.name ?? '-'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start" className="min-w-40 z-[105]">
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
                <SelectItem value="__add__">+ {t('common.add', '新增')}</SelectItem>
              </SelectContent>
            </Select>
          )}
          <button
            type="button"
            onClick={handleCollapsePreserveDraft}
            aria-label={t('common.collapse', '收起')}
            className="size-6 -mr-0.5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
          >
            <XIcon className="size-3.5 stroke-[2.2]" />
          </button>
        </div>

        {attachedImage && (
          <div className="flex items-center">
            <div className="inline-flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-md border border-border bg-muted/40 text-[11px] font-mono text-foreground max-w-full">
              <img
                src={attachedImage.dataUrl}
                alt={attachedImage.name}
                className="size-5 rounded-xs object-cover shrink-0 border border-border/60"
              />
              <span className="truncate max-w-[160px]">{attachedImage.name}</span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setAttachedImage(null);
                }}
                aria-label={t('common.delete', '刪除')}
                className="text-muted-foreground hover:text-foreground p-0.5 cursor-pointer shrink-0"
              >
                <XIcon className="size-3 stroke-[2.2]" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) {
                e.preventDefault();
                void runAnalysis();
              } else if (e.key === 'Escape') {
                e.stopPropagation();
                handleCollapsePreserveDraft();
              }
            }}
            placeholder={inputPlaceholder}
            className="flex-1 min-w-0 h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-sans text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden focus:border-foreground"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title={t('diet.aiTakePhoto', '拍照或選圖')}
            aria-label={t('diet.aiTakePhoto', '拍照或選圖')}
            className={cn(
              'size-8 rounded-lg border border-border flex items-center justify-center cursor-pointer shrink-0 transition-colors active:scale-95',
              attachedImage
                ? 'bg-foreground text-background border-foreground hover:opacity-90'
                : 'bg-muted/40 hover:bg-hover text-foreground'
            )}
          >
            <PixelCameraIcon />
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void runAnalysis()}
            title={t('diet.aiRun', '解析')}
            aria-label={t('diet.aiRun', '解析')}
            className={cn(
              'size-8 rounded-lg flex items-center justify-center shrink-0 transition-all',
              canSubmit
                ? 'bg-foreground text-background hover:opacity-90 cursor-pointer active:scale-95'
                : 'bg-muted text-muted-foreground opacity-40 cursor-not-allowed'
            )}
          >
            <PixelArrowUpIcon />
          </button>
        </div>
      </div>
    );
  };

  const pillButton = (
    <button
      type="button"
      onClick={() => {
        triggerHaptic('selection');
        setFocused(true);
      }}
      className="group h-8 px-3.5 rounded-full border border-border bg-card text-foreground hover:bg-foreground hover:text-background hover:border-foreground flex items-center gap-2 text-xs font-mono cursor-pointer transition-all active:scale-95"
    >
      <PixelSpriteIcon className={workPhase === 'loading' ? 'animate-bounce' : undefined} />
      <span>{pillLabel}</span>
      {workPhase === 'loading' ? (
        <span className="tabular-nums text-muted-foreground group-hover:text-background">
          {BRAILLE_FRAMES[brailleIdx]}
        </span>
      ) : (
        hasDraft && <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
      )}
    </button>
  );

  // 空間焦點交接模式（彈窗中使用）：絲滑於「頂部膠囊」與「視窗正中央工作卡」之間過渡
  if (isSpatialMode) {
    return (
      <div className="w-full h-full relative select-none pointer-events-none">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* 1. 頂部待機膠囊層 */}
        <div
          className={cn(
            'absolute bottom-full left-0 right-0 mb-2.5 flex justify-center [transition:transform_380ms_cubic-bezier(0.22,1,0.36,1),opacity_320ms_cubic-bezier(0.22,1,0.36,1)] will-change-[transform,opacity]',
            isFocused
              ? 'opacity-0 translate-y-2 scale-90 pointer-events-none'
              : 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
          )}
        >
          {pillButton}
        </div>

        {/* 2. 視窗中央工作卡層（相對於整個視窗中央定位，80px 絲滑滑入） */}
        <div
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 w-[320px] max-w-[calc(100vw-24px)] z-[90] [transition:transform_380ms_cubic-bezier(0.22,1,0.36,1),opacity_320ms_cubic-bezier(0.22,1,0.36,1)] will-change-[transform,opacity]',
            isFocused
              ? 'opacity-100 translate-y-[calc(-50%-48px)] scale-100 pointer-events-auto'
              : 'opacity-0 translate-y-[calc(-50%-128px)] scale-[0.92] pointer-events-none'
          )}
        >
          {renderWorkingCard()}
        </div>

        <AIProviderDialog
          open={addProviderOpen}
          onOpenChange={setAddProviderOpen}
          profile={null}
          canDelete={false}
          overlayClassName="z-[100]"
          dialogClassName="z-[100]"
          onSave={(data) => {
            addProfile(data, true);
            toast.show(t('common.saved', '已儲存'));
          }}
        />
      </div>
    );
  }

  // 非受控模式（Dev 沙盒內嵌演示使用）
  return (
    <div className="w-full select-none">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      {!isFocused ? <div className="flex justify-center">{pillButton}</div> : renderWorkingCard()}

      <AIProviderDialog
        open={addProviderOpen}
        onOpenChange={setAddProviderOpen}
        profile={null}
        canDelete={false}
        overlayClassName="z-[100]"
        dialogClassName="z-[100]"
        onSave={(data) => {
          addProfile(data, true);
          toast.show(t('common.saved', '已儲存'));
        }}
      />
    </div>
  );
}
