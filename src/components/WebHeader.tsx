// src/components/WebHeader.tsx
import React from 'react';
import { SoulCanvas } from './SoulCanvas';
import { SOUL_SKINS } from '../lib/soulMath';

export const WindowsLogoIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
    <path d="M0 2.263L6.545 1.37v6.236H0V2.263zm0 5.942h6.545v6.257L0 13.568V8.205zm7.364-6.953L16 0v7.606H7.364V1.252zm0 6.953H16v7.618l-8.636-1.229V8.205z"/>
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
          <a
            href="/access"
            onClick={(e) => handleLink(e, 'access')}
            className={`kibo-web-link ${currentRoute === 'access' ? 'active' : ''}`}
          >
            Customer Portal
          </a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
              Get Founders Edition · $8
            </a>
          )}
        </div>
      </div>
    </header>
  );
};
