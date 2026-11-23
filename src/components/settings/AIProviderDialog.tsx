import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, RefreshCw, Pencil, List, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Dialog, PrecisionDialogContent } from '@/components/ui/dialog';
import { SectionCard } from '@/components/ui/section-card';
import { HoldToDeleteButton } from '@/components/ui/HoldToDeleteButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  OFFICIAL_ENDPOINTS,
  OFFICIAL_PROVIDER_PRESETS,
} from '@/hooks/useAISettings';
import { testAIConnection, fetchAvailableModels, type AIModelOption } from '@/services/ai/aiClient';
import { triggerHaptic } from '@/lib/haptics';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { AIProtocol, AIProvider, AIProviderProfile, AISettings } from '@/types/ai';

const PROTOCOL_LABELS: Record<AIProtocol, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
};

interface AIProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: AIProviderProfile | null;
  canDelete: boolean;
  onSave: (data: Omit<AIProviderProfile, 'id'>) => void;
  onDelete?: (id: string) => void;
  overlayClassName?: string;
  dialogClassName?: string;
}

export function AIProviderDialog({
  open,
  onOpenChange,
  profile,
  canDelete,
  onSave,
  onDelete,
  overlayClassName = 'z-[70]',
  dialogClassName = 'z-[70]',
}: AIProviderDialogProps) {
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [protocol, setProtocol] = useState<AIProtocol>('gemini');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [showKey, setShowKey] = useState(false);

  const [fetchedModels, setFetchedModels] = useState<Record<string, AIModelOption[]>>({});
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isCustomModelInput, setIsCustomModelInput] = useState(true);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    if (profile) {
      const resolvedProvider: AIProvider =
        profile.provider ?? (profile.baseUrl.trim() ? 'custom' : profile.protocol);
      setName(profile.name);
      setProvider(resolvedProvider);
      setProtocol(profile.protocol);
      setBaseUrl(profile.baseUrl);
      setApiKey(profile.apiKey);
      setModel(profile.model || '');
    } else {
      setName('');
      setProvider('gemini');
      setProtocol('gemini');
      setBaseUrl('');
      setApiKey('');
      setModel('');
    }
    setShowKey(false);
    setIsCustomModelInput(true);
    setTestResult(null);
  }, [open, profile]);

  const isCustomProvider = provider === 'custom';
  const effectiveProtocol: AIProtocol = isCustomProvider
    ? protocol
    : OFFICIAL_PROVIDER_PRESETS[provider].protocol;

  const buildTempSettings = (): AISettings => ({
    provider,
    profiles: [
      {
        id: profile?.id || 'temp',
        name: name.trim() || 'temp',
        provider,
        protocol: effectiveProtocol,
        baseUrl: isCustomProvider ? baseUrl.trim() : '',
        apiKey: apiKey.trim(),
        model: model.trim(),
      },
    ],
    activeProfileId: profile?.id || 'temp',
    geminiApiKey: '',
    geminiModel: '',
    openaiApiKey: '',
    openaiModel: '',
    anthropicApiKey: '',
    anthropicModel: '',
    customProtocol: effectiveProtocol,
    customBaseUrl: isCustomProvider ? baseUrl.trim() : '',
    customApiKey: apiKey.trim(),
    customModel: model.trim(),
  });

  const canTestOrFetch = isCustomProvider
    ? Boolean(apiKey.trim() && baseUrl.trim())
    : Boolean(apiKey.trim());
  const cacheKey = `${effectiveProtocol}:${isCustomProvider ? baseUrl.trim() || 'official' : provider}`;
  const dynamicModels = fetchedModels[cacheKey];
  const hasFetchedModels = Boolean(dynamicModels && dynamicModels.length > 0);
  const modelOptions: AIModelOption[] = (() => {
    const baseList = dynamicModels ?? [];
    const current = model.trim();
    if (current && !baseList.some((m) => m.id === current)) {
      return [{ id: current }, ...baseList];
    }
    return baseList;
  })();

  const handleProviderChange = (val: string | null) => {
    if (!val) return;
    const nextProvider = val as AIProvider;
    triggerHaptic('selection');
    setProvider(nextProvider);
    if (nextProvider !== 'custom') {
      setProtocol(OFFICIAL_PROVIDER_PRESETS[nextProvider].protocol);
    }
    setModel('');
    setIsCustomModelInput(true);
    setTestResult(null);
  };

  const handleProtocolChange = (val: string | null) => {
    if (!val) return;
    const nextProto = val as AIProtocol;
    triggerHaptic('selection');
    setProtocol(nextProto);
    setModel('');
    setIsCustomModelInput(true);
    setTestResult(null);
  };

  const handleFetchModels = async () => {
    if (!canTestOrFetch || isFetchingModels) return;
    setIsFetchingModels(true);
    try {
      const models = await fetchAvailableModels(buildTempSettings());
      if (models.length === 0) {
        toast.show(t('settings.aiFetchModelsEmpty', '未取得可用模型'));
        return;
      }
      setFetchedModels((prev) => ({ ...prev, [cacheKey]: models }));
      setIsCustomModelInput(false);
      if (!model.trim()) {
        setModel(models[0].id);
      }
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
    if (!canTestOrFetch || isTesting) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testAIConnection(buildTempSettings());
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

  const handleSave = () => {
    const cleanName = name.trim();
    if (!cleanName) return;
    triggerHaptic('success');
    onSave({
      name: cleanName,
      provider,
      protocol: effectiveProtocol,
      baseUrl: isCustomProvider ? baseUrl.trim() : '',
      apiKey: apiKey.trim(),
      model: model.trim(),
    });
    onOpenChange(false);
  };

  const getProviderDisplayLabel = (p: AIProvider) => {
    if (p === 'custom') return t('settings.aiProviderCustomApi', '自定義 API');
    if (p === 'deepseek') return 'DeepSeek';
    return PROTOCOL_LABELS[p];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PrecisionDialogContent
        overlayClassName={overlayClassName}
        className={dialogClassName}
        title={profile ? t('common.edit', '編輯') : t('common.add', '新增')}
        onClose={() => onOpenChange(false)}
        onSubmit={handleSave}
        submitDisabled={!name.trim()}
      >
        <div className="space-y-3.5 pt-3.5 pb-0">
          {/* 段落 1: 基本資訊 (50/50 雙格首行：名稱｜供應商) */}
          <SectionCard title={t('diet.basicInfo', '基本資訊')} bodyClassName="text-xs font-sans">
            <div className="h-10 grid grid-cols-2 divide-x divide-border bg-card">
              {/* 名稱 */}
              <div
                className={cn(
                  'relative flex items-stretch min-w-0 focus-within:ring-1 focus-within:ring-inset focus-within:ring-foreground focus-within:z-[1] transition-shadow duration-100',
                  !isCustomProvider && 'rounded-bl-lg'
                )}
              >
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('settings.aiProviderName', '名稱')}
                  aria-label={t('settings.aiProviderName', '名稱')}
                  className="w-full h-full px-3 bg-transparent text-center text-xs font-mono text-foreground focus:outline-none placeholder:text-muted-foreground/40"
                />
              </div>

              {/* 供應商（膠囊選擇器） */}
              <div className="relative flex items-center justify-center min-w-0 px-2">
                <Select value={provider} onValueChange={handleProviderChange}>
                  <SelectTrigger
                    size="custom"
                    iconClassName="size-3 text-muted-foreground/60"
                    className="h-7 max-w-full px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-sans text-xs flex items-center gap-1.5 transition-colors cursor-pointer text-foreground active:scale-95"
                  >
                    <SelectValue className="flex-none text-center truncate">
                      {getProviderDisplayLabel(provider)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent
                    align="end"
                    className="min-w-44 z-[110]"
                    positionerClassName="z-[110]"
                    backdropClassName="z-[110]"
                  >
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                    <SelectItem value="custom">
                      {t('settings.aiProviderCustomApi', '自定義 API')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 僅「自定義 API」需要設定協議格式與端點網址 */}
            {isCustomProvider && (
              <>
                <div className="h-10 px-4 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">
                    {t('settings.aiProtocol', '協議格式')}
                  </span>
                  <Select value={protocol} onValueChange={handleProtocolChange}>
                    <SelectTrigger
                      size="custom"
                      iconClassName="size-3 text-muted-foreground/60"
                      className="h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-sans text-xs flex items-center gap-1.5 transition-colors cursor-pointer text-foreground active:scale-95"
                    >
                      <SelectValue className="flex-none text-right">
                        {PROTOCOL_LABELS[protocol]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      align="end"
                      className="min-w-40 z-[110]"
                      positionerClassName="z-[110]"
                      backdropClassName="z-[110]"
                    >
                      <SelectItem value="gemini">Google Gemini</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="h-10 px-4 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">
                    {t('settings.aiBaseUrl', '端點網址')}
                  </span>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => {
                      setBaseUrl(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder={OFFICIAL_ENDPOINTS[protocol]}
                    className="text-right text-xs font-mono text-foreground bg-transparent placeholder:text-muted-foreground/40 focus:outline-hidden min-w-0 flex-1"
                  />
                </div>
              </>
            )}
          </SectionCard>

          {/* 段落 2: API 憑證 */}
          <SectionCard
            title={t('settings.aiCredentials', 'API 憑證')}
            bodyClassName="text-xs font-sans"
          >
            {/* API Key */}
            <div className="h-10 px-4 flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs shrink-0">
                {t('settings.aiApiKey', 'API Key')}
              </span>
              <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder={t('settings.aiApiKeyPlaceholder', '請填入 API Key')}
                  className="text-right text-xs font-mono text-foreground bg-transparent placeholder:text-muted-foreground/40 focus:outline-hidden min-w-0 flex-1"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((prev) => !prev)}
                  className="text-muted-foreground hover:text-foreground p-0.5 cursor-pointer shrink-0"
                  aria-label={showKey ? '隱藏' : '顯示'}
                >
                  {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* 段落 3: 視覺模型（預設手動輸入，在線獲取成功後才允許切換至列表選擇；下方附測試連線） */}
          <SectionCard
            title={t('settings.aiModel', '視覺模型')}
            action={
              <div className="flex items-center gap-1">
                {hasFetchedModels && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setIsCustomModelInput((prev) => {
                        const next = !prev;
                        if (next) {
                          setModel('');
                        } else if (!model.trim() && dynamicModels?.[0]) {
                          setModel(dynamicModels[0].id);
                        }
                        return next;
                      });
                    }}
                    className="h-6 px-2.5 rounded-full border border-border/80 bg-background hover:bg-hover text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
                    aria-label={
                      isCustomModelInput
                        ? t('settings.aiSelectModel', '切換至列表選擇')
                        : t('settings.aiCustomModel', '手動輸入模型')
                    }
                  >
                    {isCustomModelInput ? (
                      <>
                        <List className="size-3" />
                        <span>{t('settings.aiListMode', '列表')}</span>
                      </>
                    ) : (
                      <>
                        <Pencil className="size-3" />
                        <span>{t('settings.aiManualMode', '手動')}</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  disabled={!canTestOrFetch || isFetchingModels}
                  onClick={handleFetchModels}
                  className={cn(
                    'size-6 rounded-full border border-border/80 bg-background flex items-center justify-center transition-colors',
                    canTestOrFetch && !isFetchingModels
                      ? 'text-muted-foreground hover:text-foreground hover:bg-hover cursor-pointer active:scale-95'
                      : 'text-muted-foreground/30 cursor-not-allowed'
                  )}
                  aria-label={t('settings.aiFetchModels', '獲取最新模型')}
                  title={t('settings.aiFetchModels', '獲取最新模型')}
                >
                  <RefreshCw className={cn('size-3', isFetchingModels && 'animate-spin')} />
                </button>
              </div>
            }
            bodyClassName="text-xs font-sans"
          >
            <div
              className={cn(
                'h-10 px-4 flex items-center justify-between gap-2',
                (!hasFetchedModels || isCustomModelInput) &&
                  'focus-within:ring-1 focus-within:ring-inset focus-within:ring-foreground transition-shadow duration-100'
              )}
            >
              {!hasFetchedModels || isCustomModelInput ? (
                <input
                  type="text"
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder={t('settings.aiCustomModelPlaceholder', '手動輸入模型名')}
                  className="w-full h-full bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none min-w-0"
                />
              ) : (
                <Select
                  value={model || dynamicModels?.[0]?.id || ''}
                  onValueChange={(v) => {
                    if (!v) return;
                    triggerHaptic('selection');
                    setModel(v);
                    setTestResult(null);
                  }}
                >
                  <SelectTrigger
                    size="custom"
                    iconClassName="size-3.5 text-muted-foreground/60 shrink-0"
                    className="w-full h-full flex items-center justify-between gap-2 font-mono text-xs cursor-pointer text-foreground"
                  >
                    <SelectValue className="flex-1 text-left truncate">
                      {model || dynamicModels?.[0]?.id || ''}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent
                    align="end"
                    className="min-w-52 max-h-60 z-[110]"
                    positionerClassName="z-[110]"
                    backdropClassName="z-[110]"
                  >
                    {modelOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 內嵌連線狀態與測試膠囊 */}
            <div className="h-10 px-4 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1 text-[11px] font-mono">
                {testResult ? (
                  testResult.success ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5 shrink-0" />
                      <span>{t('settings.aiTestSuccess', '連線成功')}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertCircle className="size-3.5 shrink-0" />
                      <span>{t('settings.aiTestFailed', '連線失敗')}</span>
                    </span>
                  )
                ) : (
                  <span className="text-muted-foreground/70">
                    {canTestOrFetch
                      ? t('settings.aiConfigured', '已配置密鑰')
                      : t('settings.aiNotConfigured', '尚未填寫密鑰')}
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={!canTestOrFetch || isTesting}
                onClick={handleTest}
                className={cn(
                  'h-7 px-3 rounded-full border border-border/80 bg-background font-mono text-xs flex items-center gap-1.5 shrink-0 transition-colors',
                  canTestOrFetch && !isTesting
                    ? 'text-foreground hover:bg-hover active:scale-95 cursor-pointer'
                    : 'text-muted-foreground/40 opacity-50 cursor-not-allowed'
                )}
              >
                {isTesting && <Loader2 className="size-3 animate-spin" />}
                <span>
                  {isTesting
                    ? t('settings.aiTesting', '測試中...')
                    : t('settings.aiTestConnection', '測試連線')}
                </span>
              </button>
            </div>

            {testResult && !testResult.success && testResult.message && (
              <div className="px-4 py-2 bg-destructive/5 text-[11px] font-mono text-destructive leading-relaxed break-words">
                {testResult.message}
              </div>
            )}
          </SectionCard>

          {/* 編輯模式下長按 0.5s 防誤觸刪除 */}
          {profile && canDelete && onDelete && (
            <HoldToDeleteButton
              onConfirm={() => {
                onDelete(profile.id);
                onOpenChange(false);
              }}
              text={t('common.delete', '刪除')}
            />
          )}
        </div>
      </PrecisionDialogContent>
    </Dialog>
  );
}
