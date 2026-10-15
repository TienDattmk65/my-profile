import React from 'react';
import { ArrowUp, Cloud } from 'lucide-react';
import { PersonalInfo } from '../types/profile';

interface FooterProps {
  personal: PersonalInfo;
}

export const Footer: React.FC<FooterProps> = ({ personal }) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-light)',
        background: 'rgba(10, 14, 23, 0.95)',
        padding: '3rem 0 2rem 0',
        marginTop: '3rem',
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #00f2fe 0%, #7f00ff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#050b14',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                }}
              >
                TD
              </div>
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{personal.name}</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Personal Hub & Microservices Ecosystem Orchestration
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '0.35rem 0.8rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-light)',
              }}
            >
              <Cloud size={14} color="var(--neon-cyan)" />
              <span>Deployed on Render</span>
            </div>

            <button
              onClick={scrollToTop}
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              title="Cuộn lên đầu trang"
            >
              <ArrowUp size={15} />
              <span>Lên Đầu Trang</span>
            </button>
          </div>
        </div>

        <div
          style={{
            paddingTop: '1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            fontSize: '0.82rem',
            color: 'var(--text-dim)',
          }}
        >
          <div>
            © {new Date().getFullYear()} {personal.name}. Thiết kế theo kiến trúc Microservices & Data-Driven.
          </div>
          <div>
            Mã nguồn được lưu trữ tại{' '}
            <a
              href="https://github.com/TienDattmk65/my-profile"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--neon-cyan)', textDecoration: 'underline' }}
            >
              GitHub Monorepo
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
