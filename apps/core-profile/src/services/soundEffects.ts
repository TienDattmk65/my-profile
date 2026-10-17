// Hiệu ứng âm thanh tổng hợp bằng Web Audio API (không cần file âm thanh):
// - Tiếng "tút" kiểu terminal cho chữ đánh máy ở trang khởi đầu
// - Tiếng "vút" khi chuyển giữa các trang mốc timeline
//
// Trình duyệt chỉ cho phát âm thanh sau lần tương tác đầu tiên của người xem (click/chạm/phím),
// nên AudioContext chỉ được tạo ở lần tương tác đó. Lăn chuột không được tính là tương tác.

const STORAGE_KEY = 'core-profile:sound-enabled';

type Listener = (state: SoundState) => void;

export interface SoundState {
  /** Người xem có bật âm thanh không (lưu trong trình duyệt) */
  enabled: boolean;
  /** Trình duyệt đã cho phép phát âm thanh chưa (sau lần tương tác đầu tiên) */
  unlocked: boolean;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let enabled = readEnabled();
const listeners = new Set<Listener>();

function readEnabled() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

const getState = (): SoundState => ({ enabled, unlocked: ctx?.state === 'running' });
const notify = () => listeners.forEach((fn) => fn(getState()));

export function subscribeSound(fn: Listener) {
  listeners.add(fn);
  fn(getState());
  return () => {
    listeners.delete(fn);
  };
}

export function setSoundEnabled(value: boolean) {
  enabled = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off');
  } catch {
    // Trình duyệt chặn lưu trữ: vẫn bật/tắt được trong phiên hiện tại
  }
  notify();
}

/** Gọi trong sự kiện click/chạm/phím để trình duyệt cho phép phát âm thanh. */
export function unlockAudio() {
  if (!ctx) {
    const AudioCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    ctx.addEventListener('statechange', notify);
  }
  if (ctx.state === 'suspended') ctx.resume().then(notify, () => {});
  notify();
}

/** Tự mở khoá âm thanh ở lần click/chạm/bấm phím đầu tiên trên trang. */
export function installAudioUnlock() {
  const events = ['pointerdown', 'keydown', 'touchend'] as const;
  const handler = () => unlockAudio();
  events.forEach((name) => window.addEventListener(name, handler, { passive: true }));
  return () => events.forEach((name) => window.removeEventListener(name, handler));
}

function canPlay(): AudioContext | null {
  // Cho phép cả lúc đang "suspended" ngay sau lần bấm đầu (resume() chưa xong): tiếng được xếp hàng
  // và phát ngay khi trình duyệt mở khoá, nên tiếng "vút" của cú bấm đầu tiên không bị mất
  if (!enabled || !ctx || !master || ctx.state === 'closed' || document.hidden) return null;
  return ctx;
}

function getNoise(audio: AudioContext) {
  if (!noiseBuffer) {
    noiseBuffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 1.2), audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// Các nốt bíp xoay vòng (Hz) để tiếng "tút" không đều đều như một nốt duy nhất
const BEEP_NOTES = [880, 988, 1047, 1175];

/** Tiếng "tút" kiểu terminal/máy tính cổ: bíp sóng vuông rất ngắn, phím cách bíp trầm hơn. */
export function playKeyClick(isSpace = false) {
  const audio = canPlay();
  if (!audio || !master) return;
  const t = audio.currentTime;
  const duration = isSpace ? 0.06 : 0.045;
  const freq = isSpace ? 523 : BEEP_NOTES[Math.floor(Math.random() * BEEP_NOTES.length)];

  const beep = audio.createOscillator();
  beep.type = 'square';
  beep.frequency.setValueAtTime(freq, t);

  // Lọc bớt hài âm cao cho tiếng bíp tròn, không chói tai
  const tone = audio.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 3200;

  // Bật/tắt thật nhanh nhưng có dốc nhỏ để không bị tiếng "lụp bụp"
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.09, t + 0.004);
  gain.gain.setValueAtTime(0.09, t + duration - 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  beep.connect(tone).connect(gain).connect(master);
  beep.start(t);
  beep.stop(t + duration + 0.01);
}

/** Tiếng "vút" khi lướt sang mốc khác: lên = cao dần, xuống = trầm dần. */
export function playWhoosh(direction: 'up' | 'down', duration = 0.75) {
  const audio = canPlay();
  if (!audio || !master) return;
  const t = audio.currentTime;
  const [from, to] = direction === 'up' ? [450, 2600] : [2600, 450];

  // Luồng gió: nhiễu trắng qua lọc dải tần quét từ thấp lên cao (hoặc ngược lại)
  const noise = audio.createBufferSource();
  noise.buffer = getNoise(audio);
  const band = audio.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 0.9;
  band.frequency.setValueAtTime(from, t);
  band.frequency.exponentialRampToValueAtTime(to, t + duration * 0.85);
  const airGain = audio.createGain();
  airGain.gain.setValueAtTime(0.0001, t);
  airGain.gain.exponentialRampToValueAtTime(0.32, t + duration * 0.35);
  airGain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  noise.connect(band).connect(airGain).connect(master);
  noise.start(t, 0, duration + 0.05);

  // Một nốt ngân rất nhẹ đi kèm để tiếng vút có "màu" hơn
  const tone = audio.createOscillator();
  tone.type = 'sine';
  tone.frequency.setValueAtTime(direction === 'up' ? 330 : 660, t);
  tone.frequency.exponentialRampToValueAtTime(direction === 'up' ? 660 : 330, t + duration * 0.8);
  const toneGain = audio.createGain();
  toneGain.gain.setValueAtTime(0.0001, t);
  toneGain.gain.exponentialRampToValueAtTime(0.05, t + duration * 0.3);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  tone.connect(toneGain).connect(master);
  tone.start(t);
  tone.stop(t + duration + 0.05);
}
