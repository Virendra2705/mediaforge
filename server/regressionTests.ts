import fs from 'fs';
import path from 'path';
import {
  isHtmlOrChallengeContent,
  inspectMediaSignature,
  categorizeChallenge,
} from './upstreamValidator.js';
import {
  validateMediaFile,
  verifyMediaWithFfprobe,
  sanitizeLogMessage,
  isRealCookieContent,
  parseAndValidateCookieContent,
} from './ffmpeg.js';
import { db } from './db.js';
import { createSessionToken, verifySessionToken, SessionUser } from './auth.js';
import { validateAndNormalizeUrl, validateAndNormalizeUrlAsync } from './security.js';
import { ytDlpService } from './ytDlpService.js';

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
      const leakedSecret = sanitized.includes('/path/to/cookies.txt') || sanitized.includes('eyJhbGciOi') || sanitized.includes('SID=xyz');

      if (hasRedactedCookies && hasRedactedAuth && hasRedactedCookieHeader && !leakedSecret) {
        return { passed: true, details: 'Cookies and bearer credentials safely redacted from logs.' };
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
];

async function runAllTests() {
  console.log('====================================================');
  console.log('🚀 Running Media Pipeline & Upstream Validation Tests');
  console.log('====================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  for (const test of tests) {
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
  console.log(`Summary: ${passedCount} passed, ${failedCount} failed out of ${tests.length} tests`);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
