// src/pages/CustomerAccessPage.tsx
import React, { useState } from 'react';
import { WebHeader } from '../components/WebHeader';
import { WebFooter } from '../components/WebFooter';

interface CustomerAccessPageProps {
  onNavigate: (route: string, anchor?: string) => void;
}

export const CustomerAccessPage: React.FC<CustomerAccessPageProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setSubmitted(true);
    }, 700);
  };

  return (
    <div className="kibo-web-root">
      <WebHeader currentRoute="access" onNavigate={onNavigate} />

      <main className="kibo-web-container" style={{ padding: '80px 20px 110px', maxWidth: 640 }}>
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
            Enter the address you provided during checkout to receive your single-use sign-in token and license details.
          </p>

          {submitted ? (
            <div
              style={{
                padding: '20px',
                borderRadius: 12,
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                color: '#166534',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Access Link Dispatched</div>
              <div>
                If an active Founders license is associated with <strong>{email}</strong>, a secure sign-in token and direct download link have been delivered to your inbox.
              </div>
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setEmail('');
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid #166534',
                    color: '#166534',
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
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
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    color: '#B91C1C',
                    fontSize: 12,
                    marginBottom: 16,
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
                {isLoading ? 'Verifying...' : 'Request Access Code'}
              </button>
            </form>
          )}

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

        {/* Security / Privacy disclaimer below the box */}
        <div style={{ marginTop: 24, textAlign: 'center', padding: '0 12px' }}>
          <p style={{ fontSize: 12, lineHeight: 1.6, color: '#68707C', margin: 0 }}>
            This portal securely handles your license token, purchase records, and encrypted settings sync. Financial details and payment methods are never collected or stored here.
          </p>
        </div>
      </main>

      <WebFooter onNavigate={onNavigate} />
    </div>
  );
};
