import React, { useEffect, useState } from 'react';

interface TypewriterGreetingProps {
  /** Các câu chào thay phiên nhau xuất hiện; dùng "\n" để xuống dòng */
  texts: string[];
}

// Tốc độ (ms) gõ / xoá mỗi ký tự và thời gian dừng
const TYPE_MS = 75;
const DELETE_MS = 35;
const HOLD_AFTER_TYPED_MS = 2200;
const HOLD_AFTER_DELETED_MS = 450;

type Phase = 'typing' | 'holding' | 'deleting' | 'waiting';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Lời chào kiểu terminal: gõ từng ký tự -> dừng -> xoá -> chuyển sang câu tiếp theo, lặp vô hạn
export const TypewriterGreeting: React.FC<TypewriterGreetingProps> = ({ texts }) => {
  const [textIdx, setTextIdx] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [phase, setPhase] = useState<Phase>('typing');

  const fullText = texts[textIdx] ?? '';
  // Tách theo ký tự Unicode để không cắt đôi dấu tiếng Việt / emoji
  const chars = Array.from(fullText);

  useEffect(() => {
    if (texts.length === 0) return;

    // Giảm chuyển động: hiện trọn câu và chỉ đổi câu sau mỗi lượt dừng
    if (prefersReducedMotion()) {
      setCharCount(chars.length);
      const timer = window.setTimeout(() => {
        setTextIdx((idx) => (idx + 1) % texts.length);
      }, HOLD_AFTER_TYPED_MS * 2);
      return () => window.clearTimeout(timer);
    }

    let delay = TYPE_MS;
    let next: () => void = () => {};

    if (phase === 'typing') {
      if (charCount < chars.length) {
        // Xuống dòng dừng lâu hơn một chút như người gõ thật
        delay = chars[charCount] === '\n' ? TYPE_MS * 4 : TYPE_MS + Math.random() * 40;
        next = () => setCharCount((n) => n + 1);
      } else {
        delay = 0;
        next = () => setPhase('holding');
      }
    } else if (phase === 'holding') {
      delay = HOLD_AFTER_TYPED_MS;
      next = () => setPhase('deleting');
    } else if (phase === 'deleting') {
      if (charCount > 0) {
        delay = DELETE_MS;
        next = () => setCharCount((n) => n - 1);
      } else {
        delay = 0;
        next = () => setPhase('waiting');
      }
    } else {
      delay = HOLD_AFTER_DELETED_MS;
      next = () => {
        setTextIdx((idx) => (idx + 1) % texts.length);
        setPhase('typing');
      };
    }

    const timer = window.setTimeout(next, delay);
    return () => window.clearTimeout(timer);
    // chars được suy ra từ fullText nên chỉ cần theo dõi fullText
  }, [phase, charCount, textIdx, texts.length, fullText]);

  const typed = chars.slice(0, charCount).join('');
  const isCursorBlinking = phase === 'holding' || phase === 'waiting';

  return (
    <h1 className="typewriter" aria-label={texts.join(' / ').replace(/\n/g, ' ')}>
      {/* Bản ẩn của mọi câu để giữ cố định kích thước khối chữ, không bị nhảy bố cục khi gõ */}
      {texts.map((text, idx) => (
        <span key={idx} className="typewriter-ghost" aria-hidden="true">
          {text}
          <span className="typewriter-cursor">█</span>
        </span>
      ))}
      <span className="typewriter-text" aria-hidden="true">
        {typed}
        <span className={`typewriter-cursor${isCursorBlinking ? ' is-blinking' : ''}`}>█</span>
      </span>
    </h1>
  );
};
