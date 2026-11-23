import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cleanJsonResponse,
  parseNutritionLabel,
  estimateMeal,
  testAIConnection,
  fetchAvailableModels,
  formatAiErrorMessage,
} from './aiClient';
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
});
