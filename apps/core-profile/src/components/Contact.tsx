import React, { useState } from 'react';
import { Mail, Github, Linkedin, Send, MapPin, Copy, Check, MessageSquare } from 'lucide-react';
import { ContactsInfo } from '../types/profile';

interface ContactProps {
  contacts: ContactsInfo;
}

export const Contact: React.FC<ContactProps> = ({ contacts }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <section id="contact" className="section-padding" style={{ position: 'relative' }}>
      <div className="container">
        {/* Section Header */}
        <div className="section-header">
          <span className="section-tag">Let's Connect</span>
          <h2 className="section-title">Kết Nối & Hợp Tác Kỹ Thuật</h2>
          <p className="section-subtitle">
            Luôn cởi mở trao đổi về các giải pháp Cloud Native, Kubernetes, dự án phần mềm hoặc cơ hội nghề nghiệp.
          </p>
        </div>

        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem',
          }}
          className="contact-grid"
        >
          {/* Card 1: Kênh liên hệ trực tiếp */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Mail size={20} color="var(--neon-cyan)" />
              <span>Liên Hệ Trực Tiếp</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {/* Email item */}
              <div
                style={{
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Email</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {contacts.email}
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(contacts.email, 'email')}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.7rem', fontSize: '0.78rem' }}
                  title="Sao chép email"
                >
                  {copiedKey === 'email' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                </button>
              </div>

              {/* Telegram item */}
              <div
                style={{
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Telegram</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    @tiendat_dev
                  </div>
                </div>
                <a
                  href={contacts.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.7rem', fontSize: '0.78rem' }}
                >
                  <Send size={14} />
                </a>
              </div>

              {/* Location item */}
              <div
                style={{
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.8rem',
                }}
              >
                <MapPin size={20} color="var(--neon-emerald)" />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Khu Vực Làm Việc</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {contacts.location} (Hỗ trợ Onsite & Remote)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Mạng xã hội & Kênh phát triển */}
          <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <MessageSquare size={20} color="var(--neon-violet)" />
                <span>Mạng Xã Hội Chuyên Môn</span>
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Theo dõi và thảo luận cùng tôi trên GitHub và LinkedIn để cập nhật các dự án mã nguồn mở và chia sẻ kinh nghiệm kỹ thuật.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <a
                  href={contacts.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '0.8rem 1.2rem' }}
                >
                  <Github size={18} />
                  <span>GitHub Profile (TienDattmk65)</span>
                </a>

                <a
                  href={contacts.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '0.8rem 1.2rem' }}
                >
                  <Linkedin size={18} color="#0a66c2" />
                  <span>LinkedIn Profile</span>
                </a>
              </div>
            </div>

            <div
              style={{
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-light)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
              }}
            >
              Thời gian phản hồi thông thường: Trong vòng 24 giờ.
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .contact-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
};
