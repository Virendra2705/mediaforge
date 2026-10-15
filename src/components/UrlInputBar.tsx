import React from 'react';
import {
  Search,
  ClipboardPaste,
  Check,
  X,
  Link2,
  Sparkles,
  Loader2,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
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
  const [pasteConfirmed, setPasteConfirmed] = React.useState(false);
  const [pasteReceiving, setPasteReceiving] = React.useState(false);
  const [inputJustUpdated, setInputJustUpdated] = React.useState(false);
  const [analysisSucceeded, setAnalysisSucceeded] = React.useState(false);
  const [urlFormatError, setUrlFormatError] = React.useState('');
  const pasteTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (pasteTimer.current) clearTimeout(pasteTimer.current);
    if (updateTimer.current) clearTimeout(updateTimer.current);
    if (successTimer.current) clearTimeout(successTimer.current);
  }, []);

  const isHttpUrl = (value: string) => {
    try {
      const parsed = new URL(value.trim());
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !!parsed.hostname;
    } catch {
      return false;
    }
  };

  const showInputArrival = () => {
    setInputJustUpdated(true);
    if (updateTimer.current) clearTimeout(updateTimer.current);
    updateTimer.current = setTimeout(() => setInputJustUpdated(false), 680);
  };

  const runAnalysis = async (url: string) => {
    setAnalysisSucceeded(false);
    const succeeded = await analyzeUrl(url);
    if (succeeded) {
      setAnalysisSucceeded(true);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setAnalysisSucceeded(false), 1300);
    }
  };

  const handlePaste = async () => {
    if (pasteTimer.current) clearTimeout(pasteTimer.current);
    pasteTimer.current = null;
    setPasteConfirmed(false);
    setPasteReceiving(false);
    if (!navigator.clipboard?.readText) {
      addToast('error', 'Clipboard unavailable', 'Paste the link into the field using your keyboard.');
      return;
    }
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        addToast('info', 'Clipboard is empty', 'Copy a supported media link, then try again.');
        return;
      }
      if (!isHttpUrl(text)) {
        addToast('error', 'Clipboard does not contain a link', 'Copy a complete http or https media URL, or paste it into the field manually.');
        return;
      }
      setCurrentUrl(text);
      setUrlFormatError('');
      setAnalysisSucceeded(false);
      showInputArrival();
      setPasteReceiving(true);
      if (pasteTimer.current) clearTimeout(pasteTimer.current);
      pasteTimer.current = setTimeout(() => {
        setPasteReceiving(false);
        setPasteConfirmed(true);
        pasteTimer.current = setTimeout(() => setPasteConfirmed(false), 1480);
      }, 220);
      addToast('success', 'Link added — you’re ready', 'The URL is in the input field.');
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      addToast('error', denied ? 'Clipboard permission denied' : 'Could not read clipboard', 'Paste the URL into the field using Ctrl+V / Cmd+V.');
    }
  };

  const handleClear = () => {
    setCurrentUrl('');
    setUrlFormatError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUrl.trim()) return;
    if (!isHttpUrl(currentUrl)) {
      setUrlFormatError('Enter a complete link starting with http:// or https://.');
      document.getElementById('main-url-input')?.focus();
      return;
    }
    setUrlFormatError('');
    void runAnalysis(currentUrl);
  };

  const handleLoadSample = (sampleUrl: string, sampleName: string) => {
    setCurrentUrl(sampleUrl);
    setUrlFormatError('');
    void runAnalysis(sampleUrl);
    addToast('info', 'Loaded Sample Media', sampleName);
  };

  return (
    <div className="vf-url-form w-full max-w-4xl mx-auto">
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
      <form onSubmit={handleSubmit} className="relative group vf-url-form-shell">
        <div className={`vf-url-control relative flex flex-col sm:flex-row items-stretch overflow-hidden p-1.5 ${inputJustUpdated ? 'vf-url-pasted' : ''} ${analyzeError || urlFormatError ? 'vf-url-invalid' : ''}`}>
          {/* Input field */}
          <div className="relative flex-1 w-full flex items-center px-2 sm:px-3 py-1">
            {currentUrl.trim() && isHttpUrl(currentUrl)
              ? <Link2 aria-hidden="true" className="vf-url-search vf-url-valid-icon w-5 h-5 mr-2 sm:mr-3 shrink-0" />
              : <Search aria-hidden="true" className="vf-url-search w-5 h-5 mr-2 sm:mr-3 shrink-0 transition-colors group-focus-within:text-indigo-500" />}
            <label className="sr-only" htmlFor="main-url-input">Media URL</label>
            <input
              id="main-url-input"
              name="mediaUrl"
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={currentUrl}
              onChange={e => { setCurrentUrl(e.target.value); setUrlFormatError(''); setAnalysisSucceeded(false); }}
              placeholder={t.urlPlaceholder || 'Paste a video or audio link…'}
              aria-describedby={urlFormatError ? 'url-format-error' : analyzeError ? 'url-error' : 'url-help'}
              className="vf-url-input w-full py-2.5 bg-transparent outline-none transition-colors"
            />
            {/* Clear Button */}
            {currentUrl && (
              <button
                type="button"
                id="clear-url-input-btn"
                onClick={handleClear}
                title={t.clearBtn}
                aria-label="Clear URL"
                className="p-1.5 mr-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 vf-btn-tactile"
              >
                <X className="w-4 h-4 vf-clear-icon" />
              </button>
            )}
            {/* Paste Button */}
            <button
              type="button"
              id="paste-url-btn"
              onClick={handlePaste}
              title={t.pasteBtn}
              aria-label={t.pasteBtn}
              className={`vf-paste-button flex items-center gap-1 px-3 py-1.5 mr-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 vf-btn-tactile shrink-0 ${pasteReceiving ? 'vf-paste-receiving' : ''} ${pasteConfirmed ? 'vf-paste-confirmed' : ''}`}
            >
              {pasteConfirmed ? <Check className="w-3.5 h-3.5 vf-feedback-check" /> : <ClipboardPaste className={`w-3.5 h-3.5 vf-clipboard-icon ${pasteReceiving ? 'is-receiving' : ''}`} />}
              <span className="hidden sm:inline">{t.pasteBtn}</span>
            </button>
          </div>

          {/* Primary Action Button */}
          <button
            type="submit"
            id="analyze-submit-btn"
            disabled={isAnalyzing || !currentUrl.trim()}
            data-state={isAnalyzing ? 'analyzing' : analysisSucceeded ? 'success' : analyzeError || urlFormatError ? 'error' : 'idle'}
            className="vf-submit w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold tracking-wide text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0 vf-btn-tactile"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing link…</span>
              </>
            ) : analysisSucceeded ? (
              <><Check className="w-4 h-4 vf-feedback-check" /><span>Link analyzed</span></>
            ) : (
              <>
                <Sparkles className="w-4 h-4 fill-current transition-transform group-hover:scale-110" />
                <span>{t.analyzeBtn}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Calm Secondary Actions Bar */}
      <div className="vf-url-utilities mt-3.5 flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs font-medium">
        <button
          aria-label="Paste URL from clipboard"
          type="button"
          onClick={handlePaste}
          className={`vf-paste-button flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 vf-btn-tactile transition-colors ${pasteReceiving ? 'vf-paste-receiving' : ''} ${pasteConfirmed ? 'vf-paste-confirmed' : ''}`}
        >
          {pasteConfirmed ? <Check className="w-3.5 h-3.5 vf-feedback-check" /> : <ClipboardPaste className={`w-3.5 h-3.5 vf-clipboard-icon ${pasteReceiving ? 'is-receiving' : ''}`} />}
          <span>{pasteConfirmed ? 'Link added' : 'Paste Clipboard'}</span>
        </button>
        {currentUrl && (
          <>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1.5 hover:text-rose-500 vf-btn-tactile transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Input</span>
            </button>
          </>
        )}
        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
          <span>Direct Stream Inspection</span>
        </div>
      </div>
      {pasteConfirmed && <div className="vf-paste-confirmation" role="status" aria-live="polite">Link added — you’re ready.</div>}

      {urlFormatError && !analyzeError && (
        <div id="url-format-error" role="alert" className="vf-url-error mt-4 p-4 rounded-xl text-sm flex items-start gap-3 vf-fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div><div className="font-semibold mb-0.5">Check the link format</div><div>{urlFormatError}</div></div>
        </div>
      )}

      {/* Server analysis feedback */}
      {analyzeError && (
        <div id="url-error" role="alert" className="vf-url-error mt-4 p-4 rounded-xl text-sm flex items-start gap-3 vf-fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold mb-0.5">Media Analysis Notice</div>
            <div>{analyzeError}</div>
          </div>
        </div>
      )}

      {/* Trust Notice Bar */}
      <div id="url-help" className="vf-url-trust mt-3.5 flex items-center justify-center gap-2 text-xs text-center px-2">
        <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
        <span>{t.trustNotice}</span>
      </div>

      {/* 1-Click Quick Sample Testing Links */}
      {!hideSamples && (
        <div className="vf-sample-links mt-6 pt-5">
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
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 hover:border-blue-400 dark:hover:border-blue-500 vf-btn-tactile hover:-translate-y-0.5 flex items-center gap-1.5"
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
