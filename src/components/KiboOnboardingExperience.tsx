// src/components/KiboOnboardingExperience.tsx
// Minimal 3-Step First-Launch Setup (Polar License -> Gemini Key -> Style & Ready)
import React, { useState } from 'react';
import { SoulConfig } from '../lib/soulMath';
import { KiboLogoIcon } from './KiboLogoIcon';
import { soundFX } from '../lib/soundFX';

export interface KiboOnboardingProps {
  soul: SoulConfig;
  customShortcuts: { ask: string; dictate: string; lasso: string };
  lastTriggeredHotkey: string | null;
  liveSpeechText: string;
  isIslandExpanded: boolean;
  geminiDraftKey: string;
  tavilyDraftKey: string;
  onChangeGeminiKey: (val: string) => void;
  onChangeTavilyKey: (val: string) => void;
  onAwardEmbers: (amount: number) => void;
  onSpeak?: (text: string) => void;
  onPreviewExpandIsland: (expand: boolean) => void;
  onComplete: (overrideGeminiKey?: string) => void;
}

export const KiboOnboardingExperience: React.FC<KiboOnboardingProps> = ({
  customShortcuts,
  geminiDraftKey,
  onChangeGeminiKey,
  onComplete,
}) => {
  const alreadyVerified =
    typeof window !== 'undefined' &&
    Boolean(localStorage.getItem('kibo_customer_email')) &&
    Boolean(localStorage.getItem('kibo_license_key'));

  const [step, setStep] = useState<number>(() => (alreadyVerified ? 1 : 0));
  const [licenseEmail, setLicenseEmail] = useState<string>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('kibo_customer_email') || '' : ''
  );
  const [licenseCode, setLicenseCode] = useState<string>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('kibo_license_key') || '' : ''
  );
  const [licenseVerified, setLicenseVerified] = useState<boolean>(alreadyVerified);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [licenseError, setLicenseError] = useState<string>('');

  const [localGeminiKey, setLocalGeminiKey] = useState<string>(() => geminiDraftKey || '');
  const [notchStyle, setNotchStyle] = useState<'classic' | 'floating'>(() =>
    typeof window !== 'undefined' && localStorage.getItem('kibo_notch_style') === 'floating'
      ? 'floating'
      : 'classic'
  );
  const [glassEnabled, setGlassEnabled] = useState<boolean>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('kibo_glass_enabled') !== 'false' : true
  );

  const api = typeof window !== 'undefined' ? (window as any).kiboAPI : null;

  const handleMinimize = () => {
    api?.setShowTaskbar?.(true);
    api?.minimize?.();
  };

  const openExternalAndMinimize = (url: string) => {
    if (api?.openUrl) {
      api.openUrl(url);
    } else {
      window.open(url, '_blank');
    }
    handleMinimize();
  };

  const handleVerifyLicense = async () => {
    const cleanEmail = licenseEmail.trim().toLowerCase();
    const cleanCode = licenseCode.trim().toUpperCase().replace(/^#/, '');
    setLicenseError('');

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLicenseError('Enter the email address used at checkout.');
      soundFX.playErrorChime();
      return;
    }
    if (!cleanCode) {
      setLicenseError('Enter your KIBO-... license key from your Polar receipt.');
      soundFX.playErrorChime();
      return;
    }

    setIsVerifying(true);
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
        setTimeout(() => setStep(1), 420);
      } else {
        setLicenseVerified(false);
        setLicenseError(
          data?.error || 'License key not recognized. Check your Polar confirmation email.'
        );
        soundFX.playErrorChime();
      }
    } catch {
      setLicenseVerified(false);
      setLicenseError('Could not reach license server. Check your internet connection.');
      soundFX.playErrorChime();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveGeminiAndNext = () => {
    const clean = localGeminiKey.trim();
    if (clean) {
      onChangeGeminiKey(clean);
      localStorage.setItem('kibo_gemini_key', clean);
      api?.saveStoredSettings?.({ kibo_gemini_key: clean });
      soundFX.playSuccessChime();
    }
    setStep(2);
  };

  const handleSelectStyle = (next: 'classic' | 'floating') => {
    setNotchStyle(next);
    localStorage.setItem('kibo_notch_style', next);
    api?.saveStoredSettings?.({ kibo_notch_style: next });
    soundFX.playClick();
  };

  const handleToggleGlass = () => {
    const next = !glassEnabled;
    setGlassEnabled(next);
    localStorage.setItem('kibo_glass_enabled', String(next));
    api?.saveStoredSettings?.({ kibo_glass_enabled: next });
    soundFX.playToggle(next);
  };

  const handleFinish = () => {
    const clean = localGeminiKey.trim();
    if (clean) {
      onChangeGeminiKey(clean);
      localStorage.setItem('kibo_gemini_key', clean);
      api?.saveStoredSettings?.({ kibo_gemini_key: clean });
    }
    soundFX.playSuccessChime();
    onComplete(clean);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 38,
    borderRadius: 10,
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: '#141418',
    color: '#F4F4F5',
    padding: '0 12px',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const primaryBtn: React.CSSProperties = {
    height: 38,
    padding: '0 18px',
    borderRadius: 10,
    border: 'none',
    background: '#F4F4F5',
    color: '#111114',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  };

  const secondaryBtn: React.CSSProperties = {
    height: 38,
    padding: '0 14px',
    borderRadius: 10,
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#E4E4E7',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8, 9, 12, 0.56)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        boxSizing: 'border-box',
        userSelect: 'none',
        fontFamily: 'Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 468,
          background: '#1A1A1F',
          border: '1px solid rgba(255, 255, 255, 0.11)',
          borderRadius: 20,
          boxShadow: '0 28px 72px rgba(0, 0, 0, 0.68)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: '#F4F4F5',
        }}
      >
        {/* Minimal Header */}
        <div
          style={{
            padding: '18px 22px 14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <KiboLogoIcon size={28} />
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.015em' }}>
                Kibo Setup
              </div>
              <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500 }}>
                Step {step + 1} of 3
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {[0, 1, 2].map((idx) => (
                <span
                  key={idx}
                  style={{
                    width: idx === step ? 20 : 6,
                    height: 5,
                    borderRadius: 999,
                    background:
                      idx === step
                        ? '#F4F4F5'
                        : idx < step
                        ? 'rgba(244, 244, 245, 0.42)'
                        : 'rgba(255, 255, 255, 0.12)',
                    transition: 'width 0.2s ease, background 0.2s ease',
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleMinimize}
              title="Minimize Kibo to taskbar"
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#A1A1AA',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                lineHeight: 1,
                padding: 0,
              }}
            >
              &#x2212;
            </button>
          </div>
        </div>

        {/* Step Body */}
        <div style={{ padding: '22px 24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {step === 0 && (
            <>
              <div>
                <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>
                  Activate your license
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: '#A1A1AA', lineHeight: 1.5 }}>
                  Enter your checkout email and Polar license key to unlock Kibo Founders Edition.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  type="email"
                  value={licenseEmail}
                  onChange={(e) => setLicenseEmail(e.target.value)}
                  placeholder="Purchase email (e.g. you@gmail.com)"
                  style={inputStyle}
                />
                <input
                  type="text"
                  value={licenseCode}
                  onChange={(e) => setLicenseCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleVerifyLicense();
                  }}
                  placeholder="License Key (e.g. KIBO-XXXX-XXXX)"
                  style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5 }}
                />
              </div>

              {licenseError && (
                <div
                  style={{
                    fontSize: 12,
                    color: '#FCA5A5',
                    background: 'rgba(239, 68, 68, 0.10)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: 9,
                    padding: '8px 11px',
                    lineHeight: 1.45,
                  }}
                >
                  {licenseError}
                </div>
              )}

              {licenseVerified && (
                <div
                  style={{
                    fontSize: 12,
                    color: '#6EE7B7',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.28)',
                    borderRadius: 9,
                    padding: '8px 11px',
                  }}
                >
                  License verified. Continuing...
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={() => openExternalAndMinimize('https://kiboai.vercel.app/buy')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#A1A1AA',
                    fontSize: 12,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Need a key? Get Kibo ($8)
                </button>

                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={handleVerifyLicense}
                  style={{ ...primaryBtn, opacity: isVerifying ? 0.65 : 1 }}
                >
                  {isVerifying ? 'Verifying...' : 'Verify & Continue'}
                </button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>
                  Connect your Gemini API key
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: '#A1A1AA', lineHeight: 1.5 }}>
                  Kibo runs local-first with your personal free Google AI Studio key. Stored strictly on your PC.
                </p>
              </div>

              <button
                type="button"
                onClick={() => openExternalAndMinimize('https://aistudio.google.com/app/apikey')}
                style={{ ...secondaryBtn, width: '100%', justifyContent: 'space-between', padding: '0 14px' }}
              >
                <span>Open Google AI Studio to copy key</span>
                <span style={{ color: '#8E8E93', fontSize: 12 }}>Minimizes Kibo &#x2197;</span>
              </button>

              <input
                type="password"
                value={localGeminiKey}
                onChange={(e) => setLocalGeminiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveGeminiAndNext();
                }}
                placeholder="Paste key (AIzaSy...)"
                style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5 }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#8E8E93',
                    fontSize: 12.5,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Skip for now
                </button>
                <button type="button" onClick={handleSaveGeminiAndNext} style={primaryBtn}>
                  {localGeminiKey.trim() ? 'Save & Continue' : 'Continue'}
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>
                  Pick your notch style
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: '#A1A1AA', lineHeight: 1.5 }}>
                  You can switch styles, frosted glass, and shortcuts anytime in Settings.
                </p>
              </div>

              {/* 2-Card Minimal Style Picker */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {(
                  [
                    { id: 'classic', title: 'Classic Bezel', sub: 'Docked flush to top edge' },
                    { id: 'floating', title: 'Floating Island', sub: 'Detached frosted capsule' },
                  ] as const
                ).map((item) => {
                  const selected = notchStyle === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectStyle(item.id)}
                      style={{
                        background: selected ? 'rgba(255, 255, 255, 0.08)' : '#232329',
                        border: selected ? '1.5px solid #F4F4F5' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 12,
                        padding: 10,
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: 46,
                          borderRadius: 8,
                          background: 'linear-gradient(180deg, #1F2028 0%, #14151B 100%)',
                          border: '1px solid rgba(255, 255, 255, 0.07)',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'flex-start',
                          overflow: 'hidden',
                        }}
                      >
                        {item.id === 'classic' ? (
                          <div
                            style={{
                              width: 84,
                              height: 15,
                              background: '#0A0A0D',
                              borderBottomLeftRadius: 8,
                              borderBottomRightRadius: 8,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <span style={{ width: 24, height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.22)' }} />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: 84,
                              height: 16,
                              marginTop: 7,
                              background: '#0B0C10',
                              borderRadius: 999,
                              border: '1px solid rgba(255, 255, 255, 0.16)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <span style={{ width: 24, height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.22)' }} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#FFFFFF' }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: '#8E8E93', marginTop: 1 }}>{item.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Frosted Glass Toggle Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 11,
                  background: '#232329',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                }}
              >
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#F4F4F5' }}>Real-Time Frosted Glass</div>
                  <div style={{ fontSize: 11, color: '#8E8E93' }}>Soft Gaussian backdrop blur behind the notch</div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleGlass}
                  style={{
                    width: 38,
                    height: 22,
                    borderRadius: 999,
                    border: 'none',
                    background: glassEnabled ? '#30D158' : '#3A3A40',
                    position: 'relative',
                    cursor: 'pointer',
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: glassEnabled ? 18 : 2,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      transition: 'left 0.16s ease',
                    }}
                  />
                </button>
              </div>

              {/* Compact 3-Shortcut Cheat Sheet */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 6,
                }}
              >
                {[
                  { keys: customShortcuts.ask || 'Win + Alt', label: 'Ask Kibo' },
                  { keys: customShortcuts.dictate || 'Ctrl + Win', label: 'Dictate' },
                  { keys: customShortcuts.lasso || 'Ctrl + Shift', label: 'Circle to Ask' },
                ].map((sc) => (
                  <div
                    key={sc.label}
                    style={{
                      padding: '8px 8px',
                      borderRadius: 9,
                      background: 'rgba(255, 255, 255, 0.035)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#F4F4F5', fontFamily: 'JetBrains Mono, monospace' }}>
                      {sc.keys}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#8E8E93', marginTop: 2 }}>{sc.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
                <button type="button" onClick={() => setStep(1)} style={secondaryBtn}>
                  Back
                </button>
                <button type="button" onClick={handleFinish} style={primaryBtn}>
                  Start Kibo
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
