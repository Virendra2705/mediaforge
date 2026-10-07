import React, { useState } from 'react';
import {
  Video,
  Music,
  Scissors,
  Image as ImageIcon,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ShieldCheck,
  Zap,
  Sparkles,
  ArrowRight,
  Play,
  Layers,
  FileCheck,
  Sliders,
  Lock,
  Globe,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UrlInputBar } from '../components/UrlInputBar';
import { MediaResultCard } from '../components/MediaResultCard';
import { SEOHead } from '../components/SEOHead';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { AppRoute } from '../types';

interface FaqAccordionProps {
  items: { question: string; answer: string }[];
}

const FaqAccordion: React.FC<FaqAccordionProps> = ({ items }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3 mt-6">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={idx}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 overflow-hidden transition-all shadow-xs"
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="w-full py-4 px-5 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 focus:outline-none"
            >
              <span>{item.question}</span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                  isOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
                }`}
              />
            </button>
            {isOpen && (
              <div className="px-5 pb-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 pt-3">
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface RelatedToolsProps {
  links: { name: string; route: AppRoute; desc: string; icon: React.ReactNode }[];
}

const RelatedToolsGrid: React.FC<RelatedToolsProps> = ({ links }) => {
  const { setRoute } = useApp();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      {links.map((link, idx) => (
        <button
          key={idx}
          onClick={() => setRoute(link.route)}
          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left hover:border-indigo-500 dark:hover:border-indigo-500 transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              {link.icon}
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {link.name}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal line-clamp-2">
              {link.desc}
            </p>
          </div>
          <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
            <span>Open Tool</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// 1. UNIVERSAL ONLINE VIDEO DOWNLOADER (/video-downloader, /online-video-downloader)
// ============================================================================
export const UniversalVideoDownloaderView: React.FC = () => {
  const faqs = [
    {
      question: 'How does VideoFetch process online video downloads?',
      answer:
        'VideoFetch uses server-side stream inspection to query publicly accessible stream endpoints, verify video and audio codecs, and transcode or remux the streams into standard MP4 format with AAC audio. Once verified, a short-lived HMAC download token is generated.',
    },
    {
      question: 'Is it free to download videos with VideoFetch?',
      answer:
        'Yes, VideoFetch provides free access to standard media tools for personal archiving and permissible content without requiring software installation or accounts.',
    },
    {
      question: 'Which video qualities are available?',
      answer:
        'Depending on the source video resolution, VideoFetch supports 4K Ultra HD (2160p), Quad HD (1440p), Full HD (1080p), 720p, 480p, 360p, and audio extraction in MP3 up to 320 kbps.',
    },
    {
      question: 'Are downloads anonymous and secure?',
      answer:
        'Yes. All stream requests are sanitized against SSRF threats. We do not maintain logs of user identities or personal data, and generated artifacts are automatically deleted from server workers after 15 minutes.',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <SEOHead
        title="Video Downloader Online – Fast HD & 4K Media Tools"
        description="Download supported online videos in HD, 1080p, and 4K MP4 format. VideoFetch provides fast, clean, and secure media downloading with zero spam."
        canonicalPath="/video-downloader"
        breadcrumbs={[
          { name: 'Tools', url: '/supported-platforms' },
          { name: 'Video Downloader', url: '/video-downloader' },
        ]}
        faqs={faqs}
      />

      <Breadcrumbs items={[{ name: 'Video Downloader' }]} />

      <UrlInputBar
        customHeading="Online Video Downloader"
        customSubtitle="Download supported online videos in HD and 4K MP4 with fast, clean, and secure server-side tools."
      />
      <MediaResultCard />

      {/* Guide & Content Section */}
      <section className="mt-16 pt-12 border-t border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                How to Download Online Videos with VideoFetch
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                VideoFetch streamlines video downloading by running format resolution directly in a secure server-side sandbox. Follow three simple steps to save your video:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mb-3">
                  1
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Paste Video Link</h4>
                <p className="text-xs text-slate-500">Copy the URL from YouTube, TikTok, X, or Vimeo and paste it into the search bar.</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mb-3">
                  2
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Choose Resolution</h4>
                <p className="text-xs text-slate-500">Select your preferred format (4K, 1080p, 720p MP4 or 320 kbps MP3 audio).</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mb-3">
                  3
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Save File</h4>
                <p className="text-xs text-slate-500">VideoFetch multiplexes the streams with FFmpeg and delivers a direct download link.</p>
              </div>
            </div>

            <div className="mt-8 space-y-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  Video Quality &amp; Streaming Concepts
                </h3>
                <p>
                  Modern video distribution relies on adaptive bitrate streaming protocols such as DASH (Dynamic Adaptive Streaming over HTTP) and HLS (HTTP Live Streaming). Under these architectures, 1080p Full HD and 4K Ultra HD video tracks are encoded without audio to save bandwidth, while audio streams are served independently. VideoFetch inspects both stream manifests, synchronizes the video and audio timelines, and multiplexes them on the fly using FFmpeg into a unified MP4 container.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white block mb-1">Resolution vs. Bitrate</span>
                    <span>Resolution (e.g. 1920×1080) determines the pixel dimensions, while bitrate (e.g. 8 Mbps) determines the amount of video data compressed into every second. Higher bitrates preserve fine texture details and eliminate compression banding.</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white block mb-1">Frame Rates (30 vs. 60 FPS)</span>
                    <span>Standard films and vlogs use 24–30 FPS, while gaming and action recordings use 60 FPS for fluid motion. VideoFetch preserves the source stream&apos;s native frame rate without dropping frames.</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  Troubleshooting Common Extraction Issues
                </h3>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0">• Private or Login-Gated Media:</span>
                    <span>VideoFetch cannot access private videos, member-only streams, or content requiring account credentials, as we operate in a stateless privacy sandbox.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0">• DRM &amp; Encrypted Streams:</span>
                    <span>Streams protected with Widevine, FairPlay, or PlayReady DRM cannot and will not be decrypted by our system, adhering to anti-circumvention rules.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0">• Geographic Access Barriers:</span>
                    <span>If an origin platform restricts streaming to specific territorial broadcast zones, extraction may fail if the source CDN refuses cross-border requests.</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  Responsible &amp; Permissible Use
                </h3>
                <p>
                  VideoFetch is engineered for lawful personal archiving, educational analysis, fair use commentary, and processing self-created or Creative Commons media. Please respect the copyright and intellectual property rights of content authors and consult our DMCA Policy if you are a rights holder.
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar / Specs */}
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Security & Privacy First</span>
              </h3>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span>No account or personal details required</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span>SSRF and malicious redirect protection</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span>Files auto-purge after 15 minutes</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span>Strict copyright & DMCA compliance</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div className="mt-14">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Frequently Asked Questions</h3>
          <FaqAccordion items={faqs} />
        </div>

        {/* Related Tools */}
        <div className="mt-14">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Explore Related Media Tools</h3>
          <RelatedToolsGrid
            links={[
              { name: '4K Video Downloader', route: '/4k-video-downloader', desc: 'Download Ultra HD 2160p and 1440p videos.', icon: <Sparkles className="w-4 h-4" /> },
              { name: 'Video to MP3', route: '/video-to-mp3', desc: 'Extract pristine 320 kbps MP3 stereo tracks.', icon: <Music className="w-4 h-4" /> },
              { name: 'Video Trimmer', route: '/video-trimmer', desc: 'Cut, trim and slice video segments online.', icon: <Scissors className="w-4 h-4" /> },
              { name: 'Thumbnail Saver', route: '/thumbnail-downloader', desc: 'Extract original HD and 4K preview posters.', icon: <ImageIcon className="w-4 h-4" /> },
            ]}
          />
        </div>
      </section>
    </div>
  );
};

// ============================================================================
// 2. 4K VIDEO DOWNLOADER (/4k-video-downloader, /hd-video-downloader)
// ============================================================================
export const FourKDownloaderView: React.FC = () => {
  const faqs = [
    {
      question: 'What is a 4K video downloader?',
      answer:
        'A 4K video downloader allows you to download videos in 2160p resolution (3840x2160 pixels), which provides four times the pixel density of standard 1080p Full HD. VideoFetch merges high-bitrate video streams with uncompressed audio for pristine playback.',
    },
    {
      question: 'Why does 4K video downloading require separate stream merging?',
      answer:
        'Modern streaming platforms store 4K video streams separately from audio streams to optimize adaptive bitrate streaming. VideoFetch uses FFmpeg on the server to combine both streams into a single, high-fidelity MP4 file with zero sync lag.',
    },
    {
      question: 'What video player is recommended for 4K video playback?',
      answer:
        'We recommend VLC Media Player, QuickTime, or native modern OS media players with hardware HEVC/H.264 decoding to ensure smooth 60 FPS playback without CPU throttling.',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <SEOHead
        title="4K Video Downloader Online – Download Ultra HD 2160p & 1080p | VideoFetch"
        description="Download online videos in Ultra HD 4K (2160p), 2K (1440p), and 1080p Full HD. VideoFetch multiplexes video and audio streams into clean MP4 files."
        canonicalPath="/4k-video-downloader"
        breadcrumbs={[
          { name: 'Tools', url: '/supported-platforms' },
          { name: '4K Video Downloader', url: '/4k-video-downloader' },
        ]}
        faqs={faqs}
      />

      <Breadcrumbs items={[{ name: '4K Video Downloader' }]} />

      <UrlInputBar
        customHeading="4K & Ultra HD Video Downloader"
        customSubtitle="Extract and multiplex pristine 2160p (4K), 1440p (2K), and 1080p Full HD video streams with crystal-clear audio."
      />
      <MediaResultCard />

      <section className="mt-16 pt-12 border-t border-slate-200 dark:border-slate-800 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2">3840 × 2160 Pixels</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Experience maximum detail on Retina, OLED, and 4K monitors with original bitrate preservation and deep color depth.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2">High Frame Rate (60 FPS)</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Maintains silky smooth 60 frames-per-second video for gaming clips, nature documentaries, and sports highlights.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2">Hardware-Friendly MP4</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Remuxed with faststart flags so large 4K files start playing instantly on mobile and desktop devices.
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">4K Video FAQs</h3>
          <FaqAccordion items={faqs} />
        </div>

        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Related Media Utilities</h3>
          <RelatedToolsGrid
            links={[
              { name: 'Standard Video Downloader', route: '/video-downloader', desc: 'Fast MP4 downloads for standard resolutions.', icon: <Video className="w-4 h-4" /> },
              { name: 'Video to MP3', route: '/video-to-mp3', desc: 'Convert 4K videos into compact high-bitrate MP3s.', icon: <Music className="w-4 h-4" /> },
              { name: 'Video Trimmer', route: '/video-trimmer', desc: 'Trim highlights from long 4K videos.', icon: <Scissors className="w-4 h-4" /> },
              { name: 'Thumbnail Extractor', route: '/thumbnail-downloader', desc: 'Save original 4K max-res preview thumbnails.', icon: <ImageIcon className="w-4 h-4" /> },
            ]}
          />
        </div>
      </section>
    </div>
  );
};

// ============================================================================
// 3. AUDIO & MP3 DOWNLOADER (/audio-downloader, /video-to-mp3)
// ============================================================================
export const AudioDownloaderView: React.FC<{ canonicalPath?: string }> = ({
  canonicalPath = '/audio-downloader',
}) => {
  const isDedicatedAudio = canonicalPath === '/audio-downloader';
  const faqs = [
    {
      question: 'How does Video to MP3 conversion work?',
      answer:
        'When you provide a video link, VideoFetch strips the video stream and isolates the audio channel. It uses FFmpeg with the LAME MP3 codec to transcode the audio into a 320 kbps or 192 kbps MP3 file with stereo normalization.',
    },
    {
      question: 'Is 320 kbps true high quality?',
      answer:
        'Yes. 320 kbps is the highest constant bitrate supported by the MP3 standard, providing perceptual transparency matching CD quality audio for listening on high-end headphones and sound systems.',
    },
    {
      question: 'What is the difference between MP3 and AAC / M4A?',
      answer:
        'MP3 is the universal legacy standard supported by every audio player. AAC provides slightly better compression efficiency at lower bitrates, but 320 kbps MP3 ensures complete compatibility across all legacy car stereos, MP3 players, and audio editors.',
    },
    {
      question: 'Are ID3 tags and album thumbnails included?',
      answer:
        'Yes, VideoFetch preserves track title, author metadata, and thumbnail artwork in the generated MP3 file.',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <SEOHead
        title={
          isDedicatedAudio
            ? 'Audio Downloader – Extract MP3 Audio from Online Videos | VideoFetch'
            : 'Video to MP3 – Extract Audio Online (320 kbps) | VideoFetch'
        }
        description="Convert and download audio tracks from online videos in high-quality 320 kbps, 256 kbps, and 192 kbps MP3 format. Fast, clean, and lossless demuxing."
        canonicalPath={canonicalPath}
        breadcrumbs={[
          { name: 'Tools', url: '/supported-platforms' },
          { name: isDedicatedAudio ? 'Audio Downloader' : 'Video to MP3', url: canonicalPath },
        ]}
        faqs={faqs}
      />

      <Breadcrumbs items={[{ name: isDedicatedAudio ? 'Audio Downloader' : 'Video to MP3 Converter' }]} />

      <UrlInputBar
        customHeading={isDedicatedAudio ? 'Online Audio Downloader' : 'Video to MP3 Audio Extractor'}
        customSubtitle="Extract pristine acoustic streams, normalize stereo channels, and transcode online videos into studio 320 kbps MP3 files."
      />
      <MediaResultCard />

      <section className="mt-16 pt-12 border-t border-slate-200 dark:border-slate-800 space-y-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">320 kbps High Fidelity</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Highest constant bitrate standard delivering full 20 Hz – 20 kHz acoustic frequency response.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Stereo Normalization</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Dual-channel balance with 44.1 kHz / 48 kHz standard acoustic sampling rates without clipping.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">ID3 Metadata Preservation</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Artwork, track titles, and creator tags automatically embedded into output ID3v2 tags.
            </p>
          </div>
        </div>

        {/* Detailed Audio Engineering Guide */}
        <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Audio Demuxing &amp; Quality Engineering
            </h3>
            <p>
              When extracting audio from a streaming video, VideoFetch inspects the container&apos;s audio elementary stream. In modern video streams, audio is typically encoded in AAC or Opus at variable bitrates. Rather than performing a noisy analog re-recording, our server-side engine extracts the pristine digital packets and utilizes the industry-standard LAME encoder with Psychoacoustic Model II to generate a broadcast-compliant MP3 stream.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <span className="font-bold text-slate-900 dark:text-white block mb-1">Choosing the Right Bitrate</span>
              <p className="text-xs">
                • <strong>320 kbps:</strong> Best for music with dynamic instrumentation, acoustic performances, and studio listening.<br />
                • <strong>192–256 kbps:</strong> Balanced standard for general headphone listening and car stereos.<br />
                • <strong>128 kbps:</strong> Optimized for spoken-word podcasts and audiobooks with compact file sizes.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <span className="font-bold text-slate-900 dark:text-white block mb-1">Audio Troubleshooting</span>
              <p className="text-xs">
                • If the resulting MP3 has no audio, check if the source video was uploaded as a silent video track.<br />
                • Audio volume is standardized to prevent harsh digital distortion or quiet dialogue.<br />
                • Only public, non-DRM streams can be converted into audio files.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Audio Extractor FAQs</h3>
          <FaqAccordion items={faqs} />
        </div>

        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Related Audio &amp; Video Tools</h3>
          <RelatedToolsGrid
            links={[
              { name: 'Video Downloader', route: '/video-downloader', desc: 'Download full video and audio combined.', icon: <Video className="w-4 h-4" /> },
              { name: '4K Downloader', route: '/4k-video-downloader', desc: 'Save Ultra HD videos in pristine resolution.', icon: <Sparkles className="w-4 h-4" /> },
              { name: 'Video Trimmer', route: '/video-trimmer', desc: 'Cut specific audio and video timestamps.', icon: <Scissors className="w-4 h-4" /> },
              { name: 'Thumbnail Saver', route: '/thumbnail-downloader', desc: 'Save high-res video covers as album art.', icon: <ImageIcon className="w-4 h-4" /> },
            ]}
          />
        </div>
      </section>
    </div>
  );
};

// ============================================================================
// 4. VIDEO CONVERTER (/video-converter, /video-to-mp4)
// ============================================================================
export const VideoConverterView: React.FC<{ canonicalPath?: string }> = ({
  canonicalPath = '/video-converter',
}) => {
  const faqs = [
    {
      question: 'What is the difference between remuxing and transcoding?',
      answer:
        'Remuxing (stream copying) changes the container format (such as WebM or MKV to MP4) without decoding the audio and video frames. It is instantaneous and completely lossless. Transcoding involves re-encoding the compressed streams into a new codec (such as H.264), allowing maximum compatibility across legacy devices.',
    },
    {
      question: 'Which container format is best for compatibility?',
      answer:
        'MP4 is universally compatible with Apple devices (iPhone, iPad, Mac), Windows, Android, smart TVs, and video editing suites (Premiere, Final Cut, DaVinci Resolve). WebM is ideal for web browsers and HTML5 embedding.',
    },
    {
      question: 'Can I convert 4K and 1080p videos without quality loss?',
      answer:
        'Yes. VideoFetch uses lossless remuxing whenever possible to ensure that pixel resolution, color space, and audio bitrates remain identical to the origin source.',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <SEOHead
        title="Video Converter Online – Fast MP4, WebM & Format Remuxing | VideoFetch"
        description="Convert online videos to MP4, WebM, and MP3 formats online. Fast, clean server-side video conversion and lossless container remuxing with FFmpeg."
        canonicalPath={canonicalPath}
        breadcrumbs={[
          { name: 'Tools', url: '/supported-platforms' },
          { name: 'Video Converter', url: canonicalPath },
        ]}
        faqs={faqs}
      />

      <Breadcrumbs items={[{ name: 'Video Converter' }]} />

      <UrlInputBar
        customHeading="Online Video Converter"
        customSubtitle="Convert supported video streams into universal MP4, WebM, or audio formats with high-speed FFmpeg remuxing."
      />
      <MediaResultCard />

      <section className="mt-16 pt-12 border-t border-slate-200 dark:border-slate-800 space-y-12">
        {/* Converter Concepts Guide */}
        <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Understanding Video Conversion &amp; Container Architecture
            </h3>
            <p>
              A digital video file consists of two primary layers: the <strong>container</strong> (like .mp4 or .webm) and the <strong>codec</strong> (like H.264, VP9, or AV1). The container acts as a digital envelope packaging the video stream, audio stream, and subtitles together. VideoFetch analyzes the incoming stream metadata and determines the fastest, highest-quality processing method for your chosen format.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <span className="font-bold text-slate-900 dark:text-white block mb-1">MP4 (H.264 / AAC)</span>
              <p className="text-xs">
                The gold standard for hardware playback. Supported across iOS, Android, macOS, Windows, game consoles, and smart TVs without software plugins.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <span className="font-bold text-slate-900 dark:text-white block mb-1">WebM (VP9 / Opus)</span>
              <p className="text-xs">
                Open-source container developed by Google, delivering high-efficiency compression and native web browser embedding.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <span className="font-bold text-slate-900 dark:text-white block mb-1">Lossless Demuxing</span>
              <p className="text-xs">
                Whenever stream codecs are already compatible, VideoFetch copies the bitstream directly, eliminating re-encoding time and preserving 100% video quality.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Video Converter FAQs</h3>
          <FaqAccordion items={faqs} />
        </div>

        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Related Media Tools</h3>
          <RelatedToolsGrid
            links={[
              { name: 'Video Downloader', route: '/video-downloader', desc: 'Universal video extraction tool.', icon: <Video className="w-4 h-4" /> },
              { name: 'Video to MP3', route: '/video-to-mp3', desc: 'Convert video to MP3 audio.', icon: <Music className="w-4 h-4" /> },
              { name: 'Video Trimmer', route: '/video-trimmer', desc: 'Trim and cut video clips.', icon: <Scissors className="w-4 h-4" /> },
              { name: 'Thumbnail Saver', route: '/thumbnail-downloader', desc: 'Extract video cover images.', icon: <ImageIcon className="w-4 h-4" /> },
            ]}
          />
        </div>
      </section>
    </div>
  );
};

// ============================================================================
// 5. PLATFORM-SPECIFIC SEO LANDING VIEWS
// ============================================================================

interface PlatformLandingProps {
  platformName: string;
  badge: string;
  canonicalPath: string;
  seoTitle: string;
  seoDescription: string;
  heading: string;
  subtitle: string;
  descriptionText: string;
  faqs: { question: string; answer: string }[];
}

const GenericPlatformView: React.FC<PlatformLandingProps> = ({
  platformName,
  badge,
  canonicalPath,
  seoTitle,
  seoDescription,
  heading,
  subtitle,
  descriptionText,
  faqs,
}) => {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        canonicalPath={canonicalPath}
        breadcrumbs={[
          { name: 'Platforms', url: '/supported-platforms' },
          { name: `${platformName} Downloader`, url: canonicalPath },
        ]}
        faqs={faqs}
      />

      <Breadcrumbs items={[{ name: `${platformName} Downloader` }]} />

      <UrlInputBar customHeading={heading} customSubtitle={subtitle} />
      <MediaResultCard />

      <section className="mt-16 pt-12 border-t border-slate-200 dark:border-slate-800 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
              <Globe className="w-3.5 h-3.5" />
              <span>{badge}</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              About {platformName} Video Downloading with VideoFetch
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {descriptionText}
            </p>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 space-y-1.5">
              <p className="font-semibold text-slate-700 dark:text-slate-300">Compliance & Legal Notice:</p>
              <p>
                VideoFetch is an independent software tool and is not affiliated with or endorsed by {platformName}. Users are responsible for complying with copyright laws and ensuring they have rights to download or archive content.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">Features for {platformName}</h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Original resolution preservation</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Direct MP4 container output</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Audio extraction to MP3</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>No software installation required</span>
              </li>
            </ul>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{platformName} FAQs</h3>
          <FaqAccordion items={faqs} />
        </div>

        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Other Supported Platforms</h3>
          <RelatedToolsGrid
            links={[
              { name: 'YouTube Downloader', route: '/youtube-video-downloader', desc: 'Download YouTube videos in 4K & 1080p.', icon: <Video className="w-4 h-4" /> },
              { name: 'TikTok Downloader', route: '/tiktok-video-downloader', desc: 'Save HD TikTok videos and audio tracks.', icon: <Sparkles className="w-4 h-4" /> },
              { name: 'Instagram Downloader', route: '/instagram-video-downloader', desc: 'Save Reels, Stories, and video posts.', icon: <ImageIcon className="w-4 h-4" /> },
              { name: 'X / Twitter Downloader', route: '/x-video-downloader', desc: 'Download high-definition videos from X.', icon: <Globe className="w-4 h-4" /> },
            ]}
          />
        </div>
      </section>
    </div>
  );
};

export const YouTubeDownloaderView: React.FC = () => (
  <GenericPlatformView
    platformName="YouTube"
    badge="YouTube HD & 4K Ready"
    canonicalPath="/youtube-video-downloader"
    seoTitle="YouTube Video Downloader – HD & 4K Download Tool | VideoFetch"
    seoDescription="Download supported YouTube videos in 4K, 1080p, 720p MP4 and 320 kbps MP3 format. Fast, clean, and reliable media downloader with VideoFetch."
    heading="YouTube Video Downloader"
    subtitle="Download supported YouTube videos in high-resolution MP4 (up to 4K) or extract audio to 320 kbps MP3."
    descriptionText="VideoFetch allows you to inspect public YouTube video links and choose from available resolutions including 4K Ultra HD, 1080p, 720p, and audio-only MP3. Our system merges the video and audio streams into an optimized MP4 file for smooth offline playback."
    faqs={[
      { question: 'Can I download YouTube videos in 1080p or 4K?', answer: 'Yes, if the original YouTube upload is available in 1080p or 4K, VideoFetch multiplexes the high-resolution stream with the audio track into a single MP4.' },
      { question: 'Can I convert YouTube videos to MP3?', answer: 'Yes, select the MP3 audio option to extract a high-fidelity 320 kbps MP3 stereo file with ID3 tags.' },
      { question: 'Does VideoFetch work on mobile phones?', answer: 'Yes, VideoFetch works seamlessly in Safari on iOS and Chrome on Android without requiring any app download.' },
    ]}
  />
);

export const YouTubeShortsDownloaderView: React.FC = () => (
  <GenericPlatformView
    platformName="YouTube Shorts"
    badge="Vertical Shorts HD"
    canonicalPath="/youtube-shorts-downloader"
    seoTitle="YouTube Shorts Downloader – Download Shorts Videos in HD | VideoFetch"
    seoDescription="Download vertical YouTube Shorts in Full HD MP4 format. VideoFetch provides fast, clean downloads for short-form video content."
    heading="YouTube Shorts Downloader"
    subtitle="Save high-definition vertical YouTube Shorts in standard MP4 format for offline viewing and archiving."
    descriptionText="YouTube Shorts are vertical 9:16 format videos up to 60 seconds long. VideoFetch analyzes the Shorts URL, extracts the highest available 1080p vertical stream, and delivers a clean MP4 file ready for playback."
    faqs={[
      { question: 'How do I download a YouTube Shorts video?', answer: 'Copy the share link of any YouTube Short, paste it into the VideoFetch search bar, and click Download.' },
      { question: 'Does it save the audio track?', answer: 'Yes, the full stereo audio track is included in the MP4 video, or you can extract the audio separately as an MP3.' },
    ]}
  />
);

export const TikTokDownloaderView: React.FC = () => (
  <GenericPlatformView
    platformName="TikTok"
    badge="TikTok HD Video & MP3"
    canonicalPath="/tiktok-video-downloader"
    seoTitle="TikTok Video Downloader – Download Supported Videos | VideoFetch"
    seoDescription="Download supported TikTok videos in high-definition MP4 format or extract background audio to MP3 with VideoFetch."
    heading="TikTok Video Downloader"
    subtitle="Download supported TikTok videos in HD MP4 or extract original audio tracks in seconds."
    descriptionText="VideoFetch provides clean extraction for supported TikTok videos and sounds. Simply paste any TikTok link to inspect the video, select your preferred quality, and download the full video or audio track."
    faqs={[
      { question: 'Can I extract the audio or sound from a TikTok video?', answer: 'Yes, VideoFetch lets you download either the full MP4 video or extract the background sound as an MP3 file.' },
      { question: 'Does VideoFetch work with mobile TikTok links?', answer: 'Yes, both desktop links and mobile app share links (vm.tiktok.com or vt.tiktok.com) are supported.' },
    ]}
  />
);

export const InstagramDownloaderView: React.FC = () => (
  <GenericPlatformView
    platformName="Instagram"
    badge="Reels & Video Posts"
    canonicalPath="/instagram-video-downloader"
    seoTitle="Instagram Video Downloader – Download Reels & Videos | VideoFetch"
    seoDescription="Download supported Instagram Reels and video posts in HD MP4 format with VideoFetch. Fast, secure, and easy to use."
    heading="Instagram Video Downloader"
    subtitle="Save supported Instagram Reels, Clips, and video posts in high-definition MP4."
    descriptionText="Save your favorite public Instagram Reels and video clips for offline access. VideoFetch extracts the highest quality video stream and packages it as an MP4 file with AAC audio."
    faqs={[
      { question: 'Can I download Instagram Reels?', answer: 'Yes, paste the link of any public Instagram Reel to download it in HD MP4.' },
      { question: 'Can VideoFetch download private Instagram accounts?', answer: 'No, VideoFetch strictly respects privacy and only processes public, permissible media.' },
    ]}
  />
);

export const XTwitterDownloaderView: React.FC = () => (
  <GenericPlatformView
    platformName="X (Twitter)"
    badge="X (Twitter) HD Clips"
    canonicalPath="/x-video-downloader"
    seoTitle="X Video Downloader – Download Twitter Videos in HD | VideoFetch"
    seoDescription="Download videos and clips from X (formerly Twitter) in HD MP4 format. Simple, fast, and secure media tool by VideoFetch."
    heading="X (Twitter) Video Downloader"
    subtitle="Download high-definition videos, clips, and GIFs from X (Twitter) in universal MP4 format."
    descriptionText="VideoFetch makes saving videos from X simple. Paste the link of any post containing video content to inspect resolutions up to 1080p and download directly to your device."
    faqs={[
      { question: 'How do I copy a video link from X/Twitter?', answer: 'Click the share button under the post, choose Copy Link to Post, and paste it into VideoFetch.' },
      { question: 'What format are X videos saved in?', answer: 'Videos are saved in universal MP4 format with H.264 video and AAC stereo audio.' },
    ]}
  />
);

export const VimeoDownloaderView: React.FC = () => (
  <GenericPlatformView
    platformName="Vimeo"
    badge="Vimeo Cinematic 1080p & 4K"
    canonicalPath="/vimeo-video-downloader"
    seoTitle="Vimeo Video Downloader – Download HD & 4K Vimeo Videos | VideoFetch"
    seoDescription="Download public Vimeo videos in pristine 1080p and 4K quality with VideoFetch. Fast and reliable video downloader."
    heading="Vimeo Video Downloader"
    subtitle="Download public Vimeo videos in high bitrates up to 4K Ultra HD for cinematic offline viewing."
    descriptionText="Vimeo is popular for high-bitrate artistic and corporate films. VideoFetch allows creators and archivers to download public Vimeo content in original quality."
    faqs={[
      { question: 'Does VideoFetch support 1080p and 4K Vimeo videos?', answer: 'Yes, if the creator uploaded 1080p or 4K versions and allowed public streaming, VideoFetch provides direct MP4 access.' },
    ]}
  />
);

export const PinterestDownloaderView: React.FC = () => (
  <GenericPlatformView
    platformName="Pinterest"
    badge="Pinterest Video Pins"
    canonicalPath="/pinterest-video-downloader"
    seoTitle="Pinterest Video Downloader – Download Video Pins in HD | VideoFetch"
    seoDescription="Download supported Pinterest video pins in HD MP4 format. Save video tutorials, DIY clips, and recipes with VideoFetch."
    heading="Pinterest Video Downloader"
    subtitle="Download high-definition Pinterest video pins in MP4 format for offline viewing."
    descriptionText="Pinterest is filled with inspiring recipes, tutorials, and DIY ideas. VideoFetch helps you save supported video pins directly to your camera roll or computer in MP4 format."
    faqs={[
      { question: 'Can I download Pinterest videos on iPhone?', answer: 'Yes, open Safari on iPhone, paste your Pinterest video pin link into VideoFetch, and tap download to save to your Files or Photos.' },
    ]}
  />
);

export const BilibiliDownloaderView: React.FC = () => (
  <GenericPlatformView
    platformName="Bilibili"
    badge="Bilibili 1080p HD"
    canonicalPath="/bilibili-video-downloader"
    seoTitle="Bilibili Video Downloader – Download Bilibili Videos | VideoFetch"
    seoDescription="Download public Bilibili videos and audio tracks in high-definition MP4 format with VideoFetch."
    heading="Bilibili Video Downloader"
    subtitle="Save public Bilibili videos and animations in high-definition MP4 with audio."
    descriptionText="VideoFetch supports public Bilibili video streams, extracting the video and audio multiplex to provide clean, portable MP4 files."
    faqs={[
      { question: 'Does VideoFetch support Bilibili short links?', answer: 'Yes, both full Bilibili video URLs and b23.tv short links are recognized and resolved.' },
    ]}
  />
);
