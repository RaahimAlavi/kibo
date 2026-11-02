// src/App.tsx
import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import Lenis from 'lenis';
import { KiboApp } from './desktop/KiboApp';
import { SoulCanvas } from './components/SoulCanvas';
import { SOUL_SKINS } from './lib/soulMath';
import { WebHeader, WindowsLogoIcon } from './components/WebHeader';
import { WebFooter } from './components/WebFooter';
import { BuyPage } from './pages/BuyPage';
import { CustomerAccessPage } from './pages/CustomerAccessPage';
import { RequirementsPage } from './pages/RequirementsPage';
import { LicenseTermsPage } from './pages/LicenseTermsPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { RefundPolicyPage } from './pages/RefundPolicyPage';
import { ContactGrievancesPage } from './pages/ContactGrievancesPage';
import { DownloadSuccessPage } from './pages/DownloadSuccessPage';

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
    name: 'Chat',
    summary: 'Full conversation history, live captions, persistent personal memory, and instant voice or typed commands directly inside the top notch.',
    previewTitle: 'Voice & Chat History',
    previewMeta: 'Gemini Live · Persistent Memory · Captions',
  },
  {
    name: 'Agents',
    summary: 'Parallel background workers that clone web layouts, inspect CSS tokens, connect to Chrome & Notion, and execute tasks with zero interruption.',
    previewTitle: 'Autonomous Workers',
    previewMeta: 'Running in background · Zero interruption',
  },
  {
    name: 'Convert',
    summary: 'Drag any file into the closed notch or ask Kibo by voice to convert between PDF, Word (.docx), Markdown, CSV, JSON, HTML, and images while keeping your original file untouched.',
    previewTitle: 'Universal File Converter',
    previewMeta: 'PDF to Word · Voice Filename Match · Original Safe',
  },
  {
    name: 'Focus',
    summary: 'Pomodoro countdown timer, precision lap stopwatch, and interactive Focus Sticky Notes that tilt on hover and zoom open with a crisp paper sound. Click the compact notch to pause or resume, and watch Kibo dance when your session finishes.',
    previewTitle: 'Focus Timer, Stopwatch & Sticky Notes',
    previewMeta: 'Interactive Sticky Notes · Live Notch Readout · Kibo Dance',
  },
  {
    name: 'Skills',
    summary: 'Import or author modular SKILL.md instruction packs and connect Chrome, Gmail, GitHub, Notion, Figma, VS Code, Linear, and Meta Ads.',
    previewTitle: 'Modular SKILL.md & App Bridges',
    previewMeta: 'Import SKILL.md · Chrome Extension · Brand Integrations',
  },
  {
    name: 'Media',
    summary: 'Full-notch album artwork color glass, real-time Windows SMTC playback controls, and a smooth inline volume slider for Spotify, YouTube, and system audio.',
    previewTitle: 'Adaptive Media Player',
    previewMeta: 'Spotify · YouTube · Album Glass Gradient',
  },
];

const FAQS = [
  {
    q: 'Does Kibo record my screen or send telemetry to third parties?',
    a: 'No. Kibo is strictly local first. Screen vision and voice queries only process in direct response to your held shortcuts (Win + Alt, Ctrl + Shift, Ctrl + Win) and communicate directly with Google Gemini using your personal API key stored in your local Windows userData. Zero telemetry, zero cloud logging, and zero middleman servers.',
  },
  {
    q: 'Does Kibo remember my name, files, and preferences across restarts?',
    a: 'Yes. When you tell Kibo your name or preferences, Kibo saves them locally to your persistent profile so it greets you by name and remembers your context every time you launch your PC.',
  },
  {
    q: 'Does Kibo interrupt games or fullscreen videos?',
    a: 'Never. When you launch a fullscreen game or media session, Kibo automatically tucks up into an 18px top bezel sliver or hides completely, forwarding 100% of mouse and keyboard inputs to your application.',
  },
  {
    q: 'Can Kibo convert files or connect to Google Chrome and workspace apps?',
    a: 'Yes. Drag any file toward the top notch, even when closed, to open the Kibo Storage drop box and convert between PDF, Word (.docx), CSV, JSON, Markdown, and images without deleting your original file. You can also install the Kibo Chrome Extension and connect your cloud apps (Notion, GitHub, VS Code, Figma, Gmail, Slack, Discord, Jira, Spotify, etc.) via Composio in Preferences under Integrations.',
  },
  {
    q: 'Can I customize the hotkeys, voices, and companion skin?',
    a: 'Yes. In Preferences, you can remap your activation hotkeys, configure audio input and output devices and live captions, switch between 4 Google Gemini neural voices (Charon, Aoede, Fenrir, Puck), and choose from 6 vibrant companion skins including MK I Cobalt, Sakura Mochi, Matcha Mint, Crimson Nova, Mango Sunburst, and Cyber Grape.',
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
      navigator.userAgent.toLowerCase().includes('electron')
    );
  })();

  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    if (typeof window === 'undefined') return 'home';
    const p = window.location.pathname.toLowerCase();
    const h = window.location.hash.toLowerCase();
    if (p === '/buy' || p === '/buy/' || h === '#buy' || h === '#/buy') return 'buy';
    if (p === '/access' || p === '/portal' || h === '#access' || h === '#portal') return 'access';
    if (p === '/download' || p === '/thank-you' || h === '#download') return 'download';
    if (p === '/requirements' || h === '#requirements') return 'requirements';
    if (p === '/terms' || p === '/license' || h === '#terms') return 'terms';
    if (p === '/privacy' || h === '#privacy') return 'privacy';
    if (p === '/refunds' || p === '/refund' || h === '#refunds') return 'refunds';
    if (p === '/contact' || p === '/grievances' || h === '#contact') return 'contact';
    return 'home';
  });

  const [sceneIdx, setSceneIdx] = useState(0);
  const [featureIdx, setFeatureIdx] = useState(0);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const sceneCardRef = useRef<HTMLDivElement>(null);
  const featureBodyRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  const handleNavigate = (route: string, anchor?: string) => {
    let newUrl = '/';
    if (route !== 'home') {
      newUrl = `/${route}`;
    } else if (anchor) {
      newUrl = `/#${anchor}`;
    }

    if (window.location.pathname + window.location.hash !== newUrl) {
      window.history.pushState({}, '', newUrl);
    }

    setCurrentRoute(route);

    if (route === 'home' && anchor) {
      setTimeout(() => {
        const targetEl = document.getElementById(anchor);
        if (targetEl) {
          if (lenisRef.current) {
            lenisRef.current.scrollTo(targetEl, { offset: -64, duration: 1.25 });
          } else {
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }, 60);
    } else {
      if (lenisRef.current) {
        lenisRef.current.scrollTo(0, { duration: 0.8 });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

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
    if (isDesktopRuntime) return;

    const handlePopState = () => {
      const p = window.location.pathname.toLowerCase();
      const h = window.location.hash.toLowerCase();
      if (p === '/buy' || p === '/buy/' || h === '#buy' || h === '#/buy') {
        setCurrentRoute('buy');
      } else if (p === '/access' || p === '/portal' || h === '#access' || h === '#portal') {
        setCurrentRoute('access');
      } else if (p === '/download' || p === '/thank-you' || h === '#download') {
        setCurrentRoute('download');
      } else if (p === '/requirements' || h === '#requirements') {
        setCurrentRoute('requirements');
      } else if (p === '/terms' || p === '/license' || h === '#terms') {
        setCurrentRoute('terms');
      } else if (p === '/privacy' || h === '#privacy') {
        setCurrentRoute('privacy');
      } else if (p === '/refunds' || p === '/refund' || h === '#refunds') {
        setCurrentRoute('refunds');
      } else if (p === '/contact' || p === '/grievances' || h === '#contact') {
        setCurrentRoute('contact');
      } else {
        setCurrentRoute('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isDesktopRuntime]);

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
        { yPercent: 105, opacity: 0 },
        {
          yPercent: 0,
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

    // Scroll-triggered section & child card reveals for smooth staggered fade-ins
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            gsap.to(target, {
              y: 0,
              opacity: 1,
              duration: 0.9,
              ease: 'power3.out',
            });
            const childItems = target.querySelectorAll('.kibo-card, .kibo-feature-btn, .kibo-faq-item, .kibo-notch-showcase > div');
            if (childItems.length > 0) {
              gsap.fromTo(
                childItems,
                { y: 24, opacity: 0 },
                {
                  y: 0,
                  opacity: 1,
                  duration: 0.72,
                  stagger: 0.08,
                  ease: 'power3.out',
                  delay: 0.08,
                }
              );
            }
            observer.unobserve(target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    const sections = document.querySelectorAll('.kibo-scroll-section');
    sections.forEach((sec) => {
      gsap.set(sec, { y: 36, opacity: 0 });
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
  const headlineWords = 'Control your PC with your voice.'.split(' ');

  return (
    <div ref={pageRef} className="kibo-web-root">
      <style>{`
        :root {
          --kibo-web-font-primary: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          --kibo-web-font-secondary: 'Figtree', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .kibo-web-root {
          min-height: 100vh;
          background: #F7F7F4;
          color: #121316;
          font-family: var(--kibo-web-font-primary);
          -webkit-font-smoothing: antialiased;
        }
        .kibo-hero-sub,
        .kibo-lead,
        .kibo-card p,
        .kibo-feature-btn p,
        .kibo-faq-content {
          font-family: var(--kibo-web-font-secondary);
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
          line-height: 1.16;
          letter-spacing: -0.035em;
          max-width: 780px;
          margin: 0 0 20px;
          color: #121316;
        }
        .kibo-word-mask {
          display: inline-block;
          overflow: hidden;
          vertical-align: top;
          padding-top: 0.04em;
          margin-top: -0.04em;
          padding-bottom: 0.24em;
          margin-bottom: -0.24em;
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
          margin-bottom: 48px;
          box-shadow: 0 24px 60px rgba(18, 19, 22, 0.12);
        }
        .kibo-footer-nav-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 20px;
          position: relative;
          z-index: 1;
          padding-bottom: 24px;
        }
        .kibo-footer-link {
          font-size: 14px;
          font-weight: 500;
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
        .kibo-footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 36px;
          position: relative;
          z-index: 1;
        }
        .kibo-footer-top-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          color: #121316;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 0;
          font-family: inherit;
        }
        .kibo-footer-top-btn:hover {
          text-decoration: underline;
        }
        .kibo-cta-mobile {
          display: none;
        }

        /* 1024px and below (Laptops & Small Desktops) */
        @media (max-width: 1024px) {
          .kibo-web-container {
            padding: 0 24px;
          }
          .kibo-grid-3 {
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }
          .kibo-notch-showcase {
            gap: 24px;
          }
        }

        /* 860px and below (Tablets & Landscape Viewports) */
        @media (max-width: 860px) {
          .kibo-web-links {
            gap: 18px;
          }
          .kibo-grid-3 {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          .kibo-notch-showcase {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .kibo-stage-tabs {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
          .kibo-footer-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 28px;
          }
          .kibo-stage-viewport {
            padding: 24px 28px 32px;
          }
        }

        /* 640px and below (Phones & Phablets) */
        @media (max-width: 640px) {
          main.kibo-web-container {
            padding: 36px 16px 64px !important;
          }
          .kibo-web-links {
            display: none !important;
          }
          .kibo-web-nav-inner {
            padding: 12px 16px;
          }
          .kibo-cta-desktop {
            display: none;
          }
          .kibo-cta-mobile {
            display: inline;
          }
          .kibo-web-pill-cta {
            padding: 8px 14px;
            font-size: 12.5px;
          }
          .kibo-web-container {
            padding: 0 16px;
          }
          .kibo-hero {
            padding: 42px 0 36px;
          }
          .kibo-hero-h1 {
            font-size: clamp(1.95rem, 7.5vw, 2.75rem);
            line-height: 1.18;
            letter-spacing: -0.025em;
            margin-bottom: 14px;
          }
          .kibo-hero-sub {
            font-size: 15px;
            line-height: 1.55;
            margin-bottom: 24px;
          }
          .kibo-hero-tag {
            font-size: 11.5px;
            padding: 5px 12px;
            margin-bottom: 18px;
          }
          .kibo-hero-cta-row {
            margin: 18px 0 32px !important;
            gap: 10px !important;
            justify-content: center;
          }
          .kibo-stage-frame {
            border-radius: 18px;
          }
          .kibo-stage-bezel {
            height: 52px;
          }
          .kibo-stage-notch {
            width: 160px;
            height: 48px;
            border-bottom-left-radius: 14px;
            border-bottom-right-radius: 14px;
          }
          .kibo-stage-viewport {
            padding: 16px 14px 20px;
            min-height: auto;
          }
          .kibo-prompt-bubble,
          .kibo-reply-bubble {
            padding: 12px 14px;
            border-radius: 14px;
          }
          .kibo-prompt-bubble div,
          .kibo-reply-bubble div {
            font-size: 13.5px !important;
          }
          .kibo-stage-tabs {
            grid-template-columns: repeat(2, 1fr);
            gap: 6px;
            margin-top: 20px;
            padding-top: 14px;
          }
          .kibo-stage-tab {
            padding: 8px 10px;
            font-size: 12px;
          }
          .kibo-section {
            padding: 60px 0;
          }
          .kibo-section-header {
            margin-bottom: 32px;
          }
          .kibo-h2 {
            font-size: clamp(1.6rem, 5.5vw, 2.1rem);
            line-height: 1.18;
          }
          .kibo-lead {
            font-size: 15px;
          }
          .kibo-grid-3 {
            grid-template-columns: 1fr;
            gap: 14px;
          }
          .kibo-card {
            padding: 20px 16px !important;
            border-radius: 16px;
          }
          .kibo-card h3 {
            font-size: 17px !important;
          }
          .kibo-card p {
            font-size: 13.5px !important;
          }
          .kibo-faq-header {
            padding: 16px 18px;
            font-size: 15px;
          }
          .kibo-faq-content {
            padding: 0 18px 18px;
            font-size: 13.5px;
          }
          .kibo-footer-cta-card {
            padding: 28px 20px;
            border-radius: 18px;
            gap: 18px;
            margin-bottom: 36px;
          }
          .kibo-footer-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .kibo-footer-watermark {
            font-size: clamp(48px, 16vw, 120px);
          }
          .kibo-footer-nav-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 14px;
          }
          table {
            display: block;
            width: 100%;
            overflow-x: auto;
          }
          .kibo-specs-table tr {
            display: flex;
            flex-direction: column;
            padding: 8px 0;
            border-bottom: 1px solid rgba(18, 19, 22, 0.08);
          }
          .kibo-specs-table td {
            width: 100% !important;
            padding: 3px 0 !important;
          }
        }

        /* 380px and below (Compact Phones) */
        @media (max-width: 380px) {
          .kibo-web-brand span {
            font-size: 15px;
          }
          .kibo-hero-h1 {
            font-size: 1.8rem;
            line-height: 1.2;
          }
          .kibo-stage-tabs {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {currentRoute === 'buy' && <BuyPage onNavigate={handleNavigate} />}
      {currentRoute === 'access' && <CustomerAccessPage onNavigate={handleNavigate} />}
      {currentRoute === 'download' && <DownloadSuccessPage onNavigate={handleNavigate} />}
      {currentRoute === 'requirements' && <RequirementsPage onNavigate={handleNavigate} />}
      {currentRoute === 'terms' && <LicenseTermsPage onNavigate={handleNavigate} />}
      {currentRoute === 'privacy' && <PrivacyPolicyPage onNavigate={handleNavigate} />}
      {currentRoute === 'refunds' && <RefundPolicyPage onNavigate={handleNavigate} />}
      {currentRoute === 'contact' && <ContactGrievancesPage onNavigate={handleNavigate} />}

      {currentRoute === 'home' && (
        <div ref={pageRef}>
          {/* Top Navigation */}
          <WebHeader currentRoute="home" onNavigate={handleNavigate} />

          <main id="top" className="kibo-web-container">
            {/* Hero Section */}
            <section className="kibo-hero">
              <div className="kibo-hero-tag kibo-hero-fade">
                <span className="kibo-hero-tag-dot" />
                <span>The voice assistant that actually does things for you</span>
              </div>

              <h1 className="kibo-hero-h1">
                {headlineWords.map((word, idx) => (
                  <span key={idx} className="kibo-word-mask">
                    <span className="kibo-reveal-word">{word}</span>
                  </span>
                ))}
              </h1>

              <p className="kibo-hero-sub kibo-hero-fade">
                Kibo lives quietly in your top bezel. Hold a shortcut to control applications,
                inspect on-screen code or errors, dictate clean thoughts, or run
                background workers without leaving your active window.
              </p>

              <div className="kibo-hero-cta-row kibo-hero-fade" style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '26px 0 42px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleNavigate('buy')}
                  className="kibo-web-pill-cta"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '13px 28px', fontSize: 14.5, border: 'none', cursor: 'pointer' }}
                >
                  <span>Get Founders Edition · $8</span>
                </button>
                <span style={{ fontSize: 13, color: '#68707C', fontWeight: 500 }}>
                  Windows 10 & 11 · One-Time Payment
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
                  Control apps with your voice
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
                  Inspect your screen with your eyes
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
                  Type with clean speech
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
        <section id="setup" className="kibo-section kibo-scroll-section">
          <div className="kibo-section-header">
            <span className="kibo-eyebrow">Local-First Setup</span>
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
                  Reserve Founders Access
                </h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#5A5E68', margin: '0 0 16px' }}>
                  Secure your $8 perpetual license to receive immediate digital delivery and permanent access to all Founders updates.
                </p>
                <button
                  onClick={() => handleNavigate('buy')}
                  className="kibo-web-pill-cta"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, border: 'none', cursor: 'pointer' }}
                >
                  <span>Get Founders Edition · $8</span>
                </button>
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
              Everything you need to know about Kibo.
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

        {/* Founders Edition Highlight Section */}
        <section id="founders" style={{ margin: '80px 0 32px' }}>
          <div
            className="kibo-card"
            style={{
              padding: '44px 40px',
              background: '#FFFFFF',
              border: '1px solid rgba(18, 19, 22, 0.12)',
              borderRadius: 24,
              boxShadow: '0 16px 40px rgba(18, 19, 22, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
              <div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    borderRadius: 999,
                    background: 'rgba(18, 19, 22, 0.05)',
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#121316',
                    marginBottom: 10,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
                  Limited Founders Enrollment
                </span>
                <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 36px)', fontWeight: 800, color: '#121316', letterSpacing: '-0.02em', margin: 0 }}>
                  Get Kibo Founders Edition
                </h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: '#121316', letterSpacing: '-0.03em' }}>$8</span>
                <span style={{ display: 'block', fontSize: 13, color: '#68707C' }}>One-time payment</span>
              </div>
            </div>

            <p style={{ fontSize: 15, lineHeight: 1.6, color: '#4B5563', maxWidth: 680, margin: '0 0 28px' }}>
              Equip your Windows workspace with the ambient cyber companion. Single investment, perpetual license, and zero recurring fees.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16,
                marginBottom: 32,
              }}
            >
              <div style={{ padding: '16px 18px', borderRadius: 12, background: '#F9FAFB', border: '1px solid rgba(18, 19, 22, 0.06)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#121316', marginBottom: 4 }}>Pay Once, No Subscription</div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: '#68707C' }}>Single upfront payment. No recurring monthly or annual membership dues.</div>
              </div>
              <div style={{ padding: '16px 18px', borderRadius: 12, background: '#F9FAFB', border: '1px solid rgba(18, 19, 22, 0.06)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#121316', marginBottom: 4 }}>Free Future Updates</div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: '#68707C' }}>Receive all subsequent updates and feature improvements in the Founders series at no charge.</div>
              </div>
              <div style={{ padding: '16px 18px', borderRadius: 12, background: '#F9FAFB', border: '1px solid rgba(18, 19, 22, 0.06)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#121316', marginBottom: 4 }}>Personal Gemini Key</div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: '#68707C' }}>Connect your free Google AI Studio key with generous rate limits and zero markup.</div>
              </div>
              <div style={{ padding: '16px 18px', borderRadius: 12, background: '#F9FAFB', border: '1px solid rgba(18, 19, 22, 0.06)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#121316', marginBottom: 4 }}>Keep It Forever</div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: '#68707C' }}>Your perpetual license remains valid even after public enrollment concludes.</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <button
                onClick={() => handleNavigate('buy')}
                style={{
                  padding: '13px 26px',
                  borderRadius: 12,
                  background: '#121316',
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  letterSpacing: '-0.01em',
                }}
              >
                Claim Founders Access · $8
              </button>
              <button
                onClick={() => handleNavigate('access')}
                style={{
                  padding: '13px 22px',
                  borderRadius: 12,
                  background: 'transparent',
                  color: '#121316',
                  fontSize: 13,
                  fontWeight: 600,
                  border: '1px solid rgba(18, 19, 22, 0.16)',
                  cursor: 'pointer',
                }}
              >
                Already have a license? Sign In
              </button>
            </div>
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
                Secure Founders Edition for $8
              </h3>
              <p style={{ fontSize: 14.5, color: '#A1A1AA', margin: 0 }}>
                Single upfront payment. Lifetime license. Zero subscription fees.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => handleNavigate('buy')}
                className="kibo-web-pill-cta"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 9,
                  background: '#FFFFFF',
                  color: '#0C0D12',
                  padding: '13px 26px',
                  fontSize: 14,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <span>Get Founders Edition · $8</span>
              </button>
            </div>
          </div>

          <WebFooter onNavigate={handleNavigate} onScrollToTop={handleScrollToTop} />
        </div>
      </footer>
        </div>
      )}
    </div>
  );
}

export default App;
