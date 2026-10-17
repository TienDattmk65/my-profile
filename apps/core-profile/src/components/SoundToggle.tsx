import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { SoundState, installAudioUnlock, setSoundEnabled, subscribeSound, unlockAudio } from '../services/soundEffects';

// Nút bật/tắt hiệu ứng âm thanh ở góc trên phải.
// Trình duyệt chặn âm thanh tới lần click/chạm đầu tiên -> lúc đó nút nhấp nháy nhẹ để gợi ý bấm.
export const SoundToggle: React.FC = () => {
  const [state, setState] = useState<SoundState>({ enabled: true, unlocked: false });

  useEffect(() => installAudioUnlock(), []);
  useEffect(() => subscribeSound(setState), []);

  const isWaitingUnlock = state.enabled && !state.unlocked;
  const isOn = state.enabled && state.unlocked;
  // Ghi nhận trạng thái ngay lúc nhấn: sự kiện nhấn (pointerdown/keydown) đã mở khoá âm thanh
  // trước khi click chạy, nếu đọc trạng thái lúc click thì lần bấm đầu sẽ bị hiểu nhầm thành "tắt"
  const wasWaitingRef = useRef(false);
  const rememberState = () => {
    wasWaitingRef.current = isWaitingUnlock;
  };

  const handleClick = () => {
    if (wasWaitingRef.current) {
      wasWaitingRef.current = false;
      unlockAudio(); // Lần bấm đầu: chỉ mở khoá, giữ nguyên trạng thái bật
      return;
    }
    if (!state.enabled) unlockAudio();
    setSoundEnabled(!state.enabled);
  };

  const label = isWaitingUnlock ? 'Bấm để bật âm thanh' : isOn ? 'Tắt âm thanh' : 'Bật âm thanh';

  return (
    <button
      type="button"
      className={`sound-toggle${isWaitingUnlock ? ' is-waiting' : ''}${isOn ? ' is-on' : ''}`}
      onPointerDown={rememberState}
      onKeyDown={rememberState}
      onClick={handleClick}
      aria-pressed={isOn}
      aria-label={label}
      title={label}
    >
      {state.enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </button>
  );
};
