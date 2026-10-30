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
    spokenPrompt: 'uh let us move the sync to Thursday at 3, actually make it Friday at 10am',
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

const WindowsLogoIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
    <path d="M0 2.263L6.545 1.37v6.236H0V2.263zm0 5.942h6.545v6.257L0 13.568V8.205zm7.364-6.953L16 0v7.606H7.364V1.252zm0 6.953H16v7.618l-8.636-1.229V8.205z"/>
  </svg>
);

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

const FAQS = [
  {
    q: 'Does Kibo record my screen or send telemetry to third parties?',
    a: 'No. Kibo is strictly local-first. Screen vision and voice queries only process in direct response to your held shortcuts (Win + Alt, Ctrl + Shift, Ctrl + Win) and communicate directly with Google Gemini using your personal API key stored in your local Windows userData. Zero telemetry, zero cloud logging, and zero middleman servers.',
  },
  {
    q: 'Does Kibo interrupt games or full-screen videos?',
    a: 'Never. When you launch a fullscreen game or media session, Kibo automatically tucks up into an 18px top-bezel sliver or hides completely, forwarding 100% of mouse and keyboard inputs to your application.',
  },
  {
    q: 'Where do I get a free API key?',
    a: 'You can create a free key in seconds at Google AI Studio (aistudio.google.com). Once created, click the gear icon in the notch or right-click the system tray icon, select "Open Preferences", and paste it into the Account tab.',
  },
  {
    q: 'Can I customize the hotkeys, voices, and companion skin?',
    a: 'Yes. In Preferences, you can remap your activation hotkeys, switch between 4 real-time voice actors (Charon, Aoede, Fenrir, Puck), and select your favorite companion chassis pod.',
  },
  {
    q: 'How do I enable Kibo to run on Windows startup?',
    a: 'Right-click the Kibo icon in your Windows taskbar system tray and check "Run on Windows Startup", or toggle the startup switch in Preferences -> General.',
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
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const sceneCardRef = useRef<HTMLDivElement>(null);
  const featureBodyRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  const handleScrollToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, {
        duration: 1.35,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const targetEl = document.querySelector(targetId);
    if (!targetEl) return;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(targetEl as HTMLElement, {
        offset: -64,
        duration: 1.25,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });
    } else {
      targetEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

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
    lenisRef.current = lenis;

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
      lenisRef.current = null;
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
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@1,6..72,400;1,6..72,500;1,6..72,600&display=swap');

        .kibo-web-root {
          min-height: 100vh;
          background: #F7F7F4;
          color: #121316;
          font-family: 'Figtree', -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .kibo-serif-italic {
          font-family: 'Newsreader', 'Playfair Display', Georgia, serif !important;
          font-style: italic !important;
          font-weight: 500 !important;
          letter-spacing: -0.01em;
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
        .kibo-faq-item {
          border: 1px solid rgba(18, 19, 22, 0.08);
          border-radius: 18px;
          background: #FFFFFF;
          margin-bottom: 12px;
          overflow: hidden;
          transition: all 0.22s ease;
        }
        .kibo-faq-item.is-open {
          border-color: rgba(18, 19, 22, 0.18);
          box-shadow: 0 8px 24px rgba(18, 19, 22, 0.04);
        }
        .kibo-faq-header {
          width: 100%;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-align: left;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 16px;
          font-weight: 700;
          color: #121316;
          font-family: inherit;
        }
        .kibo-faq-icon {
          font-size: 18px;
          color: #71717A;
          transition: transform 0.22s ease;
        }
        .kibo-faq-item.is-open .kibo-faq-icon {
          transform: rotate(45deg);
        }
        .kibo-faq-content {
          padding: 0 24px 22px;
          font-size: 14.5px;
          line-height: 1.6;
          color: #5A5E68;
        }
        .kibo-footer-cta-card {
          background: #14161D;
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 44px 48px;
          color: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 24px;
          margin-bottom: 64px;
          box-shadow: 0 24px 60px rgba(18, 19, 22, 0.12);
        }
        .kibo-footer-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 36px;
          position: relative;
          z-index: 1;
        }
        .kibo-footer-col-title {
          font-size: 13px;
          font-weight: 700;
          color: #121316;
          margin-bottom: 16px;
          letter-spacing: -0.01em;
        }
        .kibo-footer-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .kibo-footer-link {
          font-size: 13.5px;
          color: #68707C;
          text-decoration: none;
          transition: color 0.18s ease;
        }
        .kibo-footer-link:hover {
          color: #121316;
        }
        .kibo-footer-watermark {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          font-size: clamp(80px, 15vw, 240px);
          font-weight: 900;
          letter-spacing: 0.15em;
          color: rgba(18, 19, 22, 0.035);
          pointer-events: none;
          user-select: none;
          z-index: 0;
          line-height: 1;
          white-space: nowrap;
        }
        @media (max-width: 860px) {
          .kibo-grid-3, .kibo-notch-showcase, .kibo-stage-tabs, .kibo-footer-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Top Navigation */}
      <header className="kibo-web-nav">
        <div className="kibo-web-nav-inner">
          <a href="#top" onClick={handleScrollToTop} className="kibo-web-brand" title="Scroll to top">
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
            <a href="#how-it-works" onClick={(e) => handleNavClick(e, '#how-it-works')} className="kibo-web-link">How it works</a>
            <a href="#workspace" onClick={(e) => handleNavClick(e, '#workspace')} className="kibo-web-link">Notch Workspace</a>
            <a href="#faq" onClick={(e) => handleNavClick(e, '#faq')} className="kibo-web-link">FAQ</a>
            <a href="#download" onClick={(e) => handleNavClick(e, '#download')} className="kibo-web-link">Download</a>
          </nav>

          <a
            href="/download/Kibo-Setup.exe"
            download="Kibo-Setup.exe"
            className="kibo-web-pill-cta"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <WindowsLogoIcon size={13} />
            <span>Download for Windows</span>
          </a>
        </div>
      </header>

      <main id="top" className="kibo-web-container">
        {/* Hero Section */}
        <section className="kibo-hero">
          <div className="kibo-hero-tag kibo-hero-fade">
            <span className="kibo-hero-tag-dot" />
            <span>The Desktop Companion for Windows</span>
          </div>

          <h1 className="kibo-hero-h1">
            <span className="kibo-word-mask"><span className="kibo-reveal-word">Control</span></span>{' '}
            <span className="kibo-word-mask"><span className="kibo-reveal-word">your</span></span>{' '}
            <span className="kibo-word-mask"><span className="kibo-reveal-word">PC</span></span>{' '}
            <span className="kibo-word-mask"><span className="kibo-reveal-word">with</span></span>{' '}
            <span className="kibo-word-mask"><span className="kibo-reveal-word kibo-serif-italic">your voice.</span></span>
          </h1>

          <p className="kibo-hero-sub kibo-hero-fade">
            Kibo lives quietly in your top bezel. Hold a shortcut to control applications,
            inspect on-screen code or errors, dictate clean thoughts, or run
            background workers without leaving your active window.
          </p>

          <div className="kibo-hero-cta-row kibo-hero-fade" style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '26px 0 42px' }}>
            <a
              href="/download/Kibo-Setup.exe"
              download="Kibo-Setup.exe"
              className="kibo-web-pill-cta"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '12px 26px', fontSize: 14.5 }}
            >
              <WindowsLogoIcon size={15} />
              <span>Download for Windows</span>
            </a>
            <span style={{ fontSize: 13, color: '#68707C', fontWeight: 500 }}>
              Windows 10 / 11 · Free & Local-First
            </span>
          </div>

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
                        {sc.shortcut.join(' + ')}
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
            <span className="kibo-eyebrow">Interaction</span>
            <h2 className="kibo-h2">
              Three shortcuts. <span className="kibo-serif-italic">Zero window switching.</span>
            </h2>
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
                  Control apps with <span className="kibo-serif-italic">your voice</span>
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
                  Inspect your screen with <span className="kibo-serif-italic">your eyes</span>
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
                  Type with <span className="kibo-serif-italic">clean speech</span>
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
            <span className="kibo-eyebrow">Top Bezel Workspace</span>
            <h2 className="kibo-h2">
              Everything you reach for, <span className="kibo-serif-italic">one scroll away.</span>
            </h2>
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

        {/* Section 3: Local-First Setup & Download */}
        <section id="download" className="kibo-section kibo-scroll-section">
          <div className="kibo-section-header">
            <span className="kibo-eyebrow">Download & Setup</span>
            <h2 className="kibo-h2">Runs directly on your machine with your own keys.</h2>
            <p className="kibo-lead">
              Kibo connects straight from your PC to Google Gemini and Tavily using
              your own free API keys, stored locally on your device with no middleman
              servers.
            </p>
          </div>

          <div className="kibo-grid-3">
            <div className="kibo-card">
              <div>
                <h3 style={{ fontSize: 19, fontWeight: 700, margin: '6px 0 10px' }}>
                  Download & Launch
                </h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#5A5E68', margin: '0 0 16px' }}>
                  Run <code style={{ fontFamily: "'JetBrains Mono', monospace", background: '#F1F2EE', padding: '2px 6px', borderRadius: 5 }}>npm run app</code> to start, or build your standalone Windows installer with <code style={{ fontFamily: "'JetBrains Mono', monospace", background: '#F1F2EE', padding: '2px 6px', borderRadius: 5 }}>npm run dist</code>.
                </p>
                <a
                  href="/download/Kibo-Setup.exe"
                  download="Kibo-Setup.exe"
                  className="kibo-web-pill-cta"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, textDecoration: 'none' }}
                >
                  <WindowsLogoIcon size={13} />
                  <span>Download Installer (.exe)</span>
                  <span style={{ opacity: 0.6 }}>↓</span>
                </a>
              </div>
            </div>

            <div className="kibo-card">
              <div>
                <h3 style={{ fontSize: 19, fontWeight: 700, margin: '6px 0 10px' }}>
                  Paste Your Gemini Key
                </h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#5A5E68', margin: 0 }}>
                  Open Settings from the notch or system tray icon and add a free Google AI Studio key for voice, vision, and dictation.
                </p>
              </div>
            </div>

            <div className="kibo-card">
              <div>
                <h3 style={{ fontSize: 19, fontWeight: 700, margin: '6px 0 10px' }}>
                  Ready to Companion
                </h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#5A5E68', margin: 0 }}>
                  Hold <code style={{ fontFamily: "'JetBrains Mono', monospace", background: '#F1F2EE', padding: '2px 6px', borderRadius: 5 }}>Win + Alt</code> to talk, <code style={{ fontFamily: "'JetBrains Mono', monospace", background: '#F1F2EE', padding: '2px 6px', borderRadius: 5 }}>Ctrl + Shift</code> to circle screen regions, or hover the top bezel anytime.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Frequently Asked Questions */}
        <section id="faq" className="kibo-section kibo-scroll-section">
          <div className="kibo-section-header">
            <span className="kibo-eyebrow">Questions & Answers</span>
            <h2 className="kibo-h2">
              Everything you need to know about <span className="kibo-serif-italic">Kibo.</span>
            </h2>
            <p className="kibo-lead">
              Clear answers regarding privacy, gaming performance, hotkey control, and local execution.
            </p>
          </div>

          <div style={{ maxWidth: 840 }}>
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div key={idx} className={`kibo-faq-item ${isOpen ? 'is-open' : ''}`}>
                  <button
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    className="kibo-faq-header"
                  >
                    <span>{faq.q}</span>
                    <span className="kibo-faq-icon">+</span>
                  </button>
                  {isOpen && (
                    <div className="kibo-faq-content">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderTop: '1px solid rgba(18, 19, 22, 0.08)',
          padding: '72px 28px 48px',
          background: 'rgba(255, 255, 255, 0.65)',
        }}
      >
        <div className="kibo-footer-watermark">KIBO</div>

        <div style={{ maxWidth: 1120, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* Prominent CTA Banner */}
          <div className="kibo-footer-cta-card">
            <div>
              <h3 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                Ready to give your desktop a soul?
              </h3>
              <p style={{ fontSize: 14.5, color: '#A1A1AA', margin: 0 }}>
                Download Kibo for Windows 10 & 11. Free, local-first, zero telemetry.
              </p>
            </div>
            <a
              href="/download/Kibo-Setup.exe"
              download="Kibo-Setup.exe"
              className="kibo-web-pill-cta"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 9,
                background: '#FFFFFF',
                color: '#0C0D12',
                padding: '12px 26px',
                fontSize: 14.5,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <WindowsLogoIcon size={14} />
              <span>Download for Windows</span>
            </a>
          </div>

          {/* 4 Clean Columns */}
          <div className="kibo-footer-grid">
            <div>
              <div className="kibo-footer-col-title">Product</div>
              <div className="kibo-footer-list">
                <a href="#how-it-works" onClick={(e) => handleNavClick(e, '#how-it-works')} className="kibo-footer-link">Voice Control</a>
                <a href="#how-it-works" onClick={(e) => handleNavClick(e, '#how-it-works')} className="kibo-footer-link">Screen Vision</a>
                <a href="#how-it-works" onClick={(e) => handleNavClick(e, '#how-it-works')} className="kibo-footer-link">Clean Dictation</a>
                <a href="#workspace" onClick={(e) => handleNavClick(e, '#workspace')} className="kibo-footer-link">Notch Workspace</a>
                <a href="#workspace" onClick={(e) => handleNavClick(e, '#workspace')} className="kibo-footer-link">Autonomous Workers</a>
                <a href="#workspace" onClick={(e) => handleNavClick(e, '#workspace')} className="kibo-footer-link">Dynamic 4K Wallpapers</a>
              </div>
            </div>

            <div>
              <div className="kibo-footer-col-title">Details</div>
              <div className="kibo-footer-list">
                <span className="kibo-footer-link">Windows 11 Ready</span>
                <span className="kibo-footer-link">Win32 Automation</span>
                <span className="kibo-footer-link">Direct Audio Hook</span>
                <span className="kibo-footer-link">Dual-Engine Vision</span>
                <span className="kibo-footer-link">Fast Computer Use</span>
                <span className="kibo-footer-link">Zero Cloud Telemetry</span>
              </div>
            </div>

            <div>
              <div className="kibo-footer-col-title">Architecture</div>
              <div className="kibo-footer-list">
                <span className="kibo-footer-link">Local-First Storage</span>
                <span className="kibo-footer-link">Personal API Keys</span>
                <span className="kibo-footer-link">Hardware Accelerated</span>
                <span className="kibo-footer-link">Figtree Typography</span>
                <span className="kibo-footer-link">Direct OS Synthesizer</span>
                <span className="kibo-footer-link">Adaptive Wallpaper Palette</span>
              </div>
            </div>

            <div>
              <div className="kibo-footer-col-title">Creator</div>
              <div className="kibo-footer-list">
                <span className="kibo-footer-link" style={{ color: '#121316', fontWeight: 600 }}>Crafted with obsession by Raahim Alavi</span>
                <a href="https://github.com/RaahimAlavi/Hitodama" target="_blank" rel="noreferrer" className="kibo-footer-link">GitHub Repository</a>
                <a href="https://github.com/RaahimAlavi/Hitodama/releases" target="_blank" rel="noreferrer" className="kibo-footer-link">Release Notes</a>
                <a href="https://github.com/RaahimAlavi/Hitodama/issues" target="_blank" rel="noreferrer" className="kibo-footer-link">Report a Bug</a>
                <a href="https://github.com/RaahimAlavi/Hitodama/discussions" target="_blank" rel="noreferrer" className="kibo-footer-link">Request a Feature</a>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div
            style={{
              marginTop: 64,
              paddingTop: 28,
              borderTop: '1px solid rgba(18, 19, 22, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
              fontSize: 13,
              color: '#68707C',
            }}
          >
            <div>
              © 2026 Kibo by <strong style={{ color: '#121316', fontWeight: 700 }}>Raahim Alavi</strong>. All rights reserved.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <span>Built for Windows 10 & 11</span>
              <button
                onClick={handleScrollToTop}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#121316',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: 0,
                  fontFamily: 'inherit',
                }}
                title="Scroll to top"
              >
                Back to top ↑
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
