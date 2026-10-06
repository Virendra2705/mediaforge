import React, { useState, useRef, useEffect } from 'react';
import {
  Video,
  Music,
  Download,
  Copy,
  Check,
  Clock,
  User,
  ShieldCheck,
  FileCode,
  Image as ImageIcon,
  FileText,
  Sparkles,
  Layers,
  Volume2,
  HardDrive,
  Play,
  Film,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ClientMediaFormat } from '../types';
import { PlayerDiagnostics } from './PlayerDiagnostics';

export const MediaResultCard: React.FC = () => {
  const { metadata, startDownload, t, addToast } = useApp();
  const [activeTab, setActiveTab] = useState<'all' | 'video' | 'audio' | 'thumbnails' | 'subtitles'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'video' | 'thumbnail'>('video');
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Reset video state and reload element when metadata changes
    setIsVideoLoading(true);
    setVideoError(null);
    setPreviewMode('video');
    if (videoRef.current) {
      videoRef.current.load();
    }

    const currentSource = metadata?.embedUrl || metadata?.playableVideoUrl;

    if (currentSource) {
      const srcUrl = currentSource;
      const isEmbed = !!metadata?.embedUrl;
      const isSignedUrl = !isEmbed && (srcUrl.includes('token=') || srcUrl.includes('expires=') || srcUrl.includes('supabase.co') || srcUrl.includes('X-Amz-Signature') || srcUrl.includes('sig='));
      const isPreviewEndpoint = !isEmbed && srcUrl.startsWith('/api/preview');
      const isFallbackOrDemo = !isEmbed && !isSignedUrl && !isPreviewEndpoint && (srcUrl.includes('/fallback/') || srcUrl.includes('fallback_media') || srcUrl.includes('mock_video'));
      const isDirectStream = !isEmbed && !isSignedUrl && !isFallbackOrDemo && !isPreviewEndpoint;

      const sourceCategory = isEmbed
        ? 'OFFICIAL_EMBED_PLAYER'
        : isSignedUrl
        ? 'BACKEND_SIGNED_URL'
        : isPreviewEndpoint
        ? 'BACKEND_PREVIEW_ENDPOINT'
        : isDirectStream
        ? 'DIRECT_STREAM_URL'
        : 'FALLBACK_OR_DEMO_URL';

      // Required debugging log: 'Video Player Source Updated:' followed by the new 'src' value
      console.log('Video Player Source Updated:', srcUrl, {
        sourceCategory,
        isEmbed,
        isSignedUrl,
        isFallbackOrDemo,
        isPreviewEndpoint,
        isDirectStream,
        matchesBackendSignedUrl: isSignedUrl,
        isFallbackOrDemoUrl: isFallbackOrDemo,
        mediaId: metadata.id,
        mediaTitle: metadata.title,
        storagePath: metadata.storagePath || `temp/${metadata.id}/${metadata.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`,
        mimeType: metadata.playableVideoMimeType || 'video/mp4',
        timestamp: new Date().toISOString(),
      });
    }
  }, [metadata?.id, metadata?.embedUrl, metadata?.playableVideoUrl, metadata?.title, metadata?.storagePath, metadata?.playableVideoMimeType]);

  if (!metadata) return null;

  const videoFormats = metadata.formats.filter(f => f.hasVideo);
  const audioFormats = metadata.formats.filter(f => !f.hasVideo || f.format === 'mp3' || f.format === 'wav');

  const filteredFormats =
    activeTab === 'video'
      ? videoFormats
      : activeTab === 'audio'
      ? audioFormats
      : metadata.formats;

  const handleCopyLink = (format: ClientMediaFormat) => {
    // Generate valid safe shareable format link
    const secureUrl = `${window.location.origin}/?url=${encodeURIComponent(metadata.sourceUrl)}&format=${format.format}&quality=${encodeURIComponent(format.quality)}`;
    navigator.clipboard.writeText(secureUrl);
    setCopiedId(format.id);
    addToast('info', 'Shareable Media Link Copied', 'Direct format link copied to clipboard.');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDownloadThumbnail = (url: string, quality: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${quality}.jpg`;
    a.target = '_blank';
    a.click();
    addToast('success', 'Thumbnail Downloaded', `${quality} image saved.`);
  };

  const handleDownloadSubtitle = async (language: string, format: 'srt' | 'vtt' | 'txt') => {
    try {
      const res = await fetch('/api/subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoTitle: metadata.title, language, format }),
      });
      const data = await res.json();
      if (data.success && data.content) {
        const blob = new Blob([data.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        a.click();
        URL.revokeObjectURL(url);
        addToast('success', 'Subtitle Downloaded', `${language} (${format.toUpperCase()}) transcript saved.`);
      }
    } catch {
      addToast('error', 'Error', 'Failed to generate subtitle stream.');
    }
  };

  return (
    <div id="media-result-container" className="w-full max-w-5xl mx-auto mt-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* 2-Column Balanced Geometric Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Media Metadata & Status (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          {/* Video Preview Player with Mode Toggle */}
          <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 shadow-sm group">
            {previewMode === 'video' && !videoError ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                {metadata.embedUrl ? (
                  <iframe
                    key={metadata.embedUrl}
                    src={`${metadata.embedUrl}${metadata.embedUrl.includes('?') ? '&' : '?'}autoplay=1&rel=0`}
                    title={metadata.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                ) : metadata.playableVideoUrl ? (
                  <>
                    {isVideoLoading && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 text-white gap-2 pointer-events-none">
                        <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-slate-300 font-medium">Loading video stream...</span>
                      </div>
                    )}
                    <video
                      key={metadata.playableVideoUrl || metadata.id}
                      ref={videoRef}
                      controls
                      preload="metadata"
                      playsInline
                      src={metadata.playableVideoUrl}
                      onLoadedMetadata={() => setIsVideoLoading(false)}
                      onCanPlay={() => setIsVideoLoading(false)}
                      onError={() => {
                        console.warn('[Video Player Diagnostics] Playback error for:', metadata.playableVideoUrl);
                        setVideoError('Video preview is temporarily unavailable. You can still export and download all formats below.');
                        setIsVideoLoading(false);
                      }}
                      className="w-full h-full object-contain"
                    >
                      <source src={metadata.playableVideoUrl} type={metadata.playableVideoMimeType || 'video/mp4'} />
                      Your browser does not support HTML5 video playback.
                    </video>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-900 text-center text-slate-300 space-y-2.5">
                    <AlertCircle className="w-7 h-7 text-amber-400" />
                    <p className="text-xs text-slate-300 max-w-xs">Preview unavailable for this format. Select an export format below to download.</p>
                  </div>
                )}
              </div>
            ) : videoError ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-900 text-center text-slate-300 space-y-2.5">
                <AlertCircle className="w-7 h-7 text-amber-400" />
                <p className="text-xs text-slate-300 max-w-xs">{videoError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setVideoError(null);
                    setIsVideoLoading(true);
                    if (videoRef.current) {
                      videoRef.current.load();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Preview</span>
                </button>
              </div>
            ) : (
              <div className="relative w-full h-full">
                <img
                  src={metadata.thumbnail}
                  alt={metadata.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {(metadata.embedUrl || metadata.playableVideoUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewMode('video');
                      setVideoError(null);
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors group/play"
                    aria-label="Play Video Preview"
                  >
                    <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg group-hover/play:scale-110 transition-transform">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                  </button>
                )}
              </div>
            )}

            {/* Badges & Mode Switcher */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5 z-20">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold tracking-wider uppercase shadow-sm">
                {metadata.provider}
              </span>
              {(metadata.embedUrl || metadata.playableVideoUrl) && !videoError && (
                <button
                  type="button"
                  onClick={() => setPreviewMode(m => (m === 'video' ? 'thumbnail' : 'video'))}
                  className="px-2 py-0.5 rounded-full bg-black/70 hover:bg-black text-white text-[10px] font-medium backdrop-blur-sm transition-colors flex items-center gap-1"
                >
                  {previewMode === 'video' ? <ImageIcon className="w-2.5 h-2.5" /> : <Film className="w-2.5 h-2.5" />}
                  <span>{previewMode === 'video' ? 'Cover' : 'Preview'}</span>
                </button>
              )}
            </div>

            {/* Duration pill */}
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-white text-[11px] font-mono font-medium flex items-center gap-1 backdrop-blur-sm z-20 pointer-events-none">
              <Clock className="w-3 h-3" />
              <span>{metadata.durationFormatted}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <ShieldCheck className="w-3 h-3" />
                Verified Media
              </span>
              {metadata.publishDate && (
                <span className="text-xs text-slate-400">
                  {metadata.publishDate}
                </span>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight line-clamp-2">
              {metadata.title}
            </h2>

            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">{metadata.author.name}</span>
              <div className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
              <span>{metadata.views ? `${metadata.views.toLocaleString()} Views` : 'Public Stream'}</span>
            </div>

            {metadata.description && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                {metadata.description}
              </p>
            )}
          </div>

          {/* Geometric Status Box */}
          <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between">
            <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
              Status
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <div className="w-2 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-pulse" />
              <span>Ready for Export</span>
            </div>
          </div>

          {/* Diagnostic Output Panel */}
          <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 text-[11px] font-mono space-y-1">
            <div className="font-bold text-slate-700 dark:text-slate-200 text-xs mb-1 flex items-center justify-between">
              <span>Pipeline Diagnostics</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-medium">Verified Active</span>
            </div>
            <div className="text-slate-600 dark:text-slate-300 truncate">
              <span className="text-slate-400">Media ID:</span> {metadata.id}
            </div>
            <div className="text-slate-600 dark:text-slate-300 truncate">
              <span className="text-slate-400">Player Type:</span> {metadata.embedUrl ? 'Official Embed Player' : metadata.playableVideoUrl ? 'Direct HTML5 Stream' : 'Metadata Only'}
            </div>
            <div className="text-slate-600 dark:text-slate-300 truncate">
              <span className="text-slate-400">Player Source:</span> {metadata.embedUrl || metadata.playableVideoUrl || 'Preview Unavailable'}
            </div>
          </div>

          {/* Real-Time PlayerDiagnostics Component */}
          <PlayerDiagnostics />
        </div>

        {/* Right Column: Tabular Formats & Options (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col justify-between">
          {/* Format Tabs Bar */}
          <div className="flex items-center gap-1.5 p-3 border-b border-slate-200 dark:border-slate-800 overflow-x-auto bg-slate-50/50 dark:bg-slate-900/50">
            <button
              id="tab-all-formats"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              All ({metadata.formats.length})
            </button>

            <button
              id="tab-video-formats"
              onClick={() => setActiveTab('video')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'video'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              Video ({videoFormats.length})
            </button>

            <button
              id="tab-audio-formats"
              onClick={() => setActiveTab('audio')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'audio'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              Audio ({audioFormats.length})
            </button>

            {metadata.availableThumbnails && metadata.availableThumbnails.length > 0 && (
              <button
                id="tab-thumbnail-formats"
                onClick={() => setActiveTab('thumbnails')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'thumbnails'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Thumbnails
              </button>
            )}

            {metadata.subtitles && metadata.subtitles.length > 0 && (
              <button
                id="tab-subtitle-formats"
                onClick={() => setActiveTab('subtitles')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'subtitles'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Subtitles
              </button>
            )}
          </div>

          {/* Standard Formats Table Header */}
          {activeTab !== 'thumbnails' && activeTab !== 'subtitles' && (
            <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 px-5 py-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              <span className="col-span-5">Resolution / Quality</span>
              <span className="col-span-4">Format</span>
              <span className="col-span-3 text-right">Action</span>
            </div>
          )}

          {/* Formats Table Rows */}
          {activeTab !== 'thumbnails' && activeTab !== 'subtitles' && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[380px] overflow-y-auto">
              {filteredFormats.map(fmt => {
                const isAudioOnly = !fmt.hasVideo || fmt.format === 'mp3' || fmt.format === 'wav';
                return (
                  <div
                    key={fmt.id}
                    className="grid grid-cols-12 items-center px-5 py-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Quality */}
                    <div className="col-span-5 flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          fmt.quality.includes('1080') || fmt.quality.includes('4K')
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                            : isAudioOnly
                            ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {fmt.quality}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {isAudioOnly ? 'High Bitrate' : fmt.fps ? `${fmt.fps} FPS` : 'HD Stream'}
                      </span>
                    </div>

                    {/* Format & Size */}
                    <div className="col-span-4 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono uppercase font-semibold text-slate-700 dark:text-slate-300">
                        {fmt.format}
                      </span>{' '}
                      ({fmt.fileSizeFormatted})
                    </div>

                    {/* Action */}
                    <div className="col-span-3 text-right flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(fmt)}
                        title="Copy direct signed link"
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      >
                        {copiedId === fmt.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        id={`download-fmt-btn-${fmt.id}`}
                        type="button"
                        onClick={() =>
                          startDownload({
                            format: fmt,
                            formatType: isAudioOnly ? 'audio' : 'video',
                          })
                        }
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                      >
                        {isAudioOnly ? 'Extract' : 'Download'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Thumbnails Gallery Tab */}
          {activeTab === 'thumbnails' && metadata.availableThumbnails && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto">
              {metadata.availableThumbnails.map((thumb, idx) => (
                <div
                  key={idx}
                  className="rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 p-2.5 flex flex-col justify-between"
                >
                  <div className="aspect-video w-full rounded-lg overflow-hidden bg-slate-950 mb-2">
                    <img src={thumb.url} alt={thumb.quality} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    <span>{thumb.quality}</span>
                    <span className="font-mono text-[11px] text-slate-500">{thumb.width}×{thumb.height}</span>
                  </div>
                  <button
                    id={`download-thumb-${idx}`}
                    onClick={() => handleDownloadThumbnail(thumb.url, thumb.quality)}
                    className="w-full py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JPG</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Subtitles Tab */}
          {activeTab === 'subtitles' && (
            <div className="p-4 space-y-2.5 max-h-[380px] overflow-y-auto">
              {metadata.subtitles && metadata.subtitles.length > 0 ? (
                metadata.subtitles.map((sub, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {sub.language}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {sub.isAutoGenerated ? 'Auto Captions' : 'Official Transcript'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        id={`dl-srt-${sub.code}`}
                        onClick={() => handleDownloadSubtitle(sub.language, 'srt')}
                        className="px-2.5 py-1 rounded text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        SRT
                      </button>
                      <button
                        id={`dl-vtt-${sub.code}`}
                        onClick={() => handleDownloadSubtitle(sub.language, 'vtt')}
                        className="px-2.5 py-1 rounded text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300"
                      >
                        VTT
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 py-4 text-center">{t.noSubtitles}</p>
              )}
            </div>
          )}

          {/* Card Footer Bar */}
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
            <span className="italic text-[11px]">Metadata retrieved via Provider: {metadata.provider}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              15-Min TTL Protected
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
