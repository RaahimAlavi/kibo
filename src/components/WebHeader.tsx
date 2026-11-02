// src/components/WebHeader.tsx
import React from 'react';
import { SoulCanvas } from './SoulCanvas';
import { SOUL_SKINS } from '../lib/soulMath';

export const WindowsLogoIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
    <path d="M0 2.263L6.545 1.37v6.236H0V2.263zm0 5.942h6.545v6.257L0 13.568V8.205zm7.364-6.953L16 0v7.606H7.364V1.252zm0 6.953H16v7.618l-8.636-1.229V8.205z"/>
  </svg>
);

export const ProfileIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

interface WebHeaderProps {
  currentRoute: string;
  onNavigate: (route: string, anchor?: string) => void;
}

export const WebHeader: React.FC<WebHeaderProps> = ({ currentRoute, onNavigate }) => {
  const handleBrandClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate('home');
  };

  const handleLink = (e: React.MouseEvent, route: string, anchor?: string) => {
    e.preventDefault();
    onNavigate(route, anchor);
  };

  return (
    <header className="kibo-web-nav">
      <div className="kibo-web-nav-inner">
        <a href="/" onClick={handleBrandClick} className="kibo-web-brand" title="Kibo Home">
          <SoulCanvas
            soul={SOUL_SKINS[0]}
            width={32}
            height={28}
            scale={0.75}
            mode="LISTENING"
            interactive={false}
          />
          <span>Kibo</span>
        </a>

        <nav className="kibo-web-links">
          <a
            href="/#how-it-works"
            onClick={(e) => handleLink(e, 'home', 'how-it-works')}
            className={`kibo-web-link ${currentRoute === 'home' ? 'active' : ''}`}
          >
            How it works
          </a>
          <a
            href="/#workspace"
            onClick={(e) => handleLink(e, 'home', 'workspace')}
            className="kibo-web-link"
          >
            Notch Workspace
          </a>
          <a
            href="/requirements"
            onClick={(e) => handleLink(e, 'requirements')}
            className={`kibo-web-link ${currentRoute === 'requirements' ? 'active' : ''}`}
          >
            Requirements
          </a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Profile Icon button linking to Customer Portal */}
          {(() => {
            const hasSavedEmail = typeof window !== 'undefined' && Boolean(localStorage.getItem('kibo_customer_email'));
            return (
              <a
                href="/access"
                onClick={(e) => handleLink(e, 'access')}
                title={hasSavedEmail ? 'Verified Customer Portal' : 'Customer Portal & Downloads'}
                aria-label="Customer Portal"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: currentRoute === 'access' ? 'rgba(18, 19, 22, 0.08)' : 'rgba(18, 19, 22, 0.04)',
                  border: currentRoute === 'access' ? '1px solid rgba(18, 19, 22, 0.25)' : '1px solid rgba(18, 19, 22, 0.08)',
                  color: '#121316',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textDecoration: 'none',
                  position: 'relative',
                }}
              >
                <ProfileIcon size={17} />
                {hasSavedEmail && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#059669',
                      border: '1.5px solid #F7F7F4',
                    }}
                  />
                )}
              </a>
            );
          })()}

          {currentRoute === 'buy' ? (
            <a
              href="/access"
              onClick={(e) => handleLink(e, 'access')}
              className="kibo-web-pill-cta"
              style={{ background: 'transparent', color: '#121316', border: '1px solid rgba(18, 19, 22, 0.15)' }}
            >
              Sign In
            </a>
          ) : (
            <a
              href="/buy"
              onClick={(e) => handleLink(e, 'buy')}
              className="kibo-web-pill-cta"
            >
              <span className="kibo-cta-desktop">Get Founders Edition · $8</span>
              <span className="kibo-cta-mobile">Get Kibo · $8</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
};
