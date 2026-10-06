import React from 'react';
import {
  Zap,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  Music,
  Video,
  FileText,
  Scissors,
  CheckCircle2,
  Lock,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UrlInputBar } from '../components/UrlInputBar';
import { MediaResultCard } from '../components/MediaResultCard';

export const HomeView: React.FC = () => {
  const { setRoute, metadata, t } = useApp();

  const features = [
    {
      icon: <Zap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      title: 'Real-Time Stream Analysis',
      desc: 'Compliant oEmbed & direct stream inspects media resolution, audio bitrates, and container codecs in milliseconds.',
    },
    {
      icon: <Music className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      title: 'Studio 320 kbps MP3 Audio',
      desc: 'Lossless audio demuxing with high-fidelity LAME MP3 conversion, ID3 tags, and loudness normalization.',
    },
    {
      icon: <Video className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      title: 'Pristine 1080p & 4K MP4',
      desc: 'Direct container remuxing preserving 60 FPS visual smoothness without quality degradation.',
    },
    {
      icon: <Scissors className="w-5 h-5 text-violet-600 dark:text-violet-400" />,
      title: 'Accurate Video Trimmer',
      desc: 'Scrub timelines, preview keyframes, and extract custom audio or video clips without re-encoding delays.',
    },
    {
      icon: <FileText className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />,
      title: 'Subtitle & Captions Engine',
      desc: 'Extract multi-language SRT, WebVTT, and TXT transcripts for research, translation, and accessibility.',
    },
    {
      icon: <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      title: 'Private & Auto-Expiring',
      desc: 'No tracking. Short-lived signed download links automatically expire after 15 minutes with zero persistent storage of user files.',
    },
  ];

  return (
    <div className="w-full pb-20">
      {/* Hero Section with subtle geometric atmosphere */}
      <section className="relative pt-12 pb-14 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-500/5 dark:bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Fast, Compliant, & Accessible Media Tooling</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15] mb-4">
            {t.heroHeading}
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed mb-8">
            {t.heroSubtitle}
          </p>

          {/* Main URL Input Form */}
          <UrlInputBar />
        </div>
      </section>

      {/* Result Card Section (Rendered when metadata is active) */}
      <section className="px-4 sm:px-6 lg:px-8">
        <MediaResultCard />
      </section>

      {/* Features Showcase Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20 pt-12 border-t border-slate-200 dark:border-slate-800/80">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-3">
            Designed for Creators, Educators & Archivers
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            A reliable, clean processing architecture built for permissible audio extraction, clipping, and multi-format conversion.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                {feat.icon}
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                {feat.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {feat.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust & Legal Compliance Highlight */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <div className="p-6 sm:p-8 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
              <ShieldCheck className="w-5 h-5" />
              <span>Strict Copyright & Terms Compliance</span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Respect for Creators & Content Rights
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl">
              MediaForge never bypasses DRM, passwords, paywalls, or private authorizations. Our service processes publicly permissible streams, Creative Commons media, and user-owned content.
            </p>
          </div>

          <button
            onClick={() => setRoute('/dmca')}
            className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shrink-0 flex items-center gap-2 transition-all"
          >
            <span>DMCA Complaint</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Quick FAQ Highlights */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Everything you need to know about formats, compliance, and processing.
          </p>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
              What media can I process using MediaForge?
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              You can process videos and audio files that you own, content published under Creative Commons or Public Domain licenses, and media where you have explicit permission from the copyright owner.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
              How long are download links valid?
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Signed download tokens expire automatically after 15 minutes. This ensures temporary files are cleaned up from workers to maintain security and server hygiene.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
              Is MP3 320 kbps real stereo fidelity?
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Yes, when the source audio contains high-resolution frequency data, our transcoding pipeline encodes at the full 320 kbps constant bitrate with 44.1/48 kHz sample rates and ID3 metadata preservation.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
