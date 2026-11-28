import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, PrecisionDialogContent } from '@/components/ui/dialog';
import { SyncStrategyPanel } from '@/components/sync/SyncStrategyPanel';
import type { UserBaseInfo } from '@/types';
import type { ImportStrategy } from '@/services/backup/importBackup';
import type { SyncConflictStrategy } from '@/services/sync/initialSyncManager';

export interface ImportStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  localBaseInfo: UserBaseInfo | null;
  backupBaseInfo: UserBaseInfo | null;
  localCount?: number;
  backupCount?: number;
  onConfirm: (strategy: ImportStrategy) => Promise<void>;
}

export function ImportStrategyModal({
  isOpen,
  onClose,
  localBaseInfo,
  backupBaseInfo,
  localCount,
  backupCount,
  onConfirm,
}: ImportStrategyModalProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsSubmitting(false);
  }, [isOpen]);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleConfirm = async (strategy: SyncConflictStrategy) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm(strategy === 'merge' ? 'merge' : 'overwrite');
      onClose();
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <PrecisionDialogContent
        title={t('settings.importStrategyModalTitle', '匯入方式')}
        onClose={handleClose}
        cancelDisabled={isSubmitting}
        overlayClassName="z-[70]"
        className="z-[70]"
        initialFocus={false}
      >
        <div className="pt-3.5 space-y-3 font-mono text-xs select-none">
          <SyncStrategyPanel
            localBaseInfo={localBaseInfo}
            remoteBaseInfo={backupBaseInfo}
            localCount={localCount}
            remoteCount={backupCount}
            remoteColumnLabel={t('settings.backup', '備份')}
            includeOverwriteRemote={false}
            isSubmitting={isSubmitting}
            onConfirm={handleConfirm}
          />
        </div>
      </PrecisionDialogContent>
    </Dialog>
  );
}
