import React, { useEffect, useRef } from 'react';
import { EffectiveScene } from '../../types';

interface WeatherParticlesLayerProps {
  scene: EffectiveScene;
  motion: 'full' | 'reduced' | 'off';
}

interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  thickness: number;
}

interface FogBank {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  speed: number;
  opacity: number;
}

interface DustMote {
  x: number;
  y: number;
  size: number;
  speedY: number;
  swaySpeed: number;
  swayOffset: number;
  opacity: number;
}

export const WeatherParticlesLayer: React.FC<WeatherParticlesLayerProps> = ({
  scene,
  motion,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (motion === 'off') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = true;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize, { passive: true });

    // Handle Page Visibility API to pause rendering when tab is hidden
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible && motion === 'full') {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const isMobile = width < 768;

    // 1. Rain Drops Setup (multi-depth: near, mid, far)
    const rainCount = isMobile ? 35 : 65;
    const rainDrops: RainDrop[] = [];
    for (let i = 0; i < rainCount; i++) {
      const isForeground = Math.random() > 0.7;
      rainDrops.push({
        x: Math.random() * (width + 200) - 100,
        y: Math.random() * height,
        length: isForeground ? 18 + Math.random() * 14 : 10 + Math.random() * 8,
        speed: isForeground ? 14 + Math.random() * 6 : 9 + Math.random() * 4,
        opacity: isForeground ? 0.35 + Math.random() * 0.25 : 0.15 + Math.random() * 0.2,
        thickness: isForeground ? 1.2 : 0.8,
      });
    }

    // 2. Fog Banks Setup (large elliptical volumetric clouds)
    const fogCount = isMobile ? 6 : 10;
    const fogBanks: FogBank[] = [];
    for (let i = 0; i < fogCount; i++) {
      fogBanks.push({
        x: Math.random() * width,
        y: height * 0.25 + Math.random() * (height * 0.6),
        radiusX: 180 + Math.random() * 260,
        radiusY: 70 + Math.random() * 90,
        speed: 0.18 + Math.random() * 0.28,
        opacity: 0.08 + Math.random() * 0.12,
      });
    }

    // 3. Ambient Dust Motes Setup
    const moteCount = isMobile ? 18 : 34;
    const dustMotes: DustMote[] = [];
    for (let i = 0; i < moteCount; i++) {
      dustMotes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 1 + Math.random() * 1.8,
        speedY: 0.3 + Math.random() * 0.5,
        swaySpeed: 0.0018 + Math.random() * 0.0025,
        swayOffset: Math.random() * Math.PI * 2,
        opacity: 0.15 + Math.random() * 0.35,
      });
    }

    let lastTime = performance.now();

    const render = (time: number) => {
      if (!isVisible) return;

      const dt = Math.min((time - lastTime) / 16.67, 3);
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      if (scene === 'rain') {
        // Multi-depth diagonal rain lines (wind slant: 0.16)
        const slant = 0.16;
        for (const drop of rainDrops) {
          ctx.beginPath();
          ctx.lineWidth = drop.thickness;
          ctx.strokeStyle = `rgba(191, 219, 254, ${drop.opacity})`;
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x + slant * drop.length, drop.y + drop.length);
          ctx.stroke();

          if (motion === 'full') {
            drop.y += drop.speed * dt;
            drop.x += slant * drop.speed * dt;
            if (drop.y > height + 20) {
              drop.y = -20;
              drop.x = Math.random() * (width + 200) - 100;
            }
          }
        }
      } else if (scene === 'fog') {
        // Soft volumetric rolling fog ellipses
        for (const f of fogBanks) {
          const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radiusX);
          grad.addColorStop(0, `rgba(226, 232, 240, ${f.opacity})`);
          grad.addColorStop(0.6, `rgba(226, 232, 240, ${f.opacity * 0.5})`);
          grad.addColorStop(1, 'rgba(226, 232, 240, 0)');

          ctx.save();
          ctx.beginPath();
          ctx.translate(f.x, f.y);
          ctx.scale(1, f.radiusY / f.radiusX);
          ctx.arc(0, 0, f.radiusX, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.restore();

          if (motion === 'full') {
            f.x += f.speed * dt;
            if (f.x - f.radiusX > width) {
              f.x = -f.radiusX;
              f.y = height * 0.25 + Math.random() * (height * 0.6);
            }
          }
        }
      } else {
        // Soft floating dust motes with natural sinusoidal drift
        const colorPrefix =
          scene === 'sunset'
            ? 'rgba(254, 215, 170,'
            : scene === 'morning'
            ? 'rgba(254, 240, 138,'
            : scene === 'night'
            ? 'rgba(224, 231, 255,'
            : 'rgba(255, 255, 255,';

        for (const m of dustMotes) {
          ctx.beginPath();
          ctx.fillStyle = `${colorPrefix} ${m.opacity})`;
          ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
          ctx.fill();

          if (motion === 'full') {
            m.y -= m.speedY * dt; // slow upward drift
            m.x += Math.sin(time * m.swaySpeed + m.swayOffset) * 0.35 * dt; // breeze sway

            if (m.y < -10) {
              m.y = height + 10;
              m.x = Math.random() * width;
            }
          }
        }
      }

      if (motion === 'full') {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    if (motion === 'full') {
      animationFrameId = requestAnimationFrame(render);
    } else {
      render(0);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [scene, motion]);

  if (motion === 'off') return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none -z-1"
      style={{ opacity: scene === 'rain' ? 0.9 : 0.7 }}
    />
  );
};
