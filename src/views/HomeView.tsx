import React, { useEffect, useRef } from 'react';
import { ArrowDownToLine, AudioLines, Captions, Check, ChevronRight, Clapperboard, LockKeyhole, Scissors, Sparkles, Video, WandSparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UrlInputBar } from '../components/UrlInputBar';
import { MediaResultCard } from '../components/MediaResultCard';
import { AdContainer } from '../components/ads/AdContainer';
import { AnimatedMediaIcon } from '../components/AnimatedMediaIcon';
import { MediaWorkflowAnimation } from '../components/MediaWorkflowAnimation';

const capabilities = [
  { icon: Video, title: 'Video, your way', text: 'Choose from the video formats and resolutions available for your link.' },
  { icon: AudioLines, title: 'Audio, cleanly extracted', text: 'Save an available audio stream in the format offered by its source.' },
  { icon: Captions, title: 'Captions included', text: 'When captions are available, choose a language and export format.' },
  { icon: Scissors, title: 'Trim the moment', text: 'Set a start and end point to prepare a shorter clip.' },
];

export const HomeView: React.FC = () => {
  const { setRoute } = useApp();
  const homeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = homeRef.current;
    if (!root) return;
    const revealItems = root.querySelectorAll<HTMLElement>('[data-reveal-on-scroll]');
    if (!('IntersectionObserver' in window)) {
      revealItems.forEach(item => item.classList.add('is-visible'));
      return;
    }
    try {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
      root.classList.add('vf-reveal-ready');
      revealItems.forEach(item => observer.observe(item));
      return () => {
        observer.disconnect();
        root.classList.remove('vf-reveal-ready');
      };
    } catch {
      root.classList.remove('vf-reveal-ready');
      revealItems.forEach(item => item.classList.add('is-visible'));
    }
  }, []);

  return (
    <div className="vf-home" ref={homeRef}>
      <section className="vf-hero" aria-labelledby="home-title">
        <div className="vf-hero-grid" aria-hidden="true" />
        <div className="vf-hero-orbit vf-hero-orbit-one" aria-hidden="true" />
        <div className="vf-hero-orbit vf-hero-orbit-two" aria-hidden="true" />
        <div className="vf-media-stage" aria-hidden="true">
          <AnimatedMediaIcon kind="video" label="MP4 video" badge="MP4" className="vf-media-video" delay={0} variant={1} />
          <AnimatedMediaIcon kind="audio" label="Audio file" badge="AUDIO" className="vf-media-audio" delay={0.12} variant={2} />
          <AnimatedMediaIcon kind="image" label="Image file" badge="IMAGE" className="vf-media-image" delay={0.24} variant={3} />
          <AnimatedMediaIcon kind="play" label="Play media" className="vf-media-play" delay={0.36} variant={2} />
          <AnimatedMediaIcon kind="music" label="MP3 audio" badge="MP3" className="vf-media-music" delay={0.48} variant={1} />
          <AnimatedMediaIcon kind="format" label="WebM video" badge="WEBM" className="vf-media-format" delay={0.6} variant={3} />
        </div>
        <div className="vf-hero-inner">
          <div className="vf-hero-copy vf-reveal vf-reveal-1">
            <div className="vf-eyebrow"><span className="vf-live-dot" /> Your personal media workspace</div>
            <h1 id="home-title">Good media<br /><span>stays with you.</span></h1>
            <p>Bring a link. Choose the version you need. VideoFetch handles the rest.</p>
          </div>
          <div className="vf-downloader vf-reveal vf-reveal-2">
            <div className="vf-downloader-topline"><span><WandSparkles size={15} /> Start with a link</span><span className="vf-private"><LockKeyhole size={13} /> Private by design</span></div>
            <UrlInputBar />
            <div className="vf-supported-note"><span>Works with supported public media links</span><span className="vf-note-separator" /><span>Use content you own or have permission to save</span></div>
          </div>
          <MediaWorkflowAnimation />
          <div className="vf-hero-foot vf-reveal vf-reveal-3">
            <span><Check size={14} /> No account required to get started</span>
            <span><Check size={14} /> Quality options from the source</span>
            <span><Check size={14} /> Clear, real-time job status</span>
          </div>
          <div className="vf-scroll-cue" aria-hidden="true"><span /> Explore the workspace</div>
        </div>
      </section>

      <section className="vf-results-section" aria-label="Media analysis results">
        <MediaResultCard />
      </section>

      <AdContainer format="horizontal" minHeight={90} ariaLabel="Sponsored Content" />

      <section className="vf-capabilities" aria-labelledby="capabilities-title">
        <div className="vf-section-heading vf-scroll-reveal" data-reveal-on-scroll>
          <div className="vf-eyebrow"><Sparkles size={14} /> A considered set of tools</div>
          <h2 id="capabilities-title">Everything in its right place.</h2>
          <p>From a single link to a file ready for your library.</p>
        </div>
        <div className="vf-capability-grid">
          {capabilities.map(({ icon: Icon, title, text }, index) => (
            <article className="vf-capability vf-scroll-reveal" data-reveal-on-scroll key={title} style={{ transitionDelay: `${index * 55}ms` }}>
              <span className="vf-capability-icon"><Icon size={19} strokeWidth={1.7} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="vf-capability-line" aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      <AdContainer format="auto" minHeight={120} ariaLabel="Sponsored Content" />

      <section className="vf-rights-wrap">
        <div className="vf-rights vf-scroll-reveal" data-reveal-on-scroll>
          <div className="vf-rights-mark"><Clapperboard size={22} /></div>
          <div className="vf-rights-copy">
            <div className="vf-eyebrow">Made for mindful saving</div>
            <h2>Respect the people behind the work.</h2>
            <p>Only process public media you own, have permission to use, or that is otherwise permitted. VideoFetch does not bypass DRM, paywalls, or private access controls.</p>
          </div>
          <button onClick={() => setRoute('/dmca')} className="vf-secondary-link">Copyright policy <ChevronRight size={16} /></button>
        </div>
      </section>

      <section className="vf-faq" aria-labelledby="faq-title">
        <div className="vf-section-heading vf-scroll-reveal" data-reveal-on-scroll>
          <div className="vf-eyebrow"><ArrowDownToLine size={14} /> Before you begin</div>
          <h2 id="faq-title">A few useful details.</h2>
        </div>
        <div className="vf-faq-grid">
          <details className="vf-faq-item vf-scroll-reveal" data-reveal-on-scroll><summary>Which media links work?</summary><p>VideoFetch supports links from its available providers. Paste your link to check whether it can be analyzed.</p></details>
          <details className="vf-faq-item vf-scroll-reveal" data-reveal-on-scroll><summary>How do I choose quality?</summary><p>After analysis, VideoFetch shows the formats and qualities available from that source. Select the one that fits your needs.</p></details>
          <details className="vf-faq-item vf-scroll-reveal" data-reveal-on-scroll><summary>How long is my download available?</summary><p>Download links are temporary. The job window shows the current status and lets you save the file when it is ready.</p></details>
        </div>
      </section>
    </div>
  );
};
