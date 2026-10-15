import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { AtmosphereScene, EffectiveScene, MotionPreference } from '../types';

interface AtmosphereContextType {
  scene: AtmosphereScene;
  setScene: (scene: AtmosphereScene) => void;
  effectiveScene: EffectiveScene;
  motion: MotionPreference;
  setMotion: (motion: MotionPreference) => void;
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

  useEffect(() => {
    document.documentElement.dataset.vfMotion = motion;
  }, [motion]);

  // Derive effective scene
  const effectiveScene: EffectiveScene = useMemo(() => {
    if (scene === 'auto') return autoScene;
    return scene;
  }, [scene, autoScene]);

  return (
    <AtmosphereContext.Provider
      value={{
        scene,
        setScene,
        effectiveScene,
        motion,
        setMotion,
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
