import React from 'react';
import { EffectiveScene } from '../../types';

interface CelestialBodyLayerProps {
  scene: EffectiveScene;
  pointerOffset: { x: number; y: number };
  motion: 'full' | 'reduced' | 'off';
}

export const CelestialBodyLayer: React.FC<CelestialBodyLayerProps> = ({
  scene,
  pointerOffset,
  motion,
}) => {
  const isNightLike = scene === 'night' || scene === 'rain' || scene === 'fog';
  const isSunset = scene === 'sunset';
  const isMorning = scene === 'morning';
  const shouldAnimate = motion === 'full';

  // Pointer parallax translation (subtle 2px max)
  const tx = shouldAnimate ? pointerOffset.x * 2 : 0;
  const ty = shouldAnimate ? pointerOffset.y * 1.5 : 0;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden transition-all duration-1000 ease-out"
      style={{
        transform: `translate3d(${tx}px, ${ty}px, 0)`,
      }}
    >
      {/* ================= SUN SYSTEM (Morning, Day, Sunset) ================= */}
      <div
        className={`absolute transition-all duration-1000 ease-out ${
          isNightLike
            ? 'opacity-0 scale-75 pointer-events-none'
            : isSunset
            ? 'opacity-95 top-[26%] right-[20%] sm:right-[26%]'
            : isMorning
            ? 'opacity-90 top-[16%] right-[16%] sm:right-[22%]'
            : 'opacity-95 top-[10%] right-[12%] sm:right-[16%]'
        }`}
      >
        {/* Subtle Solar Arc evolution (moves slowly across a natural arc) */}
        <div className={shouldAnimate ? 'vf-solar-arc-drift' : ''}>
          {/* Breathing Atmospheric Glow (42s slow cycle) */}
          <div className={shouldAnimate ? 'vf-sun-halo-breathe' : ''}>
            {/* Deep Ambient Sunlight Diffusion Bloom */}
            <div
              className={`absolute -inset-24 rounded-full blur-3xl transition-colors duration-1000 ${
                isSunset
                  ? 'bg-gradient-to-tr from-amber-500/35 via-rose-500/25 to-orange-400/20'
                  : isMorning
                  ? 'bg-gradient-to-tr from-amber-400/30 via-yellow-300/25 to-sky-300/15'
                  : 'bg-gradient-to-tr from-yellow-300/30 via-amber-200/20 to-sky-200/20'
              }`}
            />

            {/* Mid Radial Sun Halo with soft shimmer */}
            <div
              className={`w-32 h-32 sm:w-44 sm:h-44 rounded-full blur-xl transition-colors duration-1000 ${
                isSunset
                  ? 'bg-gradient-to-br from-amber-400/55 via-rose-400/40 to-orange-500/35'
                  : isMorning
                  ? 'bg-gradient-to-br from-amber-200/65 via-yellow-100/45 to-orange-200/35'
                  : 'bg-gradient-to-br from-amber-100/75 via-yellow-50/55 to-sky-100/35'
              }`}
            />

            {/* Inner Sun Core Disc */}
            <div
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 rounded-full shadow-lg transition-colors duration-1000 ${
                isSunset
                  ? 'bg-gradient-to-b from-amber-100 via-amber-200 to-orange-300 shadow-orange-500/40'
                  : isMorning
                  ? 'bg-gradient-to-b from-white via-amber-50 to-yellow-200 shadow-yellow-400/30'
                  : 'bg-gradient-to-b from-white via-yellow-50 to-amber-100 shadow-amber-300/35'
              }`}
            />
          </div>
        </div>
      </div>

      {/* ================= MOON SYSTEM (Night, Rain, Fog) ================= */}
      <div
        className={`absolute top-[12%] right-[14%] sm:right-[18%] transition-all duration-1000 ease-out ${
          isNightLike ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
        }`}
      >
        <div className={shouldAnimate ? 'vf-solar-arc-drift' : ''}>
          {/* Soft lunar atmospheric halo with breathing intensity */}
          <div
            className={`absolute -inset-20 rounded-full blur-3xl transition-opacity duration-1000 ${
              scene === 'rain'
                ? 'bg-slate-400/15'
                : scene === 'fog'
                ? 'bg-indigo-300/18'
                : 'bg-indigo-300/25 dark:bg-indigo-400/20'
            } ${shouldAnimate ? 'vf-sun-halo-breathe' : ''}`}
          />

          {/* Outer Moon Glow */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full blur-lg bg-indigo-100/25 dark:bg-indigo-200/20" />

          {/* Luminous Moon Sphere with Maria details */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-slate-100 via-indigo-50 to-slate-200 dark:from-slate-200 dark:via-indigo-100 dark:to-slate-300 shadow-[0_0_35px_rgba(224,231,255,0.45)] overflow-hidden">
            {/* Crater & Mare texture */}
            <div className="absolute top-2 left-3 w-3 h-3 rounded-full bg-slate-300/40 dark:bg-slate-400/35" />
            <div className="absolute top-6 left-7 w-3.5 h-3.5 rounded-full bg-slate-300/30 dark:bg-slate-400/25" />
            <div className="absolute bottom-3 left-4 w-4.5 h-4.5 rounded-full bg-slate-300/35 dark:bg-slate-400/30" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-transparent to-slate-900/15 dark:to-slate-950/25" />
          </div>
        </div>
      </div>
    </div>
  );
};
