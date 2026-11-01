// src/pages/ContactGrievancesPage.tsx
import React, { useState } from 'react';
import { WebHeader } from '../components/WebHeader';
import { WebFooter } from '../components/WebFooter';

interface ContactGrievancesPageProps {
  onNavigate: (route: string, anchor?: string) => void;
}

export const ContactGrievancesPage: React.FC<ContactGrievancesPageProps> = ({ onNavigate }) => {
  const [formData, setFormData] = useState({ name: '', email: '', subject: 'General Support', message: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim() || !formData.message.trim()) return;

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSent(true);
    }, 600);
  };

  return (
    <div className="kibo-web-root">
      <WebHeader currentRoute="contact" onNavigate={onNavigate} />

      <main className="kibo-web-container" style={{ padding: '64px 20px 96px', maxWidth: 800 }}>
        <div style={{ marginBottom: 36 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#68707C' }}>
            Customer Support & Legal Inquiries
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
            Contact &amp; Grievance Redressal
          </h1>
          <p style={{ fontSize: 13, color: '#68707C', margin: 0 }}>
            Direct channels for technical assistance, order verification, licensing questions, and regulatory grievances.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {/* Contact Details Card */}
          <div className="kibo-card" style={{ padding: 28, fontSize: 14, lineHeight: 1.6, color: '#374151' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#121316', margin: '0 0 16px' }}>
              Direct Support Channels
            </h2>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#68707C', textTransform: 'uppercase' }}>
                Technical &amp; License Support
              </div>
              <a href="mailto:support@kiboai.com" style={{ fontSize: 15, fontWeight: 700, color: '#121316', textDecoration: 'none' }}>
                support@kiboai.com
              </a>
              <div style={{ fontSize: 12, color: '#68707C', marginTop: 2 }}>
                Typical response window: 24 to 48 hours (Monday – Friday)
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#68707C', textTransform: 'uppercase' }}>
                Founder &amp; Principal Inquiries
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#121316' }}>
                Raahim Alavi
              </div>
              <div style={{ fontSize: 13, color: '#68707C' }}>
                Founder &amp; Lead Systems Engineer
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(18, 19, 22, 0.08)', paddingTop: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#121316', margin: '0 0 8px' }}>
                Grievance Officer Mechanism
              </h3>
              <p style={{ fontSize: 12, lineHeight: 1.55, color: '#68707C', margin: 0 }}>
                In accordance with consumer digital protection standards, any formal dispute, consumer grievance, or unresolved escalation regarding software performance or billing must be routed with the subject tag <strong>[FORMAL GRIEVANCE]</strong> to ensure priority handling.
              </p>
            </div>
          </div>

          {/* Contact Message Form */}
          <div className="kibo-card" style={{ padding: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#121316', margin: '0 0 16px' }}>
              Dispatch a Message
            </h2>

            {sent ? (
              <div
                style={{
                  padding: 20,
                  borderRadius: 12,
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  color: '#166534',
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Inquiry Received</div>
                <div>
                  Thank you for reaching out. Your inquiry has been routed to our technical support desk. We will respond to <strong>{formData.email}</strong> within 24 to 48 hours.
                </div>
                <div style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSent(false);
                      setFormData({ name: '', email: '', subject: 'General Support', message: '' });
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid #166534',
                      color: '#166534',
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Send another message
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#121316', marginBottom: 4 }}>
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="First and last name"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 13,
                      borderRadius: 8,
                      border: '1px solid rgba(18, 19, 22, 0.16)',
                      background: '#FFFFFF',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#121316', marginBottom: 4 }}>
                    Purchase / Contact Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@example.com"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 13,
                      borderRadius: 8,
                      border: '1px solid rgba(18, 19, 22, 0.16)',
                      background: '#FFFFFF',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#121316', marginBottom: 4 }}>
                    Category
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 13,
                      borderRadius: 8,
                      border: '1px solid rgba(18, 19, 22, 0.16)',
                      background: '#FFFFFF',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="General Support">General Support</option>
                    <option value="Order & License Delivery">Order &amp; License Delivery</option>
                    <option value="Technical Bug / Incompatibility">Technical Bug / Incompatibility</option>
                    <option value="Refund Resolution Request">Refund Resolution Request</option>
                    <option value="Formal Grievance">Formal Grievance</option>
                  </select>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#121316', marginBottom: 4 }}>
                    Message Details
                  </label>
                  <textarea
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Describe your issue or inquiry with diagnostic specifics if applicable..."
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 13,
                      borderRadius: 8,
                      border: '1px solid rgba(18, 19, 22, 0.16)',
                      background: '#FFFFFF',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px 18px',
                    borderRadius: 10,
                    background: '#121316',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 700,
                    border: 'none',
                    cursor: loading ? 'wait' : 'pointer',
                  }}
                >
                  {loading ? 'Submitting...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <WebFooter onNavigate={onNavigate} />
    </div>
  );
};
