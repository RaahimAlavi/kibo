// src/pages/RequirementsPage.tsx
import React from 'react';
import { WebHeader, WindowsLogoIcon } from '../components/WebHeader';
import { WebFooter } from '../components/WebFooter';

interface RequirementsPageProps {
  onNavigate: (route: string, anchor?: string) => void;
}

export const RequirementsPage: React.FC<RequirementsPageProps> = ({ onNavigate }) => {
  return (
    <div className="kibo-web-root">
      <WebHeader currentRoute="requirements" onNavigate={onNavigate} />

      <main className="kibo-web-container" style={{ padding: '64px 20px 96px', maxWidth: 840 }}>
        {/* Title */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(18, 19, 22, 0.05)',
              fontSize: 13,
              fontWeight: 600,
              color: '#121316',
              marginBottom: 16,
            }}
          >
            <WindowsLogoIcon size={12} />
            <span>Specifications & API Details</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(32px, 4.5vw, 44px)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#121316',
              lineHeight: 1.15,
              margin: '0 0 16px',
            }}
          >
            System Requirements & Guidelines
          </h1>

          <p style={{ fontSize: 16, lineHeight: 1.6, color: '#68707C', margin: 0 }}>
            Everything you need to know about compatible hardware, Windows support, Google Gemini free tier limits, and Founders Edition license terms.
          </p>
        </div>

        {/* Section 1: Operating System & Hardware */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#121316', letterSpacing: '-0.02em', margin: '0 0 16px' }}>
            1. Operating System & Hardware Specs
          </h2>

          <div className="kibo-card" style={{ padding: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(18, 19, 22, 0.08)' }}>
                  <td style={{ padding: '12px 0', fontWeight: 600, color: '#121316', width: 180 }}>Supported OS</td>
                  <td style={{ padding: '12px 0', color: '#4B5563' }}>
                    Windows 10 (64-bit, Version 2004 / Build 19041 or newer) and Windows 11 (all editions).
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(18, 19, 22, 0.08)' }}>
                  <td style={{ padding: '12px 0', fontWeight: 600, color: '#121316' }}>Processor (CPU)</td>
                  <td style={{ padding: '12px 0', color: '#4B5563' }}>
                    64-bit Intel Core or AMD Ryzen processor (2.0 GHz or higher).
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(18, 19, 22, 0.08)' }}>
                  <td style={{ padding: '12px 0', fontWeight: 600, color: '#121316' }}>Memory (RAM)</td>
                  <td style={{ padding: '12px 0', color: '#4B5563' }}>
                    Minimum 4 GB RAM. 8 GB or higher recommended for concurrent workspace tasks.
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(18, 19, 22, 0.08)' }}>
                  <td style={{ padding: '12px 0', fontWeight: 600, color: '#121316' }}>Disk Space</td>
                  <td style={{ padding: '12px 0', color: '#4B5563' }}>
                    300 MB free storage for core binary and lightweight runtime cache.
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(18, 19, 22, 0.08)' }}>
                  <td style={{ padding: '12px 0', fontWeight: 600, color: '#121316' }}>Microphone & Audio</td>
                  <td style={{ padding: '12px 0', color: '#4B5563' }}>
                    Any standard built-in or external USB/Bluetooth microphone for speech dictation and commands.
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '12px 0', fontWeight: 600, color: '#121316' }}>Display & Monitors</td>
                  <td style={{ padding: '12px 0', color: '#4B5563' }}>
                    Multi-monitor setups, ultrawide panels, and Windows DPI scaling (100% to 250%) fully supported.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Gemini API Setup & Free Limits */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#121316', letterSpacing: '-0.02em', margin: '0 0 16px' }}>
            2. Google Gemini API & Generous Free Tier
          </h2>

          <div className="kibo-card" style={{ padding: 24 }}>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: '#4B5563', margin: '0 0 16px' }}>
              Kibo operates on a direct <strong>Bring Your Own Key (BYOK)</strong> model. You connect your personal Google Gemini API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#0284C7', textDecoration: 'underline', fontWeight: 600 }}>Google AI Studio &#x2197;</a>. This delivers three distinct advantages:
            </p>

            <ul style={{ margin: '0 0 20px', paddingLeft: 20, fontSize: 14, lineHeight: 1.65, color: '#4B5563' }}>
              <li>
                <strong>Free Usage Tier</strong>: Google provides 15 requests per minute, 1,000,000 tokens per minute, and 1,500 daily requests completely free on Gemini 2.5 Flash without charging your card.
              </li>
              <li>
                <strong>Zero Middleware Markups</strong>: You never pay third-party API surcharge fees. Requests route directly between your PC and Google servers.
              </li>
              <li>
                <strong>Complete Privacy</strong>: Your credentials are encrypted in Windows Credential Locker (DPAPI) and never stored on Kibo infrastructure.
              </li>
            </ul>

            <div
              style={{
                padding: 16,
                borderRadius: 10,
                background: '#F9FAFB',
                border: '1px solid rgba(18, 19, 22, 0.08)',
                fontSize: 13,
                lineHeight: 1.6,
                color: '#374151',
              }}
            >
              <strong>How to get your free key in 30 seconds:</strong>
              <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                <li>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#121316', fontWeight: 600 }}>aistudio.google.com</a> and sign in with your Google account.</li>
                <li>Click <strong>Create API Key</strong>.</li>
                <li>Paste the key into Kibo under <strong>Preferences &gt; Account &amp; Keys</strong>.</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Section 3: Purchase & License Boundaries */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#121316', letterSpacing: '-0.02em', margin: '0 0 16px' }}>
            3. Founders Edition License Limits
          </h2>

          <div className="kibo-card" style={{ padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#121316', margin: '0 0 6px' }}>Unlimited Personal Activations</h3>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: '#68707C', margin: 0 }}>
                  Bound directly to your purchase email address. Activate and run Kibo across all personal Windows computers you own with zero arbitrary device limits.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#121316', margin: '0 0 6px' }}>Perpetual Ownership</h3>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: '#68707C', margin: 0 }}>
                  Your license key never expires. You retain perpetual access to the software and all updates within the Founders Edition series.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#121316', margin: '0 0 6px' }}>Transferability</h3>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: '#68707C', margin: 0 }}>
                  Licenses are non-transferable and tied to your purchase email address. Reselling or distributing license keys is strictly prohibited.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Call to Action */}
        <div
          style={{
            padding: '28px 24px',
            borderRadius: 16,
            background: '#121316',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              Ready to equip your desktop?
            </h3>
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
              Get Founders Edition today for a one-time payment of $8.
            </p>
          </div>
          <button
            onClick={() => onNavigate('buy')}
            style={{
              padding: '12px 22px',
              borderRadius: 10,
              background: '#FFFFFF',
              color: '#121316',
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Get Founders Edition · $8
          </button>
        </div>
      </main>

      <WebFooter onNavigate={onNavigate} />
    </div>
  );
};
