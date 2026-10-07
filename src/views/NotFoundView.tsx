import React from 'react';
import { Home, Video, Sparkles, Music, Scissors, BookOpen, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SEOHead } from '../components/SEOHead';

export const NotFoundView: React.FC = () => {
  const { setRoute } = useApp();

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <SEOHead
        title="Page Not Found (404) | VideoFetch"
        description="The page you requested could not be found. Explore our fast video downloader and media tools."
        noindex={true}
      />

      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-sm">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Error 404
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            The link you followed may be broken or the page has moved. Use the quick links below to access our media tools.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => setRoute('/')}
            className="py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <Home className="w-4 h-4" />
            <span>Return to Home</span>
          </button>
          <button
            onClick={() => setRoute('/video-downloader')}
            className="py-2.5 px-4 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Video className="w-4 h-4" />
            <span>Video Downloader</span>
          </button>
        </div>

        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 text-left">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
            Popular Media Tools
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => setRoute('/4k-video-downloader')}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 text-left flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>4K Downloader</span>
            </button>
            <button
              onClick={() => setRoute('/video-to-mp3')}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 text-left flex items-center gap-1.5"
            >
              <Music className="w-3.5 h-3.5 text-emerald-500" />
              <span>Video to MP3</span>
            </button>
            <button
              onClick={() => setRoute('/video-trimmer')}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 text-left flex items-center gap-1.5"
            >
              <Scissors className="w-3.5 h-3.5 text-violet-500" />
              <span>Video Trimmer</span>
            </button>
            <button
              onClick={() => setRoute('/blog')}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 text-left flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-500" />
              <span>Helpful Guides</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
