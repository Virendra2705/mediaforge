import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { AtmosphereScene, EffectiveScene, MotionPreference } from '../types';

interface AtmosphereContextType {
  scene: AtmosphereScene;
  setScene: (scene: AtmosphereScene) => void;
  effectiveScene: EffectiveScene;
  motion: MotionPreference;
  setMotion: (motion: MotionPreference) => void;
  pointerOffset: { x: number; y: number };
  scrollOffset: number;
  timeString: string;
}

const AtmosphereContext = createContext<AtmosphereContextType | null>(null);

function getAutoSceneForTime(): EffectiveScene {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 9) return 'morning';
  if (hour >= 9 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'sunset';
  return 'night';
}

export const AtmosphereProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Scene Selection ('auto' by default)
  const [scene, setSceneState] = useState<AtmosphereScene>(() => {
    const saved = localStorage.getItem('vf_atmosphere_scene') as AtmosphereScene;
    if (saved && ['auto', 'morning', 'day', 'sunset', 'night', 'rain', 'fog'].includes(saved)) {
      return saved;
    }
    return 'auto';
  });

  // Motion Preference ('full' by default, or 'reduced' if prefers-reduced-motion)
  const [motion, setMotionState] = useState<MotionPreference>(() => {
    const saved = localStorage.getItem('vf_motion_pref') as MotionPreference;
    if (saved && ['full', 'reduced', 'off'].includes(saved)) {
      return saved;
    }
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 'reduced';
    }
    return 'full';
  });

  const [timeString, setTimeString] = useState<string>('');
  const [autoScene, setAutoScene] = useState<EffectiveScene>(getAutoSceneForTime);
  const [pointerOffset, setPointerOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [scrollOffset, setScrollOffset] = useState<number>(0);

  // Update time and auto-scene every minute
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
      );
      setAutoScene(getAutoSceneForTime());
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const setScene = (newScene: AtmosphereScene) => {
    setSceneState(newScene);
    localStorage.setItem('vf_atmosphere_scene', newScene);
  };

  const setMotion = (newMotion: MotionPreference) => {
    setMotionState(newMotion);
    localStorage.setItem('vf_motion_pref', newMotion);
  };

  // Derive effective scene
  const effectiveScene: EffectiveScene = useMemo(() => {
    if (scene === 'auto') return autoScene;
    return scene;
  }, [scene, autoScene]);

  // Subtle pointer parallax (Desktop only, minimal offset, throttled / requestAnimationFrame)
  useEffect(() => {
    if (motion === 'off' || motion === 'reduced') {
      setPointerOffset({ x: 0, y: 0 });
      return;
    }

    // Touch device detection: skip pointer listener on touch devices
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      return;
    }

    let rafId: number | null = null;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      // Normalized between -1 and 1
      targetX = ((e.clientX / innerWidth) - 0.5) * 2;
      targetY = ((e.clientY / innerHeight) - 0.5) * 2;

      if (!rafId) {
        rafId = requestAnimationFrame(updateOffset);
      }
    };

    const updateOffset = () => {
      // Smooth lerp damping
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      setPointerOffset({
        x: Math.round(currentX * 1000) / 1000,
        y: Math.round(currentY * 1000) / 1000,
      });

      if (Math.abs(targetX - currentX) > 0.005 || Math.abs(targetY - currentY) > 0.005) {
        rafId = requestAnimationFrame(updateOffset);
      } else {
        rafId = null;
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [motion]);

  // Track window scroll offset with passive listener
  useEffect(() => {
    const handleScroll = () => {
      setScrollOffset(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <AtmosphereContext.Provider
      value={{
        scene,
        setScene,
        effectiveScene,
        motion,
        setMotion,
        pointerOffset,
        scrollOffset,
        timeString,
      }}
    >
      {children}
    </AtmosphereContext.Provider>
  );
};

export const useAtmosphere = () => {
  const context = useContext(AtmosphereContext);
  if (!context) {
    throw new Error('useAtmosphere must be used within an AtmosphereProvider');
  }
  return context;
};
