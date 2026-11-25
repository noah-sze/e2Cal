import { useState, useEffect, useMemo, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  PrecisionDialogContent,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NumericKeypadDialog } from '@/components/ui/NumericKeypadDialog';
import { Popover, PopoverContent } from '@/components/ui/popover';
import type { FoodItem, FoodCategory } from '@/types';
import { triggerHaptic } from '@/lib/haptics';
import { cn, formatDisplayAmount } from '@/lib/utils';
import { useFoods } from '@/hooks/useFoods';
import { useUnitPreferences } from '@/hooks/useUnitPreferences';
import { normalizeFoodInputToMetric } from '@/utils/nutritionMath';
import {
  syncParentWithSubNutrients,
  clampParentToSubNutrients,
} from '@/utils/macroSubNutrientsMath';
import { convertFoodWeight, convertFoodVolume, kcalToKj } from '@/utils/unitMath';
import { matchesAutocomplete } from '@/utils/multilingualSearch';
import { ChevronRight } from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { NutritionFactsCard } from '@/components/food/NutritionFactsCard';
import { AuthorityFoodDetailsDialog } from '@/components/food/AuthorityFoodDetailsDialog';
import { MetricValue } from '@/components/ui/metric-value';
import { ExternalAIAssistant } from '@/components/ai/ExternalAIAssistant';
import type { NutritionLabelParseResult } from '@/types/ai';

type KeypadField =
  | 'serving'
  | 'basis'
  | 'calories'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'sugar'
  | 'fiber'
  | 'saturatedFat'
  | 'transFat'
  | 'sodium'
  | 'edibleRate';

interface KeypadConfig {
  field: KeypadField;
  title: string;
  value: number;
  unit: string;
  allowedUnits?: string[];
  allowDecimals?: boolean;
  maxDecimals?: number;
  anchorEl?: HTMLElement | null;
  valueClassName?: string;
  titleClassName?: string;
}

export type FoodFormData = Omit<
  FoodItem,
  'id' | 'createdAt' | 'updatedAt' | 'isCustom' | 'isArchived'
>;

export interface FoodFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: FoodItem | null;
  onSubmit: (data: FoodFormData) => Promise<void> | void;
  /** 自訂遮罩層級類名 (例如 'z-[80]') */
  overlayClassName?: string;
  /** 自訂彈窗本體類名 */
  className?: string;
  /** 自訂彈窗層級數值 (例如 80) */
  zIndex?: number;
  /** 權威庫導入草稿模式：保留營養素與 100g 基準，但清空名稱、分類與預設份量由使用者自填 */
  prefillBlankBasics?: boolean;
  /** Dev 測試專用：模擬外部 AI 請求 */
  aiMockMode?: boolean;
  aiMockScenario?: 'success' | 'error';
}

/**
 * 領域共用組件：新增與編輯單品食材表單彈窗
 * 嚴格遵循 Design Standards 規範：
 * - 1:1 復刻 CategoryDetails「基準營養素」Vercel Usage List (divide-y divide-border)
 * - 每行高度精確維持 h-10 px-4
 * - 拆分「食用份量」與「自定義營養標籤依據」，自動純函數換算
 * - 智能識別原始數據依份量或自定義基準回填
 */
export function FoodFormDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  overlayClassName,
  className,
  zIndex,
  prefillBlankBasics = false,
  aiMockMode,
  aiMockScenario,
}: FoodFormDialogProps) {
  const { t } = useTranslation();
  const { foodWeightUnit, foodVolumeUnit, energyUnit } = useUnitPreferences();
  const isEdit = !!initialData;
  const isAuthorityFood = Boolean(initialData?.dataSource);
  const elevatedOverlayZClass = zIndex && zIndex >= 80 ? 'z-[100]' : undefined;

  // 基本資訊狀態
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory | ''>('');
  const [brand, setBrand] = useState('');
  const [isBrandFocused, setIsBrandFocused] = useState(false);
  const [brandHighlightIdx, setBrandHighlightIdx] = useState(-1);
  const [brandInputEl, setBrandInputEl] = useState<HTMLInputElement | null>(null);
  const { allFoods } = useFoods();

  // 提取既有品牌清單（依使用頻次排序、大小寫去重）
  const existingBrands = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const f of allFoods) {
      const raw = f.brand?.trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      const prev = counts.get(key);
      if (prev) {
        prev.count += 1;
      } else {
        counts.set(key, { label: raw, count: 1 });
      }
    }
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .map((entry) => entry.label);
  }, [allFoods]);

  // 依輸入內容進行簡繁與拼音首字母聯想過濾
  const brandSuggestions = useMemo(() => {
    const q = brand.trim();
    if (!q) return existingBrands;
    const matched = existingBrands.filter((b) => matchesAutocomplete(q, b));
    if (matched.length === 1 && matched[0].toLowerCase() === q.toLowerCase()) {
      return [];
    }
    return matched;
  }, [brand, existingBrands]);

  const showBrandSuggestions = open && isBrandFocused && brandSuggestions.length > 0;

  const brandPlaceholder = t('diet.brand');
  const namePlaceholder = t('diet.foodNamePlaceholder');

  // 物理份量與單位
  const [servingSize, setServingSize] = useState('');
  const [servingUnit, setServingUnit] = useState<string>(foodWeightUnit);

  // 標籤基準模式 ('serving' = 依份量, 'custom' = 自定義標籤依據如每 100g 或每 30g)
  const [basisMode, setBasisMode] = useState<'serving' | 'custom'>('serving');
  const [basisSize, setBasisSize] = useState('');
  const [basisUnit, setBasisUnit] = useState<string>(foodWeightUnit);

  // 熱量單位 ('kcal' | 'kJ')
  const [calorieUnit, setCalorieUnit] = useState<'kcal' | 'kJ'>(energyUnit);

  // 輸入之營養素數值 (對應當前 basisMode 下的輸入值)
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [saturatedFat, setSaturatedFat] = useState('');
  const [transFat, setTransFat] = useState('');
  const [sodium, setSodium] = useState('');
  const [edibleRatePct, setEdibleRatePct] = useState('100');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keypadConfig, setKeypadConfig] = useState<KeypadConfig | null>(null);
  const [isAuthorityDetailsOpen, setIsAuthorityDetailsOpen] = useState(false);

  // 當彈窗開啟或 initialData 改變時，將底層公制 SI 真值依當前偏好單位回填（一律以「份量」模式呈現）
  useEffect(() => {
    if (!open) return;
    setIsAuthorityDetailsOpen(false);

    if (initialData) {
      setName(prefillBlankBasics ? '' : initialData.name || '');
      setCategory(prefillBlankBasics ? '' : initialData.category || 'natural');
      setBrand(prefillBlankBasics ? '' : initialData.brand || '');
      setCalorieUnit(energyUnit);

      // 1. 份量依使用者當前偏好單位從底層公制 SI 即時換算呈現
      const isBeverage = initialData.category === 'beverage';
      const prefServingUnit = isBeverage ? foodVolumeUnit : foodWeightUnit;
      const rawServingUnit = initialData.servingUnit || (isBeverage ? 'ml' : 'g');
      const rawServingSize = typeof initialData.servingSize === 'number' ? initialData.servingSize : 0;

      let convertedServingSize = rawServingSize;
      if (rawServingUnit !== prefServingUnit && rawServingSize > 0) {
        if (isBeverage) {
          convertedServingSize = convertFoodVolume(
            rawServingSize,
            rawServingUnit as 'ml' | 'fl oz',
            prefServingUnit as 'ml' | 'fl oz',
            2
          );
        } else {
          convertedServingSize = convertFoodWeight(
            rawServingSize,
            rawServingUnit as 'g' | 'oz',
            prefServingUnit as 'g' | 'oz',
            2
          );
        }
      }

      setServingSize(
        prefillBlankBasics
          ? ''
          : convertedServingSize > 0
            ? String(convertedServingSize)
            : ''
      );
      setServingUnit(prefServingUnit);

      // 2. 權威庫導入食材鎖定原基準份量模式以確保調整預設份量時正確等比折算；一般食材以「份量」模式開啟
      setBasisMode(initialData.dataSource ? 'custom' : 'serving');
      setBasisUnit(prefServingUnit);
      setBasisSize(convertedServingSize > 0 ? String(convertedServingSize) : '');

      // 3. 熱量由底層公制 kcal 依當前偏好單位即時換算（kJ 時使用精準 4.184 換算）
      const displayCal =
        energyUnit === 'kJ'
          ? kcalToKj(initialData.calories, 2)
          : Math.round(initialData.calories * 100) / 100;
      setCalories(displayCal >= 0 ? String(displayCal) : '');
      setProtein(typeof initialData.protein === 'number' ? String(initialData.protein) : '');
      setCarbs(typeof initialData.carbs === 'number' ? String(initialData.carbs) : '');
      setFat(typeof initialData.fat === 'number' ? String(initialData.fat) : '');
      setFiber(typeof initialData.fiber === 'number' ? String(initialData.fiber) : '');
      setSugar(typeof initialData.sugar === 'number' ? String(initialData.sugar) : '');
      setSaturatedFat(typeof initialData.saturatedFat === 'number' ? String(initialData.saturatedFat) : '');
      setTransFat(typeof initialData.transFat === 'number' ? String(initialData.transFat) : '');
      setSodium(typeof initialData.sodium === 'number' ? String(initialData.sodium) : '');
      const rawEdible =
        initialData.edibleRate ??
        (typeof initialData.refuseRate === 'number' ? Math.max(0, 1 - initialData.refuseRate) : 1);
      setEdibleRatePct(String(Math.min(100, Math.max(1, Math.round(rawEdible * 100)))));
    } else {
      // 新增模式：完全純淨無初始數值，分類預設為空
      setName('');
      setCategory('');
      setBrand('');
      setServingSize('');
      setServingUnit(foodWeightUnit);
      setBasisMode('serving');
      setBasisSize('');
      setEdibleRatePct('100');
      setBasisUnit(foodWeightUnit);
      setCalorieUnit(energyUnit);
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setFiber('');
      setSugar('');
      setSaturatedFat('');
      setTransFat('');
      setSodium('');
    }
  }, [open, initialData, foodWeightUnit, foodVolumeUnit, energyUnit]);

  // 當分類切換時，自動同步用戶偏好單位
  const handleCategoryChange = (newCat: FoodCategory) => {
    setCategory(newCat);
    const targetUnit = newCat === 'beverage' ? foodVolumeUnit : foodWeightUnit;
    setServingUnit(targetUnit);
    if (basisMode === 'serving') {
      setBasisUnit(targetUnit);
    }
  };

  // 即時純數學折算單份數據
  const parsedServing = Math.max(0, parseFloat(servingSize) || 0);
  const parsedBasis = Math.max(0, parseFloat(basisSize) || 0);
  const parsedCal = Math.max(0, parseFloat(calories) || 0);
  const parsedP = Math.max(0, parseFloat(protein) || 0);
  const parsedC = Math.max(0, parseFloat(carbs) || 0);
  const parsedF = Math.max(0, parseFloat(fat) || 0);
  const parsedFiber = fiber !== '' && !Number.isNaN(Number(fiber)) ? Math.max(0, parseFloat(fiber)) : undefined;
  const parsedSugar = sugar !== '' && !Number.isNaN(Number(sugar)) ? Math.max(0, parseFloat(sugar)) : undefined;
  const parsedSaturatedFat = saturatedFat !== '' && !Number.isNaN(Number(saturatedFat)) ? Math.max(0, parseFloat(saturatedFat)) : undefined;
  const parsedTransFat = transFat !== '' && !Number.isNaN(Number(transFat)) ? Math.max(0, parseFloat(transFat)) : undefined;
  const parsedSodium = sodium !== '' && !Number.isNaN(Number(sodium)) ? Math.max(0, parseFloat(sodium)) : undefined;

  const roundTo2 = (num: number) => Math.round(num * 100) / 100;
  const formatNum2 = (val: number) => (typeof val === 'number' && !Number.isNaN(val) && val >= 0 ? String(roundTo2(val)) : '');
  const formatInt = (val: number) => (typeof val === 'number' && !Number.isNaN(val) && val >= 0 ? String(Math.round(val)) : '');

  const parseOptionalStr = (str: string): number | null => {
    if (str === '' || Number.isNaN(Number(str))) return null;
    return Math.max(0, parseFloat(str));
  };

  // 記錄開啟鍵盤時的初始狀態，供取消時安全回滾 (Revert) 與次級聯動基準計算
  const initialKeypadValueRef = useRef<{ value: string; unit: string } | null>(null);
  const initialParentRef = useRef<{ carbs: string; fat: string } | null>(null);

  // 打開懸浮/吸附精密數字鍵盤
  const openKeypad = (field: KeypadField, targetEl?: HTMLElement | null) => {
    triggerHaptic('selection');
    initialParentRef.current = { carbs, fat };
    switch (field) {
      case 'serving': {
        const prefUnit = category === 'beverage' ? foodVolumeUnit : foodWeightUnit;
        const currentServingUnit = servingUnit || prefUnit;
        initialKeypadValueRef.current = { value: servingSize, unit: currentServingUnit };
        setKeypadConfig({
          field: 'serving',
          title: t('diet.serving'),
          value: parsedServing > 0 ? parsedServing : 0,
          unit: currentServingUnit,
          // 份量無需多單位選擇，嚴格使用用戶偏好設置
          allowDecimals: true,
          maxDecimals: 2,
          anchorEl: targetEl || null,
          valueClassName: 'text-foreground',
        });
        break;
      }
      case 'basis': {
        const isLiquid = category === 'beverage' || basisUnit === 'ml' || basisUnit === 'fl oz';
        const allowedUnits = isLiquid
          ? (foodVolumeUnit === 'fl oz' ? ['fl oz', 'ml'] : ['ml', 'fl oz'])
          : (foodWeightUnit === 'oz' ? ['oz', 'g'] : ['g', 'oz']);

        initialKeypadValueRef.current = { value: basisSize, unit: basisUnit };
        setKeypadConfig({
          field: 'basis',
          title: t('diet.perLabelBasis'),
          value: parsedBasis > 0 ? parsedBasis : 0,
          unit: basisUnit,
          allowedUnits,
          allowDecimals: true,
          maxDecimals: 2,
          anchorEl: targetEl || null,
          valueClassName: 'text-foreground',
        });
        break;
      }
      case 'calories': {
        initialKeypadValueRef.current = { value: calories, unit: calorieUnit };
        setKeypadConfig({
          field: 'calories',
          title: t('diet.calories'),
          value: parsedCal > 0 ? parsedCal : 0,
          unit: calorieUnit,
          allowedUnits: energyUnit === 'kJ' ? ['kJ', 'kcal'] : ['kcal', 'kJ'],
          allowDecimals: true,
          maxDecimals: 2,
          anchorEl: targetEl || null,
          valueClassName: 'text-calories',
        });
        break;
      }
      case 'protein': {
        initialKeypadValueRef.current = { value: protein, unit: 'g' };
        setKeypadConfig({
          field: 'protein',
          title: t('diet.protein'),
          value: parsedP > 0 ? parsedP : 0,
          unit: 'g',
          allowDecimals: true,
          maxDecimals: 2,
          anchorEl: targetEl || null,
          valueClassName: 'text-protein',
        });
        break;
      }
      case 'carbs': {
        initialKeypadValueRef.current = { value: carbs, unit: 'g' };
        setKeypadConfig({
          field: 'carbs',
          title: t('diet.carbs'),
          value: parsedC > 0 ? parsedC : 0,
          unit: 'g',
          allowDecimals: true,
          maxDecimals: 2,
          anchorEl: targetEl || null,
          valueClassName: 'text-carbs',
        });
        break;
      }
      case 'fat': {
        initialKeypadValueRef.current = { value: fat, unit: 'g' };
        setKeypadConfig({
          field: 'fat',
          title: t('diet.fat'),
          value: parsedF > 0 ? parsedF : 0,
          unit: 'g',
          allowDecimals: true,
          maxDecimals: 2,
          anchorEl: targetEl || null,
          valueClassName: 'text-fat',
        });
        break;
      }
      case 'sugar': {
        initialKeypadValueRef.current = { value: sugar, unit: 'g' };
        setKeypadConfig({
          field: 'sugar',
          title: t('diet.sugar'),
          value: parsedSugar !== undefined ? parsedSugar : 0,
          unit: 'g',
          allowDecimals: true,
          maxDecimals: 2,
          anchorEl: targetEl || null,
          valueClassName: 'text-foreground',
        });
        break;
      }
      case 'fiber': {
        initialKeypadValueRef.current = { value: fiber, unit: 'g' };
        setKeypadConfig({
          field: 'fiber',
          title: t('diet.fiber'),
          value: parsedFiber !== undefined ? parsedFiber : 0,
          unit: 'g',
          allowDecimals: true,
          maxDecimals: 2,
          anchorEl: targetEl || null,
          valueClassName: 'text-foreground',
        });
        break;
      }
      case 'saturatedFat': {
        initialKeypadValueRef.current = { value: saturatedFat, unit: 'g' };
        setKeypadConfig({
          field: 'saturatedFat',
          title: t('diet.saturatedFat'),
          value: parsedSaturatedFat !== undefined ? parsedSaturatedFat : 0,
          unit: 'g',
          allowDecimals: true,
          maxDecimals: 2,
          anchorEl: targetEl || null,
          valueClassName: 'text-foreground',
        });
        break;
      }
      case 'transFat': {
        initialKeypadValueRef.current = { value: transFat, unit: 'g' };
        setKeypadConfig({
          field: 'transFat',
          title: t('diet.transFat'),
          value: parsedTransFat !== undefined ? parsedTransFat : 0,
          unit: 'g',
          allowDecimals: true,
          maxDecimals: 2,
          anchorEl: targetEl || null,
          valueClassName: 'text-foreground',
        });
        break;
      }
      case 'sodium': {
        initialKeypadValueRef.current = { value: sodium, unit: 'mg' };
        setKeypadConfig({
          field: 'sodium',
          title: t('diet.sodium'),
          value: parsedSodium !== undefined ? parsedSodium : 0,
          unit: 'mg',
          allowDecimals: false,
          maxDecimals: 0,
          anchorEl: targetEl || null,
          valueClassName: 'text-sodium',
        });
        break;
      }
      case 'edibleRate': {
        const curPct = Math.min(100, Math.max(1, Math.round(Number(edibleRatePct) || 100)));
        initialKeypadValueRef.current = { value: String(curPct), unit: '%' };
        setKeypadConfig({
          field: 'edibleRate',
          title: t('diet.edibleRate'),
          value: curPct,
          unit: '%',
          allowDecimals: false,
          maxDecimals: 0,
          anchorEl: targetEl || null,
          valueClassName: 'text-foreground',
        });
        break;
      }
    }
  };

  // 即時雙向鏡像同步：原位列表行即時隨鍵盤按鍵更新預覽
  const handleKeypadLiveChange = (val: number, nextUnit: string) => {
    if (!keypadConfig) return;
    switch (keypadConfig.field) {
      case 'serving':
        setServingSize(formatNum2(val));
        setServingUnit(nextUnit);
        break;
      case 'basis':
        setBasisSize(formatNum2(val));
        setBasisUnit(nextUnit);
        break;
      case 'calories':
        setCalories(formatNum2(val));
        setCalorieUnit(nextUnit as 'kcal' | 'kJ');
        break;
      case 'protein':
        setProtein(formatNum2(val));
        break;
      case 'carbs':
        setCarbs(formatNum2(val));
        break;
      case 'fat':
        setFat(formatNum2(val));
        break;
      case 'sugar': {
        setSugar(formatNum2(val));
        const baseC = parseOptionalStr(initialParentRef.current?.carbs ?? carbs);
        const nextC = syncParentWithSubNutrients(baseC, val, parsedFiber);
        setCarbs(nextC !== null ? formatNum2(nextC) : '');
        break;
      }
      case 'fiber': {
        setFiber(formatNum2(val));
        const baseC = parseOptionalStr(initialParentRef.current?.carbs ?? carbs);
        const nextC = syncParentWithSubNutrients(baseC, parsedSugar, val);
        setCarbs(nextC !== null ? formatNum2(nextC) : '');
        break;
      }
      case 'saturatedFat': {
        setSaturatedFat(formatNum2(val));
        const baseF = parseOptionalStr(initialParentRef.current?.fat ?? fat);
        const nextF = syncParentWithSubNutrients(baseF, val, parsedTransFat);
        setFat(nextF !== null ? formatNum2(nextF) : '');
        break;
      }
      case 'transFat': {
        setTransFat(formatNum2(val));
        const baseF = parseOptionalStr(initialParentRef.current?.fat ?? fat);
        const nextF = syncParentWithSubNutrients(baseF, parsedSaturatedFat, val);
        setFat(nextF !== null ? formatNum2(nextF) : '');
        break;
      }
      case 'sodium':
        setSodium(formatInt(val));
        break;
      case 'edibleRate':
        setEdibleRatePct(String(Math.min(100, Math.max(1, Math.round(val)))));
        break;
    }
  };

  // 取消/關閉時安全回滾為開啟前的初始值
  const handleKeypadCancel = () => {
    if (!keypadConfig || !initialKeypadValueRef.current) {
      setKeypadConfig(null);
      return;
    }
    const { value: prevVal, unit: prevUnit } = initialKeypadValueRef.current;
    switch (keypadConfig.field) {
      case 'serving':
        setServingSize(prevVal);
        setServingUnit(prevUnit);
        break;
      case 'basis':
        setBasisSize(prevVal);
        setBasisUnit(prevUnit);
        break;
      case 'calories':
        setCalories(prevVal);
        setCalorieUnit(prevUnit as 'kcal' | 'kJ');
        break;
      case 'protein':
        setProtein(prevVal);
        break;
      case 'carbs':
        setCarbs(prevVal);
        break;
      case 'fat':
        setFat(prevVal);
        break;
      case 'sugar':
        setSugar(prevVal);
        if (initialParentRef.current) setCarbs(initialParentRef.current.carbs);
        break;
      case 'fiber':
        setFiber(prevVal);
        if (initialParentRef.current) setCarbs(initialParentRef.current.carbs);
        break;
      case 'saturatedFat':
        setSaturatedFat(prevVal);
        if (initialParentRef.current) setFat(initialParentRef.current.fat);
        break;
      case 'transFat':
        setTransFat(prevVal);
        if (initialParentRef.current) setFat(initialParentRef.current.fat);
        break;
      case 'sodium':
        setSodium(prevVal);
        break;
      case 'edibleRate':
        setEdibleRatePct(prevVal);
        break;
    }
    setKeypadConfig(null);
  };

  const handleKeypadConfirm = (val: number, nextUnit: string) => {
    if (!keypadConfig) return;
    switch (keypadConfig.field) {
      case 'serving':
        setServingSize(formatNum2(val));
        setServingUnit(nextUnit);
        break;
      case 'basis':
        setBasisSize(formatNum2(val));
        setBasisUnit(nextUnit);
        break;
      case 'calories':
        setCalories(formatNum2(val));
        setCalorieUnit(nextUnit as 'kcal' | 'kJ');
        break;
      case 'protein':
        setProtein(formatNum2(val));
        break;
      case 'carbs': {
        const clampedC = clampParentToSubNutrients(val, parsedSugar, parsedFiber);
        setCarbs(clampedC !== null ? formatNum2(clampedC) : formatNum2(val));
        break;
      }
      case 'fat': {
        const clampedF = clampParentToSubNutrients(val, parsedSaturatedFat, parsedTransFat);
        setFat(clampedF !== null ? formatNum2(clampedF) : formatNum2(val));
        break;
      }
      case 'sugar': {
        setSugar(formatNum2(val));
        const baseC = parseOptionalStr(initialParentRef.current?.carbs ?? carbs);
        const nextC = syncParentWithSubNutrients(baseC, val, parsedFiber);
        setCarbs(nextC !== null ? formatNum2(nextC) : '');
        break;
      }
      case 'fiber': {
        setFiber(formatNum2(val));
        const baseC = parseOptionalStr(initialParentRef.current?.carbs ?? carbs);
        const nextC = syncParentWithSubNutrients(baseC, parsedSugar, val);
        setCarbs(nextC !== null ? formatNum2(nextC) : '');
        break;
      }
      case 'saturatedFat': {
        setSaturatedFat(formatNum2(val));
        const baseF = parseOptionalStr(initialParentRef.current?.fat ?? fat);
        const nextF = syncParentWithSubNutrients(baseF, val, parsedTransFat);
        setFat(nextF !== null ? formatNum2(nextF) : '');
        break;
      }
      case 'transFat': {
        setTransFat(formatNum2(val));
        const baseF = parseOptionalStr(initialParentRef.current?.fat ?? fat);
        const nextF = syncParentWithSubNutrients(baseF, parsedSaturatedFat, val);
        setFat(nextF !== null ? formatNum2(nextF) : '');
        break;
      }
      case 'sodium':
        setSodium(formatInt(val));
        break;
      case 'edibleRate':
        setEdibleRatePct(String(Math.min(100, Math.max(1, Math.round(val)))));
        break;
    }
    setKeypadConfig(null);
  };

  // 保存前一律透過純函數統一折算為單份純公制 SI 真值（g / ml、kcal），保存後徹底遺忘輸入單位與基準
  const normalizedMetricFood = useMemo(
    () =>
      normalizeFoodInputToMetric({
        servingSize: parsedServing,
        servingUnit: servingUnit.trim() || (category === 'beverage' ? 'ml' : 'g'),
        basisMode,
        basisSize: parsedBasis > 0 ? parsedBasis : undefined,
        basisUnit: parsedBasis > 0 ? basisUnit : undefined,
        calories: parsedCal,
        energyUnit: calorieUnit,
        carbs: parsedC,
        protein: parsedP,
        fat: parsedF,
        fiber: parsedFiber,
        sugar: parsedSugar,
        saturatedFat: parsedSaturatedFat,
        transFat: parsedTransFat,
        sodium: parsedSodium,
        category: category || undefined,
      }),
    [
      parsedServing,
      servingUnit,
      category,
      basisMode,
      parsedBasis,
      basisUnit,
      parsedCal,
      calorieUnit,
      parsedC,
      parsedP,
      parsedF,
      parsedFiber,
      parsedSugar,
      parsedSaturatedFat,
      parsedTransFat,
      parsedSodium,
    ]
  );

  // 表單送出處理：無論輸入單位為何，底層一律儲存換算後的純公制 SI 數據
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !category || isSubmitting || !servingSize || parseFloat(servingSize) <= 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        category,
        brand: brand.trim() || undefined,
        servingSize: normalizedMetricFood.servingSize,
        servingUnit: normalizedMetricFood.servingUnit,
        calories: normalizedMetricFood.calories,
        protein: normalizedMetricFood.protein,
        carbs: normalizedMetricFood.carbs,
        fat: normalizedMetricFood.fat,
        fiber: normalizedMetricFood.fiber,
        sugar: normalizedMetricFood.sugar,
        saturatedFat: normalizedMetricFood.saturatedFat,
        transFat: normalizedMetricFood.transFat,
        sodium: normalizedMetricFood.sodium,
        ...(!isAuthorityFood
          ? (() => {
              const clampedPct = Math.min(100, Math.max(1, Math.round(Number(edibleRatePct) || 100)));
              const finalEdibleRate = clampedPct / 100;
              const finalRefuseRate = Math.round((1 - finalEdibleRate) * 1000) / 1000;
              return {
                edibleRate: finalEdibleRate,
                refuseRate: finalRefuseRate,
              };
            })()
          : {}),
      });

      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 處理主彈窗開關事件：當次級懸浮鍵盤 (keypadConfig) 處於開啟狀態時，
  // 阻斷因鍵盤內部選單、單位切換或外部焦點轉移觸發的主彈窗非預期關閉
  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (keypadConfig || isAuthorityDetailsOpen)) {
      return;
    }
    onOpenChange(nextOpen);
  };

  // 即時單位變更聯動
  const handleKeypadUnitChange = (nextUnit: string) => {
    if (!keypadConfig) return;
    if (keypadConfig.field === 'serving') {
      setServingUnit(nextUnit);
      if (basisMode === 'serving') {
        setBasisUnit(nextUnit);
      }
    } else if (keypadConfig.field === 'basis') {
      setBasisUnit(nextUnit);
    } else if (keypadConfig.field === 'calories') {
      setCalorieUnit(nextUnit as 'kcal' | 'kJ');
    }
  };

  const formId = useId();
  const [isAiFocused, setIsAiFocused] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsAiFocused(false);
    }
  }, [open]);

  // 接收外部 AI 助手單向注入之營養標籤解析結果
  const handleInjectFoodLabel = (parsed: NutritionLabelParseResult) => {
    if (parsed.name && !name.trim()) {
      setName(parsed.name.trim());
    }
    if (parsed.brand && !brand.trim()) {
      setBrand(parsed.brand.trim());
    }
    if (typeof parsed.servingSize === 'number' && parsed.servingSize > 0) {
      setServingSize(formatNum2(parsed.servingSize));
    }
    if (parsed.servingUnit) {
      setServingUnit(parsed.servingUnit);
    }
    if (typeof parsed.calories === 'number') {
      setCalories(formatNum2(parsed.calories));
    }
    if (typeof parsed.carbs === 'number') {
      setCarbs(formatNum2(parsed.carbs));
    }
    if (typeof parsed.protein === 'number') {
      setProtein(formatNum2(parsed.protein));
    }
    if (typeof parsed.fat === 'number') {
      setFat(formatNum2(parsed.fat));
    }
    if (typeof parsed.sugar === 'number' && parsed.sugar >= 0) {
      setSugar(formatNum2(parsed.sugar));
    }
    if (typeof parsed.fiber === 'number' && parsed.fiber >= 0) {
      setFiber(formatNum2(parsed.fiber));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <PrecisionDialogContent
          title={isEdit ? t('settings.editCustomFood') : t('diet.addFood', '新增')}
          form={formId}
          submitDisabled={!name.trim() || !category || isSubmitting || !servingSize || parseFloat(servingSize) <= 0}
          submitAriaLabel={isEdit ? t('common.save') : t('common.add')}
          cancelAriaLabel={t('common.cancel')}
          overlayClassName={overlayClassName || (zIndex ? `z-[${zIndex}]` : "z-[70]")}
          className={cn(
            'max-h-[85vh]',
            zIndex ? `z-[${zIndex}]` : 'z-[70]',
            className
          )}
          externalFocusActive={isAiFocused}
          onExternalFocusDismiss={() => setIsAiFocused(false)}
          externalTopSlot={
            !isAuthorityFood ? (
              <ExternalAIAssistant
                mode="foodLabel"
                dialogOpen={open && !isSubmitting}
                focused={isAiFocused}
                onFocusedChange={setIsAiFocused}
                onInjectFoodLabel={handleInjectFoodLabel}
                mockMode={aiMockMode}
                mockScenario={aiMockScenario}
                existingBrands={existingBrands}
              />
            ) : undefined
          }
        >

          <form id={formId} onSubmit={handleSubmit}>
            <div className="space-y-3.5 pt-3.5 pb-0 no-scrollbar pr-0.5">
              {/* 權威來源膠囊（置於基本資訊卡片上方，點擊展開權威元素數據） */}
              {isAuthorityFood && initialData?.dataSource && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setIsAuthorityDetailsOpen(true);
                    }}
                    className="h-6 px-2.5 rounded-full border border-border/80 bg-background hover:bg-hover font-mono text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer text-muted-foreground hover:text-foreground active:scale-95 select-none max-w-full"
                    title={t('diet.viewAuthorityDetails')}
                  >
                    <span className="font-sans text-muted-foreground/80 shrink-0">
                      {t('diet.sourceLabel', '來源')}
                    </span>
                    <span className="h-3 w-px bg-border/80 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {initialData.dataSource.authority}
                      {initialData.dataSource.sourceId ? ` · ${initialData.dataSource.sourceId}` : ''}
                    </span>
                    <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                  </button>
                </div>
              )}

              {/* 表格段落 1: 基本資訊 (共用 SectionCard 內嵌表頭) */}
              <SectionCard title={t('diet.basicInfo')} bodyClassName="text-sm font-sans">
            {/* 品牌 ｜ 名稱（權威庫導入食材不顯示品牌輸入框，由名稱獨佔全寬） */}
            {isAuthorityFood ? (
              <div className="h-10 bg-card relative flex items-stretch min-w-0 focus-within:ring-1 focus-within:ring-inset focus-within:ring-foreground focus-within:z-[1] transition-shadow duration-100">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={namePlaceholder}
                  aria-label={namePlaceholder}
                  className="w-full h-full px-3 bg-transparent text-center text-xs font-sans text-foreground font-normal focus:outline-none placeholder:text-muted-foreground/40"
                />
              </div>
            ) : (
              <div className="h-10 grid grid-cols-2 divide-x divide-border bg-card">
                {/* 品牌 (選填，含既有品牌聯想) */}
                <div className="relative flex items-stretch min-w-0 focus-within:ring-1 focus-within:ring-inset focus-within:ring-foreground focus-within:z-[1] transition-shadow duration-100">
                  <input
                    ref={setBrandInputEl}
                    type="text"
                    value={brand}
                    onFocus={() => {
                      setIsBrandFocused(true);
                      setBrandHighlightIdx(-1);
                    }}
                    onBlur={() => setIsBrandFocused(false)}
                    onChange={(e) => {
                      setBrand(e.target.value);
                      setIsBrandFocused(true);
                      setBrandHighlightIdx(-1);
                    }}
                    onKeyDown={(e) => {
                      if (!showBrandSuggestions) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setBrandHighlightIdx((prev) =>
                          prev < brandSuggestions.length - 1 ? prev + 1 : 0
                        );
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setBrandHighlightIdx((prev) =>
                          prev > 0 ? prev - 1 : brandSuggestions.length - 1
                        );
                      } else if (e.key === 'Enter' && brandHighlightIdx >= 0) {
                        e.preventDefault();
                        const chosen = brandSuggestions[brandHighlightIdx];
                        if (chosen) {
                          triggerHaptic('selection');
                          setBrand(chosen);
                          setIsBrandFocused(false);
                          setBrandHighlightIdx(-1);
                        }
                      } else if (e.key === 'Escape') {
                        e.stopPropagation();
                        setIsBrandFocused(false);
                        setBrandHighlightIdx(-1);
                      }
                    }}
                    placeholder={brandPlaceholder}
                    aria-label={brandPlaceholder}
                    className="w-full h-full px-3 bg-transparent text-center text-xs font-sans text-foreground focus:outline-none placeholder:text-muted-foreground/40"
                  />
                </div>

                {/* 食材名稱 (必填) */}
                <div className="relative flex items-stretch min-w-0 focus-within:ring-1 focus-within:ring-inset focus-within:ring-foreground focus-within:z-[1] transition-shadow duration-100">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={namePlaceholder}
                    aria-label={namePlaceholder}
                    className="w-full h-full px-3 bg-transparent text-center text-xs font-sans text-foreground font-normal focus:outline-none placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>
            )}

              {/* 分類 */}
              <div className="h-10 px-4 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">{t('diet.foodCategory.title')}</span>
                <Select
                  value={category || null}
                  onValueChange={(val) => {
                    if (val) {
                      triggerHaptic('selection');
                      handleCategoryChange(val as FoodCategory);
                    }
                  }}
                >
                  <SelectTrigger
                    size="custom"
                    iconClassName="size-3 text-muted-foreground/60"
                    className="h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-sans text-xs flex items-center gap-1.5 transition-colors cursor-pointer text-foreground active:scale-95"
                  >
                    <SelectValue
                      className={cn(
                        category
                          ? 'font-normal text-foreground'
                          : 'font-normal font-mono text-label-tertiary select-none'
                      )}
                    >
                      {category ? t(`diet.foodCategory.${category}`) : '-'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent
                    align="end"
                    positionerClassName={elevatedOverlayZClass}
                    backdropClassName={elevatedOverlayZClass}
                    className={cn('min-w-36', elevatedOverlayZClass)}
                  >
                    <SelectItem value="natural">{t('diet.foodCategory.natural')}</SelectItem>
                    <SelectItem value="processed">{t('diet.foodCategory.processed')}</SelectItem>
                    <SelectItem value="beverage">{t('diet.foodCategory.beverage')}</SelectItem>
                    <SelectItem value="oil">{t('diet.foodCategory.oil')}</SelectItem>
                    <SelectItem value="condiment">{t('diet.foodCategory.condiment')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 食用份量 */}
              <div className="h-10 px-4 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">{t('diet.serving')}</span>
                <button
                  type="button"
                  onClick={(e) => openKeypad('serving', e.currentTarget)}
                  className={cn(
                    "h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 select-none",
                    servingSize ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  <MetricValue
                    value={servingSize ? formatDisplayAmount(servingSize) : '-'}
                    unit={servingUnit}
                    valueClassName={servingSize ? "text-foreground font-normal" : "text-muted-foreground/40 font-normal"}
                    unitClassName="text-muted-foreground"
                  />
                  <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                </button>
              </div>

              {/* 可食率（權威庫導入食材唯讀展示，手動新增／編輯食材可點擊調整） */}
              <div className="h-10 px-4 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">{t('diet.edibleRate')}</span>
                {isAuthorityFood ? (
                  <MetricValue
                    value={edibleRatePct}
                    unit="%"
                    valueClassName="font-normal text-foreground text-xs"
                    unitClassName="text-xs text-muted-foreground"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={(e) => openKeypad('edibleRate', e.currentTarget)}
                    className="h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 select-none text-foreground"
                    title={t('diet.edibleRate')}
                    aria-label={t('diet.edibleRate')}
                  >
                    <MetricValue
                      value={edibleRatePct}
                      unit="%"
                      valueClassName="text-foreground font-normal"
                      unitClassName="text-muted-foreground"
                    />
                    <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                  </button>
                )}
              </div>
          </SectionCard>

          {/* 表格段落 2: 基準營養素 (權威庫導入食材僅供唯讀檢視，不允許編輯營養價值表) */}
          <NutritionFactsCard
            title={t('diet.servingNutrients')}
            data={isAuthorityFood ? normalizedMetricFood : undefined}
            action={
              isAuthorityFood ? null : (
                <div className="h-7 p-0.5 rounded-full border border-border bg-background inline-flex items-center text-xs font-mono select-none shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (basisMode !== 'serving') {
                        triggerHaptic('selection');
                        setBasisMode('serving');
                        setBasisUnit(servingUnit);
                      }
                    }}
                    className={cn(
                      "h-full px-2.5 rounded-full transition-all cursor-pointer text-[11px] flex items-center justify-center whitespace-nowrap",
                      basisMode === 'serving'
                        ? "bg-foreground text-background font-medium shadow-none"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t('diet.byServing')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (basisMode !== 'custom') {
                        triggerHaptic('selection');
                        setBasisMode('custom');
                      }
                    }}
                    className={cn(
                      "h-full px-2.5 rounded-full transition-all cursor-pointer text-[11px] flex items-center justify-center whitespace-nowrap",
                      basisMode === 'custom'
                        ? "bg-foreground text-background font-medium shadow-none"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t('diet.customBasis')}
                  </button>
                </div>
              )
            }
            defaultCarbsExpanded={Boolean(sugar !== '' || fiber !== '')}
            defaultFatExpanded={Boolean(saturatedFat !== '' || transFat !== '')}
            editable={
              isAuthorityFood
                ? undefined
                : {
                    alwaysShowSubChevrons: true,
                    lockSubPopover: Boolean(keypadConfig),
              renderValue: (field) => {
                switch (field) {
                  case 'serving':
                    return basisMode === 'serving' ? (
                      <div className="h-7 px-3 rounded-full border border-border/50 bg-hover font-mono text-xs flex items-center gap-1.5 text-muted-foreground select-none">
                        <MetricValue
                          value={servingSize ? formatDisplayAmount(servingSize) : '-'}
                          unit={servingUnit}
                          valueClassName={servingSize ? "text-foreground/75 font-normal" : "text-muted-foreground/40 font-normal"}
                          unitClassName="text-muted-foreground"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => openKeypad('basis', e.currentTarget)}
                        className={cn(
                          "h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 select-none",
                          basisSize ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        <MetricValue
                          value={basisSize ? formatDisplayAmount(basisSize) : '-'}
                          unit={basisUnit}
                          valueClassName={basisSize ? "text-foreground font-normal" : "text-muted-foreground/40 font-normal"}
                          unitClassName="text-muted-foreground"
                        />
                        <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                      </button>
                    );
                  case 'calories':
                    return (
                      <button
                        type="button"
                        onClick={(e) => openKeypad('calories', e.currentTarget)}
                        className={cn(
                          "h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 select-none",
                          calories !== '' ? "text-calories" : "text-muted-foreground"
                        )}
                      >
                        <MetricValue
                          value={calories !== '' ? formatDisplayAmount(calories) : '-'}
                          unit={calorieUnit}
                          valueClassName={calories !== '' ? "text-calories font-normal" : "text-muted-foreground/40 font-normal"}
                          unitClassName="text-xs text-muted-foreground"
                        />
                        <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                      </button>
                    );
                  case 'carbs':
                    return (
                      <button
                        type="button"
                        onClick={(e) => openKeypad('carbs', e.currentTarget)}
                        className={cn(
                          "h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 select-none",
                          carbs !== '' ? "text-carbs" : "text-muted-foreground"
                        )}
                      >
                        <MetricValue
                          value={carbs !== '' ? formatDisplayAmount(carbs) : '-'}
                          unit="g"
                          valueClassName={carbs !== '' ? "text-carbs font-normal" : "text-muted-foreground/40 font-normal"}
                          unitClassName="text-xs text-muted-foreground"
                        />
                        <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                      </button>
                    );
                  case 'sugar':
                    return (
                      <button
                        type="button"
                        onClick={(e) => openKeypad('sugar', e.currentTarget)}
                        className={cn(
                          "h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 select-none",
                          sugar !== '' ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        <MetricValue
                          value={sugar !== '' ? formatDisplayAmount(sugar) : '-'}
                          unit="g"
                          valueClassName={sugar !== '' ? "text-foreground font-normal" : "text-muted-foreground/40 font-normal"}
                          unitClassName="text-xs text-muted-foreground"
                        />
                        <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                      </button>
                    );
                  case 'fiber':
                    return (
                      <button
                        type="button"
                        onClick={(e) => openKeypad('fiber', e.currentTarget)}
                        className={cn(
                          "h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 select-none",
                          fiber !== '' ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        <MetricValue
                          value={fiber !== '' ? formatDisplayAmount(fiber) : '-'}
                          unit="g"
                          valueClassName={fiber !== '' ? "text-foreground font-normal" : "text-muted-foreground/40 font-normal"}
                          unitClassName="text-xs text-muted-foreground"
                        />
                        <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                      </button>
                    );
                  case 'protein':
                    return (
                      <button
                        type="button"
                        onClick={(e) => openKeypad('protein', e.currentTarget)}
                        className={cn(
                          "h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 select-none",
                          protein !== '' ? "text-protein" : "text-muted-foreground"
                        )}
                      >
                        <MetricValue
                          value={protein !== '' ? formatDisplayAmount(protein) : '-'}
                          unit="g"
                          valueClassName={protein !== '' ? "text-protein font-normal" : "text-muted-foreground/40 font-normal"}
                          unitClassName="text-xs text-muted-foreground"
                        />
                        <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                      </button>
                    );
                  case 'fat':
                    return (
                      <button
                        type="button"
                        onClick={(e) => openKeypad('fat', e.currentTarget)}
                        className={cn(
                          "h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 select-none",
                          fat !== '' ? "text-fat" : "text-muted-foreground"
                        )}
                      >
                        <MetricValue
                          value={fat !== '' ? formatDisplayAmount(fat) : '-'}
                          unit="g"
                          valueClassName={fat !== '' ? "text-fat font-normal" : "text-muted-foreground/40 font-normal"}
                          unitClassName="text-xs text-muted-foreground"
                        />
                        <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                      </button>
                    );
                  case 'saturatedFat':
                    return (
                      <button
                        type="button"
                        onClick={(e) => openKeypad('saturatedFat', e.currentTarget)}
                        className={cn(
                          "h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 select-none",
                          saturatedFat !== '' ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        <MetricValue
                          value={saturatedFat !== '' ? formatDisplayAmount(saturatedFat) : '-'}
                          unit="g"
                          valueClassName={saturatedFat !== '' ? "text-foreground font-normal" : "text-muted-foreground/40 font-normal"}
                          unitClassName="text-xs text-muted-foreground"
                        />
                        <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                      </button>
                    );
                  case 'transFat':
                    return (
                      <button
                        type="button"
                        onClick={(e) => openKeypad('transFat', e.currentTarget)}
                        className={cn(
                          "h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 select-none",
                          transFat !== '' ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        <MetricValue
                          value={transFat !== '' ? formatDisplayAmount(transFat) : '-'}
                          unit="g"
                          valueClassName={transFat !== '' ? "text-foreground font-normal" : "text-muted-foreground/40 font-normal"}
                          unitClassName="text-xs text-muted-foreground"
                        />
                        <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                      </button>
                    );
                  case 'sodium':
                    return (
                      <button
                        type="button"
                        onClick={(e) => openKeypad('sodium', e.currentTarget)}
                        className={cn(
                          "h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 select-none",
                          sodium !== '' ? "text-sodium" : "text-muted-foreground"
                        )}
                      >
                        <MetricValue
                          value={sodium !== '' ? formatDisplayAmount(sodium) : '-'}
                          unit="mg"
                          valueClassName={sodium !== '' ? "text-sodium font-normal" : "text-muted-foreground/40 font-normal"}
                          unitClassName="text-xs text-muted-foreground"
                        />
                        <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                      </button>
                    );
                }
              },
            }
            }
          />
            </div>

          {/* 方案 D 徹底無底欄，表單內容直達底部 */}
        </form>
      </PrecisionDialogContent>
    </Dialog>

    {/* 響應式精密數字鍵盤輸入器：桌面端懸浮 Popover / 手機端底部吸附鍵盤 */}
    {keypadConfig && (
      <NumericKeypadDialog
        open={!!keypadConfig}
        onOpenChange={(isOpen) => {
          if (!isOpen) setKeypadConfig(null);
        }}
        zIndex={zIndex ? zIndex + 10 : 80}
        anchorEl={keypadConfig.anchorEl}
        title={keypadConfig.title}
        value={keypadConfig.value}
        unit={keypadConfig.unit}
        allowedUnits={keypadConfig.allowedUnits}
        allowDecimals={keypadConfig.allowDecimals}
        maxDecimals={keypadConfig.maxDecimals}
        onConfirm={handleKeypadConfirm}
        onCancel={handleKeypadCancel}
        onLiveChange={handleKeypadLiveChange}
        onUnitChange={handleKeypadUnitChange}
        valueClassName={keypadConfig.valueClassName}
        titleClassName={keypadConfig.titleClassName || keypadConfig.valueClassName}
      />
    )}

    {/* 品牌聯想選擇浮層 (平級兄弟節點，避免撐大彈窗高度與干擾輸入焦點) */}
    <Popover
      open={showBrandSuggestions}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setIsBrandFocused(false);
          setBrandHighlightIdx(-1);
        }
      }}
    >
      {brandInputEl && showBrandSuggestions && (
        <PopoverContent
          anchor={brandInputEl}
          side="bottom"
          align="end"
          sideOffset={6}
          initialFocus={false}
          finalFocus={false}
          positionerClassName={elevatedOverlayZClass ?? 'z-[95]'}
          className="w-44 p-1 gap-0.5 max-h-44 overflow-y-auto no-scrollbar rounded-lg border border-border bg-popover text-popover-foreground shadow-none"
        >
          {brandSuggestions.map((b, idx) => (
            <button
              key={b}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                triggerHaptic('selection');
                setBrand(b);
                setIsBrandFocused(false);
                setBrandHighlightIdx(-1);
              }}
              className={cn(
                'w-full px-2.5 py-1.5 rounded text-left text-xs font-sans truncate transition-colors cursor-pointer',
                idx === brandHighlightIdx
                  ? 'bg-hover text-foreground font-medium'
                  : 'text-foreground/90 hover:bg-hover'
              )}
            >
              {b}
            </button>
          ))}
        </PopoverContent>
      )}
    </Popover>
    {/* 權威數據詳情彈窗 (平級兄弟節點，點擊基本資訊來源膠囊展開) */}
    {isAuthorityFood && initialData && isAuthorityDetailsOpen && (
      <AuthorityFoodDetailsDialog
        food={initialData}
        open={isAuthorityDetailsOpen}
        onOpenChange={setIsAuthorityDetailsOpen}
        overlayClassName={elevatedOverlayZClass ?? 'z-[95]'}
        className={elevatedOverlayZClass ?? 'z-[95]'}
      />
    )}
    </>
  );
}
