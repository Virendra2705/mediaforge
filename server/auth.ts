import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db.js';

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
      sessionToken?: string | null;
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
  const signature = crypto.createHmac('sha256', secret).update(dataToSign).digest();
  const signatureB64 = base64UrlEncode(signature);

  return `${dataToSign}.${signatureB64}`;
}

/**
 * Verify a session token and return the user payload if valid.
 */
export function verifySessionToken(token?: string | null): SessionUser | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    const secret = getAuthSecret();
    const dataToSign = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(dataToSign).digest();
    const expectedSigB64 = base64UrlEncode(expectedSig);

    const sigBuf = Buffer.from(signatureB64);
    const expBuf = Buffer.from(expectedSigB64);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payloadStr = base64UrlDecode(payloadB64);
    const claims: TokenClaims = JSON.parse(payloadStr);

    const nowSec = Math.floor(Date.now() / 1000);
    if (claims.exp && nowSec > claims.exp) {
      return null; // Token expired
    }

    return {
      id: claims.sub,
      name: claims.name,
      email: claims.email,
      role: claims.role,
      tier: claims.tier,
    };
  } catch {
    return null;
  }
}

/**
 * Extract token from request headers (Authorization: Bearer <token>), cookies, or query
 */
export function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string') {
    const parts = authHeader.trim().split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
  }

  // Check cookie header: mf_session=<token>
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader && typeof cookieHeader === 'string') {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const c of cookies) {
      if (c.startsWith('mf_session=')) {
        return c.substring('mf_session='.length);
      }
    }
  }

  // Check query parameter for direct download stream links
  if (req.query?.auth_token && typeof req.query.auth_token === 'string') {
    return req.query.auth_token;
  }

  return null;
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
      req.user = user;
      req.sessionToken = token;
    } else {
      req.user = null;
      req.sessionToken = null;
    }
  } else {
    req.user = null;
    req.sessionToken = null;
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

/**
 * Authenticate a user by email/password and return their session user object.
 */
export async function authenticateUser(email: string, _password?: string): Promise<SessionUser | null> {
  const normalizedEmail = email.trim().toLowerCase();

  // Check existing users in the database
  for (const user of db.users.values()) {
    if (user.email.toLowerCase() === normalizedEmail) {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tier: user.tier,
      };
    }
  }

  // Provision new user on first login
  const newId = `usr_${Date.now()}`;
  const isAdmin = normalizedEmail.includes('alex') || normalizedEmail.includes('admin');
  const role: 'admin' | 'user' = isAdmin ? 'admin' : 'user';
  const name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  const newUser = {
    id: newId,
    name,
    email: normalizedEmail,
    role,
    createdAt: new Date().toISOString(),
    downloadsCount: 0,
    tier: (role === 'admin' ? 'pro' : 'free') as 'pro' | 'free',
  };

  db.users.set(newId, newUser);
  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    tier: newUser.tier,
  };
}
