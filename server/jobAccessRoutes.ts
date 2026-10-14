import crypto from 'node:crypto';
import { Application, Request, RequestHandler, Response } from 'express';
import { MediaJob } from './types.js';
import { canAccessJob, isContainedJobFilePath, safeJobStatus } from './jobAuthorization.js';
import { verifyDownloadToken, verifyStorageSignedToken } from './security.js';
import { sanitizeMediaFilename, TEMP_MEDIA_DIR } from './ffmpeg.js';

export interface JobAccessRouteDependencies {
  getJob(id: string): MediaJob | undefined;
  cancelJob(id: string): boolean;
}

export function registerJobLinkAuthorizationRoutes(
  app: Application,
  getJob: (id: string) => MediaJob | undefined,
  issueLink: (req: Request, res: Response, id: string) => unknown,
): void {
  const dispatch = (req: Request, res: Response, id: string) => {
    const job = getJob(id);
    if (!job) return res.status(404).json({ success: false, data: null, error: { code: 'JOB_NOT_FOUND', message: 'The requested processing job does not exist.' } });
    if (!authorizeJobRequest(req, res, job)) return;
    if (job.status !== 'READY') return res.status(400).json({ success: false, data: null, error: { code: 'JOB_NOT_READY', message: 'Media file is not ready for download.' } });
    const expiry = Date.parse(job.expiresAt);
    if (!Number.isFinite(expiry) || Date.now() >= expiry) return res.status(410).json({ success: false, data: null, error: { code: 'JOB_EXPIRED', message: 'This download is no longer available.' } });
    res.setHeader('Cache-Control', 'private, no-store');
    return issueLink(req, res, id);
  };

  app.get('/api/download', (req, res) => {
    const id = (req.query.jobId as string) || (req.query.id as string);
    if (!id) return res.status(400).json({ success: false, data: null, error: { code: 'INVALID_PAYLOAD', message: 'Parameter "jobId" is required to request a download link.' } });
    return dispatch(req, res, id);
  });
  app.get('/api/jobs/:id/download', (req, res) => dispatch(req, res, req.params.id));
  app.get('/api/download/:jobId', (req, res, next) => {
    if (req.params.jobId === 'file' || req.params.jobId === 'stream') return next();
    return dispatch(req, res, req.params.jobId);
  });
  app.post('/api/download', (req, res, next) => {
    if (!req.body?.jobId) return next();
    return dispatch(req, res, String(req.body.jobId));
  });
}

export function authorizeJobRequest(req: Request, res: Response, job: MediaJob): boolean {
  if (canAccessJob(job, req.user, req.get('x-job-capability'))) return true;
  res.status(req.user ? 403 : 401).json({
    success: false,
    data: null,
    error: { code: 'UNAUTHORIZED', message: 'Job authorization is required.' },
  });
  return false;
}

export function authorizeSignedJobFile(
  req: Request,
  res: Response,
  jobId: string,
  storagePath: string,
  getJob: (id: string) => MediaJob | undefined,
): MediaJob | null {
  const signature = verifyStorageSignedToken(storagePath, String(req.query.token || ''), String(req.query.expires || ''));
  if (!signature.isValid) {
    res.status(signature.statusCode || 401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A valid, unexpired download signature is required.' } });
    return null;
  }
  const job = getJob(jobId);
  if (!job) {
    res.status(404).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: 'The requested download does not exist.' } });
    return null;
  }
  if (job.status !== 'READY') {
    res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'The requested media file is unavailable.' } });
    return null;
  }
  const expiry = Date.parse(job.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) {
    res.status(410).json({ success: false, error: { code: 'JOB_EXPIRED', message: 'Download authorization for this job has expired.' } });
    return null;
  }
  if (!isContainedJobFilePath(TEMP_MEDIA_DIR, jobId, job.storagePath || '', storagePath)) {
    res.status(403).json({ success: false, error: { code: 'PATH_MISMATCH', message: 'Requested download path is invalid.' } });
    return null;
  }
  return job;
}

export function authorizeDownloadStreamToken(
  req: Request,
  res: Response,
  token: string,
  getJob: (id: string) => MediaJob | undefined,
): MediaJob | null {
  const payload = verifyDownloadToken(token);
  if (!payload) {
    res.status(410).json({ success: false, error: { code: 'TOKEN_EXPIRED', message: 'Download token has expired or is invalid. Please request a new download.' } });
    return null;
  }
  const job = getJob(payload.jobId);
  const submitted = Buffer.from(token);
  const recorded = Buffer.from(job?.downloadToken || '');
  if (!job || submitted.length !== recorded.length || submitted.length === 0 || !crypto.timingSafeEqual(submitted, recorded)) {
    res.status(403).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Job authorization is required.' } });
    return null;
  }
  if (!authorizeJobRequest(req, res, job)) return null;
  const expectedPath = `temp/${job.id}/${sanitizeMediaFilename(payload.title, payload.quality, payload.format)}`;
  if (job.status !== 'READY' || job.storagePath !== expectedPath || !isContainedJobFilePath(TEMP_MEDIA_DIR, job.id, job.storagePath, expectedPath)) {
    res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'The requested media file is unavailable.' } });
    return null;
  }
  const expiry = Date.parse(job.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) {
    res.status(410).json({ success: false, error: { code: 'JOB_EXPIRED', message: 'This download has expired.' } });
    return null;
  }
  return job;
}

export function signedFileAuthorizationMiddleware(getJob: (id: string) => MediaJob | undefined): RequestHandler {
  return (req, res, next) => {
    let rawPath = req.params[0] || (req.params as any)['*'] || '';
    try { rawPath = decodeURIComponent(rawPath); } catch {}
    const normalized = String(rawPath).replace(/^\/+/, '');
    if (!normalized) return res.status(400).json({ success: false, error: { code: 'INVALID_PATH', message: 'Download path is missing.' } });
    const storagePath = normalized.startsWith('temp/') ? normalized : `temp/${normalized}`;
    const jobId = storagePath.replace(/^temp\//, '').split('/')[0];
    if (!jobId) return res.status(400).json({ success: false, error: { code: 'INVALID_PATH', message: 'Job ID missing from download path.' } });
    const job = authorizeSignedJobFile(req, res, jobId, storagePath, getJob);
    if (!job) return;
    res.locals.authorizedJob = job;
    return next();
  };
}

export function downloadStreamAuthorizationMiddleware(getJob: (id: string) => MediaJob | undefined): RequestHandler {
  return (req, res, next) => {
    const job = authorizeDownloadStreamToken(req, res, req.params.token, getJob);
    if (!job) return;
    res.locals.authorizedJob = job;
    return next();
  };
}

export function previewJobAuthorizationMiddleware(getJob: (id: string) => MediaJob | undefined): RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const rawId = (req.params as any).id || (req.query.id as string) || (req.query.url as string) || 'default_stream';
    const cleanId = String(rawId).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80) || 'preview_stream';
    const existingJob = getJob(cleanId) || getJob(rawId);
    if (existingJob && !authorizeJobRequest(req, res, existingJob)) return;
    res.locals.previewJob = existingJob;
    return next();
  };
}

export function registerJobStatusAndCancelRoutes(app: Application, dependencies: JobAccessRouteDependencies): void {
  app.get('/api/jobs/:id', (req, res) => {
    const job = dependencies.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'JOB_NOT_FOUND', message: 'The requested processing job does not exist or has expired.' },
      });
    }
    if (!authorizeJobRequest(req, res, job)) return;
    res.setHeader('Cache-Control', 'private, no-store');

    if (job.status === 'FAILED') {
      if (!job.errorMessage || job.errorMessage === 'undefined' || job.errorMessage.trim() === '') {
        job.errorMessage = job.errorCode === 'UPSTREAM_BOT_VERIFICATION_REQUIRED'
          ? 'Unable to fetch this video right now. The video service or source platform requires additional verification. Please try another supported URL.'
          : 'Media processing failed during extraction.';
      }
      if (!job.stepMessage || job.stepMessage === 'undefined' || job.stepMessage.trim() === '') job.stepMessage = job.errorMessage;
    }
    return res.json({ success: true, data: safeJobStatus(job), error: null });
  });

  app.post('/api/jobs/:id/cancel', (req, res) => {
    const job = dependencies.getJob(req.params.id);
    if (!job) return res.status(404).json({ success: false, data: { cancelled: false }, error: { code: 'JOB_NOT_FOUND', message: 'Job not found.' } });
    if (!authorizeJobRequest(req, res, job)) return;
    const success = dependencies.cancelJob(req.params.id);
    return res.json({
      success,
      data: { cancelled: success },
      error: success ? null : { code: 'CANNOT_CANCEL', message: 'Job already completed or not found.' },
    });
  });
}
