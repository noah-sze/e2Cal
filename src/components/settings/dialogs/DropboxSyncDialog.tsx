import { useTranslation } from 'react-i18next';
import { RefreshCw, Unlink, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/section-card';
import { HoldToDeleteButton } from '@/components/ui/HoldToDeleteButton';
import {
  Dialog,
  PrecisionDialogContent,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface DropboxSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAuthenticated?: boolean;
  isSyncing?: boolean;
  lastSyncTime?: string | null;
  isOnline?: boolean;
  onConnectDropbox: () => void;
  onDisconnectDropbox?: () => void;
  onSyncNow?: (mode?: 'auto' | 'overwrite_local' | 'overwrite_remote') => Promise<unknown>;
  onOverwriteRemote?: () => Promise<unknown>;
  title?: string;
  description?: string;
  actionLabel?: string;
}

/**
 * Dropbox 連線說明與同步控制台（全域唯一真理源）
 * 統一服務設定頁（已連線／未連線管理）、頂部 SyncStatusPill 與落地頁「雲端導入」。
 */
export function DropboxSyncDialog({
  open,
  onOpenChange,
  isAuthenticated = false,
  isSyncing = false,
  lastSyncTime,
  isOnline = true,
  onConnectDropbox,
  onDisconnectDropbox,
  onSyncNow,
  onOverwriteRemote,
  title,
  description,
  actionLabel,
}: DropboxSyncDialogProps) {
  const { t } = useTranslation();

  const resolvedTitle =
    title ??
    (isAuthenticated
      ? t('settings.dropboxSyncModalTitle', 'Dropbox 同步')
      : t('syncStatus.connectDialogTitle', 'Dropbox 同步'));
  const resolvedDescription = description ?? t('syncStatus.connectDialogDesc');
  const resolvedActionLabel = actionLabel ?? t('syncStatus.connectAction', '連線');

  const handleConnect = () => {
    onOpenChange(false);
    onConnectDropbox();
  };

  const formatTime = (isoTime: string | null | undefined) => {
    if (!isoTime) return t('settings.never', '從未');
    try {
      const d = new Date(isoTime);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {
      return t('settings.never', '從未');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PrecisionDialogContent
        title={resolvedTitle}
        onClose={() => onOpenChange(false)}
        overlayClassName="z-[70]"
        className="z-[70]"
      >
        <div className="pt-3.5 space-y-3.5 text-xs select-none">
          {/* 1. 連線資訊規格卡 (對齊 SectionCard 標準) */}
          <SectionCard
            title={t('settings.connectionInfo', '連線資訊')}
            bodyClassName="text-xs font-sans"
          >
            {/* 服務 / 連線狀態 */}
            {!isAuthenticated && (
              <div className="h-10 px-4 flex justify-between items-center">
                <span className="text-muted-foreground">{t('syncStatus.service', '服務')}</span>
                <span className="text-foreground font-medium">Dropbox</span>
              </div>
            )}

            {/* 連線狀態 */}
            <div className="h-10 px-4 flex justify-between items-center">
              <span className="text-muted-foreground">{t('settings.status', '狀態')}</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'size-1.5 rounded-full shrink-0',
                    isAuthenticated && isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/60'
                  )}
                />
                <span
                  className={
                    isAuthenticated ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }
                >
                  {!isAuthenticated
                    ? t('settings.disconnected', '未連線')
                    : isOnline
                      ? t('settings.connected', '已連線')
                      : t('settings.offline', '已離線')}
                </span>
              </div>
            </div>

            {/* 上次同步（已連線時顯示） */}
            {isAuthenticated && (
              <div className="h-10 px-4 flex justify-between items-center">
                <span className="text-muted-foreground">
                  {t('settings.lastSync', '上次同步')}
                </span>
                <span className="font-mono tabular-nums text-foreground">
                  {formatTime(lastSyncTime)}
                </span>
              </div>
            )}
          </SectionCard>

          {/* 未連線時顯示客觀授權說明 */}
          {!isAuthenticated && resolvedDescription && (
            <p className="text-xs text-muted-foreground leading-relaxed px-0.5 font-sans">
              {resolvedDescription}
            </p>
          )}

          {/* 2. 動作按鈕 */}
          <div className="space-y-2">
            {!isAuthenticated ? (
              <Button
                type="button"
                className="w-full h-9 text-xs font-semibold rounded-lg"
                onClick={handleConnect}
              >
                <span>{resolvedActionLabel}</span>
              </Button>
            ) : (
              <div className="space-y-2">
                {onSyncNow && (
                  <Button
                    type="button"
                    className="w-full h-9 text-xs font-semibold rounded-lg"
                    onClick={() => onSyncNow()}
                    disabled={isSyncing || !isOnline}
                  >
                    <RefreshCw
                      className={cn('size-3.5 mr-1.5', isSyncing && 'animate-spin')}
                    />
                    <span>
                      {isSyncing
                        ? t('settings.syncing', '同步中…')
                        : !isOnline
                          ? t('settings.offlineCannotSync', '離線無法同步')
                          : t('settings.syncNow', '立即同步')}
                    </span>
                  </Button>
                )}

                {(onOverwriteRemote || onSyncNow) && (
                  <HoldToDeleteButton
                    variant="destructive"
                    disabled={isSyncing || !isOnline}
                    text={t('settings.holdToOverwriteRemote', '長按全量覆寫雲端')}
                    icon={<UploadCloud className="size-3.5 shrink-0" strokeWidth={1.8} />}
                    hintText={t('initialSync.holdHint', '長按 0.5 秒確認')}
                    onConfirm={() => {
                      void (onOverwriteRemote
                        ? onOverwriteRemote()
                        : onSyncNow?.('overwrite_remote'));
                    }}
                    className="rounded-lg"
                  />
                )}

                {onDisconnectDropbox && (
                  <HoldToDeleteButton
                    variant="destructive"
                    disabled={isSyncing}
                    text={t('settings.holdToDisconnect', '長按中斷連線')}
                    icon={<Unlink className="size-3.5 shrink-0" strokeWidth={1.8} />}
                    hintText={t('initialSync.holdHint', '長按 0.5 秒確認')}
                    onConfirm={onDisconnectDropbox}
                    className="rounded-lg"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </PrecisionDialogContent>
    </Dialog>
  );
}
