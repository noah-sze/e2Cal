/**
 * AI 服務架構型別定義 (BYO-AI / Local-First)
 */

/** 支援之底層 API 協議 */
export type AIProtocol = 'gemini' | 'openai' | 'anthropic';

/** 使用者選擇之服務提供商（三大官方直連 + 泛用自訂端點） */
export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'custom';

/** 使用者預先設定並保存的 AI 供應商設定檔 */
export interface AIProviderProfile {
  id: string;
  name: string;
  provider?: AIProvider;
  protocol: AIProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AISettings {
  provider: AIProvider;
  /** 當前保存的多組供應商設定檔 */
  profiles?: AIProviderProfile[];
  /** 當前選定作為預設 AI 助手的供應商設定檔 ID */
  activeProfileId?: string;
  // 官方直連設定（向下相容保留）
  geminiApiKey: string;
  geminiModel: string;
  openaiApiKey: string;
  openaiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  // 自訂端點設定 (支援 Google / OpenAI / Anthropic 三大協議)
  customProtocol: AIProtocol;
  customBaseUrl: string;
  customApiKey: string;
  customModel: string;
}

/** 營養標籤 OCR 結構化輸出 */
export interface NutritionLabelParseResult {
  name?: string;
  brand?: string;
  servingSize?: number;
  servingUnit?: 'g' | 'ml' | 'oz' | 'fl oz';
  calories?: number;
  carbs?: number;
  protein?: number;
  fat?: number;
  sugar?: number;
  fiber?: number;
  /** 備註說明（例如識別到的語言、是否有 kJ 換算） */
  notes?: string;
}

/** 外食盤餐組件拆解項 */
export interface MealComponentEstimate {
  name: string;
  estimatedWeightGrams?: number;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  sugar?: number;
  fiber?: number;
  notes?: string;
}

/** 外食快速估算結構化輸出 */
export interface MealEstimateResult {
  title: string;
  summary: string;
  totalCalories: number;
  totalCarbs: number;
  totalProtein: number;
  totalFat: number;
  totalSugar?: number;
  totalFiber?: number;
  components: MealComponentEstimate[];
}
