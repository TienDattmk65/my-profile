import React from 'react';
import { Server, GitBranch, Activity, Github, Cpu, ShieldCheck } from 'lucide-react';
import { QuickStat } from '../types/profile';

interface StatsSectionProps {
  stats: QuickStat[];
}

export const StatsSection: React.FC<StatsSectionProps> = ({ stats }) => {
  const getIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case 'server':
        return <Server size={24} color="var(--neon-cyan)" />;
      case 'gitbranch':
        return <GitBranch size={24} color="var(--neon-blue)" />;
      case 'activity':
        return <Activity size={24} color="var(--neon-emerald)" />;
      case 'github':
        return <Github size={24} color="var(--neon-violet)" />;
      case 'cpu':
        return <Cpu size={24} color="var(--neon-amber)" />;
      default:
        return <ShieldCheck size={24} color="var(--neon-cyan)" />;
    }
  };

  return (
    <section style={{ padding: '2rem 0' }}>
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
            gap: '1.2rem',
          }}
          className="stats-grid"
        >
          {stats.map((item, idx) => (
            <div
              key={idx}
              className="glass-card"
              style={{
                padding: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1.2rem',
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-light)',
                  flexShrink: 0,
                }}
              >
                {getIcon(item.icon)}
              </div>
              <div>
                <div
                  style={{
                    fontSize: '1.8rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-heading)',
                    lineHeight: 1.1,
                  }}
                  className="text-gradient"
                >
                  {item.value}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 500px) {
          .stats-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
};
