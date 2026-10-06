import React, { useState, useRef, useEffect } from 'react';
import {
  Music,
  Video,
  Scissors,
  Image as ImageIcon,
  FileText,
  Download,
  Play,
  Pause,
  Clock,
  Sparkles,
  Volume2,
  HardDrive,
  Sliders,
  CheckCircle2,
  Layers,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UrlInputBar } from '../components/UrlInputBar';
import { MediaResultCard } from '../components/MediaResultCard';

// 1. YOUTUBE / VIDEO DOWNLOADER VIEW
export const YoutubeDownloaderView: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <UrlInputBar
        customHeading="Online Video Downloader & Formats Analyzer"
        customSubtitle="Inspect authorized public videos, extract pristine MP4 containers, and save audio tracks in highest fidelity."
      />
      <MediaResultCard />
    </div>
  );
};

// 2. VIDEO TO MP3 CONVERTER VIEW
export const Mp3ConverterView: React.FC = () => {
  const { metadata, startDownload, t } = useApp();
  const [selectedBitrate, setSelectedBitrate] = useState<'320' | '256' | '192' | '128'>('320');
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingPreview) {
      audioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <UrlInputBar
        customHeading="High-Fidelity Video to MP3 Converter"
        customSubtitle="Extract pristine acoustic streams, normalize stereo channels, and transcode to 320 kbps MP3."
      />

      {metadata && (
        <div className="mt-8 p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            {/* Album Artwork Preview */}
            <div className="relative w-44 h-44 rounded-2xl overflow-hidden bg-slate-950 shadow-lg shrink-0">
              <img
                src={metadata.thumbnail}
                alt={metadata.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <button
                  id="play-audio-preview-btn"
                  onClick={toggleAudio}
                  className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
                >
                  {isPlayingPreview ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
              </div>
              <audio
                ref={audioRef}
                src="https://cdn.freesound.org/previews/573/573381_5674468-lq.mp3"
                onEnded={() => setIsPlayingPreview(false)}
              />
            </div>

            {/* Controls */}
            <div className="flex-1 min-w-0 space-y-4 text-center md:text-left">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  Audio Track Ready
                </span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1.5 truncate">
                  {metadata.title}
                </h2>
                <p className="text-xs text-slate-500">{metadata.author.name} • {metadata.durationFormatted}</p>
              </div>

              {/* Bitrate Selector */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                  Select Target Bitrate:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { rate: '320', label: '320 kbps (High Fidelity)', desc: 'Studio standard' },
                    { rate: '256', label: '256 kbps (Premium)', desc: 'Transparent' },
                    { rate: '192', label: '192 kbps (Standard)', desc: 'Balanced' },
                    { rate: '128', label: '128 kbps (Compact)', desc: 'Small file size' },
                  ].map(item => (
                    <button
                      key={item.rate}
                      type="button"
                      onClick={() => setSelectedBitrate(item.rate as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedBitrate === item.rate
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <div className="font-bold text-xs sm:text-sm">{item.rate} kbps</div>
                      <div className="text-[10px] opacity-75">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Download Trigger Button */}
              <button
                id="convert-mp3-btn"
                onClick={() =>
                  startDownload({
                    format: {
                      format: 'mp3',
                      quality: `${selectedBitrate} kbps MP3`,
                      fileSizeFormatted: `${(parseInt(selectedBitrate) * metadata.duration / 8000).toFixed(1)} MB`,
                    },
                    formatType: 'audio',
                  })
                }
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <Music className="w-4 h-4" />
                <span>Export & Download {selectedBitrate} kbps MP3</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 3. VIDEO TO MP4 DOWNLOADER VIEW
export const Mp4DownloaderView: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <UrlInputBar
        customHeading="Lossless Video to MP4 Downloader"
        customSubtitle="Select between 360p, 720p HD, 1080p Full HD, and 4K Ultra HD video streams."
      />
      <MediaResultCard />
    </div>
  );
};

// 4. THUMBNAIL DOWNLOADER VIEW
export const ThumbnailDownloaderView: React.FC = () => {
  const { metadata, t, addToast } = useApp();

  const handleDownload = (url: string, quality: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `thumbnail_${quality.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
    a.target = '_blank';
    a.click();
    addToast('success', 'Thumbnail Downloaded', `${quality} image saved.`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <UrlInputBar
        customHeading="HD & 4K Thumbnail Extractor"
        customSubtitle="Retrieve high-resolution cover artwork, poster frames, and thumbnails in original dimensions."
      />

      {metadata && metadata.availableThumbnails && (
        <div className="mt-8 space-y-6">
          <div className="text-center md:text-left">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Available Cover Images for &quot;{metadata.title}&quot;
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Select and download any verified image resolution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {metadata.availableThumbnails.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-3"
              >
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-950">
                  <img
                    src={item.url}
                    alt={item.quality}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{item.quality}</h4>
                    <span className="text-xs font-mono text-slate-500">{item.width} × {item.height} px</span>
                  </div>

                  <button
                    id={`dl-thumb-grid-${idx}`}
                    onClick={() => handleDownload(item.url, item.quality)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JPG</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// 5. SUBTITLE DOWNLOADER VIEW
export const SubtitleDownloaderView: React.FC = () => {
  const { metadata, t, addToast } = useApp();

  const handleDownload = async (language: string, format: 'srt' | 'vtt' | 'txt') => {
    if (!metadata) return;
    try {
      const res = await fetch('/api/subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoTitle: metadata.title, language, format }),
      });
      const data = await res.json();
      if (data.success) {
        const blob = new Blob([data.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        a.click();
        URL.revokeObjectURL(url);
        addToast('success', 'Subtitle Downloaded', `${language} (${format.toUpperCase()}) saved.`);
      }
    } catch {
      addToast('error', 'Error', 'Failed to retrieve subtitle file.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <UrlInputBar
        customHeading="Subtitle & Closed Caption Downloader"
        customSubtitle="Extract subtitles in SRT, WebVTT, and TXT formats for accessible offline viewing and translation."
      />

      {metadata && (
        <div className="mt-8 p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Captions for: {metadata.title}
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            All subtitles are parsed from authorized metadata and conform to standard timing formatting.
          </p>

          {metadata.subtitles && metadata.subtitles.length > 0 ? (
            <div className="space-y-3">
              {metadata.subtitles.map((sub, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {sub.language}
                    </div>
                    <div className="text-xs text-slate-500">
                      ISO Code: <span className="font-mono uppercase font-bold">{sub.code}</span> {sub.isAutoGenerated && '• Automated stream'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(sub.language, 'srt')}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      SRT
                    </button>
                    <button
                      onClick={() => handleDownload(sub.language, 'vtt')}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-300 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      VTT
                    </button>
                    <button
                      onClick={() => handleDownload(sub.language, 'txt')}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-300 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      TXT Transcript
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">{t.noSubtitles}</p>
          )}
        </div>
      )}
    </div>
  );
};

// 6. VIDEO TRIMMER VIEW
export const VideoTrimmerView: React.FC = () => {
  const { metadata, startDownload, addToast } = useApp();
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(30);
  const [exportFormat, setExportFormat] = useState<'mp4' | 'mp3'>('mp4');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
    }

    if (metadata?.playableVideoUrl) {
      const srcUrl = metadata.playableVideoUrl;
      const isSignedUrl = srcUrl.includes('token=') || srcUrl.includes('expires=') || srcUrl.includes('supabase.co') || srcUrl.includes('X-Amz-Signature') || srcUrl.includes('sig=');
      const isPreview = srcUrl.startsWith('/api/preview');
      const isFallback = !isSignedUrl && !isPreview && (srcUrl.includes('/fallback/') || srcUrl.includes('fallback_media') || srcUrl.includes('mock_video'));
      const urlType = isSignedUrl
        ? 'SIGNED_URL'
        : isPreview
        ? 'PREVIEW_ENDPOINT'
        : isFallback
        ? 'STORAGE_FALLBACK_URL'
        : 'DIRECT_STREAM_URL';

      console.log('Video Player Source Updated:', srcUrl, {
        sourceContext: 'TrimmerToolView',
        type: urlType,
        isSignedUrl,
        isFallback,
        mediaId: metadata.id,
        mediaTitle: metadata.title,
        timestamp: new Date().toISOString(),
      });
    }
  }, [metadata?.id, metadata?.playableVideoUrl, metadata?.title]);

  const duration = metadata?.duration || 180;
  const clipLength = Math.max(0, endTime - startTime);

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleExport = () => {
    if (!metadata) return;
    if (endTime <= startTime) {
      addToast('error', 'Invalid Range', 'End time must be after start time.');
      return;
    }
    startDownload({
      format: {
        format: exportFormat,
        quality: `${Math.round(startTime)}s - ${Math.round(endTime)}s Cut`,
        fileSizeFormatted: `${((clipLength / duration) * 40).toFixed(1)} MB`,
      },
      formatType: 'trim',
      trimParams: { startTime, endTime },
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <UrlInputBar
        customHeading="Interactive Video & Audio Trimmer"
        customSubtitle="Set keyframe boundaries, preview clips in real time, and export lossless MP4 video or MP3 audio cuts."
      />

      {metadata && (
        <div className="mt-8 p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Trimming: {metadata.title}
              </h2>
              <p className="text-xs text-slate-500">Total Duration: {metadata.durationFormatted} ({duration}s)</p>
            </div>
            <div className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              Clip Length: {clipLength.toFixed(1)}s
            </div>
          </div>

          {/* Video Preview Player */}
          <div className="w-full aspect-video rounded-xl overflow-hidden bg-black shadow-lg relative flex items-center justify-center">
            {metadata.embedUrl ? (
              <iframe
                key={metadata.embedUrl}
                src={`${metadata.embedUrl}${metadata.embedUrl.includes('?') ? '&' : '?'}autoplay=0&rel=0`}
                title={metadata.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full border-0"
              />
            ) : metadata.playableVideoUrl ? (
              <video
                key={metadata.playableVideoUrl || metadata.id}
                ref={videoRef}
                src={metadata.playableVideoUrl}
                controls
                preload="metadata"
                playsInline
                className="w-full h-full object-contain"
              >
                <source src={metadata.playableVideoUrl} type={metadata.playableVideoMimeType || 'video/mp4'} />
                Your browser does not support video playback.
              </video>
            ) : (
              <div className="text-center p-6 text-slate-400 text-xs">
                In-browser trimmer preview unavailable for this stream type. Timestamps will apply during export processing.
              </div>
            )}
          </div>

          {/* Trimming Timeline Sliders */}
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start slider */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1.5">
                  <span>Start Time: {startTime.toFixed(1)}s</span>
                  <button
                    type="button"
                    onClick={() => handleSeek(startTime)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Preview Start
                  </button>
                </label>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, endTime - 1)}
                  step="0.5"
                  value={startTime}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setStartTime(val);
                    handleSeek(val);
                  }}
                  className="w-full accent-blue-600"
                />
              </div>

              {/* End slider */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1.5">
                  <span>End Time: {endTime.toFixed(1)}s</span>
                  <button
                    type="button"
                    onClick={() => handleSeek(endTime)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Preview End
                  </button>
                </label>
                <input
                  type="range"
                  min={startTime + 1}
                  max={duration}
                  step="0.5"
                  value={endTime}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setEndTime(val);
                    handleSeek(val);
                  }}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>

            {/* Target Container Selection & Export Trigger */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Export As:</span>
                <button
                  type="button"
                  onClick={() => setExportFormat('mp4')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    exportFormat === 'mp4'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  MP4 Video Clip
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('mp3')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    exportFormat === 'mp3'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  MP3 Audio Cut
                </button>
              </div>

              <button
                id="export-trim-btn"
                type="button"
                onClick={handleExport}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <Scissors className="w-4 h-4" />
                <span>Process & Export Clip ({clipLength.toFixed(1)}s)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
