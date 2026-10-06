import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`pointer-events-auto p-4 rounded-xl border shadow-xl flex items-start gap-3 backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-2 ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-100 border-emerald-800'
              : toast.type === 'error'
              ? 'bg-rose-950/90 text-rose-100 border-rose-800'
              : 'bg-slate-900/90 text-slate-100 border-slate-700'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />}

          <div className="flex-1 min-w-0">
            <div className="text-xs sm:text-sm font-bold">{toast.title}</div>
            {toast.description && (
              <div className="text-xs opacity-80 mt-0.5 leading-relaxed">{toast.description}</div>
            )}
          </div>

          <button
            onClick={() => removeToast(toast.id)}
            className="p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export const CookieBanner: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(() => {
    return !localStorage.getItem('mf_cookie_consent');
  });

  const handleAccept = () => {
    localStorage.setItem('mf_cookie_consent', 'accepted');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-40 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in slide-in-from-bottom-4">
      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
        Privacy & Essential Cookies
      </h4>
      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
        MediaForge uses anonymous local storage for theme, language preferences, and rate-limiting metrics. We do not track personal identities or store unauthorized media.
      </p>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={handleAccept}
          className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
        >
          Accept & Continue
        </button>
      </div>
    </div>
  );
};
