/**
 * 輕量純前端 AWS Signature Version 4 (SigV4) 簽名器
 * 直接使用瀏覽器原生 Web Crypto API (crypto.subtle)，零外部 SDK 依賴
 */

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const buf = new Uint8Array(bytes).buffer;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return toHex(hash);
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const rawKey = key instanceof Uint8Array ? new Uint8Array(key).buffer : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const msgBytes = new TextEncoder().encode(message);
  return await crypto.subtle.sign('HMAC', cryptoKey, new Uint8Array(msgBytes).buffer);
}

export function encodeRfc3986(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeCanonicalPath(pathname: string): string {
  return pathname
    .split('/')
    .map((seg) => encodeRfc3986(seg))
    .join('/');
}

function formatAmzDates(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  const dateStamp = iso.slice(0, 10).replace(/-/g, '');
  const timePart = iso.slice(11, 19).replace(/:/g, '');
  return {
    amzDate: `${dateStamp}T${timePart}Z`,
    dateStamp,
  };
}

export interface SignS3RequestInput {
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD';
  url: URL;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  body?: string | Uint8Array;
  extraHeaders?: Record<string, string>;
  now?: Date;
}

export async function signS3Request(
  input: SignS3RequestInput
): Promise<Record<string, string>> {
  const {
    method,
    url,
    region,
    accessKeyId,
    secretAccessKey,
    body = '',
    extraHeaders = {},
    now = new Date(),
  } = input;

  const { amzDate, dateStamp } = formatAmzDates(now);
  const payloadHash = await sha256Hex(body);

  const headerMap = new Map<string, string>();
  headerMap.set('host', url.host);
  headerMap.set('x-amz-content-sha256', payloadHash);
  headerMap.set('x-amz-date', amzDate);

  for (const [k, v] of Object.entries(extraHeaders)) {
    const lower = k.toLowerCase();
    if (v !== undefined && v !== '') {
      headerMap.set(lower, v.trim());
    }
  }

  const sortedHeaderKeys = Array.from(headerMap.keys()).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k}:${headerMap.get(k)}\n`)
    .join('');
  const signedHeaders = sortedHeaderKeys.join(';');

  const queryPairs: Array<[string, string]> = [];
  url.searchParams.forEach((val, key) => {
    queryPairs.push([encodeRfc3986(key), encodeRfc3986(val)]);
  });
  queryPairs.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  const canonicalQueryString = queryPairs.map(([k, v]) => `${k}=${v}`).join('&');

  const canonicalUri = encodeCanonicalPath(url.pathname || '/');
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');

  const kSecret = new TextEncoder().encode(`AWS4${secretAccessKey}`);
  const kDate = await hmacSha256(kSecret, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, 's3');
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const finalHeaders: Record<string, string> = {
    Authorization: authorization,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  for (const [k, v] of Object.entries(extraHeaders)) {
    if (v !== undefined && v !== '') {
      finalHeaders[k] = v;
    }
  }
  return finalHeaders;
}
