import React, { useMemo } from 'react';
import { EffectiveScene } from '../../types';

interface StarFieldLayerProps {
  scene: EffectiveScene;
  pointerOffset: { x: number; y: number };
  motion: 'full' | 'reduced' | 'off';
}

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  baseOpacity: number;
  twinkleType: 'fast' | 'slow' | 'static';
  delay: number;
}

export const StarFieldLayer: React.FC<StarFieldLayerProps> = ({
  scene,
  pointerOffset,
  motion,
}) => {
  const isVisible = scene === 'night' || scene === 'sunset';
  const overallOpacity = scene === 'night' ? 1 : scene === 'sunset' ? 0.45 : 0;
  const shouldAnimate = motion === 'full';

  // Generate deterministic star positions and assign to 3 distinct twinkle groups
  const stars: Star[] = useMemo(() => {
    const list: Star[] = [];
    const count = 56;
    for (let i = 0; i < count; i++) {
      const seed = (i * 9301 + 49297) % 233280;
      const rnd1 = seed / 233280;
      const rnd2 = ((seed * 9301 + 49297) % 233280) / 233280;
      const rnd3 = ((seed * 1301 + 19297) % 233280) / 233280;
      const rnd4 = ((seed * 7301 + 89297) % 233280) / 233280;

      // Group distribution: 30% static, 40% slow breathing, 30% subtle twinkle
      const twinkleType = rnd4 > 0.7 ? 'fast' : rnd4 > 0.3 ? 'slow' : 'static';

      list.push({
        id: i,
        x: Math.round(rnd1 * 98 * 10) / 10 + 1,
        y: Math.round(rnd2 * 58 * 10) / 10 + 2, // Upper 58% of sky
        size: rnd3 > 0.88 ? 2 : rnd3 > 0.45 ? 1.5 : 1,
        baseOpacity: Math.round((0.25 + rnd4 * 0.6) * 100) / 100,
        twinkleType,
        delay: Math.round(rnd1 * 6 * 10) / 10,
      });
    }
    return list;
  }, []);

  const tx = shouldAnimate ? pointerOffset.x * 1 : 0;
  const ty = shouldAnimate ? pointerOffset.y * 0.8 : 0;

  if (!isVisible && overallOpacity === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-1000 ease-out"
      style={{
        opacity: overallOpacity,
        transform: `translate3d(${tx}px, ${ty}px, 0)`,
      }}
    >
      {stars.map(star => {
        let animStyle: React.CSSProperties['animation'];
        if (shouldAnimate) {
          if (star.twinkleType === 'fast') {
            animStyle = `vf-star-twinkle-fast 4.5s ease-in-out ${star.delay}s infinite alternate`;
          } else if (star.twinkleType === 'slow') {
            animStyle = `vf-star-twinkle-slow 9.5s ease-in-out ${star.delay}s infinite alternate`;
          }
        }

        return (
          <span
            key={star.id}
            className="absolute rounded-full bg-slate-100 dark:bg-white"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.baseOpacity,
              boxShadow: star.size > 1.5 ? '0 0 5px rgba(255, 255, 255, 0.85)' : undefined,
              animation: animStyle,
            }}
          />
        );
      })}
    </div>
  );
};
