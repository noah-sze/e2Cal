import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from '@/i18n/config';
import {
  cleanJsonResponse,
  parseNutritionLabel,
  estimateMeal,
  testAIConnection,
  fetchAvailableModels,
  formatAiErrorMessage,
} from './aiClient';
import { getNutritionLabelSystemPrompt, getMealEstimateSystemPrompt } from './prompts';
import type { AISettings } from '@/types/ai';

describe('cleanJsonResponse', () => {
  it('should trim plain json', () => {
    expect(cleanJsonResponse('{"a": 1}')).toBe('{"a": 1}');
  });

  it('should remove ```json and ``` markdown code blocks', () => {
    const markdown = '```json\n{"name": "apple", "calories": 52}\n```';
    expect(cleanJsonResponse(markdown)).toBe('{"name": "apple", "calories": 52}');
  });

  it('should remove ``` and ``` markdown code blocks', () => {
    const markdown = '```\n{"name": "banana"}\n```';
    expect(cleanJsonResponse(markdown)).toBe('{"name": "banana"}');
  });
});

describe('AI Client API calls', () => {
  const baseSettings: AISettings = {
    provider: 'gemini',
    geminiApiKey: 'test-gemini-key',
    geminiModel: 'gemini-3.8-flash',
    openaiApiKey: 'test-openai-key',
    openaiModel: 'gpt-4o-mini',
    anthropicApiKey: 'test-anthropic-key',
    anthropicModel: 'claude-haiku-5-5',
    customProtocol: 'openai',
    customBaseUrl: 'https://proxy.example.com/v1',
    customApiKey: 'test-custom-key',
    customModel: 'custom-vision-model',
  };

  const dummyGeminiSettings: AISettings = { ...baseSettings, provider: 'gemini' };
  const dummyOpenAISettings: AISettings = { ...baseSettings, provider: 'openai' };
  const dummyAnthropicSettings: AISettings = { ...baseSettings, provider: 'anthropic' };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should test connection successfully for Gemini', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"status":"ok","message":"connection successful"}' }],
            },
          },
        ],
      }),
    } as Response);

    const res = await testAIConnection(dummyGeminiSettings);
    expect(res.success).toBe(true);
  });

  it('should test connection successfully for Anthropic with direct-browser-access header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"status":"ok","message":"connection successful"}' }],
      }),
    } as Response);

    const res = await testAIConnection(dummyAnthropicSettings);
    expect(res.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        headers: expect.objectContaining({
          'anthropic-dangerous-direct-browser-access': 'true',
          'x-api-key': 'test-anthropic-key',
        }),
      })
    );
  });

  it('should route custom protocol to custom Base URL for Gemini', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"status":"ok"}' }],
            },
          },
        ],
      }),
    } as Response);

    const customGemini: AISettings = {
      ...baseSettings,
      provider: 'custom',
      customProtocol: 'gemini',
      customBaseUrl: 'https://gemini-proxy.example.com',
      customModel: 'gemini-4-hydrogen',
    };

    const res = await testAIConnection(customGemini);
    expect(res.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://gemini-proxy.example.com/v1beta/models/gemini-4-hydrogen:generateContent?key=test-custom-key',
      expect.any(Object)
    );
  });

  it('should test connection failure for missing API key', async () => {
    const emptySettings: AISettings = {
      ...dummyGeminiSettings,
      geminiApiKey: '',
    };
    const res = await testAIConnection(emptySettings);
    expect(res.success).toBe(false);
    expect(res.message).toContain('API Key');
  });

  it('should abort and return timeout error when connection exceeds timeoutMs', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('The operation was aborted.', 'AbortError')),
          { once: true }
        );
      });
    });

    const res = await testAIConnection(dummyGeminiSettings, 30);
    expect(res.success).toBe(false);
    expect(res.message).toContain('超時');
  });

  it('should parse nutrition label via Gemini', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    name: '純黑巧克力',
                    servingSize: 100,
                    servingUnit: 'g',
                    calories: 550,
                    carbs: 30,
                    protein: 8,
                    fat: 45,
                    sugar: 20,
                    fiber: 10,
                  }),
                },
              ],
            },
          },
        ],
      }),
    } as Response);

    const result = await parseNutritionLabel('dummyBase64', dummyGeminiSettings);
    expect(result.name).toBe('純黑巧克力');
    expect(result.calories).toBe(550);
    expect(result.carbs).toBe(30);
  });

  it('should estimate meal via OpenAI', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: '牛排便當',
                summary: '包含白飯、牛排與花椰菜',
                totalCalories: 650,
                totalCarbs: 60,
                totalProtein: 45,
                totalFat: 25,
                components: [
                  {
                    name: '煎牛排',
                    estimatedWeightGrams: 150,
                    calories: 350,
                    carbs: 0,
                    protein: 35,
                    fat: 22,
                  },
                ],
              }),
            },
          },
        ],
      }),
    } as Response);

    const result = await estimateMeal('dummyBase64', '少飯', dummyOpenAISettings);
    expect(result.title).toBe('牛排便當');
    expect(result.totalCalories).toBe(650);
    expect(result.components).toHaveLength(1);
  });

  it('should fetch and filter available Gemini models', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          {
            name: 'models/gemini-4-hydrogen',
            displayName: 'Gemini 4 Hydrogen',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/gemini-3.8-flash',
            displayName: 'Gemini 3.8 Flash',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/gemini-embedding-2',
            displayName: 'Gemini Embedding 2',
            supportedGenerationMethods: ['embedContent'],
          },
        ],
      }),
    } as Response);

    const models = await fetchAvailableModels(dummyGeminiSettings);
    expect(models).toHaveLength(2);
    expect(models.map((m) => m.id)).toContain('gemini-4-hydrogen');
    expect(models.map((m) => m.id)).toContain('gemini-3.8-flash');
  });

  it('should fetch available Anthropic models', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 'claude-sonnet-5-5', display_name: 'Claude Sonnet 5.5' },
          { id: 'claude-haiku-5-5', display_name: 'Claude Haiku 5.5' },
        ],
      }),
    } as Response);

    const models = await fetchAvailableModels(dummyAnthropicSettings);
    expect(models).toHaveLength(2);
    expect(models.map((m) => m.id)).toContain('claude-haiku-5-5');
  });

  it('should fetch available OpenAI models', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }],
      }),
    } as Response);

    const models = await fetchAvailableModels(dummyOpenAISettings);
    expect(models).toHaveLength(2);
    expect(models[0].id).toBe('gpt-4o');
  });

  it('should fetch models from custom OpenAI endpoint without API key', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'llama3.2:latest' }, { id: 'qwen2.5-coder:7b' }],
      }),
    } as Response);

    const customSettings: AISettings = {
      ...baseSettings,
      provider: 'custom',
      customProtocol: 'openai',
      customBaseUrl: 'http://localhost:11434/v1',
      customApiKey: '',
      customModel: '',
    };

    const models = await fetchAvailableModels(customSettings);
    expect(models).toHaveLength(2);
    expect(models.map((m) => m.id)).toContain('llama3.2:latest');
    expect(models.map((m) => m.id)).toContain('qwen2.5-coder:7b');

    // Should not send Authorization header when apiKey is empty
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:11434/v1/models',
      expect.objectContaining({
        headers: {},
      })
    );
  });

  it('should fetch models from custom endpoint returning models array with name property', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [{ name: 'mistral:latest' }, { name: 'gemma2:9b' }],
      }),
    } as Response);

    const customSettings: AISettings = {
      ...baseSettings,
      provider: 'custom',
      customProtocol: 'openai',
      customBaseUrl: 'http://localhost:11434',
      customApiKey: '',
      customModel: '',
    };

    const models = await fetchAvailableModels(customSettings);
    expect(models).toHaveLength(2);
    expect(models.map((m) => m.id)).toContain('mistral:latest');
    expect(models.map((m) => m.id)).toContain('gemma2:9b');
  });

  it('should fallback to /v1/models when root /models returns 404', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'deepseek-r1:latest' }],
        }),
      } as Response);

    const customSettings: AISettings = {
      ...baseSettings,
      provider: 'custom',
      customProtocol: 'openai',
      customBaseUrl: 'http://localhost:11434',
      customApiKey: '',
      customModel: '',
    };

    const models = await fetchAvailableModels(customSettings);
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('deepseek-r1:latest');
  });

  it('should test connection successfully on custom endpoint without API key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"status":"ok","message":"connection successful"}',
            },
          },
        ],
      }),
    } as Response);

    const customSettings: AISettings = {
      ...baseSettings,
      provider: 'custom',
      customProtocol: 'openai',
      customBaseUrl: 'http://localhost:11434/v1',
      customApiKey: '',
      customModel: 'llama3.2',
    };

    const res = await testAIConnection(customSettings);
    expect(res.success).toBe(true);
    expect(res.message).toContain('連線成功');
  });

  it('should error when custom endpoint has empty baseUrl', async () => {
    const customSettings: AISettings = {
      ...baseSettings,
      provider: 'custom',
      customProtocol: 'openai',
      customBaseUrl: '',
      customApiKey: '',
      customModel: '',
    };

    await expect(fetchAvailableModels(customSettings)).rejects.toThrow('未填寫端點網址');
  });

  it('should format high demand error message cleanly', () => {
    const raw =
      'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.';
    const formatted = formatAiErrorMessage(raw, 503);
    expect(formatted).toBe('模型目前擁堵');
  });

  it('should format invalid api key error message cleanly', () => {
    const formatted = formatAiErrorMessage('API key not valid. Please pass a valid API key.', 400);
    expect(formatted).toContain('API Key 無效');
  });

  it('should support multilingual error messages across en, zh-CN, and zh-TW', async () => {
    await i18n.changeLanguage('en');
    expect(formatAiErrorMessage('MISSING_API_KEY')).toBe('Invalid API Key');
    expect(formatAiErrorMessage('MISSING_ENDPOINT')).toBe('Missing endpoint URL');
    expect(formatAiErrorMessage('overloaded', 503)).toBe('Model overloaded');
    expect(formatAiErrorMessage('rate limit', 429)).toBe('Rate limit exceeded');
    expect(formatAiErrorMessage('not found', 404)).toBe('Model or endpoint not found');
    expect(formatAiErrorMessage('failed to fetch')).toBe('Network error');
    expect(formatAiErrorMessage('TIMEOUT')).toBe('Connection timed out');
    expect(formatAiErrorMessage('EMPTY_AI_RESPONSE')).toBe('Empty AI response');
    expect(formatAiErrorMessage('PARSE_NUTRITION_FAILED')).toBe(
      'Failed to parse nutrition label JSON'
    );
    expect(formatAiErrorMessage('PARSE_MEAL_FAILED')).toBe(
      'Failed to parse meal estimate JSON'
    );

    await i18n.changeLanguage('zh-CN');
    expect(formatAiErrorMessage('MISSING_API_KEY')).toBe('API Key 无效或无权限');
    expect(formatAiErrorMessage('MISSING_ENDPOINT')).toBe('未填写端点网址');
    expect(formatAiErrorMessage('overloaded', 503)).toBe('模型目前拥堵');
    expect(formatAiErrorMessage('rate limit', 429)).toBe('已达 API 配额或频率上限');
    expect(formatAiErrorMessage('not found', 404)).toBe('找不到模型或端点');
    expect(formatAiErrorMessage('failed to fetch')).toBe('网络连接失败');
    expect(formatAiErrorMessage('TIMEOUT')).toBe('连接超时');
    expect(formatAiErrorMessage('EMPTY_AI_RESPONSE')).toBe('AI 响应为空');
    expect(formatAiErrorMessage('PARSE_NUTRITION_FAILED')).toBe(
      'AI 返回格式无法解析为营养标签 JSON'
    );
    expect(formatAiErrorMessage('PARSE_MEAL_FAILED')).toBe(
      'AI 返回格式无法解析为餐点估算 JSON'
    );

    await i18n.changeLanguage('zh-TW');
    expect(formatAiErrorMessage('MISSING_API_KEY')).toBe('API Key 無效或無權限');
    expect(formatAiErrorMessage('MISSING_ENDPOINT')).toBe('未填寫端點網址');
    expect(formatAiErrorMessage('overloaded', 503)).toBe('模型目前擁堵');
    expect(formatAiErrorMessage('rate limit', 429)).toBe('已達 API 配額或頻率上限');
    expect(formatAiErrorMessage('not found', 404)).toBe('找不到模型或端點');
    expect(formatAiErrorMessage('failed to fetch')).toBe('網路連線失敗');
    expect(formatAiErrorMessage('TIMEOUT')).toBe('連線超時');
    expect(formatAiErrorMessage('EMPTY_AI_RESPONSE')).toBe('AI 回應為空');
    expect(formatAiErrorMessage('PARSE_NUTRITION_FAILED')).toBe(
      'AI 回傳格式無法解析為營養標籤 JSON'
    );
    expect(formatAiErrorMessage('PARSE_MEAL_FAILED')).toBe(
      'AI 回傳格式無法解析為餐點估算 JSON'
    );
  });

  it('should accept custom t translation function parameter', () => {
    const customT = vi.fn().mockReturnValue('Custom translated error');
    const result = formatAiErrorMessage('MISSING_API_KEY', undefined, customT as never);
    expect(result).toBe('Custom translated error');
    expect(customT).toHaveBeenCalledWith('settings.aiErrorInvalidApiKey', 'API Key 無效或無權限');
  });

  it('should generate system prompts matching user language', () => {
    const enLabelPrompt = getNutritionLabelSystemPrompt('en');
    expect(enLabelPrompt).toContain('All output textual fields ("name", "brand", "notes") MUST be in English');
    const zhCNLabelPrompt = getNutritionLabelSystemPrompt('zh-CN');
    expect(zhCNLabelPrompt).toContain('所有输出的文本字段（"name"、"brand"、"notes"）必须使用【简体中文】');
    const zhTWLabelPrompt = getNutritionLabelSystemPrompt('zh-TW');
    expect(zhTWLabelPrompt).toContain('所有輸出的文字欄位（"name"、"brand"、"notes"）必須使用【繁體中文】');

    const enMealPrompt = getMealEstimateSystemPrompt('en');
    expect(enMealPrompt).toContain('All output textual fields ("title", "summary", "components[].name", "components[].notes") MUST be in English');
    const zhCNMealPrompt = getMealEstimateSystemPrompt('zh-CN');
    expect(zhCNMealPrompt).toContain('所有输出的文本字段（"title"、"summary"、"components[].name"、"components[].notes"）必须使用【简体中文】');
    const zhTWMealPrompt = getMealEstimateSystemPrompt('zh-TW');
    expect(zhTWMealPrompt).toContain('所有輸出的文字欄位（"title"、"summary"、"components[].name"、"components[].notes"）必須使用【繁體中文】');
  });

  it('should send prompt and system instruction in English when user language is en', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"name":"Oatmeal","calories":150,"carbs":27,"protein":5,"fat":3}' }],
            },
          },
        ],
      }),
    } as Response);

    await parseNutritionLabel('dummyBase64', dummyGeminiSettings, 'fine oats', undefined, 'en');
    expect(fetchSpy).toHaveBeenCalled();
    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(callBody.system_instruction.parts[0].text).toContain('MUST be in English');
    expect(callBody.contents[0].parts.some((p: { text?: string }) => p.text?.includes('Please identify the nutrition facts label'))).toBe(true);
  });
});
