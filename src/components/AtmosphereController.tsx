import React, { useState, useRef, useEffect } from 'react';
import {
  Sun,
  Sunset,
  Moon,
  CloudRain,
  CloudFog,
  Sparkles,
  Clock,
  Gauge,
  X,
  Compass,
} from 'lucide-react';
import { useAtmosphere } from '../context/AtmosphereContext';
import { AtmosphereScene, MotionPreference } from '../types';

interface AtmosphereControllerProps {
  compact?: boolean;
}

export const AtmosphereController: React.FC<AtmosphereControllerProps> = ({ compact = false }) => {
  const {
    scene,
    setScene,
    effectiveScene,
    motion,
    setMotion,
    timeString,
  } = useAtmosphere();

  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const sceneIcon = {
    morning: <Sunset className="w-4 h-4 text-amber-500 transform rotate-180" />,
    day: <Sun className="w-4 h-4 text-amber-400" />,
    sunset: <Sunset className="w-4 h-4 text-orange-500" />,
    night: <Moon className="w-4 h-4 text-indigo-400" />,
    rain: <CloudRain className="w-4 h-4 text-sky-400" />,
    fog: <CloudFog className="w-4 h-4 text-slate-400" />,
  }[effectiveScene];

  const sceneOptions: { id: AtmosphereScene; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: 'auto',
      label: 'Auto (Time)',
      icon: <Clock className="w-3.5 h-3.5 text-indigo-500" />,
      desc: 'Syncs with your local hour',
    },
    {
      id: 'morning',
      label: 'Morning',
      icon: <Sunset className="w-3.5 h-3.5 text-amber-500 transform rotate-180" />,
      desc: 'Warm sunrise & golden haze',
    },
    {
      id: 'day',
      label: 'Daylight',
      icon: <Sun className="w-3.5 h-3.5 text-amber-400" />,
      desc: 'Clear sky & gentle clouds',
    },
    {
      id: 'sunset',
      label: 'Sunset',
      icon: <Sunset className="w-3.5 h-3.5 text-orange-500" />,
      desc: 'Twilight glow & evening stars',
    },
    {
      id: 'night',
      label: 'Midnight',
      icon: <Moon className="w-3.5 h-3.5 text-indigo-400" />,
      desc: 'Moonlight & starlight field',
    },
    {
      id: 'rain',
      label: 'Light Rain',
      icon: <CloudRain className="w-3.5 h-3.5 text-sky-400" />,
      desc: 'Quiet falling rain ambience',
    },
    {
      id: 'fog',
      label: 'Misty Fog',
      icon: <CloudFog className="w-3.5 h-3.5 text-slate-400" />,
      desc: 'Soft rolling atmospheric mist',
    },
  ];

  const motionOptions: { id: MotionPreference; label: string }[] = [
    { id: 'full', label: 'Full Drift' },
    { id: 'reduced', label: 'Reduced' },
    { id: 'off', label: 'Static' },
  ];

  return (
    <div className="relative inline-block" ref={panelRef}>
      {/* Trigger Button */}
      <button
        type="button"
        id="vf-atmosphere-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Ambiance & Atmosphere Controls"
        aria-expanded={isOpen}
        title={`Atmosphere: ${scene === 'auto' ? `Auto (${effectiveScene})` : scene}`}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md transition-all vf-btn-tactile shadow-sm cursor-pointer"
      >
        <span className="flex items-center justify-center">{sceneIcon}</span>
        <span className="hidden sm:inline capitalize text-[11px] font-medium tracking-wide">
          {scene === 'auto' ? 'Auto' : scene}
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/80 animate-pulse" />
      </button>

      {/* Ambiance Settings Modal / Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-80 p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-950/20 z-50 vf-slide-down space-y-4"
          role="dialog"
          aria-label="Environmental Atmosphere Settings"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-indigo-500" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Lo-Fi Ambiance
                </h4>
                <div className="text-[10px] text-slate-400">
                  {timeString ? `${timeString} · ` : ''}Active: <span className="capitalize font-semibold text-indigo-500">{effectiveScene}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 vf-btn-tactile"
              aria-label="Close atmosphere panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scene Grid Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>ENVIRONMENT SCENE</span>
              {scene === 'auto' && (
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                  Clock Synced
                </span>
              )}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {sceneOptions.map(opt => {
                const isSelected = scene === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setScene(opt.id)}
                    className={`flex items-start gap-2 p-2 rounded-xl text-left transition-all vf-btn-tactile ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-100 shadow-sm'
                        : 'bg-slate-50/60 dark:bg-slate-800/40 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">{opt.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold leading-tight flex items-center gap-1">
                        {opt.label}
                        {isSelected && <span className="w-1 h-1 rounded-full bg-indigo-600" />}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate leading-snug mt-0.5">
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Motion Mode Segmented Control */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>MOTION &amp; PARALLAX</span>
              <span className="text-[10px] text-slate-400 font-normal">
                Battery friendly
              </span>
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl">
              {motionOptions.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMotion(m.id)}
                  className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-all text-center vf-btn-tactile ${
                    motion === m.id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
