import React, { useState } from 'react';
import { Terminal, Copy, Check, ExternalLink, ShieldCheck, AlertTriangle, Video, HardDrive, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface PlayerDiagnosticsProps {
  className?: string;
}

export const PlayerDiagnostics: React.FC<PlayerDiagnosticsProps> = ({ className = '' }) => {
  const { metadata, activeJob } = useApp();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Read playableVideoUrl and storagePath from the active application state
  const playableVideoUrl = metadata?.playableVideoUrl || activeJob?.playableVideoUrl || activeJob?.downloadUrl;
  const storagePath = metadata?.storagePath || activeJob?.storagePath || (metadata ? `temp/${metadata.id}/${metadata.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4` : undefined);
  const embedUrl = metadata?.embedUrl;

  const isSignedUrl = !!playableVideoUrl && (
    playableVideoUrl.includes('token=') ||
    playableVideoUrl.includes('expires=') ||
    playableVideoUrl.includes('supabase.co') ||
    playableVideoUrl.includes('X-Amz-Signature') ||
    playableVideoUrl.includes('sig=')
  );
  const isPreviewEndpoint = !!playableVideoUrl && playableVideoUrl.startsWith('/api/preview');
  const isFallbackStream = !!playableVideoUrl && !isSignedUrl && !isPreviewEndpoint && (
    playableVideoUrl.includes('/fallback/') ||
    playableVideoUrl.includes('fallback_media') ||
    playableVideoUrl.includes('mock_video')
  );
  const isDirectStream = !!playableVideoUrl && !isSignedUrl && !isFallbackStream && !isPreviewEndpoint;

  let urlClassification = 'No Media Stream';
  let badgeColor = 'bg-slate-800 text-slate-400 border-slate-700';

  if (embedUrl) {
    urlClassification = 'Official Embed Player';
    badgeColor = 'bg-purple-950/80 text-purple-300 border-purple-800';
  } else if (isSignedUrl) {
    urlClassification = 'Backend Signed URL';
    badgeColor = 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
  } else if (isPreviewEndpoint) {
    urlClassification = 'Backend Preview Endpoint';
    badgeColor = 'bg-blue-950/80 text-blue-300 border-blue-800';
  } else if (isFallbackStream) {
    urlClassification = 'Fallback / Storage Route';
    badgeColor = 'bg-amber-950/80 text-amber-300 border-amber-800';
  } else if (isDirectStream) {
    urlClassification = 'Direct HTTP Stream';
    badgeColor = 'bg-indigo-950/80 text-indigo-300 border-indigo-800';
  }

  const handleCopy = (field: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!metadata && !activeJob) {
    return null;
  }

  return (
    <div
      id="player-diagnostics-panel"
      className={`p-3.5 bg-slate-900/95 dark:bg-slate-950 rounded-xl border border-slate-700/80 text-xs font-mono shadow-sm text-slate-200 space-y-2.5 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-bold text-slate-100 text-xs tracking-wide">PlayerDiagnostics</span>
          <span className="text-[10px] text-emerald-400/90 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60 flex items-center gap-1 font-sans">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Live State Monitor
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeColor}`}>
            {urlClassification}
          </span>
        </div>
      </div>

      {/* State Fields */}
      <div className="space-y-2">
        {/* 1. playableVideoUrl */}
        <div className="bg-slate-950/90 p-2 rounded-lg border border-slate-800/90 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <Video className="w-3 h-3 text-emerald-400" />
              playableVideoUrl:
            </span>
            {playableVideoUrl ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleCopy('playableVideoUrl', playableVideoUrl)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Copy playableVideoUrl"
                >
                  {copiedField === 'playableVideoUrl' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
                <a
                  href={playableVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Open source URL in new tab"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : null}
          </div>
          <div className="text-slate-300 break-all text-[11px] leading-relaxed select-all">
            {playableVideoUrl ? (
              <span>{playableVideoUrl}</span>
            ) : embedUrl ? (
              <span className="text-purple-300 italic">Embedded iframe source: {embedUrl}</span>
            ) : (
              <span className="text-slate-500 italic">null / undefined (Preview unavailable)</span>
            )}
          </div>
        </div>

        {/* 2. storagePath */}
        <div className="bg-slate-950/90 p-2 rounded-lg border border-slate-800/90 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-sky-400 font-semibold flex items-center gap-1.5">
              <HardDrive className="w-3 h-3 text-sky-400" />
              storagePath:
            </span>
            {storagePath ? (
              <button
                type="button"
                onClick={() => handleCopy('storagePath', storagePath)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Copy storagePath"
              >
                {copiedField === 'storagePath' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            ) : null}
          </div>
          <div className="text-slate-300 break-all text-[11px] leading-relaxed select-all">
            {storagePath ? (
              <span>{storagePath}</span>
            ) : (
              <span className="text-slate-500 italic">null / undefined</span>
            )}
          </div>
        </div>
      </div>

      {/* Footer Details */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/70">
        <span className="truncate max-w-[180px]">ID: {metadata?.id || activeJob?.id || 'N/A'}</span>
        <span>MIME: {metadata?.playableVideoMimeType || 'video/mp4'}</span>
      </div>
    </div>
  );
};
