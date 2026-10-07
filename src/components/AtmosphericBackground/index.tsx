import React from 'react';
import { useAtmosphere } from '../../context/AtmosphereContext';
import { SkyGradientLayer } from './SkyGradientLayer';
import { CelestialBodyLayer } from './CelestialBodyLayer';
import { StarFieldLayer } from './StarFieldLayer';
import { AtmosphericLightRaysLayer } from './AtmosphericLightRaysLayer';
import { DistantHorizonLayer } from './DistantHorizonLayer';
import { CloudSystemLayer } from './CloudSystemLayer';
import { WeatherParticlesLayer } from './WeatherParticlesLayer';

export const AtmosphericBackground: React.FC = () => {
  const { effectiveScene, motion, pointerOffset } = useAtmosphere();

  return (
    <div
      id="vf-atmospheric-viewport"
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 1. Base Sky Gradient Layer with Breathing Ambient Tone */}
      <SkyGradientLayer scene={effectiveScene} />

      {/* 2. Celestial Stars & Constellations (Night & Sunset Asynchronous Twinkle) */}
      <StarFieldLayer
        scene={effectiveScene}
        pointerOffset={pointerOffset}
        motion={motion}
      />

      {/* 3. Celestial Body (Sun with Solar Arc / Moon with Breathing Lunar Halo) */}
      <CelestialBodyLayer
        scene={effectiveScene}
        pointerOffset={pointerOffset}
        motion={motion}
      />

      {/* 4. Atmospheric Crepuscular Light Rays & Passing Cloud Shadow Modulation */}
      <AtmosphericLightRaysLayer
        scene={effectiveScene}
        pointerOffset={pointerOffset}
        motion={motion}
      />

      {/* 5. Distant Mountain Horizon & Ground Atmospheric Haze */}
      <DistantHorizonLayer
        scene={effectiveScene}
        pointerOffset={pointerOffset}
        motion={motion}
      />

      {/* 6. Continuous Multi-Tier Cloud Formations (Visible & Endless Living Sky) */}
      <CloudSystemLayer
        scene={effectiveScene}
        pointerOffset={pointerOffset}
        motion={motion}
      />

      {/* 7. Dynamic Weather Particles (Multi-Depth Rain / Volumetric Fog / Floating Dust Motes) */}
      <WeatherParticlesLayer scene={effectiveScene} motion={motion} />

      {/* 8. Cinematic Desktop Edge Vignette & Rim Light */}
      <div className="absolute inset-0 bg-radial-vignette pointer-events-none opacity-40 dark:opacity-60 transition-opacity duration-1000" />
    </div>
  );
};
