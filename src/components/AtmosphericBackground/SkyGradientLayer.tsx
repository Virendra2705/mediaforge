import React from 'react';
import { EffectiveScene } from '../../types';

interface SkyGradientLayerProps {
  scene: EffectiveScene;
}

export const SkyGradientLayer: React.FC<SkyGradientLayerProps> = ({ scene }) => {
  // Rich, adaptive multi-stop sky gradients
  const skyBackgroundStyle: Record<EffectiveScene, string> = {
    morning:
      'bg-gradient-to-b from-sky-400/30 via-amber-200/40 via-orange-100/30 to-amber-50/50 dark:from-slate-950 dark:via-indigo-950/80 dark:to-amber-950/45',
    day:
      'bg-gradient-to-b from-sky-400/35 via-sky-200/40 via-blue-100/30 to-slate-50/40 dark:from-slate-950 dark:via-slate-900/95 dark:to-indigo-950/60',
    sunset:
      'bg-gradient-to-b from-indigo-950/95 via-purple-900/70 via-rose-800/45 to-orange-400/35 dark:from-slate-950 dark:via-purple-950/80 dark:to-rose-950/65',
    night:
      'bg-gradient-to-b from-slate-950 via-slate-950/95 via-indigo-950/80 to-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/85',
    rain:
      'bg-gradient-to-b from-slate-900 via-slate-800/90 via-sky-950/75 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950',
    fog:
      'bg-gradient-to-b from-slate-400/35 via-slate-300/40 via-zinc-200/45 to-slate-100/50 dark:from-slate-950 dark:via-slate-900/85 dark:to-zinc-900/70',
  };

  return (
    <div className="absolute inset-0 pointer-events-none -z-20">
      {/* 1. Base Sky Gradient Canvas */}
      <div
        className={`absolute inset-0 transition-all duration-1000 ease-out ${skyBackgroundStyle[scene]}`}
      />

      {/* 2. Slow Breathing Upper Stratosphere Wash (45s cycle) */}
      <div
        className={`absolute top-0 inset-x-0 h-[65vh] bg-gradient-to-b from-indigo-500/10 via-sky-400/5 to-transparent blur-3xl pointer-events-none transition-opacity duration-1000 ${
          scene === 'night' ? 'opacity-40' : scene === 'sunset' ? 'opacity-75' : 'opacity-50'
        }`}
      />

      {/* 3. Horizon Ground Atmospheric Anchor */}
      <div className="absolute bottom-0 inset-x-0 h-[30vh] bg-gradient-to-t from-slate-950/20 dark:from-slate-950/50 to-transparent pointer-events-none" />
    </div>
  );
};
