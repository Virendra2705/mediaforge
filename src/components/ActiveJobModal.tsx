import React, { useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  X,
  Sparkles,
  Layers,
  Clock,
  PlayCircle,
} from 'lucide-react';
import { useApp, SAMPLE_URLS } from '../context/AppContext';
import { downloadMediaFile, sanitizeFilename } from '../utils/download';
import { ActiveJobDebugPanel } from './ActiveJobDebugPanel';

export const ActiveJobModal: React.FC = () => {
  const {
    activeJob,
    isJobModalOpen,
    setJobModalOpen,
    cancelActiveJob,
    setCurrentUrl,
    analyzeUrl,
    addToast,
    authToken,
    t,
  } = useApp();
  const [isRequestingDownload, setIsRequestingDownload] = useState(false);

  if (!isJobModalOpen || !activeJob) return null;

  const isReady = activeJob.status === 'READY';
  const isCancelled = activeJob.status === 'CANCELLED';
  const isFailed = activeJob.status === 'FAILED';
  const isProcessing = !isReady && !isCancelled && !isFailed;

  const handleTrySample = (sampleUrl: string, sampleName: string) => {
    setJobModalOpen(false);
    setCurrentUrl(sampleUrl);
    analyzeUrl(sampleUrl);
    addToast('info', 'Loaded Sample Media', sampleName);
  };

  const handleDownloadFile = async () => {
    if (!activeJob) return;
    setIsRequestingDownload(true);

    try {
      let downloadUrl = activeJob.downloadUrl || activeJob.playableVideoUrl;
      let downloadName = sanitizeFilename(activeJob.mediaTitle, activeJob.selectedQuality, activeJob.selectedFormat);
      let mimeType = activeJob.mimeType || (activeJob.selectedFormat === 'mp3' ? 'audio/mpeg' : 'video/mp4');

      // If download URL is missing from activeJob state, request fresh signed URL from server
      if (!downloadUrl) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const res = await fetch('/api/download', {
          method: 'POST',
          headers,
          body: JSON.stringify({ jobId: activeJob.id }),
        });

        const json = await res.json();
        downloadUrl = json.downloadUrl || json.signedUrl || json.data?.downloadUrl || json.data?.signedUrl;
        if (!res.ok || !json.success || !downloadUrl) {
          const errorMsg = json.error?.message || `Failed to generate secure download authorization (HTTP ${res.status}).`;
          addToast('error', 'Download could not be started', errorMsg);
          return;
        }

        downloadName =
          json.filename ||
          json.fileName ||
          json.data?.fileName ||
          json.data?.filename ||
          downloadName;
        mimeType = json.mimeType || mimeType;
      }

      await downloadMediaFile({
        downloadUrl,
        filename: downloadName,
        expectedMimeType: mimeType,
      });

      addToast('success', 'Download started', `${downloadName} is downloading to your device.`);
    } catch (err: any) {
      addToast('error', 'Download could not be started', err.message || 'Failed to initialize media download.');
    } finally {
      setIsRequestingDownload(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Close Modal Button */}
        <button
          id="close-job-modal-btn"
          onClick={() => setJobModalOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Status Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isReady
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                : isProcessing
                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
            }`}
          >
            {isReady ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : isProcessing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <XCircle className="w-6 h-6" />
            )}
          </div>

          <div>
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                isReady
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  : isProcessing
                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                  : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
              }`}
            >
              {activeJob.status}
            </span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              {isReady ? 'Media File Ready!' : isProcessing ? 'Processing Media Stream' : 'Job Status Notice'}
            </h3>
          </div>
        </div>

        {/* Media Snippet */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center gap-3 mb-5">
          {activeJob.thumbnailUrl ? (
            <img
              src={activeJob.thumbnailUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="w-16 aspect-video object-cover rounded-lg bg-slate-950"
            />
          ) : (
            <div className="w-16 aspect-video rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <Layers className="w-5 h-5 text-slate-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
              {activeJob.mediaTitle}
            </h4>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span className="uppercase font-mono font-bold text-blue-600 dark:text-blue-400">
                {activeJob.selectedFormat}
              </span>
              <span>•</span>
              <span>{activeJob.selectedQuality}</span>
              {activeJob.fileSizeFormatted && (
                <>
                  <span>•</span>
                  <span>{activeJob.fileSizeFormatted}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar & Status Text */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              {isProcessing && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
              {activeJob.stepMessage}
            </span>
            <span className="font-mono">{activeJob.progress}%</span>
          </div>

          <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isReady
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : isProcessing
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(5, activeJob.progress))}%` }}
            />
          </div>
        </div>

        {/* Multi-step execution breakdown / Error Guidance */}
        {isFailed ? (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-800 dark:text-rose-300 mb-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <div className="font-bold text-rose-950 dark:text-rose-100 text-sm flex items-center gap-2 flex-wrap">
                  <span>
                    {activeJob.errorCode === 'YTDLP_NOT_INSTALLED'
                      ? 'Server Engine Notice'
                      : activeJob.errorCode === 'UPSTREAM_BOT_VERIFICATION_REQUIRED'
                      ? 'Upstream Platform Notice'
                      : activeJob.errorCode === 'HOSTING_NETWORK_RESTRICTION'
                      ? 'Hosting Network Restriction'
                      : activeJob.errorCode === 'YTDLP_NETWORK_FAILED' || activeJob.errorCode === 'NETWORK_ERROR' || activeJob.errorCode === 'TIMEOUT'
                      ? 'Network Connectivity Notice'
                      : activeJob.errorCode === 'YTDLP_JS_RUNTIME_ERROR'
                      ? 'JS Runtime Solver Notice'
                      : activeJob.errorCode === 'UPSTREAM_LOGIN_REQUIRED' || activeJob.errorCode === 'UPSTREAM_AUTH_REQUIRED'
                      ? 'Sign-in / Authentication Required'
                      : activeJob.errorCode === 'UPSTREAM_REGION_RESTRICTED'
                      ? 'Geographical Restriction Notice'
                      : activeJob.errorCode === 'UPSTREAM_VIDEO_UNAVAILABLE' || activeJob.errorCode === 'MEDIA_NOT_FOUND' || activeJob.errorCode === 'MEDIA_NOT_AVAILABLE'
                      ? 'Media Unavailable Notice'
                      : activeJob.errorCode === 'INVALID_SOURCE_URL' || activeJob.errorCode === 'INVALID_URL'
                      ? 'Invalid URL Notice'
                      : 'Source Extraction Notice'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-200 dark:bg-rose-900/80 text-rose-900 dark:text-rose-200">
                    {activeJob.errorCode || 'EXTRACTION_FAILED'}
                  </span>
                </div>
                <p className="leading-relaxed text-xs text-rose-800 dark:text-rose-300 font-medium">
                  {activeJob.errorMessage && activeJob.errorMessage !== 'undefined' && activeJob.errorMessage.trim().length > 0
                    ? activeJob.errorMessage
                    : activeJob.errorCode === 'UPSTREAM_BOT_VERIFICATION_REQUIRED'
                    ? 'Unable to fetch this video right now. The video service or source platform requires additional verification. Please try another supported URL.'
                    : 'Media processing failed during extraction. Please verify the URL or try another source.'}
                </p>
                {activeJob.errorCode === 'UPSTREAM_BOT_VERIFICATION_REQUIRED' && (
                  <div className="space-y-1 mt-1">
                    <p className="text-[11px] text-rose-700 dark:text-rose-400/90 leading-normal">
                      🛡️ <em>Security Notice:</em> In compliance with platform security policies, bot detection is not bypassed and no fallback or placeholder video was generated.
                    </p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-normal">
                      💡 <em>Setup Requirement:</em> Cloud hosting environments require authentic session cookies for YouTube downloads. Please configure <code>cookies.txt</code> or set <code>YTDLP_COOKIES</code> with your Netscape cookie export (see <code>docs/COOKIES_SETUP.md</code>).
                    </p>
                  </div>
                )}

                {/* Quick 1-click test open sample */}
                <div className="pt-2 border-t border-rose-200/80 dark:border-rose-800/60 mt-2">
                  <span className="text-[11px] font-semibold text-rose-900 dark:text-rose-200 block mb-1.5">
                    Try one of our verified open media streams:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {SAMPLE_URLS.slice(0, 3).map((sample, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleTrySample(sample.url, sample.name)}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-rose-200 dark:border-rose-800/80 text-[11px] font-medium transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <PlayCircle className="w-3 h-3 text-blue-500" />
                        <span>{sample.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 mb-4 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${activeJob.progress >= 20 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
              <span>1. Demuxing input stream container & stream headers</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${activeJob.progress >= 50 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
              <span>2. Transcoding audio/video codecs ({activeJob.selectedQuality})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${activeJob.progress >= 80 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
              <span>3. Lossless moov atom packaging & temporary signed token generation</span>
            </div>
          </div>
        )}

        {/* Active Job Debugger Panel (Development Only) */}
        {import.meta.env.DEV && <ActiveJobDebugPanel activeJob={activeJob} className="mb-5" />}

        {/* Modal Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {isProcessing && (
            <button
              id="cancel-job-btn"
              onClick={cancelActiveJob}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel Job
            </button>
          )}

          {isReady && (
            <button
              id="download-file-ready-btn"
              disabled={isRequestingDownload}
              onClick={handleDownloadFile}
              className="w-full py-3 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-75 disabled:cursor-not-allowed text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
            >
              {isRequestingDownload ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Secure Link...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Save {activeJob.selectedFormat.toUpperCase()} ({activeJob.selectedQuality})</span>
                </>
              )}
            </button>
          )}

          {(isCancelled || isFailed) && (
            <button
              onClick={() => setJobModalOpen(false)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
