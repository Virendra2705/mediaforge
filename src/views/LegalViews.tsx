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
  const [copyrightWorkDescription, setCopyrightWorkDescription] = useState('');
  const [ownershipProofDescription, setOwnershipProofDescription] = useState('');
  const [reason, setReason] = useState('');
  const [goodFaithStatement, setGoodFaithStatement] = useState(false);
  const [accuracyStatement, setAccuracyStatement] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimantName.trim() || !claimantEmail.trim() || !targetUrl.trim() ||
      copyrightWorkDescription.trim().length < 10 || ownershipProofDescription.trim().length < 10 ||
      reason.trim().length < 5 || !goodFaithStatement || !accuracyStatement) {
      addToast('error', 'Missing Fields', 'Please complete all required fields and accept the statutory declaration.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complainantName: claimantName.trim(),
          email: claimantEmail.trim(),
          targetUrl: targetUrl.trim(),
          copyrightWorkDescription: copyrightWorkDescription.trim(),
          ownershipProofDescription: ownershipProofDescription.trim(),
          reason: reason.trim(),
          goodFaithStatement,
          accuracyStatement,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success === true && typeof data.data?.reportId === 'string') {
        setSubmittedId(data.data.reportId);
        addToast('success', 'Submission Confirmed', 'The application confirmed receipt of your notice.');
      } else {
        const message = typeof data.error === 'string' ? data.error : data.error?.message;
        addToast('error', 'Submission Failed', message || 'The application could not confirm receipt. Please use the direct contact email.');
      }
    } catch {
      addToast('error', 'Submission Not Confirmed', 'The website could not confirm receipt. Please use the direct contact email to submit your notice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <SEOHead
        title="Copyright Policy and Notice Form | VideoFetch"
        description="Read the VideoFetch copyright policy and submit a notice through the available form or contact address."
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
            1. Service Overview
          </h2>
          <p>
            VideoFetch is a technical utility for user-initiated media analysis and processing. It is not a public media gallery. Processing and storage details, including known expiry behavior and its limits, are described in the Privacy Policy.
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
            A successful form response confirms that the application accepted the notice for review; it does not establish a review deadline or guarantee that a URL or domain has been blocked. Contact the listed email address if the form does not confirm receipt.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            4. Repeat Infringement Handling
          </h2>
          <p>
            This site does not describe a verified repeat-infringer process or permanent blocklist. Notices are handled according to applicable requirements and the information available to the operator.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            5. Designated Contact Method
          </h2>
          <p>
            Written notices may be sent to the direct contact email below or submitted through the notice form. A form submission is confirmed only when the application returns a successful response.
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
            Complete all required fields. The application will confirm receipt only if it accepts the notice; submission does not guarantee a review outcome or that a source will be blocked.
          </p>

          {submittedId ? (
            <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <h4 className="text-base font-bold text-slate-900 dark:text-white">Submission Confirmed</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                {submittedId !== 'Submission confirmed' && <>Reference ID: <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{submittedId}</span>. </>}
                The application confirmed receipt. This confirmation does not represent a review decision or a promise that a source has been blocked.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Electronic Signature / Full Legal Name *
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
                  URL or Stream Identifying the Alleged Infringement *
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
                  Identification of the Copyrighted Work *
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={10}
                  value={copyrightWorkDescription}
                  onChange={e => setCopyrightWorkDescription(e.target.value)}
                  placeholder="Identify the copyrighted work or provide a representative list."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Basis of Ownership or Authority to Act *
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={10}
                  value={ownershipProofDescription}
                  onChange={e => setOwnershipProofDescription(e.target.value)}
                  placeholder="Describe your ownership or authority and any supporting evidence."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Explanation of the Claimed Infringement *
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={5}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Explain why the identified URL infringes the work."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={goodFaithStatement}
                    onChange={e => setGoodFaithStatement(e.target.checked)}
                    className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-slate-600 dark:text-slate-400">
                    I have a good-faith belief that the use of the material described above is not authorized by the copyright owner, its agent, or the law.
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={accuracyStatement}
                    onChange={e => setAccuracyStatement(e.target.checked)}
                    className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-slate-600 dark:text-slate-400">
                    The information in this notice is accurate, and under penalty of perjury I am the owner or authorized to act on behalf of the owner of the allegedly infringed exclusive right.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !goodFaithStatement || !accuracyStatement}
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
              <strong>Submitted media links:</strong> The service receives the URL and related media metadata needed to analyze a supported link. Operational audit records may include the request IP address, source hostname, or media title, so we cannot promise that request activity is never associated with technical identifiers.
            </li>
            <li>
              <strong>Accounts:</strong> Some features can be used without an account. If you register or sign in, the service processes the account details you submit, such as your name and email address, and stores a password hash rather than the original password.
            </li>
            <li>
              <strong>Communications and reports:</strong> If you email us or submit a contact, copyright, or security report, we receive the information and attachments you choose to send. Contact and report records may be stored in the application's database for review.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">2. Server Logs &amp; Technical Request Data</h2>
          <p>
            The application creates operational and audit records for service operation and abuse handling. Depending on the event, records can include:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Request IP address and event timestamps</li>
            <li>Media source hostname or title for analysis audit events</li>
            <li>Email address for contact events and identifying details for copyright reports</li>
          </ul>
          <p className="pt-1">
            Audit records can be persisted in the configured application database. This repository does not define a fixed retention period or automatic deletion schedule for all operational, contact, or report records. Hosting providers may maintain separate infrastructure logs under their own retention rules.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">3. Local Storage &amp; Cookies</h2>
          <p>
            The browser stores interface preferences and recent-job summaries in <code>localStorage</code>. These entries include:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Color theme, interface language, background scene, and motion preference</li>
            <li>Cookie-consent choice and recent-job summaries</li>
          </ul>
          <p className="pt-1">
            Signed-in sessions use an HTTP-only session cookie with a configured 72-hour lifetime. You can clear local storage and cookies through your browser settings; clearing them may remove saved preferences and recent-job history or sign you out.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">4. Advertising &amp; Google AdSense</h2>
          <p>
            Google AdSense may load when an advertising client is configured for the site. If enabled, Google and other advertising partners may use cookies or similar technologies under their own policies. This repository does not establish whether personalized advertising is enabled for a particular deployment.
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
            When processing a link, the application may make server-side requests to the supported media source or configured storage and database providers. Those services receive requests from the application's network and process the data needed for the request. Do not submit links or information you do not want processed by those services.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">6. Ephemeral Media Storage &amp; Data Retention</h2>
          <p>
            Analysis metadata is cached for up to one hour. Download jobs and their links are assigned a 15-minute expiry, after which the application attempts to clean up associated temporary media. Files may pass through local temporary storage or configured object storage. Cleanup depends on the application and storage provider completing the deletion; this repository does not establish a universal retention period for backups or infrastructure copies.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">7. Security Safeguards</h2>
          <p>
            The application includes URL validation, access controls, and media-file checks. These controls reduce specific risks but are not a guarantee that every security issue or outbound-network risk has been eliminated.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">8. User Rights (GDPR, CCPA &amp; Global Standards)</h2>
          <p>
            Depending on your jurisdiction, you may have rights to request access to, correction of, or deletion of personal information. Requests can be sent to the contact address below. We will review requests against applicable requirements and the records available to us.
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
        title="Application Security Controls and Limitations | VideoFetch"
        description="An overview of application-level validation controls and their limitations. This page is not a security certification or guarantee."
        canonicalPath="/security"
        noindex
        breadcrumbs={[{ name: 'Security Architecture', url: '/security' }]}
      />

      <Breadcrumbs items={[{ name: 'Security' }]} />

      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Application Controls and Limitations</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
          Application Security Notes
        </h1>
        <p className="text-sm text-slate-500">
          A brief description of selected application controls. This page is not a security certification or a guarantee about the deployed service.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-base text-slate-900 dark:text-white">SSRF Defense &amp; IP Filtering</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            The application validates URLs and checks network addresses before some requests. These checks reduce certain risks but do not guarantee that every outbound path is controlled. Outbound-egress enforcement still has a known unresolved gap.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <FileCheck className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-base text-slate-900 dark:text-white">Magic Byte &amp; Container Inspection</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            The application checks media signatures in selected processing paths to help reject unexpected responses. This is one validation measure and cannot establish that all content is safe.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-base text-slate-900 dark:text-white">FFprobe Codec Verification</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Some generated media files are checked with FFprobe for expected stream information. The check is limited to those processing paths and is not a guarantee that every artifact or source is safe.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Key className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-base text-slate-900 dark:text-white">Cryptographic HMAC Tokens</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            The application uses authorization checks for download links and assigns jobs a temporary expiry. Cleanup is attempted, but deletion timing can depend on configured storage and infrastructure.
          </p>
        </div>
      </div>
    </div>
  );
};
