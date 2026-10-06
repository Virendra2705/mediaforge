import pg from 'pg';
import { MediaJob, DmcaReport, ContactMessage, BlogPost, SystemSettings, AuditLog, UserAccount } from './types.js';

const { Pool } = pg;

export interface DbStatus {
  connected: boolean;
  provider: string;
  database: string;
  host: string;
  version?: string;
  latencyMs?: number;
  tables?: {
    jobs: number;
    dmcaReports: number;
    contactMessages: number;
    blogPosts: number;
    auditLogs: number;
  };
  error?: string | null;
}

class PostgresManager {
  private pool: pg.Pool | null = null;
  public isConnected: boolean = false;
  public connectionError: string | null = null;
  public lastLatencyMs: number = 0;
  private dbName: string = 'neondb';
  private host: string = '';

  constructor() {
    this.initPool();
  }

  private initPool() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2SYP1MRvxnBU@ep-wild-violet-axrp274t-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

    if (!connectionString) {
      this.isConnected = false;
      this.connectionError = 'No DATABASE_URL configured';
      return;
    }

    try {
      const url = new URL(connectionString.replace('postgresql://', 'http://'));
      this.dbName = url.pathname.replace('/', '') || 'neondb';
      this.host = url.hostname;
    } catch {
      this.host = 'neon.tech';
    }

    try {
      this.pool = new Pool({
        connectionString,
        ssl: {
          rejectUnauthorized: false
        },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      this.pool.on('error', (err) => {
        console.log('[Neon PostgreSQL] Background pool notice:', err.message);
        this.isConnected = false;
        this.connectionError = err.message;
      });
    } catch (err: any) {
      console.log('[Neon PostgreSQL] Pool creation notice:', err.message);
      this.connectionError = err.message;
    }
  }

  public async initDatabase(): Promise<boolean> {
    if (!this.pool) return false;

    const startTime = Date.now();
    try {
      const client = await this.pool.connect();
      try {
        const testRes = await client.query('SELECT version()');
        this.lastLatencyMs = Date.now() - startTime;
        this.isConnected = true;
        this.connectionError = null;
        console.log(`[Neon PostgreSQL] Connected successfully to ${this.dbName} on ${this.host} (${this.lastLatencyMs}ms)`);

        // Initialize schema tables if they don't exist
        await client.query(`
          CREATE TABLE IF NOT EXISTS media_jobs (
            id VARCHAR(128) PRIMARY KEY,
            source_url TEXT NOT NULL,
            provider VARCHAR(64) NOT NULL,
            media_title TEXT NOT NULL,
            thumbnail_url TEXT,
            selected_format VARCHAR(32) NOT NULL,
            selected_quality VARCHAR(64) NOT NULL,
            format_type VARCHAR(32) DEFAULT 'video',
            status VARCHAR(32) NOT NULL,
            progress INT DEFAULT 0,
            step_message TEXT,
            download_token VARCHAR(256),
            expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            raw_payload JSONB
          );

          CREATE TABLE IF NOT EXISTS dmca_reports (
            id VARCHAR(128) PRIMARY KEY,
            complainant_name TEXT NOT NULL,
            email TEXT NOT NULL,
            organization TEXT,
            target_url TEXT NOT NULL,
            copyright_work_description TEXT NOT NULL,
            ownership_proof_description TEXT NOT NULL,
            reason TEXT NOT NULL,
            status VARCHAR(32) DEFAULT 'PENDING',
            admin_notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS contact_messages (
            id VARCHAR(128) PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            status VARCHAR(32) DEFAULT 'UNREAD',
            created_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS blog_posts (
            id VARCHAR(128),
            slug VARCHAR(256) PRIMARY KEY,
            title TEXT NOT NULL,
            excerpt TEXT,
            content TEXT NOT NULL,
            category VARCHAR(128),
            author VARCHAR(128),
            published_at TIMESTAMPTZ DEFAULT NOW(),
            read_time VARCHAR(32),
            tags JSONB DEFAULT '[]',
            featured_image TEXT,
            seo_title TEXT,
            seo_description TEXT
          );

          CREATE TABLE IF NOT EXISTS audit_logs (
            id VARCHAR(128) PRIMARY KEY,
            action VARCHAR(64) NOT NULL,
            ip VARCHAR(64),
            details TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS system_settings (
            id VARCHAR(64) PRIMARY KEY,
            settings_json JSONB NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(128) PRIMARY KEY,
            name VARCHAR(128) NOT NULL,
            email VARCHAR(256) NOT NULL UNIQUE,
            role VARCHAR(32) DEFAULT 'user',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            downloads_count INT DEFAULT 0,
            tier VARCHAR(32) DEFAULT 'free'
          );
        `);

        return true;
      } finally {
        client.release();
      }
    } catch (err: any) {
      this.isConnected = false;
      this.connectionError = err.message || 'Connection failed';
      console.log('[Neon PostgreSQL] Initialization notice (operating in memory mode):', err.message);
      return false;
    }
  }

  public async getStatus(): Promise<DbStatus> {
    if (!this.pool || !this.isConnected) {
      return {
        connected: false,
        provider: 'Neon Serverless PostgreSQL',
        database: this.dbName,
        host: this.host,
        error: this.connectionError || 'Disconnected',
      };
    }

    const startTime = Date.now();
    try {
      const client = await this.pool.connect();
      try {
        const vRes = await client.query('SELECT version()');
        this.lastLatencyMs = Date.now() - startTime;

        const [jobsCount, dmcaCount, msgCount, blogCount, logsCount] = await Promise.all([
          client.query('SELECT COUNT(*)::int as count FROM media_jobs').then(r => r.rows[0]?.count || 0).catch(() => 0),
          client.query('SELECT COUNT(*)::int as count FROM dmca_reports').then(r => r.rows[0]?.count || 0).catch(() => 0),
          client.query('SELECT COUNT(*)::int as count FROM contact_messages').then(r => r.rows[0]?.count || 0).catch(() => 0),
          client.query('SELECT COUNT(*)::int as count FROM blog_posts').then(r => r.rows[0]?.count || 0).catch(() => 0),
          client.query('SELECT COUNT(*)::int as count FROM audit_logs').then(r => r.rows[0]?.count || 0).catch(() => 0),
        ]);

        return {
          connected: true,
          provider: 'Neon Serverless PostgreSQL',
          database: this.dbName,
          host: this.host,
          version: vRes.rows[0]?.version?.split(' ')?.[0] + ' ' + (vRes.rows[0]?.version?.split(' ')?.[1] || ''),
          latencyMs: this.lastLatencyMs,
          tables: {
            jobs: jobsCount,
            dmcaReports: dmcaCount,
            contactMessages: msgCount,
            blogPosts: blogCount,
            auditLogs: logsCount,
          },
        };
      } finally {
        client.release();
      }
    } catch (err: any) {
      this.isConnected = false;
      this.connectionError = err.message;
      return {
        connected: false,
        provider: 'Neon Serverless PostgreSQL',
        database: this.dbName,
        host: this.host,
        error: err.message,
      };
    }
  }

  // --- Media Jobs ---
  public async saveJob(job: MediaJob): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `INSERT INTO media_jobs (
          id, source_url, provider, media_title, thumbnail_url, selected_format,
          selected_quality, format_type, status, progress, step_message, download_token,
          expires_at, created_at, updated_at, raw_payload
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          progress = EXCLUDED.progress,
          step_message = EXCLUDED.step_message,
          download_token = EXCLUDED.download_token,
          expires_at = EXCLUDED.expires_at,
          updated_at = EXCLUDED.updated_at,
          raw_payload = EXCLUDED.raw_payload;`,
        [
          job.id,
          job.sourceUrl,
          job.provider,
          job.mediaTitle,
          job.thumbnailUrl,
          job.selectedFormat,
          job.selectedQuality,
          job.formatType,
          job.status,
          job.progress,
          job.stepMessage,
          job.downloadToken || null,
          job.expiresAt ? new Date(job.expiresAt) : null,
          job.createdAt ? new Date(job.createdAt) : new Date(),
          new Date(),
          JSON.stringify(job),
        ]
      );
    } catch (err: any) {
      console.log('[Neon PostgreSQL] Notice saving job:', err?.message || err);
    }
  }

  public async getJobs(): Promise<MediaJob[]> {
    if (!this.pool || !this.isConnected) return [];
    try {
      const res = await this.pool.query('SELECT raw_payload FROM media_jobs ORDER BY created_at DESC LIMIT 100');
      return res.rows.map(r => r.raw_payload as MediaJob);
    } catch (err: any) {
      console.log('[Neon PostgreSQL] Notice loading jobs:', err?.message || err);
      return [];
    }
  }

  // --- DMCA Reports ---
  public async saveDmcaReport(report: DmcaReport): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `INSERT INTO dmca_reports (
          id, complainant_name, email, organization, target_url, copyright_work_description,
          ownership_proof_description, reason, status, admin_notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          admin_notes = EXCLUDED.admin_notes,
          updated_at = EXCLUDED.updated_at;`,
        [
          report.id,
          report.complainantName,
          report.email,
          report.organization || null,
          report.targetUrl,
          report.copyrightWorkDescription,
          report.ownershipProofDescription,
          report.reason,
          report.status,
          report.adminNotes || null,
          new Date(report.createdAt),
          new Date(report.updatedAt),
        ]
      );
    } catch (err: any) {
      console.log('[Neon PostgreSQL] Notice saving DMCA report:', err?.message || err);
    }
  }

  public async getDmcaReports(): Promise<DmcaReport[]> {
    if (!this.pool || !this.isConnected) return [];
    try {
      const res = await this.pool.query('SELECT * FROM dmca_reports ORDER BY created_at DESC');
      return res.rows.map(r => ({
        id: r.id,
        complainantName: r.complainant_name,
        email: r.email,
        organization: r.organization || undefined,
        targetUrl: r.target_url,
        copyrightWorkDescription: r.copyright_work_description,
        ownershipProofDescription: r.ownership_proof_description,
        reason: r.reason,
        goodFaithStatement: true,
        accuracyStatement: true,
        status: r.status,
        adminNotes: r.admin_notes || undefined,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
      }));
    } catch (err: any) {
      console.log('[Neon PostgreSQL] Notice loading DMCA reports:', err?.message || err);
      return [];
    }
  }

  // --- Contact Messages ---
  public async saveContactMessage(msg: ContactMessage): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `INSERT INTO contact_messages (id, name, email, subject, message, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING;`,
        [msg.id, msg.name, msg.email, msg.subject, msg.message, msg.status, new Date(msg.createdAt)]
      );
    } catch (err: any) {
      console.log('[Neon PostgreSQL] Notice saving contact message:', err?.message || err);
    }
  }

  // --- Blog Posts ---
  public async saveBlogPost(post: BlogPost): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `INSERT INTO blog_posts (
          id, slug, title, excerpt, content, category, author, published_at, read_time,
          tags, featured_image, seo_title, seo_description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title,
          excerpt = EXCLUDED.excerpt,
          content = EXCLUDED.content,
          category = EXCLUDED.category,
          author = EXCLUDED.author,
          tags = EXCLUDED.tags,
          featured_image = EXCLUDED.featured_image,
          seo_title = EXCLUDED.seo_title,
          seo_description = EXCLUDED.seo_description;`,
        [
          post.id,
          post.slug,
          post.title,
          post.excerpt,
          post.content,
          post.category,
          post.author,
          new Date(post.publishedAt),
          post.readTime,
          JSON.stringify(post.tags),
          post.featuredImage,
          post.seoTitle,
          post.seoDescription,
        ]
      );
    } catch (err: any) {
      console.log('[Neon PostgreSQL] Notice saving blog post:', err?.message || err);
    }
  }

  public async getBlogPosts(): Promise<BlogPost[]> {
    if (!this.pool || !this.isConnected) return [];
    try {
      const res = await this.pool.query('SELECT * FROM blog_posts ORDER BY published_at DESC');
      return res.rows.map(r => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        excerpt: r.excerpt,
        content: r.content,
        category: r.category,
        author: r.author,
        publishedAt: r.published_at.toISOString(),
        readTime: r.read_time,
        tags: Array.isArray(r.tags) ? r.tags : JSON.parse(r.tags || '[]'),
        featuredImage: r.featured_image,
        seoTitle: r.seo_title,
        seoDescription: r.seo_description,
      }));
    } catch (err: any) {
      console.log('[Neon PostgreSQL] Notice loading blog posts:', err?.message || err);
      return [];
    }
  }

  // --- Audit Logs ---
  public async saveAuditLog(log: AuditLog): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `INSERT INTO audit_logs (id, action, ip, details, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING;`,
        [log.id, log.action, log.ip, log.details, new Date(log.timestamp)]
      );
    } catch (err: any) {
      console.log('[Neon PostgreSQL] Notice saving audit log:', err?.message || err);
    }
  }

  // --- System Settings ---
  public async saveSettings(settings: SystemSettings): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `INSERT INTO system_settings (id, settings_json, updated_at)
         VALUES ('global_config', $1, NOW())
         ON CONFLICT (id) DO UPDATE SET
          settings_json = EXCLUDED.settings_json,
          updated_at = NOW();`,
        [JSON.stringify(settings)]
      );
    } catch (err: any) {
      console.log('[Neon PostgreSQL] Notice saving settings:', err?.message || err);
    }
  }

  public async loadSettings(): Promise<SystemSettings | null> {
    if (!this.pool || !this.isConnected) return null;
    try {
      const res = await this.pool.query("SELECT settings_json FROM system_settings WHERE id = 'global_config'");
      if (res.rows.length > 0) {
        return res.rows[0].settings_json as SystemSettings;
      }
      return null;
    } catch (err: any) {
      console.log('[Neon PostgreSQL] Notice loading settings:', err?.message || err);
      return null;
    }
  }
}

export const postgresManager = new PostgresManager();
