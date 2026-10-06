import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile, spawn, ChildProcess } from 'child_process';
import util from 'util';
import {
  verifyMediaWithFfprobe,
  validateMediaFile,
  isRealCookieContent,
  parseAndValidateCookieContent,
  loadYtDlpCookies,
  TEMP_MEDIA_DIR,
  getMimeTypeForFormat,
  sanitizeMediaFilename,
  sanitizeLogMessage,
} from './ffmpeg.js';
import { supabaseStorage, STORAGE_BUCKET, getSupabaseConfig } from './supabase.js';
import { validateAndNormalizeUrl } from './security.js';
import { MediaFormat, MediaMetadata, YtDlpErrorCode } from './types.js';
import {
  fetchRapidApiSocial,
  fetchRapidApiDetailed,
  convertSocialApiToMetadata,
  RapidApiDetailedResponse,
} from './socialDownload.js';
import { fetchAndValidateMediaStream } from './upstreamValidator.js';

const execFileAsync = util.promisify(execFile);

export interface YtDlpErrorResult {
  code: YtDlpErrorCode;
  message: string;
  userMessage: string;
  exitCode?: number;
}

export interface YtDlpDownloadOptions {
  jobId: string;
  sourceUrl: string;
  format?: string; // 'mp4', 'webm', 'mp3', 'wav', 'm4a'
  quality?: string; // '1080p', '720p', '320 kbps', etc.
  formatType?: 'video' | 'audio' | 'trim' | 'thumbnail' | 'subtitle';
  title?: string;
  trimParams?: {
    startTime: number;
    endTime: number;
  };
  timeoutSeconds?: number;
}

export interface YtDlpExecutionResult {
  filePath: string;
  filename: string;
  fileSizeBytes: number;
  mimeType: string;
  durationSeconds: number;
  sha256: string;
  width?: number;
  height?: number;
  codec?: string;
}

export interface SystemHealthStatus {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  timestamp: string;
  runtime: {
    nodeVersion: string;
    pythonVersion: string | null;
    os: string;
    platform: string;
    arch: string;
  };
  ytDlp: {
    installed: boolean;
    executable: boolean;
    version: string | null;
    commandType: 'executable' | 'python_module' | 'none';
    path: string;
    resolvedPath: string;
  };
  ffprobe: {
    available: boolean;
  };
  storage: {
    available: boolean;
    bucket: string;
  };
  cookies: {
    configured: boolean;
  };
}

/**
 * Server-side centralized YtDlpService
 * All yt-dlp calls, process management, metadata extraction, and downloads must go through this service.
 */
export class YtDlpService {
  private static instance: YtDlpService;
  private activeProcesses = new Map<string, ChildProcess>();
  private detectedCommand: {
    command: string;
    argsPrefix: string[];
    type: 'executable' | 'python_module';
    resolvedPath: string;
  } | null = null;
  private cachedVersion: string | null = null;

  private constructor() {}

  public static getInstance(): YtDlpService {
    if (!YtDlpService.instance) {
      YtDlpService.instance = new YtDlpService();
    }
    return YtDlpService.instance;
  }

  /**
   * Detect and return the available yt-dlp executable or python -m yt_dlp command.
   * Resolves the actual filesystem path and validates execution with --version.
   */
  public async detectYtDlp(): Promise<{
    command: string;
    argsPrefix: string[];
    type: 'executable' | 'python_module';
    resolvedPath: string;
  }> {
    if (this.detectedCommand) {
      return this.detectedCommand;
    }

    // 1. Explicit path from env (if user explicitly provided one)
    if (process.env.YTDLP_PATH && process.env.YTDLP_PATH.trim() !== '') {
      const explicitPath = process.env.YTDLP_PATH.trim();
      try {
        const { stdout } = await execFileAsync(explicitPath, ['--version'], { timeout: 5000 });
        const version = stdout.trim();
        if (version) {
          this.cachedVersion = version;
          let resolved = explicitPath;
          try {
            if (fs.existsSync(explicitPath)) {
              resolved = fs.realpathSync(explicitPath);
            }
          } catch {}
          this.detectedCommand = {
            command: explicitPath,
            argsPrefix: [],
            type: 'executable',
            resolvedPath: resolved,
          };
          return this.detectedCommand;
        }
      } catch {}
    }

    // 2. Check "which yt-dlp" or PATH execution first
    try {
      const { stdout: whichOut } = await execFileAsync('which', ['yt-dlp'], { timeout: 3000 });
      const foundPath = whichOut.trim();
      if (foundPath && fs.existsSync(foundPath)) {
        const { stdout: verOut } = await execFileAsync(foundPath, ['--version'], { timeout: 5000 });
        const version = verOut.trim();
        if (version) {
          this.cachedVersion = version;
          let resolved = foundPath;
          try {
            resolved = fs.realpathSync(foundPath);
          } catch {}
          this.detectedCommand = {
            command: foundPath,
            argsPrefix: [],
            type: 'executable',
            resolvedPath: resolved,
          };
          return this.detectedCommand;
        }
      }
    } catch {}

    // Direct PATH execution test
    try {
      const { stdout: verOut } = await execFileAsync('yt-dlp', ['--version'], { timeout: 5000 });
      const version = verOut.trim();
      if (version) {
        this.cachedVersion = version;
        let resolved = 'yt-dlp';
        try {
          const { stdout: whichOut } = await execFileAsync('which', ['yt-dlp'], { timeout: 3000 });
          if (whichOut.trim()) resolved = whichOut.trim();
        } catch {}
        this.detectedCommand = {
          command: 'yt-dlp',
          argsPrefix: [],
          type: 'executable',
          resolvedPath: resolved,
        };
        return this.detectedCommand;
      }
    } catch {}

    // 3. Check well-known binary filesystem locations
    const candidateBinaries = [
      '/usr/local/bin/yt-dlp',
      '/usr/bin/yt-dlp',
      '/app/applet/yt-dlp',
      path.resolve(process.cwd(), 'yt-dlp'),
      path.resolve(process.cwd(), 'node_modules/.bin/yt-dlp'),
    ];

    for (const bin of candidateBinaries) {
      try {
        if (!fs.existsSync(bin)) continue;
        try {
          fs.chmodSync(bin, 0o755);
        } catch {}
        const { stdout } = await execFileAsync(bin, ['--version'], { timeout: 5000 });
        const version = stdout.trim();
        if (version) {
          this.cachedVersion = version;
          let resolved = bin;
          try {
            resolved = fs.realpathSync(bin);
          } catch {}
          this.detectedCommand = {
            command: bin,
            argsPrefix: [],
            type: 'executable',
            resolvedPath: resolved,
          };
          return this.detectedCommand;
        }
      } catch {}
    }

    // 4. Try Python module fallback: python3 -m yt_dlp or python -m yt_dlp
    const pythonCandidates = ['python3', 'python'];
    for (const py of pythonCandidates) {
      try {
        const { stdout } = await execFileAsync(py, ['-m', 'yt_dlp', '--version'], { timeout: 5000 });
        const version = stdout.trim();
        if (version) {
          this.cachedVersion = version;
          let pyPath = py;
          try {
            const { stdout: pyWhich } = await execFileAsync('which', [py], { timeout: 3000 });
            if (pyWhich.trim()) pyPath = pyWhich.trim();
          } catch {}
          this.detectedCommand = {
            command: py,
            argsPrefix: ['-m', 'yt_dlp'],
            type: 'python_module',
            resolvedPath: `${pyPath} -m yt_dlp`,
          };
          return this.detectedCommand;
        }
      } catch {}
    }

    // 5. Automatic release binary provision if curl is available
    const localBinPath = path.resolve(process.cwd(), 'yt-dlp');
    try {
      console.log('[YtDlpService] yt-dlp binary missing or not executable. Provisioning latest binary via curl...');
      await execFileAsync('curl', [
        '-L',
        'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
        '-o',
        localBinPath,
      ], { timeout: 25000 });
      fs.chmodSync(localBinPath, 0o755);
      const { stdout: dlVer } = await execFileAsync(localBinPath, ['--version'], { timeout: 5000 });
      const version = dlVer.trim();
      if (version) {
        this.cachedVersion = version;
        this.detectedCommand = {
          command: localBinPath,
          argsPrefix: [],
          type: 'executable',
          resolvedPath: localBinPath,
        };
        return this.detectedCommand;
      }
    } catch (dlErr: any) {
      console.log('[YtDlpService] Binary provision attempt notice:', dlErr.message);
    }

    // 6. If not found, return temporary none configuration without permanently locking cache
    return {
      command: 'yt-dlp',
      argsPrefix: [],
      type: 'executable',
      resolvedPath: 'not_found',
    };
  }

  /**
   * Validate server-side yt-dlp, ffprobe, and storage environment at startup.
   * Logs clean non-sensitive diagnostic info without exposing secret values.
   */
  public async validateServerEnvironment(): Promise<SystemHealthStatus> {
    const ytdl = await this.detectYtDlp();
    let isExecutable = false;
    let version: string | null = null;
    let pythonVersion: string | null = null;
    let ffmpegAvailable = false;
    let ffmpegPath = '/usr/bin/ffmpeg';
    let ffmpegVersion: string | null = null;
    let ffprobeAvailable = false;
    let ffprobePath = '/usr/bin/ffprobe';

    if (ytdl.resolvedPath !== 'not_found') {
      try {
        const fullArgs = [...ytdl.argsPrefix, '--version'];
        const { stdout } = await execFileAsync(ytdl.command, fullArgs, { timeout: 5000 });
        version = stdout.trim();
        if (version) {
          this.cachedVersion = version;
          isExecutable = true;
        }
      } catch (err: any) {
        console.log('[YtDlpService] Notice executing yt-dlp --version:', sanitizeLogMessage(err.message));
      }
    }

    try {
      const { stdout: pyOut } = await execFileAsync('python3', ['--version'], { timeout: 3000 });
      pythonVersion = pyOut.trim();
    } catch {}

    try {
      const { stdout: whichFfmpeg } = await execFileAsync('which', ['ffmpeg'], { timeout: 3000 });
      if (whichFfmpeg.trim()) ffmpegPath = whichFfmpeg.trim();
      const { stdout: ffOut } = await execFileAsync(ffmpegPath, ['-version'], { timeout: 3000 });
      if (ffOut.includes('ffmpeg version')) {
        ffmpegAvailable = true;
        ffmpegVersion = ffOut.split('\n')[0].trim();
      }
    } catch {}

    try {
      const { stdout: whichFfprobe } = await execFileAsync('which', ['ffprobe'], { timeout: 3000 });
      if (whichFfprobe.trim()) ffprobePath = whichFfprobe.trim();
      const { stdout: probeOut } = await execFileAsync(ffprobePath, ['-version'], { timeout: 3000 });
      ffprobeAvailable = probeOut.includes('ffprobe version');
    } catch {}

    const cookieInfo = loadYtDlpCookies();
    const storageConfig = getSupabaseConfig();
    const storageConfigured = !!(storageConfig.url && storageConfig.secretKey) || true; // supports local disk mode

    console.log('\n========================================');
    console.log('[Server Environment Startup Diagnostics]');
    console.log(`YTDLP_STATUS=${isExecutable ? 'READY' : 'UNAVAILABLE'}`);
    console.log(`YTDLP_PATH=${isExecutable ? ytdl.resolvedPath : 'NOT_FOUND'}`);
    console.log(`YTDLP_VERSION=${version || 'UNKNOWN'}`);
    console.log(`FFMPEG_STATUS=${ffmpegAvailable ? 'READY' : 'UNAVAILABLE'}`);
    console.log(`FFMPEG_PATH=${ffmpegPath}`);
    console.log(`FFMPEG_VERSION=${ffmpegVersion || 'UNKNOWN'}`);
    console.log(`FFPROBE_STATUS=${ffprobeAvailable ? 'READY' : 'UNAVAILABLE'}`);
    console.log(`FFPROBE_PATH=${ffprobePath}`);
    console.log(`STORAGE_STATUS=${storageConfigured ? 'READY' : 'LOCAL_ONLY'} (bucket: ${STORAGE_BUCKET})`);
    console.log(`COOKIES_CONFIGURED=${cookieInfo.configured ? 'YES (server-side secret)' : 'NO'}`);
    console.log(`RUNTIME_NODE=${process.version}`);
    console.log(`RUNTIME_PYTHON=${pythonVersion || 'NOT_INSTALLED'}`);
    console.log(`OS_PLATFORM=${process.platform} (${process.arch})`);
    console.log('========================================\n');

    return {
      status: isExecutable ? 'ok' : 'error',
      service: 'MediaForge Processing Gateway',
      timestamp: new Date().toISOString(),
      runtime: {
        nodeVersion: process.version,
        pythonVersion,
        os: `${process.platform} ${process.arch}`,
        platform: process.platform,
        arch: process.arch,
      },
      ytDlp: {
        installed: isExecutable,
        executable: isExecutable,
        version,
        commandType: isExecutable ? ytdl.type : 'none',
        path: ytdl.command,
        resolvedPath: isExecutable ? ytdl.resolvedPath : 'not_found',
      },
      ffprobe: {
        available: ffprobeAvailable,
      },
      storage: {
        available: storageConfigured,
        bucket: STORAGE_BUCKET,
      },
      cookies: {
        configured: cookieInfo.configured,
      },
    };
  }

  /**
   * Format the precise failure reason for RapidAPI fallback attempts
   */
  public formatRapidApiFallbackFailure(result: RapidApiDetailedResponse | null, err?: any): string | null {
    if (err) {
      return `Network error: ${err.message || 'fetch failed'}`;
    }
    if (!result) return null;
    if (result.ok && result.data && result.data.medias && result.data.medias.length > 0) {
      return null;
    }

    if (result.statusCode === 503 && (result.errorMessage === 'RAPIDAPI_KEY is not set' || result.statusText === 'RapidAPI Key Not Configured')) {
      return 'RAPIDAPI_KEY is not set';
    }
    if (result.statusCode === 401 || result.statusCode === 403) {
      const detail = result.errorMessage || result.statusText || 'Unauthorized';
      return `HTTP ${result.statusCode}: ${detail}`;
    }
    if (result.statusCode === 429) {
      const detail = result.errorMessage?.toLowerCase().includes('quota') ? result.errorMessage : 'quota exceeded';
      return `HTTP 429: ${detail}`;
    }
    if (result.statusCode > 0 && result.statusCode !== 200) {
      return `HTTP ${result.statusCode}: ${result.errorMessage || result.statusText}`;
    }

    // HTTP 200 with no medias (e.g. private or unsupported platform) -> no | segment per spec
    return null;
  }

  /**
   * Safe classification of errors encountered during extraction
   */
  public classifyError(err: any): YtDlpErrorResult {
    const rawMsg = [
      err?.stderr ? String(err.stderr) : '',
      err?.stdout ? String(err.stdout) : '',
      err?.message ? String(err.message) : '',
      err?.code ? String(err.code) : '',
      err?.userMessage ? String(err.userMessage) : '',
    ]
      .filter(Boolean)
      .join('\n');

    let fallbackSuffix = '';
    const fallbackMatch = rawMsg.match(/ \|\s*RapidAPI fallback failed\s*\([^\)]+\)/i);
    if (fallbackMatch) {
      fallbackSuffix = fallbackMatch[0];
    } else if (err?.fallbackDetail) {
      fallbackSuffix = ` | RapidAPI fallback failed (${err.fallbackDetail})`;
    }

    const result = this.classifyErrorInternal(err, rawMsg);
    if (fallbackSuffix) {
      if (!result.message.includes('RapidAPI fallback failed')) {
        result.message = `${result.message}${fallbackSuffix}`;
      }
      if (!result.userMessage.includes('RapidAPI fallback failed')) {
        result.userMessage = `${result.userMessage}${fallbackSuffix}`;
      }
    }
    return result;
  }

  private classifyErrorInternal(err: any, rawMsg: string): YtDlpErrorResult {
    const msgLower = rawMsg.toLowerCase();
    const exitCode = typeof err?.code === 'number' ? err.code : (typeof err?.exitCode === 'number' ? err.exitCode : undefined);

    // 1. Not Installed (Only when executable binary cannot be found or spawned)
    if (
      (msgLower.includes('enoent') && msgLower.includes('yt-dlp')) ||
      (msgLower.includes('not found') && msgLower.includes('yt-dlp') && !msgLower.includes('video')) ||
      rawMsg.includes('YTDLP_NOT_INSTALLED')
    ) {
      return {
        code: 'YTDLP_NOT_INSTALLED',
        message: 'yt-dlp is not installed or not executable on the server.',
        userMessage: 'Media extraction engine is currently unavailable on this server.',
        exitCode,
      };
    }

    // 2. JavaScript Runtime Error
    if (
      msgLower.includes('javascript runtime') ||
      msgLower.includes('js runtime') ||
      msgLower.includes('cannot execute javascript') ||
      msgLower.includes('failed to solve js challenge') ||
      rawMsg.includes('YTDLP_JS_RUNTIME_ERROR')
    ) {
      return {
        code: 'YTDLP_JS_RUNTIME_ERROR',
        message: 'yt-dlp JavaScript runtime challenge solver failed or is misconfigured.',
        userMessage: 'JavaScript runtime error during stream extraction.',
        exitCode,
      };
    }

    // 3. Invalid Source URL / SSRF
    if (
      rawMsg.includes('INVALID_SOURCE_URL') ||
      rawMsg.includes('INVALID_URL') ||
      msgLower.includes('invalid url') ||
      msgLower.includes('is not a valid url')
    ) {
      return {
        code: 'INVALID_SOURCE_URL',
        message: 'The provided source URL is invalid or blocked for security.',
        userMessage: 'The provided URL is not a valid or accessible media link.',
        exitCode,
      };
    }

    // 4. Upstream Bot Verification / Challenge (YouTube bot verification, Cloudflare, CAPTCHA, Turnstile)
    if (
      msgLower.includes('sign in to confirm you’re not a bot') ||
      msgLower.includes('sign in to confirm you\'re not a bot') ||
      msgLower.includes('confirm you’re not a bot') ||
      msgLower.includes('confirm you\'re not a bot') ||
      msgLower.includes('sign in to confirm') ||
      msgLower.includes('not a bot') ||
      msgLower.includes('bot detection') ||
      msgLower.includes('bot verification') ||
      msgLower.includes('turnstile') ||
      msgLower.includes('recaptcha') ||
      msgLower.includes('captcha') ||
      rawMsg.includes('UPSTREAM_BOT_VERIFICATION_REQUIRED')
    ) {
      return {
        code: 'UPSTREAM_BOT_VERIFICATION_REQUIRED',
        message: 'Upstream platform bot verification blocked stream extraction in this server hosting environment.',
        userMessage: 'Unable to fetch this video right now. The video service or source platform requires additional verification. Please try another supported URL.',
        exitCode,
      };
    }

    // 5. Hosting / Cloud Network IP Restriction
    if (
      msgLower.includes('datacenter ip') ||
      msgLower.includes('cloud hosting ip') ||
      msgLower.includes('hosting network restriction') ||
      rawMsg.includes('HOSTING_NETWORK_RESTRICTION')
    ) {
      return {
        code: 'HOSTING_NETWORK_RESTRICTION',
        message: 'The upstream platform has restricted automated requests from this cloud hosting network.',
        userMessage: 'Automated extraction is restricted by upstream platform policy in this cloud hosting environment.',
        exitCode,
      };
    }

    // 6. Authentication Required / Sign-in required (Private / Age-restricted / Members-only)
    if (
      msgLower.includes('sign in to confirm your age') ||
      msgLower.includes('private video') ||
      msgLower.includes('members-only content') ||
      msgLower.includes('requires authentication') ||
      msgLower.includes('account required') ||
      msgLower.includes('401 unauthorized') ||
      msgLower.includes('login required') ||
      rawMsg.includes('UPSTREAM_LOGIN_REQUIRED') ||
      rawMsg.includes('UPSTREAM_AUTH_REQUIRED')
    ) {
      return {
        code: 'UPSTREAM_LOGIN_REQUIRED',
        message: 'This media requires account authentication or sign-in that is not available to the server.',
        userMessage: 'This media requires sign-in or private account authentication.',
        exitCode,
      };
    }

    // 7. Upstream Rate Limited
    if (
      msgLower.includes('http error 429') ||
      msgLower.includes('too many requests') ||
      msgLower.includes('rate limit') ||
      rawMsg.includes('UPSTREAM_RATE_LIMITED')
    ) {
      return {
        code: 'UPSTREAM_RATE_LIMITED',
        message: 'Upstream provider rate limited extraction requests from this host.',
        userMessage: 'The media provider is temporarily rate limiting requests. Please try again later.',
        exitCode,
      };
    }

    // 8. Video Unavailable / Removed / 404
    if (
      msgLower.includes('video unavailable') ||
      msgLower.includes('this video has been removed') ||
      msgLower.includes('does not exist') ||
      msgLower.includes('http error 404') ||
      rawMsg.includes('UPSTREAM_VIDEO_UNAVAILABLE') ||
      rawMsg.includes('MEDIA_NOT_FOUND')
    ) {
      return {
        code: 'UPSTREAM_VIDEO_UNAVAILABLE',
        message: 'The requested media could not be found or has been removed from the provider.',
        userMessage: 'The requested video or audio was not found or has been removed.',
        exitCode,
      };
    }

    // 9. Region Restricted
    if (
      msgLower.includes('this video is not available') ||
      msgLower.includes('georestricted') ||
      msgLower.includes('not available in your country') ||
      rawMsg.includes('UPSTREAM_REGION_RESTRICTED') ||
      rawMsg.includes('MEDIA_NOT_AVAILABLE')
    ) {
      return {
        code: 'UPSTREAM_REGION_RESTRICTED',
        message: 'The requested media is geographically restricted or unavailable in this region.',
        userMessage: 'This media is geographically restricted or not available in this hosting region.',
        exitCode,
      };
    }

    // 10. Format Unavailable
    if (
      msgLower.includes('requested format is not available') ||
      msgLower.includes('no video formats found') ||
      msgLower.includes('no matching format') ||
      rawMsg.includes('MEDIA_FORMAT_UNAVAILABLE')
    ) {
      return {
        code: 'MEDIA_FORMAT_UNAVAILABLE',
        message: 'The selected quality or format combination is not available for this stream.',
        userMessage: 'The requested format or quality level is not available for this media.',
        exitCode,
      };
    }

    // 11. Timeout
    if (
      msgLower.includes('timed out') ||
      msgLower.includes('etimeout') ||
      rawMsg.includes('TIMEOUT') ||
      err?.signal === 'SIGTERM' ||
      err?.signal === 'SIGKILL'
    ) {
      return {
        code: 'TIMEOUT',
        message: 'Media extraction or download timed out.',
        userMessage: 'Media processing timed out. Please try again or select a lower resolution.',
        exitCode,
      };
    }

    // 12. Network Error
    if (
      msgLower.includes('econnrefused') ||
      msgLower.includes('econnreset') ||
      msgLower.includes('enotfound') ||
      msgLower.includes('network is unreachable') ||
      msgLower.includes('unable to download webpage') ||
      msgLower.includes('tls error') ||
      msgLower.includes('ssl:') ||
      rawMsg.includes('YTDLP_NETWORK_FAILED') ||
      rawMsg.includes('NETWORK_ERROR')
    ) {
      return {
        code: 'YTDLP_NETWORK_FAILED',
        message: 'Network connection to upstream provider failed.',
        userMessage: 'Network connection to upstream provider failed. Please check connectivity or try again.',
        exitCode,
      };
    }

    // 13. Validation Failed
    if (
      rawMsg.includes('MEDIA_VALIDATION_FAILED') ||
      rawMsg.includes('MEDIA_SIGNATURE_INVALID') ||
      rawMsg.includes('MEDIA_FFPROBE_FAILED') ||
      rawMsg.includes('MEDIA_EMPTY')
    ) {
      return {
        code: 'MEDIA_VALIDATION_FAILED',
        message: 'The downloaded media stream failed container or codec integrity verification.',
        userMessage: 'The media file failed container integrity verification.',
        exitCode,
      };
    }

    // 14. Storage Upload Failed
    if (rawMsg.includes('STORAGE_UPLOAD_FAILED')) {
      return {
        code: 'STORAGE_UPLOAD_FAILED',
        message: 'Failed to upload processed media to private storage.',
        userMessage: 'Failed to save media to storage. Please try again.',
        exitCode,
      };
    }

    // 15. Extractor Failure
    if (
      msgLower.includes('extractor error') ||
      msgLower.includes('unable to extract') ||
      msgLower.includes('failed to parse') ||
      rawMsg.includes('YTDLP_EXTRACTOR_FAILED')
    ) {
      return {
        code: 'YTDLP_EXTRACTOR_FAILED',
        message: 'yt-dlp extractor could not parse upstream provider response.',
        userMessage: 'Failed to extract media details from upstream provider.',
        exitCode,
      };
    }

    // 16. Generic Execution Failure
    if (rawMsg.includes('YTDLP_EXECUTION_FAILED') || (typeof exitCode === 'number' && exitCode !== 0)) {
      return {
        code: 'YTDLP_EXECUTION_FAILED',
        message: 'yt-dlp process failed during execution.',
        userMessage: 'The media extraction process failed during execution.',
        exitCode,
      };
    }

    if (rawMsg.includes('YTDLP_EXTRACTION_FAILED') || rawMsg.includes('MEDIA_DOWNLOAD_FAILED') || msgLower.includes('error downloading')) {
      return {
        code: 'YTDLP_EXTRACTION_FAILED',
        message: 'yt-dlp could not extract media stream from upstream provider.',
        userMessage: 'The media stream could not be downloaded from the upstream source.',
        exitCode,
      };
    }

    const cleanMsg =
      err?.message && err.message !== 'undefined' && err.message.trim().length > 0
        ? sanitizeLogMessage(err.message)
        : 'An unexpected error occurred during media extraction.';

    return {
      code: 'UNKNOWN_ERROR',
      message: cleanMsg,
      userMessage: 'An unexpected error occurred while processing this media.',
      exitCode,
    };
  }

  /**
   * Extract metadata from source URL using yt-dlp --dump-single-json --skip-download
   * Extracts only the metadata required by the application and never treats HTML pages as success.
   */
  public async getMetadata(sourceUrl: string): Promise<MediaMetadata> {
    const urlValidation = validateAndNormalizeUrl(sourceUrl);
    if (!urlValidation.isValid || !urlValidation.normalizedUrl) {
      const err: any = new Error(urlValidation.error || 'Invalid or forbidden URL.');
      err.code = 'INVALID_SOURCE_URL';
      throw err;
    }

    const ytdl = await this.detectYtDlp();
    const nodeRuntime = process.execPath || '/usr/local/bin/node';
    const targetUrl = urlValidation.normalizedUrl;

    // Server-side optional cookies via loadYtDlpCookies
    const cookieInfo = loadYtDlpCookies();
    const adminCookiesPath = (cookieInfo.configured && cookieInfo.cookiePath) ? cookieInfo.cookiePath : null;

    const ytdlArgs: string[] = [
      ...ytdl.argsPrefix,
      '--dump-single-json',
      '--skip-download',
      '--no-playlist',
      '--no-warnings',
      '--no-progress',
      '--socket-timeout',
      '15',
      '--extractor-args',
      'youtube:player_client=android,ios,web',
      '--user-agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      '--js-runtimes',
      `node:${nodeRuntime}`,
    ];

    if (adminCookiesPath && fs.existsSync(adminCookiesPath)) {
      ytdlArgs.push('--cookies', adminCookiesPath);
    }

    ytdlArgs.push(targetUrl);

    try {
      const { stdout } = await execFileAsync(ytdl.command, ytdlArgs, {
        maxBuffer: 30 * 1024 * 1024,
        timeout: 30000,
      });

      const trimmed = stdout.trim();
      const firstBrace = trimmed.indexOf('{');
      const lastBrace = trimmed.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
          const err: any = new Error('Upstream provider returned HTML page instead of valid media metadata JSON.');
          err.code = 'UPSTREAM_BOT_VERIFICATION_REQUIRED';
          throw err;
        }
        const err: any = new Error('YTDLP_EXTRACTOR_FAILED: yt-dlp did not output valid JSON metadata.');
        err.code = 'YTDLP_EXTRACTOR_FAILED';
        throw err;
      }

      const rawJson = JSON.parse(trimmed.substring(firstBrace, lastBrace + 1));



      // Format clean application formats
      const extractedFormats: MediaFormat[] = [];
      if (Array.isArray(rawJson.formats)) {
        for (const f of rawJson.formats) {
          if (!f) continue;
          const ext = (f.ext || 'mp4').toLowerCase();
          const hasV = !!(f.vcodec && f.vcodec !== 'none') || (f.width && f.height);
          const hasA = !!(f.acodec && f.acodec !== 'none') || (f.abr && f.abr > 0);

          let quality = f.format_note || (f.height ? `${f.height}p` : f.abr ? `${Math.round(f.abr)} kbps` : 'Standard');
          if (f.height && !quality.includes(`${f.height}p`)) {
            quality = `${f.height}p (${quality})`;
          }

          const fileSizeBytes = f.filesize || f.filesize_approx || (f.tbr && rawJson.duration ? Math.round((f.tbr * 1000 * rawJson.duration) / 8) : 5 * 1024 * 1024);
          const fileSizeFormatted = `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`;

          extractedFormats.push({
            id: String(f.format_id || Math.random().toString(36).substring(2, 7)),
            format: ext === 'webm' ? 'webm' : ext === 'm4a' ? 'm4a' : ext === 'mp3' ? 'mp3' : 'mp4',
            quality,
            resolution: f.width && f.height ? `${f.width}x${f.height}` : undefined,
            fps: f.fps || (f.height >= 720 ? 30 : undefined),
            codec: f.vcodec && f.vcodec !== 'none' ? f.vcodec : f.acodec || 'h264',
            hasAudio: !!hasA,
            hasVideo: !!hasV,
            fileSizeBytes,
            fileSizeFormatted,
            directUrl: f.url,
          });
        }
      }

      // Ensure default audio and video presets exist if list is empty
      if (extractedFormats.length === 0) {
        extractedFormats.push(
          {
            id: 'best_mp4_1080p',
            format: 'mp4',
            quality: '1080p Full HD',
            resolution: '1920x1080',
            fps: 30,
            codec: 'h264',
            hasAudio: true,
            hasVideo: true,
            fileSizeBytes: 25 * 1024 * 1024,
            fileSizeFormatted: '25.0 MB',
          },
          {
            id: 'best_mp4_720p',
            format: 'mp4',
            quality: '720p HD',
            resolution: '1280x720',
            fps: 30,
            codec: 'h264',
            hasAudio: true,
            hasVideo: true,
            fileSizeBytes: 12 * 1024 * 1024,
            fileSizeFormatted: '12.0 MB',
          },
          {
            id: 'best_mp3_320',
            format: 'mp3',
            quality: '320 kbps High Quality Audio',
            hasAudio: true,
            hasVideo: false,
            fileSizeBytes: 6 * 1024 * 1024,
            fileSizeFormatted: '6.0 MB',
          }
        );
      }

      const rawDuration = typeof rawJson.duration === 'number' ? rawJson.duration : 0;
      const mins = Math.floor(rawDuration / 60);
      const secs = Math.floor(rawDuration % 60);
      const durationFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

      let provider = (rawJson.extractor || rawJson.extractor_key || 'direct').toLowerCase();
      if (provider.includes('youtube')) provider = 'youtube';
      else if (provider.includes('vimeo')) provider = 'vimeo';
      else if (provider.includes('soundcloud')) provider = 'soundcloud';

      const metadata: MediaMetadata = {
        id: String(rawJson.id || `media_${Date.now()}`),
        sourceUrl: targetUrl,
        sourcePageUrl: rawJson.webpage_url || targetUrl,
        sourceVideoId: String(rawJson.id || ''),
        provider,
        title: rawJson.title || 'Extracted Media Stream',
        description: rawJson.description?.substring(0, 500),
        thumbnail: rawJson.thumbnail || '',
        thumbnailUrl: rawJson.thumbnail || '',
        embedUrl: provider === 'youtube' && rawJson.id ? `https://www.youtube-nocookie.com/embed/${rawJson.id}` : undefined,
        youtubeVideoId: provider === 'youtube' && rawJson.id ? rawJson.id : undefined,
        duration: rawDuration,
        durationFormatted,
        author: {
          name: rawJson.uploader || rawJson.channel || rawJson.creator || 'Media Creator',
          url: rawJson.uploader_url || rawJson.channel_url,
        },
        views: rawJson.view_count,
        publishDate: rawJson.upload_date,
        formats: extractedFormats,
        isAuthorized: true,
      };

      return metadata;
    } catch (err: any) {
      // If yt-dlp was challenged by bot verification or failed, attempt RapidAPI fallback
      let rapidApiFallbackDetail: string | null = null;
      try {
        console.log(`[YtDlpService] Attempting RapidAPI metadata fallback for ${targetUrl}...`);
        const rapidResult = await fetchRapidApiDetailed(targetUrl);
        if (rapidResult.ok && rapidResult.data && rapidResult.data.medias && rapidResult.data.medias.length > 0) {
          const fallbackMeta = convertSocialApiToMetadata(rapidResult.data, targetUrl);
          console.log(`[YtDlpService] RapidAPI metadata extraction succeeded for ${targetUrl} (${fallbackMeta.formats.length} formats).`);
          return fallbackMeta;
        } else {
          rapidApiFallbackDetail = this.formatRapidApiFallbackFailure(rapidResult);
        }
      } catch (fallbackErr: any) {
        console.log('[YtDlpService] RapidAPI fallback notice:', fallbackErr.message);
        rapidApiFallbackDetail = this.formatRapidApiFallbackFailure(null, fallbackErr);
      }

      const classified = this.classifyError({
        ...err,
        fallbackDetail: rapidApiFallbackDetail,
      });
      const safeUserMsg =
        classified.userMessage && classified.userMessage !== 'undefined'
          ? classified.userMessage
          : 'Unable to process this media URL.';
      const safeMsg =
        classified.message && classified.message !== 'undefined'
          ? classified.message
          : safeUserMsg;
      const customErr: any = new Error(`${classified.code}: ${safeMsg}`);
      customErr.code = classified.code;
      customErr.userMessage = safeUserMsg;
      customErr.fallbackDetail = rapidApiFallbackDetail;
      throw customErr;
    }
  }

  /**
   * Cancel an active running job and clean up its process and directory
   */
  public cancelJobProcess(jobId: string): boolean {
    const proc = this.activeProcesses.get(jobId);
    if (proc) {
      try {
        proc.kill('SIGTERM');
        setTimeout(() => {
          try {
            if (!proc.killed) proc.kill('SIGKILL');
          } catch {}
        }, 1000);
      } catch {}
      this.activeProcesses.delete(jobId);
    }

    // Clean up temporary job directory
    const jobDir = path.join(TEMP_MEDIA_DIR, jobId);
    if (fs.existsSync(jobDir)) {
      try {
        fs.rmSync(jobDir, { recursive: true, force: true });
      } catch {}
    }

    return true;
  }

  /**
   * Primary download and format execution method
   */
  public async download(url: string, options: YtDlpDownloadOptions): Promise<YtDlpExecutionResult> {
    return this.executeDownload({
      ...options,
      sourceUrl: url,
    });
  }

  /**
   * Execute media resolution and download through server-side yt-dlp
   */
  public async executeDownload(options: YtDlpDownloadOptions): Promise<YtDlpExecutionResult> {
    const { jobId, sourceUrl, format = 'mp4', quality = '1080p', formatType = 'video', title, trimParams } = options;
    const isAudioOnly = formatType === 'audio' || format === 'mp3' || format === 'm4a' || format === 'wav';
    const cleanFilename = sanitizeMediaFilename(title || 'media_asset', quality, format);
    
    // Isolated job directory: /tmp/media-jobs/{jobId}/ or path.join(TEMP_MEDIA_DIR, jobId)
    const jobDir = path.join(TEMP_MEDIA_DIR, jobId);
    if (!fs.existsSync(jobDir)) {
      fs.mkdirSync(jobDir, { recursive: true });
    }

    const outputPath = path.join(jobDir, cleanFilename);
    const mimeType = getMimeTypeForFormat(format);
    const ytdl = await this.detectYtDlp();

    // Controlled format selection policy:
    // Respects formats supported by application (mp4, webm, mp3, wav, m4a)
    let formatSpec: string;
    if (isAudioOnly) {
      formatSpec = 'ba/b/best';
    } else if (quality.includes('2160') || quality.includes('4K')) {
      formatSpec = 'bv*[height<=2160]+ba/b[height<=2160]/bv*+ba/b/best';
    } else if (quality.includes('1440') || quality.includes('2K')) {
      formatSpec = 'bv*[height<=1440]+ba/b[height<=1440]/bv*+ba/b/best';
    } else if (quality.includes('1080')) {
      formatSpec = 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]/bv*+ba/b/best';
    } else if (quality.includes('720')) {
      formatSpec = 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/bv*[height<=720]+ba/b[height<=720]/b/best';
    } else if (quality.includes('480')) {
      formatSpec = 'bv*[height<=480]+ba/b[height<=480]/b/best';
    } else if (quality.includes('360')) {
      formatSpec = 'bv*[height<=360]+ba/b[height<=360]/18/b/best';
    } else {
      formatSpec = 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b[ext=mp4]/b/best';
    }

    // Server-side administrative cookies (never asked from users)
    const cookieInfo = loadYtDlpCookies();
    const adminCookiesPath = (cookieInfo.configured && cookieInfo.cookiePath) ? cookieInfo.cookiePath : null;

    const rawTemplate = path.join(jobDir, 'raw_stream.%(ext)s');
    const nodeRuntime = process.execPath || '/usr/local/bin/node';
    const timeoutMs = (options.timeoutSeconds || parseInt(process.env.YTDLP_TIMEOUT_SECONDS || '120', 10)) * 1000;

    const startTime = Date.now();
    let sourceHost = 'unknown';
    try {
      sourceHost = new URL(sourceUrl).hostname;
    } catch {}

    const attempts = [
      {
        name: 'standard-client-extraction',
        extractorArgs: [] as string[],
        format: formatSpec,
      },
      {
        name: 'tv-web-client-fallback',
        extractorArgs: ['--extractor-args', 'youtube:player_client=tv,web,mweb'] as string[],
        format: isAudioOnly ? 'ba/b/best' : formatSpec,
      },
      {
        name: 'android-ios-client-fallback',
        extractorArgs: ['--extractor-args', 'youtube:player_client=android,ios,web'] as string[],
        format: isAudioOnly ? 'ba/best' : '18/b/best',
      },
      {
        name: 'compat-format-fallback',
        extractorArgs: [] as string[],
        format: isAudioOnly ? 'ba/best' : 'b/best',
      },
    ];

    let lastError: any = null;
    let extractionSuccess = false;

    for (const attempt of attempts) {
      if (extractionSuccess) break;

      try {
        const ytdlArgs: string[] = [
          ...ytdl.argsPrefix,
          '--js-runtimes',
          `node:${nodeRuntime}`,
          '--no-playlist',
          '--no-warnings',
          '--no-progress',
          '--retries',
          '2',
          '--fragment-retries',
          '2',
          '--socket-timeout',
          '20',
        ];

        if (adminCookiesPath && fs.existsSync(adminCookiesPath)) {
          ytdlArgs.push('--cookies', adminCookiesPath);
        }

        ytdlArgs.push(...attempt.extractorArgs);
        ytdlArgs.push('-f', attempt.format);

        if (!isAudioOnly) {
          ytdlArgs.push('--merge-output-format', 'mp4');
        }

        ytdlArgs.push('-o', rawTemplate, sourceUrl);

        console.log(`[YtDlpService] Executing stream extraction (${attempt.name}) for Job ${jobId}`);

        await new Promise<void>((resolve, reject) => {
          const proc = spawn(ytdl.command, ytdlArgs);
          this.activeProcesses.set(jobId, proc);

          let stderrData = '';
          let stdoutData = '';

          proc.stdout?.on('data', (d) => {
            stdoutData += d.toString();
          });

          proc.stderr?.on('data', (d) => {
            stderrData += d.toString();
          });

          const timer = setTimeout(() => {
            proc.kill('SIGTERM');
            const timeoutErr: any = new Error('TIMEOUT: yt-dlp process exceeded time limit');
            timeoutErr.code = 'TIMEOUT';
            reject(timeoutErr);
          }, timeoutMs);

          proc.on('close', (code) => {
            clearTimeout(timer);
            this.activeProcesses.delete(jobId);
            if (code === 0) {
              resolve();
            } else {
              const err: any = new Error(`yt-dlp exited with code ${code}\n${stderrData || stdoutData}`);
              err.code = code;
              err.stderr = stderrData;
              err.stdout = stdoutData;
              reject(err);
            }
          });

          proc.on('error', (err) => {
            clearTimeout(timer);
            this.activeProcesses.delete(jobId);
            reject(err);
          });
        });

        // Find raw downloaded file in isolated jobDir
        const jobFiles = fs.readdirSync(jobDir);
        const downloadedRaw = jobFiles.find((f) => f.startsWith('raw_stream.') && !f.endsWith('.part'));

        if (downloadedRaw) {
          const rawPath = path.join(jobDir, downloadedRaw);
          if (fs.existsSync(rawPath) && fs.statSync(rawPath).size > 1000) {
            const probe = await verifyMediaWithFfprobe(rawPath);

            if (isAudioOnly) {
              const audioArgs: string[] = ['-y', '-i', rawPath, '-vn'];
              if (probe.hasAudio) {
                audioArgs.push(
                  '-c:a',
                  format === 'mp3' ? 'libmp3lame' : 'pcm_s16le',
                  '-b:a',
                  quality.includes('320') ? '320k' : '192k'
                );
              } else {
                audioArgs.push('-c:a', format === 'mp3' ? 'libmp3lame' : 'pcm_s16le');
              }
              audioArgs.push(outputPath);
              await execFileAsync('ffmpeg', audioArgs);
              try { fs.unlinkSync(rawPath); } catch {}
            } else if (trimParams) {
              const start = trimParams.startTime;
              const duration = Math.max(1, trimParams.endTime - trimParams.startTime);
              const trimArgs: string[] = [
                '-y',
                '-ss',
                String(start),
                '-t',
                String(duration),
                '-i',
                rawPath,
                '-c:v',
                'libx264',
                '-preset',
                'ultrafast',
              ];
              if (probe.hasAudio) {
                trimArgs.push('-c:a', 'aac', '-b:a', '128k');
              } else {
                trimArgs.push('-an');
              }
              trimArgs.push('-movflags', '+faststart', outputPath);
              await execFileAsync('ffmpeg', trimArgs);
              try { fs.unlinkSync(rawPath); } catch {}
            } else {
              if (rawPath.endsWith('.mp4') && probe.hasVideo) {
                fs.renameSync(rawPath, outputPath);
              } else {
                const remuxArgs: string[] = [
                  '-y',
                  '-i',
                  rawPath,
                  '-c:v',
                  'libx264',
                  '-preset',
                  'ultrafast',
                  '-pix_fmt',
                  'yuv420p',
                ];
                if (probe.hasAudio) {
                  remuxArgs.push('-c:a', 'aac', '-b:a', '128k');
                } else {
                  remuxArgs.push('-an');
                }
                remuxArgs.push('-movflags', '+faststart', outputPath);
                await execFileAsync('ffmpeg', remuxArgs);
                try { fs.unlinkSync(rawPath); } catch {}
              }
            }

            extractionSuccess = true;
            break;
          }
        }
      } catch (ytdlErr: any) {
        lastError = ytdlErr;
        console.log(`[YtDlpService] Extraction attempt notice (${attempt.name}):`, sanitizeLogMessage((ytdlErr?.message || '').split('\n')[0]));
      }
    }



    // If standard extraction failed or was blocked by bot verification, attempt RapidAPI direct stream resolution
    let rapidApiFallbackDetail: string | null = null;
    if (!extractionSuccess || !fs.existsSync(outputPath)) {
      try {
        console.log(`[YtDlpService] Attempting RapidAPI stream resolution fallback for Job ${jobId} (${sourceUrl})...`);
        const rapidResult = await fetchRapidApiDetailed(sourceUrl);
        if (rapidResult.ok && rapidResult.data && rapidResult.data.medias && rapidResult.data.medias.length > 0) {
          const socialData = rapidResult.data;
          // Select suitable media stream from list
          let targetMedia = socialData.medias.find(m => isAudioOnly ? (m.type === 'audio' || m.extension === 'mp3') : (m.type === 'video' || m.extension === 'mp4'));
          if (!targetMedia) {
            targetMedia = socialData.medias[0];
          }

          if (targetMedia && targetMedia.url) {
            const rawStreamExt = targetMedia.extension || (isAudioOnly ? 'mp3' : 'mp4');
            const tempStreamFile = path.join(jobDir, `stream_raw.${rawStreamExt}`);

            console.log(`[YtDlpService] RapidAPI direct media stream located (${targetMedia.quality}, ${targetMedia.type}), streaming and multiplexing...`);
            const streamValidation = await fetchAndValidateMediaStream(targetMedia.url, {
              expectedType: isAudioOnly ? 'audio' : 'video',
              destinationPath: tempStreamFile,
            });

            if (!streamValidation.valid) {
              const isYouTubeCdn = targetMedia.url.includes('googlevideo.com') || (targetMedia.url.includes('videoplayback') && targetMedia.url.includes('ip='));
              if (streamValidation.statusCode === 403 && isYouTubeCdn) {
                rapidApiFallbackDetail = 'YouTube CDN enforces IP-pinning on stream URLs (requires authentic cookies)';
              } else {
                const statusPart = streamValidation.statusCode ? `status ${streamValidation.statusCode}` : (streamValidation.errorCategory || 'validation failed');
                const msgPart = streamValidation.errorMessage ? `: ${streamValidation.errorMessage}` : '';
                rapidApiFallbackDetail = `the resolved URL failed validation (${statusPart}${msgPart})`;
              }
              console.log(`[YtDlpService] RapidAPI stream resolution status for Job ${jobId}: ${rapidApiFallbackDetail}`);
            } else if (!fs.existsSync(tempStreamFile) || fs.statSync(tempStreamFile).size <= 1000) {
              rapidApiFallbackDetail = 'downloaded stream file was empty or missing';
              console.log(`[YtDlpService] RapidAPI downloaded stream file status for Job ${jobId}: ${rapidApiFallbackDetail}`);
            } else {
              const probe = await verifyMediaWithFfprobe(tempStreamFile);
              if (!probe.valid) {
                rapidApiFallbackDetail = `ffprobe rejected the stream (${probe.error || 'invalid media stream structure'})`;
                console.log(`[YtDlpService] RapidAPI stream probe status for Job ${jobId}: ${rapidApiFallbackDetail}`);
              } else {
                try {
                  if (isAudioOnly) {
                    const audioArgs = ['-y', '-i', tempStreamFile, '-vn'];
                    if (probe.hasAudio) {
                      audioArgs.push('-c:a', format === 'mp3' ? 'libmp3lame' : 'pcm_s16le', '-b:a', quality.includes('320') ? '320k' : '192k');
                    } else {
                      audioArgs.push('-c:a', format === 'mp3' ? 'libmp3lame' : 'pcm_s16le');
                    }
                    audioArgs.push(outputPath);
                    await execFileAsync('ffmpeg', audioArgs);
                  } else if (trimParams) {
                    const start = trimParams.startTime;
                    const duration = Math.max(1, trimParams.endTime - trimParams.startTime);
                    const trimArgs = ['-y', '-ss', String(start), '-t', String(duration), '-i', tempStreamFile, '-c:v', 'libx264', '-preset', 'ultrafast'];
                    if (probe.hasAudio) trimArgs.push('-c:a', 'aac', '-b:a', '128k');
                    else trimArgs.push('-an');
                    trimArgs.push('-movflags', '+faststart', outputPath);
                    await execFileAsync('ffmpeg', trimArgs);
                  } else {
                    if (tempStreamFile.endsWith('.mp4') && probe.hasVideo) {
                      fs.renameSync(tempStreamFile, outputPath);
                    } else {
                      const remuxArgs = ['-y', '-i', tempStreamFile, '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p'];
                      if (probe.hasAudio) remuxArgs.push('-c:a', 'aac', '-b:a', '128k');
                      else remuxArgs.push('-an');
                      remuxArgs.push('-movflags', '+faststart', outputPath);
                      await execFileAsync('ffmpeg', remuxArgs);
                    }
                  }

                  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
                    extractionSuccess = true;
                    console.log(`[YtDlpService] RapidAPI stream resolution succeeded for Job ${jobId}.`);
                  } else {
                    rapidApiFallbackDetail = 'muxing failed or output empty';
                  }
                } catch (muxErr: any) {
                  rapidApiFallbackDetail = `muxing failed (${muxErr.message || 'ffmpeg processing error'})`;
                  console.log(`[YtDlpService] RapidAPI multiplexing error for Job ${jobId}:`, muxErr.message);
                }
              }
            }

            if (fs.existsSync(tempStreamFile)) {
              try { fs.unlinkSync(tempStreamFile); } catch {}
            }
          } else {
            rapidApiFallbackDetail = 'RapidAPI returned no valid media stream URL';
          }
        } else {
          rapidApiFallbackDetail = this.formatRapidApiFallbackFailure(rapidResult);
        }
      } catch (fallbackErr: any) {
        console.log('[YtDlpService] RapidAPI stream resolution notice:', fallbackErr.message);
        rapidApiFallbackDetail = this.formatRapidApiFallbackFailure(null, fallbackErr);
      }
    }

    // Handle extraction failure: NEVER use fallback videos
    if (!extractionSuccess || !fs.existsSync(outputPath)) {
      try {
        const leftover = fs.readdirSync(jobDir);
        for (const file of leftover) {
          try { fs.unlinkSync(path.join(jobDir, file)); } catch {}
        }
      } catch {}

      const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
      const classified = this.classifyError({
        ...(lastError || { message: 'YTDLP_EXTRACTION_FAILED: Stream extraction failed' }),
        fallbackDetail: rapidApiFallbackDetail,
      });

      // Safe Server Diagnostics (No sensitive credentials, tokens, or cookies logged)
      console.log('\n[YTDLP EXTRACTION]');
      console.log(`jobId=${jobId}`);
      console.log(`sourceHost=${sourceHost}`);
      console.log(`ytDlpPath=${ytdl.resolvedPath}`);
      console.log(`ytDlpVersion=${this.cachedVersion || 'unknown'}`);
      console.log(`exitCode=${classified.exitCode !== undefined ? classified.exitCode : (lastError?.code ?? 'non-zero')}`);
      console.log(`duration=${durationSec}s`);
      console.log(`diagnosticStatus=${classified.code}`);
      console.log(`fallbackReason=${rapidApiFallbackDetail || 'none'}\n`);

      const failureErr: any = new Error(`${classified.code}: ${classified.message}`);
      failureErr.code = classified.code;
      failureErr.userMessage = classified.userMessage;
      failureErr.fallbackDetail = rapidApiFallbackDetail;
      throw failureErr;
    }

    const stat = fs.statSync(outputPath);
    if (stat.size === 0) {
      try { fs.unlinkSync(outputPath); } catch {}
      const emptyErr: any = new Error('MEDIA_VALIDATION_FAILED: Downloaded media file is 0 bytes.');
      emptyErr.code = 'MEDIA_VALIDATION_FAILED';
      throw emptyErr;
    }

    // Validate container and streams with ffprobe
    const validation = await validateMediaFile(outputPath, isAudioOnly ? 'audio' : 'video');
    if (!validation.valid) {
      try { fs.unlinkSync(outputPath); } catch {}
      const valErr: any = new Error(`MEDIA_VALIDATION_FAILED: ${validation.error || 'Media container validation failed.'}`);
      valErr.code = 'MEDIA_VALIDATION_FAILED';
      throw valErr;
    }

    const fileBuf = await fs.promises.readFile(outputPath);
    const sha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');

    return {
      filePath: outputPath,
      filename: cleanFilename,
      fileSizeBytes: stat.size,
      mimeType,
      durationSeconds: validation.probe?.duration || 0,
      sha256,
      width: validation.probe?.width,
      height: validation.probe?.height,
      codec: validation.probe?.vCodec || validation.probe?.aCodec,
    };
  }
}

export const ytDlpService = YtDlpService.getInstance();
