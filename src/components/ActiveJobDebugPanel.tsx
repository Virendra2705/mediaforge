import React, { useState } from 'react';
import { Terminal, Copy, Check, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';
import { ActiveJobState } from '../types';

interface ActiveJobDebugPanelProps {
  activeJob: ActiveJobState | null;
  className?: string;
}

export const ActiveJobDebugPanel: React.FC<ActiveJobDebugPanelProps> = ({ activeJob, className = '' }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!activeJob) {
    return (
      <div className={`p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono ${className}`}>
        <div className="flex items-center gap-2 text-slate-500 mb-1">
          <Terminal className="w-4 h-4" />
          <span className="font-bold uppercase tracking-wider text-[10px]">Active Job Debugger</span>
        </div>
        <div>No active job in queue. Initiate a download/transcode task to inspect states.</div>
      </div>
    );
  }

  const isFailed = activeJob.status === 'FAILED';
  const effectivePlayableUrl = isFailed ? undefined : (activeJob.playableVideoUrl || activeJob.downloadUrl || (activeJob.status === 'READY' ? `/api/preview/${activeJob.id}` : undefined));
  const effectiveStoragePath = isFailed ? undefined : (activeJob.storagePath || (activeJob.status === 'READY' ? `temp/${activeJob.id}/${activeJob.mediaTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.${activeJob.selectedFormat}` : undefined));

  const isSignedUrl = !!effectivePlayableUrl && (
    effectivePlayableUrl.includes('token=') ||
    effectivePlayableUrl.includes('expires=') ||
    effectivePlayableUrl.includes('supabase.co') ||
    effectivePlayableUrl.includes('X-Amz-Signature') ||
    effectivePlayableUrl.includes('sig=')
  );
  const isPreviewEndpoint = !!effectivePlayableUrl && effectivePlayableUrl.startsWith('/api/preview');
  const isFallbackStream = !!effectivePlayableUrl && !isSignedUrl && !isPreviewEndpoint && (
    effectivePlayableUrl.includes('/fallback/') ||
    effectivePlayableUrl.includes('fallback_media') ||
    effectivePlayableUrl.includes('mock_video')
  );

  let urlClassification = 'Pending Generation';
  let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';

  if (isFailed) {
    urlClassification = activeJob.errorCode || 'Extraction Blocked';
    badgeColor = 'bg-rose-950 text-rose-300 border-rose-800';
  } else if (isSignedUrl) {
    urlClassification = 'Signed Storage URL';
    badgeColor = 'bg-emerald-950 text-emerald-300 border-emerald-800';
  } else if (isPreviewEndpoint) {
    urlClassification = 'Preview Media Endpoint';
    badgeColor = 'bg-blue-950 text-blue-300 border-blue-800';
  } else if (isFallbackStream) {
    urlClassification = 'Fallback Storage Route';
    badgeColor = 'bg-amber-950 text-amber-300 border-amber-800';
  } else if (effectivePlayableUrl) {
    urlClassification = 'Direct HTTP Stream';
    badgeColor = 'bg-indigo-950 text-indigo-300 border-indigo-800';
  }

  const handleCopy = (field: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className={`p-4 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-mono shadow-md text-slate-200 space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-100 text-xs tracking-wide">Active Job Debug Monitor</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeColor}`}>
            {urlClassification}
          </span>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            Status: {activeJob.status} ({activeJob.progress}%)
          </span>
        </div>
      </div>

      {/* State Matrix */}
      <div className="space-y-2">
        {/* 1. playableVideoUrl State */}
        <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              {isSignedUrl ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
              playableVideoUrl:
            </span>
            {effectivePlayableUrl && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleCopy('playableVideoUrl', effectivePlayableUrl)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Copy playableVideoUrl"
                >
                  {copiedField === 'playableVideoUrl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={effectivePlayableUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Open source in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
          <div className="text-slate-300 break-all text-[11px] leading-relaxed select-all">
            {effectivePlayableUrl ? (
              <span>{effectivePlayableUrl}</span>
            ) : (
              <span className="text-slate-500 italic">null (Job is compiling in background queue...)</span>
            )}
          </div>
        </div>

        {/* 2. storagePath State */}
        <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-sky-400 font-semibold">storagePath:</span>
            {effectiveStoragePath && (
              <button
                type="button"
                onClick={() => handleCopy('storagePath', effectiveStoragePath)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Copy storagePath"
              >
                {copiedField === 'storagePath' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
          <div className="text-slate-300 break-all text-[11px] leading-relaxed select-all">
            {effectiveStoragePath ? (
              <span>{effectiveStoragePath}</span>
            ) : (
              <span className="text-slate-500 italic">null (Object destination being allocated...)</span>
            )}
          </div>
        </div>
      </div>

      {/* Error Details if Failed */}
      {isFailed && (
        <div className="bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-rose-400 font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              errorCategory: {activeJob.errorCode || 'EXTRACTION_FAILED'}
            </span>
          </div>
          <div className="text-rose-200 break-all text-[11px] leading-relaxed">
            {activeJob.errorMessage && activeJob.errorMessage !== 'undefined' && activeJob.errorMessage.trim().length > 0
              ? activeJob.errorMessage
              : activeJob.errorCode === 'UPSTREAM_BOT_VERIFICATION_REQUIRED'
              ? 'Unable to fetch this video right now. The video service or source platform requires additional verification. Please try another supported URL.'
              : 'Media processing failed during extraction.'}
          </div>
        </div>
      )}

      {/* Meta Footer */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
        <span>Job ID: {activeJob.id}</span>
        <span>Format: {activeJob.selectedFormat.toUpperCase()} ({activeJob.selectedQuality})</span>
      </div>
    </div>
  );
};
