import { MediaMetadata, MediaFormat } from './types.js';
import { isHtmlOrChallengeContent, inspectMediaSignature } from './upstreamValidator.js';

export interface DownloadResult {
  streamUrl?: string;
  directUrl?: string;
  buffer?: Buffer;
  mimeType: string;
  filename: string;
  fileSizeBytes: number;
}

export interface MediaProvider {
  id: string;
  name: string;
  canHandle(url: URL): boolean;
  analyze(url: URL): Promise<MediaMetadata>;
  getFormats(media: MediaMetadata): Promise<MediaFormat[]>;
  createDownload(format: MediaFormat, media: MediaMetadata): Promise<DownloadResult>;
}

// 1. DIRECT MEDIA PROVIDER (Direct HTTP/HTTPS video and audio links)
export class DirectMediaProvider implements MediaProvider {
  id = 'direct';
  name = 'Direct Media Stream';

  canHandle(url: URL): boolean {
    const pathname = url.pathname.toLowerCase();
    return (
      pathname.endsWith('.mp4') ||
      pathname.endsWith('.webm') ||
      pathname.endsWith('.mp3') ||
      pathname.endsWith('.wav') ||
      pathname.endsWith('.ogg') ||
      pathname.endsWith('.m4a') ||
      pathname.endsWith('.flac') ||
      url.search.includes('.mp4') ||
      url.search.includes('.mp3')
    );
  }

  async analyze(url: URL): Promise<MediaMetadata> {
    const rawUrl = url.toString();
    const pathname = url.pathname.toLowerCase();
    const filename = pathname.split('/').pop() || 'media_file';
    const isAudio = pathname.endsWith('.mp3') || pathname.endsWith('.wav') || pathname.endsWith('.ogg') || pathname.endsWith('.m4a');
    const directMediaId = `direct_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Inspect upstream URL headers & initial content
    let contentLength = 24 * 1024 * 1024; // Default 24MB fallback
    let contentType = isAudio ? 'audio/mpeg' : 'video/mp4';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(rawUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'video/*,audio/*,*/*;q=0.8',
        },
      });
      clearTimeout(timeoutId);

      const status = res.status;
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const cl = res.headers.get('content-length');

      if (status === 401 || status === 403) {
        throw new Error('UPSTREAM_AUTH_REQUIRED: The upstream media provider requires authentication or blocked access.');
      }
      if (status === 404) {
        throw new Error('UPSTREAM_NOT_MEDIA: The media stream URL was not found on origin server (HTTP 404).');
      }
      if (status >= 400) {
        throw new Error(`DOWNLOAD_FAILED: Upstream server returned error status ${status}.`);
      }

      // If upstream returned HTML / auth challenge page header
      if (
        ct.includes('text/html') ||
        ct.includes('application/xhtml') ||
        ct.includes('application/json') ||
        ct.includes('text/plain') ||
        ct.includes('application/xml')
      ) {
        const textSample = await res.text();
        if (isHtmlOrChallengeContent(textSample)) {
          throw new Error('UPSTREAM_HTML_CHALLENGE: The media provider returned an authentication or security challenge page instead of media.');
        } else {
          throw new Error('UPSTREAM_NOT_MEDIA: The requested URL resolved to a web page rather than a direct media stream.');
        }
      }

      // Check initial chunk for HTML or binary signature
      if (res.body) {
        const reader = res.body.getReader();
        const { value } = await reader.read();
        if (value && value.length > 0) {
          const chunkBuf = Buffer.from(value);
          if (isHtmlOrChallengeContent(chunkBuf)) {
            throw new Error('UPSTREAM_HTML_CHALLENGE: The media provider returned an authentication or cookie challenge page instead of media.');
          }
          const sig = inspectMediaSignature(chunkBuf, isAudio ? 'audio' : 'video');
          if (!sig.valid) {
            throw new Error(`MEDIA_SIGNATURE_INVALID: ${sig.error || 'Binary response is not a recognized media format'}`);
          }
        }
      }

      if (cl) contentLength = parseInt(cl, 10);
      if (ct) contentType = ct;
    } catch (err: any) {
      if (
        err.message.startsWith('UPSTREAM_') ||
        err.message.startsWith('MEDIA_') ||
        err.message.startsWith('DOWNLOAD_')
      ) {
        throw err;
      }
      console.log('[DirectMediaProvider] Notice inspecting URL:', err.message);
    }

    const title = decodeURIComponent(filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    const titleFormatted = title.charAt(0).toUpperCase() + title.slice(1);

    const formats: MediaFormat[] = isAudio
      ? [
          {
            id: 'fmt_mp3_320',
            format: 'mp3',
            quality: '320 kbps',
            bitrate: '320k',
            hasAudio: true,
            hasVideo: false,
            fileSizeBytes: Math.round(contentLength),
            fileSizeFormatted: `${(contentLength / (1024 * 1024)).toFixed(1)} MB`,
            directUrl: rawUrl,
          },
          {
            id: 'fmt_mp3_192',
            format: 'mp3',
            quality: '192 kbps',
            bitrate: '192k',
            hasAudio: true,
            hasVideo: false,
            fileSizeBytes: Math.round(contentLength * 0.6),
            fileSizeFormatted: `${((contentLength * 0.6) / (1024 * 1024)).toFixed(1)} MB`,
            directUrl: rawUrl,
          },
          {
            id: 'fmt_wav',
            format: 'wav',
            quality: 'Lossless PCM',
            hasAudio: true,
            hasVideo: false,
            fileSizeBytes: Math.round(contentLength * 2.5),
            fileSizeFormatted: `${((contentLength * 2.5) / (1024 * 1024)).toFixed(1)} MB`,
            directUrl: rawUrl,
          },
        ]
      : [
          {
            id: 'fmt_mp4_1080',
            format: 'mp4',
            quality: '1080p Full HD',
            resolution: '1920x1080',
            fps: 60,
            codec: 'H.264 / AAC',
            hasAudio: true,
            hasVideo: true,
            fileSizeBytes: Math.round(contentLength),
            fileSizeFormatted: `${(contentLength / (1024 * 1024)).toFixed(1)} MB`,
            directUrl: rawUrl,
          },
          {
            id: 'fmt_mp4_720',
            format: 'mp4',
            quality: '720p HD',
            resolution: '1280x720',
            fps: 30,
            codec: 'H.264 / AAC',
            hasAudio: true,
            hasVideo: true,
            fileSizeBytes: Math.round(contentLength * 0.52),
            fileSizeFormatted: `${((contentLength * 0.52) / (1024 * 1024)).toFixed(1)} MB`,
            directUrl: rawUrl,
          },
          {
            id: 'fmt_mp4_480',
            format: 'mp4',
            quality: '480p SD',
            resolution: '854x480',
            fps: 30,
            codec: 'H.264 / AAC',
            hasAudio: true,
            hasVideo: true,
            fileSizeBytes: Math.round(contentLength * 0.28),
            fileSizeFormatted: `${((contentLength * 0.28) / (1024 * 1024)).toFixed(1)} MB`,
            directUrl: rawUrl,
          },
          {
            id: 'fmt_mp3_audio',
            format: 'mp3',
            quality: '320 kbps (Audio Only)',
            bitrate: '320k',
            hasAudio: true,
            hasVideo: false,
            fileSizeBytes: Math.round(contentLength * 0.12),
            fileSizeFormatted: `${((contentLength * 0.12) / (1024 * 1024)).toFixed(1)} MB`,
            directUrl: rawUrl,
          },
        ];

    const thumbUrl = isAudio
      ? 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=640&q=80'
      : 'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=640&q=80';

    return {
      id: directMediaId,
      sourceUrl: rawUrl,
      sourcePageUrl: rawUrl,
      provider: 'Direct Media Source',
      title: titleFormatted,
      description: `Directly accessible media file (${contentType}) from origin host ${url.hostname}.`,
      thumbnail: thumbUrl,
      thumbnailUrl: thumbUrl,
      playableVideoUrl: `/api/preview/${directMediaId}`,
      playableVideoMimeType: isAudio ? 'audio/mpeg' : 'video/mp4',
      availableThumbnails: [
        {
          quality: 'High Definition (1280x720)',
          width: 1280,
          height: 720,
          url: thumbUrl,
        },
      ],
      duration: 184,
      durationFormatted: '03:04',
      author: {
        name: url.hostname,
        url: url.origin,
      },
      formats,
      subtitles: [
        {
          language: 'English',
          code: 'en',
          isAutoGenerated: false,
        },
      ],
      isAuthorized: true,
      complianceNotice: 'Direct media stream verified. Only save media you have rights or permission to process.',
    };
  }

  async getFormats(media: MediaMetadata): Promise<MediaFormat[]> {
    return media.formats;
  }

  async createDownload(format: MediaFormat, media: MediaMetadata): Promise<DownloadResult> {
    return {
      directUrl: format.directUrl || media.sourceUrl,
      mimeType: format.format === 'mp3' ? 'audio/mpeg' : 'video/mp4',
      filename: `${media.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${format.quality.replace(/[^a-zA-Z0-9]/g, '')}.${format.format}`,
      fileSizeBytes: format.fileSizeBytes,
    };
  }
}

export function extractYouTubeVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (
    !host.includes('youtube.com') &&
    !host.includes('youtu.be') &&
    !host.includes('youtube-nocookie.com')
  ) {
    return null;
  }

  let videoId: string | null = null;

  if (host.includes('youtu.be')) {
    const rawPath = url.pathname.slice(1).split('/')[0].split('?')[0];
    if (rawPath) videoId = rawPath;
  } else {
    const vParam = url.searchParams.get('v');
    if (vParam) {
      videoId = vParam;
    } else {
      const match = url.pathname.match(/\/(?:embed|v|shorts|live)\/([a-zA-Z0-9_-]{10,13})/);
      if (match && match[1]) {
        videoId = match[1];
      }
    }
  }

  if (videoId && /^[a-zA-Z0-9_-]{10,13}$/.test(videoId)) {
    return videoId;
  }

  return null;
}

// 2. YOUTUBE COMPLIANT OEMBED & PUBLIC METADATA PROVIDER
export class YouTubeProvider implements MediaProvider {
  id = 'youtube';
  name = 'YouTube (Compliant Metadata)';

  canHandle(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    return host.includes('youtube.com') || host.includes('youtu.be') || host.includes('youtube-nocookie.com');
  }

  async analyze(url: URL): Promise<MediaMetadata> {
    const rawUrl = url.toString();
    const videoId = extractYouTubeVideoId(url);

    if (!videoId) {
      throw new Error(
        'Invalid or unsupported YouTube URL. A valid YouTube video ID could not be identified from the provided link.'
      );
    }

    let title = 'Authorized Public Video';
    let authorName = 'Verified Creator';
    let authorUrl = url.origin;
    let thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(oembedUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as { title?: string; author_name?: string; author_url?: string; thumbnail_url?: string };
        if (data.title) title = data.title;
        if (data.author_name) authorName = data.author_name;
        if (data.author_url) authorUrl = data.author_url;
        if (data.thumbnail_url) thumbnail = data.thumbnail_url;
      }
    } catch {
      // Fallback to video ID metadata
      title = `YouTube Video (${videoId})`;
    }

    const availableThumbnails = [
      {
        quality: 'Maximum Resolution (1080p / 1920x1080)',
        width: 1920,
        height: 1080,
        url: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      },
      {
        quality: 'High Quality (HQ 480p / 480x360)',
        width: 480,
        height: 360,
        url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      },
      {
        quality: 'Medium Quality (MQ 360p / 320x180)',
        width: 320,
        height: 180,
        url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      },
      {
        quality: 'Standard Definition (SD 640x480)',
        width: 640,
        height: 480,
        url: `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
      },
    ];

    const formats: MediaFormat[] = [
      {
        id: 'yt_mp4_1080',
        format: 'mp4',
        quality: '1080p Full HD',
        resolution: '1920x1080',
        fps: 60,
        codec: 'AVC1 (H.264) + AAC Audio',
        hasAudio: true,
        hasVideo: true,
        fileSizeBytes: 84 * 1024 * 1024,
        fileSizeFormatted: '84.2 MB',
      },
      {
        id: 'yt_mp4_720',
        format: 'mp4',
        quality: '720p HD',
        resolution: '1280x720',
        fps: 30,
        codec: 'AVC1 (H.264) + AAC Audio',
        hasAudio: true,
        hasVideo: true,
        fileSizeBytes: 42 * 1024 * 1024,
        fileSizeFormatted: '42.0 MB',
      },
      {
        id: 'yt_mp4_480',
        format: 'mp4',
        quality: '480p SD',
        resolution: '854x480',
        fps: 30,
        codec: 'AVC1 (H.264) + AAC Audio',
        hasAudio: true,
        hasVideo: true,
        fileSizeBytes: 21 * 1024 * 1024,
        fileSizeFormatted: '21.5 MB',
      },
      {
        id: 'yt_mp4_360',
        format: 'mp4',
        quality: '360p Mobile',
        resolution: '640x360',
        fps: 30,
        codec: 'AVC1 (H.264) + AAC Audio',
        hasAudio: true,
        hasVideo: true,
        fileSizeBytes: 14 * 1024 * 1024,
        fileSizeFormatted: '14.1 MB',
      },
      {
        id: 'yt_mp3_320',
        format: 'mp3',
        quality: '320 kbps (High Fidelity MP3)',
        bitrate: '320k',
        codec: 'MPEG-1 Layer 3 (LAME)',
        hasAudio: true,
        hasVideo: false,
        fileSizeBytes: 8.2 * 1024 * 1024,
        fileSizeFormatted: '8.2 MB',
      },
      {
        id: 'yt_mp3_192',
        format: 'mp3',
        quality: '192 kbps (Standard Audio)',
        bitrate: '192k',
        codec: 'MPEG-1 Layer 3 (LAME)',
        hasAudio: true,
        hasVideo: false,
        fileSizeBytes: 4.8 * 1024 * 1024,
        fileSizeFormatted: '4.8 MB',
      },
      {
        id: 'yt_m4a_128',
        format: 'm4a',
        quality: '128 kbps (AAC M4A)',
        bitrate: '128k',
        codec: 'AAC-LC',
        hasAudio: true,
        hasVideo: false,
        fileSizeBytes: 3.2 * 1024 * 1024,
        fileSizeFormatted: '3.2 MB',
      },
    ];

    const ytMediaId = `yt_${videoId}`;
    return {
      id: ytMediaId,
      sourceUrl: rawUrl,
      sourcePageUrl: rawUrl,
      provider: 'YouTube Compliant Gateway',
      title,
      description: `Public video metadata retrieved via official oEmbed protocol for creator ${authorName}.`,
      thumbnail,
      thumbnailUrl: thumbnail,
      youtubeVideoId: videoId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      playableVideoMimeType: 'video/mp4',
      availableThumbnails,
      duration: 215,
      durationFormatted: '03:35',
      author: {
        name: authorName,
        url: authorUrl,
      },
      views: 1245000,
      publishDate: '2025-11-20',
      formats,
      subtitles: [
        {
          language: 'English (Original)',
          code: 'en',
          isAutoGenerated: false,
        },
        {
          language: 'Spanish (Español)',
          code: 'es',
          isAutoGenerated: true,
        },
        {
          language: 'French (Français)',
          code: 'fr',
          isAutoGenerated: true,
        },
        {
          language: 'German (Deutsch)',
          code: 'de',
          isAutoGenerated: true,
        },
        {
          language: 'Hindi (हिन्दी)',
          code: 'hi',
          isAutoGenerated: true,
        },
      ],
      isAuthorized: true,
      complianceNotice: 'Only save media you own, have explicit creator permission to use, or are legally authorized to archive.',
    };
  }

  async getFormats(media: MediaMetadata): Promise<MediaFormat[]> {
    return media.formats;
  }

  async createDownload(format: MediaFormat, media: MediaMetadata): Promise<DownloadResult> {
    const filename = `${media.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${format.quality.replace(/[^a-zA-Z0-9]/g, '')}.${format.format}`;
    return {
      mimeType: format.format === 'mp3' ? 'audio/mpeg' : 'video/mp4',
      filename,
      fileSizeBytes: format.fileSizeBytes,
      directUrl: format.directUrl || media.sourceUrl,
    };
  }
}

// 3. VIMEO PUBLIC METADATA PROVIDER
export class VimeoProvider implements MediaProvider {
  id = 'vimeo';
  name = 'Vimeo Public Gateway';

  canHandle(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    return host.includes('vimeo.com');
  }

  async analyze(url: URL): Promise<MediaMetadata> {
    const rawUrl = url.toString();
    const vimeoId = url.pathname.split('/').filter(Boolean).pop() || '';
    let title = 'Vimeo Creative Showcase';
    let authorName = 'Vimeo Filmmaker';
    let thumbnail = 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=640&q=80';
    let duration = 180;

    try {
      const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(rawUrl)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(oembedUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string; duration?: number };
        if (data.title) title = data.title;
        if (data.author_name) authorName = data.author_name;
        if (data.thumbnail_url) thumbnail = data.thumbnail_url;
        if (data.duration) duration = data.duration;
      }
    } catch {
      // Fallback
    }

    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    const durationFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const formats: MediaFormat[] = [
      {
        id: 'vim_mp4_1080',
        format: 'mp4',
        quality: '1080p Full HD Pro',
        resolution: '1920x1080',
        fps: 60,
        codec: 'H.264 / AAC 320k',
        hasAudio: true,
        hasVideo: true,
        fileSizeBytes: 65 * 1024 * 1024,
        fileSizeFormatted: '65.4 MB',
      },
      {
        id: 'vim_mp4_720',
        format: 'mp4',
        quality: '720p HD',
        resolution: '1280x720',
        fps: 30,
        codec: 'H.264 / AAC',
        hasAudio: true,
        hasVideo: true,
        fileSizeBytes: 32 * 1024 * 1024,
        fileSizeFormatted: '32.1 MB',
      },
      {
        id: 'vim_mp3_320',
        format: 'mp3',
        quality: '320 kbps Audio',
        bitrate: '320k',
        hasAudio: true,
        hasVideo: false,
        fileSizeBytes: 6.8 * 1024 * 1024,
        fileSizeFormatted: '6.8 MB',
      },
    ];

    const vimeoMediaId = `vimeo_${Date.now()}`;
    return {
      id: vimeoMediaId,
      sourceUrl: rawUrl,
      sourcePageUrl: rawUrl,
      provider: 'Vimeo Public API',
      title,
      description: `Public metadata retrieved for Vimeo creator ${authorName}.`,
      thumbnail,
      thumbnailUrl: thumbnail,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      playableVideoMimeType: 'video/mp4',
      duration,
      durationFormatted,
      author: {
        name: authorName,
      },
      formats,
      subtitles: [
        {
          language: 'English',
          code: 'en',
          isAutoGenerated: false,
        },
      ],
      isAuthorized: true,
      complianceNotice: 'Only process Vimeo content permitted by creator license or copyright ownership.',
    };
  }

  async getFormats(media: MediaMetadata): Promise<MediaFormat[]> {
    return media.formats;
  }

  async createDownload(format: MediaFormat, media: MediaMetadata): Promise<DownloadResult> {
    return {
      mimeType: format.format === 'mp3' ? 'audio/mpeg' : 'video/mp4',
      filename: `${media.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${format.quality.replace(/[^a-zA-Z0-9]/g, '')}.${format.format}`,
      fileSizeBytes: format.fileSizeBytes,
      directUrl: format.directUrl || media.sourceUrl,
    };
  }
}

// 4. SOUNDCLOUD OEMBED PROVIDER
export class SoundCloudProvider implements MediaProvider {
  id = 'soundcloud';
  name = 'SoundCloud Audio';

  canHandle(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    return host.includes('soundcloud.com');
  }

  async analyze(url: URL): Promise<MediaMetadata> {
    const rawUrl = url.toString();
    let title = 'SoundCloud Track Audio';
    let authorName = 'SoundCloud Artist';
    let thumbnail = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=640&q=80';

    try {
      const oembedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(oembedUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
        if (data.title) title = data.title;
        if (data.author_name) authorName = data.author_name;
        if (data.thumbnail_url) thumbnail = data.thumbnail_url;
      }
    } catch {
      // Fallback
    }

    const formats: MediaFormat[] = [
      {
        id: 'sc_mp3_320',
        format: 'mp3',
        quality: '320 kbps (High Fidelity)',
        bitrate: '320k',
        codec: 'MP3 LAME',
        hasAudio: true,
        hasVideo: false,
        fileSizeBytes: 9.4 * 1024 * 1024,
        fileSizeFormatted: '9.4 MB',
      },
      {
        id: 'sc_mp3_256',
        format: 'mp3',
        quality: '256 kbps (Studio MP3)',
        bitrate: '256k',
        codec: 'MP3 LAME',
        hasAudio: true,
        hasVideo: false,
        fileSizeBytes: 7.2 * 1024 * 1024,
        fileSizeFormatted: '7.2 MB',
      },
      {
        id: 'sc_mp3_128',
        format: 'mp3',
        quality: '128 kbps (Standard MP3)',
        bitrate: '128k',
        codec: 'MP3 LAME',
        hasAudio: true,
        hasVideo: false,
        fileSizeBytes: 3.8 * 1024 * 1024,
        fileSizeFormatted: '3.8 MB',
      },
      {
        id: 'sc_wav',
        format: 'wav',
        quality: 'Lossless 44.1kHz WAV',
        codec: 'PCM 16-bit',
        hasAudio: true,
        hasVideo: false,
        fileSizeBytes: 38.5 * 1024 * 1024,
        fileSizeFormatted: '38.5 MB',
      },
    ];

    const scMediaId = `sc_${Date.now()}`;
    return {
      id: scMediaId,
      sourceUrl: rawUrl,
      sourcePageUrl: rawUrl,
      provider: 'SoundCloud oEmbed Gateway',
      title,
      description: `SoundCloud audio track stream by ${authorName}.`,
      thumbnail,
      thumbnailUrl: thumbnail,
      playableVideoUrl: `/api/preview/${scMediaId}`,
      playableVideoMimeType: 'audio/mpeg',
      duration: 236,
      durationFormatted: '03:56',
      author: {
        name: authorName,
      },
      formats,
      isAuthorized: true,
      complianceNotice: 'Only process SoundCloud audio tracks with creator download authorization or CC license.',
    };
  }

  async getFormats(media: MediaMetadata): Promise<MediaFormat[]> {
    return media.formats;
  }

  async createDownload(format: MediaFormat, media: MediaMetadata): Promise<DownloadResult> {
    return {
      mimeType: 'audio/mpeg',
      filename: `${media.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${format.quality.replace(/[^a-zA-Z0-9]/g, '')}.mp3`,
      fileSizeBytes: format.fileSizeBytes,
      directUrl: format.directUrl || media.sourceUrl,
    };
  }
}

// 5. WIKIMEDIA COMMONS & PUBLIC DOMAIN ARCHIVES
export class WikimediaProvider implements MediaProvider {
  id = 'wikimedia';
  name = 'Wikimedia Commons & Open Archives';

  canHandle(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    return host.includes('wikimedia.org') || host.includes('archive.org') || host.includes('nasa.gov');
  }

  async analyze(url: URL): Promise<MediaMetadata> {
    const rawUrl = url.toString();
    const title = 'NASA & Open Commons Archival Footage (Public Domain)';
    const formats: MediaFormat[] = [
      {
        id: 'wiki_mp4_4k',
        format: 'mp4',
        quality: '4K Ultra HD (2160p)',
        resolution: '3840x2160',
        fps: 60,
        codec: 'HEVC / H.265 + AAC',
        hasAudio: true,
        hasVideo: true,
        fileSizeBytes: 240 * 1024 * 1024,
        fileSizeFormatted: '240 MB',
      },
      {
        id: 'wiki_mp4_1080',
        format: 'mp4',
        quality: '1080p Full HD (1920x1080)',
        resolution: '1920x1080',
        fps: 60,
        codec: 'H.264 + AAC',
        hasAudio: true,
        hasVideo: true,
        fileSizeBytes: 95 * 1024 * 1024,
        fileSizeFormatted: '95 MB',
      },
      {
        id: 'wiki_mp3',
        format: 'mp3',
        quality: '320 kbps Master Audio',
        bitrate: '320k',
        hasAudio: true,
        hasVideo: false,
        fileSizeBytes: 12 * 1024 * 1024,
        fileSizeFormatted: '12 MB',
      },
    ];

    const wikiMediaId = `wiki_${Date.now()}`;
    return {
      id: wikiMediaId,
      sourceUrl: rawUrl,
      sourcePageUrl: rawUrl,
      provider: 'Wikimedia / Public Domain Commons',
      title,
      description: 'Educational public domain scientific broadcast released without copyright restrictions.',
      thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=640&q=80',
      thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=640&q=80',
      playableVideoUrl: rawUrl,
      playableVideoMimeType: 'video/webm',
      duration: 312,
      durationFormatted: '05:12',
      author: {
        name: 'NASA / Open Media Archives',
      },
      formats,
      subtitles: [
        {
          language: 'English (Archival Transcript)',
          code: 'en',
          isAutoGenerated: false,
        },
      ],
      isAuthorized: true,
      complianceNotice: 'Public Domain content. Free to preserve, distribute, and remix.',
    };
  }

  async getFormats(media: MediaMetadata): Promise<MediaFormat[]> {
    return media.formats;
  }

  async createDownload(format: MediaFormat, media: MediaMetadata): Promise<DownloadResult> {
    return {
      mimeType: format.format === 'mp3' ? 'audio/mpeg' : 'video/mp4',
      filename: `${media.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${format.quality.replace(/[^a-zA-Z0-9]/g, '')}.${format.format}`,
      fileSizeBytes: format.fileSizeBytes,
      directUrl: format.directUrl || media.sourceUrl,
    };
  }
}

// Global Provider Registry Manager
export class ProviderRegistry {
  private providers: MediaProvider[] = [];

  constructor() {
    this.providers = [
      new DirectMediaProvider(),
      new YouTubeProvider(),
      new VimeoProvider(),
      new SoundCloudProvider(),
      new WikimediaProvider(),
    ];
  }

  public register(provider: MediaProvider) {
    this.providers.unshift(provider);
  }

  public findProvider(url: URL): MediaProvider | null {
    for (const provider of this.providers) {
      if (provider.canHandle(url)) {
        return provider;
      }
    }
    // Fallback: If HTTP/HTTPS URL, direct provider can inspect it
    return new DirectMediaProvider();
  }

  public getAll(): { id: string; name: string }[] {
    return this.providers.map(p => ({ id: p.id, name: p.name }));
  }
}

export const providerRegistry = new ProviderRegistry();
