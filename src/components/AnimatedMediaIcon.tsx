import React from 'react';
import { AudioLines, FileImage, FileVideo2, Music2, Play, type LucideIcon } from 'lucide-react';

type MediaGlyph = 'video' | 'audio' | 'image' | 'play' | 'music' | 'format';

const glyphs: Record<MediaGlyph, LucideIcon> = {
  video: FileVideo2,
  audio: AudioLines,
  image: FileImage,
  play: Play,
  music: Music2,
  format: FileVideo2,
};

interface AnimatedMediaIconProps {
  kind: MediaGlyph;
  label: string;
  badge?: string;
  className?: string;
  delay?: number;
  variant?: number;
}

/** Decorative, CSS-driven media tile for the homepage hero. */
export const AnimatedMediaIcon: React.FC<AnimatedMediaIconProps> = ({
  kind, label, badge, className = '', delay = 0, variant = 1,
}) => {
  const Icon = glyphs[kind];
  return (
    <div
      className={`vf-media-float vf-media-float-${variant} ${className}`}
      style={{ '--vf-float-delay': `${delay}s` } as React.CSSProperties}
      aria-hidden="true"
      title={label}
    >
      <div className="vf-media-tile">
        <span className="vf-media-tile-icon"><Icon size={25} strokeWidth={1.7} /></span>
        {kind === 'play' && <span className="vf-media-play-mark"><Play size={10} fill="currentColor" /></span>}
        {kind === 'audio' && <span className="vf-media-wave"><i /><i /><i /><i /><i /></span>}
        {badge && <span className="vf-media-badge">{badge}</span>}
      </div>
    </div>
  );
};
