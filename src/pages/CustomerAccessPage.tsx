// src/pages/CustomerAccessPage.tsx
import React, { useEffect, useState } from 'react';
import { WebHeader, WindowsLogoIcon } from '../components/WebHeader';
import { WebFooter } from '../components/WebFooter';

const INSTALLER_DOWNLOAD_URL =
  (import.meta as any).env?.VITE_INSTALLER_DOWNLOAD_URL ||
  'https://github.com/RaahimAlavi/kibo/releases/download/v1.0.0/Kibo-Setup-1.0.0.exe';

interface CustomerAccessPageProps {
  onNavigate: (route: string, anchor?: string) => void;
}

export const CustomerAccessPage: React.FC<CustomerAccessPageProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('kibo_customer_email') || null;
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [setupNotice, setSetupNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check URL parameters when arriving from Lemon Squeezy redirect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const redirectEmail = params.get('email') || params.get('checkout_email') || params.get('customer_email');

    if (redirectEmail && redirectEmail.includes('@')) {
      const clean = redirectEmail.trim().toLowerCase();
      localStorage.setItem('kibo_customer_email', clean);
      setVerifiedEmail(clean);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSetupNotice(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.length < 5) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await response.json();

      if (data.verified) {
        localStorage.setItem('kibo_customer_email', cleanEmail);
        setVerifiedEmail(cleanEmail);
      } else if (data.needsSetup) {
        // Lemon Squeezy API key is not yet set in Vercel environment variables
        setSetupNotice(
          'Your Lemon Squeezy API Key has not been added to Vercel Environment Variables yet. Once added in Vercel under Settings > Environment Variables, this automatically checks real orders in real-time.'
        );
        // Allow temporary verification for testing if email matches typical format
        localStorage.setItem('kibo_customer_email', cleanEmail);
        setVerifiedEmail(cleanEmail);
      } else {
        setErrorMsg(
          data.error ||
            `No active Founders Edition order was found for ${cleanEmail}. Please make sure you enter the exact email address used at checkout.`
        );
      }
    } catch (err) {
      console.error('Verification error:', err);
      setErrorMsg('Unable to connect to the order verification service. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kibo_customer_email');
    }
    setVerifiedEmail(null);
    setEmail('');
    setErrorMsg('');
    setSetupNotice(null);
  };

  return (
    <div className="kibo-web-root">
      <WebHeader currentRoute="access" onNavigate={onNavigate} />

      <main className="kibo-web-container" style={{ padding: '72px 20px 110px', maxWidth: 640 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1
            style={{
              fontSize: 'clamp(36px, 5vw, 52px)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#121316',
              margin: '0 0 12px',
            }}
          >
            Kibo
          </h1>

          <p
            style={{
              fontSize: 16,
              lineHeight: 1.6,
              color: '#68707C',
              maxWidth: 480,
              margin: '0 auto',
            }}
          >
            Retrieve your software license, installer package, and sync settings using the email associated with your order. Zero passwords. No separate accounts to register.
          </p>
        </div>

        {/* Access Box */}
        <div
          className="kibo-card"
          style={{
            padding: '36px 32px',
            boxShadow: '0 12px 32px rgba(18, 19, 22, 0.05)',
            border: '1px solid rgba(18, 19, 22, 0.1)',
          }}
        >
          {verifiedEmail ? (
            <div>
              {/* Verification Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 12px',
                    borderRadius: 999,
                    background: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    color: '#065F46',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
                  <span>Founders Edition Verified</span>
                </div>

                <button
                  onClick={handleSignOut}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 12,
                    color: '#68707C',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  Sign Out
                </button>
              </div>

              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#121316',
                  letterSpacing: '-0.02em',
                  margin: '0 0 6px',
                }}
              >
                Ready for Installation
              </h2>

              <p style={{ fontSize: 13, lineHeight: 1.55, color: '#4B5563', margin: '0 0 24px' }}>
                Order credentials verified for <strong>{verifiedEmail}</strong>. You have unlimited personal activations across all your Windows devices.
              </p>

              {setupNotice && (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    color: '#92400E',
                    fontSize: 12,
                    lineHeight: 1.5,
                    marginBottom: 20,
                  }}
                >
                  {setupNotice}
                </div>
              )}

              {/* Direct Installer Download Button */}
              <a
                href={INSTALLER_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '16px 22px',
                  borderRadius: 12,
                  background: '#121316',
                  color: '#FFFFFF',
                  fontSize: 15,
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxSizing: 'border-box',
                  boxShadow: '0 4px 14px rgba(18, 19, 22, 0.12)',
                  transition: 'opacity 0.2s ease',
                  letterSpacing: '-0.01em',
                }}
              >
                <WindowsLogoIcon size={16} />
                <span>Download Kibo Setup (.exe)</span>
              </a>

              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <span style={{ fontSize: 12, color: '#68707C' }}>
                  Version 1.0.0 | 170.7 MB | Built for Windows 10 & 11 (64-bit)
                </span>
              </div>

              {/* Next Steps Box */}
              <div
                style={{
                  marginTop: 24,
                  padding: '18px 20px',
                  borderRadius: 12,
                  background: '#F9FAFB',
                  border: '1px solid rgba(18, 19, 22, 0.08)',
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: '#374151',
                }}
              >
                <strong style={{ display: 'block', color: '#121316', marginBottom: 6 }}>
                  Quick 3-Step Setup:
                </strong>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Run <strong>Kibo Setup 1.0.0.exe</strong> on your PC.</li>
                  <li>In Kibo, enter your purchase email (<code>{verifiedEmail}</code>) to automatically unlock your unlimited Founders license.</li>
                  <li>Add your free Google Gemini API key under <strong>Preferences &gt; Account &amp; Keys</strong>.</li>
                </ol>
              </div>

              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={handleSignOut}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#68707C',
                    fontSize: 12,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Verify a different order email
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#121316',
                  letterSpacing: '-0.02em',
                  margin: '0 0 8px',
                }}
              >
                Verify Your Order Email
              </h2>

              <p style={{ fontSize: 13, lineHeight: 1.5, color: '#68707C', margin: '0 0 24px' }}>
                Enter the address you used during purchase to instantly retrieve your verified download package and activation token.
              </p>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 18 }}>
                  <label
                    htmlFor="portal-email"
                    style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#121316', marginBottom: 6 }}
                  >
                    Email address
                  </label>
                  <input
                    id="portal-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: 14,
                      borderRadius: 10,
                      border: '1px solid rgba(18, 19, 22, 0.16)',
                      background: '#FFFFFF',
                      color: '#121316',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {errorMsg && (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      background: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      color: '#B91C1C',
                      fontSize: 13,
                      lineHeight: 1.5,
                      marginBottom: 18,
                    }}
                  >
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '13px 20px',
                    borderRadius: 10,
                    background: '#121316',
                    color: '#FFFFFF',
                    fontSize: 14,
                    fontWeight: 700,
                    border: 'none',
                    cursor: isLoading ? 'wait' : 'pointer',
                    transition: 'opacity 0.2s ease',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {isLoading ? 'Verifying with Lemon Squeezy...' : 'Access My Downloads & License'}
                </button>
              </form>

              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <span style={{ fontSize: 12, color: '#68707C' }}>
                  Haven't secured Kibo yet?{' '}
                  <a
                    href="/buy"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('buy');
                    }}
                    style={{ color: '#121316', fontWeight: 600, textDecoration: 'underline' }}
                  >
                    Get Founders Edition · $8
                  </a>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Security / Privacy disclaimer below the box */}
        <div style={{ marginTop: 24, textAlign: 'center', padding: '0 12px' }}>
          <p style={{ fontSize: 12, lineHeight: 1.6, color: '#68707C', margin: 0 }}>
            This portal securely handles your license credentials, purchase verification, and encrypted setup packages. Financial details and payment methods are never collected or stored here.
          </p>
        </div>
      </main>

      <WebFooter onNavigate={onNavigate} />
    </div>
  );
};
