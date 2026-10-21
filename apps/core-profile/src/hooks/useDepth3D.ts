import { useEffect } from 'react';

// Chiều sâu 3D khi cuộn: mỗi phần tử [data-depth3d] nhận biến CSS
//   --depth     : -1 (đã trôi lên trên) .. 0 (đang đọc, cắt ngang giữa màn hình) .. 1 (còn ở dưới)
//   --depth-abs : |--depth| (CSS abs() chưa có ở mọi trình duyệt)
// CSS dùng 2 biến này để nghiêng (rotateX) và đẩy lùi (translateZ) phần đang rời khỏi tầm mắt.
export function useDepth3D(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      const mid = vh / 2;
      document.querySelectorAll<HTMLElement>('[data-depth3d]').forEach((el) => {
        const r = el.getBoundingClientRect();
        let d = 0;
        if (r.top > mid) d = (r.top - mid) / vh;
        else if (r.bottom < mid) d = (r.bottom - mid) / vh;
        d = Math.max(-1, Math.min(1, d * 1.6));
        el.style.setProperty('--depth', d.toFixed(3));
        el.style.setProperty('--depth-abs', Math.abs(d).toFixed(3));
      });
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);
}
