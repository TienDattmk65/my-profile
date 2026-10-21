import { useEffect } from 'react';

// Thẻ kính (.glass-card) nghiêng 3D theo vị trí chuột, kèm vệt sáng chạy theo con trỏ.
// Gắn một lần cho cả trang (uỷ quyền sự kiện) nên thẻ mới render sau vẫn có hiệu ứng.
// Tắt trên màn hình cảm ứng và khi người xem bật giảm chuyển động.
const MAX_TILT_DEG = 7;

export function useCardTilt() {
  useEffect(() => {
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduce) return;

    let current: HTMLElement | null = null;
    let frame = 0;
    let last: PointerEvent | null = null;

    const reset = (card: HTMLElement) => {
      card.classList.remove('is-tilting');
      card.style.removeProperty('--rx');
      card.style.removeProperty('--ry');
      card.style.removeProperty('--tx');
      card.style.removeProperty('--ty');
    };

    const apply = () => {
      frame = 0;
      if (!last) return;
      const target = last.target instanceof Element ? last.target : null;
      const card = target?.closest<HTMLElement>('.glass-card') ?? null;
      // Không nghiêng hộp thoại (YAML modal) để chữ/code luôn phẳng, dễ đọc
      const usable = card && !card.closest('[data-no-tilt]') ? card : null;
      if (current && current !== usable) reset(current);
      current = usable;
      if (!usable) return;

      const r = usable.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (last.clientX - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (last.clientY - r.top) / r.height));
      const tx = px * 2 - 1;
      const ty = py * 2 - 1;
      usable.classList.add('is-tilting');
      usable.style.setProperty('--rx', `${(-ty * MAX_TILT_DEG).toFixed(2)}deg`);
      usable.style.setProperty('--ry', `${(tx * MAX_TILT_DEG).toFixed(2)}deg`);
      usable.style.setProperty('--tx', tx.toFixed(3));
      usable.style.setProperty('--ty', ty.toFixed(3));
      usable.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
      usable.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    };

    const onMove = (e: PointerEvent) => {
      last = e;
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    const onLeaveWindow = () => {
      if (current) reset(current);
      current = null;
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeaveWindow);
    window.addEventListener('blur', onLeaveWindow);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeaveWindow);
      window.removeEventListener('blur', onLeaveWindow);
      if (frame) window.cancelAnimationFrame(frame);
      if (current) reset(current);
    };
  }, []);
}
