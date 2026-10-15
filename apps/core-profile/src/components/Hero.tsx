import React from 'react';
import { Layers, Terminal, Sparkles, FileCode2 } from 'lucide-react';
import { PersonalInfo } from '../types/profile';

interface HeroProps {
  personal: PersonalInfo;
  onOpenYamlModal: () => void;
}

export const Hero: React.FC<HeroProps> = ({ personal, onOpenYamlModal }) => {
  return (
    <section
      id="about"
      style={{
        paddingTop: '2rem',
        paddingBottom: '4rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 0.8fr',
            gap: '3rem',
            alignItems: 'center',
          }}
          className="hero-grid"
        >
          {/* Cột Trái: Giới thiệu & Headline */}
          <div>
            {/* Status Badge */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="badge badge-available">
                <span className="badge-pulse-dot"></span>
                <span>{personal.statusBadge.text}</span>
              </div>
            </div>

            {/* Main Headline H1 (Duy nhất 1 H1 chuẩn SEO) */}
            <h1
              id="hero-title"
              style={{
                fontSize: 'clamp(2.4rem, 5vw, 3.8rem)',
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
                marginBottom: '1rem',
              }}
            >
              Xin chào, tôi là <span className="text-gradient">{personal.name}</span>
            </h1>

            {/* Sub-headline */}
            <h2
              style={{
                fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)',
                fontWeight: 600,
                color: 'var(--neon-cyan)',
                marginBottom: '1.5rem',
                fontFamily: 'var(--font-heading)',
              }}
            >
              {personal.headline}
            </h2>

            {/* Bio */}
            <p
              style={{
                fontSize: '1.05rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                marginBottom: '2rem',
                maxWidth: '620px',
              }}
            >
              {personal.bio}
            </p>

            {/* Call To Actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              <a href="#timeline" className="btn btn-primary" id="btn-explore-timeline">
                <span style={{ fontSize: '1.1rem' }}>🍑</span>
                <span>Hành Trình Cây Đào</span>
              </a>

              <a href="#showcase" className="btn btn-secondary" id="btn-explore-demos">
                <Layers size={18} />
                <span>Microservices Demos</span>
              </a>

              <button onClick={onOpenYamlModal} className="btn btn-outline-glow" id="btn-hero-yaml">
                <FileCode2 size={18} />
                <span>Xem Cấu Hình YAML</span>
              </button>
            </div>


            {/* Data-Driven Notice */}
            <div
              style={{
                marginTop: '2.5rem',
                padding: '0.8rem 1.2rem',
                background: 'rgba(0, 242, 254, 0.05)',
                border: '1px solid rgba(0, 242, 254, 0.15)',
                borderRadius: 'var(--radius-md)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.8rem',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
              }}
            >
              <Sparkles size={16} color="var(--neon-cyan)" />
              <span>
                Toàn bộ dữ liệu trang này được nạp động từ file <strong style={{ color: 'var(--neon-cyan)' }}>profile.config.yml</strong>.
              </span>
            </div>
          </div>

          {/* Cột Phải: Avatar nghệ thuật & Tech Badge Orbit */}
          <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
            <div style={{ position: 'relative', width: '320px', height: '320px' }}>
              {/* Vòng sáng Glowing Backdrop */}
              <div
                style={{
                  position: 'absolute',
                  inset: '-15px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.4) 0%, rgba(127, 0, 255, 0.4) 100%)',
                  filter: 'blur(25px)',
                  zIndex: 0,
                }}
              />

              {/* Viền xoay Gradient */}
              <div
                style={{
                  position: 'absolute',
                  inset: '-4px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #00f2fe, #4facfe, #8b5cf6)',
                  zIndex: 1,
                }}
              />

              {/* Ảnh Avatar */}
              <div
                className="floating-avatar"
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  zIndex: 2,
                  border: '4px solid var(--bg-primary)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                }}
              >
                <img
                  src={personal.avatar}
                  alt={personal.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  loading="eager"
                />
              </div>

              {/* Floating Tech Badges */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '-10px',
                  left: '-20px',
                  background: 'rgba(10, 14, 23, 0.9)',
                  border: '1px solid var(--border-glow)',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.4rem 0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  zIndex: 3,
                  boxShadow: 'var(--glow-cyan)',
                  fontSize: '0.8rem',
                }}
              >
                <span style={{ color: '#00f2fe', fontWeight: 600 }}>Docker</span>
                <span style={{ color: 'var(--text-dim)' }}>•</span>
                <span style={{ color: '#8b5cf6', fontWeight: 600 }}>Kubernetes</span>
              </div>

              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '-15px',
                  background: 'rgba(10, 14, 23, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.4rem 0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  zIndex: 3,
                  fontSize: '0.8rem',
                }}
              >
                <span style={{ color: '#10b981', fontWeight: 600 }}>AI / ML</span>
                <span style={{ color: 'var(--text-dim)' }}>•</span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>CI/CD</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 968px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
            text-align: center;
          }
          .hero-grid > div:first-child {
            order: 2;
          }
          .hero-grid > div:last-child {
            order: 1;
            margin-bottom: 2rem;
          }
          .hero-grid p {
            margin-left: auto;
            margin-right: auto;
          }
          .hero-grid .btn {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
};
