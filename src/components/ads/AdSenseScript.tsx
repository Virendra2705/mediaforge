import React, { useEffect } from 'react';

interface AdSenseScriptProps {
  clientId?: string;
}

/**
 * AdSenseScript
 * Global single-instance loader for Google AdSense.
 * Ensures the official AdSense library loads once asynchronously across the application,
 * respecting auto ads and manual ad slots without duplicating script tags.
 */
export const AdSenseScript: React.FC<AdSenseScriptProps> = ({ clientId }) => {
  const activeClientId = clientId || (import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined);

  useEffect(() => {
    // Only inject if client ID is specified
    if (!activeClientId || !activeClientId.trim()) return;

    // Prevent duplicate script injection
    const existingScript = document.querySelector(
      'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'
    );
    if (existingScript) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
      activeClientId.trim()
    )}`;
    script.crossOrigin = 'anonymous';
    script.id = 'vf-adsense-global-script';

    document.head.appendChild(script);
  }, [activeClientId]);

  return null;
};
