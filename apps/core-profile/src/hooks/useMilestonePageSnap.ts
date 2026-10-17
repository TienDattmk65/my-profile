import { useEffect } from 'react';
import { playWhoosh } from '../services/soundEffects';

// Thời gian (ms) một lượt chuyển trang mốc
const PAGE_TRANSITION_MS = 850;
// Khoảng lặng (ms) giữa 2 sự kiện lăn chuột để coi là một cú lăn MỚI.
// Touchpad/Magic Mouse bắn sự kiện quán tính liên tục ~1s sau khi nhấc tay, nên phải gom lại.
const WHEEL_GESTURE_GAP_MS = 180;
// Bỏ qua lăn chuột rất nhỏ (rung tay trên touchpad)
const WHEEL_MIN_DELTA = 4;
// Vuốt tối thiểu (px) trên màn hình cảm ứng để chuyển trang
const SWIPE_MIN_PX = 40;
// Lệch (px) dưới mức này coi như đã khớp trang
const ALIGNED_EPSILON_PX = 2;
// Chờ (ms) sau lần cuộn cuối cùng (kéo thanh cuộn...) khi trình duyệt chưa có `scrollend`
const SCROLL_IDLE_MS = 140;

type Direction = 'up' | 'down';

// Giống đường cong chuyển động trên iOS: tăng tốc êm, giảm tốc dài và mềm
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let activeAnimation: { frame: number; resolve: () => void } | null = null;

/** Hủy lượt chuyển trang đang chạy (nếu có). */
export function cancelPageAnimation() {
  if (!activeAnimation) return;
  window.cancelAnimationFrame(activeAnimation.frame);
  activeAnimation.resolve();
  activeAnimation = null;
}

/** Cuộn mượt tới vị trí `top` bằng một chuyển động duy nhất, không phụ thuộc `scroll-behavior` của trình duyệt. */
export function animateScrollTo(top: number, duration = PAGE_TRANSITION_MS): Promise<void> {
  cancelPageAnimation();
  const startY = window.scrollY;
  const distance = top - startY;
  // Tiếng "vút" mỗi lần chuyển sang trang mốc khác (lên = cao dần, xuống = trầm dần)
  if (Math.abs(distance) > ALIGNED_EPSILON_PX) {
    playWhoosh(distance < 0 ? 'up' : 'down', Math.min(1.1, Math.max(0.45, duration / 1000)));
  }
  if (Math.abs(distance) < 1 || duration <= 0 || prefersReducedMotion()) {
    window.scrollTo({ top, behavior: 'instant' });
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const startTime = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      window.scrollTo({ top: startY + distance * easeInOutCubic(t), behavior: 'instant' });
      if (t < 1) {
        activeAnimation = { frame: window.requestAnimationFrame(step), resolve };
      } else {
        activeAnimation = null;
        resolve();
      }
    };
    activeAnimation = { frame: window.requestAnimationFrame(step), resolve };
  });
}

/** Vị trí cuộn để trang mốc `el` khớp đúng mép trên màn hình. */
export const pageScrollTop = (el: HTMLElement) => window.scrollY + el.getBoundingClientRect().top;

// Các phần tử là một "trang" cao bằng màn hình: từng mốc timeline + trang khởi đầu (Mặt Đất)
export const SNAP_PAGE_SELECTOR = '[data-snap-page]';

/**
 * Chuyển sang trang kế bên theo hướng (dùng cho các nút lên/xuống):
 * - Trang mốc gần nhất theo hướng đó nằm trong khoảng ~1,5 màn hình -> khớp đúng trang mốc đó.
 * - Còn lại (đang ở các phần không chia trang như Giới thiệu, Kỹ năng...) -> trượt đúng 1 màn hình.
 */
export function scrollToAdjacentPage(direction: Direction) {
  const y = window.scrollY;
  const viewportH = window.innerHeight;
  const maxScroll = document.documentElement.scrollHeight - viewportH;
  let pageTop: number | undefined;
  document.querySelectorAll<HTMLElement>(SNAP_PAGE_SELECTOR).forEach((el) => {
    const top = pageScrollTop(el);
    if (direction === 'up' && top < y - ALIGNED_EPSILON_PX && (pageTop === undefined || top > pageTop)) pageTop = top;
    if (direction === 'down' && top > y + ALIGNED_EPSILON_PX && (pageTop === undefined || top < pageTop)) pageTop = top;
  });
  const oneScreen = direction === 'up' ? Math.max(0, y - viewportH) : Math.min(maxScroll, y + viewportH);
  const target = pageTop !== undefined && Math.abs(pageTop - y) <= viewportH * 1.5 ? pageTop : oneScreen;
  if (Math.abs(target - y) > ALIGNED_EPSILON_PX) animateScrollTo(target);
}

/**
 * Mỗi mốc là một trang cao bằng màn hình, chuyển trang kiểu "full page":
 * - Lăn chuột / vuốt / phím mũi tên, PageUp/PageDown, Space khi đang ở vùng timeline sẽ
 *   chuyển thẳng sang mốc kế tiếp theo hướng đó bằng MỘT chuyển động mượt duy nhất.
 * - Không còn mốc nào theo hướng đó (đang ở mốc trên cùng/dưới cùng) thì trả lại cuộn tự do
 *   để người xem rời khỏi timeline.
 * - Cuộn bằng cách khác (kéo thanh cuộn...) mà dừng giữa 2 mốc thì tự trượt khớp mốc gần nhất.
 */
export function useMilestonePageSnap() {
  useEffect(() => {
    let isAnimating = false;
    let lastWheelTime = 0;
    let wheelGestureConsumed = false;
    let touchStartY: number | null = null;
    let touchGestureHandled = false;
    let idleTimer: number | undefined;

    const pages = () => Array.from(document.querySelectorAll<HTMLElement>(SNAP_PAGE_SELECTOR));

    // Màn hình có đang chồng lên ít nhất một trang mốc không
    const isInTimeline = () =>
      pages().some((el) => {
        const rect = el.getBoundingClientRect();
        return rect.bottom > ALIGNED_EPSILON_PX && rect.top < window.innerHeight - ALIGNED_EPSILON_PX;
      });

    // Trang mốc kế tiếp theo hướng cuộn, tính từ vị trí hiện tại
    const findTarget = (direction: Direction): HTMLElement | undefined => {
      if (!isInTimeline()) return undefined;
      const y = window.scrollY;
      let target: HTMLElement | undefined;
      let best = direction === 'up' ? -Infinity : Infinity;
      for (const el of pages()) {
        const top = pageScrollTop(el);
        if (direction === 'up' && top < y - ALIGNED_EPSILON_PX && top > best) {
          best = top;
          target = el;
        }
        if (direction === 'down' && top > y + ALIGNED_EPSILON_PX && top < best) {
          best = top;
          target = el;
        }
      }
      return target;
    };

    const goTo = (el: HTMLElement) => {
      isAnimating = true;
      animateScrollTo(pageScrollTop(el)).then(() => {
        isAnimating = false;
      });
    };

    // Thử chuyển trang theo hướng; trả về true nếu đã xử lý (cần chặn cuộn mặc định)
    const tryPageTurn = (direction: Direction) => {
      const target = findTarget(direction);
      if (!target) return false;
      goTo(target);
      return true;
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return; // Ctrl + lăn = phóng to trang, không can thiệp
      const now = performance.now();
      const isNewGesture = now - lastWheelTime > WHEEL_GESTURE_GAP_MS;
      lastWheelTime = now;

      // Đang chuyển trang, hoặc vẫn là đuôi quán tính của cú lăn đã dùng -> nuốt sự kiện
      if (isAnimating || (!isNewGesture && wheelGestureConsumed)) {
        if (isAnimating || isInTimeline()) event.preventDefault();
        return;
      }
      if (Math.abs(event.deltaY) < WHEEL_MIN_DELTA) return;

      wheelGestureConsumed = tryPageTurn(event.deltaY < 0 ? 'up' : 'down');
      if (wheelGestureConsumed) event.preventDefault();
    };

    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches.length === 1 ? event.touches[0].clientY : null;
      touchGestureHandled = false;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (touchStartY === null || !event.cancelable) return;
      if (isAnimating || touchGestureHandled) {
        event.preventDefault();
        return;
      }
      const dy = event.touches[0].clientY - touchStartY;
      if (Math.abs(dy) < 8) return;
      // Vuốt xuống (ngón tay đi xuống) = cuộn LÊN
      const direction: Direction = dy > 0 ? 'up' : 'down';
      if (!findTarget(direction)) {
        touchStartY = null; // Rời timeline: để trình duyệt cuộn tự nhiên
        return;
      }
      event.preventDefault();
      if (Math.abs(dy) >= SWIPE_MIN_PX) {
        touchGestureHandled = tryPageTurn(direction);
      }
    };

    const onTouchEnd = () => {
      touchStartY = null;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

      let direction: Direction | undefined;
      if (event.key === 'ArrowUp' || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey)) direction = 'up';
      if (event.key === 'ArrowDown' || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey)) direction = 'down';
      if (!direction) return;

      if (isAnimating) {
        if (isInTimeline()) event.preventDefault();
        return;
      }
      if (tryPageTurn(direction)) event.preventDefault();
    };

    // Kéo thanh cuộn rồi dừng giữa 2 mốc -> trượt khớp mốc gần nhất
    const snapAfterFreeScroll = () => {
      // Đang có chuyển động cuộn (vd: bấm nút mốc trên thanh) -> không kéo ngược lại.
      // Mỗi khung hình của chuyển động đều có thể làm trình duyệt bắn `scrollend`.
      if (isAnimating || activeAnimation) return;
      const viewportH = window.innerHeight;
      let best: { el: HTMLElement; visible: number } | undefined;
      for (const el of pages()) {
        const rect = el.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= viewportH) continue;
        if (Math.abs(rect.top) <= ALIGNED_EPSILON_PX) return;
        const visible = Math.min(rect.bottom, viewportH) - Math.max(rect.top, 0);
        if (!best || visible > best.visible) best = { el, visible };
      }
      // Chỉ kéo khớp khi trang mốc chiếm phần lớn màn hình; còn lại là đang rời timeline
      if (!best || best.visible < viewportH * 0.5) return;
      goTo(best.el);
    };

    const supportsScrollEnd = 'onscrollend' in window;
    // Chỉ tự khớp sau khi người xem kéo thanh cuộn (bấm chuột). Lăn chuột/vuốt/phím đã được xử lý
    // ở trên; nếu chúng cuộn tự do (đang rời timeline) thì không được kéo ngược lại.
    let lastInput: 'none' | 'pointer' | 'gesture' = 'none';
    const markGesture = () => {
      lastInput = 'gesture';
    };

    const onScrollEnd = () => {
      if (lastInput === 'pointer') snapAfterFreeScroll();
    };

    const onScroll = () => {
      if (!supportsScrollEnd) {
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(onScrollEnd, SCROLL_IDLE_MS);
      }
    };

    // Bấm chuột (vd: kéo thanh cuộn) trong lúc đang chuyển trang -> nhường quyền cho người xem
    const onPointerDown = () => {
      lastInput = 'pointer';
      if (isAnimating) {
        cancelPageAnimation();
        isAnimating = false;
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    ['wheel', 'touchstart', 'keydown'].forEach((name) =>
      window.addEventListener(name, markGesture, { passive: true })
    );
    window.addEventListener('scroll', onScroll, { passive: true });
    if (supportsScrollEnd) window.addEventListener('scrollend', onScrollEnd);

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
      ['wheel', 'touchstart', 'keydown'].forEach((name) => window.removeEventListener(name, markGesture));
      window.removeEventListener('scroll', onScroll);
      if (supportsScrollEnd) window.removeEventListener('scrollend', onScrollEnd);
      window.clearTimeout(idleTimer);
      cancelPageAnimation();
    };
  }, []);
}
