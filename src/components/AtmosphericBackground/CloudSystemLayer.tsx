import React from 'react';
import { EffectiveScene } from '../../types';

interface CloudSystemLayerProps {
  scene: EffectiveScene;
  pointerOffset: { x: number; y: number };
  motion: 'full' | 'reduced' | 'off';
}

// Organic SVG Cloud Paths with varied cumulus and stratus silhouettes
const CumulusLarge: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 620 200"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path d="M120 180 H520 C570 180 605 145 605 105 C605 70 575 42 538 42 C532 42 525 43 518 46 C498 18 462 0 420 0 C375 0 335 24 322 62 C304 48 280 40 255 40 C202 40 160 74 148 118 C128 110 102 118 88 138 C72 160 88 180 120 180 Z" />
  </svg>
);

const CumulusMedium: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 480 160"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path d="M90 145 H410 C450 145 475 120 475 90 C475 62 450 40 420 40 C415 40 410 41 405 43 C390 18 360 2 325 2 C285 2 250 24 240 58 C224 48 204 42 184 42 C145 42 110 68 100 102 C82 98 62 106 52 122 C40 138 52 145 90 145 Z" />
  </svg>
);

const StratusLong: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 700 140"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path d="M60 120 H640 C675 120 695 102 695 82 C695 62 672 48 648 48 C642 48 635 49 628 51 C612 25 580 8 545 8 C505 8 472 28 460 60 C442 46 415 38 388 38 C345 38 308 62 295 95 C275 88 250 92 238 105 C220 95 195 90 172 90 C138 90 108 108 98 120 H60 Z" />
  </svg>
);

const CirrusWispy: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 540 110"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path d="M40 90 H500 C530 90 540 75 525 60 C510 45 470 52 440 45 C410 38 390 15 350 15 C310 15 285 35 255 35 C225 35 200 25 170 30 C135 36 100 55 70 65 C40 75 25 90 40 90 Z" />
  </svg>
);

export const CloudSystemLayer: React.FC<CloudSystemLayerProps> = ({
  scene,
  pointerOffset,
  motion,
}) => {
  // Rich, adaptive cloud palettes matching the living atmosphere
  const cloudColorClass = {
    morning: 'text-amber-100/50 dark:text-amber-200/25',
    day: 'text-white/70 dark:text-slate-200/35',
    sunset: 'text-orange-200/60 dark:text-rose-300/35',
    night: 'text-indigo-200/22 dark:text-slate-400/18',
    rain: 'text-slate-400/45 dark:text-slate-600/35',
    fog: 'text-slate-200/55 dark:text-slate-300/30',
  }[scene];

  const shouldAnimate = motion === 'full';

  // Multi-tier parallax offsets
  const tx1 = shouldAnimate ? pointerOffset.x * 1.2 : 0;
  const ty1 = shouldAnimate ? pointerOffset.y * 0.9 : 0;

  const tx2 = shouldAnimate ? pointerOffset.x * 2.2 : 0;
  const ty2 = shouldAnimate ? pointerOffset.y * 1.6 : 0;

  const tx3 = shouldAnimate ? pointerOffset.x * 3.4 : 0;
  const ty3 = shouldAnimate ? pointerOffset.y * 2.4 : 0;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden transition-colors duration-1000 ease-out">
      {/* ================= TIER 1: High-Altitude Cirrus & Wisps (Counter-Drift) ================= */}
      <div
        className="absolute inset-0 transition-opacity duration-1000 opacity-60"
        style={{ transform: `translate3d(${tx1}px, ${ty1}px, 0)` }}
      >
        <div
          className={`absolute top-[2%] w-[200vw] flex items-center justify-around ${cloudColorClass} ${
            shouldAnimate ? 'vf-cloud-counter' : ''
          }`}
        >
          {/* Segment A */}
          <div className="w-[100vw] flex items-center justify-around shrink-0 px-4">
            <CirrusWispy className="w-[380px] sm:w-[480px] h-auto blur-[2px]" />
            <StratusLong className="w-[440px] sm:w-[560px] h-auto blur-[2.5px]" />
          </div>
          {/* Segment B (Identical for mathematically seamless loop) */}
          <div className="w-[100vw] flex items-center justify-around shrink-0 px-4">
            <CirrusWispy className="w-[380px] sm:w-[480px] h-auto blur-[2px]" />
            <StratusLong className="w-[440px] sm:w-[560px] h-auto blur-[2.5px]" />
          </div>
        </div>
      </div>

      {/* ================= TIER 2: Mid-Altitude Cumulostratus Formations ================= */}
      <div
        className="absolute inset-0 transition-opacity duration-1000 opacity-75"
        style={{ transform: `translate3d(${tx2}px, ${ty2}px, 0)` }}
      >
        <div
          className={`absolute top-[12%] w-[200vw] flex items-center justify-around ${cloudColorClass} ${
            shouldAnimate ? 'vf-cloud-mid' : ''
          }`}
        >
          {/* Segment A */}
          <div className="w-[100vw] flex items-center justify-around shrink-0 px-6">
            <CumulusLarge className="w-[440px] sm:w-[580px] h-auto blur-[1.5px]" />
            <CumulusMedium className="w-[360px] sm:w-[460px] h-auto blur-[1px]" />
          </div>
          {/* Segment B */}
          <div className="w-[100vw] flex items-center justify-around shrink-0 px-6">
            <CumulusLarge className="w-[440px] sm:w-[580px] h-auto blur-[1.5px]" />
            <CumulusMedium className="w-[360px] sm:w-[460px] h-auto blur-[1px]" />
          </div>
        </div>
      </div>

      {/* ================= TIER 3: Center & Lower-Sky Drifts (Prominent Living Motion) ================= */}
      <div
        className="absolute inset-0 transition-opacity duration-1000 opacity-70"
        style={{ transform: `translate3d(${tx3}px, ${ty3}px, 0)` }}
      >
        <div
          className={`absolute top-[24%] w-[200vw] flex items-center justify-around ${cloudColorClass} ${
            shouldAnimate ? 'vf-cloud-fast' : ''
          }`}
        >
          {/* Segment A */}
          <div className="w-[100vw] flex items-center justify-around shrink-0 px-8">
            <StratusLong className="w-[520px] sm:w-[680px] h-auto blur-[3px]" />
            <CumulusMedium className="w-[420px] sm:w-[520px] h-auto blur-[2.5px]" />
          </div>
          {/* Segment B */}
          <div className="w-[100vw] flex items-center justify-around shrink-0 px-8">
            <StratusLong className="w-[520px] sm:w-[680px] h-auto blur-[3px]" />
            <CumulusMedium className="w-[420px] sm:w-[520px] h-auto blur-[2.5px]" />
          </div>
        </div>
      </div>

      {/* ================= TIER 4: Low Horizon Fluffy Drifts ================= */}
      <div
        className="absolute inset-0 transition-opacity duration-1000 opacity-55"
        style={{ transform: `translate3d(${tx2 * 0.8}px, ${ty2 * 0.8}px, 0)` }}
      >
        <div
          className={`absolute top-[38%] w-[200vw] flex items-center justify-around ${cloudColorClass} ${
            shouldAnimate ? 'vf-cloud-slow' : ''
          }`}
        >
          {/* Segment A */}
          <div className="w-[100vw] flex items-center justify-around shrink-0 px-10">
            <CumulusLarge className="w-[480px] sm:w-[640px] h-auto blur-[4px]" />
            <CirrusWispy className="w-[400px] sm:w-[520px] h-auto blur-[3.5px]" />
          </div>
          {/* Segment B */}
          <div className="w-[100vw] flex items-center justify-around shrink-0 px-10">
            <CumulusLarge className="w-[480px] sm:w-[640px] h-auto blur-[4px]" />
            <CirrusWispy className="w-[400px] sm:w-[520px] h-auto blur-[3.5px]" />
          </div>
        </div>
      </div>
    </div>
  );
};
