import fs from 'fs';
import path from 'path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { requestSafeHttp, SafeHttpResponse } from './outboundHttp.js';

export interface UpstreamValidationResult {
  valid: boolean;
  statusCode?: number;
  finalUrl?: string;
  contentType?: string;
  contentLength?: number;
  mimeType?: string;
  extension?: string;
  errorCategory?:
    | 'UPSTREAM_NOT_MEDIA'
    | 'UPSTREAM_HTML_CHALLENGE'
    | 'UPSTREAM_AUTH_REQUIRED'
    | 'UPSTREAM_MEDIA_UNAVAILABLE'
    | 'UPSTREAM_BOT_PROTECTION'
    | 'UPSTREAM_ACCESS_DENIED'
    | 'MEDIA_SIGNATURE_INVALID'
    | 'MEDIA_FFPROBE_FAILED'
    | 'MEDIA_TYPE_MISMATCH'
    | 'MEDIA_EMPTY'
    | 'DOWNLOAD_FAILED'
    | 'FILE_NOT_FOUND'
    | 'UPSTREAM_REDIRECT_ERROR';
  errorMessage?: string;
  isHtml?: boolean;
}

export interface MediaSignatureCheck {
  valid: boolean;
  detectedFormat?: string;
  detectedMime?: string;
  error?: string;
  errorCategory?:
    | 'UPSTREAM_HTML_CHALLENGE'
    | 'UPSTREAM_AUTH_REQUIRED'
    | 'UPSTREAM_BOT_PROTECTION'
    | 'UPSTREAM_ACCESS_DENIED'
    | 'MEDIA_SIGNATURE_INVALID'
    | 'UPSTREAM_NOT_MEDIA';
}

// Signatures that identify HTML, Auth pages, Cookie checks, Captchas, bot protection, or error pages
const HTML_AND_CHALLENGE_INDICATORS = [
  '<!doctype html',
  '<html',
  '<head',
  '<body',
  '<title>cookie check</title>',
  'cookie check',
  'action required to load your app',
  'browser is blocking a required security cookie',
  'authenticate in new window',
  'grant permission',
  'required security cookie',
  'google ai studio',
  'ai_studio',
  'aistudio',
  '__secure-aistudio_auth_flow',
  'aistudio_auth_flow',
  'requeststorageaccess',
  'document.hasstorageaccess',
  'sign in - google accounts',
  'accounts.google.com',
  'cf-browser-verification',
  'cloudflare',
  'ray id:',
  'just a moment...',
  'please wait while we verify you are human',
  'challenge-platform',
  'recaptcha',
  'g-recaptcha',
  'hcaptcha',
  'turnstile',
  'security check',
  'please enable cookies',
  'access denied',
  'attention required',
  'ddos-guard',
  '<title>404',
  '<title>403',
  '<title>500',
  '<title>access denied',
  '{"error"',
  '{"message":',
  '{"status":',
  '{"code":',
  '<?xml',
  '<errors>',
  '<error>',
];

/**
 * Checks if initial bytes or text snippet contains HTML, Cookie challenge, Auth or XML/JSON error signatures
 */
export function isHtmlOrChallengeContent(bufferOrText: Buffer | string): boolean {
  if (!bufferOrText) return false;
  const str =
    typeof bufferOrText === 'string'
      ? bufferOrText.toLowerCase()
      : bufferOrText.toString('utf8', 0, Math.min(bufferOrText.length, 4096)).toLowerCase();

  for (const indicator of HTML_AND_CHALLENGE_INDICATORS) {
    if (str.includes(indicator)) {
      return true;
    }
  }

  // HTML structural tag heuristics
  const trimmed = str.trim();
  if (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<?xml') ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('<!') ||
    trimmed.startsWith('<script') ||
    trimmed.startsWith('<head')
  ) {
    return true;
  }

  // Tag frequency heuristic (if contains typical markup tags)
  if (
    (str.includes('<div') && str.includes('</div>')) ||
    (str.includes('<p>') && str.includes('</p>')) ||
    (str.includes('<script') && str.includes('</script>'))
  ) {
    return true;
  }

  return false;
}

/**
 * Determines specific challenge category from text/buffer
 */
export function categorizeChallenge(
  bufferOrText: Buffer | string
): 'UPSTREAM_HTML_CHALLENGE' | 'UPSTREAM_AUTH_REQUIRED' | 'UPSTREAM_BOT_PROTECTION' | 'UPSTREAM_ACCESS_DENIED' | 'UPSTREAM_NOT_MEDIA' {
  const str =
    typeof bufferOrText === 'string'
      ? bufferOrText.toLowerCase()
      : bufferOrText.toString('utf8', 0, Math.min(bufferOrText.length, 4096)).toLowerCase();

  if (
    str.includes('cookie check') ||
    str.includes('aistudio_auth_flow') ||
    str.includes('required security cookie') ||
    str.includes('action required to load your app') ||
    str.includes('authenticate in new window')
  ) {
    return 'UPSTREAM_HTML_CHALLENGE';
  }

  if (
    str.includes('cloudflare') ||
    str.includes('turnstile') ||
    str.includes('recaptcha') ||
    str.includes('hcaptcha') ||
    str.includes('just a moment...') ||
    str.includes('verify you are human') ||
    str.includes('ddos-guard')
  ) {
    return 'UPSTREAM_BOT_PROTECTION';
  }

  if (
    str.includes('access denied') ||
    str.includes('403 forbidden') ||
    str.includes('unauthorized') ||
    str.includes('sign in') ||
    str.includes('login')
  ) {
    return 'UPSTREAM_AUTH_REQUIRED';
  }

  return 'UPSTREAM_NOT_MEDIA';
}

/**
 * Inspects binary magic bytes for valid media container signatures
 */
export function inspectMediaSignature(
  buf: Buffer,
  expectedType: 'video' | 'audio' | 'all' = 'all'
): MediaSignatureCheck {
  if (!buf || buf.length < 4) {
    return {
      valid: false,
      errorCategory: 'MEDIA_SIGNATURE_INVALID',
      error: 'Insufficient bytes to determine media container signature',
    };
  }

  // 1. MP4 / ISO Base Media / QuickTime / M4V / M4A / 3GP
  // Bytes 4-8 usually contain 'ftyp', 'moov', 'mdat', 'wide', 'free', 'skip', or 'pnot'
  if (buf.length >= 8) {
    const box = buf.toString('ascii', 4, 8);
    if (
      box === 'ftyp' ||
      box === 'moov' ||
      box === 'mdat' ||
      box === 'wide' ||
      box === 'free' ||
      box === 'skip' ||
      box === 'pnot' ||
      box === 'uuid'
    ) {
      let isM4A = false;
      if (buf.length >= 12) {
        const majorBrand = buf.toString('ascii', 8, 12).toLowerCase();
        isM4A = majorBrand.startsWith('m4a') || majorBrand.startsWith('m4b') || majorBrand.startsWith('m4p');
      }
      return {
        valid: true,
        detectedFormat: isM4A ? 'm4a' : 'mp4',
        detectedMime: isM4A ? 'audio/mp4' : 'video/mp4',
      };
    }
  }

  // 2. WebM / Matroska (EBML signature: 0x1A 0x45 0xDF 0xA3)
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return {
      valid: true,
      detectedFormat: 'webm',
      detectedMime: 'video/webm',
    };
  }

  // 3. MP3 (ID3v2 tag: "ID3" or MP3 Sync frame 0xFF with MPEG layer 0xE0..0xFF)
  if (buf.length >= 3 && buf.toString('ascii', 0, 3) === 'ID3') {
    return {
      valid: true,
      detectedFormat: 'mp3',
      detectedMime: 'audio/mpeg',
    };
  }
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0 && (buf[1] & 0x18) !== 0x08) {
    return {
      valid: true,
      detectedFormat: 'mp3',
      detectedMime: 'audio/mpeg',
    };
  }

  // 4. WAV / AVI (RIFF / RIFX container with WAVE or AVI format)
  if (buf.length >= 12 && (buf.toString('ascii', 0, 4) === 'RIFF' || buf.toString('ascii', 0, 4) === 'RIFX')) {
    const format = buf.toString('ascii', 8, 12);
    if (format === 'WAVE') {
      return {
        valid: true,
        detectedFormat: 'wav',
        detectedMime: 'audio/wav',
      };
    }
    if (format === 'AVI ') {
      return {
        valid: true,
        detectedFormat: 'avi',
        detectedMime: 'video/x-msvideo',
      };
    }
  }

  // 5. OGG ("OggS")
  if (buf.length >= 4 && buf.toString('ascii', 0, 4) === 'OggS') {
    return {
      valid: true,
      detectedFormat: 'ogg',
      detectedMime: 'audio/ogg',
    };
  }

  // 6. FLAC ("fLaC")
  if (buf.length >= 4 && buf.toString('ascii', 0, 4) === 'fLaC') {
    return {
      valid: true,
      detectedFormat: 'flac',
      detectedMime: 'audio/flac',
    };
  }

  // 7. AAC (ADTS syncword: 0xFF 0xF0..0xFF)
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xf6) === 0xf0) {
    return {
      valid: true,
      detectedFormat: 'aac',
      detectedMime: 'audio/aac',
    };
  }

  // 8. MPEG-TS Sync byte (0x47)
  if (buf.length >= 188 && buf[0] === 0x47 && (buf[188] === 0x47 || buf.length < 376 || buf[376] === 0x47)) {
    return {
      valid: true,
      detectedFormat: 'ts',
      detectedMime: 'video/mp2t',
    };
  }

  // Guard: If it starts with HTML / JSON / XML text
  if (isHtmlOrChallengeContent(buf)) {
    const cat = categorizeChallenge(buf);
    return {
      valid: false,
      errorCategory: cat,
      error: 'Payload contains HTML/challenge text instead of authentic binary media container',
    };
  }

  // Generic fallback check for high-entropy binary streams (non-text)
  let nonAsciiCount = 0;
  const sampleSize = Math.min(buf.length, 256);
  for (let i = 0; i < sampleSize; i++) {
    if (buf[i] === 0 || buf[i] > 127) {
      nonAsciiCount++;
    }
  }

  if (nonAsciiCount / sampleSize > 0.2) {
    return {
      valid: true,
      detectedFormat: expectedType === 'audio' ? 'mp3' : 'mp4',
      detectedMime: expectedType === 'audio' ? 'audio/mpeg' : 'video/mp4',
    };
  }

  return {
    valid: false,
    errorCategory: 'MEDIA_SIGNATURE_INVALID',
    error: 'Unrecognized or non-media binary structure. File is not a valid video or audio format.',
  };
}

/**
 * Validates upstream HTTP response:
 * - Follows redirects up to maxRedirects
 * - Logs redirect chain (safe without sensitive params)
 * - Verifies Content-Type is genuine media
 * - Verifies initial bytes are not HTML/challenge/auth pages
 * - Verifies file signature
 */
export async function fetchAndValidateMediaStream(
  initialUrl: string,
  options: {
    expectedType?: 'video' | 'audio' | 'all';
    maxRedirects?: number;
    timeoutMs?: number;
    maxResponseBytes?: number;
    signal?: AbortSignal;
    transport?: typeof requestSafeHttp;
    destinationPath?: string;
  } = {}
): Promise<
  UpstreamValidationResult & {
    tempFilePath?: string;
    fileSizeBytes?: number;
  }
> {
  const {
    expectedType = 'all',
    maxRedirects = 5,
    timeoutMs = 25000,
    maxResponseBytes = 512 * 1024 * 1024,
    signal,
    transport = requestSafeHttp,
    destinationPath,
  } = options;
  let upstream: SafeHttpResponse | undefined;
  let savedBytes = 0;
  try {
    upstream = await transport(initialUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'video/*,audio/*,*/*;q=0.8',
      },
      signal,
      overallTimeoutMs: timeoutMs,
      maxRedirects,
      maxResponseBytes,
    });
    const { statusCode: status, headers, finalUrl, body } = upstream;
    const contentType = String(headers['content-type'] || '').toLowerCase();
    const parsedLength = Number(headers['content-length']);
    const contentLength = Number.isFinite(parsedLength) && parsedLength >= 0 ? parsedLength : undefined;

    if (status === 401 || status === 403) {
      const host = new URL(finalUrl).hostname;
      const isYouTubeCdn = host.includes('googlevideo.com') || finalUrl.includes('videoplayback');
      upstream.abort();
      return {
        valid: false, statusCode: status, finalUrl, contentType,
        errorCategory: isYouTubeCdn ? 'UPSTREAM_MEDIA_UNAVAILABLE' : 'UPSTREAM_AUTH_REQUIRED',
        errorMessage: isYouTubeCdn ? 'The resolved YouTube media stream is not accessible from the server.' : 'The upstream media provider requires authentication or blocked access.',
      };
    }
    if (status === 404) {
      upstream.abort();
      return { valid: false, statusCode: status, finalUrl, contentType, errorCategory: 'UPSTREAM_NOT_MEDIA', errorMessage: 'The upstream media stream was not found (HTTP 404).' };
    }
    if (status < 200 || status >= 300) {
      upstream.abort();
      return { valid: false, statusCode: status, finalUrl, contentType, errorCategory: 'DOWNLOAD_FAILED', errorMessage: `Upstream returned non-success HTTP status ${status}.` };
    }

    const isHtmlHeader = ['text/html', 'application/xhtml', 'text/plain', 'application/json', 'application/xml'].some((type) => contentType.includes(type));
    if (isHtmlHeader) {
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of body) {
        const part = Buffer.from(chunk);
        const take = Math.min(part.length, 4096 - bytes);
        if (take > 0) chunks.push(part.subarray(0, take));
        bytes += take;
        if (bytes >= 4096) break;
      }
      upstream.abort();
      const category = categorizeChallenge(Buffer.concat(chunks));
      return {
        valid: false, statusCode: status, finalUrl, contentType, isHtml: true, errorCategory: category,
        errorMessage: category === 'UPSTREAM_HTML_CHALLENGE'
          ? 'The media provider returned a cookie challenge page instead of media.'
          : category === 'UPSTREAM_BOT_PROTECTION'
            ? 'The media provider presented a bot protection or CAPTCHA verification page.'
            : 'Upstream returned an HTML/text error document instead of a playable media stream.',
      };
    }

    const iterator = body[Symbol.asyncIterator]();
    const chunks: Buffer[] = [];
    let initialLength = 0;
    while (initialLength < 1024) {
      const next = await iterator.next();
      if (next.done) break;
      const chunk = Buffer.from(next.value);
      chunks.push(chunk);
      initialLength += chunk.length;
    }
    if (initialLength === 0) {
      upstream.abort();
      return { valid: false, statusCode: status, finalUrl, errorCategory: 'MEDIA_EMPTY', errorMessage: 'Upstream stream contained 0 bytes.' };
    }
    const initialBuffer = Buffer.concat(chunks);
    if (isHtmlOrChallengeContent(initialBuffer)) {
      upstream.abort();
      return {
        valid: false, statusCode: status, finalUrl, contentType, isHtml: true,
        errorCategory: categorizeChallenge(initialBuffer),
        errorMessage: 'The media provider returned an authentication or security challenge page instead of the video.',
      };
    }
    const sigCheck = inspectMediaSignature(initialBuffer, expectedType);
    if (!sigCheck.valid) {
      upstream.abort();
      return {
        valid: false, statusCode: status, finalUrl, contentType,
        errorCategory: sigCheck.errorCategory || 'MEDIA_SIGNATURE_INVALID',
        errorMessage: sigCheck.error || 'Binary response does not contain a valid media container signature.',
      };
    }

    if (destinationPath) {
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      const fileWriteStream = fs.createWriteStream(destinationPath);
      async function* remainingBytes() {
        yield initialBuffer;
        savedBytes += initialBuffer.length;
        while (true) {
          const next = await iterator.next();
          if (next.done) break;
          const chunk = Buffer.from(next.value);
          savedBytes += chunk.length;
          yield chunk;
        }
      }
      try {
        await pipeline(Readable.from(remainingBytes()), fileWriteStream);
      } catch (error) {
        fileWriteStream.destroy();
        try { fs.unlinkSync(destinationPath); } catch {}
        throw error;
      }
    } else {
      upstream.abort();
    }

    const finalMime = sigCheck.detectedMime || contentType || (expectedType === 'audio' ? 'audio/mpeg' : 'video/mp4');
    const finalExt = sigCheck.detectedFormat || (expectedType === 'audio' ? 'mp3' : 'mp4');
    return {
      valid: true,
      statusCode: status,
      finalUrl,
      contentType: finalMime,
      contentLength: contentLength || savedBytes,
      mimeType: finalMime,
      extension: finalExt,
      tempFilePath: destinationPath,
      fileSizeBytes: savedBytes || contentLength,
    };
  } catch (error: any) {
    upstream?.abort();
    if (destinationPath) {
      try { fs.unlinkSync(destinationPath); } catch {}
    }
    const blocked = error?.code === 'BLOCKED_DESTINATION' || error?.code === 'INVALID_URL';
    return {
      valid: false,
      errorCategory: blocked ? 'UPSTREAM_REDIRECT_ERROR' : 'DOWNLOAD_FAILED',
      errorMessage: blocked ? 'Outbound URL or redirect destination is not allowed.' : error?.code === 'TIMEOUT' ? 'Timed out while receiving the upstream response.' : 'Network error reaching media provider.',
    };
  }
}
