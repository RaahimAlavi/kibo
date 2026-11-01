// src/pages/BuyPage.tsx
import React, { useState } from 'react';
import { WebHeader, WindowsLogoIcon } from '../components/WebHeader';
import { WebFooter } from '../components/WebFooter';

interface BuyPageProps {
  onNavigate: (route: string, anchor?: string) => void;
}

export const BuyPage: React.FC<BuyPageProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState(false);

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address to receive your license.');
      return;
    }
    if (!acceptedTerms) {
      setErrorMsg('Please review and check the agreement box before proceeding.');
      return;
    }

    setIsProcessing(true);
    const cleanEmail = email.trim();
    const checkoutBase = 'https://kiboai.lemonsqueezy.com/checkout/buy/82847c34-2c7d-416f-b407-68371e119df2';
    const finalUrl = cleanEmail
      ? `${checkoutBase}?checkout[email]=${encodeURIComponent(cleanEmail)}`
      : checkoutBase;

    window.location.href = finalUrl;
  };

  return (
    <div className="kibo-web-root">
      <WebHeader currentRoute="buy" onNavigate={onNavigate} />

      <main className="kibo-web-container" style={{ padding: '64px 20px 96px', maxWidth: 840 }}>
        {/* Title & Badge */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
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
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
            <span>Founders Edition · Limited Enrollment</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(32px, 4.5vw, 48px)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#121316',
              lineHeight: 1.15,
              margin: '0 0 16px',
            }}
          >
            Secure Your Founders License
          </h1>

          <p
            style={{
              fontSize: 'clamp(16px, 2vw, 18px)',
              lineHeight: 1.6,
              color: '#68707C',
              maxWidth: 580,
              margin: '0 auto',
            }}
          >
            A single, perpetual acquisition for Windows 10 & 11. Zero recurring fees, zero subscription renewals, and all upcoming Founders updates included.
          </p>
        </div>

        {/* Benefits Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            marginBottom: 40,
          }}
        >
          <div className="kibo-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#121316', marginBottom: 6 }}>
              Zero Recurring Charges
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: '#68707C', margin: 0 }}>
              Pay once today. No monthly dues, no yearly invoices, and no surprise payment prompts down the road.
            </p>
          </div>

          <div className="kibo-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#121316', marginBottom: 6 }}>
              All Founders Updates Included
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: '#68707C', margin: 0 }}>
              Receive every feature enhancement, speed optimization, and capability build within the Founders series at no charge.
            </p>
          </div>

          <div className="kibo-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#121316', marginBottom: 6 }}>
              Direct Gemini API Engine
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: '#68707C', margin: 0 }}>
              Operates using your personal Google Gemini API key. Leverage generous free-tier limits without platform middleman fees.
            </p>
          </div>

          <div className="kibo-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#121316', marginBottom: 6 }}>
              Permanent License Retention
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: '#68707C', margin: 0 }}>
              Your license remains active and valid forever, even after enrollment permanently closes to new public buyers.
            </p>
          </div>
        </div>

        {/* Centered Checkout Card */}
        <div
          className="kibo-card"
          style={{
            maxWidth: 540,
            margin: '0 auto',
            padding: '36px 32px',
            boxShadow: '0 12px 32px rgba(18, 19, 22, 0.06)',
            border: '1px solid rgba(18, 19, 22, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#68707C' }}>
                One-Time Payment
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 38, fontWeight: 800, color: '#121316', letterSpacing: '-0.03em' }}>$8</span>
                <span style={{ fontSize: 14, color: '#68707C' }}>USD · single payment</span>
              </div>
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                background: '#F0F2F5',
                fontSize: 12,
                fontWeight: 600,
                color: '#121316',
              }}
            >
              <WindowsLogoIcon size={12} />
              <span>Windows 10 & 11</span>
            </div>
          </div>

          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#4B5563', margin: '0 0 24px' }}>
            Instant digital fulfillment. Complete your order below to generate your personal license credentials and retrieve the installer.
          </p>

          {checkoutNotice ? (
            <div
              style={{
                padding: 20,
                borderRadius: 14,
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#065F46',
                fontSize: 13,
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Order Gateway Initialized</div>
              <div>
                Checkout configuration confirmed for <strong>{email}</strong>. In production, this connects straight to your Dodo Payments checkout flow to deliver your license token and download link.
              </div>
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setCheckoutNotice(false)}
                  style={{
                    background: '#059669',
                    color: '#FFF',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Edit Details
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCheckout}>
              <div style={{ marginBottom: 18 }}>
                <label
                  htmlFor="checkout-email"
                  style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#121316', marginBottom: 6 }}
                >
                  Delivery email address
                </label>
                <input
                  id="checkout-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
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
                <span style={{ display: 'block', fontSize: 12, lineHeight: 1.5, color: '#68707C', marginTop: 6 }}>
                  Your digital activation key and setup downloads are delivered here. This address cannot be modified during payment.
                </span>
              </div>

              {/* Legal Checkbox */}
              <div style={{ marginBottom: 22 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: '#4B5563',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    style={{ marginTop: 3, flexShrink: 0, cursor: 'pointer' }}
                  />
                  <span>
                    I verify that I am at least 18 years old, request immediate digital dispatch of Kibo, acknowledge that cancellation rights expire once file download or activation commences, and agree to the{' '}
                    <a
                      href="/terms"
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate('terms');
                      }}
                      style={{ color: '#121316', textDecoration: 'underline', fontWeight: 600 }}
                    >
                      Licence terms
                    </a>{' '}
                    and{' '}
                    <a
                      href="/refunds"
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate('refunds');
                      }}
                      style={{ color: '#121316', textDecoration: 'underline', fontWeight: 600 }}
                    >
                      Refund policy
                    </a>.
                  </span>
                </label>
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

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isProcessing}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: 12,
                  background: '#121316',
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 700,
                  border: 'none',
                  cursor: isProcessing ? 'wait' : 'pointer',
                  transition: 'opacity 0.2s ease',
                  letterSpacing: '-0.01em',
                }}
              >
                {isProcessing ? 'Connecting...' : 'Complete Order · $8'}
              </button>
            </form>
          )}

          {/* Payment Gateways & Guarantees */}
          <div
            style={{
              marginTop: 24,
              paddingTop: 18,
              borderTop: '1px solid rgba(18, 19, 22, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 12, lineHeight: 1.5, color: '#68707C', textAlign: 'center' }}>
              Secure checkout powered by Lemon Squeezy. Accepts Credit Cards, Apple Pay, Google Pay, and international payment options.
            </div>

            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 12, color: '#68707C' }}>
                Already completed an order?{' '}
                <a
                  href="/access"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('access');
                  }}
                  style={{ color: '#121316', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Sign in to Customer Access
                </a>
              </span>
            </div>
          </div>
        </div>
      </main>

      <WebFooter onNavigate={onNavigate} />
    </div>
  );
};
