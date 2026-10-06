import crypto from 'crypto';
import { Redis } from '@upstash/redis';
import { MediaJob, MediaMetadata } from './types.js';

export interface RedisStatus {
  connected: boolean;
  provider: string;
  endpoint: string;
  latencyMs?: number;
  keysCount?: number;
  metrics: {
    cacheHits: number;
    cacheMisses: number;
    rateLimitChecks: number;
    cachedJobs: number;
  };
  error?: string | null;
}

function sanitizeEnvValue(raw?: string): string {
  if (!raw) return '';
  let val = raw.trim();
  // Strip variable name prefix if raw is VAR_NAME="value" or VAR_NAME=value
  if (val.includes('=')) {
    val = val.split('=').slice(1).join('=');
  }
  // Strip leading and trailing quotes or backslashes
  val = val.replace(/^["'\\]+|["'\\]+$/g, '').trim();
  return val;
}

class RedisManager {
  private client: Redis | null = null;
  public isConnected: boolean = false;
  public connectionError: string | null = null;
  public lastLatencyMs: number = 0;
  private endpoint: string = '';
  private metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    rateLimitChecks: 0,
    cachedJobs: 0,
  };

  // Resilient In-Memory Fallback Cache
  private memoryMetaCache = new Map<string, { data: MediaMetadata; expiresAt: number }>();
  private memoryJobCache = new Map<string, { data: MediaJob; expiresAt: number }>();
  private memoryRateLimiters = new Map<string, { count: number; resetAt: number }>();

  constructor() {
    this.initClient();
  }

  public initClient() {
    const rawUrl = process.env.UPSTASH_REDIS_REST_URL || 'https://genuine-hound-39524.upstash.io';
    const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN || 'AZpkAAIgcDFhZjY4YTdiMWYwMGE0ODBmYjBmNjNiZTgzYzUyZmE4NA';

    const url = sanitizeEnvValue(rawUrl);
    const token = sanitizeEnvValue(rawToken);

    if (!url || !token) {
      this.isConnected = false;
      this.connectionError = 'Missing Upstash Redis credentials';
      return;
    }

    try {
      this.endpoint = new URL(url).hostname;
      this.client = new Redis({
        url,
        token,
      });
    } catch (err: any) {
      this.isConnected = false;
      this.connectionError = err.message;
    }
  }

  public async ping(): Promise<boolean> {
    if (!this.client) {
      this.initClient();
      if (!this.client) return false;
    }

    const start = Date.now();
    try {
      const pong = await this.client.ping();
      this.lastLatencyMs = Date.now() - start;
      if (pong === 'PONG' || pong) {
        this.isConnected = true;
        this.connectionError = null;
        return true;
      }
      return false;
    } catch (err: any) {
      this.isConnected = false;
      this.connectionError = err.message || 'Redis connection unavailable';
      return false;
    }
  }

  public async getStatus(): Promise<RedisStatus> {
    const defaultStatus: RedisStatus = {
      connected: this.isConnected,
      provider: 'Upstash Serverless Redis',
      endpoint: this.endpoint || 'genuine-hound-39524.upstash.io',
      latencyMs: this.lastLatencyMs,
      metrics: this.metrics,
      error: this.connectionError,
    };

    if (!this.client) {
      return defaultStatus;
    }

    try {
      const start = Date.now();
      await this.client.ping();
      this.lastLatencyMs = Date.now() - start;
      this.isConnected = true;
      this.connectionError = null;

      const dbsize = await this.client.dbsize().catch(() => 0);

      return {
        connected: true,
        provider: 'Upstash Serverless Redis',
        endpoint: this.endpoint,
        latencyMs: this.lastLatencyMs,
        keysCount: typeof dbsize === 'number' ? dbsize : 0,
        metrics: this.metrics,
      };
    } catch (err: any) {
      this.isConnected = false;
      this.connectionError = err.message;
      return {
        ...defaultStatus,
        error: err.message,
      };
    }
  }

  // --- Caching Media Metadata ---
  public async getCachedMetadata(url: string): Promise<MediaMetadata | null> {
    const hash = crypto.createHash('sha256').update(url).digest('hex');
    const key = `mf:meta:${hash}`;

    // Try Redis first
    if (this.client) {
      try {
        const cached = await this.client.get<MediaMetadata>(key);
        if (cached) {
          this.metrics.cacheHits++;
          this.isConnected = true;
          return cached;
        }
      } catch (err: any) {
        this.isConnected = false;
        this.connectionError = err.message;
      }
    }

    // Fallback to memory cache
    const mem = this.memoryMetaCache.get(key);
    if (mem && mem.expiresAt > Date.now()) {
      this.metrics.cacheHits++;
      return mem.data;
    }

    this.metrics.cacheMisses++;
    return null;
  }

  public async setCachedMetadata(url: string, metadata: MediaMetadata, ttlSeconds: number = 3600): Promise<void> {
    const hash = crypto.createHash('sha256').update(url).digest('hex');
    const key = `mf:meta:${hash}`;

    // Save to memory cache immediately (guaranteed instant hit)
    this.memoryMetaCache.set(key, {
      data: metadata,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    // Try persisting to Redis
    if (this.client) {
      try {
        await this.client.set(key, metadata, { ex: ttlSeconds });
        this.isConnected = true;
      } catch (err: any) {
        this.isConnected = false;
        this.connectionError = err.message;
      }
    }
  }

  public async deleteCachedMetadata(url: string): Promise<void> {
    const hash = crypto.createHash('sha256').update(url).digest('hex');
    const key = `mf:meta:${hash}`;

    this.memoryMetaCache.delete(key);
    if (this.client) {
      try {
        await this.client.del(key);
      } catch (err: any) {
        // Silently catch deletion errors
      }
    }
  }

  // --- Distributed Rate Limiting ---
  public async checkRateLimit(
    ip: string,
    maxRequests: number = 60,
    windowSeconds: number = 60
  ): Promise<{ allowed: boolean; remaining: number; resetInSeconds: number }> {
    this.metrics.rateLimitChecks++;

    // Try Redis Rate Limiting
    if (this.client) {
      try {
        const key = `mf:ratelimit:${ip}`;
        const count = await this.client.incr(key);

        if (count === 1) {
          await this.client.expire(key, windowSeconds);
        }

        const ttl = await this.client.ttl(key);
        const allowed = count <= maxRequests;
        const remaining = Math.max(0, maxRequests - count);

        this.isConnected = true;
        return {
          allowed,
          remaining,
          resetInSeconds: ttl > 0 ? ttl : windowSeconds,
        };
      } catch (err: any) {
        this.isConnected = false;
        this.connectionError = err.message;
      }
    }

    // In-memory fallback rate limiter
    const now = Date.now();
    const existing = this.memoryRateLimiters.get(ip);

    if (!existing || existing.resetAt <= now) {
      this.memoryRateLimiters.set(ip, { count: 1, resetAt: now + windowSeconds * 1000 });
      return { allowed: true, remaining: maxRequests - 1, resetInSeconds: windowSeconds };
    }

    existing.count++;
    const remaining = Math.max(0, maxRequests - existing.count);
    const resetInSeconds = Math.ceil((existing.resetAt - now) / 1000);

    return {
      allowed: existing.count <= maxRequests,
      remaining,
      resetInSeconds,
    };
  }

  // --- Real-time Job State Cache ---
  public async cacheJob(job: MediaJob, ttlSeconds: number = 7200): Promise<void> {
    this.metrics.cachedJobs++;
    const key = `mf:job:${job.id}`;

    // Memory cache
    this.memoryJobCache.set(key, {
      data: job,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    if (this.client) {
      try {
        await this.client.set(key, job, { ex: ttlSeconds });
        this.isConnected = true;
      } catch (err: any) {
        this.isConnected = false;
        this.connectionError = err.message;
      }
    }
  }

  public async getCachedJob(jobId: string): Promise<MediaJob | null> {
    const key = `mf:job:${jobId}`;

    if (this.client) {
      try {
        const cached = await this.client.get<MediaJob>(key);
        if (cached) {
          this.isConnected = true;
          return cached;
        }
      } catch (err: any) {
        this.isConnected = false;
        this.connectionError = err.message;
      }
    }

    const mem = this.memoryJobCache.get(key);
    if (mem && mem.expiresAt > Date.now()) {
      return mem.data;
    }

    return null;
  }
}

export const redisManager = new RedisManager();
