import React, { useState } from 'react';
import {
  User,
  Clock,
  Download,
  Trash2,
  HardDrive,
  Sparkles,
  Layers,
  CheckCircle2,
  Activity,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { downloadMediaFile, sanitizeFilename } from '../utils/download';

export const DashboardView: React.FC = () => {
  const { downloadHistory, clearHistory, activeJob, setJobModalOpen, setRoute, addToast } = useApp();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = (id: string, url?: string) => {
    const rawLink = url || `/api/download/file/temp/${id}/media.mp4`;
    const link = rawLink.startsWith('http') ? rawLink : `${window.location.origin}${rawLink}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    addToast('info', 'Link Copied', 'Authorized download URL copied.');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDownloadItem = async (item: any) => {
    if (!item.downloadUrl) return;
    try {
      const filename = sanitizeFilename(item.mediaTitle, item.selectedQuality, item.selectedFormat);
      await downloadMediaFile({
        downloadUrl: item.downloadUrl,
        filename,
        expectedMimeType: item.selectedFormat === 'mp3' ? 'audio/mpeg' : 'video/mp4',
      });
      addToast('success', 'Download Started', `${filename} saved.`);
    } catch (err: any) {
      addToast('error', 'Download Error', err.message || 'Failed to download file.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* User Header Profile Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-blue-900/15 via-indigo-900/10 to-transparent border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-2xl shadow-md">
            U
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                Creator Workspace
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Verified Account
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Local media session & ephemeral download management
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 sm:gap-6 text-xs text-slate-500">
          <div className="text-center sm:text-right">
            <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              {downloadHistory.length}
            </div>
            <span>Saved Streams</span>
          </div>
          <div className="text-center sm:text-right">
            <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
              Active
            </div>
            <span>Queue Health</span>
          </div>
        </div>
      </div>

      {/* Active Job Alert Card (if any background worker is active) */}
      {activeJob && (
        <div className="p-5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
            <div>
              <div className="text-xs font-bold text-blue-900 dark:text-blue-200">
                Active Processing Task: {activeJob.mediaTitle}
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-400">
                {activeJob.stepMessage} ({activeJob.progress}%)
              </div>
            </div>
          </div>
          <button
            onClick={() => setJobModalOpen(true)}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
          >
            Open Monitor
          </button>
        </div>
      )}

      {/* Quick Tool Launchers */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Quick Utilities
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => setRoute('/video-to-mp3')}
            className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-left transition-all group"
          >
            <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
              Audio Extractor
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">320 kbps MP3</div>
          </button>

          <button
            onClick={() => setRoute('/video-to-mp4')}
            className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-left transition-all group"
          >
            <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
              MP4 Downloader
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">1080p & 4K Quality</div>
          </button>

          <button
            onClick={() => setRoute('/video-trimmer')}
            className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-left transition-all group"
          >
            <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
              Video Trimmer
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Keyframe range cutter</div>
          </button>

          <button
            onClick={() => setRoute('/thumbnail-downloader')}
            className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-left transition-all group"
          >
            <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
              HD Thumbnails
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Original dimensions</div>
          </button>
        </div>
      </div>

      {/* Download History Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              Recent Media Conversions
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              History stored locally in your browser. Download tokens expire after 15 minutes.
            </p>
          </div>

          {downloadHistory.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs text-rose-600 hover:text-rose-500 dark:text-rose-400 flex items-center gap-1 font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {downloadHistory.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <HardDrive className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No recent downloads in this session
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Analyze and convert media using any tool to see your export logs and temporary download links here.
            </p>
            <button
              onClick={() => setRoute('/')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white"
            >
              Convert Media Now
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {downloadHistory.map(item => (
              <div
                key={item.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-14 aspect-video object-cover rounded-lg bg-slate-950 shrink-0"
                    />
                  ) : (
                    <div className="w-14 aspect-video rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4 text-slate-400" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                      {item.mediaTitle}
                    </h4>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="font-mono uppercase font-bold text-blue-600 dark:text-blue-400">
                        {item.selectedFormat}
                      </span>
                      <span>•</span>
                      <span>{item.selectedQuality}</span>
                      <span>•</span>
                      <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    onClick={() => handleCopyLink(item.id, item.downloadUrl)}
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Copy Temporary Link"
                  >
                    {copiedId === item.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>

                  {item.downloadUrl && (
                    <button
                      type="button"
                      onClick={() => handleDownloadItem(item)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
