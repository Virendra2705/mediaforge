import { z } from 'zod';

/**
 * Supported Social Media Platforms for EasyDown API
 */
export interface SupportedPlatform {
  id: string;
  name: string;
  badge: string;
  domains: string[];
  iconName: string;
}

export const EASYDOWN_SUPPORTED_PLATFORMS: SupportedPlatform[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    badge: 'Shorts & 4K Videos',
    domains: ['youtube.com', 'youtu.be', 'm.youtube.com'],
    iconName: 'Play',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    badge: 'No Watermark HD',
    domains: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
    iconName: 'Video',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    badge: 'Reels, Posts & Stories',
    domains: ['instagram.com', 'instagr.am'],
    iconName: 'Camera',
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    badge: 'HD Videos & Clips',
    domains: ['twitter.com', 'x.com', 't.co'],
    iconName: 'Twitter',
  },
  {
    id: 'threads',
    name: 'Threads',
    badge: 'Videos & Clips',
    domains: ['threads.net', 'threads.com'],
    iconName: 'Share2',
  },
  {
    id: 'rednote',
    name: 'RedNote (Xiaohongshu)',
    badge: 'Photos & Videos',
    domains: ['xiaohongshu.com', 'xhslink.com', 'rednote.com'],
    iconName: 'Image',
  },
  {
    id: 'bilibili',
    name: 'Bilibili',
    badge: '1080p & Clips',
    domains: ['bilibili.com', 'b23.tv', 'bili2233.cn'],
    iconName: 'Tv',
  },
  {
    id: 'douyin',
    name: 'Douyin',
    badge: 'No Watermark HD',
    domains: ['douyin.com', 'iesdouyin.com'],
    iconName: 'Film',
  },
  {
    id: 'kuaishou',
    name: 'Kuaishou (Kwai)',
    badge: 'HD Videos',
    domains: ['kuaishou.com', 'kwai.com', 'v.kuaishou.com', 'kwai-video.com'],
    iconName: 'Zap',
  },
  {
    id: 'weibo',
    name: 'Weibo',
    badge: 'Clips & Stories',
    domains: ['weibo.com', 'weibo.cn', 'm.weibo.cn'],
    iconName: 'Globe',
  },
  {
    id: 'toutiao',
    name: 'Toutiao',
    badge: 'News & Videos',
    domains: ['toutiao.com', 'm.toutiao.com'],
    iconName: 'FileText',
  },
];

export interface EasyDownMediaItem {
  url: string;
  quality: string;
  extension: string;
  type: 'video' | 'audio' | 'image';
  data_size?: number;
  formatted_size?: string;
  width?: number;
  height?: number;
  bitrate?: string;
  fps?: number;
}

export interface EasyDownNormalizedData {
  id?: string;
  url: string;
  platform: string;
  platformName: string;
  title: string;
  author?: string;
  authorUrl?: string;
  thumbnail: string;
  duration?: number;
  durationFormatted?: string;
  medias: EasyDownMediaItem[];
  source: 'easydown' | 'fallback';
}

export interface EasyDownParseResult {
  success: boolean;
  data: EasyDownNormalizedData | null;
  error: {
    code: string;
    message: string;
    status: number;
  } | null;
}

/**
 * Mask sensitive string for safe logging
 */
export function maskToken(token?: string): string {
  if (!token) return '[NOT_SET]';
  if (token.length <= 8) return '****';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

/**
 * Detect platform from user input URL
 */
export function detectPlatformFromUrl(urlStr: string): { id: string; name: string } {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    
    for (const p of EASYDOWN_SUPPORTED_PLATFORMS) {
      if (p.domains.some((d) => host === d || host.endsWith('.' + d))) {
        return { id: p.id, name: p.name };
      }
    }

    if (host.includes('facebook') || host.includes('fb.watch')) {
      return { id: 'facebook', name: 'Facebook' };
    }
    if (host.includes('pinterest') || host.includes('pin.it')) {
      return { id: 'pinterest', name: 'Pinterest' };
    }
    if (host.includes('reddit')) {
      return { id: 'reddit', name: 'Reddit' };
    }

    return { id: 'generic', name: 'Social Media' };
  } catch {
    return { id: 'unknown', name: 'Web Media' };
  }
}

/**
 * Validate and sanitize submitted social media URL
 */
export function validateAndSanitizeUrl(rawUrl: unknown): { valid: boolean; url: string; error?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, url: '', error: 'A valid URL string is required.' };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, url: '', error: 'URL cannot be empty.' };
  }

  // Extract URL if user pasted text with URL inside
  const urlMatch = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
  const targetUrl = urlMatch ? urlMatch[0] : trimmed;

  try {
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, url: '', error: 'URL must start with http:// or https://' };
    }
    
    // Prevent SSRF: block localhost and internal private IP ranges
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return { valid: false, url: '', error: 'Invalid or restricted target URL.' };
    }

    return { valid: true, url: parsed.toString() };
  } catch {
    return { valid: false, url: '', error: 'Invalid URL format. Please enter a complete web link.' };
  }
}

/**
 * Format bytes to readable size
 */
export function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) return 'Direct Stream';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export function formatDurationSec(sec?: number): string {
  if (!sec || isNaN(sec) || sec <= 0) return '00:00';
  const total = Math.floor(sec > 1000 ? sec / 1000 : sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Parse and normalize raw EasyDown API response into uniform structure
 */
export function normalizeEasyDownResponse(
  rawJson: any,
  originalUrl: string
): EasyDownNormalizedData {
  const root = rawJson?.data || rawJson || {};
  const platformInfo = detectPlatformFromUrl(originalUrl);

  const title =
    root.title ||
    root.caption ||
    root.desc ||
    root.description ||
    rawJson.title ||
    `${platformInfo.name} Media`;

  const thumbnail =
    root.thumbnail ||
    root.thumbnail_url ||
    root.cover ||
    root.cover_url ||
    root.preview ||
    root.picture ||
    rawJson.thumbnail ||
    '';

  const author =
    root.author?.name ||
    root.author_name ||
    root.author ||
    root.uploader ||
    root.user?.nickname ||
    root.user?.name ||
    rawJson.author ||
    'Content Creator';

  const authorUrl = root.author?.url || root.author_url || root.user?.profile_url || undefined;
  const duration = Number(root.duration || rawJson.duration || 0);

  const medias: EasyDownMediaItem[] = [];

  // 1. Process 'medias' or 'downloads' array if returned
  const rawMedias = Array.isArray(root.medias)
    ? root.medias
    : Array.isArray(root.downloads)
    ? root.downloads
    : Array.isArray(root.formats)
    ? root.formats
    : Array.isArray(rawJson.medias)
    ? rawJson.medias
    : [];

  for (const m of rawMedias) {
    if (!m || !m.url) continue;
    const isAudio =
      m.type === 'audio' ||
      m.extension?.toLowerCase() === 'mp3' ||
      m.extension?.toLowerCase() === 'm4a' ||
      m.quality?.toLowerCase()?.includes('audio');
    const isImage =
      m.type === 'image' ||
      ['jpg', 'jpeg', 'png', 'webp'].includes(m.extension?.toLowerCase());

    const type: 'video' | 'audio' | 'image' = isAudio ? 'audio' : isImage ? 'image' : 'video';
    const ext =
      m.extension?.toLowerCase() ||
      (isAudio ? 'mp3' : isImage ? 'jpg' : 'mp4');
    const size = typeof m.data_size === 'number' ? m.data_size : typeof m.size === 'number' ? m.size : undefined;

    medias.push({
      url: m.url,
      quality: m.quality || (isAudio ? 'Audio Stream (MP3)' : 'HD Video (MP4)'),
      extension: ext,
      type,
      data_size: size,
      formatted_size: formatBytes(size),
      width: m.width,
      height: m.height,
      bitrate: m.bitrate,
      fps: m.fps,
    });
  }

  // 2. Process separate 'videos' or 'video' list if medias was empty
  if (medias.length === 0 && (Array.isArray(root.videos) || Array.isArray(root.video))) {
    const videoList = Array.isArray(root.videos) ? root.videos : root.video;
    for (const v of videoList) {
      if (!v) continue;
      const vUrl = typeof v === 'string' ? v : v.url || v.src;
      if (!vUrl) continue;
      const size = typeof v === 'object' ? v.size || v.data_size : undefined;
      medias.push({
        url: vUrl,
        quality: (typeof v === 'object' && v.quality) ? v.quality : 'HD Video (No Watermark)',
        extension: (typeof v === 'object' && v.extension) ? v.extension : 'mp4',
        type: 'video',
        data_size: size,
        formatted_size: formatBytes(size),
      });
    }
  }

  // 3. Process direct video URL strings (e.g. root.video_url, root.video, root.download_url)
  if (medias.length === 0 && (root.video_url || (typeof root.video === 'string' && root.video))) {
    const vUrl = root.video_url || root.video;
    medias.push({
      url: vUrl,
      quality: root.quality || 'HD (No Watermark)',
      extension: 'mp4',
      type: 'video',
      data_size: root.size || root.data_size,
      formatted_size: formatBytes(root.size || root.data_size),
    });
  }

  // 4. Process 'audios' or 'music' or 'audio_url'
  const audioUrl = root.audio_url || root.music_url || root.music || (typeof root.audio === 'string' ? root.audio : undefined);
  if (audioUrl && !medias.some((m) => m.url === audioUrl)) {
    medias.push({
      url: audioUrl,
      quality: 'Audio Stream (MP3)',
      extension: 'mp3',
      type: 'audio',
      formatted_size: 'Direct Audio Stream',
    });
  }

  // 5. Process photo / image gallery posts (e.g. Xiaohongshu / Instagram multi-photo)
  const images = Array.isArray(root.images) ? root.images : Array.isArray(root.photos) ? root.photos : [];
  for (let idx = 0; idx < images.length; idx++) {
    const img = images[idx];
    const imgUrl = typeof img === 'string' ? img : img?.url || img?.src;
    if (!imgUrl) continue;
    medias.push({
      url: imgUrl,
      quality: `Photo ${idx + 1} (HD)`,
      extension: 'jpg',
      type: 'image',
      formatted_size: 'High Resolution Image',
    });
  }

  // Fallback single stream if only root.url or download exists
  if (medias.length === 0 && root.url && root.url !== originalUrl) {
    medias.push({
      url: root.url,
      quality: 'Direct Media Stream',
      extension: 'mp4',
      type: 'video',
      formatted_size: 'Direct Stream',
    });
  }

  return {
    id: root.id || root.unique_id || undefined,
    url: originalUrl,
    platform: platformInfo.id,
    platformName: platformInfo.name,
    title,
    author,
    authorUrl,
    thumbnail,
    duration,
    durationFormatted: formatDurationSec(duration),
    medias,
    source: 'easydown',
  };
}

/**
 * Main service method to parse a social media URL using EasyDown API
 * POST https://api.easydown.org/api/v1/parse
 */
export async function parseWithEasyDownApi(
  targetUrl: string,
  customToken?: string
): Promise<EasyDownParseResult> {
  const sanitize = validateAndSanitizeUrl(targetUrl);
  if (!sanitize.valid) {
    return {
      success: false,
      data: null,
      error: {
        code: 'INVALID_URL',
        message: sanitize.error || 'Please provide a valid web URL.',
        status: 400,
      },
    };
  }

  const token = customToken || process.env.EASYDOWN_TOKEN;

  if (!token) {
    // Return structured notice indicating server environment needs EASYDOWN_TOKEN
    return {
      success: false,
      data: null,
      error: {
        code: 'EASYDOWN_TOKEN_MISSING',
        message:
          'EasyDown API token is not configured on the server. Please set the EASYDOWN_TOKEN environment variable in your project configuration.',
        status: 503,
      },
    };
  }

  const sanitizedUrl = sanitize.url;
  const endpoint = 'https://api.easydown.org/api/v1/parse';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'VideoFetch-Downloader/2.4',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        url: sanitizedUrl,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    let json: any = null;
    try {
      json = JSON.parse(responseText);
    } catch {
      json = null;
    }

    if (!response.ok) {
      const statusCode = response.status;
      let errorCode = 'EASYDOWN_API_ERROR';
      let clientMessage = 'Unable to parse media with EasyDown API.';

      if (statusCode === 401) {
        errorCode = 'UNAUTHORIZED';
        clientMessage = 'EasyDown API authentication failed. Please verify your EASYDOWN_TOKEN.';
      } else if (statusCode === 403) {
        errorCode = 'FORBIDDEN';
        clientMessage = 'EasyDown API access forbidden. Your plan or IP may not have permission.';
      } else if (statusCode === 404) {
        errorCode = 'MEDIA_NOT_FOUND';
        clientMessage = 'Media content could not be found. The post may be private, removed, or region-restricted.';
      } else if (statusCode === 422) {
        errorCode = 'UNPROCESSABLE_ENTITY';
        clientMessage = json?.message || 'The provided URL could not be parsed by EasyDown. Please check the link.';
      } else if (statusCode === 429) {
        errorCode = 'RATE_LIMIT_EXCEEDED';
        clientMessage = 'EasyDown API rate limit or monthly credit limit reached. Please try again later or top up credits.';
      } else if (statusCode >= 500) {
        errorCode = 'UPSTREAM_ERROR';
        clientMessage = 'EasyDown parsing service is temporarily unavailable. Please try again in a few moments.';
      }

      return {
        success: false,
        data: null,
        error: {
          code: errorCode,
          message: json?.message || clientMessage,
          status: statusCode,
        },
      };
    }

    // Check if EasyDown response body indicates an internal error code
    if (json && (json.code === 400 || json.code === 404 || json.code === 422 || json.code === 500 || json.error)) {
      return {
        success: false,
        data: null,
        error: {
          code: 'EASYDOWN_PARSE_FAILED',
          message: json.message || json.error || 'Failed to extract media items from the provided link.',
          status: typeof json.code === 'number' ? json.code : 422,
        },
      };
    }

    // Normalize response
    const normalized = normalizeEasyDownResponse(json, sanitizedUrl);

    if (!normalized.medias || normalized.medias.length === 0) {
      return {
        success: false,
        data: null,
        error: {
          code: 'NO_DOWNLOAD_STREAMS',
          message: 'No downloadable media streams were found for this URL. The content may be private or protected.',
          status: 404,
        },
      };
    }

    return {
      success: true,
      data: normalized,
      error: null,
    };
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError';
    return {
      success: false,
      data: null,
      error: {
        code: isTimeout ? 'EASYDOWN_TIMEOUT' : 'EASYDOWN_NETWORK_ERROR',
        message: isTimeout
          ? 'EasyDown API request timed out after 15 seconds. Please retry.'
          : 'Failed to establish connection with EasyDown API service.',
        status: isTimeout ? 504 : 502,
      },
    };
  }
}
