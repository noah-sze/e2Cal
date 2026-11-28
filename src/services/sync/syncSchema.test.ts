import { describe, it, expect } from 'vitest';
import {
  CURRENT_SYNC_SCHEMA_VERSION,
  assertCompatibleSchemaVersion,
  assertValidArrayPayload,
  parseMonthlyLogBucketStrict,
  assertSecureTransportUrl,
  redactSyncSecrets,
} from './syncSchema';

describe('syncSchema 安全檢核與壞檔防禦', () => {
  it('assertCompatibleSchemaVersion 應放行相容版本並阻斷高於本機的遠端版本', () => {
    expect(() => assertCompatibleSchemaVersion(null)).not.toThrow();
    expect(() =>
      assertCompatibleSchemaVersion({ schemaVersion: CURRENT_SYNC_SCHEMA_VERSION })
    ).not.toThrow();
    expect(() =>
      assertCompatibleSchemaVersion({ schemaVersion: CURRENT_SYNC_SCHEMA_VERSION + 1 })
    ).toThrow(/SYNC_SCHEMA_VERSION_UNSUPPORTED/);
  });

  it('assertValidArrayPayload 應拒絕非陣列壞檔避免清空本機資料', () => {
    expect(assertValidArrayPayload([{ id: '1' }], 'foods')).toEqual([{ id: '1' }]);
    expect(() => assertValidArrayPayload(null, 'foods')).toThrow(/SYNC_INVALID_PAYLOAD/);
    expect(() => assertValidArrayPayload({ broken: true }, 'foods')).toThrow(
      /SYNC_INVALID_PAYLOAD/
    );
  });

  it('parseMonthlyLogBucketStrict 應驗證月度日誌結構並拒絕壞檔', () => {
    const valid = parseMonthlyLogBucketStrict(
      { month: '2026-11', updatedAt: '2026-11-28T00:00:00Z', dailyDietLogs: [], workoutLogs: [], bodyMetrics: [] },
      '2026-11'
    );
    expect(valid.month).toBe('2026-11');

    expect(() => parseMonthlyLogBucketStrict(null, '2026-11')).toThrow(/SYNC_INVALID_PAYLOAD/);
    expect(() => parseMonthlyLogBucketStrict([], '2026-11')).toThrow(/SYNC_INVALID_PAYLOAD/);
    expect(() => parseMonthlyLogBucketStrict({ foo: 'bar' }, '2026-11')).toThrow(
      /SYNC_INVALID_PAYLOAD/
    );
  });

  it('assertSecureTransportUrl 應強制公網使用 HTTPS，僅允許本機開發使用 HTTP', () => {
    expect(() => assertSecureTransportUrl('https://dav.example.com/e2cal')).not.toThrow();
    expect(() => assertSecureTransportUrl('http://localhost:8080/dav')).not.toThrow();
    expect(() => assertSecureTransportUrl('http://127.0.0.1:9000')).not.toThrow();
    expect(() => assertSecureTransportUrl('http://dav.example.com/e2cal')).toThrow(
      /INSECURE_TRANSPORT_URL/
    );
    expect(() => assertSecureTransportUrl('not-a-url')).toThrow(/INSECURE_TRANSPORT_URL/);
  });

  it('redactSyncSecrets 應遮罩錯誤訊息中的 Bearer / Basic / Token / AWS 簽章', () => {
    const raw =
      'Failed Bearer sl.B123456 and Basic dXNlcjpwYXNz access_token=abc&X-Amz-Signature=deadbeef';
    const redacted = redactSyncSecrets(raw);
    expect(redacted).not.toContain('sl.B123456');
    expect(redacted).not.toContain('dXNlcjpwYXNz');
    expect(redacted).not.toContain('=abc');
    expect(redacted).not.toContain('deadbeef');
    expect(redacted).toContain('[REDACTED]');
  });
});
