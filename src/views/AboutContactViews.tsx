import React, { useState } from 'react';
import {
  Zap,
  ShieldCheck,
  Cpu,
  Mail,
  MessageSquare,
  Send,
  CheckCircle2,
  Lock,
  Scissors,
  Video,
  Music,
  FileText,
  ImageIcon,
  Scale,
  AlertTriangle,
  LifeBuoy,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SEOHead } from '../components/SEOHead';
import { Breadcrumbs } from '../components/Breadcrumbs';

export const AboutView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <SEOHead
        title="About VideoFetch – Media Utilities, Philosophy & Architecture"
        description="Learn what VideoFetch does, review its supported media tools, and read about service limitations and responsible use."
        canonicalPath="/about"
        breadcrumbs={[{ name: 'About VideoFetch', url: '/about' }]}
      />

      <Breadcrumbs items={[{ name: 'About VideoFetch' }]} />

      <div className="text-center space-y-3">
        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
          Our Architecture &amp; Standards
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          About VideoFetch
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Fast, transparent, and privacy-conscious media tools for creators, researchers, and everyday web users.
        </p>
      </div>

      <div className="p-8 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-8 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        {/* Purpose of the Service */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2.5">
            Purpose of the Service
          </h2>
          <p>
            VideoFetch is a specialized online media processing platform created to simplify the extraction, format conversion, trimming, and archiving of authorized streaming media. Many legacy online converters force users through deceptive advertisements, malicious pop-ups, and obfuscated download links. VideoFetch was built to provide an honest, clean, and reliable alternative: a fast utility where users can inspect media streams, choose their desired format and quality, and process files quickly.
          </p>
        </div>

        {/* Main Tools Overview */}
        <div className="pt-6 border-t border-slate-200/70 dark:border-slate-800/70">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
            Main Tools &amp; Capabilities
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Video className="w-4 h-4 text-indigo-500" />
                <span>Online Video Downloader</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inspect public streams and extract pristine MP4 video files in resolutions ranging from 360p to 1080p and 4K Ultra HD.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Music className="w-4 h-4 text-emerald-500" />
                <span>Audio Extractor &amp; MP3 Converter</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Demux audio tracks with high-fidelity LAME MP3 conversion, supporting 128 kbps, 192 kbps, 256 kbps, and studio 320 kbps.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Scissors className="w-4 h-4 text-violet-500" />
                <span>Video &amp; Audio Trimmer</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Interactive timeline controls to preview keyframes and extract custom video or audio clips without re-encoding overhead.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-500" />
                <span>Thumbnail &amp; Subtitle Extractor</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Save high-resolution cover artwork and export timed subtitle tracks in SRT, WebVTT, and plain text transcripts.
              </p>
            </div>
          </div>
        </div>

        {/* User Experience Philosophy */}
        <div className="pt-6 border-t border-slate-200/70 dark:border-slate-800/70">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2.5">
            User Experience Philosophy
          </h2>
          <p>
            We believe productivity tools should respect user focus. VideoFetch does not use deceptive &quot;fake download&quot; buttons, misleading notifications, or intrusive overlays. The interface features a subtle, calming atmospheric background designed to make long research and media management sessions pleasant, while ensuring that the central downloader and conversion controls remain intuitive, accessible, and fast on mobile, tablet, and desktop screens.
          </p>
        </div>

        {/* Privacy & Security Approach */}
        <div className="pt-6 border-t border-slate-200/70 dark:border-slate-800/70">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2.5">
            Privacy &amp; Security Approach
          </h2>
          <p>
            VideoFetch processes submitted links and keeps operational records needed to run the service. See the Privacy Policy for the data the application stores and the retention details that are currently known.
          </p>
          <ul className="list-disc list-inside mt-3 space-y-2 text-xs sm:text-sm pl-2">
            <li>
              <strong>Optional accounts:</strong> Some functions can be used without signing in; account features process the details provided during registration.
            </li>
            <li>
              <strong>Temporary jobs:</strong> Download jobs are assigned a 15-minute expiry, and the application attempts to clean up associated media after expiry.
            </li>
            <li>
              <strong>Request records:</strong> Operational and audit records can contain request IP addresses and media source details.
            </li>
            <li>
              <strong>Security limits:</strong> URL validation and file checks reduce specific risks; they do not guarantee that all outbound-network risks have been eliminated.
            </li>
          </ul>
        </div>

        {/* Responsible & Legal Use */}
        <div className="pt-6 border-t border-slate-200/70 dark:border-slate-800/70">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2.5">
            Responsible &amp; Legal Use
          </h2>
          <p>
            VideoFetch is intended strictly for lawful, authorized purposes. It is built to serve creators downloading their own content, students and researchers analyzing public data, journalists archiving documentation, and users enjoying works licensed under Creative Commons or residing in the Public Domain.
          </p>
          <p className="mt-2">
            VideoFetch does not provide tools to crack digital rights management (DRM), bypass encryption schemes (Widevine, PlayReady, FairPlay), circumvent paywalls, or harvest private, password-protected videos. Users are solely responsible for ensuring they possess the right or license to download submitted media.
          </p>
        </div>
      </div>
    </div>
  );
};

export const ContactView: React.FC = () => {
  const { addToast } = useApp();
  const [purpose, setPurpose] = useState<'general' | 'technical' | 'dmca' | 'security'>('general');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isDraftReady, setIsDraftReady] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      addToast('error', 'Missing Information', 'Please fill in your name, email, and message.');
      return;
    }

    const purposeLabel = {
      general: 'General question',
      technical: 'Technical issue',
      dmca: 'Copyright or DMCA',
      security: 'Security report',
    }[purpose];
    const emailSubject = `[${purposeLabel}] ${subject.trim() || 'VideoFetch inquiry'}`;
    const emailBody = `Name: ${name.trim()}\nReply email: ${email.trim()}\n\n${message.trim()}`;
    window.location.href = `mailto:virendrthakor8@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    setIsDraftReady(true);
    addToast('info', 'Review your email draft', 'Send the draft from your email app; the website does not send it automatically.');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <SEOHead
        title="Contact VideoFetch – Support, DMCA & Inquiries"
        description="Prepare an email to report a VideoFetch issue, ask a question, or send a copyright or security inquiry."
        canonicalPath="/contact"
        breadcrumbs={[{ name: 'Contact & Support', url: '/contact' }]}
      />

      <Breadcrumbs items={[{ name: 'Contact & Support' }]} />

      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Contact &amp; Support
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
          Have an inquiry, technical feedback, or a copyright inquiry? Reach out to us directly.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Contact Info Sidebar */}
        <div className="space-y-4 md:col-span-1">
          <div className="p-6 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Direct Email
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              For direct communication, you can reach our administration at:
            </p>
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
                <a href="mailto:virendrthakor8@gmail.com" className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 select-all block break-all underline">
                virendrthakor8@gmail.com
                </a>
            </div>
            <div className="text-[11px] text-slate-500 space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <p>• Response times vary.</p>
              <p>• Please specify your topic in the subject line.</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <LifeBuoy className="w-4 h-4 text-emerald-500" />
              <span>Inquiry Categories</span>
            </div>
            <p>
              Choose a purpose to label the subject of the email draft.
            </p>
          </div>
        </div>

        {/* Contact Form */}
        <div className="md:col-span-2 p-6 sm:p-8 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl">
          {isDraftReady ? (
            <div className="text-center py-10 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Email Draft Requested</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Your device may open an email draft addressed to VideoFetch. Review it and press Send in your email app; the website has not sent or stored this message. If no email app opened, email <a href="mailto:virendrthakor8@gmail.com" className="font-semibold text-slate-900 dark:text-white underline">VideoFetch directly</a>.
              </p>
              <button
                onClick={() => {
                  setIsDraftReady(false);
                  setName('');
                  setEmail('');
                  setSubject('');
                  setMessage('');
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm cursor-pointer"
              >
                Prepare Another Inquiry
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Inquiry Purpose *
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'general', label: 'General Questions', icon: <MessageSquare className="w-3.5 h-3.5" /> },
                    { id: 'technical', label: 'Technical Problems', icon: <Zap className="w-3.5 h-3.5" /> },
                    { id: 'dmca', label: 'Copyright / DMCA', icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> },
                    { id: 'security', label: 'Security Reports', icon: <Lock className="w-3.5 h-3.5 text-indigo-500" /> },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPurpose(opt.id as any)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                        purpose === opt.id
                          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-semibold ring-1 ring-indigo-500/30'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {opt.icon}
                      <span className="truncate">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Your Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Summary of your inquiry or issue"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Message *
                </label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Please provide full details so we can address your inquiry accurately..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <p className="text-xs text-slate-500" role="note">
                This form opens a draft in your email app. Nothing is sent or stored by the website unless you send the email.
              </p>

              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Open Email Draft</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
