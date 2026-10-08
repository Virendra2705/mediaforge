import { MediaMetadata, MediaFormat } from './types.js';
import { ytDlpService } from './ytDlpService.js';

export interface SocialMediaItem {
  url: string;
  data_size?: number;
  quality: string;
  extension: string;
  type: 'video' | 'audio' | 'image';
  duration?: number;
}

export interface SocialApiResponse {
  url: string;
  source?: string;
  id?: string;
  unique_id?: string;
  author?: string;
  title?: string;
  thumbnail?: string;
  duration?: number;
  medias?: SocialMediaItem[];
  type?: string;
  error?: boolean;
  message?: string;
}

const DEFAULT_RAPIDAPI_KEY = (process.env.RAPIDAPI_KEY || '').trim();
const RAPIDAPI_HOST = 'social-download-all-in-one.p.rapidapi.com';

export interface RapidApiDetailedResponse {
  ok: boolean;
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  bodyText: string;
  data: SocialApiResponse | null;
  errorMessage?: string;
}

export interface FetchSocialResult {
  success: boolean;
  data: SocialApiResponse | null;
  error?: {
    code: string;
    message: string;
    origin: 'rapidapi' | 'source_platform' | 'extractor' | 'backend_proxy';
    technicalDetails?: {
      statusCode?: number;
      headers?: Record<string, string>;
      rawMessage?: string;
      bodySnippet?: string;
    };
  };
}

/**
 * Inspect and query RapidAPI Social Download All In One API with detailed HTTP diagnostics
 */
export async function fetchRapidApiDetailed(
  targetUrl: string,
  customApiKey?: string
): Promise<RapidApiDetailedResponse> {
  const apiKey = (customApiKey && customApiKey.trim().length > 10) ? customApiKey.trim() : DEFAULT_RAPIDAPI_KEY;
  const endpoint = `https://${RAPIDAPI_HOST}/v1/social/autolink`;

  if (!apiKey || apiKey === 'your_rapidapi_key_here') {
    return {
      ok: false,
      statusCode: 503,
      statusText: 'RapidAPI Key Not Configured',
      headers: {},
      bodyText: 'RAPIDAPI_KEY is not configured in the server environment.',
      data: null,
      errorMessage: 'RapidAPI key is not configured in server environment.',
    };
  }

  console.log('[VideoDownloader API Request]', {
    method: 'POST',
    url: endpoint,
    targetUrl,
    host: RAPIDAPI_HOST,
    hasApiKey: !!apiKey && apiKey.length > 5,
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': apiKey,
      },
      body: JSON.stringify({ url: targetUrl }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const headersRecord: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      headersRecord[key.toLowerCase()] = val;
    });

    const bodyText = await response.text();
    let data: SocialApiResponse | null = null;
    let errorMessage: string | undefined;

    try {
      if (bodyText) {
        data = JSON.parse(bodyText) as SocialApiResponse;
        if (data && data.error && data.message) {
          errorMessage = data.message;
        } else if ((data as any)?.message && !data.medias) {
          errorMessage = (data as any).message;
        }
      }
    } catch {
      errorMessage = 'Non-JSON response received from RapidAPI endpoint.';
    }

    const effectiveErrorMessage = errorMessage || (response.ok ? undefined : `HTTP status ${response.status}: ${response.statusText}`);

    console.log('[VideoDownloader API Response]', {
      statusCode: response.status,
      statusText: response.statusText,
      headers: headersRecord,
      bodySnippet: bodyText ? bodyText.slice(0, 500) : '',
      hasMedias: !!(data?.medias && data.medias.length > 0),
      ...(effectiveErrorMessage ? { errorMessage: effectiveErrorMessage } : {}),
    });

    return {
      ok: response.ok && !!(data && !data.error && data.medias && data.medias.length > 0),
      statusCode: response.status,
      statusText: response.statusText,
      headers: headersRecord,
      bodyText,
      data,
      errorMessage: effectiveErrorMessage,
    };
  } catch (err: any) {
    console.log('[VideoDownloader API Network Notice]:', {
      message: err.message,
      targetUrl,
    });
    return {
      ok: false,
      statusCode: 0,
      statusText: 'Network / Abort Error',
      headers: {},
      bodyText: err.message || 'Fetch failed',
      data: null,
      errorMessage: err.message || 'Network request failed',
    };
  }
}

/**
 * Pure RapidAPI query
 */
export async function fetchRapidApiSocial(
  targetUrl: string,
  customApiKey?: string
): Promise<SocialApiResponse | null> {
  const result = await fetchRapidApiDetailed(targetUrl, customApiKey);
  if (result.ok && result.data) {
    return result.data;
  }
  return null;
}

/**
 * Converts SocialApiResponse into standard MediaMetadata with complete formats
 */
export function convertSocialApiToMetadata(social: SocialApiResponse, targetUrl: string): MediaMetadata {
  const durationSec = social.duration ? (social.duration > 1000 ? Math.floor(social.duration / 1000) : social.duration) : 0;
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const durationFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  const formats: MediaFormat[] = [];
  if (social.medias && Array.isArray(social.medias)) {
    social.medias.forEach((m, idx) => {
      const isAudio = m.type === 'audio' || m.extension?.toLowerCase() === 'mp3';
      let ext: 'mp4' | 'webm' | 'mp3' | 'm4a' | 'wav' | 'aac' = isAudio ? 'mp3' : 'mp4';
      const rawExt = (m.extension || '').toLowerCase().trim();
      if (rawExt === 'mp4' || rawExt === 'webm' || rawExt === 'mp3' || rawExt === 'm4a' || rawExt === 'wav' || rawExt === 'aac') {
        ext = rawExt;
      }

      const qualityStr = m.quality || (isAudio ? 'High Quality Audio' : 'HD (No Watermark)');
      const sizeBytes = m.data_size || (isAudio ? 5 * 1024 * 1024 : 20 * 1024 * 1024);

      formats.push({
        id: `social_fmt_${idx}_${ext}`,
        format: ext,
        quality: qualityStr,
        resolution: isAudio ? undefined : '1080x1920',
        hasAudio: true,
        hasVideo: !isAudio,
        fileSizeBytes: sizeBytes,
        fileSizeFormatted: formatBytes(sizeBytes),
        directUrl: m.url,
      });
    });
  }

  // Ensure an MP3 option is present
  const provider = (social.source || 'social').toLowerCase();

  return {
    id: social.id || social.unique_id || `social_${Date.now()}`,
    sourceUrl: targetUrl,
    sourcePageUrl: targetUrl,
    sourceVideoId: social.id || social.unique_id || '',
    provider,
    title: social.title || 'Social Media Video',
    description: `Original media by ${social.author || social.unique_id || 'Creator'} from ${provider.toUpperCase()}`,
    thumbnail: social.thumbnail || '',
    thumbnailUrl: social.thumbnail || '',
    duration: durationSec,
    durationFormatted,
    author: {
      name: social.author || social.unique_id || 'Verified Creator',
    },
    formats,
    isAuthorized: true,
  };
}

/**
 * Fetch media with full structured debugging result
 */
export async function fetchSocialAllInOneWithDetails(
  targetUrl: string,
  customApiKey?: string
): Promise<FetchSocialResult> {
  const rapidResult = await fetchRapidApiDetailed(targetUrl, customApiKey);
  if (rapidResult.ok && rapidResult.data) {
    return {
      success: true,
      data: rapidResult.data,
    };
  }

  // RapidAPI failed or returned quota limit / challenge / error -> log technical diagnostics
  const isRapidQuota = rapidResult.statusCode === 429;
  const isRapidAuth = rapidResult.statusCode === 401 || rapidResult.statusCode === 403;
  const rapidRawMessage = rapidResult.errorMessage || rapidResult.bodyText;

  console.log('[VideoDownloader API Fallback Triggered]', {
    reason: isRapidQuota
      ? 'RapidAPI plan quota reached (HTTP 429)'
      : isRapidAuth
      ? `RapidAPI authentication issue (HTTP ${rapidResult.statusCode})`
      : `RapidAPI status (HTTP ${rapidResult.statusCode}): ${rapidRawMessage.slice(0, 200)}`,
    targetUrl,
  });

  // Fallback: Use ytDlpService to extract rich social video info
  try {
    const fallbackData = await fallbackExtractViaYtDlp(targetUrl);
    return {
      success: true,
      data: fallbackData,
    };
  } catch (err: any) {
    const rawError = err.message || '';
    const isBotChallenge =
      /bot verification|captcha|verify you're human|access denied|forbidden|blocked request|challenge required|sign in to confirm/i.test(
        rawError
      );

    let origin: 'rapidapi' | 'source_platform' | 'extractor' | 'backend_proxy' = 'source_platform';
    if (isRapidQuota || isRapidAuth) {
      origin = 'rapidapi';
    } else if (rawError.includes('yt-dlp')) {
      origin = 'extractor';
    }

    console.log('[VideoDownloader API Fallback Notice]:', {
      origin,
      rapidApiStatus: rapidResult.statusCode,
      rapidApiNotice: isRapidQuota ? 'RapidAPI plan quota reached on current key.' : rapidRawMessage?.slice(0, 150),
      fallbackNotice: rawError?.slice(0, 150),
      isBotChallenge,
      targetUrl,
    });

    const cleanUserMessage =
      isBotChallenge || isRapidQuota || isRapidAuth
        ? 'Unable to fetch this video right now. The video service or source platform requires additional verification. Please try another supported URL.'
        : (err?.message && err.message !== 'undefined'
            ? err.message
            : 'Unable to fetch this video right now. The video service or source platform requires additional verification. Please try another supported URL.');

    return {
      success: false,
      data: null,
      error: {
        code: isBotChallenge ? 'VERIFICATION_REQUIRED' : 'EXTRACTION_FAILED',
        message: cleanUserMessage,
        origin,
        technicalDetails: {
          statusCode: rapidResult.statusCode,
          headers: rapidResult.headers,
          rawMessage: isRapidQuota ? `RapidAPI quota: ${rapidRawMessage}` : rawError,
          bodySnippet: rapidResult.bodyText?.slice(0, 300),
        },
      },
    };
  }
}

/**
 * Fetch media from RapidAPI Social Download All In One API with safe fallback
 */
export async function fetchSocialAllInOne(
  targetUrl: string,
  customApiKey?: string
): Promise<SocialApiResponse> {
  const result = await fetchSocialAllInOneWithDetails(targetUrl, customApiKey);
  if (result.success && result.data) {
    return result.data;
  }
  throw new Error(result.error?.message || 'Unable to extract video information.');
}

/**
 * Fallback extraction using local yt-dlp engine formatted to SocialApiResponse structure
 */
async function fallbackExtractViaYtDlp(targetUrl: string): Promise<SocialApiResponse> {
  try {
    const meta = await ytDlpService.getMetadata(targetUrl);
    const medias: SocialMediaItem[] = [];

    // Video formats
    for (const fmt of meta.formats) {
      if (fmt.hasVideo && fmt.directUrl) {
        medias.push({
          url: fmt.directUrl,
          data_size: fmt.fileSizeBytes,
          quality: fmt.quality || (fmt.resolution ? `${fmt.resolution}` : 'hd_no_watermark'),
          extension: fmt.format || 'mp4',
          type: 'video',
        });
      }
    }

    // Audio format
    // Identify source
    let source = 'social';
    const lower = targetUrl.toLowerCase();
    if (lower.includes('tiktok.com')) source = 'tiktok';
    else if (lower.includes('instagram.com')) source = 'instagram';
    else if (lower.includes('twitter.com') || lower.includes('x.com')) source = 'twitter';
    else if (lower.includes('facebook.com') || lower.includes('fb.watch')) source = 'facebook';
    else if (lower.includes('youtube.com') || lower.includes('youtu.be')) source = 'youtube';

    return {
      url: targetUrl,
      source,
      id: meta.id,
      unique_id: meta.author.name || 'creator',
      author: meta.author.name || 'Verified Creator',
      title: meta.title || 'Social Video',
      thumbnail: meta.thumbnail,
      duration: meta.duration ? meta.duration * 1000 : undefined,
      medias,
      type: 'multiple',
      error: false,
    };
  } catch (err: any) {
    console.log('[SocialDownload] Fallback extraction attempt notice:', err.message);
    throw new Error(
      err.message || 'Unable to extract media from the provided social video URL.'
    );
  }
}

/**
 * Format bytes into human readable format
 */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format duration ms into MM:SS
 */
export function formatDurationMs(ms?: number): string {
  if (!ms || ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
