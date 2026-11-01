// src/pages/PrivacyPolicyPage.tsx
import React from 'react';
import { WebHeader } from '../components/WebHeader';
import { WebFooter } from '../components/WebFooter';

interface PrivacyPolicyPageProps {
  onNavigate: (route: string, anchor?: string) => void;
}

export const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({ onNavigate }) => {
  return (
    <div className="kibo-web-root">
      <WebHeader currentRoute="privacy" onNavigate={onNavigate} />

      <main className="kibo-web-container" style={{ padding: '64px 20px 96px', maxWidth: 800 }}>
        <div style={{ marginBottom: 36 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#68707C' }}>
            Privacy & Trust
          </span>
          <h1
            style={{
              fontSize: 'clamp(30px, 4vw, 42px)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#121316',
              margin: '8px 0 12px',
            }}
          >
            Privacy Policy
          </h1>
          <p style={{ fontSize: 13, color: '#68707C', margin: 0 }}>
            Last revised: November 1, 2026 · Committed to zero remote telemetry and local-first execution
          </p>
        </div>

        <div className="kibo-card" style={{ padding: '32px 28px', fontSize: 14, lineHeight: 1.7, color: '#374151' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#121316', margin: '0 0 12px' }}>
            1. Fundamental Privacy Principle: Local-First
          </h2>
          <p style={{ margin: '0 0 16px' }}>
            Kibo was architected with the conviction that your desktop workstation is strictly personal. We do not operate tracking servers, telemetry trackers, keystroke loggers, or behavioral advertising analytics inside the Kibo desktop runtime.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#121316', margin: '24px 0 12px' }}>
            2. Data Handled by the Desktop Application
          </h2>
          <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
            <li>
              <strong>Microphone Audio</strong>: When you press your voice hotkey (Win + Alt), audio is sampled locally. Voice Activity Detection (VAD) runs in memory. Audio frames are streamed directly to your configured Gemini Live session. Kibo does not record or retain voice audio to disk after the session completes.
            </li>
            <li>
              <strong>Screen Vision &amp; Screenshots</strong>: When you trigger Circle-to-Ask (Ctrl + Shift), only the explicit bounding rectangle you draw on screen is captured. The cropped pixel buffer is sent directly to your Gemini API endpoint and discarded from local memory immediately after response generation.
            </li>
            <li>
              <strong>API Keys &amp; Credentials</strong>: Your Google Gemini API key and third-party integration tokens are encrypted on your local machine using the Windows Data Protection API (DPAPI / Windows Credential Locker). Keys are never transmitted to Kibo or any intermediate proxy.
            </li>
          </ul>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#121316', margin: '24px 0 12px' }}>
            3. Purchase &amp; Financial Information
          </h2>
          <p style={{ margin: '0 0 16px' }}>
            All payment transactions for Founders Edition licenses are processed exclusively by Merchant of Record partners (including Lemon Squeezy). Payment details, including credit card numbers, billing addresses, and tax identifiers, are handled in secure PCI-DSS compliant environments. Kibo never receives, stores, or has access to your raw payment card credentials.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#121316', margin: '24px 0 12px' }}>
            4. Customer Email &amp; License Validation
          </h2>
          <p style={{ margin: '0 0 16px' }}>
            We store only your order delivery email address and associated license key to enable software activation, update delivery, and license recovery via the Customer Portal. We never sell, rent, or trade your email address with marketing agencies or third parties.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#121316', margin: '24px 0 12px' }}>
            5. Your Rights &amp; Data Erasure
          </h2>
          <p style={{ margin: 0 }}>
            Under applicable data protection frameworks (including GDPR and CCPA), you have the right to request access to your stored license record or request deletion of your order contact history from our license verification register. Contact our team via the Contact &amp; Grievances page to submit a request.
          </p>
        </div>
      </main>

      <WebFooter onNavigate={onNavigate} />
    </div>
  );
};
