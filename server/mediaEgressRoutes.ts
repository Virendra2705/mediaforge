import express from 'express';
import { pipeline } from 'node:stream/promises';
import { providerRegistry } from './providers.js';
import { getPositiveIntegerConfig, requestSafeHttp, SafeHttpResponse } from './outboundHttp.js';
import { fetchAndValidateMediaStream } from './upstreamValidator.js';
import { checkRateLimit } from './security.js';

type SafeRequest = typeof requestSafeHttp;
type InspectorRateLimit = (req: express.Request) => { allowed: boolean; resetInSeconds: number };

export function registerMediaEgressRoutes(
  app: express.Application,
  transport: SafeRequest = requestSafeHttp,
  inspectorRateLimit: InspectorRateLimit = (req) => checkRateLimit(req, 30),
): void {
  app.get(['/api/social-download/proxy', '/api/download/proxy', '/api/easydown/proxy'], async (req, res) => {
    const targetUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const filename = (typeof req.query.filename === 'string' && req.query.filename) || 'media.mp4';
    const isDownload = req.query.dl === '1' || req.query.download === '1' || req.query.download === 'true';
    if (!targetUrl) return res.status(400).send('Missing target media URL.');

    const controller = new AbortController();
    const cancelIfDisconnected = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.once('close', cancelIfDisconnected);
    let upstream: SafeHttpResponse | undefined;
    try {
      upstream = await transport(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        maxResponseBytes: getPositiveIntegerConfig(process.env.MEDIA_PROXY_MAX_BYTES, 512 * 1024 * 1024),
        overallTimeoutMs: 120_000,
      });
      if (upstream.statusCode < 200 || upstream.statusCode >= 300) {
        upstream.abort();
        return res.status(upstream.statusCode).send('Failed to fetch stream from origin provider.');
      }

      res.setHeader('Content-Type', upstream.headers['content-type'] || 'video/mp4');
      // Omit upstream Content-Length because it may be missing or incorrect.
      const safeFilename = encodeURIComponent(filename);
      res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${safeFilename}"`);
      await pipeline(upstream.body, res);
    } catch (error: any) {
      upstream?.abort();
      if (!res.headersSent && !res.destroyed) {
        const status = error?.code === 'INVALID_URL' || error?.code === 'BLOCKED_DESTINATION' ? 400 : error?.code === 'RESPONSE_TOO_LARGE' ? 413 : 502;
        return res.status(status).send(status === 400 ? 'URL is not an allowed public HTTP/HTTPS destination.' : 'Error streaming media file.');
      }
      if (!res.destroyed) res.destroy();
    } finally {
      res.removeListener('close', cancelIfDisconnected);
    }
  });

  app.all('/api/diagnostics/inspect-media', async (req, res) => {
    const rateLimit = inspectorRateLimit(req);
    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', String(rateLimit.resetInSeconds));
      return res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many inspection requests. Try again later.' } });
    }
    const rawUrl = (typeof req.query.url === 'string' ? req.query.url : '') || (typeof req.body?.url === 'string' ? req.body.url : '');
    if (!rawUrl) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_URL', message: 'Query or body parameter "url" is required.' } });
    }
    if (rawUrl.length > 2048) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_URL', message: 'The URL exceeds the allowed length.' } });
    }

    const controller = new AbortController();
    const cancelIfDisconnected = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.once('close', cancelIfDisconnected);
    try {
      const parsed = new URL(rawUrl);
      const provider = providerRegistry.findProvider(parsed);
      const validation = await fetchAndValidateMediaStream(rawUrl, {
        maxRedirects: 5,
        timeoutMs: 30_000,
        maxResponseBytes: getPositiveIntegerConfig(process.env.MEDIA_INSPECT_MAX_BYTES, 8 * 1024 * 1024),
        signal: controller.signal,
        transport,
      });
      if (!validation.valid && validation.errorCategory === 'UPSTREAM_REDIRECT_ERROR') {
        return res.status(400).json({ success: false, error: { code: 'INVALID_URL', message: 'The URL or redirect destination is not an allowed public HTTP/HTTPS destination.' } });
      }
      let resolvedHostname = 'unknown';
      try { if (validation.finalUrl) resolvedHostname = new URL(validation.finalUrl).hostname; } catch {}
      return res.json({
        provider: provider ? provider.name : 'Direct Media Stream',
        resolverStatus: 200,
        resolverContentType: 'application/json',
        resolvedUrlHostname: resolvedHostname,
        mediaStatus: validation.statusCode || 200,
        mediaContentType: validation.contentType || 'unknown',
        looksLikeHtml: !!validation.isHtml,
        looksLikeMedia: validation.valid,
        errorCategory: validation.errorCategory || null,
        errorMessage: validation.errorCategory ? 'The upstream media response could not be validated.' : null,
        detectedMime: validation.mimeType || null,
        detectedFormat: validation.extension || null,
      });
    } catch {
      return res.status(400).json({ success: false, error: { code: 'INVALID_URL', message: 'The URL is not an allowed public HTTP/HTTPS destination.' } });
    } finally {
      res.removeListener('close', cancelIfDisconnected);
    }
  });
}
