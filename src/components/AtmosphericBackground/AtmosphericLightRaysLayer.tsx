import React from 'react';
import { EffectiveScene } from '../../types';

interface AtmosphericLightRaysLayerProps {
  scene: EffectiveScene;
  pointerOffset: { x: number; y: number };
  motion: 'full' | 'reduced' | 'off';
}

export const AtmosphericLightRaysLayer: React.FC<AtmosphericLightRaysLayerProps> = ({
  scene,
  pointerOffset,
  motion,
}) => {
  const isDayOrMorning = scene === 'day' || scene === 'morning';
  const isSunset = scene === 'sunset';
  const shouldAnimate = motion === 'full';

  // Pointer parallax (subtle 1.5px)
  const tx = shouldAnimate ? pointerOffset.x * 1.5 : 0;
  const ty = shouldAnimate ? pointerOffset.y * 1.2 : 0;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden transition-all duration-1000 ease-out"
      style={{ transform: `translate3d(${tx}px, ${ty}px, 0)` }}
    >
      {/* ================= 1. CREPUSCULAR LIGHT RAYS (Day, Morning, Sunset) ================= */}
      {(isDayOrMorning || isSunset) && (
        <div
          className={`absolute -top-[10%] right-[5%] sm:right-[12%] w-[120vw] h-[100vh] origin-top-right transition-opacity duration-1000 ${
            shouldAnimate ? 'vf-rays-drift' : 'opacity-30'
          } ${isSunset ? 'opacity-40' : 'opacity-35'}`}
        >
          <svg
            viewBox="0 0 1000 800"
            className="w-full h-full"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="rayGrad" x1="1" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={isSunset ? 'rgba(251, 146, 60, 0.45)' : 'rgba(254, 240, 138, 0.35)'}
                />
                <stop
                  offset="45%"
                  stopColor={isSunset ? 'rgba(244, 114, 182, 0.15)' : 'rgba(224, 242, 254, 0.15)'}
                />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
            {/* Fan of soft crepuscular rays */}
            <polygon points="900,0 200,800 280,800" fill="url(#rayGrad)" />
            <polygon points="900,0 380,800 460,800" fill="url(#rayGrad)" opacity="0.75" />
            <polygon points="900,0 560,800 660,800" fill="url(#rayGrad)" opacity="0.9" />
            <polygon points="900,0 740,800 840,800" fill="url(#rayGrad)" opacity="0.6" />
          </svg>
        </div>
      )}

      {/* ================= 2. CLOUD SHADOW EFFECT (Environmental connection) ================= */}
      {/* As large clouds drift across, background illumination gently modulates */}
      <div
        className={`absolute inset-0 bg-slate-950/20 dark:bg-black/30 pointer-events-none transition-all ${
          shouldAnimate ? 'vf-cloud-shadow-layer' : 'opacity-0'
        }`}
      />

      {/* ================= 3. SUNSET GOLDEN-HOUR HORIZON GLOW ================= */}
      {isSunset && (
        <div className="absolute inset-x-0 bottom-[12%] h-[35vh] bg-gradient-to-t from-orange-500/20 via-rose-500/10 to-transparent blur-2xl pointer-events-none" />
      )}
    </div>
  );
};
