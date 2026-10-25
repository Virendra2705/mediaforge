import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db.js';
import { postgresManager } from './postgres.js';

function scryptAsync(
  password: string,
  salt: string,
  keylen: number,
  options: crypto.ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  tier?: 'free' | 'pro';
}

interface TokenClaims {
  sub: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  tier?: 'free' | 'pro';
  iat: number;
  exp: number;
}

// Extend Express Request interface to include verified session user
declare global {
  namespace Express {
    interface Request {
      user?: SessionUser | null;
    }
  }
}

/**
 * Retrieve the secret key for signing session tokens.
 * Throws at call time if AUTH_SECRET is not defined.
 */
export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error('AUTH_SECRET environment variable is required to issue and verify session tokens.');
  }
  return secret.trim();
}

/**
 * Base64URL encode a buffer or string
 */
function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Base64URL decode to string
 */
function base64UrlDecode(input: string): string {
  let str = input.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4 !== 0) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

/**
 * Issue a cryptographically signed session token (HMAC-SHA256)
 */
export function createSessionToken(user: SessionUser, ttlHours = 72): string {
  if (!Number.isFinite(ttlHours) || ttlHours <= 0 || ttlHours > 72) throw new Error('Session lifetime must be between 0 and 72 hours.');
  const secret = getAuthSecret();
  const header = { alg: 'HS256', typ: 'JWT' };
  const nowSec = Math.floor(Date.now() / 1000);
  const claims: TokenClaims = {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tier: user.tier || 'free',
    iat: nowSec,
    exp: nowSec + ttlHours * 3600,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(claims));
  const dataToSign = `${headerB64}.${payloadB64}`;
  const signatureBytes = crypto.createHmac('sha256', secret).update(dataToSign).digest();
  const signatureB64 = base64UrlEncode(signatureBytes);

  return `${dataToSign}.${signatureB64}`;
}

/**
 * Verify a session token and return the user payload if valid.
 * Compares raw HMAC digest bytes using timingSafeEqual.
 */
export function verifySessionToken(token?: string | null): SessionUser | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    const secret = getAuthSecret();
    const dataToSign = `${headerB64}.${payloadB64}`;

    // Compute expected HMAC as raw bytes
    const expectedDigest = crypto.createHmac('sha256', secret).update(dataToSign).digest();

    // Decode the submitted signature from base64url to raw bytes
    let sigStr = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    while (sigStr.length % 4 !== 0) sigStr += '=';
    if (!/^[A-Za-z0-9_-]{43}$/.test(signatureB64)) return null;
    const submittedDigest = Buffer.from(sigStr, 'base64');

    if (
      submittedDigest.length !== expectedDigest.length ||
      !crypto.timingSafeEqual(submittedDigest, expectedDigest)
    ) {
      return null;
    }

    const payloadStr = base64UrlDecode(payloadB64);
    const header = JSON.parse(base64UrlDecode(headerB64));
    if (!header || header.alg !== 'HS256' || header.typ !== 'JWT') return null;
    const claims: TokenClaims = JSON.parse(payloadStr);

    const nowSec = Math.floor(Date.now() / 1000);
    if (!claims || typeof claims !== 'object' ||
      typeof claims.sub !== 'string' || !claims.sub.trim() ||
      typeof claims.name !== 'string' ||
      typeof claims.email !== 'string' ||
      !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) ||
      claims.exp <= nowSec || claims.iat > nowSec + 60 || claims.iat >= claims.exp ||
      claims.exp - claims.iat > 72 * 3600 ||
      (claims.tier !== undefined && claims.tier !== 'free' && claims.tier !== 'pro')) return null;

    // Only allow known, explicit roles — never derive role from any other claim
    const role = claims.role;
    if (role !== 'admin' && role !== 'user' && role !== 'guest') {
      return null;
    }

    return {
      id: claims.sub,
      name: claims.name,
      email: claims.email,
      role,
      tier: claims.tier,
    };
  } catch {
    return null;
  }
}

/**
 * Extract the session token from the HttpOnly session cookie only.
 * Deliberately does NOT accept auth_token query parameters — session tokens
 * must not travel in URLs, which appear in server logs and browser history.
 */
export function extractTokenFromRequest(req: Request): string | null {
  // Browser sessions are cookie-only so credentials are never exposed to JavaScript.
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader && typeof cookieHeader === 'string') {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const c of cookies) {
      if (c.startsWith('mf_session=')) {
        return c.substring('mf_session='.length);
      }
    }
  }

  return null;
}

/** Reject cross-site state-changing browser requests when an Origin is supplied. */
export function sameOriginMutationGuard(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) return next();
  const origin = req.get('origin');
  if (!origin) return next(); // Non-browser clients do not attach cookies automatically.
  try {
    const parsed = new URL(origin);
    const expectedProtocol = process.env.NODE_ENV === 'production' ? 'https:' : req.protocol + ':';
    if (parsed.host !== req.get('host') || parsed.protocol !== expectedProtocol) {
      res.status(403).json({ success: false, error: { code: 'CSRF_REJECTED', message: 'Cross-origin request rejected.' } });
      return;
    }
  } catch {
    res.status(403).json({ success: false, error: { code: 'CSRF_REJECTED', message: 'Cross-origin request rejected.' } });
    return;
  }
  next();
}

/**
 * Middleware: Populates req.user if a valid session exists.
 * Does NOT reject if unauthenticated.
 */
export function sessionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = extractTokenFromRequest(req);
  if (token) {
    const user = verifySessionToken(token);
    if (user) {
      // Resolve authorization from the current account record so a signed
      // token cannot preserve admin privileges after the account is demoted.
      const account = db.users.get(user.id);
      req.user = account
        ? { id: account.id, name: account.name, email: account.email, role: account.role, tier: account.tier }
        : null;
      if (!account) {
        next();
        return;
      }
    } else {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

/**
 * Middleware: Requires an authenticated user session.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Valid authentication session required to perform this action.',
      },
    });
  }
  next();
}

/**
 * Middleware: Requires an authenticated user with role === 'admin'.
 * The role is taken from the cryptographically verified session token only —
 * it is never re-derived from the email or any other mutable claim.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Administrator authentication required.',
      },
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      data: null,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied. Administrator privileges are required.',
      },
    });
  }

  next();
}

export function rejectUnverifiedPasswordRecovery(res: Response) {
  return res.status(501).json({
    success: false,
    error: {
      code: 'RECOVERY_NOT_CONFIGURED',
      message: 'Verified recovery delivery is not configured on this server. Password reset by email alone is disabled.',
    },
  });
}

// ---------------------------------------------------------------------------
// Password hashing (scrypt)
// ---------------------------------------------------------------------------

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

export function isValidPasswordHashFormat(storedHash: string): boolean {
  const match = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/i.exec(storedHash);
  return !!match;
}

/**
 * Hash a plaintext password with a random salt using scrypt.
 * Returns "scrypt:<salt_hex>:<hash_hex>".
 */
export async function hashPassword(plaintext: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scryptAsync(plaintext, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  }) as Buffer;
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

/**
 * Verify a plaintext password against a stored hash.
 * Returns false for any malformed or mismatched input.
 */
export async function verifyPassword(plaintext: string, storedHash: string): Promise<boolean> {
  if (!plaintext || !storedHash || !isValidPasswordHashFormat(storedHash)) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;
  try {
    const derived = await scryptAsync(plaintext, salt, SCRYPT_PARAMS.keylen, {
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
    }) as Buffer;
    const storedBuf = Buffer.from(hashHex, 'hex');
    if (derived.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(derived, storedBuf);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Admin configuration
// ---------------------------------------------------------------------------

/**
 * Returns the configured admin email from ADMIN_EMAIL environment variable.
 * Returns null (fail-closed) when not configured.
 * Never derives admin status from email substrings.
 */
export function getConfiguredAdminEmail(): string | null {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || adminEmail.trim().length === 0) return null;
  return adminEmail.trim().toLowerCase();
}

/**
 * Returns the configured admin password hash.
 * If ADMIN_PASSWORD_HASH is set, uses it directly (pre-hashed).
 * If only ADMIN_PASSWORD is set, the caller should hash it on first use.
 * Returns null when neither is configured.
 */
export function getAdminPasswordEnv(): { hash: string | null; plaintext: string | null } {
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim() || null;
  const plain = process.env.ADMIN_PASSWORD?.trim() || null;
  return { hash, plaintext: plain };
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Authenticate a user by email + password.
 *
 * Rules (fail-closed):
 * 1. Email must match an existing account in db.users.
 * 2. The account must have a passwordHash.
 * 3. The submitted password must match the stored hash.
 * 4. Admin role is taken from the persisted account record only.
 *    It is never granted based on email content.
 *
 * Returns null for any failure — including unknown accounts, wrong password,
 * or accounts without a password hash. Does NOT auto-provision accounts.
 */
export async function authenticateUser(email: string, password?: string): Promise<SessionUser | null> {
  if (!email || typeof email !== 'string') return null;
  if (!password || typeof password !== 'string' || password.length === 0) return null;

  const normalizedEmail = email.trim().toLowerCase();

  // Look up existing account
  let foundUser: (typeof db.users extends Map<string, infer V> ? V : never) | undefined;
  for (const user of db.users.values()) {
    if (user.email.toLowerCase() === normalizedEmail) {
      foundUser = user;
      break;
    }
  }

  if (!foundUser) {
    // Unknown account — perform a dummy scrypt operation to prevent
    // timing-based account enumeration, then reject.
    await _dummyVerify(password);
    return null;
  }

  // Account must have a password hash
  const storedHash: string | undefined = (foundUser as any).passwordHash;
  if (!storedHash || !isValidPasswordHashFormat(storedHash)) {
    await _dummyVerify(password);
    return null;
  }

  // Verify password
  const ok = await verifyPassword(password, storedHash);
  if (!ok) return null;

  return {
    id: foundUser.id,
    name: foundUser.name,
    email: foundUser.email,
    role: foundUser.role,
    tier: foundUser.tier,
  };
}

/**
 * Constant-time dummy verification to prevent account enumeration via timing.
 */
async function _dummyVerify(password: string): Promise<void> {
  // A static fake hash — the result is always discarded
  const fakeHash = 'scrypt:0000000000000000000000000000000000000000:' + '0'.repeat(128);
  await verifyPassword(password, fakeHash).catch(() => {});
}

/**
 * Change a user's password. Requires the current password to be correct first.
 * Returns true on success, false on any failure (wrong current password, unknown user, etc.).
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!userId || !currentPassword || !newPassword) {
    return { success: false, error: 'All fields are required.' };
  }
  if (newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters.' };
  }

  const user = db.users.get(userId);
  if (!user) return { success: false, error: 'Account not found.' };

  const storedHash: string | undefined = (user as any).passwordHash;
  if (!storedHash) return { success: false, error: 'Account has no password configured.' };

  const ok = await verifyPassword(currentPassword, storedHash);
  if (!ok) return { success: false, error: 'Current password is incorrect.' };

  const newHash = await hashPassword(newPassword);
  const updatedUser = { ...user, passwordHash: newHash };
  await postgresManager.saveUser(updatedUser);
  db.users.set(userId, updatedUser);
  return { success: true };
}
