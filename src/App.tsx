// src/App.tsx
import React, { useState, useEffect } from 'react';
import { KiboApp } from './desktop/KiboApp';
import { SoulCanvas } from './components/SoulCanvas';
import { SOUL_SKINS } from './lib/soulMath';

export function App() {
  const [viewMode, setViewMode] = useState<'desktop' | 'web'>(() => {
    if (typeof window === 'undefined') return 'web';
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'web') return 'web';
    if (params.get('view') === 'desktop' || window.location.hash === '#desktop') return 'desktop';
    const isElectron =
      Boolean((window as any).hitodamaAPI) ||
      Boolean((window as any).kiboAPI) ||
      navigator.userAgent.toLowerCase().includes('electron');
    return isElectron ? 'desktop' : 'web';
  });

  const [selectedSkinIdx, setSelectedSkinIdx] = useState(0);
  const [demoMode, setDemoMode] = useState<'LISTENING' | 'TALKING' | 'THINKING' | 'YAWNING'>('LISTENING');
  const [demoExpression, setDemoExpression] = useState<'NORMAL' | 'HAPPY' | 'EXCITED'>('NORMAL');

  useEffect(() => {
    if (viewMode === 'desktop') {
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
    } else {
      document.documentElement.style.background = '#090B10';
      document.body.style.background = '#090B10';
    }
  }, [viewMode]);

  // 1. Inside Electron (or when toggled to Desktop Mode), render the Top Notch Overlay!
  if (viewMode === 'desktop') {
    return <KiboApp />;
  }

  const activeSkin = SOUL_SKINS[selectedSkinIdx] || SOUL_SKINS[0];

  // 2. In a standard Web Browser, render the 100% Original KIBO Industrial Landing Page
  return (
    <div style={styles.page}>
      {/* Subtle Technical Dot-Matrix Grid Background */}
      <div style={styles.gridBackdrop} />

      {/* Top Industrial Telemetry Bar */}
      <header style={styles.navbar}>
        <div style={styles.navInner}>
          <div style={styles.brandGroup}>
            <div style={styles.brandDot} />
            <span style={styles.brandName}>KIBO // OS-01</span>
            <span style={styles.brandTag}>TACTILE DESKTOP CYBER-DROID</span>
          </div>

          <nav style={styles.navLinks}>
            <a href="#modules" style={styles.navLink}>MODULES</a>
            <a href="#chassis" style={styles.navLink}>CHASSIS BAY</a>
            <a href="#architecture" style={styles.navLink}>TELEMETRY</a>
            <button
              onClick={() => setViewMode('desktop')}
              style={styles.launchOverlayBtn}
            >
              LAUNCH NOTCH OVERLAY →
            </button>
          </nav>
        </div>
      </header>

      {/* Hero Section with Live Interactive 3D Kibo Droid */}
      <main style={styles.main}>
        <section style={styles.heroSection}>
          <div style={styles.heroLeft}>
            <div style={styles.statusPill}>
              <span style={styles.statusPulse} />
              <span>SYS.VER 2.4 · NATIVE WIN32 UI-AUTOMATION + GEMINI MULTIMODAL</span>
            </div>

            <h1 style={styles.heroTitle}>
              Precision hardware intelligence inside your top bezel.
            </h1>

            <p style={styles.heroSubtitle}>
              Kibo is an anti-gravity cyber-droid engineered for Windows power users.
              Execute native UI clicks, lock onto screen regions with optical radar,
              dictate clean code or prose, and dispatch autonomous web-engineering
              agents without leaving your active window.
            </p>

            <div style={styles.heroActions}>
              <button
                onClick={() => setViewMode('desktop')}
                style={styles.primaryCta}
              >
                INITIALIZE KIBO OVERLAY
              </button>
              <a href="#chassis" style={styles.secondaryCta}>
                TEST DROID OPTICS
              </a>
            </div>

            <div style={styles.hotkeyStrip}>
              <div style={styles.hotkeyItem}>
                <kbd style={styles.kbd}>WIN + ALT</kbd>
                <span>VOICE COMMAND</span>
              </div>
              <div style={styles.hotkeyItem}>
                <kbd style={styles.kbd}>CTRL + SHIFT</kbd>
                <span>LASER SCAN</span>
              </div>
              <div style={styles.hotkeyItem}>
                <kbd style={styles.kbd}>CTRL + WIN</kbd>
                <span>GHOSTTYPE</span>
              </div>
            </div>
          </div>

          {/* Interactive Kibo Hardware Test Pod */}
          <div id="chassis" style={styles.heroRight}>
            <div style={styles.droidPod}>
              <div style={styles.podHeader}>
                <span style={styles.podLabel}>OPTICAL GIMBAL TEST BAY</span>
                <span style={{ ...styles.podBadge, color: activeSkin.primaryColor }}>
                  {activeSkin.name}
                </span>
              </div>

              <div style={styles.droidStage}>
                <div
                  style={{
                    ...styles.droidGlow,
                    background: `radial-gradient(circle, ${activeSkin.primaryColor}33 0%, transparent 70%)`,
                  }}
                />
                <SoulCanvas
                  soul={activeSkin}
                  width={220}
                  height={190}
                  scale={1.85}
                  mode={demoMode}
                  expression={demoExpression}
                  interactive={true}
                />
              </div>

              {/* State Switcher */}
              <div style={styles.podControlsLabel}>SIMULATE TELEMETRY STATE</div>
              <div style={styles.stateBtnRow}>
                {(
                  [
                    { label: 'IDLE', mode: 'LISTENING', expr: 'NORMAL' },
                    { label: 'SPEAKING', mode: 'TALKING', expr: 'NORMAL' },
                    { label: 'RADAR SCAN', mode: 'THINKING', expr: 'NORMAL' },
                    { label: 'BOOT STRETCH', mode: 'YAWNING', expr: 'HAPPY' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.label}
                    onClick={() => {
                      setDemoMode(st.mode);
                      setDemoExpression(st.expr as any);
                    }}
                    style={{
                      ...styles.stateBtn,
                      borderColor:
                        demoMode === st.mode
                          ? activeSkin.primaryColor
                          : 'rgba(255,255,255,0.1)',
                      color: demoMode === st.mode ? '#FFFFFF' : '#94A3B8',
                      background:
                        demoMode === st.mode
                          ? 'rgba(56, 189, 248, 0.14)'
                          : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Chassis Selector */}
              <div style={styles.podControlsLabel}>SELECT DROID CHASSIS</div>
              <div style={styles.skinGrid}>
                {SOUL_SKINS.map((skin, idx) => (
                  <button
                    key={skin.key}
                    onClick={() => setSelectedSkinIdx(idx)}
                    style={{
                      ...styles.skinPill,
                      borderColor:
                        selectedSkinIdx === idx
                          ? skin.primaryColor
                          : 'rgba(255,255,255,0.08)',
                      background:
                        selectedSkinIdx === idx
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: skin.primaryColor,
                        boxShadow: `0 0 8px ${skin.primaryColor}`,
                      }}
                    />
                    <span>{skin.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 4 Core Hardware Modules Bento Grid */}
        <section id="modules" style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.monoOverline}>01 // CORE ARCHITECTURE</span>
            <h2 style={styles.sectionTitle}>Four Tactile Subsystems. Zero Bloat.</h2>
          </div>

          <div style={styles.bentoGrid}>
            <div style={styles.bentoCard}>
              <div style={styles.cardIndex}>SUBSYSTEM 01</div>
              <h3 style={styles.cardTitle}>Target Lock & Native OS Control</h3>
              <p style={styles.cardDesc}>
                Powered by a persistent C# Win32 UIAutomation worker and GSMTC media
                transport bridge. Ask Kibo to click buttons, launch any installed
                desktop software, or sync live playback timelines across Netflix,
                Spotify, and browsers.
              </p>
            </div>

            <div style={styles.bentoCard}>
              <div style={styles.cardIndex}>SUBSYSTEM 02</div>
              <h3 style={styles.cardTitle}>Optical Laser Scan</h3>
              <p style={styles.cardDesc}>
                Hold <code style={styles.inlineCode}>Ctrl + Shift</code> and draw around
                any UI component, chart, or error log on your monitor. Kibo crops the
                high-DPI frame buffer and pipes it directly to Gemini Vision for
                immediate technical answers.
              </p>
            </div>

            <div style={styles.bentoCard}>
              <div style={styles.cardIndex}>SUBSYSTEM 03</div>
              <h3 style={styles.cardTitle}>GhostType Neural Dictation</h3>
              <p style={styles.cardDesc}>
                Hold <code style={styles.inlineCode}>Ctrl + Win</code> inside VS Code,
                Notion, or Discord. Speak with mid-sentence corrections or rough notes—Kibo
                strips filler words and injects formatted text directly into your cursor.
              </p>
            </div>

            <div style={styles.bentoCard}>
              <div style={styles.cardIndex}>SUBSYSTEM 04</div>
              <h3 style={styles.cardTitle}>Autonomous Forge & Design MCP</h3>
              <p style={styles.cardDesc}>
                Point Kibo at any live website to extract its <code style={styles.inlineCode}>:root</code> CSS
                variables, font stacks, hex tokens, and DOM hierarchy. Generate full
                Tailwind replicas, iterate on local HTML files in place, or curate
                Notion databases via Tavily search.
              </p>
            </div>
          </div>
        </section>

        {/* Technical Specification Table */}
        <section id="architecture" style={styles.section}>
          <div style={styles.specBox}>
            <div style={styles.specRow}>
              <span style={styles.specKey}>RUNTIME ARCHITECTURE</span>
              <span style={styles.specVal}>Electron + Persistent PowerShell / Win32 UIA Worker</span>
            </div>
            <div style={styles.specRow}>
              <span style={styles.specKey}>VISION & SYNTHESIS</span>
              <span style={styles.specVal}>Gemini 2.5 / 3 Flash Multimodal + Design MCP DOM Scraper</span>
            </div>
            <div style={styles.specRow}>
              <span style={styles.specKey}>LIVE WEB ENGINE</span>
              <span style={styles.specVal}>Tavily Deep Search & URL Content Extractor</span>
            </div>
            <div style={styles.specRow}>
              <span style={styles.specKey}>PROGRESSION CURRENCY</span>
              <span style={styles.specVal}>Passive Watts (W) Earned via Tasks, Focus & Commands</span>
            </div>
          </div>
        </section>
      </main>

      <footer style={styles.footer}>
        <span>KIBO // DESKTOP CYBER-DROID SYSTEM</span>
        <span>BUILT FOR WINDOWS 11 · ORIGINAL ARCHITECTURE</span>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#090B10',
    color: '#F8FAFC',
    position: 'relative',
    overflowX: 'hidden',
  },
  gridBackdrop: {
    position: 'fixed',
    inset: 0,
    backgroundImage:
      'radial-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px)',
    backgroundSize: '28px 28px',
    pointerEvents: 'none',
    zIndex: 0,
  },
  navbar: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(9, 11, 16, 0.85)',
    backdropFilter: 'blur(14px)',
  },
  navInner: {
    maxWidth: 1180,
    margin: '0 auto',
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: '#38BDF8',
    boxShadow: '0 0 12px #38BDF8',
  },
  brandName: {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: '0.06em',
  },
  brandTag: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: '#64748B',
    paddingLeft: 10,
    borderLeft: '1px solid rgba(255,255,255,0.12)',
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
  },
  navLink: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    color: '#94A3B8',
    textDecoration: 'none',
    letterSpacing: '0.05em',
  },
  launchOverlayBtn: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11.5,
    fontWeight: 700,
    color: '#090B10',
    backgroundColor: '#38BDF8',
    border: 'none',
    borderRadius: 999,
    padding: '8px 16px',
    cursor: 'pointer',
  },
  main: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 1180,
    margin: '0 auto',
    padding: '64px 24px 96px',
  },
  heroSection: {
    display: 'grid',
    gridTemplateColumns: '1.15fr 0.85fr',
    gap: 48,
    alignItems: 'center',
  },
  heroLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    padding: '6px 12px',
    borderRadius: 999,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    border: '1px solid rgba(56, 189, 248, 0.25)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: '#BAE6FD',
  },
  statusPulse: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: '#38BDF8',
  },
  heroTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 52,
    lineHeight: 1.08,
    fontWeight: 700,
    letterSpacing: '-0.03em',
    margin: 0,
  },
  heroSubtitle: {
    fontSize: 16.5,
    lineHeight: 1.65,
    color: '#94A3B8',
    margin: 0,
    maxWidth: 580,
  },
  heroActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginTop: 6,
  },
  primaryCta: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    fontWeight: 700,
    color: '#090B10',
    background: 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)',
    border: 'none',
    borderRadius: 12,
    padding: '14px 24px',
    cursor: 'pointer',
    boxShadow: '0 10px 30px rgba(56, 189, 248, 0.3)',
  },
  secondaryCta: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    fontWeight: 600,
    color: '#E2E8F0',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: 12,
    padding: '14px 22px',
    textDecoration: 'none',
  },
  hotkeyStrip: {
    display: 'flex',
    gap: 20,
    marginTop: 14,
    paddingTop: 20,
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  hotkeyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: '#94A3B8',
  },
  kbd: {
    padding: '4px 8px',
    borderRadius: 6,
    backgroundColor: '#141821',
    border: '1px solid rgba(255,255,255,0.16)',
    color: '#F8FAFC',
    fontWeight: 700,
  },
  heroRight: {
    display: 'flex',
    justifyContent: 'center',
  },
  droidPod: {
    width: '100%',
    backgroundColor: 'rgba(17, 20, 28, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    padding: 24,
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
  },
  podHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  podLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: '#64748B',
    letterSpacing: '0.08em',
  },
  podBadge: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    fontWeight: 700,
  },
  droidStage: {
    position: 'relative',
    height: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#07090E',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.06)',
    marginBottom: 18,
    overflow: 'hidden',
  },
  droidGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: '50%',
    pointerEvents: 'none',
  },
  podControlsLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10.5,
    color: '#64748B',
    letterSpacing: '0.08em',
    marginBottom: 8,
  },
  stateBtnRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 6,
    marginBottom: 16,
  },
  stateBtn: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10.5,
    fontWeight: 600,
    padding: '7px 6px',
    borderRadius: 8,
    border: '1px solid',
    cursor: 'pointer',
  },
  skinGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  skinPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid',
    color: '#E2E8F0',
    fontSize: 11.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
  section: {
    marginTop: 96,
  },
  sectionHeader: {
    marginBottom: 32,
  },
  monoOverline: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    color: '#38BDF8',
    letterSpacing: '0.08em',
  },
  sectionTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 34,
    margin: '8px 0 0',
  },
  bentoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 20,
  },
  bentoCard: {
    backgroundColor: 'rgba(17, 20, 28, 0.78)',
    border: '1px solid rgba(255, 255, 255, 0.09)',
    borderRadius: 20,
    padding: 28,
  },
  cardIndex: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: '#F59E0B',
    marginBottom: 10,
  },
  cardTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 22,
    margin: '0 0 10px',
  },
  cardDesc: {
    fontSize: 14.5,
    lineHeight: 1.6,
    color: '#94A3B8',
    margin: 0,
  },
  inlineCode: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12.5,
    padding: '2px 6px',
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#BAE6FD',
  },
  specBox: {
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  specRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(15, 18, 25, 0.7)',
  },
  specKey: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    color: '#64748B',
  },
  specVal: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12.5,
    color: '#E2E8F0',
  },
  footer: {
    maxWidth: 1180,
    margin: '0 auto',
    padding: '32px 24px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11.5,
    color: '#64748B',
  },
};

export default App;
