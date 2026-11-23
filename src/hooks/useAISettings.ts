import { useState, useEffect, useCallback } from 'react';
import type { AISettings, AIProvider, AIProtocol, AIProviderProfile } from '@/types/ai';

const AI_STORAGE_KEY_PREFIX = 'e2cal_ai_';
const PROFILES_STORAGE_KEY = `${AI_STORAGE_KEY_PREFIX}profiles`;
const ACTIVE_PROFILE_STORAGE_KEY = `${AI_STORAGE_KEY_PREFIX}activeProfileId`;

export const OFFICIAL_ENDPOINTS: Record<AIProtocol, string> = {
  gemini: 'https://generativelanguage.googleapis.com',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
};

export const DEFAULT_MODEL_BY_PROTOCOL: Record<AIProtocol, string> = {
  gemini: 'gemini-3.8-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-5-5',
};

export const OFFICIAL_PROVIDER_PRESETS: Record<
  Exclude<AIProvider, 'custom'>,
  { protocol: AIProtocol; baseUrl: string; defaultModel: string }
> = {
  gemini: {
    protocol: 'gemini',
    baseUrl: OFFICIAL_ENDPOINTS.gemini,
    defaultModel: DEFAULT_MODEL_BY_PROTOCOL.gemini,
  },
  openai: {
    protocol: 'openai',
    baseUrl: OFFICIAL_ENDPOINTS.openai,
    defaultModel: DEFAULT_MODEL_BY_PROTOCOL.openai,
  },
  anthropic: {
    protocol: 'anthropic',
    baseUrl: OFFICIAL_ENDPOINTS.anthropic,
    defaultModel: DEFAULT_MODEL_BY_PROTOCOL.anthropic,
  },
  deepseek: {
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
  },
};

/** 預設供應商種子（標準固定 UUID，預設選中 Gemini 2） */
export const DEFAULT_PROFILE_IDS = {
  gemini: '11111111-1111-4111-8111-111111111101',
  gemini2: '11111111-1111-4111-8111-111111111102',
  gemini3: '11111111-1111-4111-8111-111111111103',
  chatgpt: '11111111-1111-4111-8111-111111111104',
  anthropicLegacy: '11111111-1111-4111-8111-111111111105',
  customLegacy: '11111111-1111-4111-8111-111111111106',
} as const;

const LEGACY_SEED_PROFILE_IDS = new Set<string>([
  DEFAULT_PROFILE_IDS.gemini,
  DEFAULT_PROFILE_IDS.gemini2,
  DEFAULT_PROFILE_IDS.gemini3,
  DEFAULT_PROFILE_IDS.chatgpt,
]);

export function createDefaultProfiles(): AIProviderProfile[] {
  return [];
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'gemini',
  profiles: [],
  activeProfileId: '',
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
const DEPRECATED_GEMINI_MODELS = new Set(['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']);
const VALID_PROVIDERS = new Set<AIProvider>(['gemini', 'openai', 'anthropic', 'deepseek', 'custom']);
const VALID_PROTOCOLS = new Set<AIProtocol>(['gemini', 'openai', 'anthropic']);

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isValidProfile(item: unknown): item is AIProviderProfile {
  if (!item || typeof item !== 'object') return false;
  const p = item as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    p.id.length > 0 &&
    typeof p.name === 'string' &&
    typeof p.protocol === 'string' &&
    VALID_PROTOCOLS.has(p.protocol as AIProtocol)
  );
}

function loadLegacyFlatSettings(): Omit<AISettings, 'profiles' | 'activeProfileId'> {
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
    localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}anthropicApiKey`) ??
    DEFAULT_AI_SETTINGS.anthropicApiKey;
  const anthropicModel =
    localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}anthropicModel`) ||
    DEFAULT_AI_SETTINGS.anthropicModel;

  const rawProtocol = localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}customProtocol`) as AIProtocol | null;
  let customProtocol: AIProtocol =
    rawProtocol && VALID_PROTOCOLS.has(rawProtocol) ? rawProtocol : DEFAULT_AI_SETTINGS.customProtocol;

  let customBaseUrl =
    localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}customBaseUrl`) ?? DEFAULT_AI_SETTINGS.customBaseUrl;
  let customApiKey =
    localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}customApiKey`) ?? DEFAULT_AI_SETTINGS.customApiKey;
  let customModel =
    localStorage.getItem(`${AI_STORAGE_KEY_PREFIX}customModel`) ?? DEFAULT_AI_SETTINGS.customModel;

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
}

function loadStoredSettings(): AISettings {
  if (typeof window === 'undefined') return DEFAULT_AI_SETTINGS;
  try {
    const legacy = loadLegacyFlatSettings();
    const rawProfiles = localStorage.getItem(PROFILES_STORAGE_KEY);
    const rawActiveId = localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);

    let profiles: AIProviderProfile[] | null = null;
    if (rawProfiles) {
      const parsed: unknown = JSON.parse(rawProfiles);
      if (Array.isArray(parsed)) {
        const seenIds = new Set<string>();
        const valid: AIProviderProfile[] = [];
        for (const item of parsed) {
          if (!isValidProfile(item) || seenIds.has(item.id)) continue;
          seenIds.add(item.id);
          const baseUrl = typeof item.baseUrl === 'string' ? item.baseUrl : '';
          const rawProv = (item as { provider?: unknown }).provider;
          const provider: AIProvider =
            typeof rawProv === 'string' && VALID_PROVIDERS.has(rawProv as AIProvider)
              ? (rawProv as AIProvider)
              : baseUrl.trim()
                ? 'custom'
                : item.protocol;
          const apiKey = typeof item.apiKey === 'string' ? item.apiKey : '';
          // 清理先前自動生成的空白預設種子，僅保留已配置密鑰或使用者自建的供應商
          if (LEGACY_SEED_PROFILE_IDS.has(item.id) && !apiKey.trim()) {
            continue;
          }
          valid.push({
            id: item.id,
            name: item.name,
            provider,
            protocol: item.protocol,
            baseUrl,
            apiKey,
            model:
              typeof item.model === 'string' ? item.model : DEFAULT_MODEL_BY_PROTOCOL[item.protocol],
          });
        }
        profiles = valid;
      }
    }

    let activeProfileId = rawActiveId ?? '';

    if (!profiles) {
      profiles = [];
      // 首次遷移：僅保留舊版已填入的 API Key
      if (legacy.geminiApiKey.trim()) {
        profiles.push({
          id: DEFAULT_PROFILE_IDS.gemini,
          name: 'Gemini',
          provider: 'gemini',
          protocol: 'gemini',
          baseUrl: '',
          apiKey: legacy.geminiApiKey,
          model: legacy.geminiModel,
        });
        if (legacy.provider === 'gemini') activeProfileId = DEFAULT_PROFILE_IDS.gemini;
      }
      if (legacy.openaiApiKey.trim()) {
        profiles.push({
          id: DEFAULT_PROFILE_IDS.chatgpt,
          name: 'Chatgpt',
          provider: 'openai',
          protocol: 'openai',
          baseUrl: '',
          apiKey: legacy.openaiApiKey,
          model: legacy.openaiModel,
        });
        if (legacy.provider === 'openai') activeProfileId = DEFAULT_PROFILE_IDS.chatgpt;
      }
      if (legacy.anthropicApiKey.trim()) {
        profiles.push({
          id: DEFAULT_PROFILE_IDS.anthropicLegacy,
          name: 'Anthropic',
          provider: 'anthropic',
          protocol: 'anthropic',
          baseUrl: '',
          apiKey: legacy.anthropicApiKey,
          model: legacy.anthropicModel,
        });
        if (legacy.provider === 'anthropic') activeProfileId = DEFAULT_PROFILE_IDS.anthropicLegacy;
      }
      if (legacy.customApiKey.trim() || legacy.customBaseUrl.trim()) {
        profiles.push({
          id: DEFAULT_PROFILE_IDS.customLegacy,
          name: 'Custom',
          provider: 'custom',
          protocol: legacy.customProtocol,
          baseUrl: legacy.customBaseUrl,
          apiKey: legacy.customApiKey,
          model: legacy.customModel || DEFAULT_MODEL_BY_PROTOCOL[legacy.customProtocol],
        });
        if (legacy.provider === 'custom') activeProfileId = DEFAULT_PROFILE_IDS.customLegacy;
      }
    }

    if (profiles.length === 0) {
      activeProfileId = '';
    } else if (!profiles.some((p) => p.id === activeProfileId)) {
      activeProfileId = profiles[0].id;
    }

    return {
      ...legacy,
      profiles,
      activeProfileId,
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

function saveStoredSettings(next: Partial<AISettings>): void {
  if (typeof window === 'undefined') return;
  try {
    if (next.profiles !== undefined) {
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(next.profiles));
    }
    if (next.activeProfileId !== undefined) {
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, next.activeProfileId);
    }

    const legacyKeys: Array<keyof Omit<AISettings, 'profiles' | 'activeProfileId'>> = [
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
    for (const key of legacyKeys) {
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
  if (settings.profiles) {
    if (settings.profiles.length === 0) {
      return {
        protocol: 'gemini',
        baseUrl: OFFICIAL_ENDPOINTS.gemini,
        apiKey: '',
        model: DEFAULT_MODEL_BY_PROTOCOL.gemini,
      };
    }
    const active =
      settings.profiles.find((p) => p.id === settings.activeProfileId) || settings.profiles[0];
    const preset =
      active.provider && active.provider !== 'custom'
        ? OFFICIAL_PROVIDER_PRESETS[active.provider]
        : null;
    const protocol = preset ? preset.protocol : active.protocol;
    return {
      protocol,
      baseUrl: preset
        ? preset.baseUrl
        : active.baseUrl.trim() || OFFICIAL_ENDPOINTS[protocol],
      apiKey: active.apiKey.trim(),
      model: active.model.trim() || preset?.defaultModel || DEFAULT_MODEL_BY_PROTOCOL[protocol],
    };
  }

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
    case 'deepseek':
      return {
        protocol: 'openai',
        baseUrl: OFFICIAL_PROVIDER_PRESETS.deepseek.baseUrl,
        apiKey: settings.openaiApiKey.trim(),
        model: OFFICIAL_PROVIDER_PRESETS.deepseek.defaultModel,
      };
    case 'custom': {
      const protocol = settings.customProtocol || 'openai';
      return {
        protocol,
        baseUrl: settings.customBaseUrl.trim() || OFFICIAL_ENDPOINTS[protocol],
        apiKey: settings.customApiKey.trim(),
        model: settings.customModel.trim() || DEFAULT_MODEL_BY_PROTOCOL[protocol],
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

  const profiles = settings.profiles ?? createDefaultProfiles();

  const activeProfile: AIProviderProfile | null =
    profiles.find((p) => p.id === settings.activeProfileId) || profiles[0] || null;

  const updateSettings = useCallback((updates: Partial<AISettings>) => {
    saveStoredSettings(updates);
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const setActiveProfile = useCallback((id: string) => {
    saveStoredSettings({ activeProfileId: id });
    setSettings((prev) => ({ ...prev, activeProfileId: id }));
  }, []);

  const addProfile = useCallback(
    (input: Omit<AIProviderProfile, 'id'>, makeDefault = true): AIProviderProfile => {
      const newProfile: AIProviderProfile = {
        ...input,
        id: generateUuid(),
      };
      const latest = loadStoredSettings();
      const current = latest.profiles ?? createDefaultProfiles();
      const nextProfiles = [...current, newProfile];
      const nextActiveId = makeDefault
        ? newProfile.id
        : latest.activeProfileId || nextProfiles[0].id;
      saveStoredSettings({ profiles: nextProfiles, activeProfileId: nextActiveId });
      setSettings((prev) => ({
        ...prev,
        profiles: nextProfiles,
        activeProfileId: nextActiveId,
      }));
      return newProfile;
    },
    []
  );

  const updateProfile = useCallback(
    (id: string, updates: Partial<Omit<AIProviderProfile, 'id'>>) => {
      const latest = loadStoredSettings();
      const current = latest.profiles ?? createDefaultProfiles();
      const nextProfiles = current.map((p) => (p.id === id ? { ...p, ...updates } : p));
      saveStoredSettings({ profiles: nextProfiles });
      setSettings((prev) => ({ ...prev, profiles: nextProfiles }));
    },
    []
  );

  const deleteProfile = useCallback((id: string) => {
    const latest = loadStoredSettings();
    const current = latest.profiles ?? createDefaultProfiles();
    const nextProfiles = current.filter((p) => p.id !== id);
    const nextActiveId =
      latest.activeProfileId === id
        ? (nextProfiles[0]?.id ?? '')
        : (latest.activeProfileId ?? '');
    saveStoredSettings({ profiles: nextProfiles, activeProfileId: nextActiveId });
    setSettings((prev) => ({
      ...prev,
      profiles: nextProfiles,
      activeProfileId: nextActiveId,
    }));
  }, []);

  const active = resolveActiveEndpoint(settings);
  const isConfigured = Boolean(active.apiKey);

  return {
    settings,
    profiles,
    activeProfile,
    updateSettings,
    setActiveProfile,
    addProfile,
    updateProfile,
    deleteProfile,
    isConfigured,
  };
}
