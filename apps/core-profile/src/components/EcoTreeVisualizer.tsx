import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { ShowcaseProject } from '../types/profile';
import { InteractiveFruitButton } from './InteractiveFruitButton';

interface EcoTreeVisualizerProps {
  currentStage: 'seed' | 'sprout' | 'sapling' | 'blooming' | 'mature';
  projects: ShowcaseProject[];
  onSelectProject?: (project: ShowcaseProject) => void;
}

type Pt = [number, number];

// Gốc cây (tâm phóng to khi cây lớn dần qua các giai đoạn)
const TREE_BASE: Pt = [210, 410];

// Thứ tự giai đoạn trên trục "độ lớn" --g (0 = hạt ... 4 = trĩu quả).
// Mọi bộ phận của cây đọc --g để tự mọc ra/thu lại, nên chuyển mốc là một quá trình lớn lên liền mạch
// (cuộn xuống thì chạy ngược lại), không còn ẩn hình cũ rồi hiện hình mới.
const STAGE_INDEX: Record<EcoTreeVisualizerProps['currentStage'], number> = {
  seed: 0,
  sprout: 1,
  sapling: 2,
  blooming: 3,
  mature: 4,
};

// Thời gian lớn lên cho bước giai đoạn đầu tiên (ms); nhảy nhiều mốc thì mỗi bước sau cộng thêm ít hơn
const GROW_FIRST_STEP_MS = 1600;
const GROW_EXTRA_STEP_MS = 650;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Bộ phận mọc ra khi --g đi từ a tới a + d, và (tuỳ chọn) thu lại/rụng khi --g đi từ oa tới oa + od */
interface Grow {
  a: number;
  d: number;
  oa?: number;
  od?: number;
}

// Luôn ghi đủ 4 biến để bộ phận lồng bên trong không thừa hưởng nhầm mốc thời gian của nhóm cha
const growStyle = ({ a, d, oa = 99, od = 1 }: Grow, origin?: Pt): React.CSSProperties =>
  ({
    '--a': a,
    '--d': d,
    '--oa': oa,
    '--od': od,
    ...(origin ? { transformOrigin: `${origin[0]}px ${origin[1]}px` } : {}),
  }) as React.CSSProperties;

// Có mặt ngay từ đầu (g = 0), chỉ dùng cho bộ phận cần biến mất dần
const ALWAYS = { a: -1, d: 1 };

type GrowAt = (index: number) => Grow;

// Bộ sinh số ngẫu nhiên có hạt giống: mỗi lần render tán lá/hoa luôn giống hệt nhau
const seededRandom = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const bezier = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};

const bezierTangent = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  return [
    3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]),
    3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]),
  ];
};

/** Thân/cành cây thon dần từ gốc (w0) tới ngọn (w1) dọc theo đường cong Bézier, ngọn bo tròn. */
const taperedPath = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, w0: number, w1: number, steps = 20) => {
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const [x, y] = bezier(p0, p1, p2, p3, t);
    const [dx, dy] = bezierTangent(p0, p1, p2, p3, t);
    const len = Math.hypot(dx, dy) || 1;
    const half = (w0 + (w1 - w0) * t) / 2;
    const nx = (-dy / len) * half;
    const ny = (dx / len) * half;
    left.push([x + nx, y + ny]);
    right.push([x - nx, y - ny]);
  }
  const fmt = ([x, y]: Pt) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  const tipR = (w1 / 2).toFixed(1);
  return (
    `M${fmt(left[0])} ` +
    left.slice(1).map((p) => `L${fmt(p)}`).join(' ') +
    ` A${tipR} ${tipR} 0 0 1 ${fmt(right[right.length - 1])} ` +
    right.slice(0, -1).reverse().map((p) => `L${fmt(p)}`).join(' ') +
    ' Z'
  );
};

interface Branch {
  p: [Pt, Pt, Pt, Pt];
  w: [number, number];
}

// Khung cây đào trưởng thành. 3 cành chính kết thúc đúng tại vị trí 3 quả đào Microservices.
// Thân kéo lên tới giữa cành chính giữa để chỗ phân nhánh liền mạch, không lộ khía
const TRUNK: Branch = { p: [[210, 412], [203, 350], [216, 290], [207, 225]], w: [46, 20] };
const BRANCHES: Branch[] = [
  // Cành chính trái -> Quả Đào 1 (DevOps K8s)
  { p: [[204, 266], [172, 236], [132, 206], [109, 160]], w: [19, 6] },
  // Cành chính giữa -> Quả Đào 2 (AI Assistant)
  { p: [[208, 258], [198, 205], [216, 145], [210, 98]], w: [21, 7] },
  // Cành chính phải -> Quả Đào 3 (Data Analytics)
  { p: [[213, 266], [250, 236], [290, 208], [311, 164]], w: [19, 6] },
  // Các cành nhỏ toả ra cho tán cây đầy đặn
  { p: [[160, 222], [130, 214], [100, 214], [74, 204]], w: [8, 2.5] },
  { p: [[146, 198], [146, 170], [152, 146], [160, 124]], w: [7, 2.5] },
  { p: [[205, 160], [190, 140], [176, 120], [168, 96]], w: [6, 2] },
  { p: [[212, 168], [232, 146], [250, 130], [266, 116]], w: [7, 2.5] },
  { p: [[264, 222], [292, 216], [320, 216], [348, 206]], w: [8, 2.5] },
  { p: [[286, 202], [284, 176], [276, 152], [262, 136]], w: [6, 2] },
];

// Tâm các chùm tán lá/hoa (đặt quanh đầu cành). 3 chùm đầu nằm ở đầu 3 cành chính nên mọc sớm nhất
const CANOPY_CLUSTERS: { c: Pt; r: number }[] = [
  { c: [108, 158], r: 46 },
  { c: [210, 98], r: 54 },
  { c: [311, 162], r: 46 },
  { c: [160, 120], r: 38 },
  { c: [262, 122], r: 38 },
  { c: [76, 204], r: 32 },
  { c: [346, 206], r: 32 },
  { c: [168, 92], r: 28 },
];
const MAIN_CLUSTERS = 3;

// Màu vầng sáng sau cây theo giai đoạn (chuyển màu mượt bằng CSS transition)
const STAGE_AURA: Record<EcoTreeVisualizerProps['currentStage'], string> = {
  seed: '#ffb38a',
  sprout: '#74c69d',
  sapling: '#74c69d',
  blooming: '#ff8fab',
  mature: '#ffb38a',
};

// ============================================================================
// LỊCH MỌC CỦA TỪNG BỘ PHẬN THEO --g
//   0 -> 1 : hạt thu nhỏ rơi xuống gò đất, nứt vỏ, mầm vươn lên và xoè 2 lá mầm
//   1 -> 2 : mầm hoá thân gỗ, 3 cành chính vươn ra, lá non và nụ đầu tiên
//   2 -> 3 : cành nhỏ toả ra, tán dày lên, nụ bung thành hoa, cánh hoa bắt đầu rơi
//   3 -> 4 : lá phủ kín tán, phần lớn hoa rụng, nụ tàn và quả đào chín
// ============================================================================
const backLeafGrow =
  (cluster: number): GrowAt =>
  (j) => {
    const main = cluster < MAIN_CLUSTERS;
    if (j < 7) return { a: (main ? 2.0 : 2.25) + j * 0.08 + (main ? 0 : cluster * 0.02), d: 0.35 };
    return { a: 3.05 + (j - 7) * 0.12, d: 0.35 };
  };

const frontLeafGrow =
  (cluster: number): GrowAt =>
  (j) => {
    if (cluster < MAIN_CLUSTERS) {
      if (j < 6) return { a: 1.3 + j * 0.09 + cluster * 0.03, d: 0.35 };
      return { a: 3.0 + (j - 6) * 0.15, d: 0.35 };
    }
    if (j < 4) return { a: 2.15 + j * 0.1 + cluster * 0.02, d: 0.35 };
    return { a: 3.0 + (j - 4) * 0.12, d: 0.35 };
  };

const budGrow =
  (cluster: number): GrowAt =>
  (j) => ({
    a: (cluster < MAIN_CLUSTERS ? 1.65 : 2.35) + j * 0.1,
    d: 0.3,
    // Nụ tàn đi khi quả đào bắt đầu chín
    oa: 3.2 + j * 0.1,
    od: 0.3,
  });

const blossomGrow =
  (cluster: number, count: number): GrowAt =>
  (j) => ({
    a: 2.35 + (j / count) * 0.5 + cluster * 0.03,
    d: 0.3,
    // Chỉ giữ lại 3 bông mỗi chùm khi cây trĩu quả, số còn lại rụng dần
    ...(j >= 3 ? { oa: 3.15 + (j / count) * 0.4, od: 0.3 } : {}),
  });

export const EcoTreeVisualizer: React.FC<EcoTreeVisualizerProps> = ({
  currentStage,
  projects,
  onSelectProject,
}) => {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const fruitLayerRef = useRef<HTMLDivElement | null>(null);
  const growthRef = useRef(STAGE_INDEX[currentStage]);
  const isMature = currentStage === 'mature';

  const applyGrowth = (value: number) => {
    growthRef.current = value;
    canvasRef.current?.style.setProperty('--g', value.toFixed(4));
  };

  // Hiện đúng giai đoạn ngay lần vẽ đầu tiên (trước khi trình duyệt vẽ ra màn hình)
  useLayoutEffect(() => {
    applyGrowth(growthRef.current);
  }, []);

  // Đổi mốc: chạy --g từ độ lớn hiện tại tới giai đoạn mới. Nếu đang lớn dở mà người xem lướt tiếp
  // thì nối tiếp từ đúng chỗ đang dừng, cuộn ngược thì cây thu nhỏ ngược lại.
  useEffect(() => {
    const from = growthRef.current;
    const to = STAGE_INDEX[currentStage];
    const distance = Math.abs(to - from);
    if (distance < 0.001 || prefersReducedMotion()) {
      applyGrowth(to);
      return;
    }

    const duration =
      GROW_FIRST_STEP_MS * Math.min(distance, 1) + GROW_EXTRA_STEP_MS * Math.max(distance - 1, 0);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      applyGrowth(from + (to - from) * easeInOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [currentStage]);

  // Quả đào chỉ bấm được (và lấy focus bàn phím) khi đã ở mốc trĩu quả
  useEffect(() => {
    const layer = fruitLayerRef.current as (HTMLDivElement & { inert?: boolean }) | null;
    if (layer) layer.inert = !isMature;
  }, [isMature]);

  // Tọa độ các Quả Đào Microservices trên cành cây đào
  const fruitPositions: Record<string, { x: number; y: number }> = {
    'devops-k8s': { x: 26, y: 35 },
    'ai-assistant': { x: 50, y: 22 },
    'data-analytics': { x: 74, y: 36 },
  };

  // Lá đào: thon dài, đầu nhọn, có gân giữa và nửa lá gấp nếp tối hơn. Mọc ra từ cuống (toạ độ 0 0)
  const renderLeaf = (key: string, x: number, y: number, rotation: number, scale: number, grow: Grow, dark = false) => (
    <g key={key} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotation.toFixed(1)}) scale(${scale.toFixed(2)})`}>
      <g className="grow" style={growStyle(grow)}>
        <path d="M0 0 C 7 -6, 10 -20, 0 -34 C -10 -20, -7 -6, 0 0 Z" fill={dark ? 'url(#leafDark)' : 'url(#leafLight)'} />
        <path d="M0 0 C 7 -6, 10 -20, 0 -34 L 0 0 Z" fill="#081c15" opacity={dark ? 0.25 : 0.18} />
        <path d="M0 -1 Q 1 -17 0 -32" stroke="#1b4332" strokeWidth="0.9" fill="none" opacity="0.7" />
      </g>
    </g>
  );

  // Hoa đào 5 cánh: cánh tròn có khía ở đầu, chuyển màu hồng đậm -> trắng hồng, nhuỵ vàng.
  // Khi nở thì vừa lớn vừa xoay nhẹ như nụ đang bung cánh
  const renderBlossom = (key: string, x: number, y: number, rotation: number, scale: number, grow: Grow) => (
    <g
      key={key}
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotation.toFixed(1)}) scale(${scale.toFixed(2)})`}
      className="peach-blossom-group"
    >
      <g className="grow grow--bloom" style={growStyle(grow)}>
        {[0, 72, 144, 216, 288].map((angle) => (
          <path
            key={angle}
            d="M0 0 C -8 -3, -11 -13, -5 -18 Q 0 -15.5, 5 -18 C 11 -13, 8 -3, 0 0 Z"
            transform={`rotate(${angle})`}
            fill="url(#petalGrad)"
            stroke="#ff8fab"
            strokeWidth="0.5"
          />
        ))}
        <circle r="4.2" fill="#ff4d6d" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <g key={angle} transform={`rotate(${angle})`}>
            <line x1="0" y1="-2" x2="0" y2="-7" stroke="#c9184a" strokeWidth="0.7" />
            <circle cy="-7.3" r="1.1" fill="#ffd166" />
          </g>
        ))}
      </g>
    </g>
  );

  // Nụ hoa đào hồng chúm chím với đài xanh
  const renderBud = (key: string, x: number, y: number, rotation: number, scale: number, grow: Grow) => (
    <g key={key} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotation.toFixed(1)}) scale(${scale})`}>
      <g className="grow" style={growStyle(grow)}>
        <path d="M0 0 C -5 -4, -5 -11, 0 -15 C 5 -11, 5 -4, 0 0 Z" fill="url(#budGrad)" />
        <path d="M0 0 C -4 -1, -5 -5, -3 -7 L 0 -3 L 3 -7 C 5 -5, 4 -1, 0 0 Z" fill="#40916c" />
      </g>
    </g>
  );

  // Một chùm lá/hoa rải quanh tâm theo bộ sinh ngẫu nhiên có hạt giống
  const renderCluster = (
    prefix: string,
    { c, r }: { c: Pt; r: number },
    seed: number,
    kind: 'leaf' | 'leafDark' | 'blossom' | 'bud',
    count: number,
    growAt: GrowAt,
    sizeScale = 1
  ) => {
    const rand = seededRandom(seed);
    const items = Array.from({ length: count }, (_, i) => {
      const angle = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * r;
      const x = c[0] + Math.cos(angle) * dist;
      const y = c[1] + Math.sin(angle) * dist * 0.85;
      const outward = (angle * 180) / Math.PI + 90;
      const key = `${prefix}-${i}`;
      const grow = growAt(i);
      if (kind === 'blossom') return renderBlossom(key, x, y, rand() * 72, (0.75 + rand() * 0.45) * sizeScale, grow);
      if (kind === 'bud') return renderBud(key, x, y, outward + (rand() - 0.5) * 40, 0.9 * sizeScale, grow);
      return renderLeaf(key, x, y, outward + (rand() - 0.5) * 50, (0.75 + rand() * 0.45) * sizeScale, grow, kind === 'leafDark');
    });
    // Mỗi chùm rung riêng quanh tâm chùm, lệch nhịp nhau như có gió lùa qua tán
    return (
      <g
        key={prefix}
        className="canopy-flutter"
        style={{
          transformOrigin: `${c[0]}px ${c[1]}px`,
          animationDuration: `${(3.2 + (seed % 5) * 0.45).toFixed(2)}s`,
          animationDelay: `${(-(seed % 7) * 0.6).toFixed(2)}s`,
        }}
      >
        {items}
      </g>
    );
  };

  // Gò đất và thảm cỏ cắt giấy ở gốc cây: nhô lên khi hạt rơi xuống, rộng dần theo tán cây
  const renderGround = () => {
    const halfWidth = 150;
    const [cx, cy] = TREE_BASE;
    const rand = seededRandom(7);
    const blades: React.ReactNode[] = [];
    for (let x = cx - halfWidth + 8; x < cx + halfWidth - 8; x += 7) {
      const h = 8 + rand() * 14;
      const lean = (rand() - 0.5) * 8;
      blades.push(
        <path
          key={x}
          d={`M${x - 3} ${cy + 6} Q ${x + lean * 0.5} ${cy - h * 0.5}, ${x + lean} ${cy - h} Q ${x + 1 + lean * 0.3} ${cy - h * 0.4}, ${x + 3} ${cy + 6} Z`}
          fill={rand() > 0.5 ? '#52b788' : '#40916c'}
        />
      );
    }
    return (
      <g className="ground-spread">
        <g className="grow" style={growStyle({ a: 0.3, d: 0.35 }, TREE_BASE)}>
          <g filter="url(#softShadow)">
            <path
              d={`M${cx - halfWidth} ${cy + 8} C ${cx - halfWidth * 0.6} ${cy - 10}, ${cx + halfWidth * 0.6} ${cy - 10}, ${cx + halfWidth} ${cy + 8} C ${cx + halfWidth * 0.6} ${cy + 22}, ${cx - halfWidth * 0.6} ${cy + 22}, ${cx - halfWidth} ${cy + 8} Z`}
              fill="url(#soilGrad)"
            />
            {blades}
          </g>
        </g>
      </g>
    );
  };

  // Cánh hoa rơi lả tả (hoạt ảnh CSS): bắt đầu rơi khi hoa nở, thưa dần khi cây kết quả
  const renderFallingPetals = () => {
    const rand = seededRandom(5);
    return Array.from({ length: 7 }, (_, i) => (
      <g
        key={i}
        className="grow grow--fade"
        style={growStyle({ a: 2.6 + i * 0.04, d: 0.35, ...(i >= 4 ? { oa: 3.5, od: 0.4 } : {}) })}
      >
        <g transform={`translate(${(90 + rand() * 240).toFixed(1)} ${(120 + rand() * 80).toFixed(1)})`}>
          <g className="falling-petal" style={{ animationDelay: `${(i * 1.7 + rand()).toFixed(2)}s` }}>
            <path d="M0 0 C -5 -2, -7 -9, -3 -12 Q 0 -10, 3 -12 C 7 -9, 5 -2, 0 0 Z" fill="url(#petalGrad)" />
          </g>
        </g>
      </g>
    ));
  };

  // Mầm cây: thân non vươn lên từ hạt nứt, xoè 2 lá mầm; hoá gỗ (mờ dần) khi thân cây đào mọc lên
  const renderSprout = () => (
    <g className="grow grow--fade" style={growStyle({ ...ALWAYS, oa: 1.15, od: 0.4 })}>
      <g className="tree-sway tree-sway--strong">
        <g className="grow grow--stem" style={growStyle({ a: 0.5, d: 0.35 }, [210, 404])}>
          <path d={taperedPath([210, 404], [204, 362], [218, 332], [210, 290], 9, 5)} fill="#74a57f" filter="url(#paperShadow)" />
          <path d="M207 400 C 203 365, 214 334, 208 294" stroke="#b7e4c7" strokeWidth="1.4" fill="none" opacity="0.5" />
        </g>
        {/* 2 lá mầm tròn xoè ra từ ngọn thân */}
        <g className="grow" style={growStyle({ a: 0.72, d: 0.28 }, [210, 292])} filter="url(#paperShadow)">
          <path d="M209 292 C 196 280, 168 276, 146 288 C 160 306, 192 308, 209 292 Z" fill="url(#leafLight)" />
          <path d="M209 292 C 196 280, 168 276, 146 288 C 172 290, 194 293, 209 292 Z" fill="#081c15" opacity="0.2" />
          <path d="M211 292 C 224 278, 252 272, 276 282 C 262 302, 230 306, 211 292 Z" fill="url(#leafLight)" />
          <path d="M211 292 C 224 278, 252 272, 276 282 C 250 286, 228 290, 211 292 Z" fill="#081c15" opacity="0.2" />
        </g>
        {/* Chồi non ở ngọn */}
        {renderLeaf('top-l', 210, 292, -18, 0.7, { a: 0.84, d: 0.2 })}
        {renderLeaf('top-r', 210, 292, 22, 0.6, { a: 0.88, d: 0.2 })}
      </g>
    </g>
  );

  // Vỏ hạt đào nứt đôi nằm trên gò đất: tách ra khi mầm nhú, mục dần vào đất khi cây lớn
  const renderSeedShell = () => (
    <g filter="url(#paperShadow)">
      <g className="grow grow--split-l" style={growStyle({ a: 0.42, d: 0.25, oa: 1.2, od: 0.45 }, [210, 410])}>
        <path d="M206 404 C 196 392, 180 390, 170 398 C 168 410, 184 418, 204 412 Z" fill="url(#peachSeedGrad)" stroke="#2e180f" strokeWidth="1" />
        <path d="M178 401 C 186 398, 194 400, 200 405" stroke="#2a150d" strokeWidth="1.6" fill="none" />
      </g>
      <g className="grow grow--split-r" style={growStyle({ a: 0.42, d: 0.25, oa: 1.2, od: 0.45 }, [210, 410])}>
        <path d="M214 404 C 226 394, 242 394, 250 402 C 250 413, 234 418, 216 412 Z" fill="url(#peachSeedGrad)" stroke="#2e180f" strokeWidth="1" />
        <path d="M224 402 C 232 399, 240 400, 245 405" stroke="#2a150d" strokeWidth="1.6" fill="none" />
      </g>
    </g>
  );

  // Hạt đào nguyên vẹn: dáng hạnh nhân một đầu nhọn, đường gờ dọc, rãnh nhăn nổi khối.
  // Khi lên mốc mầm thì thu nhỏ, rơi xuống gò đất rồi nhường chỗ cho vỏ hạt nứt đôi
  const renderSeed = () => (
    <>
      <g className="grow grow--fade" style={growStyle({ ...ALWAYS, oa: 0, od: 0.35 })}>
        <ellipse cx="210" cy="392" rx="78" ry="11" fill="#000" opacity="0.3" />
      </g>
      <g className="seed-travel">
        <g className="grow grow--fade" style={growStyle({ ...ALWAYS, oa: 0.42, od: 0.16 })}>
          <g className="seed-float" filter="url(#deepPaperShadow)">
            <path
              d="M210 132 C 262 168, 288 240, 272 302 C 260 348, 236 374, 210 378 C 184 374, 160 348, 148 302 C 132 240, 158 168, 210 132 Z"
              fill="url(#peachSeedGrad)"
              stroke="#2e180f"
              strokeWidth="1.5"
            />
            {/* Rãnh nhăn: nét tối + viền sáng bên cạnh tạo cảm giác lõm sâu */}
            <g fill="none" strokeLinecap="round">
              {[
                'M190 176 C 176 200, 171 226, 178 250',
                'M171 218 C 161 244, 162 272, 172 296',
                'M196 208 C 186 232, 186 256, 194 276',
                'M166 306 C 172 330, 184 348, 198 360',
                'M186 294 C 186 316, 192 334, 203 346',
                'M201 244 C 196 262, 197 280, 203 296',
                'M232 176 C 246 200, 251 226, 244 250',
                'M251 218 C 261 244, 260 272, 250 296',
                'M226 208 C 236 232, 236 256, 228 276',
                'M256 306 C 250 330, 238 348, 224 360',
                'M236 294 C 236 316, 230 334, 219 346',
                'M221 244 C 226 262, 225 280, 219 296',
                'M180 270 C 177 280, 178 290, 182 300',
                'M242 270 C 245 280, 244 290, 240 300',
              ].map((d, i) => (
                <g key={i}>
                  <path d={d} stroke="#2a150d" strokeWidth="3.4" opacity="0.85" />
                  <path d={d} stroke="#d6a183" strokeWidth="1.1" opacity="0.4" transform="translate(1.6 1.4)" />
                </g>
              ))}
            </g>
            {/* Đường gờ dọc giữa hạt */}
            <path d="M210 138 C 222 196, 224 292, 211 372" stroke="#2a150d" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d="M207 140 C 218 198, 219 290, 207 370" stroke="#e0b394" strokeWidth="1.4" fill="none" opacity="0.5" strokeLinecap="round" />
            {/* Vệt bóng sáng */}
            <path d="M178 190 C 168 214, 164 240, 168 262" stroke="#f3d2bd" strokeWidth="5" fill="none" opacity="0.18" strokeLinecap="round" />
            {/* Sẹo cuống ở đáy hạt */}
            <ellipse cx="210" cy="371" rx="8" ry="4" fill="#2a150d" opacity="0.8" />
          </g>
        </g>
      </g>
    </>
  );

  // Cây đào: một khung cây duy nhất lớn dần từ gốc, cành/lá/nụ/hoa mọc thêm theo lịch phía trên
  const renderTree = () => (
    <g className="tree-growth">
      {/* Lắc mạnh khi còn non, nhẹ dần khi trĩu quả để nút quả đào (lớp HTML phía trên) không lệch đầu cành */}
      <g className="tree-sway tree-sway--growing">
        {/* Lớp tán phía sau (tối hơn) tạo chiều sâu cắt giấy nhiều lớp */}
        <g filter="url(#softShadow)" opacity="0.9">
          {CANOPY_CLUSTERS.map((cl, i) => renderCluster(`back-${i}`, cl, 100 + i, 'leafDark', 12, backLeafGrow(i), 1.05))}
        </g>

        {/* Thân & cành gỗ nâu thon dần về ngọn */}
        <g filter="url(#paperShadow)">
          {/* Vẽ thân trước, cành sau để gốc cành phủ lên thân, chỗ phân nhánh liền mạch.
              Thân hoá gỗ từ thân mầm: vươn lên từ gốc trong lúc thân mầm mờ đi */}
          <g className="grow grow--stem" style={growStyle({ a: 0.95, d: 0.45 }, [210, 412])}>
            <path d={taperedPath(...TRUNK.p, ...TRUNK.w)} fill="url(#barkGrad)" />
          </g>
          {BRANCHES.map((b, i) => (
            <g
              key={i}
              className="grow"
              style={growStyle(i < 3 ? { a: 1.15 + i * 0.08, d: 0.45 } : { a: 2.0 + (i - 3) * 0.07, d: 0.45 }, b.p[0])}
            >
              <path d={taperedPath(...b.p, ...b.w)} fill="url(#barkGrad)" />
            </g>
          ))}
          <g className="grow grow--fade" style={growStyle({ a: 1.2, d: 0.5 })}>
            {/* Rễ loe ở gốc */}
            <path d="M188 412 C 182 404, 176 402, 166 404 C 178 398, 190 396, 196 400 Z" fill="url(#barkGrad)" />
            <path d="M232 412 C 238 404, 244 402, 256 405 C 244 398, 230 396, 224 400 Z" fill="url(#barkGrad)" />
            {/* Vân vỏ cây */}
            <g stroke="#2b1810" strokeWidth="1.4" fill="none" opacity="0.45" strokeLinecap="round">
              <path d="M200 395 C 197 370, 203 345, 199 320" />
              <path d="M214 400 C 219 372, 213 340, 218 312" />
              <path d="M207 300 C 204 285, 209 272, 206 262" />
            </g>
            <path d="M196 400 C 192 360, 200 320, 196 268" stroke="#c08a6c" strokeWidth="2.2" fill="none" opacity="0.35" strokeLinecap="round" />
          </g>
        </g>

        {/* Lớp tán phía trước: lá -> hoa -> nụ */}
        {CANOPY_CLUSTERS.map((cl, i) => renderCluster(`leaf-${i}`, cl, 200 + i, 'leaf', 10, frontLeafGrow(i)))}
        {CANOPY_CLUSTERS.map((cl, i) => {
          const count = i < MAIN_CLUSTERS ? 9 : 6;
          return renderCluster(`bloom-${i}`, cl, 400 + i, 'blossom', count, blossomGrow(i, count));
        })}
        {CANOPY_CLUSTERS.map((cl, i) =>
          renderCluster(`bud-${i}`, cl, 300 + i, 'bud', 2, budGrow(i), i < MAIN_CLUSTERS ? 1.2 : 1)
        )}
      </g>
    </g>
  );

  const aura = STAGE_AURA[currentStage];

  return (
    <div className="tree-sticky-card tree-sticky-card--bare">
      {/* SVG Canvas Cây Đào & Hạt Đào Nghệ Thuật Cắt Giấy */}
      <div
        ref={canvasRef}
        className="eco-tree-canvas"
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1.15',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          viewBox="0 0 420 460"
          style={{
            width: '100%',
            height: '100%',
            overflow: 'visible',
          }}
        >
          <defs>
            {/* Bóng đổ giấy cắt nổi nhiều lớp */}
            <filter id="paperShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="1.5" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity="0.45" />
            </filter>
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.35" />
            </filter>
            <filter id="deepPaperShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="3" dy="8" stdDeviation="7" floodColor="#000" floodOpacity="0.55" />
            </filter>

            {/* Vầng sáng mờ phía sau cây, chuyển màu dần theo giai đoạn */}
            <radialGradient id="auraGrad">
              <stop offset="0%" className="aura-stop" style={{ stopColor: aura, stopOpacity: 0.22 }} />
              <stop offset="60%" className="aura-stop" style={{ stopColor: aura, stopOpacity: 0.06 }} />
              <stop offset="100%" className="aura-stop" style={{ stopColor: aura, stopOpacity: 0 }} />
            </radialGradient>

            {/* Vỏ cây: ánh sáng chiếu từ trái. Dùng chung toạ độ cả cây (userSpaceOnUse) để thân và
                cành trùng màu ở chỗ chồng lên nhau -> chỗ phân nhánh liền mạch, không lộ vết cắt */}
            <linearGradient id="barkGrad" gradientUnits="userSpaceOnUse" x1="186" y1="0" x2="236" y2="0">
              <stop offset="0%" stopColor="#9a6a50" />
              <stop offset="50%" stopColor="#6f4532" />
              <stop offset="100%" stopColor="#4a2b1d" />
            </linearGradient>

            <linearGradient id="leafLight" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#2d6a4f" />
              <stop offset="100%" stopColor="#95d5b2" />
            </linearGradient>
            <linearGradient id="leafDark" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#1b4332" />
              <stop offset="100%" stopColor="#40916c" />
            </linearGradient>

            <radialGradient id="petalGrad" cx="50%" cy="85%" r="85%">
              <stop offset="0%" stopColor="#ff4d6d" />
              <stop offset="45%" stopColor="#ffb3c6" />
              <stop offset="100%" stopColor="#fff0f3" />
            </radialGradient>
            <linearGradient id="budGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#c9184a" />
              <stop offset="100%" stopColor="#ff8fab" />
            </linearGradient>

            <linearGradient id="soilGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#6b4a3a" />
              <stop offset="100%" stopColor="#2e1c14" />
            </linearGradient>

            {/* Hạt đào: khối gỗ bóng sáng góc trên trái, tối dần xuống dưới phải */}
            <radialGradient id="peachSeedGrad" cx="38%" cy="32%" r="75%">
              <stop offset="0%" stopColor="#c08a6c" />
              <stop offset="45%" stopColor="#8a573f" />
              <stop offset="100%" stopColor="#4a2a1d" />
            </radialGradient>
          </defs>

          {/* Vầng sáng nền */}
          <ellipse cx="210" cy="235" rx="200" ry="210" fill="url(#auraGrad)" />

          {/* Thứ tự lớp: cây -> mầm -> gò đất -> vỏ hạt nứt -> hạt nguyên vẹn -> cánh hoa rơi.
              Tất cả luôn có mặt, ẩn/hiện và lớn/nhỏ theo --g nên chuyển mốc là hoạt ảnh liền mạch */}
          {renderTree()}
          {renderSprout()}
          {renderGround()}
          {renderSeedShell()}
          {renderSeed()}
          {renderFallingPetals()}
        </svg>

        {/* CÁC NÚT BẤM QUẢ ĐÀO MICROSERVICES: chín dần ở cuối giai đoạn trĩu quả, chỉ bấm được ở mốc hiện tại */}
        <div ref={fruitLayerRef} className={`fruit-layer${isMature ? ' is-ready' : ''}`} aria-hidden={!isMature}>
          {projects.map((proj, i) => {
            const pos = fruitPositions[proj.id] || proj.fruitPosition || { x: 50, y: 50 };
            return (
              <div
                key={proj.id}
                className="fruit-grow"
                style={{ ...growStyle({ a: 3.45 + i * 0.12, d: 0.35 }), transformOrigin: `${pos.x}% ${pos.y}%` }}
              >
                <InteractiveFruitButton project={proj} position={pos} onSelect={onSelectProject} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
