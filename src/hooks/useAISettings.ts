import { useState, useEffect, useCallback } from 'react';
import type { AISettings, AIProvider, AIProtocol } from '@/types/ai';

const AI_STORAGE_KEY_PREFIX = 'e2cal_ai_';

export const OFFICIAL_ENDPOINTS: Record<AIProtocol, string> = {
  gemini: 'https://generativelanguage.googleapis.com',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
};

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'gemini',
  geminiApiKey: '',
  geminiModel: 'gemini-3.8-flash',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  anthropicApiKey: '',
  anthropicModel: 'claude-haiku-5-5',
  customProtocol: 'openai',
  customBaseUrl: '',
  customApiKey: '',
  customModel: '',
};

const AI_SETTINGS_EVENT = 'e2cal_ai_settings_change';

/** 已下線之舊版預設模型，自動遷移至最新可用型號 */
const DEPRECATED_GEMINI_MODELS = new Set(['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']);

const VALID_PROVIDERS = new Set<AIProvider>(['gemini', 'openai', 'anthropic', 'custom']);
const VALID_PROTOCOLS = new Set<AIProtocol>(['gemini', 'openai', 'anthropic']);

function loadStoredSettings(): AISettings {
  if (typeof window === 'undefined') return DEFAULT_AI_SETTINGS;
  try {
    const rawProvider = localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}provider`) as AIProvider | null;
    let provider: AIProvider =
      rawProvider && VALID_PROVIDERS.has(rawProvider) ? rawProvider : DEFAULT_AI_SETTINGS.provider;

    const geminiApiKey =
      localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}geminiApiKey`) ?? DEFAULT_AI_SETTINGS.geminiApiKey;
    const rawGeminiModel =
      localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}geminiModel`) || DEFAULT_AI_SETTINGS.geminiModel;
    const geminiModel = DEPRECATED_GEMINI_MODELS.has(rawGeminiModel)
      ? DEFAULT_AI_SETTINGS.geminiModel
      : rawGeminiModel;

    const openaiApiKey =
      localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}openaiApiKey`) ?? DEFAULT_AI_SETTINGS.openaiApiKey;
    const openaiModel =
      localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}openaiModel`) || DEFAULT_AI_SETTINGS.openaiModel;

    const anthropicApiKey =
      localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}anthropicApiKey`) ?? DEFAULT_AI_SETTINGS.anthropicApiKey;
    const anthropicModel =
      localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}anthropicModel`) || DEFAULT_AI_SETTINGS.anthropicModel;

    const rawProtocol = localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}customProtocol`) as AIProtocol | null;
    let customProtocol: AIProtocol =
      rawProtocol && VALID_PROTOCOLS.has(rawProtocol) ? rawProtocol : DEFAULT_AI_SETTINGS.customProtocol;

    let customBaseUrl =
      localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}customBaseUrl`) ?? DEFAULT_AI_SETTINGS.customBaseUrl;
    let customApiKey =
      localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}customApiKey`) ?? DEFAULT_AI_SETTINGS.customApiKey;
    let customModel =
      localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}customModel`) ?? DEFAULT_AI_SETTINGS.customModel;

    // 向下相容遷移：若舊版設定曾在 openai 模式填寫過非官方 Base URL，平滑遷移至 custom 模式
    const legacyOpenAiUrl = localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}openaiBaseUrl`);
    if (
      legacyOpenAiUrl &&
      legacyOpenAiUrl.trim() &&
      legacyOpenAiUrl.trim().replace(/\/+$/, '') !== OFFICIAL_ENDPOINTS.openai &&
      !customBaseUrl
    ) {
      customProtocol = 'openai';
      customBaseUrl = legacyOpenAiUrl.trim();
      if (!customApiKey && openaiApiKey) customApiKey = openaiApiKey;
      if (!customModel && openaiModel) customModel = openaiModel;
      if (provider === 'openai') provider = 'custom';
    }

    return {
      provider,
      geminiApiKey,
      geminiModel,
      openaiApiKey,
      openaiModel,
      anthropicApiKey,
      anthropicModel,
      customProtocol,
      customBaseUrl,
      customApiKey,
      customModel,
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

function saveStoredSettings(next: Partial<AISettings>): void {
  if (typeof window === 'undefined') return;
  try {
    const keys: Array<keyof AISettings> = [
      'provider',
      'geminiApiKey',
      'geminiModel',
      'openaiApiKey',
      'openaiModel',
      'anthropicApiKey',
      'anthropicModel',
      'customProtocol',
      'customBaseUrl',
      'customApiKey',
      'customModel',
    ];
    for (const key of keys) {
      const val = next[key];
      if (val !== undefined) {
        localStorage.setItem(`${AI_STORAGE_KEY_PREFIX}${key}`, String(val));
      }
    }
    window.dispatchEvent(new Event(AI_SETTINGS_EVENT));
  } catch (err) {
    console.error('Failed to save AI settings to localStorage', err);
  }
}

/** 統一解析當前生效之協議、端點、密鑰與模型 */
export function resolveActiveEndpoint(settings: AISettings): {
  protocol: AIProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
} {
  switch (settings.provider) {
    case 'gemini':
      return {
        protocol: 'gemini',
        baseUrl: OFFICIAL_ENDPOINTS.gemini,
        apiKey: settings.geminiApiKey.trim(),
        model: settings.geminiModel.trim() || DEFAULT_AI_SETTINGS.geminiModel,
      };
    case 'openai':
      return {
        protocol: 'openai',
        baseUrl: OFFICIAL_ENDPOINTS.openai,
        apiKey: settings.openaiApiKey.trim(),
        model: settings.openaiModel.trim() || DEFAULT_AI_SETTINGS.openaiModel,
      };
    case 'anthropic':
      return {
        protocol: 'anthropic',
        baseUrl: OFFICIAL_ENDPOINTS.anthropic,
        apiKey: settings.anthropicApiKey.trim(),
        model: settings.anthropicModel.trim() || DEFAULT_AI_SETTINGS.anthropicModel,
      };
    case 'custom': {
      const protocol = settings.customProtocol || 'openai';
      return {
        protocol,
        baseUrl: settings.customBaseUrl.trim() || OFFICIAL_ENDPOINTS[protocol],
        apiKey: settings.customApiKey.trim(),
        model: settings.customModel.trim() || DEFAULT_AI_SETTINGS[
          protocol === 'gemini' ? 'geminiModel' : protocol === 'anthropic' ? 'anthropicModel' : 'openaiModel'
        ],
      };
    }
  }
}

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>(loadStoredSettings);

  useEffect(() => {
    const handleStorage = () => {
      setSettings(loadStoredSettings());
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(AI_SETTINGS_EVENT, handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(AI_SETTINGS_EVENT, handleStorage);
    };
  }, []);

  const updateSettings = useCallback((updates: Partial<AISettings>) => {
    saveStoredSettings(updates);
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const active = resolveActiveEndpoint(settings);
  const isConfigured =
    settings.provider === 'custom'
      ? Boolean(active.apiKey && settings.customBaseUrl.trim())
      : Boolean(active.apiKey);

  return {
    settings,
    updateSettings,
    isConfigured,
  };
}
