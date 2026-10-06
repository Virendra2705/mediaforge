import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import {
  isHtmlOrChallengeContent,
  inspectMediaSignature,
  fetchAndValidateMediaStream,
} from './upstreamValidator.js';
import { ytDlpService } from './ytDlpService.js';

const execFileAsync = promisify(execFile);

export const TEMP_MEDIA_DIR = path.join(process.cwd(), 'temp_media');

// Ensure base temp directory exists
if (!fs.existsSync(TEMP_MEDIA_DIR)) {
  fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
}

/**
 * Ensures the yt-dlp binary exists, is non-empty, and has execute permissions (0o755).
 * Uses the official standalone Linux x86_64 binary (yt-dlp_linux) that runs without python zipapp parsing issues.
 */
export async function ensureYtDlpBinary(): Promise<string> {
  const ytDlpPath = path.resolve(process.cwd(), 'yt-dlp');
  
  // Verify if existing binary is functional by executing --version
  try {
    if (fs.existsSync(ytDlpPath) && fs.statSync(ytDlpPath).size > 5000000) {
      try {
        fs.chmodSync(ytDlpPath, 0o755);
      } catch {}

      try {
        await execFileAsync(ytDlpPath, ['--version'], { timeout: 5000 });
        return ytDlpPath;
      } catch (verErr) {
        console.log('[FFmpeg] Existing yt-dlp binary is non-functional, replacing with fresh standalone binary...');
        try { fs.unlinkSync(ytDlpPath); } catch {}
      }
    }
  } catch {}

  // If missing, corrupted, or non-functional, download the official standalone yt-dlp_linux binary
  try {
    console.log('[FFmpeg] Downloading official standalone yt-dlp_linux release from GitHub...');
    const res = await fetch('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux', {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MediaDownloader/1.0)' },
    });
    
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(ytDlpPath, buf);
      try {
        fs.chmodSync(ytDlpPath, 0o755);
      } catch {}

      const { stdout } = await execFileAsync(ytDlpPath, ['--version'], { timeout: 5000 });
      console.log(`[FFmpeg] Standalone yt-dlp binary initialized successfully (version ${stdout.trim()}).`);
    } else {
      console.log(`[FFmpeg] Failed to download yt-dlp_linux: HTTP ${res.status}`);
    }
  } catch (dlErr: any) {
    console.log('[FFmpeg] Notice downloading yt-dlp_linux:', dlErr.message);
  }

  return ytDlpPath;
}

export interface FfmpegOutput {
  filePath: string;
  filename: string;
  fileSizeBytes: number;
  mimeType: string;
  durationSeconds: number;
  width?: number;
  height?: number;
}

/**
 * Sanitizes a title into a clean filename safe for filesystems and HTTP Content-Disposition.
 * Example: "It's sooo close!!! | offhand" -> "Its_sooo_close_offhand_360p_Mobile.mp4"
 */
export function sanitizeMediaFilename(title: string, quality: string, format: string): string {
  // Strip dangerous characters, quotes, pipes, exclamation marks, etc.
  const cleanTitle = (title || 'media_asset')
    .replace(/['"’`]/g, '') // remove apostrophes/quotes without adding underscore
    .replace(/[^\w\d-_]/g, '_') // replace any non-alphanumeric with underscore
    .replace(/_+/g, '_') // collapse multiple underscores
    .replace(/^_|_$/g, ''); // trim leading/trailing underscores

  const cleanQuality = (quality || 'HD')
    .replace(/['"’`]/g, '')
    .replace(/[^\w\d-_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const ext = format.toLowerCase().replace(/^\./, '');
  const baseName = `${cleanTitle || 'media'}_${cleanQuality || 'export'}.${ext}`;

  // Ensure .html is never present in the filename
  return baseName.replace(/\.html$/i, '');
}

/**
 * Maps format string to strict standard MIME type
 */
export function getMimeTypeForFormat(format: string): string {
  const f = format.toLowerCase().trim();
  switch (f) {
    case 'mp4':
    case 'm4v':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'm4a':
      return 'audio/mp4';
    case 'flac':
      return 'audio/flac';
    default:
      return 'video/mp4';
  }
}

/**
 * Parses video resolution dimensions from quality string (e.g., "360p", "720p HD", "1080p")
 */
function getResolutionForQuality(quality: string): { width: number; height: number; fps: number } {
  const q = quality.toLowerCase();
  if (q.includes('4k') || q.includes('2160')) {
    return { width: 3840, height: 2160, fps: 60 };
  }
  if (q.includes('1440') || q.includes('2k')) {
    return { width: 2560, height: 1440, fps: 60 };
  }
  if (q.includes('1080')) {
    return { width: 1920, height: 1080, fps: 60 };
  }
  if (q.includes('720')) {
    return { width: 1280, height: 720, fps: 30 };
  }
  if (q.includes('480')) {
    return { width: 854, height: 480, fps: 30 };
  }
  if (q.includes('360')) {
    return { width: 640, height: 360, fps: 30 };
  }
  if (q.includes('240')) {
    return { width: 426, height: 240, fps: 24 };
  }
  return { width: 640, height: 360, fps: 30 };
}

export interface GenerateMediaParams {
  jobId: string;
  sourceUrl?: string;
  sourceId?: string;
  title: string;
  thumbnailUrl?: string;
  authorName?: string;
  format: string;
  quality: string;
  formatType?: 'video' | 'audio' | 'trim' | 'thumbnail' | 'subtitle';
  directUrl?: string;
  trimParams?: { startTime: number; endTime: number };
}

function isLikelyMediaBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 32) return false;

  // If starts with HTML tags, JSON, or XML, definitely not a media stream
  const textStart = buf.toString('utf8', 0, Math.min(buf.length, 128)).trim().toLowerCase();
  if (
    textStart.startsWith('<!doctype') ||
    textStart.startsWith('<html') ||
    textStart.startsWith('<?xml') ||
    textStart.startsWith('{') ||
    textStart.startsWith('<!')
  ) {
    return false;
  }

  // Common media signatures
  // MP4 / ISO / QuickTime (ftyp / moov / mdat at offset 4..12)
  if (buf.length >= 12) {
    const brand = buf.toString('ascii', 4, 8);
    if (brand === 'ftyp' || brand === 'moov' || brand === 'mdat' || brand === 'wide') return true;
  }

  // WEBM / MKV (\x1A\x45\xDF\xA3)
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return true;

  // MP3 ID3 header ("ID3")
  if (buf.toString('ascii', 0, 3) === 'ID3') return true;

  // MP3 sync frame (0xFF 0xFB, 0xF3, 0xF2)
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;

  // RIFF (WAV/AVI)
  if (buf.toString('ascii', 0, 4) === 'RIFF') return true;

  // OGG ("OggS")
  if (buf.toString('ascii', 0, 4) === 'OggS') return true;

  // FLAC ("fLaC")
  if (buf.toString('ascii', 0, 4) === 'fLaC') return true;

  // AAC ADTS
  if (buf[0] === 0xff && (buf[1] & 0xf6) === 0xf0) return true;

  return true;
}

export function sanitizeLogMessage(msg: string): string {
  if (!msg || typeof msg !== 'string') return '';
  return msg
    .replace(/--cookies\s+[^\s]+/gi, '--cookies [REDACTED]')
    .replace(/--cookies-from-browser\s+[^\s]+/gi, '--cookies-from-browser [REDACTED]')
    .replace(/Authorization:\s*(?:Bearer\s+)?[^\r\n\s]+/gi, 'Authorization: [REDACTED]')
    .replace(/Cookie:\s*[^\r\n]+/gi, 'Cookie: [REDACTED]')
    .replace(/cookie[=:][^\s&;\r\n]+/gi, 'cookie=[REDACTED]')
    .replace(/token[=:][^\s&;\r\n]+/gi, 'token=[REDACTED]')
    .replace(/([A-Za-z0-9_-]+\.youtube\.com\s+TRUE\s+\/\s+(?:TRUE|FALSE)\s+\d+\s+)[^\r\n\t]+/g, '$1[REDACTED]');
}

export interface YtDlpCookiesResult {
  configured: boolean;
  cookiePath: string | null;
  source: 'env_file' | 'env_raw' | 'env_base64' | 'default_file' | 'none';
  content?: string | null;
}

export function isRealCookieContent(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (trimmed.length < 20) return false;
  if (
    trimmed.includes('<contents of your') ||
    trimmed.includes('your_cookie_here') ||
    trimmed.startsWith('YTDLP_COOKIES=') ||
    trimmed.includes('<insert')
  ) {
    return false;
  }

  // If pointing to a file on disk (Option A)
  if (fs.existsSync(trimmed)) {
    try {
      if (fs.statSync(trimmed).isFile() && fs.statSync(trimmed).size > 10) {
        const fileContent = fs.readFileSync(trimmed, 'utf-8');
        return isRealCookieContent(fileContent) || !!parseAndValidateCookieContent(fileContent);
      }
    } catch {}
  }

  if (trimmed.includes('# Netscape') || trimmed.includes('# HTTP Cookie')) return true;
  if (
    trimmed.includes('\t') &&
    (trimmed.includes('.youtube.com') ||
      trimmed.includes('.google.com') ||
      trimmed.includes('VISITOR_INFO1_LIVE') ||
      trimmed.includes('SAPISID') ||
      trimmed.includes('SID') ||
      trimmed.includes('HSID') ||
      trimmed.includes('SSID'))
  ) {
    return true;
  }
  if (
    (trimmed.includes('.youtube.com') || trimmed.includes('youtube.com') || trimmed.includes('.google.com')) &&
    (trimmed.includes('VISITOR_INFO1_LIVE') || trimmed.includes('SAPISID') || trimmed.includes('SID') || trimmed.includes('HSID'))
  ) {
    return true;
  }
  return false;
}

export function parseAndValidateCookieContent(rawInput: string | null | undefined): string | null {
  if (!rawInput || typeof rawInput !== 'string') return null;
  const trimmed = rawInput.trim();

  // 1. If it's a file path that exists on disk (Option A)
  if (fs.existsSync(trimmed)) {
    try {
      if (fs.statSync(trimmed).isFile() && fs.statSync(trimmed).size > 10) {
        const fileContent = fs.readFileSync(trimmed, 'utf-8');
        return parseAndValidateCookieContent(fileContent);
      }
    } catch {}
  }

  // 2. Direct Netscape format string (Option B)
  if (isRealCookieContent(trimmed)) return trimmed;

  // 3. Base64-encoded Netscape format (Option C)
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    if (isRealCookieContent(decoded)) return decoded;
  } catch {}

  return null;
}

/**
 * Resolves yt-dlp cookies from environment variables or standard secret files.
 * Supports:
 * - Option A: File path in YTDLP_COOKIES (e.g. /run/secrets/ytdlp-cookies.txt)
 * - Option B: Raw Netscape string in YTDLP_COOKIES
 * - Option C: Base64-encoded single-line string in YTDLP_COOKIES
 * - Default file fallbacks (/run/secrets/ytdlp-cookies.txt, cookies.txt)
 */
export function loadYtDlpCookies(): YtDlpCookiesResult {
  const envCookies = (process.env.YTDLP_COOKIES || process.env.YOUTUBE_COOKIES || '').trim();

  // 1. Environment variable resolution
  if (envCookies.length > 10) {
    // Option A: Mounted secret or local file path
    if (fs.existsSync(envCookies)) {
      try {
        if (fs.statSync(envCookies).isFile() && fs.statSync(envCookies).size > 10) {
          const fileContent = fs.readFileSync(envCookies, 'utf-8');
          const valid = parseAndValidateCookieContent(fileContent);
          if (valid) {
            // If file contains raw Netscape text directly, yt-dlp can use it immediately
            if (isRealCookieContent(fileContent.trim())) {
              return { configured: true, cookiePath: envCookies, source: 'env_file', content: valid };
            }
            // If file contained base64, write decoded content to a secure temp cookie file
            const tempCookiePath = path.join(TEMP_MEDIA_DIR, '.ytdlp_decoded_cookies.txt');
            if (!fs.existsSync(TEMP_MEDIA_DIR)) fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
            fs.writeFileSync(tempCookiePath, valid, { mode: 0o600 });
            return { configured: true, cookiePath: tempCookiePath, source: 'env_file', content: valid };
          }
        }
      } catch {}
    }

    // Option B (Raw Netscape) or Option C (Base64)
    const validContent = parseAndValidateCookieContent(envCookies);
    if (validContent) {
      const isBase64 = !validContent.startsWith(envCookies.slice(0, 10));
      const tempCookiePath = path.join(TEMP_MEDIA_DIR, '.ytdlp_env_cookies.txt');
      try {
        if (!fs.existsSync(TEMP_MEDIA_DIR)) fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
        fs.writeFileSync(tempCookiePath, validContent, { mode: 0o600 });
        return {
          configured: true,
          cookiePath: tempCookiePath,
          source: isBase64 ? 'env_base64' : 'env_raw',
          content: validContent,
        };
      } catch (err: any) {
        console.log('[YtDlp Cookie Setup Notice]:', err.message);
      }
    }
  }

  // 2. Standard container secrets and workspace file paths
  const standardFilePaths = [
    '/run/secrets/ytdlp-cookies.txt',
    '/run/secrets/cookies.txt',
    path.resolve(process.cwd(), 'cookies.txt'),
    path.join(TEMP_MEDIA_DIR, '.ytdlp_cookies.txt'),
  ];

  for (const filePath of standardFilePaths) {
    if (fs.existsSync(filePath)) {
      try {
        if (fs.statSync(filePath).isFile() && fs.statSync(filePath).size > 10) {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const valid = parseAndValidateCookieContent(fileContent);
          if (valid) {
            return { configured: true, cookiePath: filePath, source: 'default_file', content: valid };
          }
        }
      } catch {}
    }
  }

  return { configured: false, cookiePath: null, source: 'none' };
}

/**
 * Uses FFmpeg & yt-dlp to obtain, process, or transcode an authentic playable media file.
 */
export async function generateMediaFile(params: GenerateMediaParams): Promise<FfmpegOutput> {
  const jobDir = path.join(TEMP_MEDIA_DIR, params.jobId);
  if (!fs.existsSync(jobDir)) {
    fs.mkdirSync(jobDir, { recursive: true });
  }

  const filename = sanitizeMediaFilename(params.title, params.quality, params.format);
  const outputPath = path.join(jobDir, filename);
  const mimeType = getMimeTypeForFormat(params.format);
  const isAudioOnly =
    params.formatType === 'audio' ||
    params.format === 'mp3' ||
    params.format === 'wav' ||
    params.format === 'flac' ||
    params.format === 'ogg' ||
    params.format === 'm4a';

  try {
    const hasExplicitDirectMedia =
      Boolean(params.directUrl &&
      params.directUrl !== params.sourceUrl &&
      (params.directUrl.endsWith('.mp4') ||
        params.directUrl.endsWith('.webm') ||
        params.directUrl.endsWith('.mp3') ||
        params.directUrl.endsWith('.wav') ||
        params.directUrl.endsWith('.m4a') ||
        params.directUrl.endsWith('.ogg') ||
        params.directUrl.includes('.mp4?') ||
        params.directUrl.includes('.mp3?') ||
        params.directUrl.includes('videoplayback')));

    const isDirectMediaUrl =
      hasExplicitDirectMedia ||
      Boolean(params.sourceUrl &&
        (params.sourceUrl.endsWith('.mp4') ||
          params.sourceUrl.endsWith('.webm') ||
          params.sourceUrl.endsWith('.mp3') ||
          params.sourceUrl.endsWith('.wav') ||
          params.sourceUrl.endsWith('.m4a') ||
          params.sourceUrl.endsWith('.ogg') ||
          params.sourceUrl.includes('.mp4?') ||
          params.sourceUrl.includes('.mp3?')));

    const rawTargetUrl = hasExplicitDirectMedia ? params.directUrl! : params.sourceUrl;
    let directDownloadSuccess = false;

    // 1. If it's a direct media URL (e.g. .mp4 / .webm / .mp3 / .wav / .m4a), download via fetch with browser headers and transcode
    if (rawTargetUrl && isDirectMediaUrl) {
      try {
        const rawExt = rawTargetUrl.includes('.webm') ? 'webm' : rawTargetUrl.includes('.mp3') ? 'mp3' : 'mp4';
        const tempSourcePath = path.join(jobDir, `source_stream.${rawExt}`);

        // Validate upstream media stream headers, redirects, and file signature
        const streamValidation = await fetchAndValidateMediaStream(rawTargetUrl, {
          expectedType: isAudioOnly ? 'audio' : 'video',
          destinationPath: tempSourcePath,
        });

        if (!streamValidation.valid) {
          console.log('[FFmpeg Direct Stream Status]:', streamValidation.errorCategory || 'STREAM_REJECTED', streamValidation.errorMessage || 'Invalid media stream');
          if (fs.existsSync(tempSourcePath)) {
            try { fs.unlinkSync(tempSourcePath); } catch {}
          }
        } else if (fs.existsSync(tempSourcePath) && fs.statSync(tempSourcePath).size > 1000) {
            // Probe the downloaded source file with ffprobe to verify validity and streams
            const sourceProbe = await verifyMediaWithFfprobe(tempSourcePath);

            if (sourceProbe.valid) {
              const duration = params.trimParams
                ? Math.max(1, Math.min(60, params.trimParams.endTime - params.trimParams.startTime))
                : undefined;
              const start = params.trimParams ? params.trimParams.startTime : 0;

              const ffmpegArgs: string[] = ['-y'];
              if (start > 0) {
                ffmpegArgs.push('-ss', String(start));
              }
              if (duration) {
                ffmpegArgs.push('-t', String(duration));
              }
              ffmpegArgs.push('-i', tempSourcePath);

              if (isAudioOnly) {
                if (sourceProbe.hasAudio) {
                  ffmpegArgs.push(
                    '-vn',
                    '-c:a',
                    params.format === 'mp3' ? 'libmp3lame' : 'pcm_s16le',
                    '-b:a',
                    params.quality.includes('320') ? '320k' : '192k',
                    outputPath
                  );
                } else {
                  // Video-only source requested as audio - convert video or add silent audio
                  ffmpegArgs.push(
                    '-vn',
                    '-c:a',
                    params.format === 'mp3' ? 'libmp3lame' : 'pcm_s16le',
                    outputPath
                  );
                }
              } else {
                ffmpegArgs.push(
                  '-c:v',
                  'libx264',
                  '-preset',
                  'ultrafast',
                  '-pix_fmt',
                  'yuv420p'
                );
                if (sourceProbe.hasAudio) {
                  ffmpegArgs.push('-c:a', 'aac', '-b:a', '128k');
                } else {
                  ffmpegArgs.push('-an'); // Don't force AAC encoder if no audio track exists
                }
                ffmpegArgs.push(
                  '-movflags',
                  '+faststart',
                  outputPath
                );
              }

              await execFileAsync('ffmpeg', ffmpegArgs);
              if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
                directDownloadSuccess = true;
              }
            }

            try {
              if (fs.existsSync(tempSourcePath)) {
                fs.unlinkSync(tempSourcePath);
              }
            } catch {}
          }
        } catch (directErr: any) {
          console.log('[FFmpeg Direct Stream Notice]:', directErr.message);
        }
      }

      // 2. If it's any supported web media platform (YouTube, TikTok, Twitter, Instagram, Vimeo, SoundCloud, etc.), download authentic stream via YtDlpService
  if (!directDownloadSuccess && rawTargetUrl) {
    const ytResult = await ytDlpService.executeDownload({
      jobId: params.jobId,
      sourceUrl: rawTargetUrl,
      format: params.format,
      quality: params.quality,
      formatType: params.formatType,
      title: params.title,
      trimParams: params.trimParams,
    });

    return {
      filePath: ytResult.filePath,
      filename: ytResult.filename,
      fileSizeBytes: ytResult.fileSizeBytes,
      mimeType: ytResult.mimeType,
      durationSeconds: ytResult.durationSeconds,
      width: ytResult.width,
      height: ytResult.height,
    };
  }

  // Verify output file exists and is non-empty
  if (!fs.existsSync(outputPath)) {
    throw new Error(`FFmpeg output file not found at ${outputPath}`);
  }

  const stat = fs.statSync(outputPath);
  if (stat.size === 0) {
    if (fs.existsSync(outputPath)) { try { fs.unlinkSync(outputPath); } catch {} }
    throw new Error(`MEDIA_EMPTY: Generated media file has 0 bytes at ${outputPath}`);
  }

  // Comprehensive validation before completing generation
  const validation = await validateMediaFile(outputPath, isAudioOnly ? 'audio' : 'video');
  if (!validation.valid) {
    if (fs.existsSync(outputPath)) { try { fs.unlinkSync(outputPath); } catch {} }
    throw new Error(`${validation.errorCategory || 'MEDIA_FFPROBE_FAILED'}: ${validation.error || 'Media validation failed.'}`);
  }

  return {
    filePath: outputPath,
    filename,
    fileSizeBytes: stat.size,
    mimeType,
    durationSeconds: validation.probe?.duration || 0,
    width: validation.probe?.width,
    height: validation.probe?.height,
  };
} catch (err: any) {
  console.log('[FFmpeg Processor] Media generation attempt handled:', err?.code || 'UNAVAILABLE');
  throw err;
}
}

/**
 * Validates a media file before upload/streaming:
 * - verifies file exists and is not 0 bytes
 * - inspects initial 512 bytes for HTML/challenge content
 * - verifies container magic bytes
 * - runs ffprobe to verify valid media container, stream codecs, dimensions, and duration
 */
export async function validateMediaFile(
  filePath: string,
  expectedType: 'video' | 'audio' | 'all' = 'video'
): Promise<{ valid: boolean; errorCategory?: string; error?: string; probe?: any }> {
  if (!fs.existsSync(filePath)) {
    return { valid: false, errorCategory: 'FILE_NOT_FOUND', error: `Media file does not exist at ${filePath}` };
  }

  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    return { valid: false, errorCategory: 'MEDIA_EMPTY', error: 'Media file has 0 bytes' };
  }

  if (stat.size < 32) {
    return { valid: false, errorCategory: 'MEDIA_EMPTY', error: 'Media file is too small to contain valid audio/video data' };
  }

  // 1. Check initial bytes for HTML / Cookie / Auth challenge
  const fd = fs.openSync(filePath, 'r');
  const headerBuf = Buffer.alloc(Math.min(stat.size, 1024));
  fs.readSync(fd, headerBuf, 0, headerBuf.length, 0);
  fs.closeSync(fd);

  if (isHtmlOrChallengeContent(headerBuf)) {
    return {
      valid: false,
      errorCategory: 'UPSTREAM_HTML_CHALLENGE',
      error: 'File content contains HTML/cookie check or authentication challenge page instead of media.',
    };
  }

  // 2. Check binary magic bytes
  const sigCheck = inspectMediaSignature(headerBuf, expectedType);
  if (!sigCheck.valid) {
    return {
      valid: false,
      errorCategory: sigCheck.errorCategory || 'MEDIA_SIGNATURE_INVALID',
      error: sigCheck.error || 'File failed binary media container signature verification.',
    };
  }

  // 3. Probe with ffprobe
  const probe = await verifyMediaWithFfprobe(filePath);
  if (!probe.valid) {
    return {
      valid: false,
      errorCategory: 'MEDIA_FFPROBE_FAILED',
      error: 'Invalid or corrupt media container (ffprobe failed to parse streams)',
      probe,
    };
  }

  if (expectedType === 'video' && !probe.hasVideo) {
    return {
      valid: false,
      errorCategory: 'MEDIA_TYPE_MISMATCH',
      error: 'Expected video stream was not found in container',
      probe,
    };
  }

  if (expectedType === 'audio' && !probe.hasAudio) {
    return {
      valid: false,
      errorCategory: 'MEDIA_TYPE_MISMATCH',
      error: 'Expected audio stream was not found in container',
      probe,
    };
  }

  return { valid: true, probe };
}

/**
 * Runs ffprobe on a file to ensure it's a valid media container with readable streams
 */
export async function verifyMediaWithFfprobe(filePath: string): Promise<{
  valid: boolean;
  formatName: string;
  duration: number;
  hasVideo: boolean;
  hasAudio: boolean;
  width?: number;
  height?: number;
  codecName?: string;
  error?: string;
}> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]);

    const info = JSON.parse(stdout);
    const formatName = info.format?.format_name || '';
    const duration = parseFloat(info.format?.duration || '0');

    const videoStream = info.streams?.find((s: any) => s.codec_type === 'video');
    const audioStream = info.streams?.find((s: any) => s.codec_type === 'audio');

    const hasVideo = !!(videoStream && videoStream.codec_name);
    const hasAudio = !!(audioStream && audioStream.codec_name);

    return {
      valid: hasVideo || hasAudio,
      formatName,
      duration,
      hasVideo,
      hasAudio,
      width: videoStream ? parseInt(videoStream.width, 10) || undefined : undefined,
      height: videoStream ? parseInt(videoStream.height, 10) || undefined : undefined,
      codecName: videoStream?.codec_name || audioStream?.codec_name,
    };
  } catch (err: any) {
    console.log('[FFprobe Validator] Probe notice for file:', path.basename(filePath), err.message?.substring(0, 100));
    return {
      valid: false,
      formatName: 'unknown',
      duration: 0,
      hasVideo: false,
      hasAudio: false,
      error: err.message,
    };
  }
}
