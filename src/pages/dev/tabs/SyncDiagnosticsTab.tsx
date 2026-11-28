import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Trash2, Copy, Check, HardDrive, ShieldCheck, Database } from 'lucide-react';
import {
  getLocalEntityTombstones,
  setLocalEntityTombstones,
  type EntityTombstoneMap,
  type SyncTombstoneTable,
} from '@/services/db/db';
import {
  executeSync,
  getLastSyncTime,
  getCachedRevs,
  setCachedRevs,
  getPushedTimes,
  setPushedTimes,
  getSyncEngineStatus,
  type SyncEngineStatus,
} from '@/services/sync/syncEngine';
import {
  isCloudSyncConnected,
  getActiveSyncProviderId,
  isRollingBackupConnected,
  getBackupProviderId,
  getSyncEndpointSummary,
} from '@/services/sync/syncRouter';
import { getLastBackupZipTime } from '@/services/sync/rollingBackupService';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MetricValue } from '@/components/ui/metric-value';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CopySnippet } from '../components/CopySnippet';

const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const TOMBSTONE_TABLES: readonly SyncTombstoneTable[] = [
  'foods',
  'recipes',
  'exercises',
  'equipments',
  'routines',
  'workout_logs',
  'body_metrics',
];

const SYNC_LOCAL_STORAGE_KEYS = {
  lastSync: 'e2cal_dropbox_last_sync',
  cachedRevs: 'e2cal_dropbox_cached_revs',
  pushedTimes: 'e2cal_dropbox_pushed_times',
  pendingSync: 'e2cal_dropbox_pending_sync',
  forcePushFoods: 'e2cal_force_push_foods',
} as const;

interface StorageEstimateInfo {
  usageBytes: number | null;
  quotaBytes: number | null;
  persisted: boolean | null;
}

interface ServiceWorkerInfo {
  supported: boolean;
  count: number;
  scopes: string[];
  states: string[];
}

interface LocalStorageEntry {
  key: string;
  value: string;
  bytes: number;
  isAppKey: boolean;
}

function readLocalStorageEntries(): LocalStorageEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const entries: LocalStorageEntry[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    const value = window.localStorage.getItem(key) ?? '';
    entries.push({
      key,
      value,
      bytes: new Blob([key, value]).size,
      isAppKey: key.toLowerCase().includes('e2cal'),
    });
  }
  entries.sort((a, b) => {
    if (a.isAppKey !== b.isAppKey) return a.isAppKey ? -1 : 1;
    return a.key.localeCompare(b.key);
  });
  return entries;
}

function formatBytesMb(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return '-';
  return (bytes / (1024 * 1024)).toFixed(2);
}

function formatIsoTime(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return '-';
  return new Date(ts).toISOString();
}

function computeRemainingDays(deletedAt: number, now: number): string {
  const remainingMs = deletedAt + TOMBSTONE_RETENTION_MS - now;
  if (remainingMs <= 0) return '0.0';
  return (remainingMs / (24 * 60 * 60 * 1000)).toFixed(1);
}

/**
 * Developer Console tab for inspecting Dropbox sync metadata, entity tombstones,
 * browser storage quotas, service workers, and localStorage state.
 */
export function SyncDiagnosticsTab() {
  const [connected, setConnected] = useState<boolean>(() => isCloudSyncConnected());
  const [activeProvider, setActiveProvider] = useState(() => getActiveSyncProviderId());
  const [backupConnected, setBackupConnected] = useState<boolean>(() => isRollingBackupConnected());
  const [backupProvider, setBackupProvider] = useState(() => getBackupProviderId());
  const [lastBackupZipTime, setLastBackupZipTime] = useState<string | null>(() =>
    getLastBackupZipTime()
  );
  const [engineStatus, setEngineStatus] = useState<SyncEngineStatus>(() => getSyncEngineStatus());
  const [lastSyncTime, setLastSync] = useState<string | null>(() => getLastSyncTime());
  const [cachedRevs, setCachedRevsState] = useState<Record<string, string>>(() => getCachedRevs());
  const [pushedTimes, setPushedTimesState] = useState<Record<string, string>>(() => getPushedTimes());
  const [pendingSyncFlag, setPendingSyncFlag] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem(SYNC_LOCAL_STORAGE_KEYS.pendingSync) === '1'
      : false
  );
  const [forcePushFoodsFlag, setForcePushFoodsFlag] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem(SYNC_LOCAL_STORAGE_KEYS.forcePushFoods) === 'true'
      : false
  );
  const [snapshotNow, setSnapshotNow] = useState<number>(() => Date.now());
  const [showSyncJson, setShowSyncJson] = useState<boolean>(false);
  const [confirmResetSync, setConfirmResetSync] = useState<boolean>(false);

  const [tombstones, setTombstones] = useState<EntityTombstoneMap>(() => getLocalEntityTombstones());
  const [tombstoneTableFilter, setTombstoneTableFilter] = useState<string>('all');
  const [confirmClearTombstones, setConfirmClearTombstones] = useState<boolean>(false);

  const [storageInfo, setStorageInfo] = useState<StorageEstimateInfo>({
    usageBytes: null,
    quotaBytes: null,
    persisted: null,
  });
  const [swInfo, setSwInfo] = useState<ServiceWorkerInfo>({
    supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    count: 0,
    scopes: [],
    states: [],
  });

  const [lsEntries, setLsEntries] = useState<LocalStorageEntry[]>(() => readLocalStorageEntries());
  const [lsFilter, setLsFilter] = useState<string>('');
  const [expandedLsKey, setExpandedLsKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pendingDeleteLsKey, setPendingDeleteLsKey] = useState<string | null>(null);

  const refreshAsyncBrowserApis = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.storage) {
      try {
        const [estimate, persisted] = await Promise.all([
          navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve(null),
          navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(null),
        ]);
        setStorageInfo({
          usageBytes: typeof estimate?.usage === 'number' ? estimate.usage : null,
          quotaBytes: typeof estimate?.quota === 'number' ? estimate.quota : null,
          persisted: typeof persisted === 'boolean' ? persisted : null,
        });
      } catch {
        setStorageInfo({ usageBytes: null, quotaBytes: null, persisted: null });
      }
    }

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        setSwInfo({
          supported: true,
          count: regs.length,
          scopes: regs.map((r) => r.scope),
          states: regs.map((r) => {
            if (r.active) return `active (${r.active.state})`;
            if (r.waiting) return `waiting (${r.waiting.state})`;
            if (r.installing) return `installing (${r.installing.state})`;
            return 'unknown';
          }),
        });
      } catch {
        setSwInfo({ supported: true, count: 0, scopes: [], states: [] });
      }
    }
  }, []);

  const refreshDiagnostics = useCallback(async () => {
    const now = Date.now();
    setSnapshotNow(now);
    setConnected(isCloudSyncConnected());
    setActiveProvider(getActiveSyncProviderId());
    setBackupConnected(isRollingBackupConnected());
    setBackupProvider(getBackupProviderId());
    setLastBackupZipTime(getLastBackupZipTime());
    setEngineStatus(getSyncEngineStatus());
    setLastSync(getLastSyncTime());
    setCachedRevsState(getCachedRevs());
    setPushedTimesState(getPushedTimes());
    setTombstones(getLocalEntityTombstones(now));
    setLsEntries(readLocalStorageEntries());

    if (typeof window !== 'undefined' && window.localStorage) {
      setPendingSyncFlag(window.localStorage.getItem(SYNC_LOCAL_STORAGE_KEYS.pendingSync) === '1');
      setForcePushFoodsFlag(
        window.localStorage.getItem(SYNC_LOCAL_STORAGE_KEYS.forcePushFoods) === 'true'
      );
    }

    await refreshAsyncBrowserApis();
  }, [refreshAsyncBrowserApis]);

  useEffect(() => {
    let active = true;
    const loadBrowserApis = async () => {
      if (typeof navigator !== 'undefined' && navigator.storage) {
        try {
          const [estimate, persisted] = await Promise.all([
            navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve(null),
            navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(null),
          ]);
          if (active) {
            setStorageInfo({
              usageBytes: typeof estimate?.usage === 'number' ? estimate.usage : null,
              quotaBytes: typeof estimate?.quota === 'number' ? estimate.quota : null,
              persisted: typeof persisted === 'boolean' ? persisted : null,
            });
          }
        } catch {
          if (active) setStorageInfo({ usageBytes: null, quotaBytes: null, persisted: null });
        }
      }

      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          if (active) {
            setSwInfo({
              supported: true,
              count: regs.length,
              scopes: regs.map((r) => r.scope),
              states: regs.map((r) => {
                if (r.active) return `active (${r.active.state})`;
                if (r.waiting) return `waiting (${r.waiting.state})`;
                if (r.installing) return `installing (${r.installing.state})`;
                return 'unknown';
              }),
            });
          }
        } catch {
          if (active) setSwInfo({ supported: true, count: 0, scopes: [], states: [] });
        }
      }
    };
    void loadBrowserApis();
    return () => {
      active = false;
    };
  }, []);

  const handleResetSyncCache = () => {
    if (!confirmResetSync) {
      setConfirmResetSync(true);
      return;
    }
    setCachedRevs({});
    setPushedTimes({});
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(SYNC_LOCAL_STORAGE_KEYS.lastSync);
      window.localStorage.removeItem(SYNC_LOCAL_STORAGE_KEYS.pendingSync);
      window.localStorage.removeItem(SYNC_LOCAL_STORAGE_KEYS.forcePushFoods);
    }
    setConfirmResetSync(false);
    void refreshDiagnostics();
  };

  const handlePruneExpiredTombstones = () => {
    const cleaned = getLocalEntityTombstones(Date.now());
    setLocalEntityTombstones(cleaned);
    setTombstones(cleaned);
    setLsEntries(readLocalStorageEntries());
  };

  const handleClearTombstones = () => {
    if (!confirmClearTombstones) {
      setConfirmClearTombstones(true);
      return;
    }
    setLocalEntityTombstones({});
    setTombstones({});
    setConfirmClearTombstones(false);
    setLsEntries(readLocalStorageEntries());
  };

  const handleCopyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // Clipboard unavailable in restricted context
    }
  };

  const handleDeleteLocalStorageKey = (key: string) => {
    if (pendingDeleteLsKey !== key) {
      setPendingDeleteLsKey(key);
      return;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
    setPendingDeleteLsKey(null);
    if (expandedLsKey === key) setExpandedLsKey(null);
    void refreshDiagnostics();
  };

  const syncJsonPayload = useMemo(
    () =>
      JSON.stringify(
        {
          connected,
          activeProvider,
          primaryTarget: connected ? getSyncEndpointSummary(activeProvider, 'primary') : null,
          backupConnected,
          backupProvider,
          backupTarget: backupConnected ? getSyncEndpointSummary(backupProvider, 'backup') : null,
          lastBackupZipTime,
          engineStatus,
          lastSyncTime,
          pendingSyncFlag,
          forcePushFoodsFlag,
          cachedRevsCount: Object.keys(cachedRevs).length,
          pushedTimesCount: Object.keys(pushedTimes).length,
          cachedRevs,
          pushedTimes,
        },
        null,
        2
      ),
    [
      connected,
      activeProvider,
      backupConnected,
      backupProvider,
      lastBackupZipTime,
      engineStatus,
      lastSyncTime,
      pendingSyncFlag,
      forcePushFoodsFlag,
      cachedRevs,
      pushedTimes,
    ]
  );

  const tombstoneRows = useMemo(() => {
    const rows: Array<{
      table: SyncTombstoneTable;
      id: string;
      deletedAt: number;
      remainingDays: string;
    }> = [];
    for (const table of TOMBSTONE_TABLES) {
      if (tombstoneTableFilter !== 'all' && tombstoneTableFilter !== table) continue;
      const map = tombstones[table] ?? {};
      for (const [id, ts] of Object.entries(map)) {
        rows.push({
          table,
          id,
          deletedAt: ts,
          remainingDays: computeRemainingDays(ts, snapshotNow),
        });
      }
    }
    rows.sort((a, b) => b.deletedAt - a.deletedAt);
    return rows;
  }, [tombstones, tombstoneTableFilter, snapshotNow]);

  const totalTombstoneCount = useMemo(
    () =>
      TOMBSTONE_TABLES.reduce(
        (sum, tbl) => sum + Object.keys(tombstones[tbl] ?? {}).length,
        0
      ),
    [tombstones]
  );

  const filteredLsEntries = useMemo(() => {
    const q = lsFilter.trim().toLowerCase();
    if (!q) return lsEntries;
    return lsEntries.filter(
      (entry) => entry.key.toLowerCase().includes(q) || entry.value.toLowerCase().includes(q)
    );
  }, [lsEntries, lsFilter]);

  const usagePercent = useMemo(() => {
    if (!storageInfo.usageBytes || !storageInfo.quotaBytes || storageInfo.quotaBytes <= 0) {
      return '-';
    }
    return ((storageInfo.usageBytes / storageInfo.quotaBytes) * 100).toFixed(2);
  }, [storageInfo]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-border rounded-lg bg-card p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground">Sync & Storage Diagnostics</h2>
            <Badge variant={connected ? 'default' : 'outline'}>
              {connected ? `Sync: ${activeProvider.toUpperCase()}` : 'Sync Disconnected'}
            </Badge>
            <Badge variant={backupConnected ? 'default' : 'outline'}>
              {backupConnected
                ? `Backup: ${(backupProvider ?? 'dropbox').toUpperCase()}`
                : 'Backup Off'}
            </Badge>
            {engineStatus.isSyncing && <Badge variant="secondary">Syncing</Badge>}
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            lastSync: {lastSyncTime ?? '-'} · lastZip: {lastBackupZipTime ?? '-'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refreshDiagnostics()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* 1. Dropbox Sync State Panel */}
      <section className="border border-border rounded-lg bg-card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground">
              Cloud Sync &amp; Backup State
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSyncJson((prev) => !prev)}
            >
              {showSyncJson ? 'Hide JSON' : 'Inspect JSON'}
            </Button>
            {connected && (
              <Button
                variant="outline"
                size="sm"
                disabled={engineStatus.isSyncing}
                onClick={async () => {
                  const res = await executeSync('overwrite_remote');
                  toast.show(res.success ? 'Full Push OK' : res.error || 'Full Push Failed');
                  await refreshDiagnostics();
                }}
              >
                Force Push (overwrite_remote)
              </Button>
            )}
            {confirmResetSync ? (
              <div className="flex items-center gap-1.5">
                <Button variant="destructive" size="sm" onClick={handleResetSyncCache}>
                  Confirm Reset
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmResetSync(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={handleResetSyncCache}>
                Reset Sync Cache
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border border-border rounded-md bg-background p-3 space-y-1">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground">Cached Revs</div>
            <div className="text-base font-semibold">
              <MetricValue value={Object.keys(cachedRevs).length} unit="paths" />
            </div>
          </div>
          <div className="border border-border rounded-md bg-background p-3 space-y-1">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground">Pushed Buckets</div>
            <div className="text-base font-semibold">
              <MetricValue value={Object.keys(pushedTimes).length} unit="keys" />
            </div>
          </div>
          <div className="border border-border rounded-md bg-background p-3 space-y-1">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground">Pending Auto Sync</div>
            <div className="text-xs font-mono text-foreground pt-1">
              {pendingSyncFlag ? 'true (1)' : 'false'}
            </div>
          </div>
          <div className="border border-border rounded-md bg-background p-3 space-y-1">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground">
              Force Push Foods
            </div>
            <div className="text-xs font-mono text-foreground pt-1">
              {forcePushFoodsFlag ? 'true' : 'false'}
            </div>
          </div>
        </div>

        {engineStatus.lastSyncError && (
          <div className="border border-destructive rounded-md bg-background p-3 text-xs font-mono text-destructive">
            lastSyncError: {engineStatus.lastSyncError}
          </div>
        )}

        {showSyncJson && (
          <div className="space-y-2">
            <div className="flex justify-end">
              <CopySnippet value={syncJsonPayload} variant="badge">
                Copy Sync JSON
              </CopySnippet>
            </div>
            <pre className="border border-border rounded-md bg-muted p-3 text-3xs font-mono text-foreground overflow-x-auto max-h-64">
              {syncJsonPayload}
            </pre>
          </div>
        )}
      </section>

      {/* 2. Entity Tombstone Inspector */}
      <section className="border border-border rounded-lg bg-card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground">
              Entity Tombstone Inspector
            </h3>
            <Badge variant="secondary">
              <MetricValue value={totalTombstoneCount} unit="total" />
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={tombstoneTableFilter}
              onValueChange={(val) => {
                if (val) setTombstoneTableFilter(val);
              }}
            >
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Filter table" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tables</SelectItem>
                {TOMBSTONE_TABLES.map((tbl) => (
                  <SelectItem key={tbl} value={tbl}>
                    {tbl} ({Object.keys(tombstones[tbl] ?? {}).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handlePruneExpiredTombstones}>
              Prune Expired
            </Button>
            {confirmClearTombstones ? (
              <div className="flex items-center gap-1.5">
                <Button variant="destructive" size="sm" onClick={handleClearTombstones}>
                  Confirm Clear
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmClearTombstones(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={handleClearTombstones}>
                Clear Tombstones
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {TOMBSTONE_TABLES.map((tbl) => (
            <div key={tbl} className="border border-border rounded-md bg-background p-2.5 space-y-0.5">
              <div className="text-3xs font-mono text-muted-foreground truncate">{tbl}</div>
              <div className="text-sm font-semibold">
                <MetricValue value={Object.keys(tombstones[tbl] ?? {}).length} />
              </div>
            </div>
          ))}
        </div>

        {tombstoneRows.length === 0 ? (
          <div className="border border-border rounded-md bg-background p-4 text-xs text-muted-foreground text-center">
            No active tombstones
          </div>
        ) : (
          <div className="border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto bg-background">
            {tombstoneRows.map((row) => (
              <div
                key={`${row.table}:${row.id}`}
                className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="font-mono text-3xs shrink-0">
                    {row.table}
                  </Badge>
                  <span className="font-mono text-foreground break-all">{row.id}</span>
                </div>
                <div className="flex items-center gap-3 text-3xs text-muted-foreground shrink-0">
                  <span className="font-mono">{formatIsoTime(row.deletedAt)}</span>
                  <MetricValue value={row.remainingDays} unit="d left" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Browser Storage, PWA & localStorage Inspector */}
      <section className="border border-border rounded-lg bg-card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground">
              Browser Storage & PWA
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>
              Persisted:{' '}
              <code className="font-mono text-foreground">
                {storageInfo.persisted === null ? '-' : String(storageInfo.persisted)}
              </code>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border border-border rounded-md bg-background p-3 space-y-1">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground">Storage Usage</div>
            <div className="text-base font-semibold">
              <MetricValue value={formatBytesMb(storageInfo.usageBytes)} unit="MB" />
            </div>
          </div>
          <div className="border border-border rounded-md bg-background p-3 space-y-1">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground">Storage Quota</div>
            <div className="text-base font-semibold">
              <MetricValue value={formatBytesMb(storageInfo.quotaBytes)} unit="MB" />
            </div>
          </div>
          <div className="border border-border rounded-md bg-background p-3 space-y-1">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground">Quota Used</div>
            <div className="text-base font-semibold">
              <MetricValue value={usagePercent} unit="%" />
            </div>
          </div>
          <div className="border border-border rounded-md bg-background p-3 space-y-1">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground">Service Workers</div>
            <div className="text-base font-semibold">
              <MetricValue value={swInfo.supported ? swInfo.count : '-'} unit="reg" />
            </div>
          </div>
        </div>

        {swInfo.count > 0 && (
          <div className="border border-border rounded-md bg-background divide-y divide-border">
            {swInfo.scopes.map((scope, idx) => (
              <div
                key={scope}
                className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
              >
                <span className="text-foreground break-all">{scope}</span>
                <Badge variant="outline">{swInfo.states[idx]}</Badge>
              </div>
            ))}
          </div>
        )}

        {/* localStorage Inspector */}
        <div className="pt-2 space-y-3 border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-foreground">
                localStorage Inspector
              </span>
              <Badge variant="secondary">
                <MetricValue value={filteredLsEntries.length} unit="keys" />
              </Badge>
            </div>
            <Input
              value={lsFilter}
              onChange={(e) => setLsFilter(e.target.value)}
              placeholder="Filter keys or values..."
              className="w-full sm:w-64 h-8 text-xs font-mono"
            />
          </div>

          {filteredLsEntries.length === 0 ? (
            <div className="border border-border rounded-md bg-background p-4 text-xs text-muted-foreground text-center">
              No matching localStorage keys
            </div>
          ) : (
            <div className="border border-border rounded-md divide-y divide-border bg-background max-h-80 overflow-y-auto">
              {filteredLsEntries.map((entry) => {
                const isExpanded = expandedLsKey === entry.key;
                const isConfirmingDelete = pendingDeleteLsKey === entry.key;
                return (
                  <div key={entry.key} className="p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {entry.isAppKey && (
                          <Badge variant="default" className="text-3xs shrink-0">
                            e2Cal
                          </Badge>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedLsKey(isExpanded ? null : entry.key)}
                          className="text-xs font-mono font-medium text-foreground hover:underline text-left break-all"
                        >
                          {entry.key}
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-3xs text-muted-foreground mr-1">
                          <MetricValue value={entry.bytes} unit="B" />
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => void handleCopyText(entry.key, entry.value)}
                          title="Copy value"
                        >
                          {copiedKey === entry.key ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 px-2 text-3xs"
                              onClick={() => handleDeleteLocalStorageKey(entry.key)}
                            >
                              Delete
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-3xs"
                              onClick={() => setPendingDeleteLsKey(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleDeleteLocalStorageKey(entry.key)}
                            title="Delete key"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {isExpanded && (
                      <pre className="border border-border rounded bg-muted p-2.5 text-3xs font-mono text-foreground overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                        {entry.value}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
