import React from 'react';
import { Calendar, Briefcase, GraduationCap, CheckCircle } from 'lucide-react';
import { TimelineItem } from '../types/profile';

interface TimelineProps {
  timeline: TimelineItem[];
}

export const Timeline: React.FC<TimelineProps> = ({ timeline }) => {
  return (
    <section id="timeline" className="section-padding">
      <div className="container">
        {/* Section Header */}
        <div className="section-header">
          <span className="section-tag">Career & Milestones</span>
          <h2 className="section-title">Hành Trình & Cột Mốc Phát Triển</h2>
          <p className="section-subtitle">
            Dòng thời gian tích lũy kiến thức, trải nghiệm kỹ thuật và quá trình xây dựng các giải pháp Cloud Native.
          </p>
        </div>

        {/* Timeline Vertical Layout */}
        <div
          style={{
            maxWidth: '800px',
            margin: '0 auto',
            position: 'relative',
            paddingLeft: '2rem',
          }}
          className="timeline-container"
        >
          {/* Vertical Track Line */}
          <div
            style={{
              position: 'absolute',
              top: '10px',
              bottom: '10px',
              left: '7px',
              width: '2px',
              background: 'linear-gradient(180deg, var(--neon-cyan) 0%, var(--neon-violet) 100%)',
            }}
          />

          {timeline.map((item, idx) => (
            <div
              key={idx}
              style={{
                position: 'relative',
                marginBottom: '2.5rem',
              }}
            >
              {/* Dot Icon */}
              <div
                style={{
                  position: 'absolute',
                  left: '-2rem',
                  top: '0.2rem',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: 'var(--bg-primary)',
                  border: '3px solid var(--neon-cyan)',
                  boxShadow: '0 0 10px var(--neon-cyan)',
                  zIndex: 2,
                }}
              />

              {/* Card Content */}
              <div
                className="glass-card"
                style={{
                  padding: '1.8rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '0.6rem',
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      color: 'var(--neon-cyan)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                    }}
                  >
                    <Calendar size={14} />
                    <span>{item.year}</span>
                  </div>

                  <span
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    {item.badge}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.2rem' }}>{item.title}</h3>
                <div style={{ fontSize: '0.9rem', color: 'var(--neon-blue)', marginBottom: '0.8rem', fontWeight: 500 }}>
                  {item.organization}
                </div>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                  {item.description}
                </p>

                {/* Skills tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {item.skills.map((skill, sIdx) => (
                    <span key={sIdx} className="tag">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
