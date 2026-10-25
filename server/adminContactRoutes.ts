import type { Application, Request, Response } from 'express';
import { requireAdmin } from './auth.js';
import type { ContactMessage } from './types.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_OFFSET = 100_000;

export interface AdminContactRouteDependencies {
  getContactMessages: (limit: number, offset: number) => Promise<ContactMessage[]>;
}

function parseBoundedInteger(value: unknown, defaultValue: number, maximum: number): number | null {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

/** Only authenticated administrators can page through stored contact submissions. */
export function registerAdminContactRoutes(app: Application, dependencies: AdminContactRouteDependencies): void {
  app.get('/api/admin/contact-messages', requireAdmin, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const limit = parseBoundedInteger(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const offset = parseBoundedInteger(req.query.offset, 0, MAX_OFFSET);
    if (limit === null || limit < 1 || offset === null || offset + limit > MAX_OFFSET) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAGINATION', message: 'Provide a limit from 1 to 50 and a page within the first 100000 records.' },
      });
    }

    try {
      const messages = await dependencies.getContactMessages(limit + 1, offset);
      const hasMore = messages.length > limit;
      const items = messages.slice(0, limit).map(({ id, name, email, subject, message, status, createdAt }) => ({
        id, name, email, subject, message, status, createdAt,
      }));
      return res.json({
        success: true,
        data: { items, pagination: { limit, offset, hasMore, nextOffset: hasMore ? offset + limit : null } },
      });
    } catch {
      return res.status(503).json({
        success: false,
        error: { code: 'CONTACT_MESSAGES_UNAVAILABLE', message: 'Contact messages are temporarily unavailable.' },
      });
    }
  });
}
