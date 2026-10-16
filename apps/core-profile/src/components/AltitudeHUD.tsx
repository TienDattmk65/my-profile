import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, CalendarClock } from 'lucide-react';
import { SNAP_PAGE_SELECTOR, animateScrollTo, pageScrollTop } from '../hooks/useMilestonePageSnap';

interface AltitudeHUDProps {
  startYear: number;
  currentYear: number;
}

// Bảng đếm năm nổi: startYear ở đáy trang (2002) -> currentYear ở đỉnh trang (Hiện tại)
export const AltitudeHUD: React.FC<AltitudeHUDProps> = ({ startYear, currentYear }) => {
  const [progress, setProgress] = useState(0);
  const [currentLabel, setCurrentLabel] = useState('');
  // Ẩn bảng khi đang ở trạm có đánh dấu data-hide-hud (vd: trang khởi đầu)
  const [isHidden, setIsHidden] = useState(false);
  const [targetYear, setTargetYear] = useState(startYear);
  const [displayYear, setDisplayYear] = useState(startYear);
  const displayYearRef = useRef(startYear);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(maxScroll > 0 ? 1 - window.scrollY / maxScroll : 1);

      // Trạm hiện tại = trạm gần nhất có đầu trạm đã vượt qua 60% chiều cao màn hình.
      // Nếu chưa trạm nào vượt ngưỡng (đang ở đáy trang) thì lấy trạm thấp nhất.
      const threshold = window.innerHeight * 0.6;
      const stations = Array.from(document.querySelectorAll<HTMLElement>('[data-ascent-label]'));
      let current: HTMLElement | undefined;
      let closestTop = -Infinity;
      let lowest: HTMLElement | undefined;
      let lowestTop = -Infinity;
      stations.forEach((el) => {
        const top = el.getBoundingClientRect().top;
        if (top <= threshold && top > closestTop) {
          closestTop = top;
          current = el;
        }
        if (top > lowestTop) {
          lowestTop = top;
          lowest = el;
        }
      });
      const active = current ?? lowest;
      setCurrentLabel(active?.dataset.ascentLabel || '');
      setIsHidden(Boolean(active?.hasAttribute('data-hide-hud')));
      const year = Number(active?.dataset.ascentYear);
      if (year) setTargetYear(year);
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
  }, []);

  // Hiệu ứng đếm năm tăng/giảm dần tới năm của trạm hiện tại
  useEffect(() => {
    const from = displayYearRef.current;
    if (from === targetYear) return;
    const duration = Math.min(900, 120 + Math.abs(targetYear - from) * 60);
    const startTime = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (targetYear - from) * eased);
      displayYearRef.current = value;
      setDisplayYear(value);
      if (t < 1) frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [targetYear]);

  const isAtGround = progress < 0.03;
  // Năm xuất phát (mốc đầu tiên) là năm sinh nên số tuổi = năm đang xem - năm xuất phát
  const age = Math.max(0, displayYear - startYear);

  const scrollToSummit = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  // Nút "Bắt đầu": lên đúng 1 trang mốc ngay phía trên (từ trang khởi đầu -> mốc đầu tiên)
  const scrollToNextPageUp = () => {
    const y = window.scrollY;
    let target: HTMLElement | undefined;
    let bestTop = -Infinity;
    document.querySelectorAll<HTMLElement>(SNAP_PAGE_SELECTOR).forEach((el) => {
      const top = pageScrollTop(el);
      if (top < y - 2 && top > bestTop) {
        bestTop = top;
        target = el;
      }
    });
    if (target) animateScrollTo(bestTop);
  };
  const scrollToGround = () =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });

  return (
    <>
      {isAtGround && (
        <button type="button" className="ascent-hint" onClick={scrollToNextPageUp}>
          <span>Bắt đầu</span>
          <ArrowUp size={16} />
        </button>
      )}

      <div className={`altitude-hud${isHidden ? ' is-hidden' : ''}`} role="status" aria-live="polite" aria-hidden={isHidden}>
        <div className="altitude-hud-meter" aria-hidden="true">
          <div className="altitude-hud-fill" style={{ height: `${progress * 100}%` }} />
        </div>
        <div className="altitude-hud-body">
          <div className="altitude-hud-value">
            <CalendarClock size={14} />
            <span>{displayYear}</span>
            <span className="altitude-hud-sub">{age} tuổi</span>
          </div>
          {currentLabel && <div className="altitude-hud-label">{currentLabel}</div>}
          <div className="altitude-hud-actions">
            <button type="button" onClick={scrollToSummit} title={`Lên đỉnh (${currentYear})`}>
              <ArrowUp size={13} />
              <span>{currentYear}</span>
            </button>
            <button type="button" onClick={scrollToGround} title={`Về điểm xuất phát (${startYear})`}>
              <ArrowDown size={13} />
              <span>{startYear}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
