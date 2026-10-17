import React from 'react';
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

// Tâm các chùm tán lá/hoa (đặt quanh đầu cành)
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

// Tỉ lệ cây ở từng giai đoạn: cùng một dáng cây lớn dần theo năm tháng
const STAGE_SCALE = { sapling: 0.6, blooming: 0.86, mature: 1 } as const;

const STAGE_AURA: Record<EcoTreeVisualizerProps['currentStage'], string> = {
  seed: '#ffb38a',
  sprout: '#74c69d',
  sapling: '#74c69d',
  blooming: '#ff8fab',
  mature: '#ffb38a',
};

export const EcoTreeVisualizer: React.FC<EcoTreeVisualizerProps> = ({
  currentStage,
  projects,
  onSelectProject,
}) => {
  // Tọa độ các Quả Đào Microservices trên cành cây đào
  const fruitPositions: Record<string, { x: number; y: number }> = {
    'devops-k8s': { x: 26, y: 35 },
    'ai-assistant': { x: 50, y: 22 },
    'data-analytics': { x: 74, y: 36 },
  };

  // Lá đào: thon dài, đầu nhọn, có gân giữa và nửa lá gấp nếp tối hơn
  const renderLeaf = (key: string, x: number, y: number, rotation: number, scale: number, dark = false) => (
    <g key={key} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotation.toFixed(1)}) scale(${scale.toFixed(2)})`}>
      <path d="M0 0 C 7 -6, 10 -20, 0 -34 C -10 -20, -7 -6, 0 0 Z" fill={dark ? 'url(#leafDark)' : 'url(#leafLight)'} />
      <path d="M0 0 C 7 -6, 10 -20, 0 -34 L 0 0 Z" fill="#081c15" opacity={dark ? 0.25 : 0.18} />
      <path d="M0 -1 Q 1 -17 0 -32" stroke="#1b4332" strokeWidth="0.9" fill="none" opacity="0.7" />
    </g>
  );

  // Hoa đào 5 cánh: cánh tròn có khía ở đầu, chuyển màu hồng đậm -> trắng hồng, nhuỵ vàng
  const renderBlossom = (key: string, x: number, y: number, rotation: number, scale: number) => (
    <g
      key={key}
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotation.toFixed(1)}) scale(${scale.toFixed(2)})`}
      className="peach-blossom-group"
    >
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
  );

  // Nụ hoa đào hồng chúm chím với đài xanh
  const renderBud = (key: string, x: number, y: number, rotation: number, scale = 1) => (
    <g key={key} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotation.toFixed(1)}) scale(${scale})`}>
      <path d="M0 0 C -5 -4, -5 -11, 0 -15 C 5 -11, 5 -4, 0 0 Z" fill="url(#budGrad)" />
      <path d="M0 0 C -4 -1, -5 -5, -3 -7 L 0 -3 L 3 -7 C 5 -5, 4 -1, 0 0 Z" fill="#40916c" />
    </g>
  );

  // Một chùm lá/hoa rải quanh tâm theo bộ sinh ngẫu nhiên có hạt giống
  const renderCluster = (
    prefix: string,
    { c, r }: { c: Pt; r: number },
    seed: number,
    kind: 'leaf' | 'leafDark' | 'blossom' | 'bud',
    count: number,
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
      if (kind === 'blossom') return renderBlossom(key, x, y, rand() * 72, (0.75 + rand() * 0.45) * sizeScale);
      if (kind === 'bud') return renderBud(key, x, y, outward + (rand() - 0.5) * 40, 0.9 * sizeScale);
      return renderLeaf(key, x, y, outward + (rand() - 0.5) * 50, (0.75 + rand() * 0.45) * sizeScale, kind === 'leafDark');
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

  // Gò đất và thảm cỏ cắt giấy ở gốc cây
  const renderGround = (halfWidth: number) => {
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
      <g filter="url(#softShadow)">
        <path
          d={`M${cx - halfWidth} ${cy + 8} C ${cx - halfWidth * 0.6} ${cy - 10}, ${cx + halfWidth * 0.6} ${cy - 10}, ${cx + halfWidth} ${cy + 8} C ${cx + halfWidth * 0.6} ${cy + 22}, ${cx - halfWidth * 0.6} ${cy + 22}, ${cx - halfWidth} ${cy + 8} Z`}
          fill="url(#soilGrad)"
        />
        {blades}
      </g>
    );
  };

  // Cánh hoa rơi lả tả (hoạt ảnh CSS)
  const renderFallingPetals = (seed: number, count: number) => {
    const rand = seededRandom(seed);
    return Array.from({ length: count }, (_, i) => (
      <g key={i} transform={`translate(${(90 + rand() * 240).toFixed(1)} ${(120 + rand() * 80).toFixed(1)})`}>
        <g className="falling-petal" style={{ animationDelay: `${(i * 1.7 + rand()).toFixed(2)}s` }}>
          <path d="M0 0 C -5 -2, -7 -9, -3 -12 Q 0 -10, 3 -12 C 7 -9, 5 -2, 0 0 Z" fill="url(#petalGrad)" />
        </g>
      </g>
    ));
  };

  // Cây đào (non / nở hoa / trĩu quả): cùng một khung cây, phóng to dần từ gốc
  const renderTree = (stage: keyof typeof STAGE_SCALE) => {
    const scale = STAGE_SCALE[stage];
    const [bx, by] = TREE_BASE;
    const isSapling = stage === 'sapling';
    const branches = isSapling ? BRANCHES.slice(0, 3) : BRANCHES;
    const clusters = isSapling ? CANOPY_CLUSTERS.slice(0, 3) : CANOPY_CLUSTERS;

    return (
      <g transform={`translate(${bx} ${by}) scale(${scale}) translate(${-bx} ${-by})`}>
        {/* Cây trĩu quả chỉ lắc nhẹ phần thân để các nút quả đào (lớp HTML phía trên) không lệch khỏi đầu cành */}
        <g className={`tree-sway${stage === 'mature' ? ' tree-sway--gentle' : ''}`}>
          {/* Lớp tán phía sau (tối hơn) tạo chiều sâu cắt giấy nhiều lớp */}
          {stage !== 'sapling' && (
            <g filter="url(#softShadow)" opacity="0.9">
              {clusters.map((cl, i) => renderCluster(`back-${i}`, cl, 100 + i, 'leafDark', stage === 'mature' ? 12 : 7, 1.05))}
            </g>
          )}

          {/* Thân & cành gỗ nâu thon dần về ngọn */}
          <g filter="url(#paperShadow)">
            {/* Vẽ thân trước, cành sau để gốc cành phủ lên thân, chỗ phân nhánh liền mạch */}
            <path d={taperedPath(...TRUNK.p, ...TRUNK.w)} fill="url(#barkGrad)" />
            {branches.map((b, i) => (
              <path key={i} d={taperedPath(...b.p, ...b.w)} fill="url(#barkGrad)" />
            ))}
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

          {/* Lớp tán phía trước */}
          {stage === 'sapling' && (
            <>
              {clusters.map((cl, i) => renderCluster(`leaf-${i}`, { c: cl.c, r: cl.r * 0.6 }, 200 + i, 'leaf', 6, 1.15))}
              {clusters.map((cl, i) => renderCluster(`bud-${i}`, { c: cl.c, r: cl.r * 0.5 }, 300 + i, 'bud', 2, 1.3))}
            </>
          )}
          {stage === 'blooming' && (
            <>
              {clusters.map((cl, i) => renderCluster(`leaf-${i}`, cl, 200 + i, 'leaf', 4))}
              {clusters.map((cl, i) => renderCluster(`bloom-${i}`, cl, 400 + i, 'blossom', i < 3 ? 9 : 6))}
              {clusters.map((cl, i) => renderCluster(`bud-${i}`, cl, 300 + i, 'bud', 2))}
            </>
          )}
          {stage === 'mature' && (
            <>
              {clusters.map((cl, i) => renderCluster(`leaf-${i}`, cl, 200 + i, 'leaf', 10))}
              {clusters.map((cl, i) => renderCluster(`bloom-${i}`, cl, 400 + i, 'blossom', 3, 0.9))}
            </>
          )}
        </g>
      </g>
    );
  };

  return (
    <div className="tree-sticky-card tree-sticky-card--bare">
      {/* SVG Canvas Cây Đào & Hạt Đào Nghệ Thuật Cắt Giấy */}
      <div
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

            {/* Vầng sáng mờ phía sau cây, đổi màu theo giai đoạn */}
            <radialGradient id="auraGrad">
              <stop offset="0%" stopColor={STAGE_AURA[currentStage]} stopOpacity="0.22" />
              <stop offset="60%" stopColor={STAGE_AURA[currentStage]} stopOpacity="0.06" />
              <stop offset="100%" stopColor={STAGE_AURA[currentStage]} stopOpacity="0" />
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

          {/* ====================================================================
              GIAI ĐOẠN 1: HẠT ĐÀO (2002 - KHỞI NGUYÊN)
              Chỉ có hạt đào: dáng hạnh nhân một đầu nhọn, đường gờ dọc, rãnh nhăn nổi khối
              ==================================================================== */}
          {currentStage === 'seed' && (
            <g className="tree-stage">
              <ellipse cx="210" cy="392" rx="78" ry="11" fill="#000" opacity="0.3" />
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
          )}

          {/* ====================================================================
              GIAI ĐOẠN 2: MẦM CÂY ĐÀO ĐÂM CHỒI (2018)
              Hạt đào nứt vỏ trên gò đất, mầm non vươn lên với 2 lá mầm
              ==================================================================== */}
          {currentStage === 'sprout' && (
            <g className="tree-stage">
              <g className="tree-sway tree-sway--strong">
                {/* Thân mầm */}
                <path d={taperedPath([210, 404], [204, 362], [218, 332], [210, 290], 9, 5)} fill="#74a57f" filter="url(#paperShadow)" />
                <path d="M207 400 C 203 365, 214 334, 208 294" stroke="#b7e4c7" strokeWidth="1.4" fill="none" opacity="0.5" />
                {/* 2 lá mầm tròn */}
                <g filter="url(#paperShadow)">
                  <path d="M209 292 C 196 280, 168 276, 146 288 C 160 306, 192 308, 209 292 Z" fill="url(#leafLight)" />
                  <path d="M209 292 C 196 280, 168 276, 146 288 C 172 290, 194 293, 209 292 Z" fill="#081c15" opacity="0.2" />
                  <path d="M211 292 C 224 278, 252 272, 276 282 C 262 302, 230 306, 211 292 Z" fill="url(#leafLight)" />
                  <path d="M211 292 C 224 278, 252 272, 276 282 C 250 286, 228 290, 211 292 Z" fill="#081c15" opacity="0.2" />
                </g>
                {/* Chồi non ở ngọn */}
                {renderLeaf('top-l', 210, 292, -18, 0.7)}
                {renderLeaf('top-r', 210, 292, 22, 0.6)}
              </g>
              {renderGround(95)}
              {/* Vỏ hạt đào nứt đôi nằm trên gò đất */}
              <g filter="url(#paperShadow)">
                <path d="M206 404 C 196 392, 180 390, 170 398 C 168 410, 184 418, 204 412 Z" fill="url(#peachSeedGrad)" stroke="#2e180f" strokeWidth="1" />
                <path d="M214 404 C 226 394, 242 394, 250 402 C 250 413, 234 418, 216 412 Z" fill="url(#peachSeedGrad)" stroke="#2e180f" strokeWidth="1" />
                <path d="M178 401 C 186 398, 194 400, 200 405" stroke="#2a150d" strokeWidth="1.6" fill="none" />
                <path d="M224 402 C 232 399, 240 400, 245 405" stroke="#2a150d" strokeWidth="1.6" fill="none" />
              </g>
            </g>
          )}

          {/* ====================================================================
              GIAI ĐOẠN 3-5: CÂY ĐÀO NON -> NỞ HOA -> TRĨU QUẢ (cùng một dáng cây lớn dần)
              ==================================================================== */}
          {(currentStage === 'sapling' || currentStage === 'blooming' || currentStage === 'mature') && (
            <g className="tree-stage" key={currentStage}>
              {renderTree(currentStage)}
              {renderGround(currentStage === 'sapling' ? 110 : 150)}
              {currentStage !== 'sapling' && renderFallingPetals(currentStage === 'mature' ? 11 : 5, currentStage === 'mature' ? 4 : 7)}
            </g>
          )}
        </svg>

        {/* CÁC NÚT BẤM QUẢ ĐÀO MICROSERVICES (CHỈ HIỆN Ở MỐC MATURE - HIỆN TẠI) */}
        {currentStage === 'mature' &&
          projects.map((proj) => {
            const pos = fruitPositions[proj.id] || proj.fruitPosition || { x: 50, y: 50 };
            return (
              <InteractiveFruitButton
                key={proj.id}
                project={proj}
                position={pos}
                onSelect={onSelectProject}
              />
            );
          })}
      </div>
    </div>
  );
};
