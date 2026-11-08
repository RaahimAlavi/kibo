// src/pages/DownloadSuccessPage.tsx
import React, { useEffect, useState } from 'react';
import { WebHeader, WindowsLogoIcon } from '../components/WebHeader';
import { WebFooter } from '../components/WebFooter';

const INSTALLER_DOWNLOAD_URL =
  (import.meta as any).env?.VITE_INSTALLER_DOWNLOAD_URL ||
  'https://www.dropbox.com/scl/fi/k9ygliszmhj4w1os646xq/Kibo-Setup-1.0.2.exe?rlkey=f2a5hdr1fmwt82z8f8mekf74h&st=w7p47c6j&dl=1';

interface DownloadSuccessPageProps {
  onNavigate: (route: string, anchor?: string) => void;
}

export const DownloadSuccessPage: React.FC<DownloadSuccessPageProps> = ({ onNavigate }) => {
  const [downloadTriggered, setDownloadTriggered] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(2);

  const triggerDownload = () => {
    setDownloadTriggered(true);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = INSTALLER_DOWNLOAD_URL;
    document.body.appendChild(iframe);
    setTimeout(() => {
      try {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      } catch {
        // ignore
      }
    }, 60000);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          triggerDownload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="kibo-web-root">
      <WebHeader currentRoute="download" onNavigate={onNavigate} />

      <main className="kibo-web-container" style={{ padding: '64px 20px 96px', maxWidth: 980 }}>
        {/* Top Centered Status */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(2, 132, 199, 0.2)',
              fontSize: 13,
              fontWeight: 600,
              color: '#0284C7',
              marginBottom: 18,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#0284C7',
                boxShadow: '0 0 8px #0284C7',
              }}
            />
            <span>Setup Initiated</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(32px, 4.5vw, 46px)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#121316',
              lineHeight: 1.15,
              margin: '0 0 14px',
            }}
          >
            Thank you for downloading Kibo
          </h1>

          <p
            style={{
              fontSize: 17,
              lineHeight: 1.6,
              color: '#68707C',
              margin: '0 auto',
              maxWidth: 580,
            }}
          >
            Just a few steps left to get started with your new companion.
          </p>
        </div>

        {/* Download State Banner */}
        <div
          style={{
            maxWidth: 640,
            margin: '0 auto 56px',
            padding: '20px 24px',
            borderRadius: 16,
            background: '#FFFFFF',
            border: '1px solid rgba(18, 19, 22, 0.08)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: '#F0F9FF',
                border: '1px solid #BAE6FD',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284C7',
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#121316', marginBottom: 2 }}>
                {downloadTriggered ? 'Your download has started.' : `Your download starts on its own in ${secondsRemaining}s.`}
              </div>
              <div style={{ fontSize: 13, color: '#68707C' }}>
                Didn't start?{' '}
                <a
                  href={INSTALLER_DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#0284C7',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  download kibo manually
                </a>
              </div>
            </div>
          </div>

          <a
            href={INSTALLER_DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            download="Kibo-Setup-1.0.2.exe"
            onClick={() => setDownloadTriggered(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 10,
              background: '#121316',
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              cursor: 'pointer',
              letterSpacing: '-0.01em',
              transition: 'opacity 0.2s',
            }}
          >
            <WindowsLogoIcon size={13} />
            <span>Download .exe</span>
          </a>
        </div>

        {/* 3 Step Instructions Grid */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#68707C',
              }}
            >
              Setup Guide
            </span>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#121316',
                margin: '6px 0 0',
              }}
            >
              How to Install &amp; Activate Kibo
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 20,
            }}
          >
            {/* Step 1 Card */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 20,
                border: '1px solid rgba(18, 19, 22, 0.08)',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Image Illustration Container */}
              <div
                style={{
                  background: 'linear-gradient(180deg, #F8FAFC 0%, #EDF2F7 100%)',
                  padding: '32px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 180,
                  position: 'relative',
                  borderBottom: '1px solid rgba(18, 19, 22, 0.06)',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#FFFFFF',
                    borderRadius: 16,
                    padding: 16,
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(18, 19, 22, 0.08)',
                  }}
                >
                  <img
                    src="./icon.png"
                    alt="Kibo Setup Icon"
                    style={{ width: 72, height: 72, objectFit: 'contain' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -8,
                      right: -8,
                      background: '#121316',
                      color: '#FFFFFF',
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <WindowsLogoIcon size={10} />
                    <span>.EXE</span>
                  </div>
                </div>
              </div>

              {/* Step Content */}
              <div style={{ padding: '24px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#0284C7',
                    letterSpacing: '0.06em',
                    marginBottom: 8,
                  }}
                >
                  STEP 01
                </div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: '#121316',
                    margin: '0 0 10px',
                  }}
                >
                  Run Kibo-Setup.exe
                </h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: '#68707C', margin: 0 }}>
                  Open your browser downloads bar or PC Downloads folder and double-click the installer. Follow the standard Windows setup wizard to install Kibo.
                </p>
              </div>
            </div>

            {/* Step 2 Card */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 20,
                border: '1px solid rgba(18, 19, 22, 0.08)',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Image Illustration Container */}
              <div
                style={{
                  background: 'linear-gradient(180deg, #F8FAFC 0%, #EDF2F7 100%)',
                  padding: '32px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 180,
                  position: 'relative',
                  borderBottom: '1px solid rgba(18, 19, 22, 0.06)',
                }}
              >
                <div
                  style={{
                    background: '#121316',
                    borderRadius: 14,
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <img
                    src="./icon.png"
                    alt="Kibo Activation Icon"
                    style={{ width: 36, height: 36, objectFit: 'contain' }}
                  />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', letterSpacing: '0.04em' }}>
                      FOUNDERS VERIFIED
                    </div>
                    <div style={{ fontSize: 12, color: '#E2E8F0', fontWeight: 600 }}>
                      Instant Email Activation
                    </div>
                  </div>
                </div>
              </div>

              {/* Step Content */}
              <div style={{ padding: '24px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#0284C7',
                    letterSpacing: '0.06em',
                    marginBottom: 8,
                  }}
                >
                  STEP 02
                </div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: '#121316',
                    margin: '0 0 10px',
                  }}
                >
                  Enter Your Order Email
                </h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: '#68707C', margin: 0 }}>
                  Launch Kibo on your PC and enter the email address used for your purchase. Kibo verifies your order and unlocks unlimited access without requiring passwords.
                </p>
              </div>
            </div>

            {/* Step 3 Card */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 20,
                border: '1px solid rgba(18, 19, 22, 0.08)',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Image Illustration Container */}
              <div
                style={{
                  background: 'linear-gradient(180deg, #0B0F17 0%, #111827 100%)',
                  padding: '32px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 180,
                  position: 'relative',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      background: 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 20px rgba(56, 189, 248, 0.25)',
                    }}
                  >
                    <img
                      src="./icon.png"
                      alt="Kibo Bezel Companion"
                      style={{ width: 42, height: 42, objectFit: 'contain' }}
                    />
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      color: '#38BDF8',
                      fontWeight: 600,
                      fontFamily: 'monospace',
                    }}
                  >
                    GEMINI-API-KEY-CONNECTED
                  </div>
                </div>
              </div>

              {/* Step Content */}
              <div style={{ padding: '24px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#0284C7',
                    letterSpacing: '0.06em',
                    marginBottom: 8,
                  }}
                >
                  STEP 03
                </div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: '#121316',
                    margin: '0 0 10px',
                  }}
                >
                  Add Your Gemini API Key
                </h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: '#68707C', margin: '0 0 12px' }}>
                  Open Preferences &gt; Account &amp; Keys and add your free Google Gemini API key. Kibo immediately appears in your top bezel screen ready to assist.
                </p>
                <div>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: '#0284C7',
                      textDecoration: 'none',
                    }}
                  >
                    <span>Get Key on Google AI Studio</span>
                    <span>&#x2197;</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Support Helpers */}
        <div
          style={{
            textAlign: 'center',
            padding: '24px',
            borderRadius: 14,
            background: 'rgba(18, 19, 22, 0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => onNavigate('access')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 13,
              fontWeight: 600,
              color: '#121316',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Customer Access Portal
          </button>
          <span style={{ color: '#D1D5DB' }}>|</span>
          <button
            type="button"
            onClick={() => onNavigate('requirements')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 13,
              fontWeight: 600,
              color: '#121316',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            System Requirements
          </button>
          <span style={{ color: '#D1D5DB' }}>|</span>
          <button
            type="button"
            onClick={() => onNavigate('contact')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 13,
              fontWeight: 600,
              color: '#121316',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Need Help? Contact Support
          </button>
        </div>
      </main>

      <WebFooter onNavigate={onNavigate} />
    </div>
  );
};
