// src/App.tsx
import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import Lenis from 'lenis';
import { KiboApp } from './desktop/KiboApp';
import { SoulCanvas } from './components/SoulCanvas';
import { SOUL_SKINS } from './lib/soulMath';

interface StoryScene {
  id: string;
  tag: string;
  shortcut: string[];
  spokenPrompt: string;
  kiboReply: string;
  soulMode: 'LISTENING' | 'THINKING' | 'TALKING';
  soulExpr: 'NORMAL' | 'HAPPY' | 'EXCITED' | 'PEEKING';
}

const STORY_SCENES: StoryScene[] = [
  {
    id: 'command',
    tag: 'Voice Control',
    shortcut: ['Win', 'Alt'],
    spokenPrompt: 'Switch to dark mode and play my focus playlist on Spotify.',
    kiboReply: 'Dark mode enabled. Playing Deep Focus on Spotify.',
    soulMode: 'TALKING',
    soulExpr: 'HAPPY',
  },
  {
    id: 'vision',
    tag: 'Screen Vision',
    shortcut: ['Ctrl', 'Shift'],
    spokenPrompt: 'Why is this layout overflowing on smaller screens?',
    kiboReply: 'The flex container on line 42 needs min-width: 0 to allow shrinking.',
    soulMode: 'THINKING',
    soulExpr: 'PEEKING',
  },
  {
    id: 'dictate',
    tag: 'Clean Dictation',
    shortcut: ['Ctrl', 'Win'],
    spokenPrompt: 'uh let us move the sync to Thursday at 3—actually make it Friday at 10am',
    kiboReply: 'Let’s move the sync to Friday at 10:00 AM.',
    soulMode: 'LISTENING',
    soulExpr: 'NORMAL',
  },
  {
    id: 'agents',
    tag: 'Background Agents',
    shortcut: ['Win', 'Alt'],
    spokenPrompt: 'Research the top 5 minimal portfolio layouts and save them to Notion.',
    kiboReply: 'Agent dispatched. 5 entries synced to your Notion workspace.',
    soulMode: 'TALKING',
    soulExpr: 'EXCITED',
  },
];

const NOTCH_FEATURES = [
  {
    name: 'Controls',
    summary: 'Instant toggles for Wi-Fi, Bluetooth, Night Light warmth, Dark Mode, Volume, and live media scrubbing.',
    previewTitle: 'System & Media',
    previewMeta: 'Netflix · Spotify · System Audio',
  },
  {
    name: 'Today',
    summary: 'Focus countdown timer, daily task list, local weather, and scheduled autopilot routines in one view.',
    previewTitle: 'Focus & Tasks',
    previewMeta: '25:00 Focus Session · 4/5 Tasks',
  },
  {
    name: 'Agents',
    summary: 'Parallel background workers that clone web layouts, inspect CSS tokens, and curate Notion databases.',
    previewTitle: 'Autonomous Workers',
    previewMeta: 'Running in background · Zero interruption',
  },
  {
    name: 'Clipboard',
    summary: 'Searchable history of copied text, links, code snippets, and screenshots with one-keystroke pasting.',
    previewTitle: 'Universal Buffer',
    previewMeta: 'Text · Links · Code · Screenshots',
  },
  {
    name: 'Apps',
    summary: 'Fast launcher for installed desktop software, Steam games, and web tools without leaving your workflow.',
    previewTitle: 'Quick Launcher',
    previewMeta: 'Win32 · Store Apps · Web',
  },
  {
    name: 'Wallpaper',
    summary: 'Curated 4K dynamic desktop wallpapers with one-click live setting and custom image importing.',
    previewTitle: 'Dynamic Wallpapers',
    previewMeta: '4K · Unsplash · Local Files',
  },
  {
    name: 'Power',
    summary: 'Instant shortcuts to lock, sleep, restart, or shut down your PC directly from the top notch.',
    previewTitle: 'Power & Sleep',
    previewMeta: 'Lock · Sleep · Restart · Shutdown',
  },
];

export function App() {
  const isDesktopRuntime = (() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('mode') === 'desktop' ||
      params.get('view') === 'desktop' ||
      window.location.hash === '#desktop' ||
      window.location.protocol === 'file:'
    ) {
      return true;
    }
    return (
      Boolean((window as any).kiboAPI) ||
      Boolean((window as any).hitodamaAPI) ||
      navigator.userAgent.toLowerCase().includes('electron')
    );
  })();

  const [sceneIdx, setSceneIdx] = useState(0);
  const [featureIdx, setFeatureIdx] = useState(0);
  const pageRef = useRef<HTMLDivElement>(null);
  const sceneCardRef = useRef<HTMLDivElement>(null);
  const featureBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDesktopRuntime) {
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
      return;
    }

    document.documentElement.style.background = '#F7F7F4';
    document.body.style.background = '#F7F7F4';
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto';

    // Initialize Lenis smooth scrolling
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    let rafId: number;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    // Hero staggered word reveal
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.kibo-reveal-word',
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.75,
          stagger: 0.045,
          ease: 'power3.out',
          delay: 0.1,
        }
      );

      gsap.fromTo(
        '.kibo-hero-fade',
        { y: 18, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.12,
          ease: 'power3.out',
          delay: 0.45,
        }
      );
    }, pageRef);

    // Scroll-triggered section reveals
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            gsap.to(entry.target, {
              y: 0,
              opacity: 1,
              duration: 0.85,
              ease: 'power3.out',
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );

    const sections = document.querySelectorAll('.kibo-scroll-section');
    sections.forEach((sec) => {
      gsap.set(sec, { y: 32, opacity: 0 });
      observer.observe(sec);
    });

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      ctx.revert();
      observer.disconnect();
    };
  }, [isDesktopRuntime]);

  // Auto-advance the Hero story reel every 5.2 seconds
  useEffect(() => {
    if (isDesktopRuntime) return;
    const timer = setInterval(() => {
      setSceneIdx((prev) => (prev + 1) % STORY_SCENES.length);
    }, 5200);
    return () => clearInterval(timer);
  }, [isDesktopRuntime]);

  // Smooth GSAP transition when sceneIdx changes
  useEffect(() => {
    if (isDesktopRuntime || !sceneCardRef.current) return;
    gsap.fromTo(
      sceneCardRef.current,
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' }
    );
  }, [sceneIdx, isDesktopRuntime]);

  // Smooth GSAP transition when featureIdx changes
  useEffect(() => {
    if (isDesktopRuntime || !featureBodyRef.current) return;
    gsap.fromTo(
      featureBodyRef.current,
      { y: 8, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out' }
    );
  }, [featureIdx, isDesktopRuntime]);

  if (isDesktopRuntime) {
    return <KiboApp />;
  }

  const activeScene = STORY_SCENES[sceneIdx];
  const activeFeature = NOTCH_FEATURES[featureIdx];
  const headlineWords = 'A quiet companion that lives in your top bezel.'.split(' ');

  return (
    <div ref={pageRef} className="kibo-web-root">
      <style>{`
        .kibo-web-root {
          min-height: 100vh;
          background: #F7F7F4;
          color: #121316;
          font-family: 'Figtree', -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .kibo-web-nav {
          position: sticky;
          top: 0;
          z-index: 40;
          background: rgba(247, 247, 244, 0.84);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(18, 19, 22, 0.06);
        }
        .kibo-web-nav-inner {
          max-width: 1120px;
          margin: 0 auto;
          padding: 16px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .kibo-web-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: #121316;
          font-weight: 800;
          font-size: 17px;
          letter-spacing: -0.02em;
        }
        .kibo-web-links {
          display: flex;
          align-items: center;
          gap: 32px;
        }
        .kibo-web-link {
          color: #5A5E68;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s ease;
        }
        .kibo-web-link:hover {
          color: #121316;
        }
        .kibo-web-pill-cta {
          background: #121316;
          color: #FFFFFF;
          padding: 9px 18px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transition: transform 0.2s ease, background 0.2s ease;
        }
        .kibo-web-pill-cta:hover {
          background: #272930;
          transform: translateY(-1px);
        }
        .kibo-web-container {
          max-width: 1120px;
          margin: 0 auto;
          padding: 0 28px;
        }
        .kibo-hero {
          padding: 76px 0 64px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .kibo-hero-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(18, 19, 22, 0.045);
          border: 1px solid rgba(18, 19, 22, 0.07);
          font-size: 12.5px;
          font-weight: 600;
          color: #454952;
          margin-bottom: 24px;
        }
        .kibo-hero-tag-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #38BDF8;
        }
        .kibo-hero-h1 {
          font-size: clamp(2.6rem, 5vw, 4.25rem);
          font-weight: 800;
          line-height: 1.07;
          letter-spacing: -0.035em;
          max-width: 780px;
          margin: 0 0 20px;
          color: #121316;
        }
        .kibo-word-mask {
          display: inline-block;
          overflow: hidden;
          vertical-align: bottom;
          margin-right: 0.26em;
        }
        .kibo-reveal-word {
          display: inline-block;
        }
        .kibo-hero-sub {
          font-size: 18px;
          line-height: 1.6;
          color: #5A5E68;
          max-width: 600px;
          margin: 0 0 44px;
          font-weight: 400;
        }
        .kibo-stage-frame {
          width: 100%;
          background: #14161D;
          border-radius: 26px;
          border: 1px solid rgba(18, 19, 22, 0.12);
          box-shadow: 0 32px 80px rgba(18, 19, 22, 0.12);
          overflow: hidden;
          position: relative;
          text-align: left;
        }
        .kibo-stage-bezel {
          display: flex;
          justify-content: center;
          position: relative;
          height: 68px;
        }
        .kibo-stage-notch {
          width: 210px;
          height: 64px;
          background: #0C0C0E;
          border-bottom-left-radius: 20px;
          border-bottom-right-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-top: none;
        }
        .kibo-stage-viewport {
          padding: 28px 44px 42px;
          min-height: 320px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: background 0.5s ease;
        }
        .kibo-stage-cards {
          max-width: 640px;
          margin: 12px auto 0;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .kibo-prompt-bubble {
          background: #FFFFFF;
          color: #121316;
          padding: 16px 22px;
          border-radius: 18px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .kibo-reply-bubble {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #F8FAFC;
          padding: 16px 22px;
          border-radius: 18px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .kibo-stage-tabs {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 36px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .kibo-stage-tab {
          background: transparent;
          border: none;
          text-align: left;
          padding: 10px 12px;
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.2s ease;
          color: #8E939E;
        }
        .kibo-stage-tab.active {
          background: rgba(255, 255, 255, 0.07);
          color: #FFFFFF;
        }
        .kibo-section {
          padding: 96px 0;
          border-top: 1px solid rgba(18, 19, 22, 0.07);
        }
        .kibo-section-header {
          max-width: 580px;
          margin-bottom: 48px;
        }
        .kibo-eyebrow {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #68707C;
          margin-bottom: 10px;
          display: block;
        }
        .kibo-h2 {
          font-size: clamp(1.9rem, 3.2vw, 2.75rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.14;
          margin: 0 0 14px;
          color: #121316;
        }
        .kibo-lead {
          font-size: 16.5px;
          line-height: 1.6;
          color: #5A5E68;
          margin: 0;
        }
        .kibo-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 22px;
        }
        .kibo-card {
          background: #FFFFFF;
          border: 1px solid rgba(18, 19, 22, 0.07);
          border-radius: 22px;
          padding: 30px;
          transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.28s ease;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .kibo-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 44px rgba(18, 19, 22, 0.06);
        }
        .kibo-kbd-group {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 22px;
        }
        .kibo-kbd {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11.5px;
          font-weight: 600;
          background: #F1F2EE;
          border: 1px solid rgba(18, 19, 22, 0.12);
          color: #121316;
          padding: 4px 10px;
          border-radius: 7px;
          box-shadow: 0 2px 0 rgba(18, 19, 22, 0.08);
        }
        .kibo-notch-showcase {
          display: grid;
          grid-template-columns: 0.9fr 1.1fr;
          gap: 36px;
          align-items: center;
        }
        .kibo-feature-pill-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .kibo-feature-btn {
          background: transparent;
          border: 1px solid transparent;
          border-radius: 16px;
          padding: 16px 20px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .kibo-feature-btn.active {
          background: #FFFFFF;
          border-color: rgba(18, 19, 22, 0.08);
          box-shadow: 0 10px 28px rgba(18, 19, 22, 0.05);
        }
        @media (max-width: 860px) {
          .kibo-grid-3, .kibo-notch-showcase, .kibo-stage-tabs {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Top Navigation */}
      <header className="kibo-web-nav">
        <div className="kibo-web-nav-inner">
          <a href="#top" className="kibo-web-brand">
            <SoulCanvas
              soul={SOUL_SKINS[0]}
              width={32}
              height={28}
              scale={0.75}
              mode="LISTENING"
              interactive={false}
            />
            <span>Kibo</span>
          </a>

          <nav className="kibo-web-links">
            <a href="#how-it-works" className="kibo-web-link">How it works</a>
            <a href="#workspace" className="kibo-web-link">Notch Workspace</a>
            <a href="#architecture" className="kibo-web-link">Setup</a>
          </nav>

          <a href="#architecture" className="kibo-web-pill-cta">
            Get Started
          </a>
        </div>
      </header>

      <main id="top" className="kibo-web-container">
        {/* Hero Section */}
        <section className="kibo-hero">
          <div className="kibo-hero-tag kibo-hero-fade">
            <span className="kibo-hero-tag-dot" />
            <span>Native Windows Desktop Companion</span>
          </div>

          <h1 className="kibo-hero-h1">
            {headlineWords.map((word, idx) => (
              <span key={idx} className="kibo-word-mask">
                <span className="kibo-reveal-word">{word}</span>
              </span>
            ))}
          </h1>

          <p className="kibo-hero-sub kibo-hero-fade">
            Kibo rests unobtrusively at the top of your screen, expanding when you
            need media controls, quick tools, screen vision, clean voice dictation,
            or background agents—and tucking away when you don’t.
          </p>

          {/* Auto-Playing Visual Story Stage */}
          <div className="kibo-stage-frame kibo-hero-fade">
            <div className="kibo-stage-bezel">
              <div className="kibo-stage-notch">
                <SoulCanvas
                  soul={SOUL_SKINS[0]}
                  width={84}
                  height={58}
                  scale={1.08}
                  mode={activeScene.soulMode}
                  expression={activeScene.soulExpr}
                  interactive={true}
                />
              </div>
            </div>

            <div className="kibo-stage-viewport">
              <div ref={sceneCardRef} className="kibo-stage-cards">
                <div className="kibo-prompt-bubble">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#68707C', letterSpacing: '0.04em' }}>
                      YOU · HOLD {activeScene.shortcut.join(' + ').toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#0284C7' }}>
                      {activeScene.tag}
                    </span>
                  </div>
                  <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.45 }}>
                    “{activeScene.spokenPrompt}”
                  </div>
                </div>

                <div className="kibo-reply-bubble">
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#38BDF8', letterSpacing: '0.04em' }}>
                    KIBO
                  </span>
                  <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.45, color: '#E2E8F0' }}>
                    {activeScene.kiboReply}
                  </div>
                </div>
              </div>

              {/* Scene Selector Strip */}
              <div className="kibo-stage-tabs">
                {STORY_SCENES.map((sc, idx) => {
                  const isActive = idx === sceneIdx;
                  return (
                    <button
                      key={sc.id}
                      onClick={() => setSceneIdx(idx)}
                      className={`kibo-stage-tab ${isActive ? 'active' : ''}`}
                    >
                      <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", opacity: 0.7 }}>
                        0{idx + 1} · {sc.shortcut.join('+')}
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 3 }}>
                        {sc.tag}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Section 1: Three Shortcuts */}
        <section id="how-it-works" className="kibo-section kibo-scroll-section">
          <div className="kibo-section-header">
            <span className="kibo-eyebrow">01 / Interaction</span>
            <h2 className="kibo-h2">Three shortcuts. Zero window switching.</h2>
            <p className="kibo-lead">
              Kibo works directly over whichever application you are already using.
              Hold a shortcut, speak naturally, and release.
            </p>
          </div>

          <div className="kibo-grid-3">
            <div className="kibo-card">
              <div>
                <div className="kibo-kbd-group">
                  <kbd className="kibo-kbd">Win</kbd>
                  <span>+</span>
                  <kbd className="kibo-kbd">Alt</kbd>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>
                  Ask & Control
                </h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#5A5E68', margin: 0 }}>
                  Ask Kibo to click buttons on screen, open installed apps, search
                  the web, toggle system dark mode or night light, or control your
                  active Spotify and Netflix sessions.
                </p>
              </div>
            </div>

            <div className="kibo-card">
              <div>
                <div className="kibo-kbd-group">
                  <kbd className="kibo-kbd">Ctrl</kbd>
                  <span>+</span>
                  <kbd className="kibo-kbd">Shift</kbd>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>
                  Circle to Ask
                </h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#5A5E68', margin: 0 }}>
                  Draw a loop around any chart, error log, or UI element on your
                  monitor and ask a question out loud. Kibo inspects that exact
                  region and answers immediately.
                </p>
              </div>
            </div>

            <div className="kibo-card">
              <div>
                <div className="kibo-kbd-group">
                  <kbd className="kibo-kbd">Ctrl</kbd>
                  <span>+</span>
                  <kbd className="kibo-kbd">Win</kbd>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>
                  Clean Dictation
                </h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#5A5E68', margin: 0 }}>
                  Speak freely with false starts or mid-sentence changes. Kibo
                  removes filler words and types clean, well-punctuated text
                  straight into your active cursor.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: The Notch Workspace */}
        <section id="workspace" className="kibo-section kibo-scroll-section">
          <div className="kibo-section-header">
            <span className="kibo-eyebrow">02 / Top Bezel Workspace</span>
            <h2 className="kibo-h2">Everything you reach for, one scroll away.</h2>
            <p className="kibo-lead">
              Scroll down on the top bezel to expand Kibo’s workspace. When you
              move your mouse away, it smoothly tucks back into the top edge.
            </p>
          </div>

          <div className="kibo-notch-showcase">
            <div className="kibo-feature-pill-list">
              {NOTCH_FEATURES.map((feat, idx) => {
                const isActive = idx === featureIdx;
                return (
                  <button
                    key={feat.name}
                    onClick={() => setFeatureIdx(idx)}
                    className={`kibo-feature-btn ${isActive ? 'active' : ''}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 16, color: '#121316' }}>{feat.name}</strong>
                      <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#68707C' }}>
                        0{idx + 1}
                      </span>
                    </div>
                    {isActive && (
                      <p style={{ fontSize: 14, lineHeight: 1.55, color: '#5A5E68', margin: '8px 0 0' }}>
                        {feat.summary}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                background: '#0C0C0E',
                borderRadius: 24,
                padding: '32px',
                color: '#FFFFFF',
                minHeight: 340,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 24px 60px rgba(18, 19, 22, 0.14)',
              }}
            >
              {/* Simulated Notch Navigation Pill Bar */}
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  background: '#16171B',
                  padding: 5,
                  borderRadius: 999,
                  overflowX: 'auto',
                }}
              >
                {NOTCH_FEATURES.map((f, i) => (
                  <button
                    key={f.name}
                    onClick={() => setFeatureIdx(i)}
                    style={{
                      background: i === featureIdx ? 'rgba(92, 184, 255, 0.18)' : 'transparent',
                      color: i === featureIdx ? '#5CB8FF' : '#8E939E',
                      border: 'none',
                      borderRadius: 999,
                      padding: '6px 14px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>

              <div ref={featureBodyRef} style={{ margin: '32px 0' }}>
                <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#5CB8FF', marginBottom: 8 }}>
                  {activeFeature.previewMeta}
                </div>
                <h3 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
                  {activeFeature.previewTitle}
                </h3>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: '#A1A1AA', margin: 0 }}>
                  {activeFeature.summary}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 18,
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  fontSize: 12,
                  color: '#71717A',
                }}
              >
                <span>Auto-tucks when idle</span>
                <span>Zero fullscreen game or video interruption</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Local-First Setup */}
        <section id="architecture" className="kibo-section kibo-scroll-section">
          <div className="kibo-section-header">
            <span className="kibo-eyebrow">03 / Local-First Setup</span>
            <h2 className="kibo-h2">Runs directly on your machine with your own keys.</h2>
            <p className="kibo-lead">
              Kibo connects straight from your PC to Google Gemini and Tavily using
              your own free API keys—stored locally on your device with no middleman
              servers.
            </p>
          </div>

          <div className="kibo-grid-3">
            <div className="kibo-card">
              <div>
                <span className="kibo-eyebrow">Step 01</span>
                <h3 style={{ fontSize: 19, fontWeight: 700, margin: '6px 0 10px' }}>
                  Launch the Desktop App
                </h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#5A5E68', margin: 0 }}>
                  Run <code style={{ fontFamily: "'JetBrains Mono', monospace", background: '#F1F2EE', padding: '2px 6px', borderRadius: 5 }}>npm run app</code> to start Kibo in your Windows top bezel and system tray.
                </p>
              </div>
            </div>

            <div className="kibo-card">
              <div>
                <span className="kibo-eyebrow">Step 02</span>
                <h3 style={{ fontSize: 19, fontWeight: 700, margin: '6px 0 10px' }}>
                  Paste Your Gemini Key
                </h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#5A5E68', margin: 0 }}>
                  Open Settings from the Kibo tray icon and add a free Google AI Studio key for voice, vision, and dictation.
                </p>
              </div>
            </div>

            <div className="kibo-card">
              <div>
                <span className="kibo-eyebrow">Step 03</span>
                <h3 style={{ fontSize: 19, fontWeight: 700, margin: '6px 0 10px' }}>
                  Customize Your Loadout
                </h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#5A5E68', margin: 0 }}>
                  Earn Sparks passively as you complete daily tasks and focus timers to unlock new cores, voices, and abilities.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer
        style={{
          borderTop: '1px solid rgba(18, 19, 22, 0.07)',
          padding: '36px 28px',
          marginTop: 40,
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 13,
            color: '#68707C',
          }}
        >
          <span>Kibo — Desktop Companion for Windows</span>
          <span>Built with Electron, React & Native Win32 UIAutomation</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
