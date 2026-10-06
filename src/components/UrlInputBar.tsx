import React from 'react';
import {
  Search,
  ClipboardPaste,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  ShieldAlert,
  PlayCircle,
} from 'lucide-react';
import { useApp, SAMPLE_URLS } from '../context/AppContext';

interface UrlInputBarProps {
  customHeading?: string;
  customSubtitle?: string;
  hideSamples?: boolean;
}

export const UrlInputBar: React.FC<UrlInputBarProps> = ({
  customHeading,
  customSubtitle,
  hideSamples = false,
}) => {
  const {
    currentUrl,
    setCurrentUrl,
    analyzeUrl,
    isAnalyzing,
    analyzeError,
    t,
    addToast,
  } = useApp();

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCurrentUrl(text);
        addToast('info', 'Pasted from clipboard', text.substring(0, 40) + (text.length > 40 ? '...' : ''));
      }
    } catch {
      addToast('error', 'Clipboard access denied', 'Please paste the URL manually using Ctrl+V / Cmd+V.');
    }
  };

  const handleClear = () => {
    setCurrentUrl('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUrl.trim()) return;
    analyzeUrl(currentUrl);
  };

  const handleLoadSample = (sampleUrl: string, sampleName: string) => {
    setCurrentUrl(sampleUrl);
    analyzeUrl(sampleUrl);
    addToast('info', 'Loaded Sample Media', sampleName);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Optional Custom Headings */}
      {customHeading && (
        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
            {customHeading}
          </h1>
          {customSubtitle && (
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              {customSubtitle}
            </p>
          )}
        </div>
      )}

      {/* Main Input Form Card */}
      <form onSubmit={handleSubmit} className="relative group">
        <div className="relative flex flex-col sm:flex-row items-stretch bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/60 dark:shadow-black/50 border border-slate-200 dark:border-slate-800 overflow-hidden p-1.5 focus-within:ring-2 ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
          {/* Input field */}
          <div className="relative flex-1 w-full flex items-center px-2 sm:px-3 py-1">
            <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 mr-2 sm:mr-3 shrink-0" />
            <input
              id="main-url-input"
              type="text"
              value={currentUrl}
              onChange={e => setCurrentUrl(e.target.value)}
              placeholder={t.urlPlaceholder}
              aria-label="Media URL input"
              className="w-full py-2.5 text-sm sm:text-base bg-transparent text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
            />
            {/* Clear Button */}
            {currentUrl && (
              <button
                type="button"
                id="clear-url-input-btn"
                onClick={handleClear}
                title={t.clearBtn}
                className="p-1.5 mr-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {/* Paste Button */}
            <button
              type="button"
              id="paste-url-btn"
              onClick={handlePaste}
              title={t.pasteBtn}
              className="flex items-center gap-1 px-3 py-1.5 mr-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors shrink-0"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.pasteBtn}</span>
            </button>
          </div>

          {/* Primary Action Button */}
          <button
            type="submit"
            id="analyze-submit-btn"
            disabled={isAnalyzing || !currentUrl.trim()}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold tracking-wide text-sm bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 shrink-0 transition-all duration-200"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t.analyzingBtn}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 fill-current" />
                <span>{t.analyzeBtn}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Geometric Sub-actions Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        <button
          type="button"
          onClick={handlePaste}
          className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <div className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
          <span>PASTE FROM CLIPBOARD</span>
        </button>
        {currentUrl && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 hover:text-rose-500 transition-colors"
          >
            <div className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
            <span>CLEAR INPUT</span>
          </button>
        )}
        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <div className="w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-pulse" />
          <span>AUTONOMOUS STREAM VERIFIER</span>
        </div>
      </div>

      {/* Error Alert Message */}
      {analyzeError && (
        <div className="mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-sm text-rose-800 dark:text-rose-300 flex items-start gap-3 animate-in fade-in duration-150">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold mb-0.5">Media Analysis Notice</div>
            <div>{analyzeError}</div>
          </div>
        </div>
      )}

      {/* Trust Notice Bar */}
      <div className="mt-3.5 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 text-center px-2">
        <ShieldAlert className="w-4 h-4 text-blue-500 shrink-0" />
        <span>{t.trustNotice}</span>
      </div>

      {/* 1-Click Quick Sample Testing Links */}
      {!hideSamples && (
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-1.5 justify-center sm:justify-start">
            <PlayCircle className="w-3.5 h-3.5 text-blue-500" />
            <span>{t.sampleLinks}:</span>
          </div>
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {SAMPLE_URLS.map((sample, idx) => (
              <button
                key={idx}
                id={`sample-btn-${idx}`}
                type="button"
                onClick={() => handleLoadSample(sample.url, sample.name)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 hover:border-blue-400 dark:hover:border-blue-500 transition-all flex items-center gap-1.5"
              >
                <span className={`w-2 h-2 rounded-full ${sample.type === 'audio' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                <span>{sample.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
