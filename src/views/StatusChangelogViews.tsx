import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';

export const StatusView: React.FC = () => {
  const [readiness, setReadiness] = useState<'checking' | 'ready' | 'unavailable'>('checking');

  useEffect(() => {
    fetch('/api/ready')
      .then(response => setReadiness(response.ok ? 'ready' : 'unavailable'))
      .catch(() => setReadiness('unavailable'));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <SEOHead
        title="Service Status | VideoFetch"
        description="Current application readiness information for VideoFetch. Historical uptime and provider availability are not reported here."
        canonicalPath="/status"
        noindex
      />
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          {readiness === 'ready' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>{readiness === 'checking' ? 'Checking application readiness' : readiness === 'ready' ? 'Application reports ready' : 'Application readiness unavailable'}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Application Readiness
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
          This check reports application readiness only. It does not report provider availability, historical uptime, or processing latency.
        </p>
      </div>

      <div className="max-w-2xl mx-auto p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
        <h2 className="font-bold text-slate-900 dark:text-white">Readiness check</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400" role="status" aria-live="polite">
          {readiness === 'checking' ? 'The application is checking its readiness.' : readiness === 'ready' ? 'The application readiness endpoint reports ready.' : 'The readiness endpoint could not confirm availability.'}
        </p>
      </div>
    </div>
  );
};

export const ChangelogView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <SEOHead
        title="Product Changelog | VideoFetch"
        description="Product change history is not currently published."
        canonicalPath="/changelog"
        noindex
      />
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Changelog
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
          No verified release notes are currently published here.
        </p>
      </div>

      <p className="max-w-2xl mx-auto text-center text-sm text-slate-600 dark:text-slate-400">
        Release information will appear here when dated notes are available.
      </p>
    </div>
  );
};
