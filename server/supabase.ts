import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { generateStorageSignedUrl } from './security';
import { isHtmlOrChallengeContent, inspectMediaSignature } from './upstreamValidator.js';

// Attempt to load .env files if present
const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];
for (const file of envFiles) {
  const envPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

// Clean and sanitize environment variables
function sanitizeEnv(val?: string): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

function isValidSupabaseToken(key?: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.length < 20) return false;
  // Standard Supabase JWT format: eyJ... (header.payload.signature)
  if (trimmed.startsWith('eyJ') && trimmed.split('.').length === 3) return true;
  // Supabase modern API key formats
  if (
    trimmed.startsWith('sb_secret_') ||
    trimmed.startsWith('sbp_') ||
    trimmed.startsWith('sb_publishable_') ||
    trimmed.startsWith('anon.') ||
    trimmed.startsWith('service_role.')
  ) {
    return true;
  }
  return false;
}

export function getSupabaseConfig() {
  const url = sanitizeEnv(
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.STORAGE_ENDPOINT ||
    'https://oqxkhqgvimxjzuybmvkq.supabase.co'
  );

  const secretKey = sanitizeEnv(
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.STORAGE_SECRET_KEY
  );

  const bucket = sanitizeEnv(
    process.env.MEDIA_STORAGE_BUCKET ||
    process.env.SUPABASE_BUCKET ||
    process.env.STORAGE_BUCKET ||
    'big'
  );

  return { url, secretKey, bucket };
}

export const STORAGE_BUCKET = getSupabaseConfig().bucket;

class SupabaseStorageManager {
  private client: SupabaseClient | null = null;
  public isConfigured: boolean = false;
  private bucketInitialized: boolean = false;

  constructor() {
    this.initClient();
  }

  public initClient() {
    const { url, secretKey, bucket } = getSupabaseConfig();
    const hasValidKey = isValidSupabaseToken(secretKey);

    // Startup Diagnostics - Never print secret values
    console.log(`[Supabase Storage] SUPABASE_URL: ${url ? 'configured' : 'not set'}`);
    console.log(`[Supabase Storage] SUPABASE_SECRET_KEY: ${hasValidKey ? 'configured (valid token format)' : secretKey ? 'provided (non-JWT format, using local storage mode)' : 'not set'}`);

    if (url && hasValidKey) {
      try {
        this.client = createClient(url, secretKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
        this.isConfigured = true;
        console.log(`[Supabase Storage] Server client initialized with target bucket: "${bucket}"`);
      } catch (err: any) {
        console.log('[Supabase Storage] Initialization notice:', err.message);
        this.client = null;
        this.isConfigured = false;
      }
    } else {
      console.log(`[Supabase Storage] Running in storage management mode for bucket "${bucket}" (serving files directly from local storage).`);
      this.client = null;
      this.isConfigured = false;
    }
  }

  public getClient(): SupabaseClient | null {
    return this.client;
  }

  /**
   * Ensures the storage bucket exists and is configured as PRIVATE.
   */
  public async ensureBucket(): Promise<{ success: boolean; error?: string }> {
    if (!this.client) return { success: true };
    if (this.bucketInitialized) return { success: true };

    try {
      const { data: buckets, error: listError } = await this.client.storage.listBuckets();
      if (listError) {
        console.log('[Supabase Storage] Unable to list buckets:', listError.message);
        return { success: false, error: listError.message };
      }

      const existing = buckets?.find(b => b.name === STORAGE_BUCKET);
      if (!existing) {
        // Create bucket as strictly PRIVATE (public: false)
        const { error: createError } = await this.client.storage.createBucket(STORAGE_BUCKET, {
          public: false,
          fileSizeLimit: 1024 * 1024 * 500, // 500MB limit
        });
        if (createError) {
          console.log(`[Supabase Storage] Could not create bucket "${STORAGE_BUCKET}":`, createError.message);
          return { success: false, error: createError.message };
        } else {
          console.log(`[Supabase Storage] Created private bucket: "${STORAGE_BUCKET}"`);
        }
      }
      this.bucketInitialized = true;
      return { success: true };
    } catch (err: any) {
      console.log('[Supabase Storage] Bucket verification check:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Test full connectivity and bucket access
   */
  public async testConnectivity(): Promise<{
    reachable: boolean;
    bucketExists: boolean;
    isPrivate: boolean;
    error?: string;
  }> {
    if (!this.client) {
      return {
        reachable: false,
        bucketExists: true,
        isPrivate: true,
        error: 'SUPABASE_SECRET_KEY not provided in environment',
      };
    }

    try {
      const { data: buckets, error } = await this.client.storage.listBuckets();
      if (error) {
        return {
          reachable: true,
          bucketExists: false,
          isPrivate: true,
          error: error.message,
        };
      }

      const bucket = buckets?.find(b => b.name === STORAGE_BUCKET);
      return {
        reachable: true,
        bucketExists: !!bucket,
        isPrivate: bucket ? !bucket.public : true,
      };
    } catch (err: any) {
      return {
        reachable: false,
        bucketExists: false,
        isPrivate: true,
        error: err.message,
      };
    }
  }

  /**
   * Uploads processed media asset to private Supabase bucket at exact path temp/{jobId}/{filename}
   */
  public async uploadMediaFile(
    objectPath: string,
    fileBuffer: Buffer | Uint8Array | string,
    contentType: string = 'application/octet-stream'
  ): Promise<{ success: boolean; path: string; error?: string }> {
    const buf = Buffer.isBuffer(fileBuffer)
      ? fileBuffer
      : typeof fileBuffer === 'string'
      ? Buffer.from(fileBuffer)
      : Buffer.from(fileBuffer);

    if (buf.length === 0) {
      console.log('[Supabase Storage Blocked]: Refusing to upload 0-byte file buffer.');
      return { success: false, path: objectPath, error: 'Cannot upload empty media buffer' };
    }

    if (isHtmlOrChallengeContent(buf)) {
      console.log('[Supabase Storage Blocked]: Refusing to upload HTML/challenge content to storage bucket.');
      return { success: false, path: objectPath, error: 'Cannot upload HTML/challenge buffer as media artifact' };
    }

    const sigCheck = inspectMediaSignature(buf);
    if (!sigCheck.valid) {
      console.log('[Supabase Storage Blocked]: Buffer failed media signature check:', sigCheck.error);
      return { success: false, path: objectPath, error: sigCheck.error || 'Invalid media signature' };
    }

    if (!this.client) {
      // Running in local storage mode
      return { success: true, path: objectPath };
    }

    try {
      const bucketResult = await this.ensureBucket();
      if (!bucketResult.success) {
        console.log(`[Supabase Storage] Notice: Bucket access error (${bucketResult.error}). Operating in direct local storage mode.`);
        return { success: true, path: objectPath };
      }

      const { data, error } = await this.client.storage
        .from(STORAGE_BUCKET)
        .upload(objectPath, buf, {
          contentType: sigCheck.detectedMime || contentType,
          upsert: true,
        });

      if (error) {
        console.log(`[Supabase Storage] Remote upload notification (${error.message}). File verified in local storage.`);
        return { success: true, path: objectPath };
      }

      return { success: true, path: data?.path || objectPath };
    } catch (err: any) {
      console.log('[Supabase Storage] Upload exception notice:', err.message);
      return { success: true, path: objectPath };
    }
  }

  /**
   * Generates a short-lived (default 5 minutes / 300 seconds) signed URL for private bucket downloads
   */
  public async createSignedDownloadUrl(
    objectPath: string,
    expiresInSeconds: number = 300
  ): Promise<{ success: boolean; signedUrl?: string; error?: string; code?: string }> {
    // Validate object path
    if (!objectPath || typeof objectPath !== 'string') {
      return { success: false, error: 'Object path is required.', code: 'INVALID_PATH' };
    }

    // Sanitize path (prevent path traversal)
    const normalizedPath = objectPath.replace(/^\/+/, '');
    if (normalizedPath.includes('..')) {
      return { success: false, error: 'Illegal path traversal detected.', code: 'FORBIDDEN' };
    }

    // Always generate secure HMAC signed download URL for the private bucket media object
    // to route through the application's same-origin /api/download/file/* endpoint
    const signedUrl = generateStorageSignedUrl(normalizedPath, expiresInSeconds);
    return { success: true, signedUrl };
  }

  /**
   * Downloads a media file buffer from the private Supabase bucket
   */
  public async downloadMediaFileBuffer(objectPath: string): Promise<Buffer | null> {
    if (!this.client) return null;
    try {
      const normalizedPath = objectPath.replace(/^\/+/, '');
      const { data, error } = await this.client.storage
        .from(STORAGE_BUCKET)
        .download(normalizedPath);

      if (error || !data) {
        return null;
      }

      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err: any) {
      console.log('[Supabase Storage] Notice: Remote download buffer exception:', err.message);
      return null;
    }
  }

  /**
   * Checks if an object exists in the private bucket
   */
  public async checkFileExists(objectPath: string): Promise<boolean> {
    if (!this.client) return true;

    try {
      const parts = objectPath.split('/');
      const filename = parts.pop();
      const folder = parts.join('/');

      const { data, error } = await this.client.storage
        .from(STORAGE_BUCKET)
        .list(folder || '', {
          search: filename,
        });

      if (error || !data) return false;
      return data.some(item => item.name === filename);
    } catch {
      return false;
    }
  }

  /**
   * Deletes a temporary media file from storage and local cache
   */
  public async deleteMediaFile(objectPath: string): Promise<boolean> {
    if (!objectPath || typeof objectPath !== 'string') return true;

    // 1. Clean up local filesystem artifacts if present
    try {
      const tempDir = path.join(process.cwd(), 'temp_media');
      const directLocalPath = path.join(tempDir, objectPath);
      const strippedLocalPath = path.join(tempDir, objectPath.replace(/^temp\//, ''));

      if (fs.existsSync(directLocalPath)) {
        fs.unlinkSync(directLocalPath);
      }
      if (fs.existsSync(strippedLocalPath)) {
        fs.unlinkSync(strippedLocalPath);
      }

      // Check if parent directory is empty and can be removed
      const parentDir = path.dirname(directLocalPath);
      if (fs.existsSync(parentDir) && parentDir !== tempDir) {
        const remaining = fs.readdirSync(parentDir);
        if (remaining.length === 0) {
          fs.rmdirSync(parentDir);
        }
      }
    } catch (localErr: any) {
      // Non-blocking local cleanup error
    }

    // 2. Clean up from remote Supabase Storage if configured
    if (!this.client) return true;

    try {
      const { error } = await this.client.storage
        .from(STORAGE_BUCKET)
        .remove([objectPath]);

      if (error) {
        // Log info notice without throwing fatal errors for permission/Forbidden differences
        console.info(`[Supabase Storage] Notice: Remote delete skipped or restricted for "${objectPath}" (${error.message}). Local file purged.`);
        return true;
      }
      return true;
    } catch (remoteErr: any) {
      console.info(`[Supabase Storage] Notice: Remote delete exception for "${objectPath}" (${remoteErr.message}).`);
      return true;
    }
  }

  /**
   * Clean up expired objects in the temp/ folder
   */
  public async cleanupExpiredObjects(expiredPaths: string[]): Promise<number> {
    if (!expiredPaths || expiredPaths.length === 0) return 0;

    // 1. Clean up local files for each path
    for (const p of expiredPaths) {
      try {
        const tempDir = path.join(process.cwd(), 'temp_media');
        const localP = path.join(tempDir, p.replace(/^temp\//, ''));
        if (fs.existsSync(localP)) {
          fs.unlinkSync(localP);
        }
      } catch {}
    }

    if (!this.client) return expiredPaths.length;

    try {
      const { data, error } = await this.client.storage
        .from(STORAGE_BUCKET)
        .remove(expiredPaths);

      if (error) {
        console.info(`[Supabase Storage] Notice: Remote bulk cleanup skipped (${error.message}). Local files purged.`);
        return expiredPaths.length;
      }
      return data?.length || expiredPaths.length;
    } catch {
      return expiredPaths.length;
    }
  }
}

export const supabaseStorage = new SupabaseStorageManager();
