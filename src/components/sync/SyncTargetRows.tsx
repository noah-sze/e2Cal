import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ensureDropboxAccountProfile } from '@/services/sync/dropboxAuth';
import type { SyncChannelScope, SyncProviderId } from '@/services/sync/syncAdapter';
import { getSyncTargetDetails, type SyncTargetDetail } from '@/services/sync/syncRouter';

export interface SyncTargetRowsProps {
  details?: SyncTargetDetail[];
  providerId?: SyncProviderId | null;
  scope?: SyncChannelScope;
}

const FIELD_LABEL_KEYS: Record<SyncTargetDetail['field'], string> = {
  account: 'syncStatus.dropboxAccountLabel',
  serverUrl: 'syncStatus.webdav.urlLabel',
  bucket: 'syncStatus.s3.bucketLabel',
  endpoint: 'syncStatus.s3.endpointDisplayLabel',
};

/**
 * 連線資訊目標明細列（依渠道類型顯示 Dropbox 帳戶郵件、WebDAV 伺服器網址、S3 Bucket 與 Endpoint）
 * 若為舊版 Dropbox Token 尚未記錄郵件，掛載時自動於背景補抓並刷新顯示。
 */
export function SyncTargetRows({ details, providerId, scope = 'primary' }: SyncTargetRowsProps) {
  const { t } = useTranslation();
  const [, setRefreshTick] = useState(0);

  useEffect(() => {
    if (details || providerId !== 'dropbox') return;
    let cancelled = false;
    void ensureDropboxAccountProfile(scope).then((updated) => {
      if (updated && !cancelled) {
        setRefreshTick((v) => v + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [details, providerId, scope]);

  const resolvedDetails = details ?? getSyncTargetDetails(providerId ?? null, scope);

  return (
    <>
      {resolvedDetails.map((item) => (
        <div key={item.field} className="h-10 px-4 flex justify-between items-center gap-3">
          <span className="text-muted-foreground shrink-0">{t(FIELD_LABEL_KEYS[item.field])}</span>
          <span className="font-mono text-2xs text-foreground truncate" title={item.value}>
            {item.value}
          </span>
        </div>
      ))}
    </>
  );
}
