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

// 1. SUPPORTED PLATFORMS VIEW
export const SupportedPlatformsView: React.FC = () => {
  const { setRoute } = useApp();

  const providers = [
    {
      name: 'YouTube (oEmbed & Public Metadata)',
      tag: 'oEmbed Compliant',
      icon: '▶️',
      color: 'border-red-500/30 bg-red-500/5',
      supportedUrlTypes: ['youtube.com/watch?v=...', 'youtu.be/...', 'youtube.com/shorts/...'],
      supportedMediaTypes: ['Full HD MP4 (1080p, 720p, 480p)', 'Studio MP3 (320kbps, 192kbps)', 'HD Thumbnail Images', 'SRT/VTT Subtitles'],
      limitations: 'Only publicly authorized metadata and non-copyright restricted streams can be processed. Private or membership content is strictly blocked.',
      status: 'Active & Operational',
    },
    {
      name: 'Vimeo (Public API)',
      tag: 'Creative Showcase',
      icon: '🎞️',
      color: 'border-blue-500/30 bg-blue-500/5',
      supportedUrlTypes: ['vimeo.com/...', 'player.vimeo.com/video/...'],
      supportedMediaTypes: ['1080p Full HD MP4', '720p HD MP4', 'MP3 Audio Stream', 'High-res Poster Artwork'],
      limitations: 'Requires public embed permission configured by the original video creator.',
      status: 'Active & Operational',
    },
    {
      name: 'Direct Media & CDNs',
      tag: 'Direct Protocols',
      icon: '🌐',
      color: 'border-emerald-500/30 bg-emerald-500/5',
      supportedUrlTypes: ['*.mp4', '*.webm', '*.mp3', '*.wav', '*.ogg', '*.m4a'],
      supportedMediaTypes: ['Original Master Quality Video/Audio', 'Lossless WAV PCM', 'FLAC Audio Containers'],
      limitations: 'Origin server must permit HTTP HEAD requests and standard cross-origin ranges.',
      status: 'Active & Operational',
    },
    {
      name: 'Wikimedia Commons & NASA Open Archives',
      tag: 'Public Domain',
      icon: '🏛️',
      color: 'border-amber-500/30 bg-amber-500/5',
      supportedUrlTypes: ['commons.wikimedia.org/...', 'archive.org/...', 'nasa.gov/...'],
      supportedMediaTypes: ['4K Ultra HD Broadcasts', 'Archival Scientific Master Tapes', 'Multilingual Transcripts'],
      limitations: 'Free educational public domain resources. No bandwidth restrictions.',
      status: 'Active & Operational',
    },
    {
      name: 'SoundCloud (Public oEmbed)',
      tag: 'Audio Gateway',
      icon: '🎵',
      color: 'border-orange-500/30 bg-orange-500/5',
      supportedUrlTypes: ['soundcloud.com/[artist]/[track]'],
      supportedMediaTypes: ['320 kbps High Fidelity MP3', '256 kbps Studio MP3', 'Original Cover Art'],
      limitations: 'Only public tracks with author permissions enabled.',
      status: 'Active & Operational',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
          Compatibility & Provider Standards
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Supported Media Platforms
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          VideoFetch utilizes a modular provider adapter architecture to inspect and process public, authorized media with zero circumvention of platform terms.
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
      desc: 'Paste a video or audio link that you own or have explicit rights to save. The frontend performs instant syntax checking.',
      icon: <Globe className="w-6 h-6 text-blue-500" />,
    },
    {
      step: '02',
      title: 'SSRF & Provider Verification',
      desc: 'Our backend protects against SSRF attacks, validates against private network ranges, and routes the query to the dedicated provider adapter.',
      icon: <ShieldCheck className="w-6 h-6 text-emerald-500" />,
    },
    {
      step: '03',
      title: 'Stream Demuxing & Format Analysis',
      desc: 'The engine inspects container codecs (H.264, AV1, AAC), calculates exact resolutions, and estimates compressed file sizes.',
      icon: <Zap className="w-6 h-6 text-indigo-500" />,
    },
    {
      step: '04',
      title: 'Background Queue Processing',
      desc: 'When an export is triggered, our worker demuxes audio tracks, transcodes to 320 kbps MP3 or cuts keyframes without server lag.',
      icon: <Cpu className="w-6 h-6 text-violet-500" />,
    },
    {
      step: '05',
      title: 'Signed Expiring Token & Cleanup',
      desc: 'A secure, short-lived download token is created. After 15 minutes, temporary cache resources are automatically purged.',
      icon: <HardDrive className="w-6 h-6 text-amber-500" />,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          How Media Processing Works
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
          A high-performance, asynchronous pipeline built for speed, safety, and strict compliance.
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
      q: 'Why do download links expire after 15 minutes?',
      a: 'For security, data protection, and storage hygiene, all generated download tokens are cryptographically signed with a 15-minute time-to-live (TTL). Once expired, temporary processing artifacts are permanently cleaned up from worker nodes.',
      category: 'Technical',
    },
    {
      q: 'What is the difference between 128 kbps and 320 kbps MP3?',
      a: 'Bitrate measures acoustic data density. 128 kbps is standard web streaming quality, while 320 kbps preserves the full dynamic range, stereo separation, and high-frequency fidelity matching original studio recordings.',
      category: 'Audio',
    },
    {
      q: 'Does VideoFetch work with 4K Ultra HD videos?',
      a: 'Yes! When the source stream provides 4K (3840x2160) or 1080p Full HD master files, our analyzer extracts the original container formats without downscaling.',
      category: 'Video',
    },
    {
      q: 'How does the Video Trimmer work?',
      a: 'The Video Trimmer uses HTML5 keyframe seeking on the client and fast stream cutting on the server. You can select exact start and end timestamps and export either a cropped MP4 video or an extracted MP3 audio snippet.',
      category: 'Tools',
    },
    {
      q: 'Can I download subtitles in multiple languages?',
      a: 'Yes. If the media provider includes public closed captions or transcripts, VideoFetch extracts them in standard SRT, WebVTT, and plain text (TXT) formats.',
      category: 'Subtitles',
    },
    {
      q: 'Are there rate limits for anonymous users?',
      a: 'Yes. To protect processing nodes from automated scrapers and abuse, anonymous users have a standard limit of 25 media analyses per hour. Authenticated accounts receive higher thresholds.',
      category: 'Usage',
    },
    {
      q: 'How do I submit a DMCA takedown complaint?',
      a: 'If you are a copyright holder and believe a specific URL should not be processed by our platform, you can submit a notice via our /dmca page. Our legal team reviews complaints promptly.',
      category: 'Legal & Compliance',
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
