// src/pages/WhatsNewPage.tsx
import React, { useEffect, useState } from 'react';
import { WebHeader, WindowsLogoIcon } from '../components/WebHeader';
import { WebFooter } from '../components/WebFooter';

interface ReleaseHighlight {
  tag: string;
  title: string;
  detail: string;
}

interface ReleaseEntry {
  version: string;
  releaseDate: string;
  title: string;
  summary: string;
  highlights: ReleaseHighlight[];
}

interface VersionManifest {
  version: string;
  minVersion?: string;
  downloadUrl?: string;
  releaseDate?: string;
  title?: string;
  notes?: string;
  highlights?: ReleaseHighlight[];
  releases?: ReleaseEntry[];
}

const FALLBACK_MANIFEST: VersionManifest = {
  version: '1.0.2',
  releaseDate: '2026-11-25',
  title: 'Native Rust + Tauri v2, Frosted Glass & External Game HUD',
  notes:
    'Kibo now runs on a lightweight native Rust + Tauri v2 runtime with real-time Gaussian frosted glass, dual notch styles, an anti-cheat safe Game Stats HUD, multi-file batch drag-and-drop conversion, smarter YouTube & web search routing, and expanding multi-line dictation captions.',
  highlights: [
    {
      tag: 'Core',
      title: 'Native Rust + Tauri v2 Runtime',
      detail: 'Replaced the legacy Electron layer with a fast, low-memory native Windows runtime and instant standalone Settings window.',
    },
    {
      tag: 'Design',
      title: 'Real-Time Frosted Glass & Dual Notch Styles',
      detail: 'Switch between Classic Bezel and Floating Island with live Gaussian-blurred backdrop glass, custom tint opacity, and critically-damped motion.',
    },
    {
      tag: 'Gaming',
      title: 'Anti-Cheat Safe Game Stats HUD & Focus Shield',
      detail: 'External read-only FPS, frametime sparkline, GPU, CPU, RAM, and ping HUD with automatic hotkey protection and click-through while gaming.',
    },
    {
      tag: 'Productivity',
      title: 'Multi-File Drag-and-Drop Batch Converter',
      detail: 'Drop one or multiple files directly onto the top notch to queue and convert them in batch while keeping every original file untouched.',
    },
    {
      tag: 'Voice',
      title: 'Smarter Web Search & Expanding Dictation',
      detail: 'Direct YouTube, Google, Reddit, and platform searches open straight in your browser, and dictation/voice boxes now auto-expand smoothly across multiple lines.',
    },
  ],
  releases: [
    {
      version: '1.0.2',
      releaseDate: '2026-11-25',
      title: 'Native Rust + Tauri v2, Frosted Glass & External Game HUD',
      summary:
        'Full migration to native Rust + Tauri v2 with real-time frosted glass, Classic & Floating notch modes, external Game Stats HUD, hardware Volume HUD, multi-file batch conversion, smart web search routing, and expanding voice captions.',
      highlights: [
        {
          tag: 'Core',
          title: 'Native Rust + Tauri v2 Architecture',
          detail: 'Tiny 5 MB installer, instant startup, native Windows Core Audio & SMTC media integration, and zero WebView2 mic popups.',
        },
        {
          tag: 'Appearance',
          title: 'Classic Bezel & Floating Island Frosted Glass',
          detail: 'Live native Gaussian-blurred glass with crisp GPU-masked concave arches, adjustable tint %, and Smooth / Snappy / Bouncy motion curves.',
        },
        {
          tag: 'Gaming',
          title: 'External Game Stats HUD & Gaming Focus Shield',
          detail: '100% read-only FPS, frametime graph, RTX/GPU temp & VRAM, CPU, RAM, and network ping with automatic hotkey pause during gameplay.',
        },
        {
          tag: 'Workflow',
          title: 'Multi-File Drag-and-Drop & Smart Search',
          detail: 'Drop multiple files onto the notch for batch conversion, get instant browser searches for YouTube & Google, and read full multi-line dictation captions without clipping.',
        },
      ],
    },
    {
      version: '1.0.1',
      releaseDate: '2026-11-10',
      title: 'ElevenLabs Studio Voice & Focus Sticky Notes',
      summary:
        'Added ElevenLabs studio voice synthesis, Focus Timer & Stopwatch sticky notes, and live Windows media artwork integration.',
      highlights: [
        {
          tag: 'Voice',
          title: 'ElevenLabs Studio Voice Engine',
          detail: 'Gapless HTML5 voice playback with configurable Gemini and ElevenLabs voices.',
        },
        {
          tag: 'Focus',
          title: 'Interactive Focus Sticky Notes',
          detail: 'Pomodoro countdown timer, lap stopwatch, and tactile sticky notes docked right inside the notch.',
        },
      ],
    },
  ],
};

function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va !== vb) return va > vb ? 1 : -1;
  }
  return 0;
}

interface WhatsNewPageProps {
  onNavigate: (route: string, anchor?: string) => void;
}

export const WhatsNewPage: React.FC<WhatsNewPageProps> = ({ onNavigate }) => {
  const [manifest, setManifest] = useState<VersionManifest>(FALLBACK_MANIFEST);
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('v')?.trim();
      if (v) setInstalledVersion(v.replace(/^v/i, ''));
    } catch {}

    let cancelled = false;
    fetch(`/version.json?_t=${Date.now()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: VersionManifest | null) => {
        if (!cancelled && data && data.version) {
          setManifest({
            ...FALLBACK_MANIFEST,
            ...data,
            highlights:
              Array.isArray(data.highlights) && data.highlights.length > 0
                ? data.highlights
                : FALLBACK_MANIFEST.highlights,
            releases:
              Array.isArray(data.releases) && data.releases.length > 0
                ? data.releases
                : FALLBACK_MANIFEST.releases,
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const hasNewerUpdate =
    Boolean(installedVersion) &&
    compareSemver(manifest.version, installedVersion || '0.0.0') > 0;

  const isUpToDate =
    Boolean(installedVersion) &&
    compareSemver(manifest.version, installedVersion || '0.0.0') <= 0;

  const releaseList: ReleaseEntry[] =
    manifest.releases && manifest.releases.length > 0
      ? manifest.releases
      : [
          {
            version: manifest.version,
            releaseDate: manifest.releaseDate || '',
            title: manifest.title || `Kibo v${manifest.version}`,
            summary: manifest.notes || '',
            highlights: manifest.highlights || [],
          },
        ];

  return (
    <div className="kibo-web-root">
      <WebHeader currentRoute="whats-new" onNavigate={onNavigate} />

      <main className="kibo-web-container" style={{ padding: '64px 20px 96px', maxWidth: 860 }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 999,
                background: 'rgba(18, 19, 22, 0.06)',
                fontSize: 13,
                fontWeight: 600,
                color: '#121316',
              }}
            >
              <WindowsLogoIcon size={12} />
              <span>Latest Release · v{manifest.version}</span>
            </div>

            {isUpToDate && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#047857',
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                You are up to date (v{installedVersion})
              </span>
            )}
          </div>

          <h1
            style={{
              fontSize: 'clamp(32px, 4.5vw, 46px)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#121316',
              lineHeight: 1.12,
              margin: '0 0 14px',
            }}
          >
            What's New in Kibo
          </h1>

          <p style={{ fontSize: 16, lineHeight: 1.6, color: '#68707C', margin: 0, maxWidth: 680 }}>
            Every new release, visual upgrade, performance improvement, and desktop workflow added to Kibo for Windows.
          </p>
        </div>

        {/* Version Comparison Update Banner (shown automatically when opened from an older Kibo build) */}
        {hasNewerUpdate && (
          <div
            className="kibo-card"
            style={{
              padding: '20px 24px',
              marginBottom: 28,
              background: '#121316',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#38BDF8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Update Ready
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>
                Kibo v{manifest.version} is available (you are running v{installedVersion})
              </div>
              <div style={{ fontSize: 13, color: '#A1A1AA', marginTop: 4 }}>
                Download the latest installer below to get all new features and fixes.
              </div>
            </div>
            {manifest.downloadUrl ? (
              <a
                href={manifest.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#FFFFFF',
                  color: '#121316',
                  borderRadius: 999,
                  padding: '10px 20px',
                  fontSize: 13.5,
                  fontWeight: 700,
                  textDecoration: 'none',
                  flexShrink: 0,
                }}
              >
                Download v{manifest.version}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('access')}
                style={{
                  background: '#FFFFFF',
                  color: '#121316',
                  border: 'none',
                  borderRadius: 999,
                  padding: '10px 20px',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Open Customer Portal
              </button>
            )}
          </div>
        )}

        {/* Release Timeline (dynamically populated from /version.json) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {releaseList.map((rel, idx) => {
            const isLatest = idx === 0;
            return (
              <section key={rel.version} className="kibo-card" style={{ padding: 28 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        padding: '4px 11px',
                        borderRadius: 999,
                        background: isLatest ? '#121316' : 'rgba(18, 19, 22, 0.07)',
                        color: isLatest ? '#FFFFFF' : '#121316',
                      }}
                    >
                      v{rel.version}
                    </span>
                    {isLatest && (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: 999,
                          background: 'rgba(14, 165, 233, 0.12)',
                          color: '#0369A1',
                        }}
                      >
                        Current Release
                      </span>
                    )}
                  </div>
                  {rel.releaseDate && (
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#68707C' }}>
                      {rel.releaseDate}
                    </span>
                  )}
                </div>

                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: '-0.025em',
                    color: '#121316',
                    margin: '0 0 10px',
                    lineHeight: 1.25,
                  }}
                >
                  {rel.title}
                </h2>

                {rel.summary && (
                  <p style={{ fontSize: 14.5, lineHeight: 1.65, color: '#4B5563', margin: '0 0 22px' }}>
                    {rel.summary}
                  </p>
                )}

                {rel.highlights && rel.highlights.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: 12,
                    }}
                  >
                    {rel.highlights.map((item, hi) => (
                      <div
                        key={hi}
                        style={{
                          padding: '14px 16px',
                          borderRadius: 12,
                          background: 'rgba(18, 19, 22, 0.03)',
                          border: '1px solid rgba(18, 19, 22, 0.07)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: '#68707C',
                            marginBottom: 4,
                          }}
                        >
                          {item.tag}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#121316', marginBottom: 4 }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.55, color: '#4B5563' }}>
                          {item.detail}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isLatest && manifest.downloadUrl && (
                  <div
                    style={{
                      marginTop: 22,
                      paddingTop: 18,
                      borderTop: '1px solid rgba(18, 19, 22, 0.07)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 13, color: '#68707C' }}>
                      Founders Edition license holders receive all v1.x updates automatically.
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => onNavigate('access')}
                        style={{
                          background: '#121316',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: 999,
                          padding: '9px 18px',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Get Update in Portal
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('contact')}
                        style={{
                          background: 'transparent',
                          color: '#121316',
                          border: '1px solid rgba(18, 19, 22, 0.16)',
                          borderRadius: 999,
                          padding: '9px 16px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Send Feedback
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>

      <WebFooter onNavigate={onNavigate} />
    </div>
  );
};
