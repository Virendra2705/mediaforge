import {
  MediaJob,
  DmcaReport,
  ContactMessage,
  BlogPost,
  SystemSettings,
  AuditLog,
  UserAccount
} from './types.js';
import { postgresManager } from './postgres.js';

class DatabaseStore {
  public jobs: Map<string, MediaJob> = new Map();
  public users: Map<string, UserAccount> = new Map();
  public dmcaReports: Map<string, DmcaReport> = new Map();
  public contactMessages: Map<string, ContactMessage> = new Map();
  public blogPosts: Map<string, BlogPost> = new Map();
  public auditLogs: AuditLog[] = [];
  public settings: SystemSettings;

  constructor() {
    this.settings = {
      siteName: 'MediaForge',
      maintenanceMode: false,
      anonymousRateLimitPerHour: 25,
      authenticatedRateLimitPerHour: 100,
      maxProcessingDurationSec: 1800, // 30 minutes
      maxFileSizeBytes: 1024 * 1024 * 1024 * 2, // 2GB
      allowTrimming: true,
      autoDeleteTemporaryFilesMinutes: 15,
      providers: [
        {
          id: 'youtube',
          name: 'YouTube (oEmbed & Public Metadata)',
          enabled: true,
          description: 'Authorized public video information and metadata extraction via compliant oEmbed protocol.',
          supportedUrls: ['youtube.com', 'youtu.be', 'm.youtube.com']
        },
        {
          id: 'vimeo',
          name: 'Vimeo (Public API)',
          enabled: true,
          description: 'Vimeo public metadata and progressive media streams for authorized Creative Commons content.',
          supportedUrls: ['vimeo.com', 'player.vimeo.com']
        },
        {
          id: 'direct',
          name: 'Direct Media & CDNs (MP4 / WebM / MP3)',
          enabled: true,
          description: 'Direct accessible media files hosted on CDNs, open repositories, and media servers.',
          supportedUrls: ['*.mp4', '*.webm', '*.mp3', '*.wav', '*.ogg', '*.m4a']
        },
        {
          id: 'wikimedia',
          name: 'Wikimedia Commons & Open Archives',
          enabled: true,
          description: 'Public domain media, open educational resources, and CC-licensed audio/video.',
          supportedUrls: ['commons.wikimedia.org', 'archive.org', 'nasa.gov']
        },
        {
          id: 'soundcloud',
          name: 'SoundCloud (Public oEmbed)',
          enabled: true,
          description: 'SoundCloud track metadata and creator-permitted audio streams.',
          supportedUrls: ['soundcloud.com']
        },
        {
          id: 'dailymotion',
          name: 'Dailymotion (oEmbed)',
          enabled: true,
          description: 'Dailymotion public video metadata and thumbnail extraction.',
          supportedUrls: ['dailymotion.com', 'dai.ly']
        }
      ]
    };

    this.seedInitialData();
  }

  public async initAsync(): Promise<void> {
    try {
      const connected = await postgresManager.initDatabase();
      if (connected) {
        // Hydrate from PostgreSQL or seed to Postgres
        const dbPosts = await postgresManager.getBlogPosts();
        if (dbPosts.length > 0) {
          for (const post of dbPosts) {
            this.blogPosts.set(post.slug, post);
          }
        } else {
          // Seed Postgres with initial posts
          for (const post of this.blogPosts.values()) {
            await postgresManager.saveBlogPost(post);
          }
        }

        const dbReports = await postgresManager.getDmcaReports();
        for (const report of dbReports) {
          this.dmcaReports.set(report.id, report);
        }

        const dbSettings = await postgresManager.loadSettings();
        if (dbSettings) {
          this.settings = { ...this.settings, ...dbSettings };
        } else {
          await postgresManager.saveSettings(this.settings);
        }

        const dbJobs = await postgresManager.getJobs();
        for (const job of dbJobs) {
          this.jobs.set(job.id, job);
        }

        console.log('[Neon PostgreSQL] Persistence synchronized successfully.');
      }
    } catch (err: any) {
      console.log('[Neon PostgreSQL] Initialization notice (using memory store):', err?.message || err);
    }
  }

  private seedInitialData() {
    // Seed Demo User & Admin
    this.users.set('usr_demo_1', {
      id: 'usr_demo_1',
      name: 'Alex Morgan',
      email: 'alex.morgan@example.com',
      role: 'admin',
      createdAt: '2026-01-15T08:00:00.000Z',
      downloadsCount: 142,
      tier: 'pro'
    });

    this.users.set('usr_demo_2', {
      id: 'usr_demo_2',
      name: 'Sarah Connor',
      email: 'sarah.c@example.com',
      role: 'user',
      createdAt: '2026-03-10T14:22:00.000Z',
      downloadsCount: 19,
      tier: 'free'
    });

    // Seed Blog Posts
    const posts: BlogPost[] = [
      {
        id: 'blog_1',
        slug: 'understanding-audio-bitrates-128k-vs-320k',
        title: 'Audio Quality Explained: 128 kbps vs 320 kbps MP3 vs FLAC',
        excerpt: 'A comprehensive guide to audio compression, sample rates, perceptual audio coding, and choosing the optimal bitrate for your listening setup.',
        content: `When converting or saving audio streams, choosing the right bitrate is critical for balancing file size with acoustic fidelity.

### What is Bitrate?
Bitrate measures the number of bits processed over a given unit of time (usually kilobits per second, or kbps). A higher bitrate preserves more high-frequency acoustic data and transient dynamics, at the cost of larger file sizes.

### 128 kbps vs 192 kbps vs 320 kbps
- **128 kbps**: Standard web streaming quality. Good for spoken word podcasts and audiobooks where vocal clarity is sufficient.
- **192 kbps / 256 kbps**: Transparent quality for most consumer headphones. Hard to distinguish from lossless for casual listening.
- **320 kbps**: Maximum MP3 standard. Delivers rich bass response, crisp highs, and full stereo separation ideal for studio monitors and high-end car audio.

### The Role of Container Formats
Modern formats like AAC and Opus achieve equal or superior acoustic transparency at significantly lower bitrates (e.g., 160 kbps Opus matches 320 kbps MP3). MediaForge provides configurable target bitrates during MP3 export to ensure your files meet your exact playback standards.`,
        category: 'Audio Engineering',
        author: 'Marcus Vance, Audio Systems Engineer',
        publishedAt: '2026-07-14T10:00:00.000Z',
        readTime: '5 min read',
        tags: ['Audio', 'MP3', 'Bitrate', 'Acoustics', 'DSP'],
        featuredImage: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
        seoTitle: 'Audio Bitrates Guide: 128kbps vs 320kbps MP3 Comparison',
        seoDescription: 'Learn how MP3 bitrates affect acoustic quality, spectral range, and file size.'
      },
      {
        id: 'blog_2',
        slug: 'video-codecs-h264-vs-hevc-vs-av1',
        title: 'Next-Gen Video Codecs: H.264 (AVC) vs H.265 (HEVC) vs AV1',
        excerpt: 'Explore how modern compression algorithms reduce streaming bandwidth by up to 50% while delivering crystal-clear 4K and 8K visual fidelity.',
        content: `Digital video represents over 70% of global internet bandwidth. The choice of video codec determines container compatibility, decode performance on mobile devices, and compression efficiency.

### Codec Comparison Breakdown
1. **H.264 / AVC**: The universal standard. Supported by 99.9% of hardware decoders, legacy TVs, and web browsers. Best for universal portability.
2. **H.265 / HEVC**: 40-50% more efficient than AVC. Standard for 4K UHD and HDR video, though licensing complexities held back browser adoption.
3. **AV1 (AOMedia Video 1)**: The modern royalty-free open standard developed by Google, Netflix, and Apple. Delivers pristine 1080p and 4K streams with drastically lower data requirements.

### Hardware vs Software Decoding
While AV1 and VP9 offer superior compression, ensure your target hardware has dedicated silicon decoding to prevent battery drain. MediaForge optimizes output containers to match your device profile.`,
        category: 'Video Technology',
        author: 'Elena Rostova, Video Streaming Architect',
        publishedAt: '2026-08-02T16:30:00.000Z',
        readTime: '6 min read',
        tags: ['Video', 'Codecs', 'H264', 'AV1', 'MP4'],
        featuredImage: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=1200&q=80',
        seoTitle: 'H.264 vs HEVC vs AV1 Video Codecs Compared',
        seoDescription: 'Deep dive into modern video encoding codecs, compression ratios, and compatibility.'
      },
      {
        id: 'blog_3',
        slug: 'legal-guide-to-media-fair-use-and-creative-commons',
        title: 'The Creator’s Guide to Fair Use, Creative Commons, and Public Domain Media',
        excerpt: 'A practical legal framework for content creators, researchers, and educators working with digital media archives.',
        content: `Understanding copyright boundaries is essential for any content creator, video editor, or researcher archiving educational material.

### 1. Public Domain
Works whose copyright has expired or that were created by federal public institutions (like NASA) reside in the public domain. These can be freely preserved, remixed, and distributed.

### 2. Creative Commons (CC) Licences
CC licenses grant specific permissions:
- **CC BY**: Attribution required, commercial use permitted.
- **CC BY-NC**: Non-commercial use only.
- **CC0**: Dedicated to the public domain with no rights reserved.

### 3. Fair Use Principles (17 U.S.C. § 107)
Fair use considers four statutory factors:
1. Purpose and character of use (transformative, educational, or commentary).
2. Nature of the copyrighted work.
3. Amount and substantiality of the portion taken.
4. Effect on the potential market value of the original work.

MediaForge is committed to supporting authorized workflows for content creators handling CC media, public domain archives, and self-produced footage.`,
        category: 'Compliance & Legal',
        author: 'David Harrison, Tech Legal Analyst',
        publishedAt: '2026-08-18T11:15:00.000Z',
        readTime: '7 min read',
        tags: ['Copyright', 'Fair Use', 'Creative Commons', 'DMCA', 'Education'],
        featuredImage: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
        seoTitle: 'Fair Use & Creative Commons Media Compliance Guide',
        seoDescription: 'Learn the legal framework of fair use, public domain, and Creative Commons licensing.'
      }
    ];

    for (const post of posts) {
      this.blogPosts.set(post.slug, post);
    }

    // Seed Sample DMCA Report
    this.dmcaReports.set('dmca_sample_1', {
      id: 'dmca_sample_1',
      complainantName: 'Acme Media Rights Ltd',
      email: 'legal@acmemedia.example',
      organization: 'Acme Publishing Rights Group',
      targetUrl: 'https://example-unauthorized-stream.com/video/9921',
      copyrightWorkDescription: 'Proprietary film festival documentary broadcast 2026',
      ownershipProofDescription: 'Registration Certificate #US-CR-2026-88192',
      reason: 'Unauthorized rehosting of copyrighted full-length broadcast.',
      goodFaithStatement: true,
      accuracyStatement: true,
      status: 'URL_BLOCKED',
      adminNotes: 'Domain added to security blocklist. Analysis blocked automatically.',
      createdAt: '2026-08-10T09:12:00.000Z',
      updatedAt: '2026-08-10T11:00:00.000Z'
    });

    // Seed Sample Audit Logs
    this.auditLogs.push(
      {
        id: 'log_1',
        action: 'SYSTEM_BOOT',
        ip: '127.0.0.1',
        details: 'MediaForge processing engine initialized. All providers online.',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString()
      },
      {
        id: 'log_2',
        action: 'DMCA_BLOCKLIST_UPDATED',
        ip: '127.0.0.1',
        details: 'Domain example-unauthorized-stream.com added to security filter.',
        timestamp: new Date(Date.now() - 3600000 * 12).toISOString()
      }
    );
  }

  public addAuditLog(action: string, ip: string, details: string) {
    const log: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action,
      ip,
      details,
      timestamp: new Date().toISOString()
    };
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
    postgresManager.saveAuditLog(log).catch(() => {});
    return log;
  }
}

export const db = new DatabaseStore();

