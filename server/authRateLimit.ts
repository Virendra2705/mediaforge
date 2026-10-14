import crypto from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export interface RateLimitResult {
  allowed: boolean;
  resetInSeconds: number;
}

export type RateLimitCheck = (key: string, maxRequests: number, windowSeconds: number) => Promise<RateLimitResult>;

export interface AuthenticationRateLimitOptions {
  scope: 'login' | 'password-change' | 'password-recovery';
  check: RateLimitCheck;
  ip: { maxRequests: number; windowSeconds: number };
  subject?: { maxRequests: number; windowSeconds: number };
  getSubject?: (req: Request) => string | null | undefined;
}

/** Ignore forwarding headers; use the actual TCP peer unless a topology is verified. */
export function getTrustedClientAddress(req: Pick<Request, 'socket'>): string {
  const address = req.socket.remoteAddress || 'unknown';
  return address.toLowerCase().startsWith('::ffff:') ? address.slice(7) : address.toLowerCase();
}

function hashIdentity(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function createAuthenticationRateLimiter(options: AuthenticationRateLimitOptions): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const checks: Promise<RateLimitResult>[] = [options.check(
          `auth:${options.scope}:ip:${hashIdentity(getTrustedClientAddress(req))}`,
          options.ip.maxRequests,
          options.ip.windowSeconds,
        )];
        const subject = options.getSubject?.(req)?.trim().toLowerCase();
        if (subject && subject.length <= 254 && options.subject) {
          checks.push(options.check(
            `auth:${options.scope}:subject:${hashIdentity(subject)}`,
            options.subject.maxRequests,
            options.subject.windowSeconds,
          ));
        }

        const results = await Promise.all(checks);
        const blocked = results.filter((result) => !result.allowed);
        if (blocked.length) {
          res.setHeader('Retry-After', String(Math.max(1, ...blocked.map((result) => result.resetInSeconds))));
          res.setHeader('Cache-Control', 'no-store');
          res.status(429).json({
            success: false,
            error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Try again later.' },
          });
          return;
        }
        next();
      } catch {
        res.setHeader('Cache-Control', 'no-store');
        res.status(503).json({
          success: false,
          error: { code: 'AUTH_TEMPORARILY_UNAVAILABLE', message: 'Authentication is temporarily unavailable.' },
        });
      }
    })();
  };
}
