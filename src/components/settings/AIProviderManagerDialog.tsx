import { useTranslation } from 'react-i18next';
import { Check, Pencil, Plus } from 'lucide-react';
import { Dialog, PrecisionDialogContent } from '@/components/ui/dialog';
import { SectionCard } from '@/components/ui/section-card';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { AIProtocol, AIProviderProfile } from '@/types/ai';

const PROTOCOL_SHORT: Record<AIProtocol, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
};

interface AIProviderManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: AIProviderProfile[];
  activeProfileId: string;
  onSelectDefault: (id: string) => void;
  onAdd: () => void;
  onEdit: (profile: AIProviderProfile) => void;
}

export function AIProviderManagerDialog({
  open,
  onOpenChange,
  profiles,
  activeProfileId,
  onSelectDefault,
  onAdd,
  onEdit,
}: AIProviderManagerDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PrecisionDialogContent
        title={t('settings.aiProviderManagement', '供應商管理')}
        onClose={() => onOpenChange(false)}
        rightAction={
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onAdd();
            }}
            aria-label={t('common.add', '新增')}
            title={t('common.add', '新增')}
            className="size-7 rounded-full flex items-center justify-center bg-foreground text-background hover:opacity-90 active:scale-92 transition-all cursor-pointer shrink-0"
          >
            <Plus className="size-3.5 stroke-[2.5]" />
          </button>
        }
      >
        <div className="pt-3.5">
          <SectionCard
            title={t('settings.aiSavedProviders', '已儲存')}
            action={
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {profiles.length}
              </span>
            }
            bodyClassName="max-h-[55vh] overflow-y-auto"
          >
            {profiles.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs font-mono text-muted-foreground/60">
                {t('settings.aiNoProviders', '無供應商')}
              </div>
            ) : (
              profiles.map((p) => {
                const isActive = p.id === activeProfileId;
                return (
                  <div
                    key={p.id}
                    className="min-h-12 px-4 py-2 flex items-center justify-between gap-2.5 hover:bg-hover transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        onSelectDefault(p.id);
                      }}
                      className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer"
                    >
                      <span
                        className={cn(
                          'size-4 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                          isActive
                            ? 'bg-foreground border-foreground text-background'
                            : 'border-border text-transparent'
                        )}
                      >
                        <Check className="size-2.5 stroke-[3]" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">
                          {p.name}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground truncate">
                          {PROTOCOL_SHORT[p.protocol]} · {p.model}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        onEdit(p);
                      }}
                      aria-label={t('common.edit', '編輯')}
                      className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </SectionCard>
        </div>
      </PrecisionDialogContent>
    </Dialog>
  );
}
