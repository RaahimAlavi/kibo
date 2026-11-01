// src/pages/RefundPolicyPage.tsx
import React from 'react';
import { WebHeader } from '../components/WebHeader';
import { WebFooter } from '../components/WebFooter';

interface RefundPolicyPageProps {
  onNavigate: (route: string, anchor?: string) => void;
}

export const RefundPolicyPage: React.FC<RefundPolicyPageProps> = ({ onNavigate }) => {
  return (
    <div className="kibo-web-root">
      <WebHeader currentRoute="refunds" onNavigate={onNavigate} />

      <main className="kibo-web-container" style={{ padding: '64px 20px 96px', maxWidth: 800 }}>
        <div style={{ marginBottom: 36 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#68707C' }}>
            Customer Assurance
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
            Refund & Cancellation Policy
          </h1>
          <p style={{ fontSize: 13, color: '#68707C', margin: 0 }}>
            Last revised: November 1, 2026 · Transparent terms for digital software delivery
          </p>
        </div>

        <div className="kibo-card" style={{ padding: '32px 28px', fontSize: 14, lineHeight: 1.7, color: '#374151' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#121316', margin: '0 0 12px' }}>
            1. Nature of Digital Goods & Statutory Withdrawal Waiver
          </h2>
          <p style={{ margin: '0 0 16px' }}>
            Kibo Founders Edition is a digitally fulfilled software download. Upon completion of checkout, your personalized license key and binary installer are generated and made available immediately. Pursuant to international consumer protection regulations for intangible digital content, you explicitly acknowledge and agree that your statutory right of cancellation or withdrawal terminates the moment file download or license activation commences.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#121316', margin: '24px 0 12px' }}>
            2. Our 14-Day Technical Resolution Guarantee
          </h2>
          <p style={{ margin: '0 0 12px' }}>
            We stand firmly behind the technical quality of Kibo. If you experience an irrecoverable technical defect on a supported Windows machine—such as a failure to launch, fatal crash on startup, or corrupt installation—you are protected under our 14-Day Technical Resolution Guarantee:
          </p>
          <ol style={{ margin: '0 0 16px', paddingLeft: 20 }}>
            <li>Contact support within 14 days of your purchase date detailing the failure and providing the diagnostic log file.</li>
            <li>Our engineering team will work directly with you to resolve the incompatibility within seven (7) business days.</li>
            <li>If our team is unable to remediate the defect on your compatible Windows setup within this window, a full 100% refund will be granted promptly.</li>
          </ol>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#121316', margin: '24px 0 12px' }}>
            3. Non-Eligible Refund Circumstances
          </h2>
          <p style={{ margin: '0 0 12px' }}>
            Refunds cannot be issued under the following scenarios:
          </p>
          <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
            <li>Attempting to install or execute Kibo on unsupported operating systems (including macOS, Linux, or mobile platforms);</li>
            <li>Failure to review system requirements outlined on our System Requirements page;</li>
            <li>Refusal to obtain a free Google Gemini API key or dissatisfaction with Google LLC's third-party AI rate limits;</li>
            <li>General change of mind or buyer's remorse after receiving and activating the software;</li>
            <li>Purchase abuse or claims originating more than 14 days following order completion.</li>
          </ul>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#121316', margin: '24px 0 12px' }}>
            4. How to Submit a Refund Request
          </h2>
          <p style={{ margin: 0 }}>
            To submit an inquiry under the Technical Resolution Guarantee, please email our support address at <strong style={{ color: '#121316' }}>support@kiboai.com</strong> (or submit a message via the Contact &amp; Grievances page) including your purchase email address, order reference number, and Windows version details.
          </p>
        </div>
      </main>

      <WebFooter onNavigate={onNavigate} />
    </div>
  );
};
