import React, { useEffect, useRef, useState } from 'react';

// Khoảng cách (px) tính từ mép trên màn hình mà khi đưa chuột vào sẽ hiện thanh
const HOVER_ZONE_PX = 72;
// Thời gian (ms) giữ thanh hiển thị sau lần cuộn lên cuối cùng
const IDLE_HIDE_MS = 2200;
// Bỏ qua dao động cuộn nhỏ (px) để thanh không nhấp nháy
const SCROLL_JITTER_PX = 4;

/**
 * Thanh tự ẩn/hiện:
 * - Hiện khi người xem cuộn LÊN hoặc đưa chuột lên sát mép trên màn hình.
 * - Ẩn khi cuộn XUỐNG, hoặc sau một lúc không cuộn (trừ khi chuột đang ở trên thanh).
 */
export function useAutoRevealBar() {
  const [isVisible, setIsVisible] = useState(false);
  const isHoveringRef = useRef(false);
  const hideTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let lastY = window.scrollY;

    const clearHideTimer = () => window.clearTimeout(hideTimerRef.current);

    const scheduleHide = () => {
      clearHideTimer();
      hideTimerRef.current = window.setTimeout(() => {
        if (!isHoveringRef.current) setIsVisible(false);
      }, IDLE_HIDE_MS);
    };

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      if (Math.abs(delta) < SCROLL_JITTER_PX) return;
      lastY = y;

      if (delta < 0) {
        setIsVisible(true);
        scheduleHide();
      } else if (!isHoveringRef.current) {
        clearHideTimer();
        setIsVisible(false);
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      const inZone = event.clientY <= HOVER_ZONE_PX;
      if (inZone === isHoveringRef.current) return;
      isHoveringRef.current = inZone;
      if (inZone) {
        clearHideTimer();
        setIsVisible(true);
      } else {
        scheduleHide();
      }
    };

    // Chuột rời khỏi cửa sổ trình duyệt -> coi như không còn hover
    const onMouseLeave = () => {
      if (!isHoveringRef.current) return;
      isHoveringRef.current = false;
      scheduleHide();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onMouseLeave);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMouseMove);
      document.documentElement.removeEventListener('mouseleave', onMouseLeave);
      clearHideTimer();
    };
  }, []);

  // Bàn phím: khi tab vào một nút trong thanh thì giữ thanh hiển thị
  const focusHandlers = {
    onFocus: () => {
      isHoveringRef.current = true;
      window.clearTimeout(hideTimerRef.current);
      setIsVisible(true);
    },
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      // Chuyển focus giữa các nút trong cùng thanh thì không ẩn
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      isHoveringRef.current = false;
      setIsVisible(false);
    },
  };

  return { isVisible, focusHandlers };
}
