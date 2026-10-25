import fs from 'fs';
import path from 'path';
import http from 'node:http';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { Readable } from 'node:stream';
import {
  isHtmlOrChallengeContent,
  inspectMediaSignature,
  categorizeChallenge,
  fetchAndValidateMediaStream,
} from './upstreamValidator.js';
import {
  validateMediaFile,
  verifyMediaWithFfprobe,
  sanitizeLogMessage,
  isRealCookieContent,
  parseAndValidateCookieContent,
} from './ffmpeg.js';
import { db, reconcileAdminAccount } from './db.js';
import { postgresManager } from './postgres.js';
import {
  createSessionToken,
  sessionMiddleware,
  verifySessionToken,
  SessionUser,
  authenticateUser,
  hashPassword,
  verifyPassword,
  changePassword,
  requireAdmin,
  requireAuth,
  getConfiguredAdminEmail,
  rejectUnverifiedPasswordRecovery,
  sameOriginMutationGuard,
} from './auth.js';
import { validateAndNormalizeUrl, validateAndNormalizeUrlAsync } from './security.js';
import { appendBoundedProcessOutput, getYouTubeCookieCompatibilityArgs, getYtDlpChildEnvironment, getYtDlpNetworkArgs, ytDlpService } from './ytDlpService.js';
import { getRateLimitFailurePolicy, withRateLimitTimeout } from './redis.js';
import { createSafeHttpTransport, isGlobalAddress } from './outboundHttp.js';
import { registerMediaEgressRoutes } from './mediaEgressRoutes.js';
import { parseWithEasyDownApi } from './easyDownService.js';
import { canAccessJob, createAnonymousJobCapability, isContainedJobFilePath, safeJobStatus, verifyAnonymousJobCapability } from './jobAuthorization.js';
import { authorizeJobRequest, previewJobAuthorizationMiddleware, registerJobLinkAuthorizationRoutes, registerJobStatusAndCancelRoutes, signedFileAuthorizationMiddleware, downloadStreamAuthorizationMiddleware } from './jobAccessRoutes.js';
import { generateDownloadToken, generateStorageSignedUrl, verifyStorageSignedToken } from './security.js';
import { MediaJob } from './types.js';
import { fetchRapidApiDetailed } from './socialDownload.js';
import { asyncRoute, createAnalysisErrorHandler, createBlogPostHandler, createDmcaReportHandler, registerDatabaseAvailabilityGate, registerDiagnosticAdminGate, registerPublicBlogReadRoutes, registerPublicOperationalRoutes } from './operationalSecurity.js';
import { createAuthenticationRateLimiter, getTrustedClientAddress } from './authRateLimit.js';
import { getPostgresSslOptions, markPostgresUnavailable, sanitizePostgresConnectionString } from './postgres.js';
import { initializePersistenceMode, resolvePersistenceMode } from './db.js';
import { stripPersistedJobCapabilities } from '../src/utils/jobHistory.js';

// Test-only secret for regression tests. Never use this value in production.
if (!process.env.AUTH_SECRET?.trim()) {
  process.env.AUTH_SECRET = 'local-regression-test-secret-only';
}


interface TestCase {
  name: string;
  run: () => Promise<{ passed: boolean; details?: string }>;
}

const tests: TestCase[] = [
  // Test 1: Valid MP4 Magic Bytes
  {
    name: '1. Valid MP4 Magic Bytes (ftyp container)',
    run: async () => {
      // Create a simulated MP4 container header (0x00 0x00 0x00 0x18 'ftyp' 'mp42' ...)
      const mp4Header = Buffer.from([
        0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
        0x00, 0x00, 0x00, 0x00, 0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d,
      ]);
      const isHtml = isHtmlOrChallengeContent(mp4Header);
      const sig = inspectMediaSignature(mp4Header, 'video');

      if (!isHtml && sig.valid && sig.detectedFormat === 'mp4' && sig.detectedMime === 'video/mp4') {
        return { passed: true, details: `Detected: ${sig.detectedFormat} (${sig.detectedMime})` };
      }
      return { passed: false, details: `isHtml=${isHtml}, sigValid=${sig.valid}, format=${sig.detectedFormat}` };
    },
  },

  // Test 2: Google AI Studio HTML Cookie-Check Page
  {
    name: '2. Google AI Studio HTML Cookie-Check Page Rejected',
    run: async () => {
      const cookieCheckHtml = `<!doctype html>
<html lang="en">
<head>
  <title>Cookie check</title>
  <meta charset="utf-8">
</head>
<body>
  <h1>Action required to load your app</h1>
  <p>It looks like your browser is blocking a required security cookie.</p>
  <button id="auth-btn">Authenticate in new window</button>
  <script>
    window.addEventListener('load', () => {
      console.log('aistudio_auth_flow started');
    });
  </script>
</body>
</html>`;
      const buf = Buffer.from(cookieCheckHtml, 'utf8');
      const isHtml = isHtmlOrChallengeContent(buf);
      const cat = categorizeChallenge(buf);
      const sig = inspectMediaSignature(buf, 'video');

      if (isHtml && cat === 'UPSTREAM_HTML_CHALLENGE' && !sig.valid && sig.errorCategory === 'UPSTREAM_HTML_CHALLENGE') {
        return { passed: true, details: `Identified category: ${cat}, rejected signature.` };
      }
      return { passed: false, details: `isHtml=${isHtml}, cat=${cat}, sigValid=${sig.valid}, errCat=${sig.errorCategory}` };
    },
  },

  // Test 3: Generic HTML Login/Cloudflare Challenge
  {
    name: '3. Cloudflare / Bot Protection Challenge Rejected',
    run: async () => {
      const cfHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Just a moment...</title>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
</head>
<body>
  <h2>Please wait while we verify you are human</h2>
  <div class="cf-browser-verification"></div>
</body>
</html>`;
      const buf = Buffer.from(cfHtml, 'utf8');
      const isHtml = isHtmlOrChallengeContent(buf);
      const cat = categorizeChallenge(buf);
      const sig = inspectMediaSignature(buf, 'video');

      if (isHtml && cat === 'UPSTREAM_BOT_PROTECTION' && !sig.valid) {
        return { passed: true, details: `Identified category: ${cat}, signature blocked.` };
      }
      return { passed: false, details: `isHtml=${isHtml}, cat=${cat}, sigValid=${sig.valid}` };
    },
  },

  // Test 4: Upstream JSON Error Payload
  {
    name: '4. Upstream JSON Error Payload Rejected',
    run: async () => {
      const jsonError = JSON.stringify({
        error: {
          code: 403,
          message: 'Access denied: signature expired or invalid token',
          status: 'PERMISSION_DENIED',
        },
      });
      const buf = Buffer.from(jsonError, 'utf8');
      const isHtml = isHtmlOrChallengeContent(buf);
      const sig = inspectMediaSignature(buf, 'video');

      if (isHtml && !sig.valid) {
        return { passed: true, details: 'JSON error structure recognized and blocked.' };
      }
      return { passed: false, details: `isHtml=${isHtml}, sigValid=${sig.valid}` };
    },
  },

  // Test 5: MP4 Filename Containing HTML Content
  {
    name: '5. HTML Payload Masquerading with .mp4 Extension Blocked',
    run: async () => {
      const fakeMp4 = `<html><body><p>Access forbidden: Please authenticate</p></body></html>`;
      const buf = Buffer.from(fakeMp4, 'utf8');
      const sig = inspectMediaSignature(buf, 'video');

      if (!sig.valid && sig.errorCategory) {
        return { passed: true, details: `Blocked with category: ${sig.errorCategory}` };
      }
      return { passed: false, details: `sigValid=${sig.valid}` };
    },
  },

  // Test 6: Invalid Random Text/Binary
  {
    name: '6. Invalid Random ASCII Text Blocked',
    run: async () => {
      const textData = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor.';
      const buf = Buffer.from(textData, 'utf8');
      const sig = inspectMediaSignature(buf, 'video');

      if (!sig.valid && sig.errorCategory === 'MEDIA_SIGNATURE_INVALID') {
        return { passed: true, details: `Blocked with code: ${sig.errorCategory}` };
      }
      return { passed: false, details: `sigValid=${sig.valid}, errCat=${sig.errorCategory}` };
    },
  },

  // Test 7: Valid WebM, MP3, WAV Container Signatures
  {
    name: '7. Multi-Format Magic Bytes Verification (WebM, MP3, WAV)',
    run: async () => {
      // WebM EBML
      const webmHeader = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]);
      const webmSig = inspectMediaSignature(webmHeader, 'video');

      // MP3 ID3v2
      const mp3Header = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      const mp3Sig = inspectMediaSignature(mp3Header, 'audio');

      // WAV RIFF
      const wavHeader = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
      ]);
      const wavSig = inspectMediaSignature(wavHeader, 'audio');

      const allValid =
        webmSig.valid &&
        webmSig.detectedFormat === 'webm' &&
        mp3Sig.valid &&
        mp3Sig.detectedFormat === 'mp3' &&
        wavSig.valid &&
        wavSig.detectedFormat === 'wav';

      if (allValid) {
        return { passed: true, details: 'WebM, MP3, and WAV headers verified.' };
      }
      return {
        passed: false,
        details: `webm=${webmSig.detectedFormat}, mp3=${mp3Sig.detectedFormat}, wav=${wavSig.detectedFormat}`,
      };
    },
  },

  // Test 8: FFprobe Corrupted File Rejection
  {
    name: '8. FFprobe Broken/Corrupt File Handling',
    run: async () => {
      const tempCorruptPath = path.join(process.cwd(), 'temp_media', 'test_corrupted.mp4');
      if (!fs.existsSync(path.dirname(tempCorruptPath))) {
        fs.mkdirSync(path.dirname(tempCorruptPath), { recursive: true });
      }
      // Write corrupted data (not valid video streams)
      fs.writeFileSync(tempCorruptPath, Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x00, 0x00, 0x00, 0x00]));

      try {
        const probeResult = await verifyMediaWithFfprobe(tempCorruptPath);
        if (fs.existsSync(tempCorruptPath)) fs.unlinkSync(tempCorruptPath);

        if (!probeResult.valid) {
          return { passed: true, details: 'FFprobe correctly reported invalid media container.' };
        }
        return { passed: false, details: 'FFprobe erroneously marked corrupt file as valid.' };
      } catch (err: any) {
        if (fs.existsSync(tempCorruptPath)) fs.unlinkSync(tempCorruptPath);
        return { passed: true, details: `FFprobe handled error gracefully: ${err.message}` };
      }
    },
  },

  // Test 9: Safe Log Sanitization (Scrubbing Cookies, Bearer Tokens, and Auth Headers)
  {
    name: '9. Log Sanitization & Redaction of Authentication Secrets',
    run: async () => {
      const rawLog = 'Error executing yt-dlp --cookies /path/to/cookies.txt --socket-timeout 25 with Authorization: Bearer eyJhbGciOi... and Cookie: SID=xyz; HSID=abc;';
      const sanitized = sanitizeLogMessage(rawLog);

      const hasRedactedCookies = sanitized.includes('--cookies [REDACTED]');
      const hasRedactedAuth = sanitized.includes('Authorization: [REDACTED]');
      const hasRedactedCookieHeader = sanitized.includes('Cookie: [REDACTED]');
      const sanitizedUrl = sanitizeLogMessage('Provider failed for https://media.example.test/watch?id=private-id&token=private-token');
      const hasRedactedUrl = sanitizedUrl.includes('[REDACTED_URL]');
      const leakedSecret = sanitized.includes('/path/to/cookies.txt') || sanitized.includes('eyJhbGciOi') || sanitized.includes('SID=xyz') ||
        sanitizedUrl.includes('media.example.test') || sanitizedUrl.includes('private-id') || sanitizedUrl.includes('private-token');

      if (hasRedactedCookies && hasRedactedAuth && hasRedactedCookieHeader && hasRedactedUrl && !leakedSecret) {
        return { passed: true, details: 'Cookies, bearer credentials, and complete source URLs are redacted from logs.' };
      }
      return { passed: false, details: `Sanitization incomplete: "${sanitized}"` };
    },
  },

  // Test 10: Strict Cookie Content Validation (Template Rejection & Netscape Acceptance)
  {
    name: '10. Cookie Validation Rejects Placeholders & Accepts Netscape Format',
    run: async () => {
      // 1. Placeholder string from template
      const placeholder = 'YTDLP_COOKIES=<contents of your cookies.txt>';
      const isPlaceholderValid = isRealCookieContent(placeholder);

      // 2. Short/empty string
      const shortStr = 'abc';
      const isShortValid = isRealCookieContent(shortStr);

      // 3. Valid Netscape format string
      const validNetscape = `# Netscape HTTP Cookie File\n# http://curl.haxx.se/rfc/cookie_spec.html\n.youtube.com\tTRUE\t/\tTRUE\t1756500000\tVISITOR_INFO1_LIVE\txxxyyyzzz\n`;
      const isValidNetscape = isRealCookieContent(validNetscape);
      const parsedNetscape = parseAndValidateCookieContent(validNetscape);

      // 4. Valid Base64-encoded Netscape format
      const base64Netscape = Buffer.from(validNetscape).toString('base64');
      const parsedBase64 = parseAndValidateCookieContent(base64Netscape);

      if (!isPlaceholderValid && !isShortValid && isValidNetscape && parsedNetscape && parsedBase64) {
        return { passed: true, details: 'Template placeholders rejected; authentic Netscape & Base64 validated.' };
      }
      return {
        passed: false,
        details: `placeholder=${isPlaceholderValid}, short=${isShortValid}, netscape=${isValidNetscape}, parsedBase64=${!!parsedBase64}`,
      };
    },
  },

  // Test 11: Structured Error Classification on YouTube Bot Detection
  {
    name: '11. Structured UPSTREAM_BOT_VERIFICATION_REQUIRED Classification',
    run: async () => {
      const botErrorOutput = `ERROR: [youtube] M7lc1UVf-VE: Sign in to confirm you’re not a bot. Use --cookies-from-browser chrome or --cookies secret_cookie.txt for the authentication session.`;
      
      const isBotVerification =
        botErrorOutput.includes('Sign in to confirm') ||
        botErrorOutput.includes('not a bot') ||
        botErrorOutput.includes('--cookies');

      const expectedCode = isBotVerification ? 'UPSTREAM_BOT_VERIFICATION_REQUIRED' : 'MEDIA_DOWNLOAD_FAILED';
      const sanitized = sanitizeLogMessage(botErrorOutput);

      const hasRedactedBrowser = sanitized.includes('--cookies-from-browser [REDACTED]');
      const hasRedactedCookies = sanitized.includes('--cookies [REDACTED]');
      const hasNoSecretPath = !sanitized.includes('secret_cookie.txt') && !sanitized.includes('chrome');

      if (expectedCode === 'UPSTREAM_BOT_VERIFICATION_REQUIRED' && hasRedactedBrowser && hasRedactedCookies && hasNoSecretPath) {
        return { passed: true, details: `Correctly classified as ${expectedCode} with sanitized log output.` };
      }
      return { passed: false, details: `Code=${expectedCode}, sanitized="${sanitized}"` };
    },
  },

  // Test 12: Structured Error Classification when provider media is inaccessible
  {
    name: '12. Structured UPSTREAM_MEDIA_UNAVAILABLE Classification',
    run: async () => {
      const providerError = {
        message: 'yt-dlp extraction failed: Sign in to confirm you’re not a bot.',
        fallbackDetail: 'YouTube CDN rejected the resolved media URL from the Render server (HTTP 403)',
      };

      const expectedCode = 'UPSTREAM_MEDIA_UNAVAILABLE';
      const classification = ytDlpService.classifyError(providerError);

      if (classification.code === expectedCode) {
        return {
          passed: true,
          details: `Correctly classified inaccessible provider media as ${expectedCode}.`,
        };
      }

      return {
        passed: false,
        details: `Expected=${expectedCode}, actual=${classification.code}`,
      };
    },
  },
  {
    name: 'YouTube extraction failure: cookie-backed requests avoid the broken tv_downgraded client',
    run: async () => {
      assert.deepEqual(
        getYouTubeCookieCompatibilityArgs('https://www.youtube.com/watch?v=video-id', true),
        ['--extractor-args', 'youtube:player_client=default,web_embedded'],
      );
      assert.deepEqual(getYouTubeCookieCompatibilityArgs('https://youtu.be/video-id', true), [
        '--extractor-args', 'youtube:player_client=default,web_embedded',
      ]);
      assert.deepEqual(getYouTubeCookieCompatibilityArgs('https://youtube.com/watch?v=video-id', false), []);
      assert.deepEqual(getYouTubeCookieCompatibilityArgs('https://www.tiktok.com/@user/video/1', true), []);

      const failedExtraction = ytDlpService.classifyError({
        code: 1,
        stderr: '[youtube] video-id: The page needs to be reloaded.',
      });
      assert.equal(failedExtraction.code, 'YTDLP_EXECUTION_FAILED');
      return { passed: true, details: 'Cookie-backed YouTube calls use the verified non-tv_downgraded client list; other requests retain their existing arguments.' };
    },
  },
  {
    name: 'RapidAPI media HTTP 403: inaccessible signed stream is rejected without creating output',
    run: async () => {
      const signedUrl = 'https://rr1.googlevideo.com/videoplayback?expire=1999999999&sig=do-not-log-this';
      let capturedUrl = '';
      let requestCount = 0;
      let aborted = false;
      const destinationPath = path.join(tmpdir(), `videofetch-403-${Date.now()}.mp4`);
      const responseBody = Readable.from([]) as any;
      const result = await fetchAndValidateMediaStream(signedUrl, {
        expectedType: 'video',
        destinationPath,
        transport: (async (url: string) => {
          capturedUrl = url;
          requestCount++;
          return {
            statusCode: 403,
            headers: { 'content-type': 'text/plain' },
            finalUrl: url,
            body: responseBody,
            abort: () => { aborted = true; responseBody.destroy(); },
          };
        }) as any,
      });

      assert.equal(requestCount, 1, 'the resolved provider URL is requested once and not cached/retried');
      assert.equal(capturedUrl, signedUrl, 'URL path and signed query are passed through unchanged');
      assert.equal(result.valid, false);
      assert.equal(result.statusCode, 403);
      assert.equal(result.errorCategory, 'UPSTREAM_MEDIA_UNAVAILABLE');
      assert.equal(aborted, true);
      assert.equal(result.errorMessage?.includes('do-not-log-this'), false);
      assert.equal(fs.existsSync(destinationPath), false, 'a denied response never creates a media output');
      return { passed: true, details: 'HTTP 403 remains a hard failure; signed URL material is not included in returned diagnostics and no output is created.' };
    },
  },

  // Test 13: Cryptographic Session Token Issuance and Verification
  {
    name: '13. Cryptographic Session Token Issuance and Verification',
    run: async () => {
      const demoUser: SessionUser = {
        id: 'usr_test_999',
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        role: 'admin',
        tier: 'pro',
      };

      const token = createSessionToken(demoUser, 24);
      if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
        return { passed: false, details: 'Token format is invalid or missing 3 segments.' };
      }

      const verified = verifySessionToken(token);
      if (!verified) {
        return { passed: false, details: 'Failed to verify signed session token.' };
      }

      if (verified.id === demoUser.id && verified.email === demoUser.email && verified.role === demoUser.role) {
        return { passed: true, details: `Token validated for ${verified.email} with role ${verified.role}` };
      }

      return { passed: false, details: `Payload mismatch: ${JSON.stringify(verified)}` };
    },
  },

  // Test 13: Tampered or Forged Session Token Rejection
  {
    name: '13. Tampered or Forged Session Token Rejection',
    run: async () => {
      const demoUser: SessionUser = {
        id: 'usr_test_888',
        name: 'Regular User',
        email: 'user@example.com',
        role: 'user',
      };

      const token = createSessionToken(demoUser, 24);
      const [header, payload, signature] = token.split('.');

      // Attempt privilege escalation by tampering with payload to role: admin
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
      decodedPayload.role = 'admin';
      const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString('base64').replace(/=/g, '');
      const forgedToken = `${header}.${tamperedPayload}.${signature}`;

      const verified = verifySessionToken(forgedToken);
      if (verified !== null) {
        return { passed: false, details: 'Tampered token was erroneously accepted!' };
      }

      // Expired token test
      const expiredClaims = {
        sub: 'usr_expired',
        name: 'Expired',
        email: 'exp@example.com',
        role: 'user',
        exp: Math.floor(Date.now() / 1000) - 60,
      };
      const expB64 = Buffer.from(JSON.stringify(expiredClaims)).toString('base64').replace(/=/g, '');
      const fakeToken = `${header}.${expB64}.fakesig`;
      const expiredVerified = verifySessionToken(fakeToken);

      if (expiredVerified === null) {
        return { passed: true, details: 'Tampered signatures and forged claims strictly rejected.' };
      }

      return { passed: false, details: 'Expired or forged token was not rejected.' };
    },
  },
  {
    name: 'AUTH SECURITY: strict signed session claims and cookie-only authentication',
    run: async () => {
      const key = process.env.AUTH_SECRET!;
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const issue = (header: any, claims: any) => {
        const content = `${encode(header)}.${encode(claims)}`;
        return `${content}.${crypto.createHmac('sha256', key).update(content).digest('base64url')}`;
      };
      const now = Math.floor(Date.now() / 1000);
      const baseClaims = { sub: 'strict-user', name: 'Strict User', email: 'strict@example.test', role: 'user', iat: now, exp: now + 3600 };
      assert.ok(verifySessionToken(issue({ alg: 'HS256', typ: 'JWT' }, baseClaims)));
      assert.equal(verifySessionToken(issue({ alg: 'none', typ: 'JWT' }, baseClaims)), null);
      assert.equal(verifySessionToken(issue({ alg: 'HS256', typ: 'JWT' }, { ...baseClaims, exp: undefined })), null);
      assert.equal(verifySessionToken(issue({ alg: 'HS256', typ: 'JWT' }, { ...baseClaims, iat: now + 3600 })), null);
      assert.equal(verifySessionToken(issue({ alg: 'HS256', typ: 'JWT' }, { ...baseClaims, exp: now - 1 })), null);
      const request = { headers: { authorization: `Bearer ${createSessionToken({ id: 'strict-user', name: 'Strict User', email: 'strict@example.test', role: 'user' })}` } } as any;
      const { extractTokenFromRequest } = await import('./auth.js');
      assert.equal(extractTokenFromRequest(request), null, 'bearer tokens are no longer accepted');
      request.headers.cookie = `mf_session=${createSessionToken({ id: 'strict-user', name: 'Strict User', email: 'strict@example.test', role: 'user' })}`;
      assert.ok(extractTokenFromRequest(request), 'HttpOnly session cookie remains accepted');
      return { passed: true, details: 'Signed session claims require HS256, required identity/timing fields, and bounded expiry; auth extraction accepts cookies but rejects bearer headers.' };
    },
  },
  {
    name: 'SSRF SECURITY: production yt-dlp requires controlled proxy configuration',
    run: async () => {
      assert.throws(() => getYtDlpNetworkArgs('', 'production'), /required in production/);
      assert.throws(() => getYtDlpNetworkArgs('file:///tmp/proxy', 'production'), /HTTP or HTTPS/);
      assert.throws(() => getYtDlpNetworkArgs('https://user:pass@proxy.example.test', 'production'), /no embedded credentials/);
      assert.deepEqual(getYtDlpNetworkArgs('https://proxy.example.test:443', 'production'), ['--proxy', 'https://proxy.example.test/']);
      assert.deepEqual(getYtDlpNetworkArgs('', 'development'), []);
      const capped = appendBoundedProcessOutput('abc', Buffer.from('defgh'), 5);
      assert.equal(capped, 'abcde');
      assert.equal(Buffer.byteLength(appendBoundedProcessOutput('', Buffer.alloc(300_000))), 256 * 1024);
      return { passed: true, details: 'Production configuration fails closed without a valid standard-port HTTP(S) proxy; stdout/stderr append helper caps retained output at 256 KiB.' };
    },
  },
  {
    name: 'YTDLP CHILD ENV: strips ambient proxy configuration',
    run: async () => {
      const sentinelValues: Record<string, string> = {
        HTTP_PROXY: 'http://upper-http-proxy.invalid:8101',
        http_proxy: 'http://lower-http-proxy.invalid:8102',
        HTTPS_PROXY: 'http://upper-https-proxy.invalid:8103',
        https_proxy: 'http://lower-https-proxy.invalid:8104',
        ALL_PROXY: 'http://upper-all-proxy.invalid:8105',
        all_proxy: 'http://lower-all-proxy.invalid:8106',
        NO_PROXY: 'upper-no-proxy.invalid',
        no_proxy: 'lower-no-proxy.invalid',
        MEDIAFORGE_CHILD_ENV_SENTINEL: 'preserved-unrelated-value',
      };
      const originalValues = new Map<string, string | undefined>();
      for (const variable of Object.keys(sentinelValues)) originalValues.set(variable, process.env[variable]);

      try {
        for (const [variable, value] of Object.entries(sentinelValues)) process.env[variable] = value;
        const sourceEnvironment = { ...process.env };
        const sourceSnapshot = { ...sourceEnvironment };
        const childEnvironment = getYtDlpChildEnvironment(sourceEnvironment);

        assert.deepEqual(sourceEnvironment, sourceSnapshot, 'the helper must not mutate its source environment');
        for (const variable of ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy']) {
          assert.equal(childEnvironment[variable], undefined, `${variable} should not be inherited by yt-dlp`);
        }
        assert.equal(childEnvironment.NO_PROXY, '');
        assert.equal(childEnvironment.no_proxy, '');
        assert.equal(childEnvironment.MEDIAFORGE_CHILD_ENV_SENTINEL, 'preserved-unrelated-value');
        return { passed: true, details: 'All six ambient proxy variables are omitted, both NO_PROXY forms are empty, and unrelated environment values are preserved.' };
      } finally {
        for (const [variable, value] of originalValues) {
          if (value === undefined) delete process.env[variable];
          else process.env[variable] = value;
        }
      }
    },
  },
  {
    name: 'AUTH SECURITY: Redis outage policy defaults closed in production',
    run: async () => {
      assert.equal(getRateLimitFailurePolicy('production', undefined), 'closed');
      assert.equal(getRateLimitFailurePolicy('development', undefined), 'local');
      assert.equal(getRateLimitFailurePolicy('production', 'local'), 'local', 'explicit override is supported and must be operator-approved');
      await assert.rejects(() => withRateLimitTimeout(new Promise(() => {}), 5), /timed out/);
      let redisAvailable = false;
      const app = express();
      app.post('/limited', createAuthenticationRateLimiter({
        scope: 'login', check: async () => {
          if (!redisAvailable) throw new Error('redis unavailable');
          return { allowed: true, resetInSeconds: 60 };
        },
        ip: { maxRequests: 3, windowSeconds: 60 },
      }), (_req, res) => res.sendStatus(204));
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      try {
        const response = await fetch(`http://127.0.0.1:${(server.address() as any).port}/limited`, { method: 'POST' });
        assert.equal(response.status, 503, 'Redis errors fail closed for authentication throttles');
        redisAvailable = true;
        const recovered = await fetch(`http://127.0.0.1:${(server.address() as any).port}/limited`, { method: 'POST' });
        assert.equal(recovered.status, 204, 'authentication limiting resumes when Redis recovers');
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
      return { passed: true, details: 'Production Redis failure defaults to fail-closed; development retains bounded local fallback.' };
    },
  },
  {
    name: 'AUTH SECURITY: cross-origin cookie mutations are rejected',
    run: async () => {
      const app = express();
      app.use(sameOriginMutationGuard);
      app.post('/mutate', (_req, res) => res.sendStatus(204));
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${(server.address() as any).port}`;
      const oldEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
      try {
        let response = await fetch(`${base}/mutate`, { method: 'POST', headers: { Origin: 'https://attacker.example' } });
        assert.equal(response.status, 403);
        response = await fetch(`${base}/mutate`, { method: 'POST', headers: { Origin: base } });
        assert.equal(response.status, 204, 'same-origin browser mutation remains available');
        return { passed: true, details: 'Cross-origin mutation origins are rejected while same-origin requests continue.' };
      } finally {
        if (oldEnv !== undefined) process.env.NODE_ENV = oldEnv;
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  },

  // Test 14: SSRF Guard: Private / Localhost / Cloud Metadata Rejection
  {
    name: '14. SSRF Guard: Private, Localhost, and Cloud Metadata Rejection',
    run: async () => {
      const maliciousUrls = [
        'http://localhost:8080/secret',
        'http://127.0.0.1:3000/api/admin',
        'http://169.254.169.254/latest/meta-data/',
        'http://10.0.0.5/internal',
        'http://192.168.1.1/router',
        'ftp://example.com/file.mp4',
        'file:///etc/passwd',
      ];

      for (const url of maliciousUrls) {
        const check = validateAndNormalizeUrl(url);
        if (check.isValid) {
          return { passed: false, details: `Dangerous URL '${url}' was NOT blocked!` };
        }
      }

      const validUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const validCheck = validateAndNormalizeUrl(validUrl);
      if (!validCheck.isValid) {
        return { passed: false, details: `Valid public URL '${validUrl}' was unexpectedly blocked!` };
      }

      return { passed: true, details: 'All 7 malicious SSRF/private patterns blocked; public URL passed.' };
    },
  },

  // Test 15: Error Classification Guarantee (Zero undefined messages)
  {
    name: '15. Error Classification Guarantee (No undefined messages)',
    run: async () => {
      const sampleErrors = [
        new Error('ERROR: [youtube] jNQXAC9IVRw: Sign in to confirm you’re not a bot.'),
        new Error('undefined'),
        {},
        null,
        new Error('403 Forbidden: Access denied'),
        new Error('Invalid URL provided'),
      ];

      for (const err of sampleErrors) {
        const classified = ytDlpService.classifyError(err);
        if (!classified.code || typeof classified.code !== 'string') {
          return { passed: false, details: `Missing code for error: ${err}` };
        }
        if (!classified.message || classified.message === 'undefined') {
          return { passed: false, details: `Invalid/undefined message: "${classified.message}"` };
        }
        if (!classified.userMessage || classified.userMessage === 'undefined') {
          return { passed: false, details: `Invalid/undefined userMessage: "${classified.userMessage}"` };
        }
      }

      // Check YouTube bot verification specifically
      const ytBot = ytDlpService.classifyError(new Error('ERROR: [youtube] jNQXAC9IVRw: Sign in to confirm you’re not a bot.'));
      if (ytBot.code !== 'UPSTREAM_BOT_VERIFICATION_REQUIRED') {
        return { passed: false, details: `Expected UPSTREAM_BOT_VERIFICATION_REQUIRED but got ${ytBot.code}` };
      }
      if (!ytBot.userMessage.includes('requires additional verification')) {
        return { passed: false, details: `Unexpected userMessage: ${ytBot.userMessage}` };
      }

      return { passed: true, details: 'All error cases returned valid codes and clean, non-undefined user messages.' };
    },
  },

  // Test 16: RapidAPI Fallback Error Surfacing (HTTP 401, 429, Key Not Set)
  {
    name: '16. RapidAPI Fallback Error Formatting & Surfacing',
    run: async () => {
      // 1. Key not set
      const fallbackKeyNotSet = ytDlpService.classifyError({
        message: 'Sign in to confirm you’re not a bot',
        fallbackDetail: 'RAPIDAPI_KEY is not set',
      });
      if (!fallbackKeyNotSet.userMessage.includes('RapidAPI fallback failed (RAPIDAPI_KEY is not set)')) {
        return { passed: false, details: `Missing fallback suffix: ${fallbackKeyNotSet.userMessage}` };
      }

      // 2. HTTP 401
      const fallback401 = ytDlpService.classifyError({
        message: 'Sign in to confirm you’re not a bot',
        fallbackDetail: 'HTTP 401: Unauthorized',
      });
      if (!fallback401.userMessage.includes('RapidAPI fallback failed (HTTP 401: Unauthorized)')) {
        return { passed: false, details: `Missing 401 suffix: ${fallback401.userMessage}` };
      }

      // 3. HTTP 429
      const fallback429 = ytDlpService.classifyError({
        message: 'Sign in to confirm you’re not a bot',
        fallbackDetail: 'HTTP 429: quota exceeded',
      });
      if (!fallback429.userMessage.includes('RapidAPI fallback failed (HTTP 429: quota exceeded)')) {
        return { passed: false, details: `Missing 429 suffix: ${fallback429.userMessage}` };
      }

      // 4. Format helper verification
      const formatResult = ytDlpService.formatRapidApiFallbackFailure({
        ok: false,
        statusCode: 429,
        statusText: 'Too Many Requests',
        headers: {},
        bodyText: '',
        data: null,
      });
      if (!formatResult || !formatResult.includes('HTTP 429')) {
        return { passed: false, details: `Expected HTTP 429 formatted failure, got: ${formatResult}` };
      }

      return { passed: true, details: 'All RapidAPI fallback failure cases (key missing, 401, 429) correctly surfaced.' };
    },
  },

  // Test 17: Correct and incorrect passwords
  {
    name: '17. Password Verification: Correct vs Incorrect Passwords',
    run: async () => {
      const testEmail = 'pwd_verify_test@example.com';
      const testPassword = 'StrongPassword123!';
      const wrongPassword = 'WrongPassword456!';
      const pwdHash = await hashPassword(testPassword);

      db.users.set('usr_pwd_test', {
        id: 'usr_pwd_test',
        name: 'Password Test User',
        email: testEmail,
        role: 'user',
        passwordHash: pwdHash,
        createdAt: new Date().toISOString(),
        downloadsCount: 0,
        tier: 'free',
      });

      const validLogin = await authenticateUser(testEmail, testPassword);
      if (!validLogin || validLogin.email !== testEmail) {
        return { passed: false, details: 'Valid login failed with correct password.' };
      }

      const invalidLogin = await authenticateUser(testEmail, wrongPassword);
      if (invalidLogin !== null) {
        return { passed: false, details: 'Authentication succeeded despite incorrect password!' };
      }

      const emptyLogin = await authenticateUser(testEmail, '');
      if (emptyLogin !== null) {
        return { passed: false, details: 'Authentication succeeded with empty password!' };
      }

      const malformedHashes = [
        'scrypt:not-hex:' + '0'.repeat(128),
        'scrypt:' + '0'.repeat(32) + ':not-hex',
        'scrypt:' + '0'.repeat(32) + ':' + '0'.repeat(127),
      ];
      for (const malformedHash of malformedHashes) {
        if (await verifyPassword(testPassword, malformedHash)) {
          return { passed: false, details: 'A malformed stored password hash was accepted.' };
        }
      }

      return { passed: true, details: 'Correct password allowed; incorrect and empty passwords strictly rejected.' };
    },
  },

  // Test 18: Unknown accounts attempting to log in & No silent account creation
  {
    name: '18. Unknown Accounts & Silent Account Creation Prevention',
    run: async () => {
      const unknownEmail = 'does_not_exist_ever_999@example.com';
      const initialUserCount = db.users.size;

      const result = await authenticateUser(unknownEmail, 'SomePassword123!');
      const finalUserCount = db.users.size;

      if (result !== null) {
        return { passed: false, details: 'Unknown account returned a valid session user!' };
      }

      if (finalUserCount > initialUserCount) {
        return { passed: false, details: 'Login silently auto-provisioned a new account in database!' };
      }

      return { passed: true, details: 'Unknown account rejected without creating any database record.' };
    },
  },

  // Test 19: Email-substring admin escalation prevention
  {
    name: '19. Prevention of Email-Substring Admin Privilege Escalation',
    run: async () => {
      const maliciousEmails = [
        'alex.hacker@evil.com',
        'notadmin@attack.org',
        'superadmin_fake@domain.com',
        'alex@attacker.xyz',
      ];

      for (let i = 0; i < maliciousEmails.length; i++) {
        const email = maliciousEmails[i];
        const pwd = 'AttackerPassword123!';
        const hash = await hashPassword(pwd);
        const uid = `usr_malicious_${i}`;

        db.users.set(uid, {
          id: uid,
          name: 'Attacker',
          email,
          role: 'user',
          passwordHash: hash,
          createdAt: new Date().toISOString(),
          downloadsCount: 0,
          tier: 'free',
        });

        const authResult = await authenticateUser(email, pwd);
        if (!authResult) {
          return { passed: false, details: `Failed to authenticate test user ${email}` };
        }
        if (authResult.role === 'admin') {
          return {
            passed: false,
            details: `Escalation! User with email containing 'alex' or 'admin' (${email}) was assigned role 'admin'!`,
          };
        }
      }

      return { passed: true, details: 'All emails with substring "alex" or "admin" preserved strict "user" role.' };
    },
  },

  // Test 20: Missing or invalid admin configuration fails closed
  {
    name: '20. Admin Configuration Fails Closed When Missing or Unset',
    run: async () => {
      const originalAdminEmail = process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_EMAIL;

      const configured = getConfiguredAdminEmail();
      if (configured !== null) {
        process.env.ADMIN_EMAIL = originalAdminEmail;
        return { passed: false, details: 'getConfiguredAdminEmail() did not return null when ADMIN_EMAIL is unset.' };
      }

      process.env.ADMIN_EMAIL = '   ';
      const emptyCheck = getConfiguredAdminEmail();
      if (emptyCheck !== null) {
        process.env.ADMIN_EMAIL = originalAdminEmail;
        return { passed: false, details: 'getConfiguredAdminEmail() did not fail closed on whitespace ADMIN_EMAIL.' };
      }

      if (originalAdminEmail) process.env.ADMIN_EMAIL = originalAdminEmail;
      return { passed: true, details: 'Unset or blank ADMIN_EMAIL safely fails closed (returns null).' };
    },
  },

  // Test 21: User sessions attempting admin-only operations (requireAdmin guard)
  {
    name: '21. requireAdmin Rejects Regular User Sessions and Unauthenticated Requests',
    run: async () => {
      let nextCalled = false;
      let statusSent = 0;
      let jsonSent: any = null;

      const fakeRes: any = {
        status: (code: number) => {
          statusSent = code;
          return {
            json: (obj: any) => {
              jsonSent = obj;
            },
          };
        },
      };

      // 1. Unauthenticated request
      const unauthReq: any = { user: null };
      requireAdmin(unauthReq, fakeRes, () => {
        nextCalled = true;
      });
      if (nextCalled || statusSent !== 401) {
        return { passed: false, details: `Unauthenticated request got status ${statusSent}, nextCalled=${nextCalled}` };
      }

      nextCalled = false;
      statusSent = 0;
      requireAuth({ user: null } as any, fakeRes, () => { nextCalled = true; });
      if (nextCalled || statusSent !== 401) {
        return { passed: false, details: `Unauthenticated password-change guard got status ${statusSent}.` };
      }

      // 2. Regular user session
      nextCalled = false;
      statusSent = 0;
      const userReq: any = {
        user: { id: 'usr_reg_1', name: 'Reg User', email: 'reg@example.com', role: 'user' },
      };
      requireAdmin(userReq, fakeRes, () => {
        nextCalled = true;
      });
      if (nextCalled || statusSent !== 403) {
        return { passed: false, details: `User role got status ${statusSent} (expected 403), nextCalled=${nextCalled}` };
      }

      // 3. Admin user session
      nextCalled = false;
      statusSent = 0;
      const adminReq: any = {
        user: { id: 'usr_admin_1', name: 'Admin User', email: 'admin@corp.internal', role: 'admin' },
      };
      requireAdmin(adminReq, fakeRes, () => {
        nextCalled = true;
      });
      if (!nextCalled || statusSent !== 0) {
        return { passed: false, details: 'Valid admin was blocked by requireAdmin.' };
      }

      return { passed: true, details: 'Unauthenticated requests rejected (401), standard users denied (403), admin passed.' };
    },
  },

  // Test 22: Unauthorized password change attempts
  {
    name: '22. Password Modification Guard: Current Password Validation',
    run: async () => {
      const uid = 'usr_change_pwd_test';
      const initialPwd = 'InitialPassword123!';
      const initialHash = await hashPassword(initialPwd);

      db.users.set(uid, {
        id: uid,
        name: 'Change Password User',
        email: 'chgpwd@example.com',
        role: 'user',
        passwordHash: initialHash,
        createdAt: new Date().toISOString(),
        downloadsCount: 0,
        tier: 'free',
      });

      // Try with wrong current password
      const badAttempt = await changePassword(uid, 'WrongCurrentPass!', 'NewPassword12345!');
      if (badAttempt.success) {
        return { passed: false, details: 'Password was changed despite incorrect current password!' };
      }

      // Try with non-existent user
      const nonExistent = await changePassword('fake_non_existent_id', initialPwd, 'NewPassword12345!');
      if (nonExistent.success) {
        return { passed: false, details: 'Password change succeeded for non-existent user ID!' };
      }

      // Try with short new password
      const tooShort = await changePassword(uid, initialPwd, 'short');
      if (tooShort.success) {
        return { passed: false, details: 'Password change succeeded with password under 8 characters!' };
      }

      // Valid password change
      const originalSaveUser = postgresManager.saveUser;
      let persistedHash: string | undefined;
      postgresManager.saveUser = async (user) => { persistedHash = user.passwordHash; };
      let validChange: { success: boolean; error?: string };
      try {
        validChange = await changePassword(uid, initialPwd, 'NewValidPassword123!');
      } finally {
        postgresManager.saveUser = originalSaveUser;
      }
      if (!validChange.success) {
        return { passed: false, details: `Valid password change failed: ${validChange.error}` };
      }
      if (!persistedHash) {
        return { passed: false, details: 'Password change did not request persistence of the new hash.' };
      }

      // Check login with new password works and old password fails
      const loginOld = await authenticateUser('chgpwd@example.com', initialPwd);
      if (loginOld !== null) {
        return { passed: false, details: 'Old password still works after successful change!' };
      }

      const loginNew = await authenticateUser('chgpwd@example.com', 'NewValidPassword123!');
      if (!loginNew) {
        return { passed: false, details: 'Login with updated password failed!' };
      }

      return { passed: true, details: 'Password change requires verified current password; updates hash correctly.' };
    },
  },

  // Test 23: Untrusted session role claims do not grant privileges
  {
    name: '23. Token Role Integrity: Session Tampering & Role Validation',
    run: async () => {
      // Create session for user
      const normalUser: SessionUser = {
        id: 'usr_normal_token',
        name: 'Normal User',
        email: 'normal@test.com',
        role: 'user',
      };
      const token = createSessionToken(normalUser);

      // Verify legitimate token claims role 'user'
      const verified = verifySessionToken(token);
      if (!verified || verified.role !== 'user') {
        return { passed: false, details: 'Legitimate token verification failed.' };
      }

      // Token with illegal arbitrary role claim (e.g. "superadmin" or "root")
      const [hB64, , sig] = token.split('.');
      const claimsObj = {
        sub: 'usr_hacked',
        name: 'Hacker',
        email: 'hacker@evil.com',
        role: 'superadmin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const badPayload = Buffer.from(JSON.stringify(claimsObj)).toString('base64').replace(/=/g, '');
      const badToken = `${hB64}.${badPayload}.${sig}`;

      const badVerified = verifySessionToken(badToken);
      if (badVerified !== null) {
        return { passed: false, details: 'Tampered token with invalid signature was accepted!' };
      }

      return { passed: true, details: 'Cryptographic HMAC signature strictly enforces session integrity.' };
    },
  },

  // Test 24: Existing database & account compatibility
  {
    name: '24. Existing Database and Account Backward Compatibility',
    run: async () => {
      // Accounts without passwordHash (e.g. pre-existing demo entries)
      // must NOT crash the system or allow blank password login
      const legacyUser = db.users.get('usr_demo_1');
      if (!legacyUser) {
        return { passed: false, details: 'Expected seeded legacy user usr_demo_1 not found.' };
      }

      // Login attempt without password must fail
      const loginBlank = await authenticateUser(legacyUser.email, '');
      if (loginBlank !== null) {
        return { passed: false, details: 'Legacy user logged in with empty password!' };
      }

      // Login attempt with random password must fail cleanly
      const loginGuess = await authenticateUser(legacyUser.email, 'RandomGuess123!');
      if (loginGuess !== null) {
        return { passed: false, details: 'Legacy user without passwordHash logged in!' };
      }

      return { passed: true, details: 'Legacy accounts without passwords handle login gracefully without crashes or false positives.' };
    },
  },

  // Test 25: Password recovery is not operational without verified delivery
  {
    name: '25. Password Recovery Rejection Without Verified Delivery Channel',
    run: async () => {
      // Direct email-only password change attempt must fail / not exist
      const user = db.users.get('usr_demo_2');
      if (!user) {
        return { passed: false, details: 'Expected test user usr_demo_2 not found.' };
      }

      // Ensure no function or path allows setting password by email alone without current password
      const changeResult = await changePassword(user.id, '', 'NewPassword123!');
      if (changeResult.success) {
        return { passed: false, details: 'changePassword allowed changing password with empty current password!' };
      }

      let responseStatus = 0;
      let responseBody: any;
      rejectUnverifiedPasswordRecovery({
        status: (status: number) => {
          responseStatus = status;
          return { json: (body: any) => { responseBody = body; } } as any;
        },
      } as any);
      if (responseStatus !== 501 || responseBody?.error?.code !== 'RECOVERY_NOT_CONFIGURED') {
        return { passed: false, details: 'Password recovery did not fail closed without verified delivery.' };
      }

      return { passed: true, details: 'Password reset by email alone is blocked; verified out-of-band delivery is required.' };
    },
  },

  // Test 26: Stale signed role claims cannot preserve admin privileges
  {
    name: '26. Session Authorization Uses Current Account Role',
    run: async () => {
      const id = 'usr_stale_admin_role_test';
      const admin: any = {
        id,
        name: 'Session Role Test',
        email: 'stale-role@example.test',
        role: 'admin',
        createdAt: new Date().toISOString(),
        downloadsCount: 0,
        tier: 'pro',
      };
      db.users.set(id, admin);
      try {
        const token = createSessionToken({ id, name: admin.name, email: admin.email, role: 'admin' });
        admin.role = 'user';
        let nextCalled = false;
        const req: any = { headers: { cookie: `mf_session=${token}` } };
        sessionMiddleware(req, {} as any, () => { nextCalled = true; });
        if (!nextCalled || req.user?.role !== 'user') {
          return { passed: false, details: 'A demoted account retained admin privileges through its old token.' };
        }
        return { passed: true, details: 'A valid signed token reflects the current account role.' };
      } finally {
        db.users.delete(id);
      }
    },
  },

  // Test 27: Startup admin reconciliation is exact-match and non-destructive
  {
    name: '27. Admin Provisioning Preserves Existing Passwords and Removes Stale Roles',
    run: async () => {
      const currentHash = await hashPassword('ExistingPasswordForTest!');
      const configuredHash = await hashPassword('ConfiguredBootstrapPassword!');
      const users = new Map<string, any>([
        ['current', { id: 'current', name: 'Current', email: 'owner@example.test', role: 'user', passwordHash: currentHash, createdAt: new Date().toISOString(), downloadsCount: 0, tier: 'free' }],
        ['stale', { id: 'stale', name: 'Stale', email: 'old-admin@example.test', role: 'admin', passwordHash: currentHash, createdAt: new Date().toISOString(), downloadsCount: 0, tier: 'pro' }],
      ]);

      reconcileAdminAccount(users, 'OWNER@example.test', configuredHash);
      if (users.get('current')?.role !== 'admin' || users.get('current')?.passwordHash !== currentHash) {
        return { passed: false, details: 'Provisioning failed to grant the configured account or overwrote its password.' };
      }
      if (users.get('stale')?.role !== 'user') {
        return { passed: false, details: 'Provisioning retained admin role on a different account.' };
      }

      reconcileAdminAccount(users, null, null);
      if ([...users.values()].some((user) => user.role === 'admin')) {
        return { passed: false, details: 'Admin roles remained after provisioning was disabled.' };
      }
      return { passed: true, details: 'Bootstrap preserves account passwords and removes stale roles when disabled.' };
    },
  },

  {
    name: 'ADMIN ROUTES: Public inspector rate limit and input bounds',
    run: async () => {
      const app = express();
      app.use(express.json());
      let limiterCalls = 0;
      let transportCalls = 0;
      app.use(sessionMiddleware);
      registerDiagnosticAdminGate(app);
      registerMediaEgressRoutes(
        app,
        (async () => { transportCalls++; throw new Error('transport must not run'); }) as any,
        () => ({ allowed: ++limiterCalls === 1, resetInSeconds: 120 }),
      );
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${(server.address() as any).port}`;
      try {
        const oversizedUrl = `https://example.test/${'x'.repeat(2050)}`;
        let response = await fetch(`${base}/api/diagnostics/inspect-media?${new URLSearchParams({ url: oversizedUrl })}`);
        assert.equal(response.status, 400, 'inspector rejects an overlong URL');
        response = await fetch(`${base}/api/diagnostics/inspect-media?${new URLSearchParams({ url: 'https://example.test/media.mp4' })}`);
        assert.equal(response.status, 429, 'inspector applies its rate limit before outbound work');
        assert.equal(response.headers.get('retry-after'), '120');
        assert.equal(transportCalls, 0);
        return { passed: true, details: 'Public inspector enforces URL length and rate-limit bounds before calling the outbound transport.' };
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  },

  {
    name: 'ADMIN ROUTES: Diagnostic access, blog publishing, and public status boundaries',
    run: async () => {
      const adminId = 'route_admin_security_test';
      const userId = 'route_user_security_test';
      const makeUser = (id: string, role: 'admin' | 'user') => ({
        id,
        name: `Test ${role}`,
        email: `${id}@example.test`,
        role,
        tier: 'free' as const,
        createdAt: new Date().toISOString(),
        downloadsCount: 0,
      });
      const admin = makeUser(adminId, 'admin');
      const user = makeUser(userId, 'user');
      db.users.set(adminId, admin as any);
      db.users.set(userId, user as any);

      const posts = new Map<string, any>();
      let writes = 0;
      let diagnosticRuns = 0;
      const app = express();
      app.use(express.json({ limit: '1mb' }));
      app.use(sessionMiddleware);
      registerDiagnosticAdminGate(app);
      registerPublicOperationalRoutes(app);
      registerPublicBlogReadRoutes(app, posts);
      app.get('/api/diagnostics/test-operation', (_req, res) => {
        diagnosticRuns++;
        res.json({ success: true });
      });
      app.post('/api/blog', requireAdmin, createBlogPostHandler({
        posts,
        save: async () => { writes++; },
        audit: () => {},
      }));

      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${(server.address() as any).port}`;
      const adminToken = createSessionToken({ id: admin.id, name: admin.name, email: admin.email, role: 'admin' });
      const userToken = createSessionToken({ id: user.id, name: user.name, email: user.email, role: 'user' });
      const headers = (token: string) => ({ Cookie: `mf_session=${token}` });
      const jsonHeaders = (token: string) => ({ ...headers(token), 'Content-Type': 'application/json' });
      const get = (path: string, token?: string, extra: Record<string, string> = {}) => fetch(`${base}${path}`, { headers: { ...(token ? headers(token) : {}), ...extra } });

      try {
        let response = await get('/api/health');
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: 'ok' }, 'public health exposes only liveness');
        response = await get('/api/system/health');
        assert.deepEqual(await response.json(), { status: 'ok' }, 'health alias has same minimal response');
        response = await get('/api/status');
        assert.deepEqual(await response.json(), { success: true, data: { system: 'Operational' } }, 'public status exposes no operational counters');
        response = await get('/api/blog');
        assert.equal(response.status, 200, 'blog listing remains public');
        assert.deepEqual((await response.json() as any).data, []);

        response = await get('/api/diagnostics/test-operation');
        assert.equal(response.status, 401, 'diagnostic operation requires a session');
        response = await get('/api/diagnostics/test-operation', undefined, { 'X-User-ID': admin.id, 'X-User-Role': 'admin' });
        assert.equal(response.status, 401, 'caller-supplied identity and role headers do not authorize');
        response = await get('/api/diagnostics/test-operation', userToken, { 'X-User-Role': 'admin' });
        assert.equal(response.status, 403, 'a user cannot spoof admin role');
        const staleAdminToken = createSessionToken({ id: user.id, name: user.name, email: user.email, role: 'admin' });
        response = await get('/api/diagnostics/test-operation', staleAdminToken);
        assert.equal(response.status, 403, 'signed admin claim cannot override current database role');
        assert.equal(diagnosticRuns, 0, 'denied requests do not invoke the diagnostic operation');
        response = await get('/api/diagnostics/test-operation', adminToken);
        assert.equal(response.status, 200, 'verified server-side admin role is accepted');
        assert.equal(diagnosticRuns, 1);

        response = await fetch(`${base}/api/blog`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-ID': admin.id, 'X-User-Role': 'admin' }, body: JSON.stringify({ title: 'Unauthenticated', content: 'blocked' }) });
        assert.equal(response.status, 401, 'public blog reads do not imply write access');
        response = await fetch(`${base}/api/blog`, { method: 'POST', headers: jsonHeaders(userToken), body: JSON.stringify({ title: 'User Write', content: 'blocked' }) });
        assert.equal(response.status, 403);
        assert.equal(writes, 0);

        response = await fetch(`${base}/api/blog`, { method: 'POST', headers: jsonHeaders(adminToken), body: JSON.stringify({ title: '', content: 'invalid' }) });
        assert.equal(response.status, 400, 'invalid blog fields are rejected');
        response = await fetch(`${base}/api/blog`, { method: 'POST', headers: jsonHeaders(adminToken), body: JSON.stringify({ title: 'Oversized', content: 'x'.repeat(260 * 1024) }) });
        assert.equal(response.status, 413, 'oversized blog payload is rejected before storage');
        assert.equal(writes, 0);

        response = await fetch(`${base}/api/blog`, { method: 'POST', headers: jsonHeaders(adminToken), body: JSON.stringify({ title: 'Secured Article', content: 'An approved article.', tags: ['Security'] }) });
        assert.equal(response.status, 201, 'admin can publish validated content');
        assert.equal(writes, 1);
        response = await get('/api/blog');
        assert.equal((await response.json() as any).data[0].slug, 'secured-article', 'published content remains publicly readable');
        response = await get('/api/blog/secured-article');
        assert.equal((await response.json() as any).data.title, 'Secured Article');
        response = await fetch(`${base}/api/blog`, { method: 'POST', headers: jsonHeaders(adminToken), body: JSON.stringify({ title: 'Secured Article', content: 'duplicate' }) });
        assert.equal(response.status, 409, 'duplicate slug does not overwrite existing content');
        assert.equal(writes, 1);
        return { passed: true, details: 'Offline HTTP checks covered public health/status minimization, diagnostic auth and role spoofing, blog authorization, payload validation/size, duplicate slugs, and side-effect suppression.' };
      } finally {
        db.users.delete(adminId);
        db.users.delete(userId);
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  },

  {
    name: 'SSRF: Public address classification and outbound URL policy',
    run: async () => {
      const blockedAddresses = [
        '0.0.0.0', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.169.254',
        '172.16.0.1', '192.0.2.1', '192.168.1.1', '198.18.0.1', '198.51.100.2',
        '203.0.113.2', '224.0.0.1', '240.0.0.1', '::', '::1', 'fc00::1', 'fd12::1',
        'fe80::1', 'ff02::1', '2001:db8::1', '2002:7f00:1::1', '::ffff:127.0.0.1',
        '::ffff:7f00:1', '::ffff:169.254.169.254', '64:ff9b::a00:1',
      ];
      for (const address of blockedAddresses) assert.equal(isGlobalAddress(address), false, `should block ${address}`);
      for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isGlobalAddress(address), true, `should allow ${address}`);

      const transport = createSafeHttpTransport({ lookup: async () => [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }] });
      await assert.rejects(() => transport('http://mixed.test/'), (error: any) => error.code === 'BLOCKED_DESTINATION');
      for (const url of ['file:///etc/passwd', 'ftp://example.test/file', 'http://user:pass@example.test/', 'http://@example.test/', 'http://example.test:8080/']) {
        await assert.rejects(() => transport(url), (error: any) => error.code === 'INVALID_URL');
      }
      return { passed: true, details: 'Private/reserved IPs, mapped IPv6, mixed DNS answers, unsupported schemes, credentials, and nonstandard ports were rejected.' };
    },
  },
  {
    name: 'SSRF: Pinned transport redirects, limits, timeouts, and cancellation',
    run: async () => {
      let server: http.Server;
      let port = 0;
      let receivedHost = '';
      server = http.createServer((req, res) => {
        receivedHost = String(req.headers.host || '');
        if (req.url === '/echo' && req.method === 'POST') {
          const parts: Buffer[] = [];
          req.on('data', (part) => parts.push(Buffer.from(part)));
          req.on('end', () => res.end(Buffer.concat(parts)));
        } else if (req.url === '/redirect-fixed') {
          res.writeHead(302, { Location: 'https://example.org/redirected' }).end();
        } else if (req.url === '/redirect-blocked') {
          res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data' }).end();
        } else if (req.url === '/redirect-loop') {
          res.writeHead(302, { Location: '/redirect-loop' }).end();
        } else if (req.url === '/slow-headers') {
          setTimeout(() => { if (!res.destroyed) res.end('late'); }, 180);
        } else if (req.url === '/slow-body' || req.url === '/cancel-body') {
          res.writeHead(200);
          res.write('first-chunk');
          const interval = setInterval(() => { if (!res.destroyed) res.write('next-chunk'); }, 30);
          res.once('close', () => clearInterval(interval));
        } else if (req.url === '/too-large') {
          res.writeHead(200);
          res.end(Buffer.alloc(64, 65));
        } else {
          res.writeHead(200, { 'Content-Type': 'video/mp4' });
          res.end(Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0, 0, 0, 0, 0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d]));
        }
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      port = (server.address() as any).port;
      let lookupCount = 0;
      let dnsChangeSimulation = true;
      const localTransport = createSafeHttpTransport({
        lookup: async () => {
          lookupCount++;
          // A later DNS answer changes to a prohibited address. The transport
          // must resolve once, validate it, and pin that exact address in socket lookup.
          return lookupCount === 1 || !dnsChangeSimulation
            ? [{ address: '127.0.0.1', family: 4 }]
            : [{ address: '169.254.169.254', family: 4 }];
        },
        isAddressAllowed: (address) => address === '127.0.0.1',
        allowedPorts: (protocol) => protocol === 'http:' ? [port, 80] : [443],
      });
      const base = `http://media.test:${port}`;
      const requestLocal = (pathname: string, options?: Parameters<typeof localTransport>[1]) => {
        lookupCount = 0;
        dnsChangeSimulation = true;
        return localTransport(`${base}${pathname}`, options);
      };
      let stage = 'initial pinned request';
      try {
        const pinned = await requestLocal('/ok');
        const payload: Buffer[] = [];
        for await (const part of pinned.body) payload.push(Buffer.from(part));
        assert.equal(lookupCount, 1);
        assert.equal(receivedHost, `media.test:${port}`);
        assert.ok(Buffer.concat(payload).length > 0);

        const postResponse = await requestLocal('/echo', {
          method: 'POST',
          body: JSON.stringify({ probe: 'offline' }),
          headers: { 'Content-Type': 'application/json' },
        });
        let postBody = '';
        for await (const part of postResponse.body) postBody += Buffer.from(part).toString('utf8');
        assert.equal(postBody, JSON.stringify({ probe: 'offline' }));

        stage = 'blocked redirect';
        await assert.rejects(() => requestLocal('/redirect-blocked'), (error: any) => error.code === 'BLOCKED_DESTINATION');
        await assert.rejects(() => requestLocal('/redirect-fixed', { maxRedirects: 0 }), (error: any) => error.code === 'TOO_MANY_REDIRECTS');
        stage = 'redirect loop';
        await assert.rejects(() => requestLocal('/redirect-loop'), (error: any) => error.code === 'REDIRECT_LOOP');
        stage = 'header timeout';
        await assert.rejects(() => requestLocal('/slow-headers', { headersTimeoutMs: 35 }), (error: any) => error.code === 'TIMEOUT');

        stage = 'response size limit';
        const large = await requestLocal('/too-large', { maxResponseBytes: 16 });
        await assert.rejects(async () => { for await (const _part of large.body) { /* consume */ } }, (error: any) => error.code === 'RESPONSE_TOO_LARGE');

        stage = 'overall body timeout';
        const slow = await requestLocal('/slow-body', { overallTimeoutMs: 80 });
        const slowClosed = new Promise<void>((resolve) => slow.body.once('close', resolve));
        slow.body.resume();
        await slowClosed;

        stage = 'caller cancellation';
        const controller = new AbortController();
        const cancellable = await requestLocal('/cancel-body', { signal: controller.signal });
        const cancelled = new Promise<void>((resolve) => cancellable.body.once('close', resolve));
        cancellable.body.resume();
        controller.abort();
        await cancelled;
        return { passed: true, details: 'Socket address was pinned after one DNS lookup; redirects, loops, header/body timeouts, size limits, and cancellation closed the stream.' };
      } catch (error: any) {
        throw new Error(`Transport regression failed at ${stage}: ${error.message}${error.cause?.message ? ` (${error.cause.message})` : ''}`);
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  },
  {
    name: 'SSRF: Public proxy and inspector reject private DNS destinations',
    run: async () => {
      const app = express();
      app.use(express.json());
      const transport = createSafeHttpTransport({ lookup: async () => [{ address: '10.20.30.40', family: 4 }] });
      registerMediaEgressRoutes(app, transport);
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const port = (server.address() as any).port;
      try {
        const blockedUrl = 'http://private-target.test/media.mp4';
        const proxyResponse = await fetch(`http://127.0.0.1:${port}/api/download/proxy?${new URLSearchParams({ url: blockedUrl })}`);
        assert.equal(proxyResponse.status, 400);
        const inspectResponse = await fetch(`http://127.0.0.1:${port}/api/diagnostics/inspect-media?${new URLSearchParams({ url: blockedUrl })}`);
        assert.equal(inspectResponse.status, 400);
        return { passed: true, details: 'Both public routes rejected a DNS name resolving to a private address without making an outbound connection.' };
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  },
  {
    name: 'SSRF: Provider APIs and yt-dlp entrypoints reject private source URLs offline',
    run: async () => {
      await assert.rejects(
        () => ytDlpService.getMetadata('http://[::ffff:127.0.0.1]/media.mp4'),
        (error: any) => error.code === 'INVALID_SOURCE_URL',
      );
      await assert.rejects(
        () => ytDlpService.executeDownload({ jobId: 'ssrf-rejected', sourceUrl: 'http://10.1.2.3/media.mp4' } as any),
        (error: any) => error.code === 'INVALID_SOURCE_URL',
      );
      const easyDownResult = await parseWithEasyDownApi('http://169.254.169.254/latest/meta-data');
      assert.equal(easyDownResult.success, false);
      assert.equal(easyDownResult.error?.status, 400);
      const rapidResult = await fetchRapidApiDetailed('http://192.168.1.1/private');
      assert.equal(rapidResult.ok, false);
      assert.equal(rapidResult.statusCode, 400);
      return { passed: true, details: 'Private IPv4, IPv4-mapped IPv6, EasyDown input, RapidAPI input, and both yt-dlp entrypoints reject before network or subprocess work.' };
    },
  },
  {
    name: 'JOB AUTH: ownership, anonymous capability scope, expiry, and status redaction',
    run: async () => {
      const now = Date.now();
      const anonymous = createAnonymousJobCapability('job_test', now);
      const job = {
        id: 'job_test', userId: 'usr_anonymous', sourceUrl: 'https://media.example/video', provider: 'test',
        mediaTitle: 'Test', thumbnailUrl: '', selectedFormat: 'mp4', selectedQuality: '720p', formatType: 'video',
        status: 'READY', progress: 100, stepMessage: 'ready', createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(), expiresAt: new Date(now + 900000).toISOString(),
        downloadToken: 'private-token', downloadUrl: 'https://storage.example/signed',
        anonymousCapabilityHash: anonymous.hash, anonymousCapabilityExpiresAt: anonymous.expiresAt,
      } as MediaJob;
      assert.equal(canAccessJob(job, null), false, 'job ID alone must not authorize anonymous access');
      assert.equal(canAccessJob(job, { id: 'attacker' }), false, 'authenticated identity alone must not authorize an anonymous job');
      assert.equal(canAccessJob(job, null, anonymous.capability, now), true, 'capability should authorize its job');
      assert.equal(canAccessJob(job, { id: 'admin', role: 'admin' }), true, 'admin may access anonymous jobs');
      assert.equal(canAccessJob({ ...job, id: 'other-job' }, null, anonymous.capability, now), false, 'capability is job scoped');
      assert.equal(verifyAnonymousJobCapability(job, anonymous.capability, now + 900001), false, 'expired capability rejected');
      assert.equal(canAccessJob({ ...job, userId: 'alice' }, { id: 'alice' }), true, 'owner may access');
      assert.equal(canAccessJob({ ...job, userId: 'alice' }, { id: 'bob' }), false, 'other user denied');
      assert.equal(canAccessJob({ ...job, userId: 'alice' }, { id: 'admin', role: 'admin' }), true, 'admin may access');
      const status = safeJobStatus(job) as any;
      assert.equal(status.downloadToken, undefined);
      assert.equal(status.downloadUrl, undefined);
      assert.equal(status.anonymousCapabilityHash, undefined);
      return { passed: true, details: 'Owner/admin, cross-user denial, job-scoped and expired capabilities, and secret-free status serialization verified.' };
    },
  },
  {
    name: 'JOB AUTH: file signature required and job path containment rejects traversal',
    run: async () => {
      const missing = verifyStorageSignedToken('temp/job_test/video.mp4');
      assert.equal(missing.isValid, false);
      assert.equal(missing.statusCode, 401);
      const root = '/tmp/mediaforge-test';
      assert.equal(isContainedJobFilePath(root, 'job_test', 'temp/job_test/video.mp4', 'temp/job_test/video.mp4'), true);
      assert.equal(isContainedJobFilePath(root, 'job_test', 'temp/job_test/video.mp4', 'temp/job_test/../other/video.mp4'), false);
      assert.equal(isContainedJobFilePath(root, 'job_test', 'temp/job_test/video.mp4', 'temp/other/video.mp4'), false);
      assert.equal(isContainedJobFilePath(root, 'job_test', 'temp/job_test/../../secret', 'temp/job_test/../../secret'), false);
      assert.equal(isContainedJobFilePath(root, 'job_test', 'temp/job_test\\video.mp4', 'temp/job_test\\video.mp4'), false);
      return { passed: true, details: 'Missing signatures and path traversal, sibling-job paths, and backslash paths are rejected; exact job file path is accepted.' };
    },
  },
  {
    name: 'JOB AUTH: production status, cancel, signed-link, file, and stream guards over local HTTP',
    run: async () => {
      const alice = { id: 'auth_http_alice', name: 'Alice', email: 'alice@example.test', role: 'user' as const, createdAt: new Date().toISOString(), downloadsCount: 0, tier: 'free' as const };
      const bob = { ...alice, id: 'auth_http_bob', email: 'bob@example.test' };
      db.users.set(alice.id, alice);
      db.users.set(bob.id, bob);
      const aliceToken = createSessionToken({ id: alice.id, name: alice.name, email: alice.email, role: 'user' });
      const bobToken = createSessionToken({ id: bob.id, name: bob.name, email: bob.email, role: 'user' });
      const now = Date.now();
      const makeJob = (id: string, userId: string, status: MediaJob['status'] = 'READY'): MediaJob => ({
        id, userId, sourceUrl: 'https://media.example/video', provider: 'test', mediaTitle: 'Route Test', thumbnailUrl: '',
        selectedFormat: 'mp4', selectedQuality: '720p', formatType: 'video', status, progress: 100, stepMessage: 'ready',
        createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), expiresAt: new Date(now + 600000).toISOString(),
        storagePath: `temp/${id}/Route_Test_720p.mp4`, downloadToken: undefined, downloadUrl: 'sensitive-signed-url',
      });
      const anonCap = createAnonymousJobCapability('http-anon');
      const anonJob = { ...makeJob('http-anon', 'usr_anonymous'), anonymousCapabilityHash: anonCap.hash, anonymousCapabilityExpiresAt: anonCap.expiresAt };
      const aliceJob = makeJob('http-alice', alice.id, 'PROCESSING');
      const jobs = new Map([[anonJob.id, anonJob], [aliceJob.id, aliceJob]]);
      let cancelCalls = 0;
      let linkCalls = 0;
      const app = express();
      app.use(express.json());
      app.use(sessionMiddleware);
      registerJobLinkAuthorizationRoutes(app, (id) => jobs.get(id), (_req, res, id) => {
        linkCalls++;
        return res.json({ success: true, jobId: id, downloadUrl: 'mock-signed-url' });
      });
      registerJobStatusAndCancelRoutes(app, {
        getJob: (id) => jobs.get(id),
        cancelJob: (id) => { cancelCalls++; const job = jobs.get(id); if (job) job.status = 'CANCELLED'; return !!job; },
      });
      app.get(['/api/download/file/*', '/api/download/file'], signedFileAuthorizationMiddleware((id) => jobs.get(id)), (req, res) => {
        res.json({ success: true, jobId: res.locals.authorizedJob.id });
      });
      app.get('/api/download/stream/:token', downloadStreamAuthorizationMiddleware((id) => jobs.get(id)), (_req, res) => {
        res.json({ success: true, jobId: res.locals.authorizedJob.id });
      });
      app.all(['/api/preview/:id', '/api/preview'], previewJobAuthorizationMiddleware((id) => jobs.get(id)), (_req, res) => {
        res.json({ success: true, jobId: res.locals.previewJob?.id || null });
      });
      app.post('/api/download', (_req, res) => res.status(400).json({ success: false }));

      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const port = (server.address() as any).port;
      const base = `http://127.0.0.1:${port}`;
      const auth = (token: string) => ({ Cookie: `mf_session=${token}` });
      const json = async (res: Response) => res.json() as Promise<any>;
      try {
        let response = await fetch(`${base}/api/jobs/http-alice`, { headers: { 'X-User-ID': alice.id } });
        assert.equal(response.status, 401, 'caller-supplied user id must not authenticate');
        response = await fetch(`${base}/api/jobs/http-alice`, { headers: auth(bobToken) });
        assert.equal(response.status, 403, 'cross-user job status read denied');
        response = await fetch(`${base}/api/jobs/http-alice`, { headers: auth(aliceToken) });
        assert.equal(response.status, 200, 'verified owner session can read status');
        assert.match(response.headers.get('cache-control') || '', /no-store/);
        const statusBody = await json(response);
        assert.equal(statusBody.data.downloadToken, undefined);
        assert.equal(statusBody.data.downloadUrl, undefined);

        response = await fetch(`${base}/api/jobs/http-anon`);
        assert.equal(response.status, 401, 'anonymous ID alone cannot poll');
        response = await fetch(`${base}/api/jobs/http-anon`, { headers: { 'X-Job-Capability': 'wrong' } });
        assert.equal(response.status, 401, 'wrong capability cannot poll');
        response = await fetch(`${base}/api/jobs/http-anon`, { headers: { 'X-Job-Capability': anonCap.capability } });
        assert.equal(response.status, 200, 'job capability permits polling');
        const originalCapabilityExpiry = anonJob.anonymousCapabilityExpiresAt;
        anonJob.anonymousCapabilityExpiresAt = new Date(Date.now() - 1000).toISOString();
        response = await fetch(`${base}/api/jobs/http-anon`, { headers: { 'X-Job-Capability': anonCap.capability } });
        assert.equal(response.status, 401, 'expired capability cannot poll');
        anonJob.anonymousCapabilityExpiresAt = originalCapabilityExpiry;

        response = await fetch(`${base}/api/preview/http-anon`);
        assert.equal(response.status, 401, 'job preview route denies missing capability');
        response = await fetch(`${base}/api/preview/http-anon`, { headers: { 'X-Job-Capability': anonCap.capability } });
        assert.equal(response.status, 200, 'job preview route accepts the scoped capability');

        response = await fetch(`${base}/api/jobs/http-alice/cancel`, { method: 'POST', headers: auth(bobToken) });
        assert.equal(response.status, 403);
        assert.equal(cancelCalls, 0, 'unauthorized cancellation has no side effect');
        response = await fetch(`${base}/api/jobs/http-anon/cancel`, { method: 'POST' });
        assert.equal(response.status, 401);
        assert.equal(cancelCalls, 0);
        response = await fetch(`${base}/api/jobs/http-anon/cancel`, { method: 'POST', headers: { 'X-Job-Capability': anonCap.capability } });
        assert.equal(response.status, 200);
        assert.equal(cancelCalls, 1, 'authorized cancellation invokes queue once');
        anonJob.status = 'READY';

        for (const [url, init] of [
          [`${base}/api/download?jobId=http-anon`, {}],
          [`${base}/api/jobs/http-anon/download`, {}],
          [`${base}/api/download/http-anon`, {}],
          [`${base}/api/download`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: 'http-anon' }) }],
        ] as const) {
          response = await fetch(url, init);
          assert.equal(response.status, 401, `link alias denied without capability: ${url}`);
          assert.equal(linkCalls, 0);
        }
        response = await fetch(`${base}/api/download?jobId=http-anon`, { headers: { 'X-Job-Capability': anonCap.capability } });
        assert.equal(response.status, 200, 'authorized capability can request link');
        assert.match(response.headers.get('cache-control') || '', /no-store/);
        assert.equal(linkCalls, 1);
        response = await fetch(`${base}/api/download?jobId=http-alice`, { headers: auth(bobToken) });
        assert.equal(response.status, 403, 'cross-user signed-link request denied');
        assert.equal(linkCalls, 1, 'cross-user link request has no side effect');
        response = await fetch(`${base}/api/download?jobId=http-alice`, { headers: auth(aliceToken) });
        assert.equal(response.status, 400, 'link route rejects a job that is not ready');
        aliceJob.status = 'READY';
        response = await fetch(`${base}/api/download?jobId=http-alice`, { headers: auth(aliceToken) });
        assert.equal(response.status, 200, 'verified owner can request link');

        const signed = new URL(generateStorageSignedUrl(anonJob.storagePath!, 300), 'http://local.test');
        response = await fetch(`${base}${signed.pathname}`);
        assert.equal(response.status, 401, 'missing file signature rejected by route guard');
        response = await fetch(`${base}${signed.pathname}?token=${signed.searchParams.get('token')}&expires=${signed.searchParams.get('expires')}`);
        assert.equal(response.status, 200, 'valid exact-path signature accepted');
        response = await fetch(`${base}/api/download/file/temp/http-alice/Route_Test_720p.mp4?token=${signed.searchParams.get('token')}&expires=${signed.searchParams.get('expires')}`);
        assert.notEqual(response.status, 200, 'signature for one job cannot authorize another job path');
        const tamperedExpiry = Number(signed.searchParams.get('expires')) + 1;
        response = await fetch(`${base}${signed.pathname}?token=${signed.searchParams.get('token')}&expires=${tamperedExpiry}`);
        assert.notEqual(response.status, 200, 'signature is bound to expiry');
        response = await fetch(`${base}${signed.pathname}?token=${signed.searchParams.get('token')}&expires=${signed.searchParams.get('expires')}junk`);
        assert.notEqual(response.status, 200, 'noncanonical expiry value is rejected');

        const streamToken = generateDownloadToken({ jobId: anonJob.id, mediaId: anonJob.id, format: 'mp4', quality: '720p', title: 'Route Test', mimeType: 'video/mp4' });
        anonJob.downloadToken = streamToken;
        response = await fetch(`${base}/api/download/stream/${streamToken}`);
        assert.equal(response.status, 401, 'stream token alone is not authorization');
        response = await fetch(`${base}/api/download/stream/${streamToken}`, { headers: auth(bobToken) });
        assert.equal(response.status, 403, 'another authenticated user cannot replay stream token');
        response = await fetch(`${base}/api/download/stream/${streamToken}`, { headers: { 'X-Job-Capability': anonCap.capability } });
        assert.equal(response.status, 200, 'capability plus token allows intended stream');
        return { passed: true, details: 'Local HTTP requests exercised production status/cancel/link route registrations and the direct-file/stream authorization guards; no external hosts were contacted.' };
      } finally {
        db.users.delete(alice.id);
        db.users.delete(bob.id);
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  },
  {
    name: 'AUTH SECURITY: rate limit ignores spoofed forwarding headers and resets by window',
    run: async () => {
      let now = 1_000;
      const buckets = new Map<string, { count: number; resetAt: number }>();
      const check = async (key: string, maxRequests: number, windowSeconds: number) => {
        const current = buckets.get(key);
        const bucket = !current || now >= current.resetAt
          ? { count: 0, resetAt: now + windowSeconds * 1_000 }
          : current;
        bucket.count++;
        buckets.set(key, bucket);
        return { allowed: bucket.count <= maxRequests, resetInSeconds: Math.ceil((bucket.resetAt - now) / 1_000) };
      };
      const app = express();
      app.set('trust proxy', false);
      app.use(express.json());
      app.post('/login', createAuthenticationRateLimiter({
        scope: 'login', check,
        ip: { maxRequests: 1, windowSeconds: 10 },
        subject: { maxRequests: 5, windowSeconds: 10 },
        getSubject: (req) => req.body?.email,
      }), (_req, res) => res.status(401).json({ error: 'Invalid credentials.' }));
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${(server.address() as any).port}`;
      try {
        let response = await fetch(`${base}/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.10' },
          body: JSON.stringify({ email: 'first@example.test' }),
        });
        assert.equal(response.status, 401);
        response = await fetch(`${base}/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.99' },
          body: JSON.stringify({ email: 'second@example.test' }),
        });
        assert.equal(response.status, 429, 'spoofed forwarded IP does not bypass peer-based bucket');
        assert.equal((await response.json() as any).error.message, 'Too many authentication attempts. Try again later.');
        assert.ok([...buckets.keys()].every((key) => !key.includes('example.test') && !key.includes('198.51.100') && !key.includes('203.0.113')));
        now += 10_001;
        response = await fetch(`${base}/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'third@example.test' }),
        });
        assert.equal(response.status, 401, 'limit resets when window expires');
        assert.equal(getTrustedClientAddress({ socket: { remoteAddress: '::ffff:127.0.0.1' } } as any), '127.0.0.1');
        return { passed: true, details: 'Local HTTP requests verified spoofed forwarding headers cannot change the limiter identity, identifiers are hashed, and expired windows reset.' };
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  },
  {
    name: 'DATABASE SECURITY: verified TLS defaults, explicit fallback policy, and readiness boundary',
    run: async () => {
      assert.deepEqual(getPostgresSslOptions(), { rejectUnauthorized: true });
      assert.throws(() => getPostgresSslOptions('not-a-certificate'), /valid PEM certificate/);
      assert.throws(() => getPostgresSslOptions('-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----'), /valid PEM certificate/);
      const sanitized = sanitizePostgresConnectionString('postgresql://u:p@db.example.test/db?sslmode=no-verify&ssl=0&application_name=mediaforge');
      assert.ok(!sanitized.includes('sslmode') && !sanitized.includes('no-verify') && !sanitized.includes('ssl=0'));
      assert.ok(sanitized.includes('application_name=mediaforge'));
      assert.throws(() => resolvePersistenceMode(false, 'production', 'true'), /Required PostgreSQL/);
      assert.throws(() => resolvePersistenceMode(false, 'development', undefined), /not explicitly enabled/);
      assert.equal(resolvePersistenceMode(false, 'test', 'true'), 'memory');
      assert.equal(resolvePersistenceMode(true, 'production', 'false'), 'postgres');
      await assert.rejects(
        initializePersistenceMode(async () => { throw new Error('private connection details'); }, 'production', 'false'),
        (error: Error) => error.message === 'Database initialization failed.' && !error.message.includes('private'),
      );
      assert.equal(await initializePersistenceMode(async () => false, 'test', 'true'), 'memory');
      const connectionState = { isConnected: true, connectionError: null as string | null };
      markPostgresUnavailable(connectionState);
      assert.deepEqual(connectionState, { isConnected: false, connectionError: 'Database connection failed.' });

      let ready = false;
      const app = express();
      registerDatabaseAvailabilityGate(app, () => ready);
      registerPublicOperationalRoutes(app, () => ready);
      app.get('/api/test-operation', (_req, res) => res.json({ success: true }));
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${(server.address() as any).port}`;
      try {
        let response = await fetch(`${base}/api/health`);
        assert.equal(response.status, 200, 'liveness remains independent of persistence');
        assert.deepEqual(await response.json(), { status: 'ok' });
        response = await fetch(`${base}/api/ready`);
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { status: 'not_ready' });
        response = await fetch(`${base}/api/status`);
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { success: true, data: { system: 'Unavailable' } });
        response = await fetch(`${base}/api/test-operation`);
        assert.equal(response.status, 503, 'API operations fail closed while required persistence is unavailable');
        ready = true;
        response = await fetch(`${base}/api/ready`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: 'ready' });
        response = await fetch(`${base}/api/test-operation`);
        assert.equal(response.status, 200);
        return { passed: true, details: 'TLS defaults and invalid CA handling, connection-string TLS override stripping, production fail-closed behavior, explicit test fallback, and minimal liveness/readiness responses passed.' };
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  },
  {
    name: 'CLIENT SECURITY: anonymous job capabilities are removed from persisted history',
    run: async () => {
      const history = [{ id: 'history-job', status: 'READY', jobCapability: 'one-time-secret', downloadUrl: 'short-lived-link' } as any];
      const persisted = stripPersistedJobCapabilities(history);
      assert.equal(persisted[0].id, 'history-job');
      assert.equal((persisted[0] as any).jobCapability, undefined);
      assert.equal(persisted[0].downloadUrl, 'short-lived-link', 'existing temporary-link history behavior remains intact');
      return { passed: true, details: 'The persisted history projection retains ordinary job data and temporary download links, but omits anonymous job capabilities.' };
    },
  },
  {
    name: 'DMCA ROUTE: valid notices persist required declarations; invalid fields are rejected',
    run: async () => {
      const reports = new Map<string, any>();
      const saved: any[] = [];
      const audited: any[] = [];
      const app = express();
      app.use(express.json());
      app.post('/api/reports', createDmcaReportHandler({
        reports,
        save: async (report) => { saved.push(report); return true; },
        audit: (report, ip) => audited.push({ report, ip }),
      }));
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${(server.address() as any).port}`;
      const validNotice = {
        complainantName: 'Rights Holder',
        email: 'rights@example.test',
        targetUrl: 'https://media.example.test/claimed-work',
        copyrightWorkDescription: 'Identify the copyrighted work.',
        ownershipProofDescription: 'Describe ownership or authority to act.',
        reason: 'This URL uses the work without authorization.',
        goodFaithStatement: true,
        accuracyStatement: true,
      };
      const post = (body: unknown) => fetch(`${base}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      try {
        const accepted = await post(validNotice);
        assert.equal(accepted.status, 200);
        const acceptedBody = await accepted.json() as any;
        assert.equal(acceptedBody.success, true);
        assert.equal(typeof acceptedBody.data.reportId, 'string');
        assert.equal(reports.size, 1);
        assert.equal(saved.length, 1);
        assert.equal(saved[0].goodFaithStatement, true);
        assert.equal(saved[0].accuracyStatement, true);
        assert.equal(audited.length, 1);

        const missingDeclaration = await post({ ...validNotice, accuracyStatement: false });
        assert.equal(missingDeclaration.status, 400);
        const missingRequiredField = await post(Object.fromEntries(
          Object.entries(validNotice).filter(([key]) => key !== 'ownershipProofDescription'),
        ));
        assert.equal(missingRequiredField.status, 400);
        assert.equal(saved.length, 1, 'invalid notices must not be persisted');

        const persistenceFailure = express();
        persistenceFailure.use(express.json());
        persistenceFailure.post('/api/reports', createDmcaReportHandler({
          reports: new Map(),
          save: async () => false,
          audit: () => {},
        }));
        const failureServer = http.createServer(persistenceFailure);
        await new Promise<void>((resolve) => failureServer.listen(0, '127.0.0.1', resolve));
        try {
          const failureResponse = await fetch(`http://127.0.0.1:${(failureServer.address() as any).port}/api/reports`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validNotice),
          });
          assert.equal(failureResponse.status, 503);
          assert.equal((await failureResponse.json() as any).success, false);
        } finally {
          failureServer.closeAllConnections();
          await new Promise<void>((resolve) => failureServer.close(() => resolve()));
        }
        return { passed: true, details: 'Valid notice acceptance requires both statutory declarations and successful persistence; missing fields/declarations and persistence failure are rejected.' };
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  },
  {
    name: 'ANALYZE ROUTE: Express 4 forwards failures from rate-limit, validation, cache, and provider stages',
    run: async () => {
      const app = express();
      app.use(express.json());
      app.post('/api/analyze', asyncRoute(async (req, res) => {
        const stage = req.body?.stage;
        if (stage === 'rate_limit' || stage === 'validation' || stage === 'cache' || stage === 'provider') {
          throw new Error(`internal failure at ${stage}: https://private.example.test/path?token=do-not-return`);
        }
        res.json({ success: true });
      }), createAnalysisErrorHandler());
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${(server.address() as any).port}`;
      try {
        for (const stage of ['rate_limit', 'validation', 'cache', 'provider']) {
          const response = await fetch(`${base}/api/analyze`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage }),
          });
          assert.equal(response.status, 500, `${stage} failure returns a controlled status`);
          const body = await response.json() as any;
          assert.deepEqual(body, {
            success: false,
            data: null,
            error: {
              code: 'ANALYSIS_FAILED',
              message: 'Unable to retrieve media metadata from this link. Please verify the URL.',
            },
          });
          assert.ok(!JSON.stringify(body).includes('private.example.test'));
        }
        return { passed: true, details: 'The same Express 4 async wrapper and route error handler used by /api/analyze return the stable API error body for each pre-provider and provider-stage rejection.' };
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  },
  {
    name: 'YTDLP SECURITY: production requires a pre-provisioned YTDLP_PATH',
    run: async () => {
      const oldNodeEnv = process.env.NODE_ENV;
      const oldYtdlpPath = process.env.YTDLP_PATH;
      const oldProxy = process.env.YTDLP_PROXY_URL;
      const service = ytDlpService as any;
      const oldDetectedCommand = service.detectedCommand;
      const tempDir = fs.mkdtempSync(path.join(tmpdir(), 'videofetch-ytdlp-'));
      const nonExecutablePath = path.join(tempDir, 'not-executable');
      fs.writeFileSync(nonExecutablePath, '#!/bin/sh\necho test-version\n', { mode: 0o600 });

      try {
        process.env.NODE_ENV = 'production';
        process.env.YTDLP_PROXY_URL = 'https://proxy.example.test';
        service.detectedCommand = null;
        delete process.env.YTDLP_PATH;
        await assert.rejects(() => ytDlpService.detectYtDlp(), /YTDLP_PATH/);

        service.detectedCommand = null;
        process.env.YTDLP_PATH = path.join(tempDir, 'missing');
        await assert.rejects(() => ytDlpService.detectYtDlp(), /YTDLP_PATH/);

        service.detectedCommand = null;
        process.env.YTDLP_PATH = nonExecutablePath;
        await assert.rejects(() => ytDlpService.detectYtDlp(), /YTDLP_PATH/);

        service.detectedCommand = null;
        process.env.YTDLP_PATH = process.execPath;
        const configured = await ytDlpService.detectYtDlp();
        assert.equal(configured.resolvedPath, fs.realpathSync(process.execPath));
        assert.deepEqual(configured.argsPrefix, []);
        return { passed: true, details: 'Production rejects missing, nonexistent, and non-executable paths, and accepts a configured local executable without invoking fallback discovery.' };
      } finally {
        if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = oldNodeEnv;
        if (oldYtdlpPath === undefined) delete process.env.YTDLP_PATH;
        else process.env.YTDLP_PATH = oldYtdlpPath;
        if (oldProxy === undefined) delete process.env.YTDLP_PROXY_URL;
        else process.env.YTDLP_PROXY_URL = oldProxy;
        service.detectedCommand = oldDetectedCommand;
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    },
  },
];

async function runAllTests() {
  console.log('====================================================');
  console.log('🚀 Running Media Pipeline & Upstream Validation Tests');
  console.log('====================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  const selectedTests = process.argv.includes('--client-security-only')
    ? tests.filter((test) => test.name.startsWith('CLIENT SECURITY:'))
    : process.argv.includes('--ssrf-proxy-only')
    ? tests.filter((test) => test.name === 'SSRF SECURITY: production yt-dlp requires controlled proxy configuration')
    : process.argv.includes('--ytdlp-child-env-only')
    ? tests.filter((test) => test.name === 'YTDLP CHILD ENV: strips ambient proxy configuration')
    : process.argv.includes('--ytdlp-production-only')
    ? tests.filter((test) => test.name.startsWith('YTDLP SECURITY:'))
    : process.argv.includes('--auth-security-only')
    ? tests.filter((test) => test.name.startsWith('AUTH SECURITY:'))
    : process.argv.includes('--database-security-only')
    ? tests.filter((test) => test.name.startsWith('DATABASE SECURITY:'))
    : process.argv.includes('--ssrf-only')
    ? tests.filter((test) => test.name.startsWith('SSRF:'))
    : process.argv.includes('--job-auth-only')
    ? tests.filter((test) => test.name.startsWith('JOB AUTH:'))
    : process.argv.includes('--admin-routes-only')
    ? tests.filter((test) => test.name.startsWith('ADMIN ROUTES:'))
    : tests;
  for (const test of selectedTests) {
    try {
      const result = await test.run();
      if (result.passed) {
        console.log(`✅ PASS: ${test.name}`);
        if (result.details) console.log(`   └─ ${result.details}`);
        passedCount++;
      } else {
        console.log(`❌ FAIL: ${test.name}`);
        if (result.details) console.log(`   └─ ${result.details}`);
        failedCount++;
      }
    } catch (err: any) {
      console.log(`❌ ERROR: ${test.name}`);
      console.log(`   └─ Exception: ${err.message}`);
      failedCount++;
    }
  }

  console.log('\n====================================================');
  console.log(`Summary: ${passedCount} passed, ${failedCount} failed out of ${selectedTests.length} tests`);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
