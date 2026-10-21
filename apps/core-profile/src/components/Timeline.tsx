import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Compass, Sparkles } from 'lucide-react';
import { TimelineItem, ShowcaseProject } from '../types/profile';
import { EcoTreeScene } from './EcoTreeScene';
import { parseStartYear } from '../services/yearUtils';
import { useAutoRevealBar } from '../hooks/useAutoRevealBar';
import { animateScrollTo, pageScrollTop, useMilestonePageSnap } from '../hooks/useMilestonePageSnap';

// Chỉ Chromium (Chrome, Edge, Opera...) vẽ được bộ lọc SVG trong backdrop-filter
const SUPPORTS_GLASS_REFRACTION =
  typeof navigator !== 'undefined' &&
  /Chrome\/|Chromium\/|Edg\//.test(navigator.userAgent) &&
  !/Firefox\//.test(navigator.userAgent);

interface TimelineProps {
  timeline: TimelineItem[];
  showcase?: ShowcaseProject[];
  onSelectProject?: (project: ShowcaseProject) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  timeline,
  showcase = [],
  onSelectProject,
}) => {
  // Trang mở ở đáy nên mặc định kích hoạt mốc khởi nguồn (2002 - mốc đầu tiên trong YAML)
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Mỗi mốc là một trang cao bằng màn hình, tự trượt khớp trang khi người xem dừng cuộn
  useMilestonePageSnap();

  const activeItem = timeline[activeIdx] || timeline[0];
  const currentStage = activeItem?.treeStage || 'mature';

  // Hiển thị từ trên xuống: mốc mới nhất ở trên, mốc 2002 ở dưới cùng (gần mặt đất)
  const orderedItems = timeline.map((item, idx) => ({ item, idx })).reverse();

  // Cây đào sinh trưởng theo vị trí cuộn (cùng quy tắc với bộ đếm năm AltitudeHUD):
  // mốc đang kích hoạt = mốc gần nhất có đầu thẻ đã vượt qua 60% chiều cao màn hình.
  // Chưa mốc nào vượt ngưỡng nghĩa là người xem đang ở các trạm phía trên -> mốc mới nhất.
  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const threshold = window.innerHeight * 0.6;
      let nextIdx = timeline.length - 1;
      let closestTop = -Infinity;
      cardRefs.current.forEach((el, idx) => {
        if (!el) return;
        const top = el.getBoundingClientRect().top;
        if (top <= threshold && top > closestTop) {
          closestTop = top;
          nextIdx = idx;
        }
      });
      setActiveIdx(nextIdx);
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [timeline]);

  // Trên màn hình hẹp, cuộn ngang thanh mốc để mốc đang kích hoạt luôn nằm giữa
  const chipTrackRef = useRef<HTMLDivElement | null>(null);
  const { isVisible: isBarVisible, focusHandlers: barFocusHandlers } = useAutoRevealBar();
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const track = chipTrackRef.current;
    const chip = chipRefs.current[activeIdx];
    if (!track || !chip) return;
    track.scrollTo({
      left: chip.offsetLeft - (track.clientWidth - chip.offsetWidth) / 2,
      behavior: 'smooth',
    });
  }, [activeIdx]);

  const scrollToMilestone = (idx: number) => {
    const page = cardRefs.current[idx];
    if (page) animateScrollTo(pageScrollTop(page));
  };

  return (
    <section id="timeline" className="section-padding">
      <div className="container">
        {/* Section Header */}
        <div className="section-header">
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              color: '#ff758f',
              background: 'rgba(255, 117, 143, 0.1)',
              padding: '0.35rem 0.9rem',
              borderRadius: 'var(--radius-full)',
              border: '1px solid rgba(255, 117, 143, 0.3)',
              fontSize: '0.85rem',
              fontWeight: 700,
              marginBottom: '0.8rem',
            }}
          >
            <span>🍑</span>
            <span>Hành Trình Họ Đào & Mệnh Mộc • Nghệ Thuật Cắt Giấy (Paper Cutout)</span>
          </div>

          <h2 className="section-title">Hành Trình Cây Đào & Quả Ngọt Microservices</h2>
          <p className="section-subtitle">
            Khởi nguồn từ hạt đào sự sống năm 2002, vươn lên qua từng cột mốc học vấn,
            nở hoa đào hồng phấn rực rỡ và đơm hoa kết trái thành các Microservices độc lập.
          </p>
        </div>

        {/* Bộ lọc khúc xạ cho kính lỏng: làm cong nhẹ nội dung phía sau thanh mốc */}
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
          <filter id="liquid-glass-refraction" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.04" numOctaves="2" seed="7" result="noise" />
            <feGaussianBlur in="noise" stdDeviation="2.5" result="softNoise" />
            <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="22" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>

        {/* Thanh mốc thời gian nổi trên cùng màn hình (thay cho header cũ) */}
        <nav
          className={`milestone-topbar${SUPPORTS_GLASS_REFRACTION ? ' has-refraction' : ''}${isBarVisible ? ' is-visible' : ''}`}
          aria-label="Các mốc thời gian"
          {...barFocusHandlers}
        >
          <div className="milestone-topbar-track" ref={chipTrackRef}>
          {timeline.map((item, idx) => {
            const isActive = idx === activeIdx;
            return (
              <button
                key={idx}
                type="button"
                ref={(el) => {
                  chipRefs.current[idx] = el;
                }}
                aria-current={isActive ? 'step' : undefined}
                onClick={() => scrollToMilestone(idx)}
                style={{
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(255, 117, 143, 0.25) 0%, rgba(251, 146, 60, 0.2) 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  color: isActive ? '#ff758f' : 'var(--text-secondary)',
                  border: isActive
                    ? '1px solid #ff758f'
                    : '1px solid var(--border-light)',
                  padding: '0.45rem 1rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.82rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  boxShadow: isActive ? '0 0 16px rgba(255, 117, 143, 0.4)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>{item.year}</span>
                {item.level && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      opacity: 0.9,
                      background: isActive ? 'rgba(255, 117, 143, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                      color: isActive ? '#fff' : 'var(--text-muted)',
                      padding: '0.1rem 0.4rem',
                      borderRadius: 'var(--radius-full)',
                      fontWeight: 600,
                    }}
                  >
                    Lv.{item.level}
                  </span>
                )}
              </button>
            );
          })}
          </div>
        </nav>

        {/* Bố Cục 2 Cột: Timeline bên Trái & Cây Mệnh Mộc Sticky bên Phải */}
        <div className="tree-timeline-split">
          {/* CỘT 1: DÒNG THỜI GIAN CÁC MỐC (TIMELINE CARDS) */}
          {/* Các mốc nằm trực tiếp trên trục Timeline vươn lên chung của toàn trang */}
          <div style={{ position: 'relative' }} className="timeline-container">
            {orderedItems.map(({ item, idx }) => {
              const isSelected = idx === activeIdx;
              return (
                <div
                  key={idx}
                  ref={(el) => {
                    cardRefs.current[idx] = el;
                  }}
                  data-idx={idx}
                  data-snap-page
                  data-ascent-label={`${item.year} • ${item.badge}`}
                  data-ascent-year={parseStartYear(item.year)}
                  className={`milestone-page${isSelected ? ' is-active' : idx > activeIdx ? ' is-above' : ' is-below'}`}
                  onClick={() => scrollToMilestone(idx)}
                >
                  <div className="milestone-page-inner">
                    {/* Dot Icon phát sáng trên trục chung */}
                    <div
                      className="ascent-milestone-dot"
                      style={{
                        position: 'absolute',
                        top: '0.2rem',
                        width: isSelected ? '18px' : '14px',
                        height: isSelected ? '18px' : '14px',
                        borderRadius: '50%',
                        background: isSelected ? 'var(--neon-emerald)' : 'var(--bg-primary)',
                        border: isSelected
                          ? '3px solid #fff'
                          : '3px solid var(--neon-emerald)',
                        boxShadow: isSelected
                          ? '0 0 16px var(--neon-emerald), 0 0 25px rgba(0, 245, 155, 0.6)'
                          : '0 0 8px rgba(0, 245, 155, 0.4)',
                        zIndex: 2,
                        transition: 'all var(--transition-fast)',
                      }}
                    />

                    {/* Card Content */}
                    <div
                      className="glass-card"
                      style={{
                        padding: '1.8rem',
                        border: isSelected
                          ? '1px solid rgba(0, 245, 155, 0.5)'
                          : '1px solid var(--border-light)',
                        boxShadow: isSelected
                          ? '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 245, 155, 0.15)'
                          : 'var(--glow-card)',
                        transition: 'all var(--transition-normal)',
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(16, 24, 39, 0.85) 0%, rgba(13, 38, 25, 0.5) 100%)'
                          : 'var(--bg-card)',
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
                            color: isSelected ? 'var(--neon-emerald)' : 'var(--neon-cyan)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.86rem',
                            fontWeight: 700,
                          }}
                        >
                          <Calendar size={14} />
                          <span>{item.year}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {item.altitude && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                background: 'rgba(0, 242, 254, 0.08)',
                                padding: '0.2rem 0.5rem',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.72rem',
                                color: 'var(--neon-cyan)',
                                border: '1px solid rgba(0, 242, 254, 0.2)',
                              }}
                            >
                              <Compass size={11} />
                              {item.altitude}
                            </span>
                          )}

                          <span
                            style={{
                              background: isSelected
                                ? 'rgba(0, 245, 155, 0.15)'
                                : 'rgba(255, 255, 255, 0.06)',
                              padding: '0.2rem 0.6rem',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '0.75rem',
                              color: isSelected ? 'var(--neon-emerald)' : 'var(--text-muted)',
                              border: isSelected
                                ? '1px solid rgba(0, 245, 155, 0.3)'
                                : '1px solid var(--border-light)',
                              fontWeight: 600,
                            }}
                          >
                            {item.badge}
                          </span>
                        </div>
                      </div>

                      <h3
                        style={{
                          fontSize: '1.25rem',
                          marginBottom: '0.25rem',
                          color: isSelected ? '#fff' : 'var(--text-primary)',
                        }}
                      >
                        {item.title}
                      </h3>

                      <div
                        style={{
                          fontSize: '0.9rem',
                          color: 'var(--neon-mint)',
                          marginBottom: '0.8rem',
                          fontWeight: 500,
                        }}
                      >
                        {item.organization}
                      </div>

                      <p
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.92rem',
                          lineHeight: 1.6,
                          marginBottom: '1rem',
                        }}
                      >
                        {item.description}
                      </p>

                      {/* Skills tags mở khóa */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {item.skills.map((skill, sIdx) => (
                          <span
                            key={sIdx}
                            className="tag"
                            style={{
                              borderColor: isSelected
                                ? 'rgba(0, 245, 155, 0.3)'
                                : 'var(--border-light)',
                              color: isSelected ? 'var(--neon-emerald)' : 'var(--text-secondary)',
                            }}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>

                      {/* Chỉ dẫn chọn xem cây: luôn giữ chỗ (chỉ ẩn/hiện) để chiều cao thẻ không đổi khi
                          đổi mốc đang chọn, nếu không các trang mốc phía dưới bị xô lệch lúc đang trượt */}
                      <div
                        aria-hidden={!isSelected}
                        style={{
                          marginTop: '0.8rem',
                          fontSize: '0.75rem',
                          color: 'var(--neon-emerald)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          visibility: isSelected ? 'visible' : 'hidden',
                        }}
                      >
                        <Sparkles size={12} />
                        <span>Đang kích hoạt giai đoạn sinh trưởng này trên Cây Mệnh Mộc</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CỘT 2: CÂY SINH THÁI MỆNH MỘC STICKY (ECO TREE VISUALIZER) */}
          <div className="tree-sticky-column">
            <EcoTreeScene
              currentStage={currentStage}
              projects={showcase}
              onSelectProject={onSelectProject}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
