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
    <footer className="vf-site-footer w-full text-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-8 lg:gap-12">
          {/* Col 1: Brand & Compliance mission */}
          <div className="col-span-2 lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="vf-brand-mark w-8 h-8 rounded-lg flex items-center justify-center shadow-sm">
                <div className="vf-brand-glyph vf-brand-glyph-small" />
              </div>
              <span className="vf-brand-wordmark text-lg font-bold">
                Video<span>Fetch</span>
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
              VideoFetch — Fast Video Downloader &amp; Media Tools. Download and process online videos, audio and media with fast, simple and secure tools.
            </p>

            {/* Strict Compliance Notice Banner */}
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900/60 text-xs text-amber-950 dark:text-amber-300 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Authorized Use Policy</span>
                {t.trustNotice}
              </div>
            </div>

            {/* System Status Clean Text */}
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All Extraction Adapters Operational · 99.98% Uptime</span>
            </div>
          </div>

          {/* Col 2: Media Tools */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 mb-3.5">
              Media Converters &amp; Tools
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <button
                  id="footer-nav-video-dl"
                  onClick={() => handleNav('/video-downloader')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Online Video Downloader
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-audio-dl"
                  onClick={() => handleNav('/audio-downloader')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Audio Downloader
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-video-conv"
                  onClick={() => handleNav('/video-converter')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Video Converter
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
                  id="footer-nav-trim"
                  onClick={() => handleNav('/video-trimmer')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Video Trimmer &amp; Cutter
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
                  onClick={() => handleNav('/privacy-policy')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Privacy Policy &amp; Cookies
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-security"
                  onClick={() => handleNav('/security')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Security Architecture
                </button>
              </li>
              <li>
                <button
                  id="footer-nav-about"
                  onClick={() => handleNav('/about')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  About VideoFetch
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
        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <p>© {new Date().getFullYear()} VideoFetch Platform. {t.footerRights}</p>
          <div className="flex flex-wrap justify-center sm:justify-end gap-x-4 gap-y-1">
            <button onClick={() => handleNav('/about')} className="hover:underline">About</button>
            <button onClick={() => handleNav('/privacy-policy')} className="hover:underline">Privacy</button>
            <button onClick={() => handleNav('/terms')} className="hover:underline">Terms</button>
            <button onClick={() => handleNav('/dmca')} className="hover:underline">DMCA</button>
            <button onClick={() => handleNav('/contact')} className="hover:underline">Contact</button>
            <button onClick={() => handleNav('/status')} className="hover:underline">Status</button>
          </div>
        </div>
      </div>
    </footer>
  );
};
