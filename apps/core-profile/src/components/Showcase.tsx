import React, { useState } from 'react';
import { ExternalLink, Github, Server, Bot, BarChart3, Layers } from 'lucide-react';
import { ShowcaseProject } from '../types/profile';

interface ShowcaseProps {
  projects: ShowcaseProject[];
}

export const Showcase: React.FC<ShowcaseProps> = ({ projects }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(projects.map((p) => p.category)))];

  const filteredProjects =
    selectedCategory === 'All' ? projects : projects.filter((p) => p.category === selectedCategory);

  const getProjectIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case 'server':
        return <Server size={22} color="var(--neon-cyan)" />;
      case 'bot':
        return <Bot size={22} color="var(--neon-violet)" />;
      case 'barchart3':
        return <BarChart3 size={22} color="var(--neon-emerald)" />;
      default:
        return <Layers size={22} color="var(--neon-cyan)" />;
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'live':
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          color: '#34d399',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          label: '🟢 Live Running',
        };
      case 'demo':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          label: '🟡 Đang Kết Nối',
        };
      case 'coming_soon':
      default:
        return {
          bg: 'rgba(139, 92, 246, 0.15)',
          color: '#c084fc',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          label: '🔵 Sắp Ra Mắt',
        };
    }
  };

  return (
    <section id="showcase" className="section-padding" style={{ position: 'relative' }}>
      <div className="container">
        {/* Section Header */}
        <div className="section-header">
          <span className="section-tag">Microservices Ecosystem</span>
          <h2 className="section-title">Hệ Sinh Thái Subprojects & Live Demos</h2>
          <p className="section-subtitle">
            Các dịch vụ con độc lập được đóng gói container Docker, triển khai riêng biệt và điều hướng qua Hub trung tâm.
          </p>
        </div>

        {/* Category Filters */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '0.8rem',
            marginBottom: '3rem',
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="btn"
              style={{
                padding: '0.5rem 1.2rem',
                fontSize: '0.88rem',
                background: selectedCategory === cat ? 'linear-gradient(135deg, var(--neon-cyan), var(--neon-blue))' : 'var(--bg-glass-strong)',
                color: selectedCategory === cat ? '#050b14' : 'var(--text-secondary)',
                border: selectedCategory === cat ? 'none' : '1px solid var(--border-light)',
              }}
            >
              {cat === 'All' ? 'Tất Cả Subprojects' : cat}
            </button>
          ))}
        </div>

        {/* Projects Grid */}
        <div className="grid-3">
          {filteredProjects.map((project) => {
            const statusStyle = getStatusBadgeStyle(project.status);
            return (
              <div
                key={project.id}
                className="glass-card"
                style={{
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  {/* Top Bar: Icon + Status */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '1.2rem',
                    }}
                  >
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {getProjectIcon(project.icon)}
                    </div>

                    <div
                      style={{
                        padding: '0.25rem 0.7rem',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: statusStyle.bg,
                        color: statusStyle.color,
                        border: statusStyle.border,
                      }}
                    >
                      {project.statusLabel || statusStyle.label}
                    </div>
                  </div>

                  {/* Title & Category */}
                  <div style={{ fontSize: '0.78rem', color: 'var(--neon-cyan)', fontFamily: 'var(--font-mono)', marginBottom: '0.3rem' }}>
                    {project.category}
                  </div>
                  <h3 style={{ fontSize: '1.35rem', marginBottom: '0.8rem', lineHeight: 1.3 }}>
                    {project.title}
                  </h3>

                  {/* Description */}
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.92rem',
                      lineHeight: 1.6,
                      marginBottom: '1.2rem',
                    }}
                  >
                    {project.description}
                  </p>

                  {/* Architecture Box */}
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px dashed rgba(255, 255, 255, 0.12)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.6rem 0.8rem',
                      marginBottom: '1.2rem',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <span style={{ color: 'var(--neon-blue)', fontWeight: 600 }}>Arch: </span>
                    {project.architecture}
                  </div>

                  {/* Tech Stack Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.5rem' }}>
                    {project.techStack.map((tech, tIdx) => (
                      <span key={tIdx} className="tag">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.8rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--border-light)',
                  }}
                >
                  {project.status === 'live' ? (
                    <a
                      href={project.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      style={{ flex: 1, padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                    >
                      <span>Mở Live Demo</span>
                      <ExternalLink size={15} />
                    </a>
                  ) : (
                    <button
                      disabled
                      className="btn btn-secondary"
                      style={{
                        flex: 1,
                        padding: '0.55rem 1rem',
                        fontSize: '0.85rem',
                        opacity: 0.6,
                        cursor: 'not-allowed',
                      }}
                    >
                      <span>Đang Xây Dựng</span>
                    </button>
                  )}

                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ padding: '0.55rem 0.9rem', fontSize: '0.85rem' }}
                    title="Xem mã nguồn trên GitHub"
                  >
                    <Github size={16} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
