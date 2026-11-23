import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AISettingsCard } from '@/components/settings/AISettingsCard';
import { AIProviderManagerDialog } from '@/components/settings/AIProviderManagerDialog';
import { AIProviderDialog } from '@/components/settings/AIProviderDialog';
import { ExternalAIAssistant } from '@/components/ai/ExternalAIAssistant';
import { QuickPlaceholderDialog } from '@/components/diet/QuickPlaceholderDialog';
import { FoodFormDialog } from '@/components/food/FoodFormDialog';
import { useAISettings, resolveActiveEndpoint } from '@/hooks/useAISettings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import type { AIProviderProfile, MealEstimateResult, NutritionLabelParseResult } from '@/types/ai';

type RequestMode = 'mock-success' | 'mock-error' | 'live';

export function AITab() {
  const { t } = useTranslation();
  const {
    settings,
    profiles,
    activeProfile,
    setActiveProfile,
    addProfile,
    updateProfile,
    deleteProfile,
    isConfigured,
  } = useAISettings();
  const active = resolveActiveEndpoint(settings);

  const [requestMode, setRequestMode] = useState<RequestMode>('mock-success');
  const [sandboxMode, setSandboxMode] = useState<'meal' | 'foodLabel'>('meal');
  const [lastInjectedPayload, setLastInjectedPayload] = useState<
    MealEstimateResult | NutritionLabelParseResult | null
  >(null);

  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [isFoodOpen, setIsFoodOpen] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [isProviderOpen, setIsProviderOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AIProviderProfile | null>(null);

  const isMock = requestMode !== 'live';
  const mockScenario: 'success' | 'error' = requestMode === 'mock-error' ? 'error' : 'success';

  return (
    <div className="space-y-8">
      {/* 1. 當前生效端點遙測與模擬切換 */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">AI Endpoint & Simulation</h2>
            <p className="text-xs text-muted-foreground font-mono">
              切換模擬或真實請求模式，無需真實 API Key 即可直接模擬完整交互流
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={requestMode === 'mock-success' ? 'default' : 'outline'}
              onClick={() => setRequestMode('mock-success')}
              className="h-7 text-xs font-mono"
            >
              模擬成功
            </Button>
            <Button
              size="sm"
              variant={requestMode === 'mock-error' ? 'destructive' : 'outline'}
              onClick={() => setRequestMode('mock-error')}
              className="h-7 text-xs font-mono"
            >
              模擬 503 失敗
            </Button>
            <Button
              size="sm"
              variant={requestMode === 'live' ? 'default' : 'outline'}
              onClick={() => setRequestMode('live')}
              className="h-7 text-xs font-mono"
            >
              真實 API
            </Button>
          </div>
        </div>

        <div className="border border-border rounded-lg bg-card p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
          <div>
            <div className="text-muted-foreground text-[11px]">KEY STATUS</div>
            <div className="mt-0.5">
              <Badge variant={isConfigured ? 'default' : 'outline'} className="font-mono text-[10px]">
                {isConfigured ? 'CONFIGURED' : 'EMPTY'}
              </Badge>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-[11px]">PROVIDER</div>
            <div className="font-medium mt-0.5 truncate">{activeProfile?.name ?? '-'}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[11px]">PROTOCOL</div>
            <div className="font-medium mt-0.5">{active.protocol}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[11px]">MODEL</div>
            <div className="font-medium mt-0.5 truncate">{active.model}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[11px]">BASE URL</div>
            <div className="font-medium mt-0.5 truncate" title={active.baseUrl}>
              {active.baseUrl}
            </div>
          </div>
        </div>
      </section>

      {/* 2. 外部 AI 助手組件直接沙盒 */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">ExternalAIAssistant Sandbox (E1)</h2>
            <p className="text-xs text-muted-foreground font-mono">
              點擊膠囊展開，可輸入文字或掛圖後送出（模擬延遲 1.1s 呈現等高進度條與拆解注入）
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={sandboxMode === 'meal' ? 'default' : 'outline'}
              onClick={() => {
                setSandboxMode('meal');
                setLastInjectedPayload(null);
              }}
              className="h-7 text-xs font-mono"
            >
              mode: meal
            </Button>
            <Button
              size="sm"
              variant={sandboxMode === 'foodLabel' ? 'default' : 'outline'}
              onClick={() => {
                setSandboxMode('foodLabel');
                setLastInjectedPayload(null);
              }}
              className="h-7 text-xs font-mono"
            >
              mode: foodLabel
            </Button>
          </div>
        </div>

        <div className="border border-border rounded-lg bg-muted/20 p-6 flex flex-col items-center gap-4">
          <div className="w-[320px] max-w-full">
            <ExternalAIAssistant
              mode={sandboxMode}
              dialogOpen={true}
              mockMode={isMock}
              mockScenario={mockScenario}
              onInjectMeal={(res) => setLastInjectedPayload(res)}
              onInjectFoodLabel={(res) => setLastInjectedPayload(res)}
            />
          </div>

          {lastInjectedPayload && (
            <div className="w-full border border-border rounded-lg bg-card p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span>LAST INJECTED PAYLOAD</span>
                <button
                  type="button"
                  onClick={() => setLastInjectedPayload(null)}
                  className="hover:text-foreground cursor-pointer"
                >
                  清除
                </button>
              </div>
              <pre className="text-[11px] font-mono text-foreground overflow-x-auto leading-relaxed">
                {JSON.stringify(lastInjectedPayload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </section>

      {/* 3. 真實彈窗掛載聯測 */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Dialog Integration Test</h2>
          <p className="text-xs text-muted-foreground font-mono">
            開啟真實彈窗（同步套用目前模擬 / 真實模式），驗證不推動彈窗位置與注入回填效果
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={() => setIsQuickOpen(true)} className="font-mono text-xs">
            開啟 QuickPlaceholderDialog (快速估算)
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsFoodOpen(true)} className="font-mono text-xs">
            開啟 FoodFormDialog (新增食物)
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsManagerOpen(true)} className="font-mono text-xs">
            開啟 AIProviderManagerDialog (供應商管理)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingProfile(null);
              setIsProviderOpen(true);
            }}
            className="font-mono text-xs"
          >
            開啟 AIProviderDialog (新增供應商)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingProfile(activeProfile);
              setIsProviderOpen(true);
            }}
            className="font-mono text-xs"
          >
            開啟 AIProviderDialog (編輯預設)
          </Button>
        </div>
      </section>

      {/* 4. AI 設定面板直連 */}
      <div className="border-t border-border pt-6">
        <AISettingsCard />
      </div>

      {/* 真實 Dialog 實例 */}
      <QuickPlaceholderDialog
        open={isQuickOpen}
        onOpenChange={setIsQuickOpen}
        targetMealType="lunch"
        targetDate="2026-11-22"
        aiMockMode={isMock}
        aiMockScenario={mockScenario}
        onConfirm={async (data) => {
          setLastInjectedPayload(data as unknown as MealEstimateResult);
        }}
      />

      <FoodFormDialog
        open={isFoodOpen}
        onOpenChange={setIsFoodOpen}
        aiMockMode={isMock}
        aiMockScenario={mockScenario}
        onSubmit={async (data) => {
          setLastInjectedPayload(data as unknown as NutritionLabelParseResult);
        }}
      />

      <AIProviderManagerDialog
        open={isManagerOpen}
        onOpenChange={setIsManagerOpen}
        profiles={profiles}
        activeProfileId={activeProfile?.id ?? ''}
        onSelectDefault={setActiveProfile}
        onAdd={() => {
          setEditingProfile(null);
          setIsProviderOpen(true);
        }}
        onEdit={(p) => {
          setEditingProfile(p);
          setIsProviderOpen(true);
        }}
      />

      <AIProviderDialog
        open={isProviderOpen}
        onOpenChange={setIsProviderOpen}
        profile={editingProfile}
        canDelete={true}
        onSave={(data) => {
          if (editingProfile) {
            updateProfile(editingProfile.id, data);
          } else {
            addProfile(data, true);
          }
          toast.show(t('common.saved', '已儲存'));
        }}
        onDelete={(id) => {
          deleteProfile(id);
          toast.show(t('common.deleted', '已刪除'));
        }}
      />
    </div>
  );
}
