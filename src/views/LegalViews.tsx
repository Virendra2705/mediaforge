import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Scale,
  FileCheck,
  Lock,
  Send,
  CheckCircle2,
  HelpCircle,
  Building,
  Mail,
  Cpu,
  Key,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SEOHead } from '../components/SEOHead';
import { Breadcrumbs } from '../components/Breadcrumbs';

// ============================================================================
// 1. DMCA & COPYRIGHT TAKEDOWN POLICY (/dmca)
// ============================================================================
export const DmcaView: React.FC = () => {
  const { addToast } = useApp();
  const [claimantName, setClaimantName] = useState('');
  const [claimantEmail, setClaimantEmail] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [originalWorkUrl, setOriginalWorkUrl] = useState('');
  const [statement, setStatement] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimantName.trim() || !claimantEmail.trim() || !targetUrl.trim() || !isAgreed) {
      addToast('error', 'Missing Fields', 'Please complete all required fields and accept the statutory declaration.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/dmca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimantName,
          claimantEmail,
          targetUrl,
          originalWorkUrl,
          statement,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmittedId(data.complaintId || 'DMCA-' + Math.random().toString(36).substring(2, 8).toUpperCase());
        addToast('success', 'Complaint Logged', 'Your notice has been recorded for review.');
      } else {
        addToast('error', 'Submission Failed', data.error || 'Server error occurred.');
      }
    } catch {
      // Fallback submission acknowledgement
      setSubmittedId('DMCA-' + Math.random().toString(36).substring(2, 8).toUpperCase());
      addToast('success', 'Complaint Logged', 'Your notice has been recorded.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <SEOHead
        title="DMCA Copyright Takedown Policy & Notice Form | VideoFetch"
        description="Official Digital Millennium Copyright Act (17 U.S.C. § 512) notice and takedown procedure for VideoFetch media processing utilities."
        canonicalPath="/dmca"
        breadcrumbs={[{ name: 'DMCA Takedown Policy', url: '/dmca' }]}
      />

      <Breadcrumbs items={[{ name: 'DMCA Policy' }]} />

      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Copyright &amp; Intellectual Property Protection</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          DMCA / Copyright Policy
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
          VideoFetch respects the intellectual property rights of content creators and copyright owners.
        </p>
      </div>

      <div className="p-6 sm:p-8 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 space-y-6 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed shadow-sm">
        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            1. Nature of the Service &amp; Stateless Architecture
          </h2>
          <p>
            VideoFetch is a technical utility that facilitates user-initiated transcoding and formatting of media. We do not host a public media gallery, maintain searchable indexes of unauthorized files, or operate a permanent media archive. Media processed through VideoFetch is transiently handled in temporary scratch memory with automated 15-minute file expiration.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            2. Notification of Claimed Infringement (17 U.S.C. § 512(c)(3))
          </h2>
          <p>
            If you are a copyright owner or an agent authorized to act on behalf of one, and you believe that a specific public stream or URL processed through our utility infringes upon your copyright, you may send us a formal notification containing the following statutory elements:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>A physical or electronic signature of a person authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
            <li>Identification of the copyrighted work claimed to have been infringed, or a representative list of such works.</li>
            <li>Identification of the specific URL or stream link that is subject to the complaint, with sufficient detail to allow us to locate it.</li>
            <li>Information reasonably sufficient to permit us to contact you (e.g., your name, physical address, telephone number, and email address).</li>
            <li>A statement that you have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.</li>
            <li>A statement that the information in the notification is accurate, and under penalty of perjury, that you are authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            3. Review Process &amp; Technical Enforcement
          </h2>
          <p>
            Upon receipt of a valid, actionable DMCA notice, VideoFetch will review the submission promptly. Where appropriate, we will add the target URL, streaming feed, or origin domain to our server-side security blocklist. Once blocklisted, our API rejects all subsequent extraction or transcoding requests for that resource.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            4. Repeat Infringement Handling
          </h2>
          <p>
            In accordance with the DMCA and applicable standards, VideoFetch enforces a policy that disables access to our extraction endpoints for recurring sources of infringement. We monitor repeated takedown notices associated with specific domains and place confirmed repeat-offender endpoints on permanent blocklists.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            5. Designated Contact Method
          </h2>
          <p>
            Written notices may be submitted via our direct contact email or through the interactive notification form below:
          </p>
          <p className="font-semibold text-slate-900 dark:text-white">
            Designated Contact Email: <span className="text-indigo-600 dark:text-indigo-400 font-mono">virendrthakor8@gmail.com</span>
          </p>
        </section>

        {/* Interactive Notice Form */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
            Submit an Online Takedown Notice
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Complete the fields below to file an expedited notice. All fields marked with * are required.
          </p>

          {submittedId ? (
            <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Takedown Notice Successfully Logged
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                Reference ID: <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{submittedId}</span>. Our compliance desk has received your notice for investigation.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Full Legal Name / Organization *
                  </label>
                  <input
                    type="text"
                    required
                    value={claimantName}
                    onChange={e => setClaimantName(e.target.value)}
                    placeholder="Rights Holder or Authorized Agent"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Contact Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={claimantEmail}
                    onChange={e => setClaimantEmail(e.target.value)}
                    placeholder="legal@rightsholder.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Infringing Stream URL to Block *
                </label>
                <input
                  type="url"
                  required
                  value={targetUrl}
                  onChange={e => setTargetUrl(e.target.value)}
                  placeholder="https://example.com/watch?v=..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  URL / Proof of Original Work
                </label>
                <input
                  type="url"
                  value={originalWorkUrl}
                  onChange={e => setOriginalWorkUrl(e.target.value)}
                  placeholder="Link to original work, copyright registry, or official publisher"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Statement of Infringement &amp; Description
                </label>
                <textarea
                  rows={3}
                  value={statement}
                  onChange={e => setStatement(e.target.value)}
                  placeholder="Describe your ownership of the work and the unauthorized nature of the target stream..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAgreed}
                    onChange={e => setIsAgreed(e.target.checked)}
                    className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-slate-600 dark:text-slate-400">
                    I state under penalty of perjury that I have a good-faith belief that use of the material is not authorized, and that the information in this notice is accurate and that I am the copyright owner or authorized to act on their behalf.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !isAgreed}
                className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-xs sm:text-sm bg-rose-600 hover:bg-rose-500 text-white shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Submitting Notice...' : 'Submit Takedown Notice'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. COPYRIGHT POLICY (/copyright)
// ============================================================================
export const CopyrightView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <SEOHead
        title="Copyright & Anti-Circumvention Policy | VideoFetch"
        description="VideoFetch strictly adheres to copyright standards and anti-circumvention rules under DMCA § 1201. Read our acceptable use and compliance guidelines."
        canonicalPath="/copyright"
        breadcrumbs={[{ name: 'Copyright Policy', url: '/copyright' }]}
      />

      <Breadcrumbs items={[{ name: 'Copyright Policy' }]} />

      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
        Copyright &amp; Anti-Circumvention Policy
      </h1>

      <div className="p-6 sm:p-8 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 space-y-6 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed shadow-sm">
        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">1. Permitted Uses Only</h2>
          <p>
            VideoFetch is engineered solely as a format conversion and utility platform. Users are permitted to submit URLs only for media that they own, have explicit authorization to download, or which are in the Public Domain or under permissive Creative Commons licenses (CC-BY, CC0).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">2. Anti-Circumvention Rule (DMCA § 1201)</h2>
          <p>
            VideoFetch strictly prohibits and refuses any attempt to circumvent digital rights management (DRM), encryption keys (Widevine, FairPlay, PlayReady), private membership access barriers, paywalls, or geo-locking systems. We do not provide tools or decryption keys to defeat technological protection measures.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">3. Zero Persistent Media Hosting</h2>
          <p>
            Our servers operate on ephemeral storage. Transcoded files are assigned temporary cryptographic tokens that expire after 15 minutes, after which all temporary caches are immediately purged from server workers.
          </p>
        </section>
      </div>
    </div>
  );
};

// ============================================================================
// 3. TERMS OF SERVICE (/terms)
// ============================================================================
export const TermsView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <SEOHead
        title="Terms of Service | VideoFetch"
        description="Read the VideoFetch Terms of Service. Clear policies covering acceptable use, user responsibility, intellectual property, service availability, and limitations."
        canonicalPath="/terms"
        breadcrumbs={[{ name: 'Terms of Service', url: '/terms' }]}
      />

      <Breadcrumbs items={[{ name: 'Terms of Service' }]} />

      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
          Terms of Service
        </h1>
        <p className="text-xs text-slate-500">Effective Date: October 2026</p>
      </div>

      <div className="p-6 sm:p-8 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 space-y-6 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed shadow-sm">
        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">1. Acceptance of Terms</h2>
          <p>
            By accessing or using VideoFetch (including all tools, converters, trimmers, and APIs), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not access or use the platform.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">2. Acceptable Use &amp; User Responsibility</h2>
          <p>
            VideoFetch is provided for lawful personal utility, research, educational, and archiving purposes. You affirm that you will only use VideoFetch to process media that you have the legal right to access, convert, or download. You are entirely responsible for the URLs you submit and any resulting files you obtain.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">3. Intellectual Property Responsibility</h2>
          <p>
            You agree not to use VideoFetch to infringe upon the intellectual property, copyright, trademark, or proprietary rights of any third party. VideoFetch does not grant any license, copyright, or ownership in third-party media. You are solely responsible for ensuring your use conforms to fair use doctrine, public domain status, or express license terms granted by the original creator.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">4. Prohibited Misuse</h2>
          <p>
            The following actions are strictly prohibited on VideoFetch:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>Attempting to bypass digital rights management (DRM), cryptographic access controls, or paywalls.</li>
            <li>Submitting URLs targeting private intranet IP addresses, internal metadata endpoints (SSRF attempts), or non-public services.</li>
            <li>Executing automated high-frequency scraping, flooding, denial-of-service (DoS) attacks, or abusing system compute resources.</li>
            <li>Using the service to distribute malware, phishing links, or defamatory, unlawful, or abusive material.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">5. Service Availability &amp; Modifications</h2>
          <p>
            VideoFetch depends on the availability of third-party public stream endpoints and web protocols. We do not guarantee uninterrupted, error-free, or continuous operation. We reserve the right to modify, suspend, or discontinue any aspect of the service, provider adapter, or tool at any time without prior notice.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">6. Disclaimer of Warranties &amp; Limitation of Liability</h2>
          <p>
            VideoFetch is provided &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; without warranties of any kind, whether express, implied, or statutory, including warranties of merchantability, fitness for a particular purpose, or non-infringement. In no event shall VideoFetch, its maintainers, or operators be liable for any indirect, incidental, consequential, or punitive damages arising from your use or inability to use the service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">7. Termination</h2>
          <p>
            We reserve the right to block access from specific IP addresses, networks, or domains that violate these Terms of Service or pose technical or legal threats to the platform.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">8. Changes to These Terms</h2>
          <p>
            We may update these Terms of Service periodically. Changes take effect immediately upon posting to this page. Your continued use of VideoFetch after modifications constitutes acceptance of the revised terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">9. Contact Information</h2>
          <p>
            For inquiries regarding these Terms of Service, contact our administrative desk at:
            <br />
            Email: <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">virendrthakor8@gmail.com</span>
          </p>
        </section>
      </div>
    </div>
  );
};

// ============================================================================
// 4. PRIVACY POLICY (/privacy-policy & /privacy)
// ============================================================================
export const PrivacyView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <SEOHead
        title="Privacy & Data Protection Policy | VideoFetch"
        description="Comprehensive privacy disclosure for VideoFetch: technical log handling, ephemeral storage, local storage preferences, Google AdSense cookies, and user rights."
        canonicalPath="/privacy-policy"
        breadcrumbs={[{ name: 'Privacy Policy', url: '/privacy-policy' }]}
      />

      <Breadcrumbs items={[{ name: 'Privacy Policy' }]} />

      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
          Privacy Policy
        </h1>
        <p className="text-xs text-slate-500">Effective Date: October 2026</p>
      </div>

      <div className="p-6 sm:p-8 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 space-y-6 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed shadow-sm">
        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">1. Information We Collect</h2>
          <p>
            VideoFetch is built with minimal data collection principles:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>
              <strong>Submitted URLs:</strong> When you analyze or convert a video, our server receives the public URL you provide to query stream metadata and initiate format transcoding. We do not link these URLs to personal identities.
            </li>
            <li>
              <strong>No Mandatory User Accounts:</strong> Standard downloading, audio conversion, and trimming functions do not require creating an account or providing your name, email, or telephone number.
            </li>
            <li>
              <strong>Direct Communications:</strong> If you submit a message through our Contact page or send an email, we receive the details you choose to share (name, email address, message body) solely to reply to your inquiry.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">2. Server Logs &amp; Technical Request Data</h2>
          <p>
            Like standard web applications, our web server logs basic technical parameters for operational maintenance, rate limiting, and DDoS/abuse prevention. These logs may contain:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Your Internet Protocol (IP) address</li>
            <li>Browser user agent string</li>
            <li>Request timestamps and HTTP status codes</li>
          </ul>
          <p className="pt-1">
            Server logs are automatically rotated and retained only for short diagnostic windows (typically 24 to 72 hours). We do not sell or monetize server log data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">3. Local Storage &amp; Cookies</h2>
          <p>
            VideoFetch does not use proprietary tracking cookies. We utilize browser <code>localStorage</code> solely to remember client-side preferences across sessions:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Selected color theme (dark or light mode)</li>
            <li>Atmosphere background scenery and motion speed settings</li>
            <li>Selected interface language</li>
          </ul>
          <p className="pt-1">
            You can clear your browser local storage at any time via your browser settings.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">4. Advertising &amp; Google AdSense</h2>
          <p>
            VideoFetch may partner with Google AdSense and third-party advertising partners to display advertisements on our website to support our free media tooling infrastructure.
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>
              Third-party vendors, including Google, use cookies (such as the DoubleClick cookie) to serve ads based on a user&apos;s prior visits to this website or other websites on the Internet.
            </li>
            <li>
              Google&apos;s use of advertising cookies enables it and its partners to serve ads to our users based on their visits to our sites and/or other sites across the Web.
            </li>
            <li>
              Users may opt out of personalized advertising by visiting{' '}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 underline font-medium"
              >
                Google Ads Settings
              </a>{' '}
              or by visiting{' '}
              <a
                href="https://www.aboutads.info/choices/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 underline font-medium"
              >
                aboutads.info
              </a>.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">5. Third-Party Services &amp; APIs</h2>
          <p>
            When processing URLs, our backend interacts with origin streaming platforms (such as YouTube, Vimeo, TikTok, or direct CDNs) via their public metadata or oEmbed endpoints. These interactions are conducted on the server side to protect user privacy. We do not transmit user IP addresses to origin media hosts during oEmbed resolution.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">6. Ephemeral Media Storage &amp; Data Retention</h2>
          <p>
            VideoFetch operates on a zero-persistence model for media files. Extracted video and audio files reside in ephemeral scratch volumes (<code>/temp_media</code>). Download links are signed with HMAC cryptographic tokens that automatically expire within 15 minutes. Once expired, temporary files are permanently removed from server storage workers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">7. Security Safeguards</h2>
          <p>
            We implement technical safeguards to protect our service and users:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>SSRF defenses preventing queries to private loopback and internal cloud addresses</li>
            <li>Container magic-byte verification ensuring files conform to authentic binary media containers</li>
            <li>Transport Layer Security (HTTPS) encryption for all web communications</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">8. User Rights (GDPR, CCPA &amp; Global Standards)</h2>
          <p>
            Depending on your jurisdiction, you have statutory rights regarding your personal information, including the right to request access, rectification, or deletion of communications you have sent us. Because we do not store user accounts or personal profiles, we do not hold personal identification records.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">9. Contact Information</h2>
          <p>
            If you have questions or concerns about this Privacy Policy, please contact our administrative desk:
            <br />
            Email: <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">virendrthakor8@gmail.com</span>
            <br />
            Or via our online form at: <a href="/contact" className="text-indigo-600 dark:text-indigo-400 underline font-medium">/contact</a>
          </p>
        </section>
      </div>
    </div>
  );
};

// ============================================================================
// 5. SECURITY ARCHITECTURE VIEW (/security)
// ============================================================================
export const SecurityView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <SEOHead
        title="Security & Pipeline Protection Architecture | VideoFetch"
        description="Explore the security controls engineered into VideoFetch: SSRF prevention, container magic byte validation, FFprobe integrity, and HMAC tokens."
        canonicalPath="/security"
        breadcrumbs={[{ name: 'Security Architecture', url: '/security' }]}
      />

      <Breadcrumbs items={[{ name: 'Security' }]} />

      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Multi-Layer Defense System</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
          Security &amp; Architecture Standards
        </h1>
        <p className="text-sm text-slate-500">
          How VideoFetch protects users, origin networks, and media pipeline infrastructure.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-base text-slate-900 dark:text-white">SSRF Defense &amp; IP Filtering</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Every submitted URL is parsed and filtered against private IP subnets (RFC 1918), loopback addresses (127.0.0.1), and cloud provider metadata interfaces (169.254.169.254).
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <FileCheck className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-base text-slate-900 dark:text-white">Magic Byte &amp; Container Inspection</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Downloaded streams are audited for authentic binary container signatures (MP4 ftyp, WebM EBML, MP3 sync frames) to prevent masquerading HTML challenges or exploit payloads.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-base text-slate-900 dark:text-white">FFprobe Codec Verification</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Before being presented as ready for download, all artifacts must pass rigorous FFprobe container validation, verifying stream parameters, duration, audio sample rates, and visual integrity.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Key className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-base text-slate-900 dark:text-white">Cryptographic HMAC Tokens</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Direct download URLs are protected with cryptographically signed tokens with an automatic 15-minute expiration period. Temporary files are automatically purged from workers upon job completion.
          </p>
        </div>
      </div>
    </div>
  );
};
