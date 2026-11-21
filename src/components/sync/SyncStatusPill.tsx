import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/haptics';
import { useNetworkStatus, checkConnectivity } from '@/hooks/useNetworkStatus';
import { useDropboxSync } from '@/hooks/useDropboxSync';
import { formatSyncErrorMessage } from '@/services/sync/syncEngine';
import { toast } from '@/components/ui/toast';
import { DropboxSyncDialog } from '@/components/settings/dialogs/DropboxSyncDialog';

export function SyncStatusPill() {
  const { t } = useTranslation();
  const isOnline = useNetworkStatus();
  const {
    isAuthenticated,
    isSyncing,
    lastSyncTime,
    lastSyncError,
    justSynced,
    connectDropbox,
    syncNow,
  } = useDropboxSync();

  const [isConnectOpen, setIsConnectOpen] = useState(false);

  type PillStatus = 'offline' | 'syncing' | 'disconnected' | 'failed' | 'synced' | 'connected';

  let status: PillStatus = 'connected';
  if (!isOnline) {
    status = 'offline';
  } else if (isSyncing) {
    status = 'syncing';
  } else if (!isAuthenticated) {
    status = 'disconnected';
  } else if (lastSyncError) {
    status = 'failed';
  } else if (justSynced) {
    status = 'synced';
  } else {
    status = 'connected';
  }

  const handleClick = async () => {
    triggerHaptic('light');
    switch (status) {
      case 'offline': {
        toast.show(t('syncStatus.reconnectingToast'));
        const online = await checkConnectivity();
        if (!online) {
          toast.show(t('syncStatus.offlineToast'));
        }
        break;
      }
      case 'syncing':
        break;
      case 'disconnected':
        setIsConnectOpen(true);
        break;
      case 'failed':
        toast.show(t('syncStatus.retryToast'));
        await syncNow();
        break;
      case 'synced':
      case 'connected':
        await syncNow();
        break;
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'offline':
        return t('syncStatus.offline');
      case 'syncing':
        return t('syncStatus.syncing');
      case 'disconnected':
        return t('syncStatus.disconnected');
      case 'failed':
        return t('syncStatus.failed');
      case 'synced':
        return t('syncStatus.synced');
      case 'connected':
        return t('syncStatus.connected');
    }
  };

  const formatTime = (isoTime: string | null) => {
    if (!isoTime) return '';
    try {
      const d = new Date(isoTime);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {
      return '';
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'offline':
        return t('syncStatus.offlineToast');
      case 'syncing':
        return t('syncStatus.syncing');
      case 'disconnected':
        return t('syncStatus.connectDialogTitle');
      case 'failed':
        return lastSyncError
          ? `${t('syncStatus.failed')}: ${formatSyncErrorMessage(lastSyncError, t)}`
          : t('syncStatus.retryAction');
      case 'synced':
      case 'connected':
        if (lastSyncTime) {
          return `${t('syncStatus.lastSyncPrefix')}: ${formatTime(lastSyncTime)} · ${t('syncStatus.syncNowAction')}`;
        }
        return t('syncStatus.syncNowAction');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'syncing'}
        title={getTitle()}
        className={cn(
          'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-mono select-none transition-all outline-none max-w-full min-w-0',
          status === 'syncing'
            ? 'cursor-not-allowed opacity-80 border-border bg-card text-foreground'
            : 'cursor-pointer active:scale-[0.97] hover:bg-hover',
          status === 'offline' && 'border-border text-muted-foreground bg-card',
          status === 'disconnected' && 'border-border text-muted-foreground bg-card hover:text-foreground',
          status === 'failed' && 'border-destructive text-destructive bg-destructive-subtle hover:opacity-90',
          (status === 'connected' || status === 'synced') && 'border-border text-muted-foreground hover:text-foreground bg-card'
        )}
      >
        {status === 'syncing' ? (
          <Loader2 className="size-3 animate-spin text-foreground shrink-0" />
        ) : status === 'offline' ? (
          <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
        ) : status === 'failed' ? (
          <span className="size-1.5 rounded-full bg-destructive shrink-0" />
        ) : status === 'disconnected' ? (
          <span className="size-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
        ) : (
          <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
        )}

        <span className="truncate">{getLabel()}</span>
      </button>

      {/* 連接 Dropbox 彈窗（全域共用元件） */}
      <DropboxSyncDialog
        open={isConnectOpen}
        onOpenChange={setIsConnectOpen}
        isAuthenticated={false}
        onConnectDropbox={() => {
          void connectDropbox();
        }}
      />
    </>
  );
}
