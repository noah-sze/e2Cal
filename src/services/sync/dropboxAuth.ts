/**
 * Dropbox OAuth 2.0 with PKCE (Proof Key for Code Exchange)
 * Client-side authentication without exposing client secret.
 */
import { APP_ROUTES } from '@/utils/navigation';
import type { SyncChannelScope } from './syncAdapter';

const SESSION_VERIFIER_KEY = 'e2cal_dropbox_code_verifier';
const SESSION_STATE_KEY = 'e2cal_dropbox_oauth_state';
const SESSION_OAUTH_MODE_KEY = 'e2cal_dropbox_oauth_mode';
const SESSION_OAUTH_SCOPE_KEY = 'e2cal_dropbox_oauth_scope';
const OAUTH_STATE_PREFIX = 'dropbox_';
const STORAGE_TOKENS_KEY = 'e2cal_dropbox_tokens';

function getTokensStorageKey(scope: SyncChannelScope = 'primary'): string {
  return scope === 'backup' ? `${STORAGE_TOKENS_KEY}_backup` : STORAGE_TOKENS_KEY;
}

export type DropboxOAuthMode = 'sync' | 'restore';

export type DropboxOAuthCallbackResult =
  | { kind: 'code'; code: string; mode: DropboxOAuthMode; scope: SyncChannelScope }
  | { kind: 'error'; error: string; errorDescription?: string };

let pendingOAuthCallback: DropboxOAuthCallbackResult | null = null;

const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(key, value);
      }
    } catch {}
  },
  removeItem: (key: string): void => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(key);
      }
    } catch {}
  },
};

const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch {}
  },
  removeItem: (key: string): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch {}
  },
};

export interface DropboxTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  expires_at: number; // Unix timestamp in ms
  account_id?: string;
  email?: string;
  display_name?: string;
  scope?: string;
}

async function fetchDropboxAccountProfile(
  accessToken: string
): Promise<{ email?: string; display_name?: string }> {
  try {
    const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return {};
    const info = (await res.json()) as {
      email?: string;
      name?: { display_name?: string };
    };
    return {
      email: info.email?.trim() || undefined,
      display_name: info.name?.display_name?.trim() || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * 若既有已儲存的 Dropbox Token 尚未記錄 email，於背景自動補抓並回寫至本地儲存
 */
export async function ensureDropboxAccountProfile(
  scope: SyncChannelScope = 'primary'
): Promise<boolean> {
  const existing = getStoredTokens(scope);
  if (!existing || existing.email) return false;

  const token = await getValidAccessToken(false, scope);
  if (!token) return false;

  const profile = await fetchDropboxAccountProfile(token);
  if (!profile.email && !profile.display_name) return false;

  const latest = getStoredTokens(scope);
  if (!latest) return false;
  setStoredTokens(
    {
      ...latest,
      email: profile.email ?? latest.email,
      display_name: profile.display_name ?? latest.display_name,
    },
    scope
  );
  return true;
}

/**
 * 取得當前有效的 Dropbox App Key (由開發者於環境變數 VITE_DROPBOX_APP_KEY 配置，不允許使用者自訂)
 */
export function getDropboxAppKey(): string {
  return ((import.meta.env.VITE_DROPBOX_APP_KEY as string) || '').trim();
}

/**
 * 取得 OAuth 授權完成後的重定向目標 URI（對齊單一 URL 主應用入口 /app）
 */
export function getDropboxRedirectUri(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  return `${origin}${APP_ROUTES.home}`;
}

/**
 * 生成符合 RFC 7636 規範的隨機 Code Verifier
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(64);
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return base64UrlEncode(array);
}

/**
 * 生成防 CSRF 且具備供應商前綴的隨機 OAuth state 參數
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(32);
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return `${OAUTH_STATE_PREFIX}${base64UrlEncode(array)}`;
}

/**
 * 對 Code Verifier 執行 SHA-256 雜湊生成 Code Challenge
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  if (!cryptoObj?.subtle) {
    throw new Error('WebCrypto subtle digest not supported');
  }
  const hash = await cryptoObj.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

/**
 * 將 Uint8Array 轉為安全無衝突的 Base64URL 字串
 */
export function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * 取得儲存在本地的 Dropbox 憑證 Token
 */
export function getStoredTokens(scope: SyncChannelScope = 'primary'): DropboxTokens | null {
  try {
    const raw = safeLocalStorage.getItem(getTokensStorageKey(scope));
    if (!raw) return null;
    return JSON.parse(raw) as DropboxTokens;
  } catch {
    return null;
  }
}

/**
 * 儲存 Token 憑證至本地
 */
export function setStoredTokens(
  tokens: DropboxTokens,
  scope: SyncChannelScope = 'primary'
): void {
  safeLocalStorage.setItem(getTokensStorageKey(scope), JSON.stringify(tokens));
}

let stagingTokens: DropboxTokens | null = null;

export function getStagingTokens(): DropboxTokens | null {
  return stagingTokens;
}

export function setStagingTokens(tokens: DropboxTokens | null): void {
  stagingTokens = tokens;
}

export function commitStagingTokens(): void {
  if (stagingTokens) {
    setStoredTokens(stagingTokens);
    stagingTokens = null;
  }
}

export function clearStagingTokens(): void {
  stagingTokens = null;
  pendingOAuthCallback = null;
  safeSessionStorage.removeItem(SESSION_VERIFIER_KEY);
  safeSessionStorage.removeItem(SESSION_STATE_KEY);
  safeSessionStorage.removeItem(SESSION_OAUTH_MODE_KEY);
}

/**
 * 清除已儲存的 Dropbox 登入憑證 (登出)
 */
export function clearDropboxTokens(scope: SyncChannelScope = 'primary'): void {
  safeLocalStorage.removeItem(getTokensStorageKey(scope));
  safeSessionStorage.removeItem(SESSION_VERIFIER_KEY);
  safeSessionStorage.removeItem(SESSION_STATE_KEY);
  safeSessionStorage.removeItem(SESSION_OAUTH_MODE_KEY);
  safeSessionStorage.removeItem(SESSION_OAUTH_SCOPE_KEY);
  if (scope === 'primary') {
    stagingTokens = null;
  }
  pendingOAuthCallback = null;
}

/**
 * 檢查當前設備是否已登入 Dropbox
 */
export function isDropboxConnected(scope: SyncChannelScope = 'primary'): boolean {
  const tokens = getStoredTokens(scope);
  return Boolean(tokens?.access_token || tokens?.refresh_token);
}

/**
 * 在應用啟動第 0 幀（早於單一 URL 路由器覆寫網址列前）同步捕獲並驗證 Dropbox OAuth 回調參數
 */
export function captureDropboxOAuthCallback(
  search?: string,
  pathname?: string
): DropboxOAuthCallbackResult | null {
  const rawSearch =
    search !== undefined ? search : typeof window !== 'undefined' ? window.location.search : '';
  const rawPathname =
    pathname !== undefined
      ? pathname
      : typeof window !== 'undefined'
        ? window.location.pathname
        : '';

  if (!rawSearch) return null;

  const expectedPathname = new URL(getDropboxRedirectUri()).pathname.replace(/\/+$/, '') || '/';
  const normalizedPathname = rawPathname.replace(/\/+$/, '') || '/';
  if (normalizedPathname !== expectedPathname) {
    return null;
  }

  const urlParams = new URLSearchParams(rawSearch);
  const error = urlParams.get('error');
  const errorDescription = urlParams.get('error_description') || undefined;
  const code = urlParams.get('code');
  const returnedState = urlParams.get('state');

  if (error) {
    safeSessionStorage.removeItem(SESSION_VERIFIER_KEY);
    safeSessionStorage.removeItem(SESSION_STATE_KEY);
    safeSessionStorage.removeItem(SESSION_OAUTH_MODE_KEY);
    pendingOAuthCallback = { kind: 'error', error, errorDescription };
    return pendingOAuthCallback;
  }

  if (!code) return null;

  const expectedState = safeSessionStorage.getItem(SESSION_STATE_KEY);
  const verifier = safeSessionStorage.getItem(SESSION_VERIFIER_KEY);
  const storedMode = safeSessionStorage.getItem(SESSION_OAUTH_MODE_KEY);
  const storedScope = safeSessionStorage.getItem(SESSION_OAUTH_SCOPE_KEY);
  const mode: DropboxOAuthMode = storedMode === 'restore' ? 'restore' : 'sync';
  const scope: SyncChannelScope = storedScope === 'backup' ? 'backup' : 'primary';

  if (expectedState) {
    if (!returnedState || returnedState !== expectedState) {
      safeSessionStorage.removeItem(SESSION_VERIFIER_KEY);
      safeSessionStorage.removeItem(SESSION_STATE_KEY);
      safeSessionStorage.removeItem(SESSION_OAUTH_MODE_KEY);
      safeSessionStorage.removeItem(SESSION_OAUTH_SCOPE_KEY);
      pendingOAuthCallback = {
        kind: 'error',
        error: 'oauth_state_mismatch',
        errorDescription: 'OAuth state verification failed',
      };
      return pendingOAuthCallback;
    }

    safeSessionStorage.removeItem(SESSION_STATE_KEY);
    safeSessionStorage.removeItem(SESSION_OAUTH_MODE_KEY);
    safeSessionStorage.removeItem(SESSION_OAUTH_SCOPE_KEY);
    pendingOAuthCallback = { kind: 'code', code, mode, scope };
    return pendingOAuthCallback;
  }

  // 若帶有非 Dropbox 供應商前綴的 state，屬於其他服務回調，避免誤捕獲
  if (returnedState && !returnedState.startsWith(OAUTH_STATE_PREFIX)) {
    return null;
  }

  // 向下相容尚未帶 state 的授權過渡期；若連 verifier 都遺失，回報明確錯誤而非靜默忽略
  if (!verifier) {
    safeSessionStorage.removeItem(SESSION_STATE_KEY);
    safeSessionStorage.removeItem(SESSION_OAUTH_MODE_KEY);
    safeSessionStorage.removeItem(SESSION_OAUTH_SCOPE_KEY);
    pendingOAuthCallback = {
      kind: 'error',
      error: 'pkce_verifier_missing',
      errorDescription: 'PKCE verification failed: Code verifier missing from session.',
    };
    return pendingOAuthCallback;
  }

  safeSessionStorage.removeItem(SESSION_OAUTH_MODE_KEY);
  safeSessionStorage.removeItem(SESSION_OAUTH_SCOPE_KEY);
  pendingOAuthCallback = { kind: 'code', code, mode, scope };
  return pendingOAuthCallback;
}

/**
 * 模組級一次性消費已捕獲的 Dropbox OAuth 回調結果（取出即清空，免疫 StrictMode 與多實例競態）
 */
export function consumePendingDropboxOAuthCallback(): DropboxOAuthCallbackResult | null {
  const result = pendingOAuthCallback;
  pendingOAuthCallback = null;
  return result;
}

/**
 * 發起 Dropbox OAuth 2.0 PKCE 授權跳轉
 */
export async function initiateDropboxAuth(
  mode: DropboxOAuthMode = 'sync',
  scope: SyncChannelScope = 'primary'
): Promise<void> {
  const appKey = getDropboxAppKey();
  if (!appKey) {
    throw new Error('Dropbox App Key is not configured. Please set VITE_DROPBOX_APP_KEY.');
  }

  const verifier = generateCodeVerifier();
  const state = generateOAuthState();
  safeSessionStorage.setItem(SESSION_VERIFIER_KEY, verifier);
  safeSessionStorage.setItem(SESSION_STATE_KEY, state);
  safeSessionStorage.setItem(SESSION_OAUTH_MODE_KEY, mode);
  safeSessionStorage.setItem(SESSION_OAUTH_SCOPE_KEY, scope);

  const challenge = await generateCodeChallenge(verifier);
  const redirectUri = getDropboxRedirectUri();

  const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');
  authUrl.searchParams.set('client_id', appKey);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('token_access_type', 'offline');
  authUrl.searchParams.set('state', state);

  if (typeof window !== 'undefined') {
    window.location.href = authUrl.toString();
  }
}

/**
 * 授權回跳後，透過 Auth Code 與本地 Code Verifier 換取 Token
 */
export async function exchangeCodeForTokens(
  code: string,
  scope: SyncChannelScope = 'primary'
): Promise<DropboxTokens> {
  const appKey = getDropboxAppKey();
  if (!appKey) throw new Error('Missing Dropbox App Key');

  const verifier = safeSessionStorage.getItem(SESSION_VERIFIER_KEY);
  if (!verifier) {
    throw new Error('PKCE verification failed: Code verifier missing from session.');
  }

  const redirectUri = getDropboxRedirectUri();
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: appKey,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dropbox token exchange failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    account_id?: string;
    scope?: string;
  };

  const expiresAt = Date.now() + (data.expires_in || 14400) * 1000;
  const profile = await fetchDropboxAccountProfile(data.access_token);

  const tokens: DropboxTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in || 14400,
    expires_at: expiresAt,
    account_id: data.account_id,
    email: profile.email,
    display_name: profile.display_name,
    scope: data.scope,
  };

  setStoredTokens(tokens, scope);
  safeSessionStorage.removeItem(SESSION_VERIFIER_KEY);
  safeSessionStorage.removeItem(SESSION_STATE_KEY);

  return tokens;
}

/**
 * 僅換取 Token 憑證但不持久化至 localStorage (專供首次同步事務暫存)
 */
export async function exchangeCodeForTokensOnly(code: string): Promise<DropboxTokens> {
  const appKey = getDropboxAppKey();
  if (!appKey) throw new Error('Missing Dropbox App Key');

  const verifier = safeSessionStorage.getItem(SESSION_VERIFIER_KEY);
  if (!verifier) {
    throw new Error('PKCE verification failed: Code verifier missing from session.');
  }

  const redirectUri = getDropboxRedirectUri();
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: appKey,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dropbox token exchange failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    account_id?: string;
    scope?: string;
  };

  const expiresAt = Date.now() + (data.expires_in || 14400) * 1000;
  const profile = await fetchDropboxAccountProfile(data.access_token);

  const tokens: DropboxTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in || 14400,
    expires_at: expiresAt,
    account_id: data.account_id,
    email: profile.email,
    display_name: profile.display_name,
    scope: data.scope,
  };

  safeSessionStorage.removeItem(SESSION_VERIFIER_KEY);
  safeSessionStorage.removeItem(SESSION_STATE_KEY);
  return tokens;
}

/**
 * 自動檢查並刷新過期 Access Token (無感續約)
 */
export async function getValidAccessToken(
  forceRefresh = false,
  scope: SyncChannelScope = 'primary'
): Promise<string | null> {
  const tokens = (scope === 'primary' ? stagingTokens : null) || getStoredTokens(scope);
  if (!tokens) return null;

  // 距離過期大於 5 分鐘，直接使用現存 access_token
  const isExpiringSoon = Date.now() > tokens.expires_at - 5 * 60 * 1000;
  if (!isExpiringSoon && !forceRefresh && tokens.access_token) {
    return tokens.access_token;
  }

  // 若需要刷新且擁有 refresh_token
  if (tokens.refresh_token) {
    const appKey = getDropboxAppKey();
    if (!appKey) return tokens.access_token || null;

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: appKey,
      });

      const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          access_token: string;
          expires_in?: number;
        };
        const updatedTokens: DropboxTokens = {
          ...tokens,
          access_token: data.access_token,
          expires_in: data.expires_in || 14400,
          expires_at: Date.now() + (data.expires_in || 14400) * 1000,
        };
        if (scope === 'primary' && stagingTokens) {
          stagingTokens = updatedTokens;
        } else {
          setStoredTokens(updatedTokens, scope);
        }
        return updatedTokens.access_token;
      }

      // 若遠端回傳 400 invalid_grant 或 401，代表使用者已在 Dropbox 撤銷授權
      if (response.status === 400 || response.status === 401) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        if (errorData?.error === 'invalid_grant' || response.status === 401) {
          console.warn('Dropbox refresh token revoked or invalid. Clearing stored credentials.');
          clearDropboxTokens(scope);
          return null;
        }
      }
    } catch (err) {
      console.warn('Failed to refresh Dropbox access token silently:', err);
    }
  }

  return tokens.access_token || null;
}
