import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { MediaJob, JobStatus } from './types.js';
import { db } from './db.js';
import { generateDownloadToken, generateStorageSignedUrl } from './security.js';
import { postgresManager } from './postgres.js';
import { redisManager } from './redis.js';
import { supabaseStorage, STORAGE_BUCKET } from './supabase.js';
import {
  generateMediaFile,
  sanitizeMediaFilename,
  getMimeTypeForFormat,
  verifyMediaWithFfprobe,
  validateMediaFile,
  sanitizeLogMessage,
  TEMP_MEDIA_DIR,
} from './ffmpeg.js';
import { ytDlpService } from './ytDlpService.js';
import { verifyDownloadArtifact } from './verifier.js';

export class BackgroundJobQueue {
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startGarbageCollector();
  }

  /**
   * Create a new media job and add to queue
   */
  public createJob(params: {
    userId?: string;
    sourceUrl: string;
    provider: string;
    mediaTitle: string;
    thumbnailUrl: string;
    selectedFormat: string;
    selectedQuality: string;
    formatType: 'video' | 'audio' | 'trim' | 'thumbnail' | 'subtitle';
    fileSizeBytes?: number;
    fileSizeFormatted?: string;
    directUrl?: string;
    trimParams?: { startTime: number; endTime: number };
  }): MediaJob {
    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes TTL

    const cleanFilename = sanitizeMediaFilename(params.mediaTitle, params.selectedQuality, params.selectedFormat);
    const storagePath = `temp/${id}/${cleanFilename}`;
    const mimeType = getMimeTypeForFormat(params.selectedFormat);

    const job: MediaJob = {
      id,
      userId: params.userId || 'usr_anonymous',
      sourceUrl: params.sourceUrl,
      provider: params.provider,
      mediaTitle: params.mediaTitle,
      thumbnailUrl: params.thumbnailUrl,
      selectedFormat: params.selectedFormat,
      selectedQuality: params.selectedQuality,
      formatType: params.formatType,
      status: 'QUEUED',
      progress: 5,
      stepMessage: 'Job queued in background worker pipeline...',
      storageBucket: STORAGE_BUCKET,
      storagePath,
      storageObjectKey: storagePath,
      fileSizeBytes: params.fileSizeBytes || 5 * 1024 * 1024,
      fileSizeFormatted: params.fileSizeFormatted || '5 MB',
      mimeType,
      trimParams: params.trimParams,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    db.jobs.set(id, job);
    postgresManager.saveJob(job).catch(() => {});
    redisManager.cacheJob(job).catch(() => {});
    db.addAuditLog('JOB_QUEUED', '127.0.0.1', `Job ${id} (${params.formatType} - ${params.selectedQuality}) queued for processing.`);

    // Start background processing immediately
    this.processJob(id, params.directUrl);

    return job;
  }

  /**
   * Worker execution with real FFmpeg processing & ffprobe validation
   */
  private async processJob(jobId: string, directUrl?: string) {
    const job = db.jobs.get(jobId);
    if (!job) return;

    try {
      // Step 1: Analyzing & Demuxing (0.3s)
      await this.delay(300);
      this.updateJob(jobId, {
        status: 'ANALYZING',
        progress: 20,
        stepMessage: 'Fetching media stream headers & verifying codec containers...',
      });

      // Step 2: Processing (Audio transcode or MP4 remux or Trimming)
      await this.delay(400);
      if (this.isJobCancelled(jobId)) return;

      if (job.formatType === 'audio') {
        this.updateJob(jobId, {
          status: 'PROCESSING',
          progress: 45,
          stepMessage: `Extracting PCM audio track & transcoding to ${job.selectedQuality} MP3 via FFmpeg...`,
        });
      } else if (job.formatType === 'trim') {
        const trimText = job.trimParams ? `${job.trimParams.startTime}s - ${job.trimParams.endTime}s` : '0s - 30s';
        this.updateJob(jobId, {
          status: 'PROCESSING',
          progress: 40,
          stepMessage: `Seeking keyframe boundaries (${trimText})...`,
        });
      } else {
        this.updateJob(jobId, {
          status: 'PROCESSING',
          progress: 50,
          stepMessage: `Multiplexing video and audio streams at ${job.selectedQuality}...`,
        });
      }

      // Step 3: FFmpeg Generation & verification
      const ffmpegOutput = await generateMediaFile({
        jobId,
        sourceUrl: job.sourceUrl,
        thumbnailUrl: job.thumbnailUrl,
        title: job.mediaTitle,
        format: job.selectedFormat,
        quality: job.selectedQuality,
        formatType: job.formatType,
        directUrl: directUrl && directUrl !== job.sourceUrl ? directUrl : undefined,
        trimParams: job.trimParams,
      });

      if (this.isJobCancelled(jobId)) return;

      // Validate media file with ffprobe before upload
      const validation = await validateMediaFile(
        ffmpegOutput.filePath,
        job.formatType === 'audio' ? 'audio' : 'video'
      );
      if (!validation.valid) {
        throw new Error(`Media validation failed: ${validation.error}`);
      }

      this.updateJob(jobId, {
        status: 'PROCESSING',
        progress: 85,
        stepMessage: 'Verifying media container with ffprobe & uploading to storage...',
      });

      const cleanFilename = ffmpegOutput.filename;
      const storagePath = `temp/${jobId}/${cleanFilename}`;
      const fileBuffer = await fs.promises.readFile(ffmpegOutput.filePath);
      const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Update storage path in db so verification and storage match
      this.updateJob(jobId, {
        storageBucket: STORAGE_BUCKET,
        storagePath,
        storageObjectKey: storagePath,
        mimeType: ffmpegOutput.mimeType,
        sha256,
      });

      // Step 4: Upload processed media to private Supabase Storage bucket
      const uploadRes = await supabaseStorage.uploadMediaFile(
        storagePath,
        fileBuffer,
        ffmpegOutput.mimeType
      );

      if (!uploadRes.success) {
        throw new Error(`Storage upload failed: ${uploadRes.error || 'Unknown upload error'}`);
      }

      // Step 5: Strict 10-Point Pre-READY Verification
      const artifactCheck = await verifyDownloadArtifact(jobId);
      if (!artifactCheck.valid) {
        throw new Error(`Download artifact verification failed: ${artifactCheck.error || 'Invalid media artifact'}`);
      }

      // Step 6: Generate short-lived signed URL for private storage
      const signedRes = await supabaseStorage.createSignedDownloadUrl(storagePath, 300);

      const token = generateDownloadToken({
        jobId,
        mediaId: job.id,
        format: job.selectedFormat,
        quality: job.selectedQuality,
        title: job.mediaTitle,
        mimeType: ffmpegOutput.mimeType,
        directUrl: directUrl || job.sourceUrl,
      });

      const downloadUrl = signedRes.signedUrl || generateStorageSignedUrl(storagePath, 300);

      // 15-Point Diagnostic logging for every completed job
      let sourceHostname = 'direct';
      try {
        if (job.sourceUrl) {
          sourceHostname = new URL(job.sourceUrl).hostname;
        }
      } catch {}

      console.log('\n========================================');
      console.log('[Media Pipeline 15-Point Diagnostics]');
      console.log(`1. Job ID:               ${jobId}`);
      console.log(`2. User ID:              ${job.userId || 'usr_anonymous'}`);
      console.log(`3. Source URL:           ${job.sourceUrl}`);
      console.log(`4. Source Hostname:      ${sourceHostname}`);
      console.log(`5. Provider:             ${job.provider}`);
      console.log(`6. Format Type:          ${job.formatType}`);
      console.log(`7. Selected Format:      ${job.selectedFormat}`);
      console.log(`8. Selected Quality:     ${job.selectedQuality}`);
      console.log(`9. Direct URL Used:      ${directUrl || job.sourceUrl}`);
      console.log(`10. Local File Path:     ${ffmpegOutput.filePath}`);
      console.log(`11. File Size Bytes:     ${ffmpegOutput.fileSizeBytes}`);
      console.log(`12. MIME Type:           ${ffmpegOutput.mimeType}`);
      console.log(`13. SHA-256 Digest:      ${sha256}`);
      console.log(`14. Container Valid:     PASS (ffprobe verified)`);
      console.log(`15. Storage Object Path: ${storagePath}`);
      console.log('========================================\n');

      this.updateJob(jobId, {
        status: 'READY',
        progress: 100,
        stepMessage: 'Processing complete! Ready for authorized download.',
        downloadToken: token,
        downloadUrl,
        storageBucket: STORAGE_BUCKET,
        storagePath,
        storageObjectKey: storagePath,
        fileSizeBytes: ffmpegOutput.fileSizeBytes,
        fileSizeFormatted: `${(ffmpegOutput.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`,
        mimeType: ffmpegOutput.mimeType,
        sha256,
      });

      db.addAuditLog('JOB_COMPLETED', '127.0.0.1', `Job ${jobId} ready in storage (${storagePath}, ${ffmpegOutput.fileSizeBytes} bytes).`);
    } catch (err: any) {
      // 1. Immediately remove any partial or incomplete local files for this job
      const jobDir = path.join(TEMP_MEDIA_DIR, jobId);
      if (fs.existsSync(jobDir)) {
        try {
          fs.rmSync(jobDir, { recursive: true, force: true });
        } catch {}
      }

      // 2. Classify error and format structured error response via YtDlpService
      const classified = ytDlpService.classifyError(err);
      const errorCode = classified.code || 'EXTRACTION_FAILED';
      let errorMessage =
        classified.userMessage && classified.userMessage !== 'undefined' && classified.userMessage.trim().length > 0
          ? classified.userMessage
          : classified.message && classified.message !== 'undefined' && classified.message.trim().length > 0
          ? classified.message
          : errorCode === 'UPSTREAM_BOT_VERIFICATION_REQUIRED'
          ? 'Unable to fetch this video right now. The video service or source platform requires additional verification. Please try another supported URL.'
          : 'Media processing failed during extraction.';

      if (err?.fallbackDetail && !errorMessage.includes('RapidAPI fallback failed')) {
        errorMessage = `${errorMessage} | RapidAPI fallback failed (${err.fallbackDetail})`;
      } else if (typeof err?.message === 'string' && err.message.includes(' | RapidAPI fallback failed') && !errorMessage.includes('RapidAPI fallback failed')) {
        const match = err.message.match(/ \|\s*RapidAPI fallback failed\s*\([^\)]+\)/i);
        if (match) errorMessage = `${errorMessage}${match[0]}`;
      }
      const stepMessage = errorMessage;

      // 3. Mark job as strictly FAILED without media references or fallback
      this.updateJob(jobId, {
        status: 'FAILED',
        progress: 0,
        errorCode,
        errorMessage,
        stepMessage,
        downloadToken: undefined,
        downloadUrl: undefined,
        storageBucket: undefined,
        storagePath: undefined,
        storageObjectKey: undefined,
        fileSizeBytes: 0,
        fileSizeFormatted: undefined,
        mimeType: undefined,
        sha256: undefined,
      });

      // 4. Safely log outcome without exposing cookies, headers, or secrets
      const safeLogMsg = sanitizeLogMessage(err.message || 'Media processing error');
      console.log(`[Job Worker] Job ${jobId} finished with status: ${errorCode}`);
      db.addAuditLog('JOB_FAILED', '127.0.0.1', `Job ${jobId} ended (${errorCode}): ${safeLogMsg}`);
    }
  }

  private isJobCancelled(jobId: string): boolean {
    const job = db.jobs.get(jobId);
    return !job || job.status === 'CANCELLED';
  }

  public cancelJob(jobId: string): boolean {
    const job = db.jobs.get(jobId);
    if (!job) return false;
    if (job.status === 'READY' || job.status === 'FAILED') return false;

    ytDlpService.cancelJobProcess(jobId);

    job.status = 'CANCELLED';
    job.stepMessage = 'Job cancelled by user request.';
    job.updatedAt = new Date().toISOString();
    db.jobs.set(jobId, job);
    postgresManager.saveJob(job).catch(() => {});
    db.addAuditLog('JOB_CANCELLED', '127.0.0.1', `Job ${jobId} was cancelled.`);
    return true;
  }

  public updateJob(jobId: string, updates: Partial<MediaJob>) {
    const existing = db.jobs.get(jobId);
    if (!existing) return;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    db.jobs.set(jobId, updated);
    postgresManager.saveJob(updated).catch(() => {});
    redisManager.cacheJob(updated).catch(() => {});
  }

  public getJob(jobId: string): MediaJob | undefined {
    return db.jobs.get(jobId);
  }

  private startGarbageCollector() {
    // Check every 2 minutes for expired jobs and clean up
    setInterval(async () => {
      const now = Date.now();
      for (const [id, job] of db.jobs.entries()) {
        const expiresAt = new Date(job.expiresAt).getTime();
        if (now > expiresAt && job.status !== 'EXPIRED') {
          job.status = 'EXPIRED';
          job.stepMessage = 'Download link expired. Please regenerate your download.';
          
          // Clean up temporary file from private storage
          if (job.storagePath) {
            supabaseStorage.deleteMediaFile(job.storagePath).catch(() => {});
          }

          job.downloadUrl = undefined;
          job.downloadToken = undefined;
          db.jobs.set(id, job);
          postgresManager.saveJob(job).catch(() => {});
        }
      }
    }, 120000);
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const jobQueue = new BackgroundJobQueue();
