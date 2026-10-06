import crypto from 'crypto';
import dns from 'dns';
import { Request } from 'express';

// In-memory rate limit store
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

// Blocked private IP ranges and local hostnames for SSRF protection
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd00:/i,
  /\.internal$/i,
  /\.local$/i,
];

// Blocked domains (e.g. copyright takedown blocked URLs)
export const blockedDomains = new Set<string>();

/**
 * Helper to check if an IP address is in a private, loopback, link-local, or multicast range
 */
export function isPrivateIp(ip: string): boolean {
  if (ip.includes('.')) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return true;
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (private)
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (link-local, cloud metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 224.0.0.0/4 (multicast & reserved)
    if (parts[0] >= 224) return true;
  }

  const lower = ip.toLowerCase();
  if (
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fe80:') ||
    lower.startsWith('fc00:') ||
    lower.startsWith('fd00:')
  ) {
    return true;
  }
  return false;
}

/**
 * Validates and normalizes URL against SSRF attacks and illegal protocols (synchronous check)
 */
export function validateAndNormalizeUrl(rawUrl: string): {
  isValid: boolean;
  normalizedUrl?: string;
  error?: string;
  host?: string;
} {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, error: 'URL is required.' };
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length > 2048) {
    return { isValid: false, error: 'URL is excessively long.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, error: 'Invalid URL format. Please provide a valid http or https link.' };
  }

  // Only allow HTTP and HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, error: 'Only HTTP and HTTPS protocols are supported.' };
  }

  const host = parsed.hostname.toLowerCase();

  // Check SSRF blocked hostnames and IP patterns
  for (const pattern of BLOCKED_HOST_PATTERNS) {
    if (pattern.test(host)) {
      return { isValid: false, error: 'Access to local or private network addresses is forbidden for security.' };
    }
  }

  // Check blocked domains from DMCA/Admin blocklist
  if (blockedDomains.has(host) || Array.from(blockedDomains).some((d) => host.endsWith(`.${d}`))) {
    return { isValid: false, error: 'This domain is restricted due to a verified copyright or abuse notice.' };
  }

  return {
    isValid: true,
    normalizedUrl: parsed.toString(),
    host,
  };
}

/**
 * Asynchronous SSRF guard: resolves DNS and checks IP addresses against private ranges
 * to eliminate DNS-rebinding attacks.
 */
export async function validateAndNormalizeUrlAsync(rawUrl: string): Promise<{
  isValid: boolean;
  normalizedUrl?: string;
  error?: string;
  host?: string;
}> {
  const syncCheck = validateAndNormalizeUrl(rawUrl);
  if (!syncCheck.isValid || !syncCheck.host) {
    return syncCheck;
  }

  const host = syncCheck.host;

  // Resolve DNS to verify all destination IPs
  try {
    const records = await dns.promises.lookup(host, { all: true });
    if (!records || records.length === 0) {
      return { isValid: false, error: `Could not resolve hostname '${host}'.` };
    }
    for (const record of records) {
      if (isPrivateIp(record.address)) {
        return {
          isValid: false,
          error: 'Access to private or internal network IP addresses is strictly forbidden.',
        };
      }
    }
  } catch (err: any) {
    return {
      isValid: false,
      error: `Could not resolve host '${host}': ${err.code || err.message}`,
    };
  }

  return syncCheck;
}

/**
 * Secure rate limiter:
 * - Keys on verified session userId when available
 * - For anonymous requests, uses verified req.ip or req.socket.remoteAddress
 *   rather than blindly trusting raw client X-Forwarded-For headers.
 */
export function checkRateLimit(
  req: Request,
  maxRequestsPerHour = 30
): { allowed: boolean; remaining: number; resetInSeconds: number } {
  let rateKey: string;
  if (req.user?.id) {
    rateKey = `user:${req.user.id}`;
  } else {
    const remoteIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    rateKey = `ip:${remoteIp}`;
  }

  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour

  let record = rateLimitMap.get(rateKey);
  if (!record || now > record.resetAt) {
    record = { count: 1, resetAt: now + windowMs };
    rateLimitMap.set(rateKey, record);
    return { allowed: true, remaining: maxRequestsPerHour - 1, resetInSeconds: Math.ceil(windowMs / 1000) };
  }

  record.count += 1;
  const remaining = Math.max(0, maxRequestsPerHour - record.count);
  const resetInSeconds = Math.ceil((record.resetAt - now) / 1000);

  if (record.count > maxRequestsPerHour) {
    return { allowed: false, remaining: 0, resetInSeconds };
  }

  return { allowed: true, remaining, resetInSeconds };
}

// Map for short-lived signed tokens
interface TokenPayload {
  jobId: string;
  mediaId: string;
  format: string;
  quality: string;
  directUrl?: string;
  title: string;
  mimeType: string;
  expiresAt: number;
}
const tokenStore = new Map<string, TokenPayload>();

/**
 * Generate a short-lived cryptographically signed download token (valid for 15 minutes)
 */
export function generateDownloadToken(payload: Omit<TokenPayload, 'expiresAt'>, ttlMinutes = 15): string {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
  tokenStore.set(token, { ...payload, expiresAt });

  // Schedule cleanup
  setTimeout(() => {
    tokenStore.delete(token);
  }, ttlMinutes * 60 * 1000 + 5000);

  return token;
}

/**
 * Verify and consume a download token
 */
export function verifyDownloadToken(token: string): TokenPayload | null {
  if (!token) return null;
  const item = tokenStore.get(token);
  if (!item) return null;

  if (Date.now() > item.expiresAt) {
    tokenStore.delete(token);
    return null;
  }
  return item;
}

/**
 * Returns the storage signing secret.
 * Throws at startup/call time if none of the secret keys are configured.
 */
export function getStorageSigningSecret(): string {
  const secret =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.STORAGE_SECRET_KEY ||
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET;

  if (!secret || secret.trim().length === 0) {
    throw new Error(
      'Storage signing secret is not configured. Please set SUPABASE_SECRET_KEY, STORAGE_SECRET_KEY, SESSION_SECRET, or AUTH_SECRET.'
    );
  }
  return secret.trim();
}

/**
 * Generate a short-lived, cryptographically signed URL for private media storage downloads.
 */
export function generateStorageSignedUrl(objectPath: string, expiresInSeconds: number = 300): string {
  const cleanPath = objectPath.replace(/^\/+/, '');
  const normalizedPath = cleanPath.startsWith('temp/') ? cleanPath : `temp/${cleanPath}`;
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const dataToSign = `${normalizedPath}:${expires}`;
  const secret = getStorageSigningSecret();
  const signature = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');
  return `/api/download/file/${normalizedPath}?token=${signature}&expires=${expires}`;
}

/**
 * Verifies the signature of a signed media storage URL.
 */
export function verifyStorageSignedToken(
  objectPath: string,
  token?: string,
  expiresStr?: string
): { isValid: boolean; error?: string; statusCode?: number } {
  if (!token || !expiresStr) {
    return { isValid: false, error: 'Download authorization signature token is missing.', statusCode: 401 };
  }

  const expires = parseInt(expiresStr, 10);
  if (isNaN(expires)) {
    return { isValid: false, error: 'Invalid expiration timestamp format.', statusCode: 400 };
  }

  const now = Math.floor(Date.now() / 1000);
  if (now > expires) {
    return { isValid: false, error: 'Download authorization token has expired. Please generate a new download link.', statusCode: 410 };
  }

  const cleanPath = objectPath.replace(/^\/+/, '');
  const normalizedPath = cleanPath.startsWith('temp/') ? cleanPath : `temp/${cleanPath}`;
  const strippedPath = normalizedPath.replace(/^temp\//, '');

  const dataToSignWithTemp = `${normalizedPath}:${expires}`;
  const dataToSignWithoutTemp = `${strippedPath}:${expires}`;
  const secret = getStorageSigningSecret();
  const sig1 = crypto.createHmac('sha256', secret).update(dataToSignWithTemp).digest('hex');
  const sig2 = crypto.createHmac('sha256', secret).update(dataToSignWithoutTemp).digest('hex');

  try {
    const tokenBuf = Buffer.from(token, 'hex');
    const buf1 = Buffer.from(sig1, 'hex');
    const buf2 = Buffer.from(sig2, 'hex');

    const matches1 = tokenBuf.length === buf1.length && crypto.timingSafeEqual(tokenBuf, buf1);
    const matches2 = tokenBuf.length === buf2.length && crypto.timingSafeEqual(tokenBuf, buf2);

    if (!matches1 && !matches2) {
      return { isValid: false, error: 'Invalid or forged download authorization signature.', statusCode: 403 };
    }
  } catch {
    return { isValid: false, error: 'Malformed download authorization token.', statusCode: 403 };
  }

  return { isValid: true };
}
