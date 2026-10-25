import { randomUUID } from 'node:crypto';
import type { Application, Request, Response } from 'express';
import { z } from 'zod';
import type { ContactMessage, DmcaReport } from './types.js';

const dmcaSchema = z.object({
  complainantName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  organization: z.string().trim().max(200).optional(),
  targetUrl: z.string().trim().url().max(2048),
  copyrightWorkDescription: z.string().trim().min(10).max(5000),
  ownershipProofDescription: z.string().trim().min(10).max(5000),
  reason: z.string().trim().min(5).max(5000),
  goodFaithStatement: z.literal(true),
  accuracyStatement: z.literal(true),
});

const contactSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  purpose: z.enum(['general', 'technical', 'dmca', 'security']),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(5000),
});

export interface PublicSubmissionDependencies {
  isPersistentStoreAvailable: () => boolean;
  saveDmcaReport: (report: DmcaReport) => Promise<void>;
  saveContactMessage: (message: ContactMessage) => Promise<void>;
  audit: (event: 'DMCA_FILED' | 'CONTACT_SUBMITTED', ip: string) => void;
  checkRateLimit: (req: Request) => { allowed: boolean; resetInSeconds: number };
}

function serviceUnavailable(res: Response) {
  return res.status(503).json({
    success: false,
    error: { code: 'SUBMISSION_UNAVAILABLE', message: 'Submissions are temporarily unavailable. Please try again later.' },
  });
}

function rateLimited(req: Request, res: Response, checkRateLimit: PublicSubmissionDependencies['checkRateLimit']) {
  const result = checkRateLimit(req);
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.resetInSeconds));
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many submissions. Please try again later.' },
    });
    return true;
  }
  return false;
}

/** Public submission routes only acknowledge success after durable persistence resolves. */
export function registerPublicSubmissionRoutes(app: Application, dependencies: PublicSubmissionDependencies): void {
  app.post('/api/reports', async (req: Request, res: Response) => {
    if (rateLimited(req, res, dependencies.checkRateLimit)) return;
    const parsed = dmcaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DMCA_FORM', message: 'Complete all required notice fields and declarations.' },
      });
    }
    if (!dependencies.isPersistentStoreAvailable()) return serviceUnavailable(res);

    const now = new Date().toISOString();
    const report: DmcaReport = {
      id: `dmca_${randomUUID()}`,
      ...parsed.data,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await dependencies.saveDmcaReport(report);
    } catch {
      return serviceUnavailable(res);
    }
    try { dependencies.audit('DMCA_FILED', req.ip || '127.0.0.1'); } catch { /* Audit failure must not misstate persistence. */ }

    return res.json({
      success: true,
      data: {
        reportId: report.id,
        message: 'Your notice was accepted and stored for review. No removal has yet occurred.',
      },
      error: null,
    });
  });

  app.post('/api/contact', async (req: Request, res: Response) => {
    if (rateLimited(req, res, dependencies.checkRateLimit)) return;
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CONTACT_FORM', message: 'Provide a valid name, email, category, and message.' },
      });
    }
    if (!dependencies.isPersistentStoreAvailable()) return serviceUnavailable(res);

    const { purpose, subject, ...content } = parsed.data;
    const message: ContactMessage = {
      id: `msg_${randomUUID()}`,
      ...content,
      subject: `[${purpose}]${subject ? ` ${subject}` : ''}`,
      status: 'UNREAD',
      createdAt: new Date().toISOString(),
    };

    try {
      await dependencies.saveContactMessage(message);
    } catch {
      return serviceUnavailable(res);
    }
    try { dependencies.audit('CONTACT_SUBMITTED', req.ip || '127.0.0.1'); } catch { /* Audit failure must not misstate persistence. */ }

    return res.json({ success: true, message: 'Your message was accepted and stored for review.' });
  });
}
