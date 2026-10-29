import React, { useEffect } from 'react';
import { KiboApp } from './desktop/KiboApp';
import { SoulCanvas } from './components/SoulCanvas';
import { SOUL_SKINS } from './lib/soulMath';

export function App() {
  const isDesktopRuntime = (() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'desktop' || params.get('view') === 'desktop' || window.location.hash === '#desktop' || window.location.protocol === 'file:') {
      return true;
    }
    return (
      Boolean((window as any).kiboAPI) ||
      Boolean((window as any).kiboAPI) ||
      navigator.userAgent.toLowerCase().includes('electron')
    );
  })();

  useEffect(() => {
    if (isDesktopRuntime) {
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
    } else {
      document.documentElement.style.background = '#F4F3EF';
      document.body.style.background = '#F4F3EF';
      document.body.style.overflow = 'auto';
    }
  }, [isDesktopRuntime]);

  // Native Electron Desktop Companion always boots directly into KiboApp
  if (isDesktopRuntime) {
    return <KiboApp />;
  }

  // Standalone Web Product Page (Editorial Field-Synth Aesthetic · No Web Testing Toys)
  return (
    <div style={web.page}>
      {/* Top Editorial Specification Bar */}
      <header style={web.header}>
        <div style={web.headerInner}>
          <div style={web.brandRow}>
            <span style={web.orangeSquare} />
            <span style={web.brandCode}>KIBO™</span>
            <span style={web.brandModel}>FIELD-OS // MK-I</span>
          </div>

          <nav style={web.nav}>
            <a href="#overview" style={web.navItem}>Overview</a>
            <a href="#workflow" style={web.navItem}>Workflow</a>
            <a href="#specs" style={web.navItem}>Specifications</a>
          </nav>

          <a href="#download" style={web.downloadPill}>
            Windows 11 (.exe)
          </a>
        </div>
      </header>

      <main style={web.main}>
        {/* Editorial Hero */}
        <section id="overview" style={web.heroGrid}>
          <div style={web.heroCopyCol}>
            <div style={web.serialTag}>REF. 2026-KB01 · WINDOWS NATIVE OVERLAY</div>
            <h1 style={web.h1}>
              A tactile hardware companion built into your monitor bezel.
            </h1>
            <p style={web.lead}>
              Kibo sits flush at the top center of your Windows display. Hold a
              key to execute native UI clicks, scan screen regions with optical
              vision, dictate clean text into any editor, or dispatch background
              engineering agents while you work.
            </p>

            <div id="download" style={web.ctaRow}>
              <div style={web.cmdBox}>
                <span style={web.cmdPrompt}>$</span>
                <code style={web.cmdText}>npm run app</code>
              </div>
              <span style={web.ctaHint}>
                Launches native Windows DWM overlay via Electron
              </span>
            </div>
          </div>

          {/* Hardware Bezel Showcase Card (Static Product Visual, Not a Testing Toy) */}
          <div style={web.heroVisualCol}>
            <div style={web.monitorFrame}>
              <div style={web.monitorTopBezel}>
                <div style={web.notchCutout}>
                  <SoulCanvas
                    soul={SOUL_SKINS[0]}
                    width={76}
                    height={56}
                    scale={1.05}
                    mode="LISTENING"
                    expression="HAPPY"
                    interactive={false}
                  />
                </div>
              </div>

              <div style={web.monitorScreenBody}>
                <div style={web.screenCodeHeader}>
                  <span>ACTIVE SESSION · WIN32 UIA + GEMINI MULTIMODAL</span>
                  <span style={{ color: '#10B981' }}>● ONLINE</span>
                </div>

                <div style={web.transcriptRowUser}>
                  <span style={web.transcriptLabel}>HOLD WIN + ALT</span>
                  <span style={web.transcriptQuote}>
                    “Clone the layout and CSS variables from this website and save the summary to Notion.”
                  </span>
                </div>

                <div style={web.transcriptRowKibo}>
                  <span style={web.transcriptLabelAccent}>KIBO FORGE</span>
                  <span style={web.transcriptReply}>
                    Extracted 18 :root tokens & font families. Standalone HTML replica opened in browser and synced to Notion.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3-Column Editorial Feature Breakdown */}
        <section id="workflow" style={web.editorialSection}>
          <div style={web.sectionDivider}>
            <span>01 / CORE MECHANICS</span>
            <span>NATIVE WINDOWS INTEGRATION</span>
          </div>

          <div style={web.threeCol}>
            <article style={web.featureCol}>
              <div style={web.keyBadgeRow}>
                <kbd style={web.keycap}>Win</kbd>
                <span>+</span>
                <kbd style={web.keycap}>Alt</kbd>
              </div>
              <h3 style={web.h3}>Voice-to-OS Execution</h3>
              <p style={web.p}>
                Backed by an in-memory C# Win32 UIAutomation worker and GSMTC
                media bridge. Click on-screen controls, launch local desktop
                software, or scrub live Netflix and Spotify timelines without
                leaving your active window.
              </p>
            </article>

            <article style={web.featureCol}>
              <div style={web.keyBadgeRow}>
                <kbd style={web.keycap}>Ctrl</kbd>
                <span>+</span>
                <kbd style={web.keycap}>Shift</kbd>
              </div>
              <h3 style={web.h3}>Optical Screen Lasso</h3>
              <p style={web.p}>
                Circle any chart, error trace, or UI element on your monitor and
                ask a question out loud. Kibo crops the exact region and answers
                in real time.
              </p>
            </article>

            <article style={web.featureCol}>
              <div style={web.keyBadgeRow}>
                <kbd style={web.keycap}>Ctrl</kbd>
                <span>+</span>
                <kbd style={web.keycap}>Win</kbd>
              </div>
              <h3 style={web.h3}>GhostType Dictation</h3>
              <p style={web.p}>
                Speak naturally with false starts or mid-sentence changes. Kibo
                strips filler words and types clean, structured prose or code
                directly into your active cursor.
              </p>
            </article>
          </div>
        </section>

        {/* Technical Specification Sheet */}
        <section id="specs" style={web.editorialSection}>
          <div style={web.sectionDivider}>
            <span>02 / TECHNICAL DATASHEET</span>
            <span>SYSTEM REQUIREMENTS</span>
          </div>

          <div style={web.specTable}>
            {[
              ['Operating System', 'Windows 10 / Windows 11 (64-bit) with DWM MPO Bypass'],
              ['Console Modules', '01 Deck · 02 Ops · 03 Forge · 04 Buffer · 05 Launcher · 06 Radar · 07 Studio · 08 Pwr'],
              ['AI & Search Providers', 'Bring-your-own Google Gemini API Key + Tavily Live Search Key'],
              ['Local Storage', '100% on-device key storage and clipboard history'],
            ].map(([k, v]) => (
              <div key={k} style={web.specRow}>
                <span style={web.specKey}>{k}</span>
                <span style={web.specVal}>{v}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer style={web.footer}>
        <span>KIBO FIELD-OS · WINDOWS DESKTOP COMPANION</span>
        <span>RUN VIA `NPM RUN APP`</span>
      </footer>
    </div>
  );
}

const web: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#F4F3EF',
    color: '#111215',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  header: {
    borderBottom: '1px solid #DCDAD3',
    backgroundColor: '#F4F3EF',
    position: 'sticky',
    top: 0,
    zIndex: 20,
  },
  headerInner: {
    maxWidth: 1160,
    margin: '0 auto',
    padding: '16px 28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  orangeSquare: {
    width: 11,
    height: 11,
    backgroundColor: '#FF5722',
    display: 'inline-block',
  },
  brandCode: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: '-0.02em',
  },
  brandModel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: '#6E6D68',
    paddingLeft: 8,
    borderLeft: '1px solid #CFCBC2',
  },
  nav: {
    display: 'flex',
    gap: 28,
  },
  navItem: {
    fontSize: 13,
    fontWeight: 500,
    color: '#3F3E3A',
    textDecoration: 'none',
  },
  downloadPill: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11.5,
    fontWeight: 600,
    color: '#F4F3EF',
    backgroundColor: '#111215',
    padding: '8px 14px',
    borderRadius: 6,
    textDecoration: 'none',
  },
  main: {
    maxWidth: 1160,
    margin: '0 auto',
    padding: '64px 28px 96px',
  },
  heroGrid: {
    display: 'grid',
    gridTemplateColumns: '1.05fr 0.95fr',
    gap: 56,
    alignItems: 'center',
  },
  heroCopyCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  serialTag: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    fontWeight: 600,
    color: '#FF5722',
    letterSpacing: '0.06em',
  },
  h1: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 50,
    lineHeight: 1.06,
    fontWeight: 700,
    letterSpacing: '-0.035em',
    margin: 0,
    color: '#111215',
  },
  lead: {
    fontSize: 16.5,
    lineHeight: 1.6,
    color: '#4A4945',
    margin: 0,
  },
  ctaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  cmdBox: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#111215',
    color: '#F8FAFC',
    padding: '12px 20px',
    borderRadius: 8,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13.5,
    fontWeight: 600,
  },
  cmdPrompt: {
    color: '#FF5722',
  },
  cmdText: {
    fontFamily: "'JetBrains Mono', monospace",
  },
  ctaHint: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11.5,
    color: '#6E6D68',
  },
  heroVisualCol: {
    display: 'flex',
    justifyContent: 'center',
  },
  monitorFrame: {
    width: '100%',
    backgroundColor: '#14171F',
    borderRadius: 18,
    border: '1px solid #262B38',
    overflow: 'hidden',
    boxShadow: '0 28px 60px rgba(17, 18, 21, 0.16)',
  },
  monitorTopBezel: {
    height: 64,
    backgroundColor: '#1B202C',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  notchCutout: {
    width: 176,
    height: 54,
    backgroundColor: '#090B10',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(56, 189, 248, 0.25)',
    borderTop: 'none',
  },
  monitorScreenBody: {
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  screenCodeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10.5,
    color: '#64748B',
    paddingBottom: 10,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  transcriptRowUser: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  transcriptRowKibo: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    border: '1px solid rgba(56, 189, 248, 0.24)',
    borderRadius: 10,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  transcriptLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    color: '#94A3B8',
  },
  transcriptLabelAccent: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    color: '#38BDF8',
    fontWeight: 700,
  },
  transcriptQuote: {
    fontSize: 13.5,
    color: '#F1F5F9',
    lineHeight: 1.45,
  },
  transcriptReply: {
    fontSize: 13,
    color: '#BAE6FD',
    lineHeight: 1.45,
  },
  editorialSection: {
    marginTop: 88,
  },
  sectionDivider: {
    display: 'flex',
    justifyContent: 'space-between',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: '#6E6D68',
    paddingBottom: 12,
    borderBottom: '1px solid #CFCBC2',
    marginBottom: 32,
  },
  threeCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 28,
  },
  featureCol: {
    backgroundColor: '#EAE8E1',
    border: '1px solid #D8D5CC',
    borderRadius: 12,
    padding: 24,
  },
  keyBadgeRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    marginBottom: 14,
  },
  keycap: {
    backgroundColor: '#111215',
    color: '#F4F3EF',
    padding: '3px 8px',
    borderRadius: 5,
    fontWeight: 600,
  },
  h3: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 20,
    margin: '0 0 8px',
  },
  p: {
    fontSize: 14,
    lineHeight: 1.6,
    color: '#4A4945',
    margin: 0,
  },
  specTable: {
    borderTop: '1px solid #CFCBC2',
  },
  specRow: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    padding: '14px 0',
    borderBottom: '1px solid #DCDAD3',
    fontSize: 13.5,
  },
  specKey: {
    fontFamily: "'JetBrains Mono', monospace",
    color: '#6E6D68',
    fontSize: 12,
  },
  specVal: {
    color: '#111215',
    fontWeight: 500,
  },
  footer: {
    maxWidth: 1160,
    margin: '0 auto',
    padding: '28px',
    borderTop: '1px solid #DCDAD3',
    display: 'flex',
    justifyContent: 'space-between',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: '#6E6D68',
  },
};

export default App;
