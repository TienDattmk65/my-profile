import React from 'react';
import { Server, Bot, BarChart3, Layers, ExternalLink, Sparkles } from 'lucide-react';
import { ShowcaseProject } from '../types/profile';

interface InteractiveFruitButtonProps {
  project: ShowcaseProject;
  position: { x: number; y: number };
  onSelect?: (project: ShowcaseProject) => void;
}

export const InteractiveFruitButton: React.FC<InteractiveFruitButtonProps> = ({
  project,
  position,
  onSelect,
}) => {
  const getIcon = (iconName: string) => {
    switch (iconName?.toLowerCase()) {
      case 'server':
        return <Server size={20} />;
      case 'bot':
        return <Bot size={20} />;
      case 'barchart3':
        return <BarChart3 size={20} />;
      default:
        return <Layers size={20} />;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(project);
    } else {
      const el = document.getElementById('showcase');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 20,
      }}
    >
      <button
        type="button"
        className="peach-fruit-btn"
        onClick={handleClick}
        title={project.title}
        aria-label={`Microservice Quả Đào: ${project.title}`}
      >
        {/* Cuống & Lá đào cắt giấy trên đầu quả */}
        <div className="peach-leaf-decor">
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
            {/* Cuống nâu */}
            <path d="M9 13 C9 9 10 5 13 2" stroke="#5c3d2e" strokeWidth="2" strokeLinecap="round" />
            {/* Lá xanh gấp nếp */}
            <path
              d="M8 8 C4 6 2 3 1 1 C5 1 9 4 10 7 Z"
              fill="#52b788"
              filter="drop-shadow(1px 1px 1px rgba(0,0,0,0.3))"
            />
          </svg>
        </div>

        {/* Thân Quả Đào Cắt Giấy với Icon */}
        <div className="peach-body">
          {getIcon(project.icon)}
        </div>

        {/* Hover Tooltip phát sáng lồng đèn giấy */}
        <div className="peach-tooltip">
          <div className="peach-tooltip-header">
            <Sparkles size={13} color="#ff758f" />
            <span>Quả Đào: {project.title}</span>
          </div>

          <div className="peach-tooltip-cat">
            {project.category} • {project.statusLabel}
          </div>

          <div className="peach-tooltip-action">
            <span>Nhấn để khám phá Live Demo</span>
            <ExternalLink size={11} />
          </div>
        </div>
      </button>
    </div>
  );
};
