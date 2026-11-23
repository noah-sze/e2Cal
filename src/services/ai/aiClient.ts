import type {
  AISettings,
  NutritionLabelParseResult,
  MealEstimateResult,
} from '@/types/ai';
import { resolveActiveEndpoint } from '@/hooks/useAISettings';
import { reportNetworkError, reportNetworkSuccess } from '@/hooks/useNetworkStatus';
import {
  NUTRITION_LABEL_SYSTEM_PROMPT,
  MEAL_ESTIMATE_SYSTEM_PROMPT,
} from './prompts';

/** 解析並翻譯常見 AI API 錯誤訊息，讓使用者能一眼看懂問題根源 */
export function formatAiErrorMessage(rawMessage: string, status?: number): string {
  const lower = rawMessage.toLowerCase();

  if (
    status === 503 ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('temporarily unavailable')
  ) {
    return '模型目前擁堵';
  }

  if (
    status === 429 ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('resource has been exhausted') ||
    lower.includes('too many requests')
  ) {
    return '已達 API 配額或頻率上限';
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
    return 'API Key 無效或無權限';
  }

  if (status === 404 || lower.includes('is not found') || lower.includes('model not found')) {
    return '找不到模型或端點';
  }

  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return '網路連線失敗';
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
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

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

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
    signal,
  });

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

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
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
  const { protocol, baseUrl, apiKey, model } = resolveActiveEndpoint(params.settings);
  if (!apiKey) {
    throw new Error(formatAiErrorMessage('MISSING_API_KEY'));
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
  timeoutMs: number = DEFAULT_TEST_TIMEOUT_MS
): Promise<{ success: boolean; message: string }> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const prompt = '請回覆純 JSON：{"status":"ok","message":"connection successful"}';
    const raw = await callAiGateway({
      prompt,
      settings,
      signal: controller.signal,
    });
    const parsed = JSON.parse(cleanJsonResponse(raw));
    if (parsed.status === 'ok' || parsed.message) {
      return { success: true, message: '連線成功！' };
    }
    return { success: true, message: '連線成功。' };
  } catch (err: unknown) {
    if (timedOut || (err instanceof DOMException && err.name === 'AbortError')) {
      return {
        success: false,
        message: '連線超時',
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: formatAiErrorMessage(msg) };
  } finally {
    clearTimeout(timer);
  }
}

/** 解析營養標籤（支援圖片 OCR 或純文字標籤解析） */
export async function parseNutritionLabel(
  imageBase64: string | undefined,
  settings: AISettings,
  userNotes?: string,
  signal?: AbortSignal
): Promise<NutritionLabelParseResult> {
  let prompt = imageBase64
    ? '請辨識圖片中的營養標籤或營養成分表。請按照指定 JSON 格式輸出熱量、碳水、蛋白質、脂肪、糖、膳食纖維、基準份量與品名。'
    : '請根據使用者提供的食品名稱或營養成分描述，解析並推算其標準營養標籤數據。請按照指定 JSON 格式輸出。';

  if (userNotes && userNotes.trim()) {
    prompt += `\n使用者提供之說明或標籤文字：${userNotes.trim()}`;
  }

  const raw = await callAiGateway({
    prompt,
    systemInstruction: NUTRITION_LABEL_SYSTEM_PROMPT,
    imageBase64,
    settings,
    signal,
  });

  try {
    const parsed = JSON.parse(cleanJsonResponse(raw));
    return parsed as NutritionLabelParseResult;
  } catch {
    throw new Error('AI 返回之格式無法正確解析為營養標籤 JSON。');
  }
}

/** 估算外食餐點（支援餐點圖片或純文字描述） */
export async function estimateMeal(
  imageBase64: string | undefined,
  userNotes: string | undefined,
  settings: AISettings,
  signal?: AbortSignal
): Promise<MealEstimateResult> {
  let prompt = imageBase64
    ? '請解構盤中餐點，客觀推算各組件份量克數與熱量、碳水、蛋白質、脂肪數值，並輸出結構化 JSON。'
    : '請根據使用者描述的餐點內容，客觀推算各組件份量克數與熱量、碳水、蛋白質、脂肪數值，並輸出結構化 JSON。';

  if (userNotes && userNotes.trim()) {
    prompt += `\n使用者提供之餐點說明：${userNotes.trim()}`;
  }

  const raw = await callAiGateway({
    prompt,
    systemInstruction: MEAL_ESTIMATE_SYSTEM_PROMPT,
    imageBase64,
    settings,
    signal,
  });

  try {
    const parsed = JSON.parse(cleanJsonResponse(raw));
    return parsed as MealEstimateResult;
  } catch {
    throw new Error('AI 返回之格式無法正確解析為餐點估算 JSON。');
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
  const { protocol, baseUrl, apiKey } = resolveActiveEndpoint(settings);
  if (!apiKey) {
    throw new Error(formatAiErrorMessage('MISSING_API_KEY'));
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
        displayName?: string;
        supportedGenerationMethods?: string[];
      }>;
    };

    const models = (data.models || [])
      .filter((m) => {
        if (!m.name) return false;
        const methods = m.supportedGenerationMethods || [];
        if (!methods.includes('generateContent')) return false;
        const lower = m.name.toLowerCase();
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
      .map((m) => ({
        id: (m.name || '').replace(/^models\//, ''),
        displayName: m.displayName || (m.name || '').replace(/^models\//, ''),
      }));

    return models.sort((a, b) => b.id.localeCompare(a.id));
  }

  if (protocol === 'anthropic') {
    const url = `${baseUrl.replace(/\/+$/, '')}/models`;
    const res = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    });
    if (!res.ok) {
      throw new Error(await parseErrorResponse(res, 'Anthropic API'));
    }

    const data = (await res.json()) as {
      data?: Array<{ id?: string; display_name?: string }>;
    };

    return (data.data || [])
      .filter((m) => Boolean(m.id))
      .map((m) => ({ id: m.id as string, displayName: m.display_name || m.id }))
      .sort((a, b) => b.id.localeCompare(a.id));
  }

  // OpenAI Compatible
  const url = `${baseUrl.replace(/\/+$/, '')}/models`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, 'OpenAI API'));
  }

  const data = (await res.json()) as {
    data?: Array<{ id?: string }>;
  };

  return (data.data || [])
    .filter((m) => Boolean(m.id))
    .map((m) => ({ id: m.id as string }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
