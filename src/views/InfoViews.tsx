import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Code,
  Zap,
  Globe,
  HardDrive,
  Cpu,
  Layers,
  ChevronDown,
  Search,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SEOHead } from '../components/SEOHead';

// 1. SUPPORTED PLATFORMS VIEW
export const SupportedPlatformsView: React.FC = () => {
  const { setRoute } = useApp();

  const providers = [
    {
      name: 'YouTube',
      tag: 'oEmbed Compliant',
      icon: '▶️',
      color: 'border-red-500/30 bg-red-500/5',
      supportedUrlTypes: ['youtube.com/watch?v=...', 'youtu.be/...', 'youtube.com/shorts/...'],
      supportedMediaTypes: ['Video and audio formats returned for a supported link', 'Source-provided thumbnails and captions when available'],
      limitations: 'Available formats depend on the source and may change. Private or access-controlled content is not supported.',
      status: 'Provider implemented',
    },
    {
      name: 'Vimeo (Public API)',
      tag: 'Creative Showcase',
      icon: '🎞️',
      color: 'border-blue-500/30 bg-blue-500/5',
      supportedUrlTypes: ['vimeo.com/...', 'player.vimeo.com/video/...'],
      supportedMediaTypes: ['Formats and metadata returned for an accessible public link'],
      limitations: 'Availability depends on the source, its settings, and the provider response.',
      status: 'Provider implemented',
    },
    {
      name: 'Direct Media & CDNs',
      tag: 'Direct Protocols',
      icon: '🌐',
      color: 'border-emerald-500/30 bg-emerald-500/5',
      supportedUrlTypes: ['*.mp4', '*.webm', '*.mp3', '*.wav', '*.ogg', '*.m4a'],
      supportedMediaTypes: ['Video and audio formats supported by the source and processing pipeline'],
      limitations: 'Only supported media types can be inspected; the source must be reachable and provide a valid media response.',
      status: 'Provider implemented',
    },
    {
      name: 'Wikimedia Commons',
      tag: 'Public Domain',
      icon: '🏛️',
      color: 'border-amber-500/30 bg-amber-500/5',
      supportedUrlTypes: ['commons.wikimedia.org/...'],
      supportedMediaTypes: ['Media formats and metadata returned for an accessible Commons file'],
      limitations: 'Rights and licensing vary by file. Check the source page and comply with its terms.',
      status: 'Provider implemented',
    },
    {
      name: 'SoundCloud (Public oEmbed)',
      tag: 'Audio Gateway',
      icon: '🎵',
      color: 'border-orange-500/30 bg-orange-500/5',
      supportedUrlTypes: ['soundcloud.com/[artist]/[track]'],
      supportedMediaTypes: ['Metadata and formats returned for an accessible public track'],
      limitations: 'Track availability and permitted use depend on the source and its terms.',
      status: 'Provider implemented',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <SEOHead
        title="Supported Media Sources and Formats | VideoFetch"
        description="Review the media sources and formats that VideoFetch currently supports, along with source-specific limitations."
        canonicalPath="/supported-platforms"
      />
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
          Compatibility & Provider Standards
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Supported Media Platforms
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          The application includes providers for YouTube, Vimeo, SoundCloud, Wikimedia Commons, and supported direct media links. Availability and formats depend on each source.
        </p>
      </div>

      {/* Provider Adapter Interface Code Snippet */}
      <div className="p-6 rounded-2xl bg-slate-900 text-slate-200 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-blue-400" />
            <span>Modular Provider Adapter Interface (`/server/providers.ts`)</span>
          </div>
          <span className="text-emerald-400 font-mono">TypeScript Standard</span>
        </div>
        <pre className="text-xs sm:text-sm font-mono overflow-x-auto p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-blue-300 leading-relaxed">
{`export interface MediaProvider {
  id: string;
  name: string;
  canHandle(url: URL): boolean;
  analyze(url: URL): Promise<MediaMetadata>;
  getFormats(media: MediaMetadata): Promise<MediaFormat[]>;
  createDownload(format: MediaFormat, media: MediaMetadata): Promise<DownloadResult>;
}`}
        </pre>
        <p className="text-xs text-slate-400">
          New authorized platforms can be plugged into the processing engine by implementing this standard interface without rewriting the frontend.
        </p>
      </div>

      {/* Provider Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {providers.map((p, idx) => (
          <div
            key={idx}
            className={`p-6 rounded-2xl border bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl shadow-sm space-y-4 vf-card-hover ${p.color}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{p.icon}</span>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">{p.name}</h3>
                  <span className="text-xs text-slate-500">{p.tag}</span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {p.status}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Supported URLs:</span>
                <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                  {p.supportedUrlTypes.map((u, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {u}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Supported Formats:</span>
                <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                  {p.supportedMediaTypes.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Compliance Limit: </span>
                {p.limitations}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 2. HOW IT WORKS VIEW
export const HowItWorksView: React.FC = () => {
  const { setRoute } = useApp();

  const steps = [
    {
      step: '01',
      title: 'Submit Permitted Media URL',
      desc: 'Paste a link from a supported source. The application checks its format and source before attempting analysis.',
      icon: <Globe className="w-6 h-6 text-blue-500" />,
    },
    {
      step: '02',
      title: 'URL and Source Checks',
      desc: 'The server validates supported URLs and selects a matching provider. These checks reduce some risks but do not guarantee that every outbound-network risk is eliminated.',
      icon: <ShieldCheck className="w-6 h-6 text-emerald-500" />,
    },
    {
      step: '03',
      title: 'Format Analysis',
      desc: 'For links the source can provide, the application returns available media details and formats. Results vary by source.',
      icon: <Zap className="w-6 h-6 text-indigo-500" />,
    },
    {
      step: '04',
      title: 'Job Processing',
      desc: 'If you request an available export, the application creates a processing job. Completion time and output options depend on the media and service resources.',
      icon: <Cpu className="w-6 h-6 text-violet-500" />,
    },
    {
      step: '05',
      title: 'Temporary Download',
      desc: 'Generated download links are temporary. The application attempts cleanup after job expiry; storage-provider behavior may affect final deletion.',
      icon: <HardDrive className="w-6 h-6 text-amber-500" />,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <SEOHead
        title="How VideoFetch Works | VideoFetch"
        description="Learn how to submit a supported media link, review available formats, and prepare an authorized download."
        canonicalPath="/how-it-works"
      />
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          How Media Processing Works
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
          A short overview of how supported links are checked, analyzed, and prepared for export.
        </p>
      </div>

      <div className="space-y-6">
        {steps.map((s, idx) => (
          <div
            key={idx}
            className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start gap-5 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
          >
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              {s.icon}
            </div>
            <div className="flex-1">
              <div className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 mb-1">
                STEP {s.step}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">
                {s.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {s.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-8 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white text-center space-y-4 shadow-xl">
        <h2 className="text-2xl font-bold">Ready to analyze your first media link?</h2>
        <p className="text-sm text-blue-100 max-w-xl mx-auto">
          Test with our built-in open-source sample assets or analyze your authorized video.
        </p>
        <button
          onClick={() => setRoute('/')}
          className="px-6 py-3 rounded-xl font-bold text-sm bg-white text-blue-600 hover:bg-blue-50 shadow-md transition-all inline-flex items-center gap-2"
        >
          <span>Open Downloader</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// 3. FAQ VIEW
export const FaqView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Is it legal to use VideoFetch?',
      a: 'Yes. VideoFetch is a technology utility intended strictly for saving and converting content that you own, have explicit authorization to download, or which is published under Creative Commons or Public Domain licenses. We do not provide tools to circumvent DRM or platform paywalls.',
      category: 'Legal & Compliance',
    },
    {
      q: 'How long are download jobs available?',
      a: 'Download jobs are assigned a 15-minute expiry. The application attempts to remove associated temporary media after expiry, but cleanup can depend on the storage provider and does not establish a universal deletion time.',
      category: 'Technical',
    },
    {
      q: 'What is the difference between 128 kbps and 320 kbps MP3?',
      a: 'Bitrate is the amount of data used per second of audio. A higher MP3 bitrate can reduce compression artifacts, but it cannot restore detail missing from the source audio.',
      category: 'Audio',
    },
    {
      q: 'Does VideoFetch work with 4K Ultra HD videos?',
      a: 'Some supported sources may offer high-resolution formats. Available resolution and whether it can be exported depend on the source and processing path.',
      category: 'Video',
    },
    {
      q: 'How does the Video Trimmer work?',
      a: 'The trimmer lets you choose a clip range from supported media and request an export. Exact boundaries and output formats depend on the source and selected processing option.',
      category: 'Tools',
    },
    {
      q: 'Can I download subtitles in multiple languages?',
      a: 'Captions are available only when a supported source provides them and the application can process them. Available subtitle formats depend on the source.',
      category: 'Subtitles',
    },
    {
      q: 'Are there rate limits?',
      a: 'Requests may be rate limited to protect the service. Limits can vary by deployment and are communicated when a request is rejected.',
      category: 'Usage',
    },
    {
      q: 'How do I submit a DMCA takedown complaint?',
      a: 'If you are a rights holder or authorized agent, use the notice form or contact address on the Copyright Policy page. A successful response confirms application receipt only; it does not promise a review timeline or outcome.',
      category: 'Legal & Compliance',
    },
    {
      q: 'Which browsers and devices are supported?',
      a: 'VideoFetch runs in a web browser and has no separate desktop or mobile app. No formal browser compatibility matrix is published; behavior can vary with browser capabilities, source restrictions, and network conditions.',
      category: 'Compatibility',
    },
  ];

  const filteredFaqs = faqs.filter(
    f =>
      f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.a.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <SEOHead
        title="Help and Frequently Asked Questions | VideoFetch"
        description="Find answers about supported media links, available formats, temporary downloads, subtitles, and responsible use."
        canonicalPath="/faq"
      />
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Frequently Asked Questions
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
          Find answers to common questions regarding audio quality, video formats, compliance, and features.
        </p>

        {/* Search input */}
        <div className="relative max-w-md mx-auto mt-6">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search questions (e.g. MP3, 4K, legal, subtitles)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* FAQ Accordion List */}
      <div className="space-y-3">
        {filteredFaqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className={`rounded-xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border transition-all duration-200 shadow-sm ${
                isOpen
                  ? 'border-indigo-300 dark:border-indigo-800/80 shadow-md'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <button
                id={`faq-btn-${idx}`}
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 focus:outline-none vf-btn-tactile"
              >
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                    {faq.category}
                  </span>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    {faq.q}
                  </h3>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
              </button>

              {isOpen && (
                <div className="px-4 sm:px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/80 vf-slide-down">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
