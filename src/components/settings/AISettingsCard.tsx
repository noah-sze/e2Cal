import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAISettings } from '@/hooks/useAISettings';
import { triggerHaptic } from '@/lib/haptics';
import { toast } from '@/components/ui/toast';
import { AIProviderManagerDialog } from './AIProviderManagerDialog';
import { AIProviderDialog } from './AIProviderDialog';
import type { AIProviderProfile } from '@/types/ai';

export function AISettingsCard() {
  const { t } = useTranslation();
  const {
    profiles,
    activeProfile,
    setActiveProfile,
    addProfile,
    updateProfile,
    deleteProfile,
  } = useAISettings();

  const [managerOpen, setManagerOpen] = useState(false);
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AIProviderProfile | null>(null);

  const handleOpenAdd = () => {
    setEditingProfile(null);
    setProviderDialogOpen(true);
  };

  const handleOpenEdit = (profile: AIProviderProfile) => {
    setEditingProfile(profile);
    setProviderDialogOpen(true);
  };

  const handleSaveProfile = (data: Omit<AIProviderProfile, 'id'>) => {
    if (editingProfile) {
      updateProfile(editingProfile.id, data);
    } else {
      addProfile(data, true);
    }
    toast.show(t('common.saved', '已儲存'));
  };

  const handleDeleteProfile = (id: string) => {
    deleteProfile(id);
    toast.show(t('common.deleted', '已刪除'));
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

      {/* 右側表格卡片：僅留「預設供應商」與「供應商管理」兩項 */}
      <div className="sm:col-span-8 border border-border rounded-lg overflow-hidden bg-card divide-y divide-border">
        {/* 1. 預設供應商 */}
        <div className="usage-row gap-3">
          <span className="text-sm font-normal text-foreground shrink-0">
            {t('settings.aiDefaultProvider', '預設供應商')}
          </span>
          <Select
            value={activeProfile?.id ?? ''}
            disabled={profiles.length === 0}
            onValueChange={(val) => {
              if (!val) return;
              triggerHaptic('selection');
              setActiveProfile(val);
            }}
          >
            <SelectTrigger
              size="custom"
              className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <SelectValue className="flex-none text-right">
                {activeProfile?.name ?? '-'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end" className="min-w-44">
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 2. 供應商管理 */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setManagerOpen(true);
          }}
          className="usage-row w-full gap-3 hover:bg-hover transition-colors cursor-pointer text-left"
        >
          <span className="text-sm font-normal text-foreground shrink-0">
            {t('settings.aiProviderManagement', '供應商管理')}
          </span>
          <span className="flex items-center gap-1 text-sm font-mono text-muted-foreground">
            <span>{profiles.length}</span>
            <ChevronRight className="size-4" />
          </span>
        </button>
      </div>

      {/* 平鋪兄弟彈窗 1：供應商管理 */}
      <AIProviderManagerDialog
        open={managerOpen}
        onOpenChange={setManagerOpen}
        profiles={profiles}
        activeProfileId={activeProfile?.id ?? ''}
        onSelectDefault={setActiveProfile}
        onAdd={handleOpenAdd}
        onEdit={handleOpenEdit}
      />

      {/* 平鋪兄弟彈窗 2：新增 / 編輯單一供應商（高層級 z-[70]） */}
      <AIProviderDialog
        open={providerDialogOpen}
        onOpenChange={setProviderDialogOpen}
        profile={editingProfile}
        canDelete={true}
        onSave={handleSaveProfile}
        onDelete={handleDeleteProfile}
      />
    </section>
  );
}
