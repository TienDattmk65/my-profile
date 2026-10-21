import { useEffect } from 'react';

// Chiều sâu 3D khi cuộn: mỗi phần tử [data-depth3d] nhận biến CSS
//   --depth     : -1 (đã trôi lên trên) .. 0 (đang đọc, cắt ngang giữa màn hình) .. 1 (còn ở dưới)
//   --depth-abs : |--depth| (CSS abs() chưa có ở mọi trình duyệt)
// Giá trị hiển thị được nội suy dần về vị trí thật mỗi khung hình (như lò xo tắt dần), nên khi trang
// trượt khớp hoặc lăn chuột theo nấc, phần nội dung vẫn nghiêng/lùi mềm mại thay vì giật theo từng nấc.
const FOLLOW = 0.14;
const SETTLE = 0.0015;

export function useDepth3D(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const shown = new WeakMap<HTMLElement, number>();
    let frame = 0;
    let lastTime = 0;

    const targetDepth = (el: HTMLElement, vh: number) => {
      const r = el.getBoundingClientRect();
      const mid = vh / 2;
      let d = 0;
      if (r.top > mid) d = (r.top - mid) / vh;
      else if (r.bottom < mid) d = (r.bottom - mid) / vh;
      return Math.max(-1, Math.min(1, d * 1.6));
    };

    const write = (el: HTMLElement, d: number) => {
      el.style.setProperty('--depth', d.toFixed(4));
      el.style.setProperty('--depth-abs', Math.abs(d).toFixed(4));
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = lastTime ? Math.min(64, now - lastTime) : 16.7;
      lastTime = now;
      const k = 1 - Math.pow(1 - FOLLOW, dt / 16.7);
      const vh = window.innerHeight;
      let moving = false;

      document.querySelectorAll<HTMLElement>('[data-depth3d]').forEach((el) => {
        const target = targetDepth(el, vh);
        const prev = shown.get(el);
        // Lần đầu: đặt thẳng vị trí thật, không chạy hiệu ứng từ 0
        const next = prev === undefined ? target : prev + (target - prev) * k;
        const settled = Math.abs(target - next) < SETTLE;
        const value = settled ? target : next;
        if (!settled) moving = true;
        if (prev === undefined || Math.abs(value - prev) > 1e-5) write(el, value);
        shown.set(el, value);
      });

      if (moving) frame = window.requestAnimationFrame(tick);
      else lastTime = 0;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(tick);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);
}
