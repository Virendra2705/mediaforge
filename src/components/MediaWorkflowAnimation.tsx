import React from 'react';
import {
  AudioLines,
  Check,
  ClipboardPaste,
  Download,
  FileImage,
  FileVideo2,
  ScanSearch,
} from 'lucide-react';

const Pipe: React.FC<{ d: string; className?: string }> = ({ d, className = '' }) => (
  <g className={className}>
    <path className="vf-workflow-pipe-base" d={d} />
    <path className="vf-workflow-pipe-glow" d={d} />
    <path className="vf-workflow-pipe-core" d={d} />
    <path className="vf-workflow-pipe-pulse" pathLength="1" d={d} />
  </g>
);

const Particle: React.FC<{ d: string; duration: string; delay?: string; className?: string }> = ({ d, duration, delay = '0s', className = '' }) => (
  <circle className={`vf-workflow-particle ${className}`} r="3.2">
    <animateMotion path={d} dur={duration} begin={delay} repeatCount="indefinite" />
  </circle>
);

const ProcessOutputs: React.FC = () => (
  <div className="vf-workflow-outputs">
    <span className="vf-workflow-output vf-workflow-output-video"><FileVideo2 size={14} /> VIDEO</span>
    <span className="vf-workflow-output vf-workflow-output-audio"><AudioLines size={14} /> AUDIO</span>
    <span className="vf-workflow-output vf-workflow-output-image"><FileImage size={14} /> IMAGE</span>
  </div>
);

/** Lightweight CSS/SVG workflow; all motion is autonomous and compositor-friendly. */
export const MediaWorkflowAnimation: React.FC = () => (
  <div className="vf-workflow" role="img" aria-label="Media workflow: paste a link, analyze it, process video, audio, or image, then download the result.">
    <div className="vf-workflow-heading" aria-hidden="true">
      <span className="vf-workflow-kicker">One clear path</span>
      <span className="vf-workflow-title">From link to media</span>
    </div>

    <svg className="vf-workflow-svg vf-workflow-svg-desktop" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true">
      <Pipe d="M132 43 H318" />
      <Pipe d="M382 43 H628" className="vf-workflow-delay-a" />
      <Pipe d="M660 72 C640 94 600 104 565 132" className="vf-workflow-branch-video vf-workflow-delay-b" />
      <Pipe d="M660 72 V132" className="vf-workflow-branch-audio vf-workflow-delay-c" />
      <Pipe d="M660 72 C680 94 720 104 755 132" className="vf-workflow-branch-image vf-workflow-delay-a" />
      <Pipe d="M565 132 C590 179 623 186 660 186" className="vf-workflow-branch-video vf-workflow-delay-c" />
      <Pipe d="M660 132 V186" className="vf-workflow-branch-audio vf-workflow-delay-b" />
      <Pipe d="M755 132 C730 179 697 186 660 186" className="vf-workflow-branch-image vf-workflow-delay-a" />
      <Pipe d="M660 186 H790 C820 186 820 155 820 125 V75 C820 57 837 43 858 43" className="vf-workflow-delay-b" />
      <Particle d="M132 43 H318" duration="1.55s" />
      <Particle d="M382 43 H628" duration="1.9s" delay="-.8s" />
      <Particle d="M660 72 C640 94 600 104 565 132" duration="1.35s" delay="-.45s" className="vf-workflow-branch-video" />
      <Particle d="M660 72 V132" duration="1.5s" delay="-.2s" className="vf-workflow-branch-audio" />
      <Particle d="M660 72 C680 94 720 104 755 132" duration="1.7s" delay="-.7s" className="vf-workflow-branch-image" />
      <Particle d="M660 186 H790 C820 186 820 155 820 125 V75 C820 57 837 43 858 43" duration="2.2s" delay="-.5s" />
    </svg>

    <svg className="vf-workflow-svg vf-workflow-svg-mobile" viewBox="0 0 360 465" preserveAspectRatio="none" aria-hidden="true">
      <Pipe d="M44 132 V158" />
      <Pipe d="M44 206 V229" className="vf-workflow-delay-a" />
      <Pipe d="M76 253 V284" className="vf-workflow-delay-b" />
      <Pipe d="M76 284 H96 C108 284 108 302 111 321" className="vf-workflow-branch-video vf-workflow-delay-b" />
      <Pipe d="M76 284 H196 V321" className="vf-workflow-branch-audio vf-workflow-delay-c" />
      <Pipe d="M76 284 H281 C270 297 270 309 281 321" className="vf-workflow-branch-image vf-workflow-delay-a" />
      <Pipe d="M111 321 C134 347 166 350 196 350" className="vf-workflow-branch-video vf-workflow-delay-c" />
      <Pipe d="M196 321 V350" className="vf-workflow-branch-audio vf-workflow-delay-b" />
      <Pipe d="M281 321 C258 347 226 350 196 350" className="vf-workflow-branch-image vf-workflow-delay-a" />
      <Pipe d="M196 350 H337 V429 H315" className="vf-workflow-delay-b" />
      <Particle d="M44 132 V158" duration="1.3s" />
      <Particle d="M44 206 V229" duration="1.45s" delay="-.4s" />
      <Particle d="M76 253 V284" duration=".7s" delay="-.2s" />
      <Particle d="M76 284 H96 C108 284 108 302 111 321" duration="1.5s" delay="-.3s" className="vf-workflow-branch-video" />
      <Particle d="M76 284 H196 V321" duration="1.8s" delay="-.75s" className="vf-workflow-branch-audio" />
      <Particle d="M76 284 H281 C270 297 270 309 281 321" duration="1.65s" delay="-.95s" className="vf-workflow-branch-image" />
      <Particle d="M196 350 H337 V429 H315" duration="2s" delay="-.6s" />
    </svg>

    <div className="vf-workflow-stage vf-workflow-paste">
      <span className="vf-workflow-icon"><ClipboardPaste size={23} /></span>
      <span className="vf-workflow-label">PASTE LINK</span>
      <span className="vf-workflow-url"><i /> https://media.link/…</span>
    </div>

    <div className="vf-workflow-stage vf-workflow-analyze">
      <span className="vf-workflow-icon vf-workflow-scan"><ScanSearch size={23} /></span>
      <span className="vf-workflow-label">ANALYZE</span>
      <span className="vf-workflow-detail">Inspect source formats</span>
    </div>

    <div className="vf-workflow-stage vf-workflow-process">
      <span className="vf-workflow-icon vf-workflow-icon-process"><AudioLines size={23} /></span>
      <span className="vf-workflow-label">PROCESS MEDIA</span>
      <span className="vf-workflow-detail">Choose an available format</span>
      <ProcessOutputs />
    </div>

    <div className="vf-workflow-stage vf-workflow-download">
      <span className="vf-workflow-icon vf-workflow-download-icon"><Download size={23} /></span>
      <span className="vf-workflow-label">DOWNLOAD</span>
      <span className="vf-workflow-complete"><Check size={11} /> READY</span>
    </div>
  </div>
);
