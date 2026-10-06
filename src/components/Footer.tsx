import React from 'react';
import {
  Zap,
  ShieldCheck,
  FileCheck2,
  AlertTriangle,
  Activity,
  Heart,
  Scale,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AppRoute } from '../types';

export const Footer: React.FC = () => {
  const { setRoute, t } = useApp();

  const handleNav = (route: AppRoute) => {
    setRoute(route);
  };

  return (
    <footer className="w-full border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Col 1: Brand & Compliance mission */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-sm">
                <div className="w-4 h-4 bg-white rounded-sm transform rotate-45" />
              </div>
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                Media<span className="text-indigo-600 dark:text-indigo-400">Forge</span>
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
              An enterprise-grade media extraction, audio/video transcoding, and format transformation utility designed for authorized creators, educators, and archivers.
            </p>

            {/* Strict Compliance Notice Banner */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Authorized Use Policy</span>
                {t.trustNotice}
              </div>
            </div>

            {/* System Status Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All Extraction Adapters Operational (99.98% Uptime)</span>
            </div>
          </div>

          {/* Col 2: Media Tools */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 mb-3.5">
              Media Converters
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <button
                  id="footer-nav-yt"
                  onClick={() => handleNav('/youtube-downloader')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  YouTube Downloader
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-mp3"
                  onClick={() => handleNav('/video-to-mp3')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Video to MP3 (320 kbps)
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-mp4"
                  onClick={() => handleNav('/video-to-mp4')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Video to MP4 (1080p/4K)
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-thumbs"
                  onClick={() => handleNav('/thumbnail-downloader')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  HD Thumbnail Extractor
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-subs"
                  onClick={() => handleNav('/subtitle-downloader')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Subtitle (SRT/VTT) Tool
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-trim"
                  onClick={() => handleNav('/video-trimmer')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Video Trimmer & Cutter
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Resources & Guides */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 mb-3.5">
              Resources & Specs
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <button
                  id="footer-nav-platforms"
                  onClick={() => handleNav('/supported-platforms')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Supported Platforms Matrix
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-how"
                  onClick={() => handleNav('/how-it-works')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  How Media Processing Works
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-faq"
                  onClick={() => handleNav('/faq')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Frequently Asked Questions
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-blog"
                  onClick={() => handleNav('/blog')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Engineering Blog & Articles
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-status"
                  onClick={() => handleNav('/status')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5"
                >
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  Live System Status
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-changelog"
                  onClick={() => handleNav('/changelog')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Changelog & Releases
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Legal & Copyright Compliance */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 mb-3.5 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-indigo-500" />
              Legal & Compliance
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <button
                  id="footer-nav-dmca"
                  onClick={() => handleNav('/dmca')}
                  className="text-rose-600 dark:text-rose-400 font-semibold hover:underline flex items-center gap-1"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  DMCA Takedown Complaint
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-copyright"
                  onClick={() => handleNav('/copyright')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Copyright Policy
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-terms"
                  onClick={() => handleNav('/terms')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-privacy"
                  onClick={() => handleNav('/privacy')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Privacy Policy & Cookies
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-about"
                  onClick={() => handleNav('/about')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  About MediaForge
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-contact"
                  onClick={() => handleNav('/contact')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Contact & Support
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <p>© {new Date().getFullYear()} MediaForge Platform. {t.footerRights}</p>
          <div className="flex items-center gap-6">
            <button onClick={() => handleNav('/privacy')} className="hover:underline">Privacy</button>
            <button onClick={() => handleNav('/terms')} className="hover:underline">Terms</button>
            <button onClick={() => handleNav('/dmca')} className="hover:underline">DMCA</button>
            <button onClick={() => handleNav('/status')} className="hover:underline">Status</button>
          </div>
        </div>
      </div>
    </footer>
  );
};
