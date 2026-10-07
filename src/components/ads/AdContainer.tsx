import React, { useEffect, useRef, useState } from 'react';

export interface AdContainerProps {
  /** Google AdSense ad slot ID (e.g. "1234567890") */
  slot?: string;
  /** Google AdSense publisher client ID (defaults to VITE_ADSENSE_CLIENT_ID) */
  client?: string;
  /** Ad format type (defaults to 'auto') */
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal';
  /** Whether the ad unit is full-width responsive (defaults to true) */
  responsive?: boolean;
  /** In-article / native layout key if applicable */
  layoutKey?: string;
  /** Minimum container height to reserve space and prevent layout shifts (CLS) */
  minHeight?: number;
  /** Custom container class name */
  className?: string;
  /** Accessible label */
  ariaLabel?: string;
}

/**
 * AdContainer
 * Production-ready, policy-compliant reusable wrapper for Google AdSense units.
 * Features:
 * - Single push execution per mount cycle
 * - Zero Cumulative Layout Shift (CLS) reservation
 * - Automatic collapse if unfilled by AdSense (via data-ad-status="unfilled")
 * - Policy-compliant "Advertisement" label
 * - Responsive boundaries that never overflow viewports
 */
export const AdContainer: React.FC<AdContainerProps> = ({
  slot,
  client,
  format = 'auto',
  responsive = true,
  layoutKey,
  minHeight = 90,
  className = '',
  ariaLabel = 'Advertisement',
}) => {
  const adRef = useRef<HTMLModElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isPushed = useRef(false);
  const [isUnfilled, setIsUnfilled] = useState(false);

  const activeClient = client || (import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined);

  useEffect(() => {
    // If not in a browser environment or already pushed, return
    if (typeof window === 'undefined') return;

    // Detect if Google AdSense sets data-ad-status="unfilled" to collapse space
    const el = adRef.current;
    if (!el) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'data-ad-status'
        ) {
          const status = el.getAttribute('data-ad-status');
          if (status === 'unfilled') {
            setIsUnfilled(true);
          }
        }
      }
    });

    observer.observe(el, { attributes: true });

    // Safely execute AdSense queue push
    if (!isPushed.current && activeClient) {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        isPushed.current = true;
      } catch (err) {
        // Silently catch push errors (e.g. if adsbygoogle script was blocked by client extension)
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [activeClient]);

  // If Google explicitly collapsed the unit or no client is configured in production, hide cleanly
  if (isUnfilled) {
    return null;
  }

  // If no AdSense client is configured, hide in production to avoid blank gaps
  if (!activeClient) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`w-full max-w-5xl mx-auto my-8 px-4 sm:px-6 transition-all duration-300 ${className}`}
      aria-label={ariaLabel}
      role="region"
    >
      <div className="relative rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 overflow-hidden p-3 text-center">
        {/* Policy-compliant discreet ad label */}
        <div className="text-[10px] font-medium tracking-widest uppercase text-slate-400 dark:text-slate-500 mb-2 select-none">
          Advertisement
        </div>

        {/* Ad Unit Container with CLS reservation */}
        <div
          className="w-full flex items-center justify-center overflow-hidden"
          style={{ minHeight: `${minHeight}px` }}
        >
          <ins
            ref={adRef}
            className="adsbygoogle"
            style={{ display: 'block', width: '100%' }}
            data-ad-client={activeClient}
            data-ad-slot={slot || undefined}
            data-ad-format={format}
            data-full-width-responsive={responsive ? 'true' : 'false'}
            data-ad-layout-key={layoutKey || undefined}
          />
        </div>
      </div>
    </div>
  );
};
