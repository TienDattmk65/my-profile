import React from 'react';
import { Cloud, Cpu, Code } from 'lucide-react';
import { SkillCategory } from '../types/profile';

interface SkillsProps {
  skills: SkillCategory[];
}

export const Skills: React.FC<SkillsProps> = ({ skills }) => {
  const getCategoryIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case 'cloud':
        return <Cloud size={24} color="var(--neon-cyan)" />;
      case 'cpu':
        return <Cpu size={24} color="var(--neon-violet)" />;
      case 'code':
        return <Code size={24} color="var(--neon-blue)" />;
      default:
        return <Cloud size={24} color="var(--neon-cyan)" />;
    }
  };

  return (
    <section id="skills" className="section-padding">
      <div className="container">
        {/* Section Header */}
        <div className="section-header">
          <span className="section-tag">Tech Stack & Expertise</span>
          <h2 className="section-title">Kỹ Năng & Năng Lực Chuyên Môn</h2>
          <p className="section-subtitle">
            Hệ sinh thái kỹ năng được chuẩn hóa theo định hướng Cloud Native, Kubernetes, Trí tuệ nhân tạo và Phát triển phần mềm hiện đại.
          </p>
        </div>

        {/* Skills Cards Grid */}
        <div className="grid-3">
          {skills.map((category, idx) => (
            <div
              key={idx}
              className="glass-card"
              style={{
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Category Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {getCategoryIcon(category.icon)}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.2rem' }}>{category.category}</h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{category.description}</div>
                </div>
              </div>

              {/* Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '0.5rem' }}>
                {category.items.map((skill, sIdx) => (
                  <div key={sIdx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{skill.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--neon-cyan)', fontSize: '0.82rem' }}>
                        {skill.level}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div
                      style={{
                        width: '100%',
                        height: '6px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: 'var(--radius-full)',
                        overflow: 'hidden',
                        marginBottom: '0.6rem',
                      }}
                    >
                      <div
                        style={{
                          width: `${skill.level}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, var(--neon-cyan) 0%, var(--neon-violet) 100%)',
                          borderRadius: 'var(--radius-full)',
                          transition: 'width 1s ease-in-out',
                        }}
                      />
                    </div>

                    {/* Tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {skill.tags.map((tag, tIdx) => (
                        <span key={tIdx} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
