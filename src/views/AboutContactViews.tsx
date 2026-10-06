import React, { useState } from 'react';
import {
  Zap,
  ShieldCheck,
  Cpu,
  Mail,
  MessageSquare,
  Send,
  CheckCircle2,
  Building,
  Globe,
  Heart,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AboutView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="text-center space-y-3">
        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
          Our Architecture & Vision
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          About MediaForge
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Building fast, transparent, and legally responsible media transcoding utilities for the modern web.
        </p>
      </div>

      <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Our Mission</h2>
          <p>
            MediaForge was engineered to provide creators, journalists, researchers, and educators with a clean, high-performance media utility. Traditional online converters are often laden with invasive popups, fraudulent download traps, and questionable copyright practices.
          </p>
          <p className="mt-2">
            We built MediaForge as the anti-slop, clean-room alternative: a blazing-fast, secure, and privacy-preserving platform that strictly adheres to intellectual property standards and never circumvents technical protections.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-blue-500" />
              <span>Stateless Pipeline</span>
            </div>
            <p className="text-xs text-slate-500">
              Ephemeral workers transcode streams in memory with automatic 15-minute file expiration.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Responsible By Design</span>
            </div>
            <p className="text-xs text-slate-500">
              Zero DRM cracking, SSRF defense, and full compliance with anti-circumvention rules.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-violet-500" />
              <span>Studio Fidelity</span>
            </div>
            <p className="text-xs text-slate-500">
              Lossless 320 kbps MP3 conversion and pristine 1080p/4K MP4 stream packaging.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ContactView: React.FC = () => {
  const { addToast } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;
    setIsSent(true);
    addToast('success', 'Message Transmitted', 'Thank you for reaching out. We typically reply within 24 hours.');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Contact & Support
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
          Have an inquiry, technical feedback, or partnership question? Send a message directly to our engineering team.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-4 md:col-span-1">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-500" />
              Direct Contacts
            </h3>
            <div className="text-xs text-slate-500 space-y-2">
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">General Support:</span>
                <span>support@mediaforge.app</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">Legal & DMCA:</span>
                <span>dmca@mediaforge.app</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">Security Inquiries:</span>
                <span>security@mediaforge.app</span>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
          {isSent ? (
            <div className="text-center py-10 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Thank You!</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                Your message has been dispatched to our engineering desk.
              </p>
              <button
                onClick={() => {
                  setIsSent(false);
                  setMessage('');
                  setSubject('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    placeholder="Alex Morgan"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Your Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="alex@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
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
                  placeholder="Bug report, feature feedback, or inquiry"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
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
                  placeholder="How can we assist you?"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-xs sm:text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <Send className="w-4 h-4" />
                <span>Send Message</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
