import { useState, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  PrecisionDialogContent,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { SectionCard } from '@/components/ui/section-card';
import type { Equipment } from '@/types';

export interface EquipmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: Equipment | null;
  onSubmit: (name: string) => Promise<void> | void;
}

export function EquipmentFormDialog({
  open,
  onOpenChange,
  equipment,
  onSubmit,
}: EquipmentFormDialogProps) {
  const { t } = useTranslation();
  const formId = useId();
  const [name, setName] = useState('');

  const isEdit = Boolean(equipment);

  useEffect(() => {
    if (open) {
      if (equipment) {
        setName(equipment.name);
      } else {
        setName('');
      }
    }
  }, [open, equipment]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    const trimmed = name.trim();
    if (!trimmed) {
      toast.show(t('common.required'));
      return;
    }

    await onSubmit(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PrecisionDialogContent
        title={isEdit ? t('common.edit') : t('common.add')}
        form={formId}
        onClose={() => onOpenChange(false)}
        overlayClassName="z-[80]"
        className="z-[80]"
        submitDisabled={!name.trim()}
      >
        <form id={formId} onSubmit={handleSubmit} className="pt-3.5 space-y-3.5">
          <SectionCard title={t('workout.basicInfo')} bodyClassName="text-sm font-sans">
            <div className="h-10 relative flex items-stretch bg-card shrink-0 rounded-b-lg focus-within:ring-1 focus-within:ring-inset focus-within:ring-foreground focus-within:z-[1] transition-shadow duration-100">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('workout.equipmentPlaceholder', '名稱')}
                aria-label={t('workout.equipmentName', '器械名稱')}
                className="w-full h-full px-4 bg-transparent text-center text-xs font-sans text-foreground font-normal focus:outline-none placeholder:text-muted-foreground/40"
                maxLength={40}
              />
            </div>
          </SectionCard>
        </form>
      </PrecisionDialogContent>
    </Dialog>
  );
}
