import { useEffect } from 'react';

// Thẻ kính (.glass-card) nghiêng 3D theo vị trí chuột, kèm vệt sáng chạy theo con trỏ.
// Gắn một lần cho cả trang (uỷ quyền sự kiện) nên thẻ mới render sau vẫn có hiệu ứng.
// Góc nghiêng được nội suy dần mỗi khung hình (không nhảy theo từng sự kiện chuột), rời thẻ thì
// thẻ từ từ trở về phẳng. Tắt trên màn hình cảm ứng và khi người xem bật giảm chuyển động.
const MAX_TILT_DEG = 7;
// Hệ số bám theo mỗi khung hình ở 60fps (càng nhỏ càng mềm/chậm)
const FOLLOW = 0.12;
const SETTLE = 0.002;

interface TiltState {
  cur: { x: number; y: number; lift: number };
  tgt: { x: number; y: number; lift: number };
  px: number;
  py: number;
}

export function useCardTilt() {
  useEffect(() => {
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduce) return;

    const cards = new Map<HTMLElement, TiltState>();
    let hovered: HTMLElement | null = null;
    let frame = 0;
    let lastTime = 0;

    const reset = (card: HTMLElement) => {
      card.classList.remove('is-tilting');
      ['--rx', '--ry', '--tx', '--ty', '--lift', '--mx', '--my'].forEach((name) => card.style.removeProperty(name));
      cards.delete(card);
    };

    const tick = (now: number) => {
      frame = 0;
      // Bù theo thời gian thực để màn hình 120Hz/60Hz cho cùng tốc độ
      const dt = lastTime ? Math.min(64, now - lastTime) : 16.7;
      lastTime = now;
      const k = 1 - Math.pow(1 - FOLLOW, dt / 16.7);

      cards.forEach((st, card) => {
        st.cur.x += (st.tgt.x - st.cur.x) * k;
        st.cur.y += (st.tgt.y - st.cur.y) * k;
        st.cur.lift += (st.tgt.lift - st.cur.lift) * k;
        const settled =
          Math.abs(st.tgt.x - st.cur.x) < SETTLE && Math.abs(st.tgt.y - st.cur.y) < SETTLE && Math.abs(st.tgt.lift - st.cur.lift) < SETTLE;
        if (settled && st.tgt.lift === 0) {
          reset(card);
          return;
        }
        card.style.setProperty('--rx', `${(-st.cur.y * MAX_TILT_DEG).toFixed(3)}deg`);
        card.style.setProperty('--ry', `${(st.cur.x * MAX_TILT_DEG).toFixed(3)}deg`);
        card.style.setProperty('--tx', st.cur.x.toFixed(4));
        card.style.setProperty('--ty', st.cur.y.toFixed(4));
        card.style.setProperty('--lift', st.cur.lift.toFixed(4));
        card.style.setProperty('--mx', `${st.px.toFixed(1)}%`);
        card.style.setProperty('--my', `${st.py.toFixed(1)}%`);
      });

      if (cards.size) frame = window.requestAnimationFrame(tick);
      else lastTime = 0;
    };
    const run = () => {
      if (!frame) frame = window.requestAnimationFrame(tick);
    };

    const release = (card: HTMLElement | null) => {
      const st = card && cards.get(card);
      if (!st) return;
      st.tgt = { x: 0, y: 0, lift: 0 };
    };

    const onMove = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const card = target?.closest<HTMLElement>('.glass-card') ?? null;
      // Không nghiêng hộp thoại (YAML modal) để chữ/code luôn phẳng, dễ đọc
      const usable = card && !card.closest('[data-no-tilt]') ? card : null;
      if (hovered && hovered !== usable) release(hovered);
      hovered = usable;
      if (!usable) {
        run();
        return;
      }

      const r = usable.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      let st = cards.get(usable);
      if (!st) {
        st = { cur: { x: 0, y: 0, lift: 0 }, tgt: { x: 0, y: 0, lift: 0 }, px: 50, py: 50 };
        cards.set(usable, st);
        usable.classList.add('is-tilting');
      }
      st.tgt = { x: px * 2 - 1, y: py * 2 - 1, lift: 1 };
      st.px = px * 100;
      st.py = py * 100;
      run();
    };
    const onLeaveWindow = () => {
      release(hovered);
      hovered = null;
      run();
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeaveWindow);
    window.addEventListener('blur', onLeaveWindow);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeaveWindow);
      window.removeEventListener('blur', onLeaveWindow);
      if (frame) window.cancelAnimationFrame(frame);
      [...cards.keys()].forEach(reset);
    };
  }, []);
}
