import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import confetti from 'canvas-confetti';
import {
  AppRoute,
  LanguageCode,
  ThemeMode,
  ClientMediaMetadata,
  ActiveJobState,
  ToastMessage,
  ClientMediaFormat,
} from '../types';
import { translations, TranslationDict } from '../i18n/translations';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  tier?: 'free' | 'pro';
}

interface AppContextType {
  route: AppRoute;
  setRoute: (route: AppRoute) => void;
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: TranslationDict;
  isRtl: boolean;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  // Authentication & Session
  user: AuthUser | null;
  authToken: string | null;
  userRole: 'guest' | 'user' | 'admin';
  setUserRole: (role: 'guest' | 'user' | 'admin') => void;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  // Analysis & Jobs
  currentUrl: string;
  setCurrentUrl: (url: string) => void;
  metadata: ClientMediaMetadata | null;
  setMetadata: (meta: ClientMediaMetadata | null) => void;
  isAnalyzing: boolean;
  analyzeError: string | null;
  analyzeUrl: (urlToAnalyze?: string) => Promise<boolean>;
  activeJob: ActiveJobState | null;
  isJobModalOpen: boolean;
  setJobModalOpen: (open: boolean) => void;
  startDownload: (params: {
    format: ClientMediaFormat | { format: string; quality: string; fileSizeBytes?: number; fileSizeFormatted?: string; directUrl?: string };
    formatType?: 'video' | 'audio' | 'trim' | 'thumbnail' | 'subtitle';
    trimParams?: { startTime: number; endTime: number };
  }) => Promise<void>;
  cancelActiveJob: () => Promise<void>;
  // Toasts
  toasts: ToastMessage[];
  addToast: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
  removeToast: (id: string) => void;
  // Recent history
  recentJobs: ActiveJobState[];
  deleteRecentJob: (id: string) => void;
  downloadHistory: ActiveJobState[];
  clearHistory: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const SAMPLE_URLS = [
  {
    name: 'Big Buck Bunny (Open Animation HD)',
    url: 'https://raw.githubusercontent.com/mediaelement/mediaelement-files/master/big_buck_bunny.mp4',
    type: 'video',
  },
  {
    name: 'Echo Here We Are (Open Video Demo)',
    url: 'https://raw.githubusercontent.com/mediaelement/mediaelement-files/master/echo-hereweare.mp4',
    type: 'video',
  },
  {
    name: 'Wikimedia 4K VP9 Transcode (WebM)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.360p.vp9.webm',
    type: 'video',
  },
  {
    name: 'Creative Commons Orchestra Symphony (MP3)',
    url: 'https://cdn.freesound.org/previews/573/573381_5674468-lq.mp3',
    type: 'audio',
  },
  {
    name: 'YouTube Preview',
    url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    type: 'video',
  },
];

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [route, setRouteState] = useState<AppRoute>(() => {
    const path = window.location.pathname as AppRoute;
    const validRoutes: AppRoute[] = [
      '/',
      '/video-downloader',
      '/online-video-downloader',
      '/4k-video-downloader',
      '/hd-video-downloader',
      '/audio-downloader',
      '/video-to-mp3',
      '/video-converter',
      '/video-to-mp4',
      '/thumbnail-downloader',
      '/subtitle-downloader',
      '/video-trimmer',
      '/youtube-downloader',
      '/youtube-video-downloader',
      '/youtube-shorts-downloader',
      '/tiktok-video-downloader',
      '/instagram-video-downloader',
      '/x-video-downloader',
      '/vimeo-video-downloader',
      '/pinterest-video-downloader',
      '/bilibili-video-downloader',
      '/supported-platforms',
      '/how-it-works',
      '/faq',
      '/blog',
      '/about',
      '/contact',
      '/privacy',
      '/privacy-policy',
      '/terms',
      '/copyright',
      '/dmca',
      '/security',
      '/changelog',
      '/status',
      '/dashboard',
      '/admin',
      '/admin/jobs',
      '/admin/users',
      '/admin/reports',
      '/admin/settings',
    ];
    if (validRoutes.includes(path) || path.startsWith('/blog/')) {
      return path;
    }
    return '/';
  });

  const setRoute = (newRoute: AppRoute) => {
    setRouteState(newRoute);
    window.history.pushState({}, '', newRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handlePopState = () => {
      setRouteState((window.location.pathname as AppRoute) || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Theme
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('mf_theme') as ThemeMode;
    return saved || 'dark'; // Defaulting to sleek dark theme
  });

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('mf_theme', newTheme);
  };

  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Language & RTL
  const [lang, setLangState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('mf_lang') as LanguageCode;
    return saved || 'en';
  });

  const setLang = (newLang: LanguageCode) => {
    setLangState(newLang);
    localStorage.setItem('mf_lang', newLang);
  };

  const isRtl = lang === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang, isRtl]);

  const t = translations[lang] || translations.en;

  // Authentication State
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('mf_token') || null;
  });
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);

  // Initialize and verify session on load
  useEffect(() => {
    const savedToken = localStorage.getItem('mf_token');
    if (!savedToken) return;

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.success && data.data?.user) {
          setUser(data.data.user);
        } else {
          localStorage.removeItem('mf_token');
          setAuthToken(null);
          setUser(null);
        }
      })
      .catch(() => {
        // Network offline or failed check
      });
  }, []);

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error?.message || 'Login failed.' };
      }

      const { token, user: loggedUser } = data.data;
      setAuthToken(token);
      setUser(loggedUser);
      localStorage.setItem('mf_token', token);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during login.' };
    }
  };

  const logout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('mf_token');
    setAuthToken(null);
    setUser(null);
  };

  const userRole = user?.role || 'guest';
  const setUserRole = (role: 'guest' | 'user' | 'admin') => {
    if (role === 'guest') {
      logout();
    } else if (role === 'admin') {
      login('alex.morgan@example.com');
    } else {
      login('sarah.c@example.com');
    }
  };

  // Media Analysis State
  const [currentUrl, setCurrentUrl] = useState('');
  const [metadata, setMetadata] = useState<ClientMediaMetadata | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Active Job State
  const [activeJob, setActiveJob] = useState<ActiveJobState | null>(null);
  const [isJobModalOpen, setJobModalOpen] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', title: string, description?: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Recent History Store
  const [recentJobs, setRecentJobs] = useState<ActiveJobState[]>(() => {
    try {
      const saved = localStorage.getItem('mf_recent_jobs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const deleteRecentJob = (id: string) => {
    setRecentJobs((prev) => {
      const updated = prev.filter((j) => j.id !== id);
      localStorage.setItem('mf_recent_jobs', JSON.stringify(updated));
      return updated;
    });
  };

  const clearHistory = () => {
    setRecentJobs([]);
    localStorage.removeItem('mf_recent_jobs');
  };

  // Analyze URL Function
  const analyzeUrl = async (urlToAnalyze?: string): Promise<boolean> => {
    const targetUrl = (urlToAnalyze !== undefined ? urlToAnalyze : currentUrl).trim();
    if (!targetUrl) {
      setAnalyzeError('Please enter or paste a valid media URL.');
      return false;
    }

    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const errorMsg =
          data.error?.message && data.error.message !== 'undefined'
            ? data.error.message
            : data.error?.code === 'UPSTREAM_BOT_VERIFICATION_REQUIRED'
            ? 'Unable to fetch this video right now. The video service or source platform requires additional verification. Please try another supported URL.'
            : 'Unable to process this URL. Please check the link.';
        setAnalyzeError(errorMsg);
        addToast('error', 'Analysis Failed', errorMsg);
        setIsAnalyzing(false);
        return false;
      }

      setMetadata(data.data);
      addToast('success', 'Media Analyzed', `Found ${data.data.formats.length} permitted formats.`);
      setIsAnalyzing(false);
      return true;
    } catch (err: any) {
      const msg =
        err?.message && err.message !== 'undefined'
          ? err.message
          : 'Network error occurred while connecting to media provider.';
      setAnalyzeError(msg);
      addToast('error', 'Connection Error', msg);
      setIsAnalyzing(false);
      return false;
    }
  };

  // Start Download Function
  const startDownload = async ({
    format,
    formatType = 'video',
    trimParams,
  }: {
    format: ClientMediaFormat | { format: string; quality: string; fileSizeBytes?: number; fileSizeFormatted?: string; directUrl?: string };
    formatType?: 'video' | 'audio' | 'trim' | 'thumbnail' | 'subtitle';
    trimParams?: { startTime: number; endTime: number };
  }) => {
    if (!metadata) return;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch('/api/download', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sourceUrl: metadata.sourceUrl,
          provider: metadata.provider,
          mediaTitle: metadata.title,
          thumbnailUrl: metadata.thumbnail,
          selectedFormat: format.format,
          selectedQuality: format.quality,
          formatType,
          fileSizeBytes: format.fileSizeBytes,
          fileSizeFormatted: format.fileSizeFormatted,
          directUrl: format.directUrl,
          trimParams,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        addToast('error', 'Download Failed', data.error?.message || 'Could not queue media processing.');
        return;
      }

      const initialJob: ActiveJobState = {
        id: data.data.jobId,
        status: data.data.status,
        progress: data.data.progress,
        stepMessage: data.data.stepMessage,
        mediaTitle: metadata.title,
        selectedFormat: format.format,
        selectedQuality: format.quality,
        thumbnailUrl: metadata.thumbnail,
        fileSizeFormatted: format.fileSizeFormatted,
      };

      setActiveJob(initialJob);
      setJobModalOpen(true);

      // Start Polling for Job Completion
      pollJobStatus(data.data.jobId);
    } catch (err: any) {
      addToast('error', 'Download Error', err.message || 'Failed to start media job.');
    }
  };

  // Polling Loop for Job Status
  const pollJobStatus = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const headers: Record<string, string> = {};
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const res = await fetch(`/api/jobs/${jobId}`, { headers });
        const data = await res.json();
        if (!res.ok || !data.success) {
          clearInterval(interval);
          return;
        }

        const job = data.data;
        if (job && job.status === 'FAILED') {
          if (!job.errorMessage || job.errorMessage === 'undefined' || job.errorMessage.trim() === '') {
            job.errorMessage =
              job.errorCode === 'UPSTREAM_BOT_VERIFICATION_REQUIRED'
                ? 'Unable to fetch this video right now. The video service or source platform requires additional verification. Please try another supported URL.'
                : 'Media processing failed during extraction.';
          }
          if (!job.stepMessage || job.stepMessage === 'undefined' || job.stepMessage.trim() === '') {
            job.stepMessage = job.errorMessage;
          }
        }
        setActiveJob((prev) => (prev ? { ...prev, ...job } : job));

        if (job.status === 'READY') {
          clearInterval(interval);
          try {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.7 },
            });
          } catch {
            // Ignore confetti errors
          }

          setRecentJobs((prev) => {
            const exists = prev.some((j) => j.id === job.id);
            const next = exists ? prev.map((j) => (j.id === job.id ? job : j)) : [job, ...prev.slice(0, 19)];
            localStorage.setItem('mf_recent_jobs', JSON.stringify(next));
            return next;
          });

          addToast('success', 'Ready for download', `${job.mediaTitle} (${job.selectedQuality}) is prepared.`);
        } else if (job.status === 'FAILED' || job.status === 'CANCELLED' || job.status === 'EXPIRED') {
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 600);
  };

  const cancelActiveJob = async () => {
    if (!activeJob) return;
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      await fetch(`/api/jobs/${activeJob.id}/cancel`, { method: 'POST', headers });
      setActiveJob((prev) => (prev ? { ...prev, status: 'CANCELLED', stepMessage: 'Cancelled by user.' } : null));
      addToast('info', 'Job Cancelled', 'Processing was stopped.');
    } catch {
      // Ignored
    }
  };

  return (
    <AppContext.Provider
      value={{
        route,
        setRoute,
        lang,
        setLang,
        t,
        isRtl,
        theme,
        setTheme,
        user,
        authToken,
        userRole,
        setUserRole,
        login,
        logout,
        isAuthModalOpen,
        setAuthModalOpen,
        currentUrl,
        setCurrentUrl,
        metadata,
        setMetadata,
        isAnalyzing,
        analyzeError,
        analyzeUrl,
        activeJob,
        isJobModalOpen,
        setJobModalOpen,
        startDownload,
        cancelActiveJob,
        toasts,
        addToast,
        removeToast,
        recentJobs,
        deleteRecentJob,
        downloadHistory: recentJobs,
        clearHistory,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
