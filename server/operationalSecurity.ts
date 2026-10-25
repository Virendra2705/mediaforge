import type { Application, ErrorRequestHandler, Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import type { BlogPost, DmcaReport } from './types.js';
import { requireAdmin } from './auth.js';

/** Forward async Express 4 route failures into the route's error middleware. */
export function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve().then(() => handler(req, res, next)).catch(next);
  };
}

/** Return a stable, non-sensitive error body for failures outside the analyze route's own handling. */
export function createAnalysisErrorHandler(): ErrorRequestHandler {
  return (error, _req, res, next) => {
    if (res.headersSent) return next(error);
    return res.status(500).json({
      success: false,
      data: null,
      error: {
        code: 'ANALYSIS_FAILED',
        message: 'Unable to retrieve media metadata from this link. Please verify the URL.',
      },
    });
  };
}

const dmcaSchema = z.object({
  complainantName: z.string().trim().min(2),
  email: z.string().trim().email(),
  organization: z.string().trim().optional(),
  targetUrl: z.string().trim().url(),
  copyrightWorkDescription: z.string().trim().min(10),
  ownershipProofDescription: z.string().trim().min(10),
  reason: z.string().trim().min(5),
  goodFaithStatement: z.literal(true),
  accuracyStatement: z.literal(true),
});

interface DmcaReportHandlerDependencies {
  reports: Map<string, DmcaReport>;
  save: (report: DmcaReport) => Promise<boolean | void>;
  audit: (report: DmcaReport, ip: string) => void;
}

/** Shared production handler so local HTTP tests exercise the actual notice schema and persistence boundary. */
export function createDmcaReportHandler({ reports, save, audit }: DmcaReportHandlerDependencies): RequestHandler {
  return async (req, res) => {
    const parsed = dmcaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DMCA_FORM', message: 'All required legal declarations must be checked.' },
      });
    }

    const now = new Date().toISOString();
    const report: DmcaReport = {
      id: `dmca_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...parsed.data,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    try {
      if (await save(report) === false) throw new Error('DMCA report persistence failed.');
    } catch {
      return res.status(503).json({
        success: false,
        error: { code: 'DMCA_STORAGE_UNAVAILABLE', message: 'The application could not confirm receipt. Please use the listed contact email.' },
      });
    }

    reports.set(report.id, report);
    try {
      audit(report, req.ip || '127.0.0.1');
    } catch {
      // Audit logging must not turn an accepted report into a false failure response.
    }

    return res.json({
      success: true,
      data: {
        reportId: report.id,
        message: 'Your notice has been registered for review.',
      },
      error: null,
    });
  };
}

/** Protect every diagnostic endpoint registered after this middleware. */
export function registerDiagnosticAdminGate(app: Application): void {
  app.use('/api/diagnostics', (req, res, next) => {
    // This single endpoint is intentionally public and has its own strict
    // URL, rate, timeout, size, and SSRF controls.
    if (req.path === '/inspect-media') return next();
    return requireAdmin(req, res, next);
  });
}

/** Stop API operations from serving mutable in-memory state after required persistence is lost. */
export function registerDatabaseAvailabilityGate(app: Application, isAvailable: () => boolean): void {
  app.use('/api', (req, res, next) => {
    if (['/health', '/system/health', '/ready', '/status'].includes(req.path)) return next();
    let available = false;
    try { available = isAvailable(); } catch { available = false; }
    if (available) return next();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable.' } });
  });
}

export function registerPublicBlogReadRoutes(app: Application, posts: Map<string, BlogPost>): void {
  app.get('/api/blog', (_req, res) => {
    res.json({ success: true, data: Array.from(posts.values()) });
  });
  app.get('/api/blog/:slug', (req, res) => {
    const post = posts.get(req.params.slug);
    if (!post) return res.status(404).json({ success: false, error: 'Article not found.' });
    res.json({ success: true, data: post });
  });
}

/** Public health routes disclose only liveness and readiness state. */
export function registerPublicOperationalRoutes(app: Application, isReady: () => boolean = () => true): void {
  app.get(['/api/health', '/api/system/health'], (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  app.get('/api/ready', (_req, res) => {
    let ready = false;
    try {
      ready = isReady();
    } catch {
      ready = false;
    }
    return res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' });
  });
  app.get('/api/status', (_req, res) => {
    let ready = false;
    try { ready = isReady(); } catch { ready = false; }
    res.status(ready ? 200 : 503).json({ success: true, data: { system: ready ? 'Operational' : 'Unavailable' } });
  });
}

const blogPostSchema = z.object({
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(200_000),
  excerpt: z.string().trim().max(500).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  author: z.string().trim().min(1).max(100).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});

interface BlogPostHandlerDependencies {
  posts: Map<string, BlogPost>;
  save: (post: BlogPost) => Promise<void>;
  audit: (slug: string, ip: string) => void;
}

/** Shared production handler so HTTP regression tests exercise the real validation/write path. */
export function createBlogPostHandler({ posts, save, audit }: BlogPostHandlerDependencies) {
  return (req: Request, res: Response) => {
    let bodyBytes: number;
    try {
      bodyBytes = Buffer.byteLength(JSON.stringify(req.body ?? {}), 'utf8');
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid blog post payload.' });
    }
    if (bodyBytes > 256 * 1024) {
      return res.status(413).json({ success: false, error: 'Blog post payload exceeds the 256 KB limit.' });
    }

    const parsed = blogPostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid blog post fields.' });
    }

    const { title, content, excerpt, category, author, tags } = parsed.data;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!slug) return res.status(400).json({ success: false, error: 'Title must contain letters or numbers.' });
    if (posts.has(slug)) return res.status(409).json({ success: false, error: 'An article with this title already exists.' });

    const summary = excerpt || title;
    const newPost: BlogPost = {
      id: `blog_${Date.now()}`,
      slug,
      title,
      excerpt: summary,
      content,
      category: category || 'Technology',
      author: author || 'VideoFetch Editorial',
      publishedAt: new Date().toISOString(),
      readTime: `${Math.max(1, Math.ceil(content.split(/\s+/).length / 200))} min read`,
      tags: tags || ['Media', 'Technology'],
      featuredImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
      seoTitle: title,
      seoDescription: summary,
    };

    posts.set(slug, newPost);
    void save(newPost).catch(() => {});
    audit(slug, req.ip || 'unknown');
    return res.status(201).json({ success: true, data: newPost });
  };
}
