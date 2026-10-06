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
} from 'lucide-react';
import { useApp } from '../context/AppContext';

// 1. DMCA POLICY & TAKEDOWN COMPLAINT FORM
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
    if (!claimantName || !claimantEmail || !targetUrl || !isAgreed) {
      addToast('error', 'Missing Fields', 'Please complete all required fields and accept the declaration.');
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
        addToast('success', 'Complaint Submitted', 'Your notice has been logged for immediate legal review.');
      } else {
        addToast('error', 'Submission Failed', data.error || 'Server error');
      }
    } catch {
      addToast('error', 'Error', 'Failed to communicate with DMCA handler.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>DMCA Copyright Notice System</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          DMCA / Takedown Policy
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          MediaForge respects intellectual property rights and adheres to the Digital Millennium Copyright Act (17 U.S.C. § 512).
        </p>
      </div>

      {/* Compliance Overview Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Scale className="w-4 h-4 text-blue-500" />
          Our Commitment to Creators & Rights Holders
        </h3>
        <p>
          MediaForge does not host, store, or archive unauthorized media files. Our software operates as a stateless transcoding pipeline that only processes publicly permitted stream endpoints where authors have allowed embed access or where users possess lawful rights.
        </p>
        <p>
          If you believe your copyrighted material is being indexed or made accessible through MediaForge in violation of copyright, please submit an official Notice of Claimed Infringement below.
        </p>
      </div>

      {/* Interactive DMCA Form */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Submit a Copyright Takedown Notice
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          All submissions are logged in our compliance database and reviewed within 24 business hours.
        </p>

        {submittedId ? (
          <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-300">
              Notice Logged Successfully
            </h3>
            <p className="text-xs text-emerald-800 dark:text-emerald-400 max-w-md mx-auto">
              Reference ID: <span className="font-mono font-bold">{submittedId}</span>. A confirmation has been transmitted to our compliance officers.
            </p>
            <button
              onClick={() => {
                setSubmittedId(null);
                setTargetUrl('');
                setStatement('');
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white"
            >
              Submit Another Notice
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Full Name / Copyright Owner *
                </label>
                <input
                  type="text"
                  required
                  value={claimantName}
                  onChange={e => setClaimantName(e.target.value)}
                  placeholder="e.g. Jane Doe / Studio Acme Inc."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
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
                  placeholder="legal@rightsowner.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Target URL to Blacklist/Block *
              </label>
              <input
                type="url"
                required
                value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)}
                placeholder="https://example.com/video/12345"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Original Work Link / Evidence
              </label>
              <input
                type="url"
                value={originalWorkUrl}
                onChange={e => setOriginalWorkUrl(e.target.value)}
                placeholder="https://original-publisher.com/works/my-track"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Statement of Authority & Good Faith Declaration
              </label>
              <textarea
                rows={3}
                value={statement}
                onChange={e => setStatement(e.target.value)}
                placeholder="I have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-start gap-2.5 pt-2">
              <input
                id="dmca-agree"
                type="checkbox"
                required
                checked={isAgreed}
                onChange={e => setIsAgreed(e.target.checked)}
                className="mt-1 rounded accent-blue-600"
              />
              <label htmlFor="dmca-agree" className="text-xs text-slate-600 dark:text-slate-400">
                I declare under penalty of perjury that the information in this notice is accurate and that I am the copyright owner or authorized to act on behalf of the owner.
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-xs sm:text-sm bg-rose-600 hover:bg-rose-500 text-white shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting Notice...' : 'Submit Takedown Notice'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

// 2. COPYRIGHT POLICY VIEW
export const CopyrightView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
        Copyright & Anti-Circumvention Policy
      </h1>

      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <section className="space-y-2">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">1. Permitted Uses Only</h3>
          <p>
            MediaForge is engineered solely as a format conversion and utility platform. Users are permitted to submit URLs only for media that they own, have explicit authorization to download, or which are in the Public Domain or under Creative Commons licenses (CC-BY, CC0).
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">2. Anti-Circumvention Rule (DMCA § 1201)</h3>
          <p>
            MediaForge strictly prohibits and refuses any attempt to circumvent digital rights management (DRM), encryption keys (Widevine, FairPlay, PlayReady), private membership access barriers, paywalls, or geo-locking systems.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">3. Zero Persistent Media Hosting</h3>
          <p>
            Our servers operate on ephemeral storage. Transcoded files are assigned temporary cryptographic tokens that expire after 15 minutes, after which all temporary caches are immediately purged.
          </p>
        </section>
      </div>
    </div>
  );
};

// 3. TERMS OF SERVICE VIEW
export const TermsView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
        Terms of Service
      </h1>

      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>Last updated: August 2026</p>

        <section className="space-y-2">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">1. Acceptance of Terms</h3>
          <p>
            By accessing MediaForge, you agree to comply with all applicable local, national, and international laws regarding intellectual property, streaming data, and computer fraud regulations.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">2. Prohibited Conduct</h3>
          <p>
            You agree not to use the platform for automated bulk scraping, denial-of-service attempts, attempting to access private servers via SSRF vectors, or downloading media without lawful authority.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">3. Disclaimer of Warranties</h3>
          <p>
            MediaForge is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind regarding third-party stream availability.
          </p>
        </section>
      </div>
    </div>
  );
};

// 4. PRIVACY POLICY VIEW
export const PrivacyView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
        Privacy & Data Protection Policy
      </h1>

      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>Last updated: August 2026</p>

        <section className="space-y-2">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">1. Information We Do Not Collect</h3>
          <p>
            We do not require account registration for standard analyses. We do not track your personal identity, browsing history across third-party sites, or inspect the private content of files.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">2. Ephemeral Storage & Cryptographic Tokens</h3>
          <p>
            When you request an export, media is processed in memory or isolated temporary scratch volumes. Download links are protected with signed HMAC tokens with a 15-minute TTL.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">3. Local Storage</h3>
          <p>
            We store simple user interface preferences (dark mode, selected language code) directly in your browser&apos;s localStorage for convenience.
          </p>
        </section>
      </div>
    </div>
  );
};
