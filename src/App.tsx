import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
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
import { DmcaView, CopyrightView, TermsView, PrivacyView } from './views/LegalViews';
import { AboutView, ContactView } from './views/AboutContactViews';
import { StatusView, ChangelogView } from './views/StatusChangelogViews';
import { DashboardView } from './views/DashboardView';
import { AdminView } from './views/AdminView';
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
    if (route === '/youtube-downloader') return <YoutubeDownloaderView />;
    if (route === '/video-to-mp3') return <Mp3ConverterView />;
    if (route === '/video-to-mp4') return <Mp4DownloaderView />;
    if (route === '/thumbnail-downloader') return <ThumbnailDownloaderView />;
    if (route === '/subtitle-downloader') return <SubtitleDownloaderView />;
    if (route === '/video-trimmer') return <VideoTrimmerView />;
    if (route === '/supported-platforms') return <SupportedPlatformsView />;
    if (route === '/how-it-works') return <HowItWorksView />;
    if (route === '/faq') return <FaqView />;
    if (route === '/blog') return <BlogListView />;
    if (route.startsWith('/blog/')) {
      const slug = route.replace('/blog/', '');
      return <BlogPostView slug={slug} />;
    }
    if (route === '/dmca') return <DmcaView />;
    if (route === '/copyright') return <CopyrightView />;
    if (route === '/terms') return <TermsView />;
    if (route === '/privacy') return <PrivacyView />;
    if (route === '/about') return <AboutView />;
    if (route === '/contact') return <ContactView />;
    if (route === '/status') return <StatusView />;
    if (route === '/changelog') return <ChangelogView />;
    if (route === '/dashboard') return <DashboardView />;
    if (route === '/admin' || route.startsWith('/admin/')) {
      if (user?.role !== 'admin') {
        return <AdminGate />;
      }
      return <AdminView />;
    }

    return <HomeView />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-blue-500 selection:text-white transition-colors duration-200">
      <Header />
      <main className="flex-1 w-full">{renderCurrentView()}</main>
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
      <MainRouter />
    </AppProvider>
  );
}
