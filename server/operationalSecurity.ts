import type { Application, Request, Response } from 'express';
import { z } from 'zod';
import type { BlogPost } from './types.js';
import { requireAdmin } from './auth.js';

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

