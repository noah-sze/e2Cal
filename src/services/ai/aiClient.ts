import type { TFunction } from 'i18next';
import i18n from '@/i18n/config';
import type {
  AISettings,
  NutritionLabelParseResult,
  MealEstimateResult,
} from '@/types/ai';
import { resolveActiveEndpoint } from '@/hooks/useAISettings';
import { reportNetworkError, reportNetworkSuccess } from '@/hooks/useNetworkStatus';
import {
  getNutritionLabelSystemPrompt,
  getMealEstimateSystemPrompt,
} from './prompts';
import { resolveSupportedLocale } from '@/utils/defaultLocalization';

/** 解析並翻譯常見 AI API 錯誤訊息，讓使用者能一眼看懂問題根源（支援多語系 i18n） */
export function formatAiErrorMessage(
  rawMessage: string,
  status?: number,
  t?: TFunction,
  lang?: string
): string {
  const translate = (key: string, fallback: string) => {
    if (t) {
      return t(key, fallback);
    }
    return i18n.t(key, { defaultValue: fallback, lng: lang || i18n.language });
  };
  const lower = rawMessage.toLowerCase();

  if (lower.includes('missing_endpoint')) {
    return translate('settings.aiErrorMissingEndpoint', '未填寫端點網址');
  }

  if (
    status === 503 ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('temporarily unavailable')
  ) {
    return translate('settings.aiErrorOverloaded', '模型目前擁堵');
  }

  if (
    status === 429 ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('resource has been exhausted') ||
    lower.includes('too many requests')
  ) {
    return translate('settings.aiErrorRateLimit', '已達 API 配額或頻率上限');
  }

  if (
    status === 401 ||
    status === 403 ||
    lower.includes('api key not valid') ||
    lower.includes('api_key_invalid') ||
    lower.includes('invalid api key') ||
    lower.includes('incorrect api key') ||
    lower.includes('invalid x-api-key') ||
    lower.includes('authentication_error') ||
    lower.includes('missing_api_key')
  ) {
    return translate('settings.aiErrorInvalidApiKey', 'API Key 無效或無權限');
  }

  if (status === 404 || lower.includes('is not found') || lower.includes('model not found')) {
    return translate('settings.aiErrorNotFound', '找不到模型或端點');
  }

  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return translate('settings.aiErrorNetwork', '網路連線失敗');
  }

  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('連線超時')) {
    return translate('settings.aiErrorTimeout', '連線超時');
  }

  if (lower.includes('empty_ai_response') || lower.includes('empty response')) {
    return translate('settings.aiErrorEmptyResponse', 'AI 回應為空');
  }

  if (lower.includes('parse_nutrition_failed') || lower.includes('營養標籤 json')) {
    return translate('settings.aiErrorParseNutritionFailed', 'AI 回傳格式無法解析為營養標籤 JSON');
  }

  if (lower.includes('parse_meal_failed') || lower.includes('餐點估算 json')) {
    return translate('settings.aiErrorParseMealFailed', 'AI 回傳格式無法解析為餐點估算 JSON');
  }

  return rawMessage;
}

/** 清理 AI 回傳之 JSON 字串（去除 Markdown 程式碼區塊包裹或前後贅字） */
export function cleanJsonResponse(rawText: string): string {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

function buildGeminiUrl(baseUrl: string, path: string, apiKey: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  const prefix = trimmed.endsWith('/v1beta') || trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1beta`;
  if (!apiKey) {
    return `${prefix}${path}`;
  }
  const sep = path.includes('?') ? '&' : '?';
  return `${prefix}${path}${sep}key=${encodeURIComponent(apiKey)}`;
}

async function parseErrorResponse(res: Response, label: string): Promise<string> {
  const errorBody = await res.text();
  let errorMsg = `${label} Error (${res.status})`;
  try {
    const parsed = JSON.parse(errorBody);
    if (parsed.error?.message) {
      errorMsg = parsed.error.message;
    }
  } catch {
    // ignore json parse error
  }
  return formatAiErrorMessage(errorMsg, res.status);
}

/** 呼叫 Google Gemini 協議 */
async function callGeminiProtocol({
  baseUrl,
  apiKey,
  model,
  prompt,
  systemInstruction,
  imageBase64,
  mimeType = 'image/jpeg',
  signal,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  systemInstruction?: string;
  imageBase64?: string;
  mimeType?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const url = buildGeminiUrl(baseUrl, `/models/${model}:generateContent`, apiKey);

  const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];
  if (imageBase64) {
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: imageBase64,
      },
    });
  }
  parts.push({ text: prompt });

  const payload: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.2,
    },
  };

  if (systemInstruction) {
    payload.system_instruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, 'Gemini API'));
  }

  const data = await res.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) {
    throw new Error('EMPTY_AI_RESPONSE');
  }
  return responseText;
}

/** 呼叫 OpenAI 相容協議 */
async function callOpenAiProtocol({
  baseUrl,
  apiKey,
  model,
  prompt,
  systemInstruction,
  imageBase64,
  mimeType = 'image/jpeg',
  signal,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  systemInstruction?: string;
  imageBase64?: string;
  mimeType?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBase}/chat/completions`;

  const messages: Array<{ role: string; content: unknown }> = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  if (imageBase64) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${imageBase64}` },
        },
        { type: 'text', text: prompt },
      ],
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  let res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
    signal,
  });

  if (!res.ok && res.status === 404 && !cleanBase.endsWith('/v1')) {
    const fallbackUrl = `${cleanBase}/v1/chat/completions`;
    const fallbackRes = await fetch(fallbackUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      signal,
    }).catch(() => null);
    if (fallbackRes && fallbackRes.ok) {
      res = fallbackRes;
    }
  }

  if (!res.ok && res.status === 400) {
    const fallbackRes = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
      }),
      signal,
    }).catch(() => null);
    if (fallbackRes && fallbackRes.ok) {
      res = fallbackRes;
    }
  }

  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, 'OpenAI API'));
  }

  const data = await res.json();
  const responseText = data.choices?.[0]?.message?.content;
  if (!responseText) {
    throw new Error('EMPTY_AI_RESPONSE');
  }
  return responseText;
}

/** 呼叫 Anthropic Messages 協議（含純瀏覽器直連 CORS 標頭） */
async function callAnthropicProtocol({
  baseUrl,
  apiKey,
  model,
  prompt,
  systemInstruction,
  imageBase64,
  mimeType = 'image/jpeg',
  signal,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  systemInstruction?: string;
  imageBase64?: string;
  mimeType?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const url = `${baseUrl.replace(/\/+$/, '')}/messages`;

  const content: Array<Record<string, unknown>> = [];
  if (imageBase64) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mimeType,
        data: imageBase64,
      },
    });
  }
  content.push({ type: 'text', text: prompt });

  const payload: Record<string, unknown> = {
    model,
    max_tokens: 2048,
    temperature: 0.2,
    messages: [{ role: 'user', content }],
  };

  if (systemInstruction) {
    payload.system = systemInstruction;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, 'Anthropic API'));
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const textBlock = data.content?.find((c) => c.type === 'text');
  if (!textBlock?.text) {
    throw new Error('EMPTY_AI_RESPONSE');
  }
  return textBlock.text;
}

/** 統一調用 AI 閘道 */
async function callAiGateway(params: {
  prompt: string;
  systemInstruction?: string;
  imageBase64?: string;
  mimeType?: string;
  settings: AISettings;
  signal?: AbortSignal;
}): Promise<string> {
  const { protocol, baseUrl, apiKey, model, isCustom } = resolveActiveEndpoint(params.settings);
  if (!isCustom && !apiKey) {
    throw new Error(formatAiErrorMessage('MISSING_API_KEY'));
  }
  if (isCustom && !baseUrl) {
    throw new Error(formatAiErrorMessage('MISSING_ENDPOINT'));
  }

  const callArgs = {
    baseUrl,
    apiKey,
    model,
    prompt: params.prompt,
    systemInstruction: params.systemInstruction,
    imageBase64: params.imageBase64,
    mimeType: params.mimeType,
    signal: params.signal,
  };

  try {
    let result: string;
    switch (protocol) {
      case 'gemini':
        result = await callGeminiProtocol(callArgs);
        break;
      case 'anthropic':
        result = await callAnthropicProtocol(callArgs);
        break;
      case 'openai':
        result = await callOpenAiProtocol(callArgs);
        break;
    }
    reportNetworkSuccess();
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network request failed') ||
      msg.includes('load failed') ||
      msg.includes('err_internet_disconnected')
    ) {
      reportNetworkError();
    }
    throw err;
  }
}

const DEFAULT_TEST_TIMEOUT_MS = 15_000;

/** 測試 AI 設定連通性（預設 15 秒超時自動中止） */
export async function testAIConnection(
  settings: AISettings,
  timeoutMs: number = DEFAULT_TEST_TIMEOUT_MS,
  lang?: string
): Promise<{ success: boolean; message: string }> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const locale = resolveSupportedLocale(lang || i18n.language);
  const prompt =
    locale === 'en'
      ? 'Please reply with raw JSON: {"status":"ok","message":"connection successful"}'
      : locale === 'zh-CN'
        ? '请回复纯 JSON：{"status":"ok","message":"connection successful"}'
        : '請回覆純 JSON：{"status":"ok","message":"connection successful"}';

  try {
    const raw = await callAiGateway({
      prompt,
      settings,
      signal: controller.signal,
    });
    try {
      const parsed = JSON.parse(cleanJsonResponse(raw));
      if (parsed.status === 'ok' || parsed.message) {
        return {
          success: true,
          message: i18n.t('settings.aiTestSuccess', { defaultValue: '連線成功', lng: locale }),
        };
      }
    } catch {
      if (raw.trim()) {
        return {
          success: true,
          message: i18n.t('settings.aiTestSuccess', { defaultValue: '連線成功', lng: locale }),
        };
      }
    }
    return {
      success: true,
      message: i18n.t('settings.aiTestSuccess', { defaultValue: '連線成功', lng: locale }),
    };
  } catch (err: unknown) {
    if (timedOut || (err instanceof DOMException && err.name === 'AbortError')) {
      return {
        success: false,
        message: formatAiErrorMessage('TIMEOUT', undefined, undefined, locale),
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: formatAiErrorMessage(msg, undefined, undefined, locale) };
  } finally {
    clearTimeout(timer);
  }
}

/** 解析營養標籤（支援圖片 OCR 或純文字標籤解析） */
export async function parseNutritionLabel(
  imageBase64: string | undefined,
  settings: AISettings,
  userNotes?: string,
  signal?: AbortSignal,
  lang?: string,
  knownBrands?: string[]
): Promise<NutritionLabelParseResult> {
  const locale = resolveSupportedLocale(lang || i18n.language);
  const cleanBrands = knownBrands
    ?.map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 100);

  let prompt: string;
  if (locale === 'en') {
    prompt = imageBase64
      ? 'Please identify the nutrition facts label in the image. Output calories, carbs, protein, fat, sugar, dietary fiber, sodium, serving size, and product name in the specified JSON format in English.'
      : 'Please analyze and estimate standard nutrition label facts based on the food name or description provided by the user. Output in the specified JSON format in English.';
    if (userNotes && userNotes.trim()) {
      prompt += `\nUser provided notes or label text: ${userNotes.trim()}`;
    }
    if (cleanBrands && cleanBrands.length > 0) {
      prompt += `\nExisting brand list in user's database (prioritize matching and using the exact string): ${cleanBrands.join(', ')}`;
    }
  } else if (locale === 'zh-CN') {
    prompt = imageBase64
      ? '请识别图片中的营养标签或营养成分表。请按照指定 JSON 格式以简体中文输出热量、碳水、蛋白质、脂肪、糖、膳食纤维、钠、基准份量与品名。'
      : '请根据用户提供的食品名称或营养成分描述，解析并推算其标准营养标签数据。请按照指定 JSON 格式以简体中文输出。';
    if (userNotes && userNotes.trim()) {
      prompt += `\n用户提供之说明或标签文字：${userNotes.trim()}`;
    }
    if (cleanBrands && cleanBrands.length > 0) {
      prompt += `\n用户数据库中的已知品牌列表（请优先匹配并使用完全一致字符串）：${cleanBrands.join('、')}`;
    }
  } else {
    prompt = imageBase64
      ? '請辨識圖片中的營養標籤或營養成分表。請按照指定 JSON 格式以繁體中文輸出熱量、碳水、蛋白質、脂肪、糖、膳食纖維、鈉、基準份量與品名。'
      : '請根據使用者提供的食品名稱或營養成分描述，解析並推算其標準營養標籤數據。請按照指定 JSON 格式以繁體中文輸出。';
    if (userNotes && userNotes.trim()) {
      prompt += `\n使用者提供之說明或標籤文字：${userNotes.trim()}`;
    }
    if (cleanBrands && cleanBrands.length > 0) {
      prompt += `\n使用者資料庫中的已知品牌清單（請優先匹配並使用完全一致字串）：${cleanBrands.join('、')}`;
    }
  }

  const raw = await callAiGateway({
    prompt,
    systemInstruction: getNutritionLabelSystemPrompt(locale),
    imageBase64,
    settings,
    signal,
  });

  try {
    const parsed = JSON.parse(cleanJsonResponse(raw));
    return parsed as NutritionLabelParseResult;
  } catch {
    throw new Error(formatAiErrorMessage('PARSE_NUTRITION_FAILED'));
  }
}

/** 估算外食餐點（支援餐點圖片或純文字描述） */
export async function estimateMeal(
  imageBase64: string | undefined,
  userNotes: string | undefined,
  settings: AISettings,
  signal?: AbortSignal,
  lang?: string
): Promise<MealEstimateResult> {
  const locale = resolveSupportedLocale(lang || i18n.language);

  let prompt: string;
  if (locale === 'en') {
    prompt = imageBase64
      ? 'Please deconstruct the meal in the image, objectively estimate component weight in grams, calories, carbs, protein, fat, and sodium (mg), and output structured JSON in English.'
      : 'Please deconstruct the meal based on the user description, objectively estimate component weight in grams, calories, carbs, protein, fat, and sodium (mg), and output structured JSON in English.';
    if (userNotes && userNotes.trim()) {
      prompt += `\nUser provided meal description: ${userNotes.trim()}`;
    }
  } else if (locale === 'zh-CN') {
    prompt = imageBase64
      ? '请解构盘中餐点，客观推算各组件份量克数与热量、碳水、蛋白质、脂肪及钠 (mg) 数值，并以简体中文输出结构化 JSON。'
      : '请根据用户描述的餐点内容，客观推算各组件份量克数与热量、碳水、蛋白质、脂肪及钠 (mg) 数值，并以简体中文输出结构化 JSON。';
    if (userNotes && userNotes.trim()) {
      prompt += `\n用户提供之餐点说明：${userNotes.trim()}`;
    }
  } else {
    prompt = imageBase64
      ? '請解構盤中餐點，客觀推算各組件份量克數與熱量、碳水、蛋白質、脂肪及鈉 (mg) 數值，並以繁體中文輸出結構化 JSON。'
      : '請根據使用者描述的餐點內容，客觀推算各組件份量克數與熱量、碳水、蛋白質、脂肪及鈉 (mg) 數值，並以繁體中文輸出結構化 JSON。';
    if (userNotes && userNotes.trim()) {
      prompt += `\n使用者提供之說明或餐點說明：${userNotes.trim()}`;
    }
  }

  const raw = await callAiGateway({
    prompt,
    systemInstruction: getMealEstimateSystemPrompt(locale),
    imageBase64,
    settings,
    signal,
  });

  try {
    const parsed = JSON.parse(cleanJsonResponse(raw));
    return parsed as MealEstimateResult;
  } catch {
    throw new Error(formatAiErrorMessage('PARSE_MEAL_FAILED'));
  }
}

export interface AIModelOption {
  id: string;
  displayName?: string;
}

/**
 * 從 AI 服務端動態獲取可用之最新模型清單
 * - Google 協議: 呼叫 /v1beta/models 並篩選支援 generateContent 之視覺/對話模型
 * - OpenAI 協議: 呼叫 /models
 * - Anthropic 協議: 呼叫 /models (含 CORS header)
 */
export async function fetchAvailableModels(settings: AISettings): Promise<AIModelOption[]> {
  const { protocol, baseUrl, apiKey, isCustom } = resolveActiveEndpoint(settings);
  if (!isCustom && !apiKey) {
    throw new Error(formatAiErrorMessage('MISSING_API_KEY'));
  }
  if (isCustom && !baseUrl) {
    throw new Error(formatAiErrorMessage('MISSING_ENDPOINT'));
  }

  if (protocol === 'gemini') {
    const url = buildGeminiUrl(baseUrl, '/models?pageSize=100', apiKey);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(await parseErrorResponse(res, 'Gemini API'));
    }

    const data = (await res.json()) as {
      models?: Array<{
        name?: string;
        id?: string;
        displayName?: string;
        supportedGenerationMethods?: string[];
      }>;
      data?: Array<{
        name?: string;
        id?: string;
        displayName?: string;
        supportedGenerationMethods?: string[];
      }>;
    };

    const rawList = Array.isArray(data) ? data : (data.models || data.data || []);

    const models = rawList
      .filter((m) => {
        const id = m.id || m.name;
        if (!id) return false;
        if (Array.isArray(m.supportedGenerationMethods)) {
          if (!m.supportedGenerationMethods.includes('generateContent')) return false;
        }
        const lower = String(id).toLowerCase();
        if (
          lower.includes('embedding') ||
          lower.includes('aqa') ||
          lower.includes('imagen') ||
          lower.includes('lyria') ||
          lower.includes('tts')
        ) {
          return false;
        }
        return true;
      })
      .map((m) => {
        const rawId = String(m.id || m.name || '').replace(/^models\//, '');
        return {
          id: rawId,
          displayName: m.displayName || rawId,
        };
      });

    return models.sort((a, b) => b.id.localeCompare(a.id));
  }

  if (protocol === 'anthropic') {
    const url = `${baseUrl.replace(/\/+$/, '')}/models`;
    const headers: Record<string, string> = {
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(await parseErrorResponse(res, 'Anthropic API'));
    }

    const data = (await res.json()) as Record<string, unknown>;
    const rawList: Array<Record<string, unknown>> = Array.isArray(data)
      ? data
      : Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.models)
          ? data.models
          : [];

    return rawList
      .filter((m) => Boolean(m.id || m.name))
      .map((m) => {
        const id = String(m.id || m.name);
        const displayName = (m.display_name as string) || (m.displayName as string) || id;
        return { id, displayName };
      })
      .sort((a, b) => b.id.localeCompare(a.id));
  }

  // OpenAI Compatible
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBase}/models`;
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  let res = await fetch(url, { headers });

  if (!res.ok && res.status === 404 && !cleanBase.endsWith('/v1')) {
    const fallbackUrl = `${cleanBase}/v1/models`;
    try {
      const fallbackRes = await fetch(fallbackUrl, { headers });
      if (fallbackRes.ok) {
        res = fallbackRes;
      }
    } catch {
      // 保持原始 res
    }
  }

  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, 'OpenAI API'));
  }

  const json = (await res.json()) as Record<string, unknown>;
  const rawList: Array<Record<string, unknown>> = Array.isArray(json)
    ? json
    : Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.models)
        ? json.models
        : [];

  return rawList
    .filter((m) => Boolean(m.id || m.name))
    .map((m) => {
      const id = String(m.id || m.name);
      const displayName = (m.display_name as string) || (m.displayName as string) || id;
      return { id, displayName };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}
