import React from 'react';
import { EffectiveScene } from '../../types';

interface DistantHorizonLayerProps {
  scene: EffectiveScene;
  pointerOffset: { x: number; y: number };
  motion: 'full' | 'reduced' | 'off';
}

export const DistantHorizonLayer: React.FC<DistantHorizonLayerProps> = ({
  scene,
  pointerOffset,
  motion,
}) => {
  // Horizon colors adapted to scene
  const ridgeAColor = {
    morning: 'fill-amber-900/15 dark:fill-amber-950/40',
    day: 'fill-slate-400/20 dark:fill-slate-900/60',
    sunset: 'fill-rose-950/30 dark:fill-purple-950/60',
    night: 'fill-slate-950/70 dark:fill-slate-950/90',
    rain: 'fill-slate-800/40 dark:fill-slate-950/80',
    fog: 'fill-slate-500/25 dark:fill-slate-800/40',
  }[scene];

  const ridgeBColor = {
    morning: 'fill-amber-800/20 dark:fill-amber-950/60',
    day: 'fill-slate-500/25 dark:fill-slate-900/80',
    sunset: 'fill-purple-950/45 dark:fill-slate-950/80',
    night: 'fill-slate-950/85 dark:fill-black/90',
    rain: 'fill-slate-900/60 dark:fill-slate-950/95',
    fog: 'fill-slate-600/35 dark:fill-slate-900/60',
  }[scene];

  const txA = motion === 'full' ? pointerOffset.x * 1 : 0;
  const txB = motion === 'full' ? pointerOffset.x * 1.8 : 0;

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none overflow-hidden h-[38vh] sm:h-[45vh] transition-all duration-1000 ease-out">
      {/* Soft atmospheric ground haze gradient */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-slate-900/40 dark:from-slate-950/60 to-transparent transition-opacity duration-1000 ${
          scene === 'fog' ? 'opacity-90' : 'opacity-50'
        }`}
      />

      {/* Layer 1: Distant Mountain Ridge */}
      <div
        className="absolute inset-x-0 bottom-0 w-[110%] -left-[5%] transition-all duration-1000 ease-out"
        style={{ transform: `translate3d(${txA}px, 0, 0)` }}
      >
        <svg
          viewBox="0 0 1440 280"
          preserveAspectRatio="none"
          className={`w-full h-40 sm:h-56 ${ridgeAColor} transition-colors duration-1000`}
          aria-hidden="true"
        >
          <path d="M0 280 L0 160 Q 180 80 380 140 T 780 110 T 1140 150 T 1440 90 L 1440 280 Z" />
        </svg>
      </div>

      {/* Layer 2: Mid-ground Rolling Ridge with soft trees/hills silhouette */}
      <div
        className="absolute inset-x-0 bottom-0 w-[115%] -left-[7%] transition-all duration-1000 ease-out"
        style={{ transform: `translate3d(${txB}px, 0, 0)` }}
      >
        <svg
          viewBox="0 0 1440 220"
          preserveAspectRatio="none"
          className={`w-full h-32 sm:h-44 ${ridgeBColor} transition-colors duration-1000`}
          aria-hidden="true"
        >
          <path d="M0 220 L0 140 Q 220 180 440 100 T 880 130 T 1200 90 T 1440 120 L 1440 220 Z" />
        </svg>
      </div>
    </div>
  );
};
