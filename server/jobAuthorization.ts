import crypto from 'node:crypto';
import path from 'node:path';
import { MediaJob } from './types.js';

export const ANONYMOUS_JOB_CAPABILITY_TTL_MS = 15 * 60 * 1000;

export function createAnonymousJobCapability(jobId: string, now = Date.now()) {
  const capability = crypto.randomBytes(32).toString('base64url');
  return {
    capability,
    hash: crypto.createHash('sha256').update(`${jobId}:${capability}`).digest('hex'),
    expiresAt: new Date(now + ANONYMOUS_JOB_CAPABILITY_TTL_MS).toISOString(),
  };
}

export function verifyAnonymousJobCapability(job: MediaJob, capability?: string | null, now = Date.now()): boolean {
  if (!capability || !job.anonymousCapabilityHash || !job.anonymousCapabilityExpiresAt) return false;
  if (!Number.isFinite(Date.parse(job.anonymousCapabilityExpiresAt)) || Date.parse(job.anonymousCapabilityExpiresAt) <= now) return false;
  const candidate = crypto.createHash('sha256').update(`${job.id}:${capability}`).digest();
  let expected: Buffer;
  try { expected = Buffer.from(job.anonymousCapabilityHash, 'hex'); } catch { return false; }
  return expected.length === candidate.length && crypto.timingSafeEqual(expected, candidate);
}

export function canAccessJob(
  job: MediaJob,
  user: { id: string; role?: string } | null | undefined,
  capability?: string | null,
  now = Date.now(),
): boolean {
  if (user?.role === 'admin') return true;
  if (job.userId === 'usr_anonymous' || !job.userId) return verifyAnonymousJobCapability(job, capability, now);
  return !!user && user.id === job.userId;
}

export function safeJobStatus(job: MediaJob): Omit<MediaJob, 'downloadToken' | 'downloadUrl' | 'anonymousCapabilityHash' | 'anonymousCapabilityExpiresAt'> {
  const { downloadToken: _token, downloadUrl: _url, anonymousCapabilityHash: _hash, anonymousCapabilityExpiresAt: _expiry, ...publicJob } = job;
  return publicJob;
}

export function isContainedJobFilePath(root: string, jobId: string, storagePath: string, requestedPath: string): boolean {
  if (!jobId || !storagePath || !requestedPath || storagePath.includes('\\') || requestedPath.includes('\\')) return false;
  const expected = storagePath.replace(/^\/+/, '');
  const requested = requestedPath.replace(/^\/+/, '');
  if (expected !== requested || expected.split('/').some((part) => part === '.' || part === '..')) return false;
  const expectedParts = expected.split('/');
  if (expectedParts.length !== 3 || expectedParts[0] !== 'temp' || expectedParts[1] !== jobId) return false;
  const base = path.resolve(root);
  const candidate = path.resolve(base, jobId, expectedParts[2]);
  return candidate.startsWith(`${base}${path.sep}`) && path.dirname(candidate) === path.resolve(base, jobId);
}
