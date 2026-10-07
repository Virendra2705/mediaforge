import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AtmosphereProvider } from './context/AtmosphereContext';
import { AtmosphericBackground } from './components/AtmosphericBackground';
import { AdSenseScript } from './components/ads/AdSenseScript';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ActiveJobModal } from './components/ActiveJobModal';
import { AuthModal } from './components/AuthModal';
import { ToastContainer, CookieBanner } from './components/ToastAndCookie';
import { HomeView } from './views/HomeView';
import {
  YoutubeDownloaderView,
  Mp3ConverterView,
  Mp4DownloaderView,
  ThumbnailDownloaderView,
  SubtitleDownloaderView,
  VideoTrimmerView,
} from './views/ToolViews';
import {
  SupportedPlatformsView,
  HowItWorksView,
  FaqView,
} from './views/InfoViews';
import { BlogListView, BlogPostView } from './views/BlogViews';
import { DmcaView, CopyrightView, TermsView, PrivacyView, SecurityView } from './views/LegalViews';
import { AboutView, ContactView } from './views/AboutContactViews';
import { StatusView, ChangelogView } from './views/StatusChangelogViews';
import { DashboardView } from './views/DashboardView';
import { AdminView } from './views/AdminView';
import {
  UniversalVideoDownloaderView,
  FourKDownloaderView,
  AudioDownloaderView,
  VideoConverterView,
  YouTubeDownloaderView,
  YouTubeShortsDownloaderView,
  TikTokDownloaderView,
  InstagramDownloaderView,
  XTwitterDownloaderView,
  VimeoDownloaderView,
  PinterestDownloaderView,
  BilibiliDownloaderView,
} from './views/SeoLandingViews';
import { NotFoundView } from './views/NotFoundView';
import { ShieldAlert, KeyRound } from 'lucide-react';

const AdminGate: React.FC = () => {
  const { setAuthModalOpen, setRoute } = useApp();

  return (
    <div className="max-w-md mx-auto my-20 p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-5">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Admin Console Restricted</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
          Access to system telemetry, queue management, and settings requires an authenticated administrator session.
        </p>
      </div>
      <div className="pt-2 flex flex-col gap-2.5">
        <button
          id="admin-gate-login-btn"
          onClick={() => setAuthModalOpen(true)}
          className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <KeyRound className="w-4 h-4" />
          <span>Sign In as Administrator</span>
        </button>
        <button
          onClick={() => setRoute('/')}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
};

const MainRouter: React.FC = () => {
  const { route, user } = useApp();

  const renderCurrentView = () => {
    if (route === '/') return <HomeView />;

    // Required Public Media Tools:
    if (route === '/video-downloader' || route === '/online-video-downloader') {
      return <UniversalVideoDownloaderView />;
    }
    if (route === '/audio-downloader') {
      return <AudioDownloaderView canonicalPath="/audio-downloader" />;
    }
    if (route === '/video-to-mp3') {
      return <Mp3ConverterView />;
    }
    if (route === '/video-converter') {
      return <VideoConverterView canonicalPath="/video-converter" />;
    }
    if (route === '/video-to-mp4') {
      return <Mp4DownloaderView />;
    }
    if (route === '/thumbnail-downloader') return <ThumbnailDownloaderView />;
    if (route === '/subtitle-downloader') return <SubtitleDownloaderView />;
    if (route === '/video-trimmer') return <VideoTrimmerView />;
    if (route === '/4k-video-downloader' || route === '/hd-video-downloader') {
      return <FourKDownloaderView />;
    }

    // Platform-Specific SEO Pages:
    if (route === '/youtube-downloader' || route === '/youtube-video-downloader') {
      return <YouTubeDownloaderView />;
    }
    if (route === '/youtube-shorts-downloader') return <YouTubeShortsDownloaderView />;
    if (route === '/tiktok-video-downloader') return <TikTokDownloaderView />;
    if (route === '/instagram-video-downloader') return <InstagramDownloaderView />;
    if (route === '/x-video-downloader') return <XTwitterDownloaderView />;
    if (route === '/vimeo-video-downloader') return <VimeoDownloaderView />;
    if (route === '/pinterest-video-downloader') return <PinterestDownloaderView />;
    if (route === '/bilibili-video-downloader') return <BilibiliDownloaderView />;

    // Guides & Technical Info:
    if (route === '/supported-platforms') return <SupportedPlatformsView />;
    if (route === '/how-it-works') return <HowItWorksView />;
    if (route === '/faq') return <FaqView />;

    // Blog & Articles:
    if (route === '/blog') return <BlogListView />;
    if (route.startsWith('/blog/')) {
      const slug = route.replace('/blog/', '');
      return <BlogPostView slug={slug} />;
    }

    // Required Legal, Company & Contact Pages:
    if (route === '/about') return <AboutView />;
    if (route === '/contact') return <ContactView />;
    if (route === '/privacy' || route === '/privacy-policy') return <PrivacyView />;
    if (route === '/terms') return <TermsView />;
    if (route === '/dmca') return <DmcaView />;
    if (route === '/copyright') return <CopyrightView />;
    if (route === '/security') return <SecurityView />;
    if (route === '/status') return <StatusView />;
    if (route === '/changelog') return <ChangelogView />;
    if (route === '/dashboard') return <DashboardView />;
    if (route === '/admin' || route.startsWith('/admin/')) {
      if (user?.role !== 'admin') {
        return <AdminGate />;
      }
      return <AdminView />;
    }

    // 404 Fallback
    return <NotFoundView />;
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-900 dark:text-slate-100 antialiased selection:bg-indigo-500 selection:text-white transition-colors duration-300 relative">
      <AdSenseScript />
      <AtmosphericBackground />
      <Header />
      <main className="flex-1 w-full relative z-0">
        <div key={route} className="vf-slide-up w-full">
          {renderCurrentView()}
        </div>
      </main>
      <Footer />
      <ActiveJobModal />
      <AuthModal />
      <ToastContainer />
      <CookieBanner />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AtmosphereProvider>
        <MainRouter />
      </AtmosphereProvider>
    </AppProvider>
  );
}
