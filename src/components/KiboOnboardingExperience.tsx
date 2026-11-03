// src/components/KiboOnboardingExperience.tsx
import React, { useState } from 'react';
import { SoulConfig } from '../lib/soulMath';
import { SoulCanvas } from './SoulCanvas';
import { soundFX } from '../lib/soundFX';

export interface KiboOnboardingExperienceProps {
  soul: SoulConfig;
  customShortcuts: { ask: string; circle: string; dictate: string };
  lastTriggeredHotkey?: string | null;
  liveSpeechText?: string;
  isIslandExpanded?: boolean;
  geminiDraftKey: string;
  tavilyDraftKey: string;
  onChangeGeminiKey: (val: string) => void;
  onChangeTavilyKey: (val: string) => void;
  onAwardEmbers: (amount: number) => void;
  onSpeak: (text: string) => void;
  onPreviewExpandIsland: (expand: boolean) => void;
  onComplete: () => void;
}

export const KiboOnboardingExperience: React.FC<KiboOnboardingExperienceProps> = ({
  soul,
  geminiDraftKey,
  onChangeGeminiKey,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [licenseEmail, setLicenseEmail] = useState<string>(() => {
    return localStorage.getItem('kibo_customer_email') || '';
  });
  const [licenseCode, setLicenseCode] = useState<string>(() => {
    return localStorage.getItem('kibo_license_key') || '';
  });
  const [isVerifyingLicense, setIsVerifyingLicense] = useState(false);
  const [licenseVerified, setLicenseVerified] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('kibo_customer_email') && localStorage.getItem('kibo_license_key'));
  });
  const [licenseError, setLicenseError] = useState<string>('');
  const [localGeminiKey, setLocalGeminiKey] = useState<string>(geminiDraftKey || '');
  const [keySaved, setKeySaved] = useState<boolean>(Boolean(geminiDraftKey));

  useEffect(() => {
    const api = (window as any).kiboAPI;
    api?.setShowTaskbar?.(true);
  }, []);

  const openGoogleAiStudio = () => {
    const url = 'https://aistudio.google.com/app/apikey';
    const api = (window as any).kiboAPI;
    if (api?.setAlwaysOnTop) {
      api.setAlwaysOnTop(false);
    }
    if (api?.openUrl) {
      api.openUrl(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleMinimize = () => {
    const api = (window as any).kiboAPI;
    api?.setShowTaskbar?.(true);
    if (api?.minimize) {
      api.minimize();
    }
  };

  const handleVerifyLicense = async () => {
    const cleanEmail = licenseEmail.trim().toLowerCase();
    const cleanCode = licenseCode.trim().toUpperCase().replace(/^#/, '');
    setLicenseError('');

    if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.length < 5) {
      setLicenseError('Please enter a valid purchase email address.');
      soundFX.playErrorChime();
      return;
    }

    if (!cleanCode) {
      setLicenseError('Please enter your Order # or License Key from your receipt.');
      soundFX.playErrorChime();
      return;
    }

    setIsVerifyingLicense(true);
    try {
      const res = await fetch('https://kiboai.vercel.app/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode }),
      });
      const data = await res.json();
      if (data && data.verified) {
        localStorage.setItem('kibo_customer_email', cleanEmail);
        localStorage.setItem('kibo_license_key', cleanCode);
        setLicenseVerified(true);
        setLicenseError('');
        soundFX.playSuccessChime();
        // Auto-advance to Step 2 smoothly
        setTimeout(() => {
          setCurrentStep(2);
        }, 750);
      } else {
        setLicenseVerified(false);
        setLicenseError(
          data?.error || 'This license key is not eligible or was not recognized. Please check your purchase confirmation receipt or enter a valid key.'
        );
        soundFX.playErrorChime();
      }
    } catch {
      setLicenseVerified(false);
      setLicenseError('This license key is not eligible or was not recognized. Please check your purchase confirmation receipt or enter a valid key.');
      soundFX.playErrorChime();
    } finally {
      setIsVerifyingLicense(false);
    }
  };

  const handleSaveGeminiKey = () => {
    const trimmed = localGeminiKey.trim();
    if (!trimmed) return;
    onChangeGeminiKey(trimmed);
    localStorage.setItem('kibo_gemini_key', trimmed);
    const api = (window as any).kiboAPI;
    if (api?.saveStoredSettings) {
      api.saveStoredSettings({ kibo_gemini_key: trimmed });
    }
    setKeySaved(true);
    soundFX.playSuccessChime();
  };

  const handleFinish = () => {
    if (localGeminiKey.trim() && !keySaved) {
      handleSaveGeminiKey();
    }
    const api = (window as any).kiboAPI;
    if (api?.setAlwaysOnTop) {
      api.setAlwaysOnTop(true);
    }
    soundFX.playSuccessChime();
    onComplete();
  };

  const canContinue = currentStep !== 1 || licenseVerified;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(5, 7, 10, 0.72)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          background: '#0D1117',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6), 0 0 32px rgba(56, 189, 248, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Top Header & Step Progress Bar */}
        <div
          style={{
            padding: '22px 28px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SoulCanvas soul={soul} width={30} height={26} scale={0.8} mode="LISTENING" />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.02em' }}>
                Kibo Setup Guide
              </div>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
                Step {currentStep + 1} of 4
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Step Dots */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 1, 2, 3].map((step) => (
                <div
                  key={step}
                  onClick={() => {
                    if (step === 0 || licenseVerified || currentStep === 0) {
                      setCurrentStep(step);
                    }
                  }}
                  style={{
                    width: step === currentStep ? 24 : 8,
                    height: 6,
                    borderRadius: 999,
                    background:
                      step === currentStep
                        ? '#38BDF8'
                        : step < currentStep
                        ? 'rgba(56, 189, 248, 0.4)'
                        : 'rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.25s ease',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>

            {/* Minimize Window Button */}
            <button
              type="button"
              onClick={handleMinimize}
              title="Minimize Kibo to taskbar"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 8,
                color: '#94A3B8',
                cursor: 'pointer',
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 700,
                lineHeight: 1,
                padding: 0,
                transition: 'all 0.15s ease',
              }}
            >
              &#x2212;
            </button>
          </div>
        </div>

        {/* Step Body */}
        <div
          style={{
            padding: '28px',
            minHeight: 330,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* STEP 0: WELCOME */}
          {currentStep === 0 && (
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(56, 189, 248, 0.12)',
                  color: '#38BDF8',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  marginBottom: 14,
                }}
              >
                <span>FOUNDERS EDITION</span>
              </div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#F8FAFC',
                  margin: '0 0 10px',
                  letterSpacing: '-0.02em',
                }}
              >
                Meet Your Ambient Companion
              </h2>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#94A3B8', margin: '0 0 20px' }}>
                Kibo rests seamlessly inside your screen's top bezel. Control your PC with your voice, circle on-screen content to ask questions, and dictate clean formatted text anywhere.
              </p>

              <div
                style={{
                  background: '#141822',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 14,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#38BDF8', flexShrink: 0 }} />
                  <div style={{ fontSize: 13, color: '#E2E8F0' }}>
                    <strong>Top-Bezel Workspace:</strong> Slides down smoothly when needed and auto-tucks away.
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#38BDF8', flexShrink: 0 }} />
                  <div style={{ fontSize: 13, color: '#E2E8F0' }}>
                    <strong>Global Shortcuts:</strong> Works universally over games, code editors, and browsers.
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#38BDF8', flexShrink: 0 }} />
                  <div style={{ fontSize: 13, color: '#E2E8F0' }}>
                    <strong>Local &amp; Private:</strong> Operates directly on your personal Gemini key with zero monthly subscriptions.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: LICENSE VERIFICATION WITH CODE */}
          {currentStep === 1 && (
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: licenseVerified ? 'rgba(34, 197, 94, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                  color: licenseVerified ? '#22C55E' : '#38BDF8',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  marginBottom: 14,
                }}
              >
                <span>{licenseVerified ? 'ORDER VERIFIED' : 'PURCHASE VERIFICATION'}</span>
              </div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#F8FAFC',
                  margin: '0 0 10px',
                  letterSpacing: '-0.02em',
                }}
              >
                Activate Founders License
              </h2>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#94A3B8', margin: '0 0 18px' }}>
                Enter the email address and Order # or License Key from your purchase confirmation receipt.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                <input
                  type="email"
                  value={licenseEmail}
                  onChange={(e) => {
                    setLicenseEmail(e.target.value);
                    setLicenseVerified(false);
                    setLicenseError('');
                  }}
                  placeholder="Purchase email (e.g. name@example.com)"
                  style={{
                    height: 42,
                    background: '#141822',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 10,
                    padding: '0 14px',
                    color: '#F8FAFC',
                    fontSize: 13.5,
                    outline: 'none',
                  }}
                />

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={licenseCode}
                    onChange={(e) => {
                      setLicenseCode(e.target.value);
                      setLicenseVerified(false);
                      setLicenseError('');
                    }}
                    placeholder="Order # (e.g. 104829) or License Key"
                    style={{
                      flex: 1,
                      height: 42,
                      background: '#141822',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 10,
                      padding: '0 14px',
                      color: '#F8FAFC',
                      fontSize: 13,
                      fontFamily: 'var(--kibo-font-mono, monospace)',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyLicense}
                    disabled={isVerifyingLicense}
                    style={{
                      height: 42,
                      padding: '0 20px',
                      borderRadius: 10,
                      background: licenseVerified ? '#22C55E' : '#38BDF8',
                      color: '#0A0E17',
                      fontWeight: 700,
                      fontSize: 13,
                      border: 'none',
                      cursor: isVerifyingLicense ? 'wait' : 'pointer',
                      transition: 'all 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    {isVerifyingLicense ? 'Verifying...' : licenseVerified ? 'Verified' : 'Verify'}
                  </button>
                </div>
              </div>

              {licenseVerified && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(34, 197, 94, 0.12)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: '#22C55E',
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  Founders license unlocked for {licenseEmail}. You may proceed to step 3.
                </div>
              )}

              {licenseError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#F87171',
                    fontSize: 12.5,
                    lineHeight: 1.5,
                  }}
                >
                  {licenseError}
                </div>
              )}

              {!licenseVerified && !licenseError && (
                <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Don't have a license?</span>
                  <button
                    type="button"
                    onClick={() => {
                      const api = (window as any).kiboAPI;
                      if (api?.openUrl) {
                        api.openUrl('https://kiboai.vercel.app/buy');
                      } else {
                        window.open('https://kiboai.vercel.app/buy', '_blank');
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#38BDF8',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline',
                    }}
                  >
                    Get Founders Edition ($8)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: GOOGLE GEMINI API KEY */}
          {currentStep === 2 && (
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: keySaved ? 'rgba(34, 197, 94, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                  color: keySaved ? '#22C55E' : '#38BDF8',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  marginBottom: 14,
                }}
              >
                <span>{keySaved ? 'ENGINE CONNECTED' : 'INTELLIGENCE ENGINE'}</span>
              </div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#F8FAFC',
                  margin: '0 0 10px',
                  letterSpacing: '-0.02em',
                }}
              >
                Connect Google Gemini Key
              </h2>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#94A3B8', margin: '0 0 16px' }}>
                Kibo communicates directly with Google's Gemini models using your personal key. Google provides a generous free tier with zero subscription cost.
              </p>

              {/* Action Buttons: Open & Minimize to Foreground */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={openGoogleAiStudio}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    color: '#38BDF8',
                    padding: '9px 16px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <span>Get Free Key on Google AI Studio</span>
                  <span style={{ fontSize: 14 }}>&#x2197;</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    openGoogleAiStudio();
                    handleMinimize();
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#CBD5E1',
                    padding: '9px 14px',
                    borderRadius: 10,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Opens browser and minimizes Kibo to taskbar so you can copy your key"
                >
                  <span>Open &amp; Minimize Kibo to Copy</span>
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  type="password"
                  value={localGeminiKey}
                  onChange={(e) => setLocalGeminiKey(e.target.value)}
                  placeholder="Paste key here (AIzaSy...)"
                  style={{
                    flex: 1,
                    height: 42,
                    background: '#141822',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 10,
                    padding: '0 14px',
                    color: '#F8FAFC',
                    fontSize: 13,
                    fontFamily: 'var(--kibo-font-mono, monospace)',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveGeminiKey}
                  style={{
                    height: 42,
                    padding: '0 18px',
                    borderRadius: 10,
                    background: keySaved ? '#22C55E' : '#38BDF8',
                    color: '#0A0E17',
                    fontWeight: 700,
                    fontSize: 13,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {keySaved ? 'Saved' : 'Save'}
                </button>
              </div>

              <div style={{ fontSize: 12, color: '#64748B' }}>
                Your browser will open in front. Create or copy your key, then click Kibo in your taskbar to paste it above.
              </div>
            </div>
          )}

          {/* STEP 3: HARDWARE SHORTCUTS */}
          {currentStep === 3 && (
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(56, 189, 248, 0.12)',
                  color: '#38BDF8',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  marginBottom: 14,
                }}
              >
                <span>GLOBAL HOTKEYS</span>
              </div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#F8FAFC',
                  margin: '0 0 10px',
                  letterSpacing: '-0.02em',
                }}
              >
                How to Summon Kibo
              </h2>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#94A3B8', margin: '0 0 16px' }}>
                Use these three shortcuts from anywhere in Windows to interact with Kibo:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Shortcut 1 */}
                <div
                  style={{
                    background: '#141822',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC' }}>Ask &amp; Voice Control</div>
                    <div style={{ fontSize: 11.5, color: '#64748B' }}>Hold, speak your command, and release</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <kbd
                      style={{
                        background: '#0D1117',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 12,
                        color: '#F8FAFC',
                        fontWeight: 700,
                      }}
                    >
                      Win
                    </kbd>
                    <span style={{ color: '#64748B', fontSize: 12 }}>+</span>
                    <kbd
                      style={{
                        background: '#0D1117',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 12,
                        color: '#F8FAFC',
                        fontWeight: 700,
                      }}
                    >
                      Alt
                    </kbd>
                  </div>
                </div>

                {/* Shortcut 2 */}
                <div
                  style={{
                    background: '#141822',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC' }}>Circle to Ask (Screen Vision)</div>
                    <div style={{ fontSize: 11.5, color: '#64748B' }}>Draw a lasso around any screen region to inspect</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <kbd
                      style={{
                        background: '#0D1117',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 12,
                        color: '#F8FAFC',
                        fontWeight: 700,
                      }}
                    >
                      Ctrl
                    </kbd>
                    <span style={{ color: '#64748B', fontSize: 12 }}>+</span>
                    <kbd
                      style={{
                        background: '#0D1117',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 12,
                        color: '#F8FAFC',
                        fontWeight: 700,
                      }}
                    >
                      Shift
                    </kbd>
                  </div>
                </div>

                {/* Shortcut 3 */}
                <div
                  style={{
                    background: '#141822',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC' }}>Clean Dictation</div>
                    <div style={{ fontSize: 11.5, color: '#64748B' }}>Hold to dictate, types polished text at your cursor</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <kbd
                      style={{
                        background: '#0D1117',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 12,
                        color: '#F8FAFC',
                        fontWeight: 700,
                      }}
                    >
                      Ctrl
                    </kbd>
                    <span style={{ color: '#64748B', fontSize: 12 }}>+</span>
                    <kbd
                      style={{
                        background: '#0D1117',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 12,
                        color: '#F8FAFC',
                        fontWeight: 700,
                      }}
                    >
                      Win
                    </kbd>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 24,
              paddingTop: 18,
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {currentStep > 0 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '8px 12px',
                }}
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 1 && !licenseVerified) {
                    setLicenseError('Please enter your purchase details and click Verify first.');
                    soundFX.playErrorChime();
                    return;
                  }
                  setCurrentStep((prev) => Math.min(3, prev + 1));
                }}
                disabled={currentStep === 1 && !licenseVerified}
                style={{
                  background: (currentStep === 1 && !licenseVerified) ? 'rgba(56, 189, 248, 0.15)' : '#38BDF8',
                  color: (currentStep === 1 && !licenseVerified) ? '#64748B' : '#0A0E17',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 22px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: (currentStep === 1 && !licenseVerified) ? 'not-allowed' : 'pointer',
                  boxShadow: (currentStep === 1 && !licenseVerified) ? 'none' : '0 2px 10px rgba(56, 189, 248, 0.25)',
                  transition: 'all 0.2s',
                  opacity: (currentStep === 1 && !licenseVerified) ? 0.6 : 1,
                }}
              >
                {currentStep === 0
                  ? 'Get Started'
                  : currentStep === 1 && !licenseVerified
                  ? 'Verify License to Continue'
                  : 'Continue'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                style={{
                  background: '#22C55E',
                  color: '#0A0E17',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 24px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 12px rgba(34, 197, 94, 0.3)',
                  transition: 'opacity 0.2s',
                }}
              >
                Launch Kibo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
