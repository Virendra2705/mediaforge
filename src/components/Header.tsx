import React, { useState } from 'react';
import {
  Zap,
  Music,
  Video,
  Scissors,
  Image as ImageIcon,
  FileText,
  Globe,
  Sun,
  Moon,
  Menu,
  X,
  ShieldCheck,
  ChevronDown,
  Activity,
  LayoutDashboard,
  Lock,
  Layers,
  BookOpen,
  Key,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AppRoute, LanguageCode } from '../types';

export const Header: React.FC = () => {
  const { route, setRoute, lang, setLang, t, isRtl, theme, setTheme, user, setAuthModalOpen } = useApp();
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const languages: { code: LanguageCode; label: string; flag: string }[] = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
    { code: 'pt', label: 'Português', flag: '🇧🇷' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'ko', label: '한국어', flag: '🇰🇷' },
    { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  ];

  const handleNav = (targetRoute: AppRoute) => {
    setRoute(targetRoute);
    setIsToolsOpen(false);
    setIsMobileMenuOpen(false);
  };

  const isActive = (r: AppRoute) => route === r;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <button
            id="brand-logo-btn"
            onClick={() => handleNav('/')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-sm group-hover:bg-indigo-700 transition-colors">
              <div className="w-4 h-4 bg-white rounded-sm transform rotate-45" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                Media<span className="text-indigo-600 dark:text-indigo-400">Forge</span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  v2.4
                </span>
              </span>
              <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Authorized Media Processing
              </p>
            </div>
          </button>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          <button
            id="nav-video-dl"
            onClick={() => handleNav('/youtube-downloader')}
            className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
              isActive('/youtube-downloader')
                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Video className="w-4 h-4 text-indigo-500" />
              {t.navVideoDownloader}
            </span>
          </button>

          <button
            id="nav-mp3-btn"
            onClick={() => handleNav('/video-to-mp3')}
            className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
              isActive('/video-to-mp3')
                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Music className="w-4 h-4 text-emerald-500" />
              {t.navMp3}
            </span>
          </button>

          <button
            id="nav-mp4-btn"
            onClick={() => handleNav('/video-to-mp4')}
            className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
              isActive('/video-to-mp4')
                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t.navMp4}
          </button>

          {/* Tools Dropdown */}
          <div className="relative">
            <button
              id="nav-tools-dropdown-btn"
              onClick={() => setIsToolsOpen(!isToolsOpen)}
              className="px-3.5 py-2 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
            >
              <Layers className="w-4 h-4 text-indigo-500" />
              {t.navTools}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isToolsOpen ? 'rotate-180' : ''}`} />
            </button>

            {isToolsOpen && (
              <div
                className={`absolute top-full mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100 ${
                  isRtl ? 'left-0' : 'right-0'
                }`}
              >
                <button
                  id="tool-thumbnail-btn"
                  onClick={() => handleNav('/thumbnail-downloader')}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                >
                  <ImageIcon className="w-4 h-4 text-pink-500" />
                  <div>
                    <div className="font-medium">{t.navThumbnails}</div>
                    <div className="text-xs text-slate-400">HD & 4K Image extraction</div>
                  </div>
                </button>

                <button
                  id="tool-subtitle-btn"
                  onClick={() => handleNav('/subtitle-downloader')}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                >
                  <FileText className="w-4 h-4 text-cyan-500" />
                  <div>
                    <div className="font-medium">{t.navSubtitles}</div>
                    <div className="text-xs text-slate-400">SRT, VTT & TXT transcripts</div>
                  </div>
                </button>

                <button
                  id="tool-trimmer-btn"
                  onClick={() => handleNav('/video-trimmer')}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                >
                  <Scissors className="w-4 h-4 text-indigo-500" />
                  <div>
                    <div className="font-medium">{t.navTrimmer}</div>
                    <div className="text-xs text-slate-400">Cut & export clips</div>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                <button
                  id="tool-platforms-btn"
                  onClick={() => handleNav('/supported-platforms')}
                  className="w-full px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                  {t.navPlatforms}
                </button>
              </div>
            )}
          </div>

          <button
            id="nav-blog-btn"
            onClick={() => handleNav('/blog')}
            className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
              route.startsWith('/blog')
                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              {t.navBlog}
            </span>
          </button>
        </nav>

        {/* Right Side Utility Actions */}
        <div className="flex items-center gap-3">
          {/* Online status indicator */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>System Status: Online</span>
          </div>

          {/* User Mode & Dashboard Quick Switch */}
          <button
            id="user-dashboard-btn"
            onClick={() => handleNav('/dashboard')}
            title="User Dashboard"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-indigo-500" />
            <span>{t.navDashboard}</span>
          </button>

          {/* Admin Switcher */}
          {user?.role === 'admin' && (
            <button
              id="admin-console-btn"
              onClick={() => handleNav('/admin')}
              title="Open Admin Console"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Admin Console</span>
            </button>
          )}

          {/* Session Profile / Sign In */}
          <button
            id="auth-session-btn"
            onClick={() => setAuthModalOpen(true)}
            title={user ? `Signed in as ${user.name}` : 'Sign In'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              user
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{user ? user.name.split(' ')[0] : 'Sign In'}</span>
          </button>

          {/* Language Selector Dropdown */}
          <div className="relative">
            <button
              id="lang-selector-btn"
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 text-sm font-medium"
              title="Change Language"
            >
              <Globe className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline uppercase text-xs font-bold">{lang}</span>
            </button>

            {isLangOpen && (
              <div
                className={`absolute top-full mt-2 w-44 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl py-1.5 z-50 ${
                  isRtl ? 'left-0' : 'right-0'
                }`}
              >
                {languages.map(l => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLang(l.code);
                      setIsLangOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 ${
                      lang === l.code ? 'font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{l.flag}</span>
                      <span>{l.label}</span>
                    </span>
                    {lang === l.code && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme Mode Toggle */}
          <button
            id="theme-toggle-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Mobile Menu Hamburger Toggle */}
          <button
            id="mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-4 space-y-2 animate-in slide-in-from-top-2 duration-150">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleNav('/youtube-downloader')}
              className="p-3 text-left rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2"
            >
              <Video className="w-4 h-4 text-blue-500" />
              {t.navVideoDownloader}
            </button>
            <button
              onClick={() => handleNav('/video-to-mp3')}
              className="p-3 text-left rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2"
            >
              <Music className="w-4 h-4 text-emerald-500" />
              {t.navMp3}
            </button>
            <button
              onClick={() => handleNav('/video-to-mp4')}
              className="p-3 text-left rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2"
            >
              <Video className="w-4 h-4 text-blue-400" />
              {t.navMp4}
            </button>
            <button
              onClick={() => handleNav('/thumbnail-downloader')}
              className="p-3 text-left rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2"
            >
              <ImageIcon className="w-4 h-4 text-pink-500" />
              {t.navThumbnails}
            </button>
            <button
              onClick={() => handleNav('/subtitle-downloader')}
              className="p-3 text-left rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-cyan-500" />
              {t.navSubtitles}
            </button>
            <button
              onClick={() => handleNav('/video-trimmer')}
              className="p-3 text-left rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2"
            >
              <Scissors className="w-4 h-4 text-violet-500" />
              {t.navTrimmer}
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
            <button
              onClick={() => handleNav('/dashboard')}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center gap-1.5"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              {t.navDashboard}
            </button>
            <button
              onClick={() => handleNav('/status')}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              {t.navStatus}
            </button>
            <button
              onClick={() => handleNav('/blog')}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              {t.navBlog}
            </button>
            <button
              onClick={() => handleNav('/how-it-works')}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            >
              {t.navHowItWorks}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
