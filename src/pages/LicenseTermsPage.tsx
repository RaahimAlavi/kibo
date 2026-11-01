// src/pages/LicenseTermsPage.tsx
import React from 'react';
import { WebHeader } from '../components/WebHeader';
import { WebFooter } from '../components/WebFooter';

interface LicenseTermsPageProps {
  onNavigate: (route: string, anchor?: string) => void;
}

export const LicenseTermsPage: React.FC<LicenseTermsPageProps> = ({ onNavigate }) => {
  return (
    <div className="kibo-web-root">
      <WebHeader currentRoute="terms" onNavigate={onNavigate} />

      <main className="kibo-web-container" style={{ padding: '64px 20px 96px', maxWidth: 800 }}>
        <div style={{ marginBottom: 36 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#68707C' }}>
            Legal Documentation
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
            End User Licence Terms & Agreement
          </h1>
          <p style={{ fontSize: 13, color: '#68707C', margin: 0 }}>
            Last revised: November 1, 2026 · Effective immediately for all Founders Edition license holders
          </p>
        </div>

        <div className="kibo-card" style={{ padding: '32px 28px', fontSize: 14, lineHeight: 1.7, color: '#374151' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#121316', margin: '0 0 12px' }}>
            1. Grant of Licence
          </h2>
          <p style={{ margin: '0 0 16px' }}>
            Subject to your compliance with these terms and payment of the applicable one-time fee, Raahim Alavi (the "Licensor") grants you (the "Licensee") a non-exclusive, non-transferable, revocable, perpetual licence to install and execute the Kibo Founders Edition executable solely for your direct personal or internal commercial productivity across any personal Windows computer workstations owned or operated by you under your registered purchase email account.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#121316', margin: '24px 0 12px' }}>
            2. Proprietary Rights & Restrictions
          </h2>
          <p style={{ margin: '0 0 12px' }}>
            Kibo and its companion software, UI architecture, visual assets, icons, shaders, and compiled binary runtimes are the proprietary intellectual property of the Licensor. You agree that you shall not:
          </p>
          <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
            <li>Decompile, disassemble, reverse engineer, or decrypt the executable or companion scripts;</li>
            <li>Distribute, lease, sublicense, resell, or transfer your license token or installation media to third parties;</li>
            <li>Modify, adapt, or create derivative works from the application binary or its proprietary desktop UI framework;</li>
            <li>Bypass, alter, or tamper with license authentication or verification protocols.</li>
          </ul>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#121316', margin: '24px 0 12px' }}>
            3. Artificial Intelligence & Third-Party APIs
          </h2>
          <p style={{ margin: '0 0 16px' }}>
            Kibo integrates with the Google Gemini API using a Bring Your Own Key (BYOK) model. You acknowledge that AI model availability, rate limits, token allowances, and response characteristics are subject to Google LLC's terms of service. Licensor makes no representations or guarantees regarding the uptime, accuracy, or uninterrupted continuation of third-party AI services.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#121316', margin: '24px 0 12px' }}>
            4. Updates & Maintenance
          </h2>
          <p style={{ margin: '0 0 16px' }}>
            Founders Edition licenses entitle the Licensee to all future minor and maintenance releases within the Founders Edition product line. Major architectural shifts or distinct subsequent product suites outside the Founders Edition scope may be offered under separate terms.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#121316', margin: '24px 0 12px' }}>
            5. Disclaimer of Warranties & Limitation of Liability
          </h2>
          <p style={{ margin: '0 0 16px' }}>
            THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL THE LICENSOR BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#121316', margin: '24px 0 12px' }}>
            6. Governing Law & Dispute Resolution
          </h2>
          <p style={{ margin: 0 }}>
            These terms shall be governed by and construed in accordance with applicable laws. In the event of any disputes, parties agree to first seek amicable informal resolution through the Grievance mechanism described on the Contact & Grievances page.
          </p>
        </div>
      </main>

      <WebFooter onNavigate={onNavigate} />
    </div>
  );
};
