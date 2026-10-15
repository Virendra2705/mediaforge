import React from 'react';
import { useAtmosphere } from '../../context/AtmosphereContext';

/** Lightweight CSS atmosphere; keeps scene preferences without continuously animating large layers. */
export const AtmosphericBackground: React.FC = () => {
  const { effectiveScene } = useAtmosphere();

  return (
    <div
      id="vf-atmospheric-viewport"
      className={`vf-atmosphere vf-atmosphere-${effectiveScene}`}
      aria-hidden="true"
    >
      <span className="vf-atmosphere-aurora" />
      <span className="vf-atmosphere-glow vf-atmosphere-glow-a" />
      <span className="vf-atmosphere-glow vf-atmosphere-glow-b" />
      <span className="vf-atmosphere-grain" />
    </div>
  );
};
