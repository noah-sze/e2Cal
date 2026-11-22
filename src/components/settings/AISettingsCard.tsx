import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, RefreshCw, Pencil, List } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useAISettings,
  OFFICIAL_ENDPOINTS,
  resolveActiveEndpoint,
} from '@/hooks/useAISettings';
import { testAIConnection, fetchAvailableModels, type AIModelOption } from '@/services/ai/aiClient';
import { triggerHaptic } from '@/lib/haptics';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { AIProvider, AIProtocol } from '@/types/ai';

const DEFAULT_MODELS_BY_PROTOCOL: Record<AIProtocol, AIModelOption[]> = {
  gemini: [
    { id: 'gemini-3.8-flash' },
    { id: 'gemini-4-hydrogen' },
    { id: 'gemini-4-neon' },
    { id: 'gemini-3.1-pro' },
  ],
  openai: [
    { id: 'gpt-4o-mini' },
    { id: 'gpt-4o' },
  ],
  anthropic: [
    { id: 'claude-haiku-5-5' },
    { id: 'claude-sonnet-5-5' },
    { id: 'claude-opus-5-5' },
  ],
};

const PROTOCOL_LABELS: Record<AIProtocol, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  anthropic: 'Anthropic',
};

export function AISettingsCard() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useAISettings();
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // 動態拉取之模型列表（依當前 provider + customProtocol 快取）
  const [fetchedModels, setFetchedModels] = useState<Record<string, AIModelOption[]>>({});
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isCustomModelInput, setIsCustomModelInput] = useState(false);

  const active = resolveActiveEndpoint(settings);
  const isCustomProvider = settings.provider === 'custom';
  const cacheKey = isCustomProvider ? `custom:${settings.customProtocol}` : settings.provider;

  const getCurrentKeyRaw = (): string => {
    switch (settings.provider) {
      case 'gemini':
        return settings.geminiApiKey;
      case 'openai':
        return settings.openaiApiKey;
      case 'anthropic':
        return settings.anthropicApiKey;
      case 'custom':
        return settings.customApiKey;
    }
  };

  const getCurrentModelRaw = (): string => {
    switch (settings.provider) {
      case 'gemini':
        return settings.geminiModel;
      case 'openai':
        return settings.openaiModel;
      case 'anthropic':
        return settings.anthropicModel;
      case 'custom':
        return settings.customModel;
    }
  };

  const currentKey = getCurrentKeyRaw();
  const currentModel = getCurrentModelRaw();
  const hasKey = Boolean(currentKey.trim());
  const canTestOrFetch = isCustomProvider
    ? Boolean(hasKey && settings.customBaseUrl.trim())
    : hasKey;

  const modelOptions: AIModelOption[] = (() => {
    const dynamicList = fetchedModels[cacheKey];
    const baseList =
      dynamicList && dynamicList.length > 0
        ? dynamicList
        : DEFAULT_MODELS_BY_PROTOCOL[active.protocol];

    const displayVal = currentModel || active.model;
    if (displayVal && !baseList.some((m) => m.id === displayVal)) {
      return [{ id: displayVal }, ...baseList];
    }
    return baseList;
  })();

  const getProviderLabel = (p: AIProvider) => {
    switch (p) {
      case 'gemini':
        return 'Google Gemini';
      case 'openai':
        return 'OpenAI';
      case 'anthropic':
        return 'Anthropic';
      case 'custom':
        return t('settings.aiProviderCustom', '自訂端點');
    }
  };

  const handleProviderChange = (val: string | null) => {
    if (!val) return;
    triggerHaptic('selection');
    updateSettings({ provider: val as AIProvider });
    setTestResult(null);
  };

  const handleProtocolChange = (val: string | null) => {
    if (!val) return;
    triggerHaptic('selection');
    updateSettings({ customProtocol: val as AIProtocol });
    setTestResult(null);
  };

  const handleKeyChange = (val: string) => {
    switch (settings.provider) {
      case 'gemini':
        updateSettings({ geminiApiKey: val });
        break;
      case 'openai':
        updateSettings({ openaiApiKey: val });
        break;
      case 'anthropic':
        updateSettings({ anthropicApiKey: val });
        break;
      case 'custom':
        updateSettings({ customApiKey: val });
        break;
    }
    setTestResult(null);
  };

  const handleModelChange = (val: string | null) => {
    if (val === null) return;
    switch (settings.provider) {
      case 'gemini':
        updateSettings({ geminiModel: val });
        break;
      case 'openai':
        updateSettings({ openaiModel: val });
        break;
      case 'anthropic':
        updateSettings({ anthropicModel: val });
        break;
      case 'custom':
        updateSettings({ customModel: val });
        break;
    }
    setTestResult(null);
  };

  const handleFetchModels = async () => {
    if (!canTestOrFetch || isFetchingModels) return;
    setIsFetchingModels(true);
    try {
      const models = await fetchAvailableModels(settings);
      if (models.length === 0) {
        toast.show(t('settings.aiFetchModelsEmpty', '未取得可用模型'));
        return;
      }
      setFetchedModels((prev) => ({ ...prev, [cacheKey]: models }));
      setIsCustomModelInput(false);
      triggerHaptic('success');
      toast.show(
        t('settings.aiFetchModelsSuccess', '已更新模型清單 ({{count}})', { count: models.length })
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      triggerHaptic('error');
      toast.show(msg || t('settings.aiFetchModelsFailed', '獲取模型失敗'));
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testAIConnection(settings);
      setTestResult(res);
      if (res.success) {
        triggerHaptic('success');
        toast.show(t('settings.aiTestSuccess', '連線成功'));
      } else {
        triggerHaptic('error');
        toast.show(res.message || t('settings.aiTestFailed', '連線失敗'));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({ success: false, message: msg });
      triggerHaptic('error');
      toast.show(msg);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <section className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start">
      {/* 左側標題與描述 */}
      <div className="sm:col-span-4 space-y-0.5 px-1 sm:px-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
          {t('settings.aiSection', 'AI 助手設定')}
        </h2>
        <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
          {t('settings.aiDesc', '自備 API Key (BYO-AI)，支援營養標籤識別與外食拍照估算，直連官方 API 或自訂端點')}
        </p>
      </div>

      {/* 右側表格卡片 */}
      <div className="sm:col-span-8 border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
        {/* 1. 提供商選擇（三大官方 + 自訂端點） */}
        <div className="usage-row gap-3">
          <span className="text-sm font-normal text-foreground shrink-0">
            {t('settings.aiProvider', '服務提供商')}
          </span>
          <Select value={settings.provider} onValueChange={handleProviderChange}>
            <SelectTrigger
              size="custom"
              className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <SelectValue className="flex-none text-right">
                {getProviderLabel(settings.provider)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end" className="min-w-44">
              <SelectItem value="gemini">Google Gemini</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="custom">{t('settings.aiProviderCustom', '自訂端點')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 2. 自訂端點專屬設定（協議格式 + Base URL） */}
        {isCustomProvider && (
          <>
            <div className="usage-row gap-3">
              <span className="text-sm font-normal text-foreground shrink-0">
                {t('settings.aiProtocol', '協議格式')}
              </span>
              <Select value={settings.customProtocol} onValueChange={handleProtocolChange}>
                <SelectTrigger
                  size="custom"
                  className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <SelectValue className="flex-none text-right">
                    {PROTOCOL_LABELS[settings.customProtocol]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end" className="min-w-40">
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="usage-row gap-3">
              <span className="text-sm font-normal text-foreground shrink-0">
                {t('settings.aiBaseUrl', '端點網址')}
              </span>
              <input
                type="text"
                value={settings.customBaseUrl}
                onChange={(e) => {
                  updateSettings({ customBaseUrl: e.target.value });
                  setTestResult(null);
                }}
                placeholder={OFFICIAL_ENDPOINTS[settings.customProtocol]}
                className="text-right text-sm font-mono text-foreground bg-transparent placeholder:text-muted-foreground/40 focus:outline-hidden min-w-0 flex-1 max-w-[240px]"
              />
            </div>
          </>
        )}

        {/* 3. API Key 輸入 */}
        <div className="usage-row gap-3">
          <span className="text-sm font-normal text-foreground shrink-0">
            {t('settings.aiApiKey', 'API Key')}
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <input
              type={showKey ? 'text' : 'password'}
              value={currentKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder={t('settings.aiApiKeyPlaceholder', '請填入 API Key')}
              className="text-right text-sm font-mono text-foreground bg-transparent placeholder:text-muted-foreground/40 focus:outline-hidden w-36 sm:w-48 min-w-0"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="text-muted-foreground hover:text-foreground p-1 transition-colors cursor-pointer shrink-0"
              aria-label={showKey ? '隱藏' : '顯示'}
            >
              {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
        </div>

        {/* 4. 模型選擇（支援從 API 拉取最新模型列表 + 手動輸入切換） */}
        <div className="usage-row gap-3">
          <span className="text-sm font-normal text-foreground shrink-0">
            {t('settings.aiModel', '視覺模型')}
          </span>
          <div className="flex items-center gap-1.5 min-w-0">
            {isCustomModelInput || (isCustomProvider && !fetchedModels[cacheKey]?.length) ? (
              <input
                type="text"
                value={currentModel}
                onChange={(e) => handleModelChange(e.target.value)}
                placeholder={active.model}
                className="text-right text-sm font-mono text-foreground bg-transparent border-b border-border/80 focus:border-foreground focus:outline-hidden w-36 sm:w-44 py-0.5 min-w-0"
              />
            ) : (
              <Select
                value={currentModel || active.model}
                onValueChange={(v) => {
                  triggerHaptic('selection');
                  handleModelChange(v);
                }}
              >
                <SelectTrigger
                  size="custom"
                  className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors max-w-[160px] sm:max-w-[200px]"
                >
                  <SelectValue className="flex-none text-right truncate">
                    {currentModel || active.model}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end" className="min-w-48 max-h-64">
                  {modelOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* 手動輸入 / 清單選擇 切換按鈕 */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setIsCustomModelInput((prev) => !prev);
              }}
              title={
                isCustomModelInput
                  ? t('settings.aiSelectModel', '切換至列表選擇')
                  : t('settings.aiCustomModel', '手動輸入模型')
              }
              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-hover transition-colors cursor-pointer shrink-0"
              aria-label={
                isCustomModelInput
                  ? t('settings.aiSelectModel', '切換至列表選擇')
                  : t('settings.aiCustomModel', '手動輸入模型')
              }
            >
              {isCustomModelInput ? <List className="size-3.5" /> : <Pencil className="size-3.5" />}
            </button>

            {/* 從 API 獲取最新模型清單 */}
            <button
              type="button"
              disabled={!canTestOrFetch || isFetchingModels}
              onClick={handleFetchModels}
              title={t('settings.aiFetchModels', '獲取最新模型')}
              className={cn(
                'p-1 rounded transition-colors shrink-0',
                canTestOrFetch && !isFetchingModels
                  ? 'text-muted-foreground hover:text-foreground hover:bg-hover cursor-pointer'
                  : 'text-muted-foreground/30 cursor-not-allowed'
              )}
              aria-label={t('settings.aiFetchModels', '獲取最新模型')}
            >
              <RefreshCw className={cn('size-3.5', isFetchingModels && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* 5. 測試連線與連線狀態反饋 */}
        <div className="usage-row gap-3">
          <div className="min-w-0 flex-1 flex items-center gap-2 text-xs font-mono">
            {testResult ? (
              testResult.success ? (
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  <span>{t('settings.aiTestSuccess', '連線成功')}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{t('settings.aiTestFailed', '連線失敗')}</span>
                </span>
              )
            ) : canTestOrFetch ? (
              <span className="text-muted-foreground">
                {t('settings.aiConfigured', '已配置密鑰')}
              </span>
            ) : (
              <span className="text-muted-foreground/60">
                {t('settings.aiNotConfigured', '尚未填寫密鑰')}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={!canTestOrFetch || isTesting}
            onClick={handleTest}
            className={cn(
              'min-h-8 px-3 py-1.5 rounded-md text-xs font-mono font-medium border border-border transition-colors flex items-center justify-center gap-1.5 select-none shrink-0 whitespace-nowrap',
              canTestOrFetch && !isTesting
                ? 'bg-muted/40 text-foreground hover:bg-hover active:scale-95 cursor-pointer'
                : 'opacity-40 cursor-not-allowed'
            )}
          >
            {isTesting && <Loader2 className="size-3.5 animate-spin shrink-0" />}
            <span>
              {isTesting
                ? t('settings.aiTesting', '測試中...')
                : t('settings.aiTestConnection', '測試連線')}
            </span>
          </button>
        </div>

        {/* 5.5 錯誤詳細解析資訊（獨立列完整顯示，不擠壓操作按鈕） */}
        {testResult && !testResult.success && testResult.message && (
          <div className="px-4 py-2.5 bg-destructive/5 text-[11px] font-mono text-destructive leading-relaxed break-words">
            {testResult.message}
          </div>
        )}

        {/* 6. 隱私與安全說明 */}
        <div className="px-4 py-3 bg-muted/20 text-[11px] text-muted-foreground font-mono leading-relaxed">
          {t(
            'settings.aiPrivacyNotice',
            '所有 API Key 均以純本機方式儲存在瀏覽器中，不經由任何官方伺服器轉發。'
          )}
        </div>
      </div>
    </section>
  );
}
