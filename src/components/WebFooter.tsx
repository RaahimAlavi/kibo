// src/components/WebFooter.tsx
import React from 'react';

interface WebFooterProps {
  onNavigate: (route: string, anchor?: string) => void;
  onScrollToTop?: (e: React.MouseEvent) => void;
}

export const WebFooter: React.FC<WebFooterProps> = ({ onNavigate, onScrollToTop }) => {
  const handleLink = (e: React.MouseEvent, route: string, anchor?: string) => {
    e.preventDefault();
    onNavigate(route, anchor);
  };

  const handleTop = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onScrollToTop) {
      onScrollToTop(e);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className="kibo-web-footer">
      <div className="kibo-web-container" style={{ paddingBottom: 48 }}>
        <div className="kibo-footer-grid">
          {/* Brand Info */}
          <div style={{ maxWidth: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: '#121316' }}>
                Kibo
              </span>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(18, 19, 22, 0.06)',
                  color: '#68707C',
                  fontWeight: 600,
                }}
              >
                Founders Edition
              </span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: '#68707C', margin: 0 }}>
              Ambient top bezel companion for Windows 10 & 11. Run computer actions, dictation, screen vision, and background workers with zero window switching.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#121316', margin: '0 0 14px', letterSpacing: '-0.01em' }}>
              Product
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="/#how-it-works" onClick={(e) => handleLink(e, 'home', 'how-it-works')} className="kibo-footer-link">
                How it works
              </a>
              <a href="/#workspace" onClick={(e) => handleLink(e, 'home', 'workspace')} className="kibo-footer-link">
                Notch Workspace
              </a>
              <a href="/#faq" onClick={(e) => handleLink(e, 'home', 'faq')} className="kibo-footer-link">
                FAQ
              </a>
              <a href="/requirements" onClick={(e) => handleLink(e, 'requirements')} className="kibo-footer-link">
                System Requirements
              </a>
            </div>
          </div>

          {/* Customer & Orders */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#121316', margin: '0 0 14px', letterSpacing: '-0.01em' }}>
              Orders & Access
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="/buy" onClick={(e) => handleLink(e, 'buy')} className="kibo-footer-link">
                Founders Edition ($8)
              </a>
              <a href="/access" onClick={(e) => handleLink(e, 'access')} className="kibo-footer-link">
                Customer Portal
              </a>
              <a href="/access" onClick={(e) => handleLink(e, 'access')} className="kibo-footer-link">
                License Verification
              </a>
            </div>
          </div>

          {/* Legal Links */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#121316', margin: '0 0 14px', letterSpacing: '-0.01em' }}>
              Legal
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="/terms" onClick={(e) => handleLink(e, 'terms')} className="kibo-footer-link">
                Licence terms
              </a>
              <a href="/privacy" onClick={(e) => handleLink(e, 'privacy')} className="kibo-footer-link">
                Privacy
              </a>
              <a href="/refunds" onClick={(e) => handleLink(e, 'refunds')} className="kibo-footer-link">
                Refunds
              </a>
              <a href="/contact" onClick={(e) => handleLink(e, 'contact')} className="kibo-footer-link">
                Contact & grievances
              </a>
            </div>
          </div>
        </div>

        {/* Trademark & Brand Notice */}
        <div
          style={{
            marginTop: 36,
            paddingTop: 20,
            borderTop: '1px solid rgba(18, 19, 22, 0.06)',
            fontSize: 11.5,
            lineHeight: 1.6,
            color: '#8A92A0',
          }}
        >
          <strong>Notice of Trademarks and Non-Affiliation:</strong> Windows, Google, Gemini, Chrome, Gmail, YouTube, Spotify, Amazon, and Netflix are registered trademarks and property of their respective copyright holders. Kibo is an independent ambient software companion developed by Kibo Labs and operates without direct affiliation, partnership, sponsorship, or commercial endorsement from these organizations.
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 20,
            borderTop: '1px solid rgba(18, 19, 22, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            fontSize: 13,
            color: '#68707C',
          }}
        >
          <div>
            Designed & built by <strong style={{ color: '#121316', fontWeight: 700 }}>Raahim Alavi</strong>. All rights reserved.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <span>Built for Windows 10 & 11</span>
            <button
              onClick={handleTop}
              className="kibo-footer-top-btn"
              title="Scroll to top"
            >
              Back to top
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
