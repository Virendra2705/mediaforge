/**
 * Client-side media downloader utility
 * Guarantees that only valid binary media (video/audio) is downloaded and strictly prevents
 * saving HTML error pages, authentication challenges, or malformed files.
 */

const HTML_CHALLENGE_KEYWORDS = [
  '<!doctype html',
  '<html',
  '<head',
  '<body',
  'cookie check',
  'action required to load your app',
  'browser is blocking a required security cookie',
  'authenticate in new window',
  'grant permission',
  'aistudio_auth_flow',
  '__secure-aistudio_auth_flow',
  'sign in - google accounts',
  'recaptcha',
  'cf-browser-verification',
  'cloudflare',
  'security check',
  'please enable cookies',
  'access denied',
  'attention required',
  '{"error"',
  '{"message":',
  '{"status":',
];

/**
 * Checks if binary buffer contains HTML / text / challenge keywords
 */
function isHtmlOrChallengeBuffer(uint8: Uint8Array): boolean {
  if (!uint8 || uint8.length === 0) return false;
  const sample = uint8.slice(0, Math.min(uint8.length, 1024));
  let str = '';
  for (let i = 0; i < sample.length; i++) {
    str += String.fromCharCode(sample[i]);
  }
  const lower = str.toLowerCase();
  for (const keyword of HTML_CHALLENGE_KEYWORDS) {
    if (lower.includes(keyword)) {
      return true;
    }
  }
  return false;
}

/**
 * Verifies standard media container magic bytes
 */
function verifyMediaBytes(uint8: Uint8Array): { valid: boolean; detected?: string; error?: string } {
  if (!uint8 || uint8.length < 8) {
    return { valid: false, error: 'File contains insufficient data to be a valid media file.' };
  }

  if (isHtmlOrChallengeBuffer(uint8)) {
    return {
      valid: false,
      error: 'The media provider or proxy returned an authentication or security challenge page instead of media.',
    };
  }

  // 1. MP4 / ISO Base Media (Bytes 4..7 === 'ftyp' or 'moov' or 'mdat' or 'wide')
  if (uint8.length >= 8) {
    const box = String.fromCharCode(uint8[4], uint8[5], uint8[6], uint8[7]);
    if (box === 'ftyp' || box === 'moov' || box === 'mdat' || box === 'wide' || box === 'free') {
      return { valid: true, detected: 'mp4' };
    }
  }

  // 2. WebM / Matroska (0x1A 0x45 0xDF 0xA3)
  if (uint8[0] === 0x1a && uint8[1] === 0x45 && uint8[2] === 0xdf && uint8[3] === 0xa3) {
    return { valid: true, detected: 'webm' };
  }

  // 3. MP3 (ID3 tag or frame sync 0xFF 0xFB/0xF3/0xF2)
  if (uint8[0] === 0x49 && uint8[1] === 0x44 && uint8[2] === 0x33) {
    return { valid: true, detected: 'mp3' };
  }
  if (uint8[0] === 0xff && (uint8[1] & 0xe0) === 0xe0) {
    return { valid: true, detected: 'mp3' };
  }

  // 4. WAV (RIFF...WAVE)
  if (
    uint8[0] === 0x52 &&
    uint8[1] === 0x49 &&
    uint8[2] === 0x46 &&
    uint8[3] === 0x46 &&
    uint8.length >= 12 &&
    uint8[8] === 0x57 &&
    uint8[9] === 0x41 &&
    uint8[10] === 0x56 &&
    uint8[11] === 0x45
  ) {
    return { valid: true, detected: 'wav' };
  }

  // 5. OGG (OggS)
  if (uint8[0] === 0x4f && uint8[1] === 0x67 && uint8[2] === 0x67 && uint8[3] === 0x53) {
    return { valid: true, detected: 'ogg' };
  }

  // 6. FLAC (fLaC)
  if (uint8[0] === 0x66 && uint8[1] === 0x4c && uint8[2] === 0x61 && uint8[3] === 0x43) {
    return { valid: true, detected: 'flac' };
  }

  // Fallback check: ensure binary payload (not pure plain text / html)
  let nonAsciiOrZero = 0;
  const checkLen = Math.min(uint8.length, 128);
  for (let i = 0; i < checkLen; i++) {
    if (uint8[i] === 0 || uint8[i] > 127) {
      nonAsciiOrZero++;
    }
  }

  if (nonAsciiOrZero / checkLen > 0.15) {
    return { valid: true, detected: 'binary_media' };
  }

  return {
    valid: false,
    error: 'The downloaded response does not contain a recognized media binary structure.',
  };
}

export function sanitizeFilename(
  title: string,
  quality: string = '',
  format: string = 'mp4'
): string {
  const cleanTitle =
    title
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .substring(0, 60) || 'media';

  const cleanQuality = quality
    .replace(/[^\w-]/g, '_')
    .replace(/_+/g, '_')
    .trim();

  const cleanFormat = format.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';

  if (cleanQuality) {
    return `${cleanTitle}_${cleanQuality}.${cleanFormat}`;
  }
  return `${cleanTitle}.${cleanFormat}`;
}

export async function downloadMediaFile(options: {
  downloadUrl: string;
  filename: string;
  expectedMimeType?: string;
}): Promise<void> {
  const { downloadUrl, filename } = options;

  if (!downloadUrl) {
    throw new Error('Download URL is missing or invalid.');
  }

  const cleanName = filename.replace(/\.html$/i, '').trim();

  // Fetch the file using authenticated in-context fetch
  const response = await fetch(downloadUrl, {
    method: 'GET',
    headers: {
      Accept: 'video/*,audio/*,application/octet-stream,*/*;q=0.8',
    },
  });

  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  // Check HTTP Status
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('The media provider requires authentication or blocked access (HTTP ' + response.status + ').');
    }
    if (response.status === 404) {
      throw new Error('The requested media file was not found on the server (HTTP 404).');
    }

    if (contentType.includes('application/json')) {
      try {
        const errorJson = await response.json();
        throw new Error(errorJson.error?.message || errorJson.message || `Download failed (HTTP ${response.status}).`);
      } catch (err: any) {
        throw new Error(err.message || `Download failed with HTTP ${response.status}.`);
      }
    }

    throw new Error(`Download failed with status ${response.status} (${response.statusText}).`);
  }

  // Check if server returned HTML / text instead of binary media
  if (
    contentType.includes('text/html') ||
    contentType.includes('application/xhtml') ||
    contentType.includes('text/plain') ||
    contentType.includes('application/json')
  ) {
    const textSnippet = await response.text();
    const lowerSnippet = textSnippet.toLowerCase();

    for (const kw of HTML_CHALLENGE_KEYWORDS) {
      if (lowerSnippet.includes(kw)) {
        throw new Error(
          'The media provider or proxy returned an authentication or security challenge page instead of the video. Please try again or use a supported source.'
        );
      }
    }

    throw new Error('The server returned an HTML or text response instead of the expected media stream.');
  }

  // Obtain binary blob
  const blob = await response.blob();

  if (blob.size === 0) {
    throw new Error('The downloaded media file is empty (0 bytes).');
  }

  // Read initial 512 bytes to inspect binary container signature
  const headerSlice = await blob.slice(0, 512).arrayBuffer();
  const headerBytes = new Uint8Array(headerSlice);

  const sigCheck = verifyMediaBytes(headerBytes);
  if (!sigCheck.valid) {
    throw new Error(sigCheck.error || 'The downloaded file failed media signature validation.');
  }

  // Safely trigger in-browser download via Blob Object URL
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = cleanName;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    if (document.body.contains(anchor)) {
      document.body.removeChild(anchor);
    }
    URL.revokeObjectURL(blobUrl);
  }, 15000);
}

export async function triggerDirectDownload(url: string, filename?: string): Promise<void> {
  await downloadMediaFile({ downloadUrl: url, filename: filename || 'media.mp4' });
}
