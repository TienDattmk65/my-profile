import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BarChart3, Bot, ExternalLink, Layers, Rotate3d, Server, Sparkles } from 'lucide-react';
import { ShowcaseProject } from '../types/profile';

// Cây đào 3D (Three.js): cùng lịch lớn lên như bản SVG (biến độ lớn g: 0 = hạt ... 4 = trĩu quả),
// nhưng mọi bộ phận là khối 3D, xoay được bằng chuột. Bản SVG (EcoTreeVisualizer) vẫn là bản dự phòng.

type Stage = 'seed' | 'sprout' | 'sapling' | 'blooming' | 'mature';

export interface EcoTree3DProps {
  currentStage: Stage;
  projects: ShowcaseProject[];
  onSelectProject?: (project: ShowcaseProject) => void;
}

const STAGE_INDEX: Record<Stage, number> = { seed: 0, sprout: 1, sapling: 2, blooming: 3, mature: 4 };

const STAGE_AURA: Record<Stage, string> = {
  seed: '#ffb38a',
  sprout: '#74c69d',
  sapling: '#74c69d',
  blooming: '#ff8fab',
  mature: '#ffb38a',
};

const GROW_FIRST_STEP_MS = 1600;
const GROW_EXTRA_STEP_MS = 650;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const isCoarsePointer = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

/** Bộ phận mọc ra khi g đi từ a tới a + d, và (tuỳ chọn) thu lại/rụng khi g đi từ oa tới oa + od */
interface Grow {
  a: number;
  d: number;
  oa?: number;
  od?: number;
}
const prog = (g: number, { a, d, oa = 99, od = 1 }: Grow) =>
  smooth(clamp01((g - a) / d)) * (1 - smooth(clamp01((g - oa) / od)));

const seededRandom = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Đổi toạ độ bản vẽ SVG (420x460, gốc cây ở 210,412) sang mét 3D: gốc cây ở (0,0,0), 100px = 1 đơn vị
const P3 = ([x, y]: [number, number], z: number) => new THREE.Vector3((x - 210) / 100, (412 - y) / 100, z);

// Kích thước cả cây theo g (thân gỗ xuất hiện quanh g = 1)
const treeScaleAt = (g: number) => {
  if (g <= 1) return 0.36;
  if (g <= 2) return lerp(0.36, 0.6, smooth(g - 1));
  if (g <= 3) return lerp(0.6, 0.86, smooth(g - 2));
  return lerp(0.86, 1, smooth(clamp01(g - 3)));
};

// Khung hình camera theo g: [g, độ cao điểm nhìn, khoảng cách]
const CAMERA_KEYS: [number, number, number][] = [
  [0, 0.62, 3.3],
  [1, 0.38, 2.5],
  [2, 1.0, 4.3],
  [3, 1.58, 6.1],
  [4, 1.85, 7.1],
];
const cameraAt = (g: number) => {
  const i = Math.min(CAMERA_KEYS.length - 2, Math.max(0, Math.floor(g)));
  const [g0, y0, d0] = CAMERA_KEYS[i];
  const [g1, y1, d1] = CAMERA_KEYS[i + 1];
  const t = smooth(clamp01((g - g0) / (g1 - g0)));
  return { y: lerp(y0, y1, t), dist: lerp(d0, d1, t) };
};

// ============================================================================
// KHUNG CÂY (thân + cành) — đường cong Bézier 3D, cành vươn dần theo g
// ============================================================================
interface BranchDef {
  p: [number, number][];
  z: number[];
  r: [number, number];
  grow: Grow;
  tubular: number;
}

const BRANCH_DEFS: BranchDef[] = [
  // Thân
  { p: [[210, 412], [203, 350], [216, 290], [207, 225]], z: [0, 0, 0, 0], r: [0.22, 0.09], grow: { a: 0.95, d: 0.55 }, tubular: 48 },
  // 3 cành chính -> 3 quả đào
  { p: [[204, 266], [172, 236], [132, 206], [109, 160]], z: [0, 0.1, 0.2, 0.25], r: [0.09, 0.028], grow: { a: 1.15, d: 0.55 }, tubular: 40 },
  { p: [[208, 258], [198, 205], [216, 145], [210, 98]], z: [0, -0.05, -0.1, -0.1], r: [0.1, 0.032], grow: { a: 1.23, d: 0.55 }, tubular: 40 },
  { p: [[213, 266], [250, 236], [290, 208], [311, 164]], z: [0, 0.1, 0.25, 0.3], r: [0.09, 0.028], grow: { a: 1.31, d: 0.55 }, tubular: 40 },
  // Cành nhỏ toả ra mọi hướng cho tán tròn đầy khi xoay
  { p: [[160, 222], [130, 214], [100, 214], [74, 204]], z: [0.15, 0.3, 0.45, 0.55], r: [0.04, 0.012], grow: { a: 2.0, d: 0.5 }, tubular: 24 },
  { p: [[146, 198], [146, 170], [152, 146], [160, 124]], z: [0.2, 0, -0.2, -0.35], r: [0.035, 0.012], grow: { a: 2.08, d: 0.5 }, tubular: 24 },
  { p: [[205, 160], [190, 140], [176, 120], [168, 96]], z: [-0.08, -0.2, -0.35, -0.45], r: [0.03, 0.01], grow: { a: 2.16, d: 0.5 }, tubular: 24 },
  { p: [[212, 168], [232, 146], [250, 130], [266, 116]], z: [-0.08, 0.1, 0.3, 0.45], r: [0.035, 0.012], grow: { a: 2.24, d: 0.5 }, tubular: 24 },
  { p: [[264, 222], [292, 216], [320, 216], [348, 206]], z: [0.15, 0, -0.25, -0.45], r: [0.04, 0.012], grow: { a: 2.32, d: 0.5 }, tubular: 24 },
  { p: [[286, 202], [284, 176], [276, 152], [262, 136]], z: [0.25, 0.4, 0.5, 0.55], r: [0.03, 0.01], grow: { a: 2.4, d: 0.5 }, tubular: 24 },
  { p: [[207, 248], [200, 215], [190, 190], [185, 162]], z: [0, -0.3, -0.6, -0.8], r: [0.05, 0.015], grow: { a: 2.1, d: 0.5 }, tubular: 24 },
  { p: [[209, 252], [222, 222], [236, 200], [240, 180]], z: [0, 0.3, 0.55, 0.75], r: [0.05, 0.015], grow: { a: 2.2, d: 0.5 }, tubular: 24 },
];

const BRANCH_CURVES = BRANCH_DEFS.map((b) => {
  const [p0, p1, p2, p3] = b.p.map((pt, i) => P3(pt, b.z[i]));
  return new THREE.CubicBezierCurve3(p0, p1, p2, p3);
});

const BARK_DARK = new THREE.Color('#4a2b1d');
const BARK_LIGHT = new THREE.Color('#9a6a50');

/** Ống thon dần dọc đường cong, vỏ có sọc dọc. Thứ tự chỉ số theo từng đoạn -> drawRange cho cành "vươn" ra */
function buildTaperedTube(curve: THREE.Curve<THREE.Vector3>, r0: number, r1: number, tubular: number, radial = 10) {
  const frames = curve.computeFrenetFrames(tubular, false);
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, P);
    const r = lerp(r0, r1, t);
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * Math.PI * 2;
      N.copy(frames.normals[i]).multiplyScalar(Math.cos(v)).addScaledVector(frames.binormals[i], Math.sin(v)).normalize();
      pos.push(P.x + N.x * r, P.y + N.y * r, P.z + N.z * r);
      nor.push(N.x, N.y, N.z);
      const stripe = 0.5 + 0.5 * Math.sin(j * 2.3 + Math.sin(i * 0.7) * 1.5);
      // Mặt hướng sáng (bên trái, phía trước) sáng hơn
      const lit = 0.5 + 0.5 * (-N.x * 0.6 + N.z * 0.4);
      c.copy(BARK_DARK).lerp(BARK_LIGHT, clamp01(0.15 + lit * 0.55 + stripe * 0.25));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = (i + 1) * (radial + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return { geo, indicesPerSegment: radial * 6 };
}

// ============================================================================
// TÁN LÁ / HOA / NỤ — các chùm đặt quanh đầu cành, lịch mọc giống bản SVG
// ============================================================================
const CANOPY_CLUSTERS: { c: [number, number]; z: number; r: number }[] = [
  { c: [108, 158], z: 0.25, r: 46 },
  { c: [210, 98], z: -0.1, r: 54 },
  { c: [311, 162], z: 0.3, r: 46 },
  { c: [160, 120], z: -0.35, r: 38 },
  { c: [262, 122], z: 0.45, r: 38 },
  { c: [76, 204], z: 0.55, r: 32 },
  { c: [346, 206], z: -0.45, r: 32 },
  { c: [168, 92], z: -0.45, r: 28 },
  { c: [185, 160], z: -0.8, r: 34 },
  { c: [240, 178], z: 0.75, r: 32 },
];
const MAIN_CLUSTERS = 3;
// Cành mang từng chùm (chỉ số trong BRANCH_DEFS): lá/hoa mọc dọc nửa ngoài của cành, không lơ lửng
const CLUSTER_BRANCH = [1, 2, 3, 5, 7, 4, 8, 6, 10, 11];

const backLeafGrow = (cluster: number, j: number): Grow => {
  const main = cluster < MAIN_CLUSTERS;
  if (j < 7) return { a: (main ? 2.0 : 2.25) + j * 0.08 + (main ? 0 : cluster * 0.02), d: 0.35 };
  return { a: 3.05 + (j - 7) * 0.12, d: 0.35 };
};
const frontLeafGrow = (cluster: number, j: number): Grow => {
  if (cluster < MAIN_CLUSTERS) {
    if (j < 6) return { a: 1.3 + j * 0.09 + cluster * 0.03, d: 0.35 };
    return { a: 3.0 + (j - 6) * 0.15, d: 0.35 };
  }
  if (j < 4) return { a: 2.15 + j * 0.1 + cluster * 0.02, d: 0.35 };
  return { a: 3.0 + (j - 4) * 0.12, d: 0.35 };
};
const budGrow = (cluster: number, j: number): Grow => ({
  a: (cluster < MAIN_CLUSTERS ? 1.65 : 2.35) + j * 0.1,
  d: 0.3,
  oa: 3.2 + j * 0.1,
  od: 0.3,
});
const blossomGrow = (cluster: number, j: number, count: number): Grow => ({
  a: 2.35 + (j / count) * 0.5 + cluster * 0.03,
  d: 0.3,
  ...(j >= 3 ? { oa: 3.15 + (j / count) * 0.4, od: 0.3 } : {}),
});

interface Item {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  size: number;
  grow: Grow;
  color?: THREE.Color;
}

const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

function scatter(
  clusterIndex: number,
  seed: number,
  count: number,
  axis: THREE.Vector3,
  growAt: (j: number) => Grow,
  opts: { zBias?: number; shell?: number; size: [number, number]; colors?: THREE.Color[] }
): Item[] {
  const cl = CANOPY_CLUSTERS[clusterIndex];
  const branchIndex = CLUSTER_BRANCH[clusterIndex];
  const curve = BRANCH_CURVES[branchIndex];
  const branchGrow = BRANCH_DEFS[branchIndex].grow;
  const r = (cl.r / 100) * 1.1;
  const rand = seededRandom(seed);
  return Array.from({ length: count }, (_, j) => {
    const u = rand() * 2 - 1;
    const theta = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const dir = new THREE.Vector3(s * Math.cos(theta), u * 0.85, s * Math.sin(theta) * 0.9 + (opts.zBias ?? 0));
    dir.normalize();
    const shell = opts.shell ?? 0;
    const t = 0.4 + 0.6 * Math.sqrt(rand());
    const dist = (shell + (1 - shell) * Math.sqrt(rand())) * r * 0.8 * (0.45 + 0.55 * t);
    const pos = curve.getPointAt(t).addScaledVector(dir, dist);
    const outward = dir.clone().add(new THREE.Vector3(rand() - 0.5, rand() * 0.6, rand() - 0.5).multiplyScalar(0.6)).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(axis, outward);
    quat.premultiply(new THREE.Quaternion().setFromAxisAngle(outward, rand() * Math.PI * 2));
    const size = lerp(opts.size[0], opts.size[1], rand());
    const color = opts.colors ? opts.colors[Math.floor(rand() * opts.colors.length)] : undefined;
    // Chỉ mọc sau khi đoạn cành mang nó đã vươn tới
    const grow = growAt(j);
    grow.a = Math.max(grow.a, branchGrow.a + branchGrow.d * t * 0.9);
    return { pos, quat, size, grow, color };
  });
}

// ============================================================================
// HÌNH KHỐI
// ============================================================================

/** Lá đào thon dài, gấp nhẹ theo gân giữa (hình chữ V) để có khối khi xoay. Cuống ở (0,0), mọc theo +Y */
function buildLeafGeometry(length = 0.34) {
  const k = length / 34;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(7 * k, 6 * k, 10 * k, 20 * k, 0, 34 * k);
  shape.bezierCurveTo(-10 * k, 20 * k, -7 * k, 6 * k, 0, 0);
  const geo = new THREE.ShapeGeometry(shape, 8);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, -Math.abs(x) * 0.7 + Math.sin((y / length) * Math.PI) * 0.02);
  }
  geo.computeVertexNormals();
  return geo;
}

function colorize(geo: THREE.BufferGeometry, fn: (x: number, y: number, z: number) => THREE.Color) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const c = fn(pos.getX(i), pos.getY(i), pos.getZ(i));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

const PETAL_DEEP = new THREE.Color('#ff4d6d');
const PETAL_MID = new THREE.Color('#ffb3c6');
const PETAL_LIGHT = new THREE.Color('#fff0f3');
const POLLEN = new THREE.Color('#ffd166');

const petalColor = (radius: number, max: number) => {
  const t = clamp01(radius / max);
  return t < 0.45 ? PETAL_DEEP.clone().lerp(PETAL_MID, t / 0.45) : PETAL_MID.clone().lerp(PETAL_LIGHT, (t - 0.45) / 0.55);
};

function buildPetalGeometry(scale = 0.5) {
  const s = scale / 100; // 1 đơn vị bản vẽ SVG -> mét 3D
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-8 * s, 3 * s, -11 * s, 13 * s, -5 * s, 18 * s);
  shape.quadraticCurveTo(0, 15.5 * s, 5 * s, 18 * s);
  shape.bezierCurveTo(11 * s, 13 * s, 8 * s, 3 * s, 0, 0);
  return new THREE.ShapeGeometry(shape, 6);
}

/** Hoa đào 5 cánh khum thành chén, màu đậm ở tâm nhạt dần ra mép, nhuỵ vàng. Mặt hoa hướng +Z */
function buildBlossomGeometry() {
  const max = 0.09;
  const petals = [0, 1, 2, 3, 4].map((k) => {
    const g = buildPetalGeometry();
    g.rotateZ((k * Math.PI * 2) / 5);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      pos.setZ(i, r * r * 4);
    }
    return colorize(g, (x, y) => petalColor(Math.hypot(x, y), max));
  });
  const pollen = colorize(new THREE.SphereGeometry(0.018, 8, 6).translate(0, 0, 0.008), () => POLLEN);
  const merged = mergeGeometries([...petals, pollen].map((g) => (g.index ? g.toNonIndexed() : g)));
  merged.computeVertexNormals();
  return merged;
}

function buildFallingPetalGeometry() {
  const g = buildPetalGeometry(0.42);
  return colorize(g, (x, y) => petalColor(Math.hypot(x, y), 0.075));
}

/** Hạt đào: khối gỗ hình trứng có rãnh nhăn */
function buildSeedGeometry() {
  const geo = new THREE.SphereGeometry(1, 48, 32);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const wrinkle =
      0.035 * Math.sin(v.y * 14 + Math.sin(v.x * 9) * 2) * Math.cos(v.x * 7 + v.z * 5) +
      0.02 * Math.sin(v.z * 18 + v.y * 6);
    // Gờ sống lưng chạy dọc giữa hạt
    const ridge = 0.06 * Math.exp(-(v.x * v.x) / 0.004) * (v.z > 0 ? 1 : 0.6);
    v.multiplyScalar(1 + wrinkle + ridge);
    v.set(v.x * 0.78, v.y * 1.05 + (v.y > 0 ? v.y * v.y * 0.12 : 0), v.z * 0.62);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Quả đào: hơi dẹt, có rãnh dọc ở mặt trước, má hồng phía sáng */
function buildPeachGeometry() {
  const geo = new THREE.SphereGeometry(1, 40, 28);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const light = new THREE.Vector3(-0.5, 0.6, 0.65).normalize();
  const cTop = new THREE.Color('#fed7aa');
  const cMid = new THREE.Color('#fb7185');
  const cLow = new THREE.Color('#be123c');
  const col: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const crease = 0.08 * Math.exp(-(v.x * v.x) / 0.01) * clamp01(v.z);
    const n = v.clone();
    v.multiplyScalar(1 - crease);
    v.set(v.x, v.y * 0.95 - (v.y < -0.6 ? (v.y + 0.6) * 0.15 : 0), v.z * 0.96);
    pos.setXYZ(i, v.x, v.y, v.z);
    const lit = clamp01(n.dot(light) * 0.5 + 0.5);
    const c = lit > 0.55 ? cMid.clone().lerp(cTop, (lit - 0.55) / 0.45) : cLow.clone().lerp(cMid, lit / 0.55);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

const FRUIT_ANCHORS: THREE.Vector3[] = [
  P3([109, 174], 0.5),
  P3([210, 114], 0.22),
  P3([311, 178], 0.55),
];
const FRUIT_RADIUS = 0.22;

const getIcon = (iconName: string) => {
  switch (iconName?.toLowerCase()) {
    case 'server':
      return <Server size={18} />;
    case 'bot':
      return <Bot size={18} />;
    case 'barchart3':
      return <BarChart3 size={18} />;
    default:
      return <Layers size={18} />;
  }
};

// ============================================================================
// CẢNH 3D
// ============================================================================
interface GrowthState {
  g: number;
  from: number;
  to: number;
  start: number;
  duration: number;
}

interface SceneProps {
  growth: React.MutableRefObject<GrowthState>;
  projects: ShowcaseProject[];
  isMature: boolean;
  onSelectProject?: (project: ShowcaseProject) => void;
  interactive: boolean;
  reducedMotion: boolean;
}

const TreeScene: React.FC<SceneProps> = ({ growth, projects, isMature, onSelectProject, interactive, reducedMotion }) => {
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;

  // ---------- Dựng hình (một lần) ----------
  const branches = useMemo(
    () =>
      BRANCH_DEFS.map((b, i) => {
        const curve = BRANCH_CURVES[i];
        const { geo, indicesPerSegment } = buildTaperedTube(curve, b.r[0], b.r[1], b.tubular);
        return { ...b, curve, geo, indicesPerSegment };
      }),
    []
  );

  const leafGeo = useMemo(() => buildLeafGeometry(0.4), []);
  const blossomGeo = useMemo(() => buildBlossomGeometry(), []);
  const petalGeo = useMemo(() => buildFallingPetalGeometry(), []);
  const seedGeo = useMemo(() => buildSeedGeometry(), []);
  const peachGeo = useMemo(() => buildPeachGeometry(), []);
  const budGeo = useMemo(() => new THREE.SphereGeometry(1, 12, 10), []);
  const capGeo = useMemo(() => new THREE.SphereGeometry(1, 12, 10), []);
  const stemGeo = useMemo(() => new THREE.CylinderGeometry(0.6, 1, 1, 10, 1, true).translate(0, 0.5, 0), []);
  const moundGeo = useMemo(() => new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), []);
  const grassGeo = useMemo(() => new THREE.ConeGeometry(0.012, 1, 4).translate(0, 0.5, 0), []);

  const barkMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }), []);
  const capMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6a4230', roughness: 0.92 }), []);
  const leafMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.65, side: THREE.DoubleSide }), []);
  const blossomMat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide, emissive: '#ff4d6d', emissiveIntensity: 0.08 }),
    []
  );
  const petalMat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }),
    []
  );
  const budMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e5476d', roughness: 0.5 }), []);
  const sproutMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#52b788', roughness: 0.6, side: THREE.DoubleSide }), []);
  const cotyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#74c69d', roughness: 0.55, side: THREE.DoubleSide }), []);
  const seedMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a573f', roughness: 0.78, metalness: 0.05 }), []);
  const seedInnerMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9a47e', roughness: 0.85, side: THREE.DoubleSide }), []);
  const soilMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5b3a2c', roughness: 1 }), []);
  const grassMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#40916c', roughness: 0.8 }), []);
  const peachMat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, emissive: '#ff758f', emissiveIntensity: 0.05 }),
    []
  );
  const fruitLeafMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#52b788', roughness: 0.6, side: THREE.DoubleSide }), []);

  const leaves = useMemo(() => {
    const light = [new THREE.Color('#74c69d'), new THREE.Color('#52b788'), new THREE.Color('#95d5b2')];
    const dark = [new THREE.Color('#2d6a4f'), new THREE.Color('#1b4332'), new THREE.Color('#40916c')];
    return CANOPY_CLUSTERS.flatMap((_, i) => {
      const main = i < MAIN_CLUSTERS;
      return [
        ...scatter(i, 100 + i, main ? 16 : 12, AXIS_Y, (j) => backLeafGrow(i, j), { zBias: -0.35, size: [0.75, 1.2], colors: dark }),
        ...scatter(i, 200 + i, main ? 12 : 9, AXIS_Y, (j) => frontLeafGrow(i, j), { zBias: 0.35, size: [0.75, 1.15], colors: light }),
      ];
    });
  }, []);
  const blossoms = useMemo(
    () =>
      CANOPY_CLUSTERS.flatMap((_, i) => {
        const count = i < MAIN_CLUSTERS ? 9 : 6;
        return scatter(i, 400 + i, count, AXIS_Z, (j) => blossomGrow(i, j, count), { shell: 0.55, size: [0.8, 1.25] });
      }),
    []
  );
  const buds = useMemo(
    () =>
      CANOPY_CLUSTERS.flatMap((_, i) =>
        scatter(i, 300 + i, 2, AXIS_Y, (j) => budGrow(i, j), { shell: 0.6, size: i < MAIN_CLUSTERS ? [1.1, 1.3] : [0.9, 1] })
      ),
    []
  );
  const grass = useMemo(() => {
    const rand = seededRandom(77);
    return Array.from({ length: 46 }, () => {
      const a = rand() * Math.PI * 2;
      const d = 0.25 + Math.sqrt(rand()) * 0.75;
      return { a, d, h: 0.06 + rand() * 0.08, tilt: (rand() - 0.5) * 0.5, grow: { a: 0.85 + rand() * 0.6, d: 0.35 } as Grow };
    });
  }, []);
  const petalSeeds = useMemo(() => {
    const rand = seededRandom(91);
    return Array.from({ length: 9 }, (_, i) => ({
      start: P3([90 + rand() * 240, 110 + rand() * 90], (rand() - 0.5) * 1.2),
      phase: rand(),
      speed: 0.09 + rand() * 0.05,
      spin: 0.8 + rand() * 1.4,
      grow: { a: 2.6 + i * 0.05, d: 0.3, ...(i >= 4 ? { oa: 3.5, od: 0.3 } : {}) } as Grow,
    }));
  }, []);

  // ---------- Refs ----------
  const swayRef = useRef<THREE.Group>(null);
  const treeRef = useRef<THREE.Group>(null);
  const branchRefs = useRef<(THREE.Mesh | null)[]>([]);
  const capRefs = useRef<(THREE.Mesh | null)[]>([]);
  const leavesRef = useRef<THREE.InstancedMesh>(null);
  const blossomsRef = useRef<THREE.InstancedMesh>(null);
  const budsRef = useRef<THREE.InstancedMesh>(null);
  const petalsRef = useRef<THREE.InstancedMesh>(null);
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const moundRef = useRef<THREE.Mesh>(null);
  const seedRef = useRef<THREE.Mesh>(null);
  const shellLRef = useRef<THREE.Group>(null);
  const shellRRef = useRef<THREE.Group>(null);
  const sproutRef = useRef<THREE.Group>(null);
  const stemRef = useRef<THREE.Mesh>(null);
  const cotyLRef = useRef<THREE.Group>(null);
  const cotyRRef = useRef<THREE.Group>(null);
  const topLeafLRef = useRef<THREE.Group>(null);
  const topLeafRRef = useRef<THREE.Group>(null);
  const fruitRefs = useRef<(THREE.Group | null)[]>([]);
  const iconRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const hoveredRef = useRef(-1);
  const lastG = useRef(-1);
  const fallbackTarget = useMemo(() => new THREE.Vector3(), []);

  useLayoutEffect(() => {
    const set = (mesh: THREE.InstancedMesh | null, items: Item[]) => {
      if (!mesh) return;
      items.forEach((it, i) => it.color && mesh.setColorAt(i, it.color));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    set(leavesRef.current, leaves);
  }, [leaves]);

  useEffect(
    () => () => {
      branches.forEach((b) => b.geo.dispose());
      [leafGeo, blossomGeo, petalGeo, seedGeo, peachGeo, budGeo, capGeo, stemGeo, moundGeo, grassGeo].forEach((g) => g.dispose());
      [barkMat, capMat, leafMat, blossomMat, petalMat, budMat, sproutMat, cotyMat, seedMat, seedInnerMat, soilMat, grassMat, peachMat, fruitLeafMat].forEach((m) =>
        m.dispose()
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ---------- Cập nhật mỗi khung hình ----------
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const vS = useMemo(() => new THREE.Vector3(), []);
  const vP = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const qSpin = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);

  const updateItems = (mesh: THREE.InstancedMesh | null, items: Item[], g: number, base: number, spin = 0) => {
    if (!mesh) return;
    items.forEach((it, i) => {
      const p = prog(g, it.grow);
      const s = p * it.size * base;
      vS.setScalar(Math.max(s, 1e-5));
      if (spin) {
        qSpin.setFromAxisAngle(AXIS_Z, (1 - p) * spin);
        q.copy(it.quat).multiply(qSpin);
      } else q.copy(it.quat);
      m4.compose(it.pos, q, vS);
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  useFrame((state) => {
    const now = performance.now();
    const gs = growth.current;
    if (gs.duration > 0) {
      const t = clamp01((now - gs.start) / gs.duration);
      gs.g = gs.from + (gs.to - gs.from) * easeInOutCubic(t);
      if (t >= 1) gs.duration = 0;
    }
    const g = gs.g;
    const time = state.clock.elapsedTime;

    // Camera bám theo độ lớn của cây: cận cảnh hạt -> lùi dần ra khi cây lớn
    const cam = cameraAt(g);
    const target = controls?.target ?? fallbackTarget;
    target.set(0, cam.y, 0);
    offset.copy(state.camera.position).sub(target);
    if (offset.lengthSq() < 1e-6) offset.set(0, 0.25, 1);
    offset.setLength(cam.dist);
    state.camera.position.copy(target).add(offset);
    state.camera.lookAt(target);

    // Đung đưa: cây non lắc mạnh, càng lớn càng nhẹ; xoay nhẹ quanh thân khi đứng yên
    if (swayRef.current) {
      const ampDeg = 1.8 - 1.3 * clamp01(g - 3);
      swayRef.current.rotation.z = reducedMotion ? 0 : Math.sin(time * 0.9) * THREE.MathUtils.degToRad(ampDeg);
      swayRef.current.rotation.y = reducedMotion ? 0 : Math.sin(time * 0.22) * 0.22;
    }

    // Cánh hoa rơi chạy liên tục nên cập nhật mọi khung hình khi đang có
    const petals = petalsRef.current;
    if (petals) {
      petalSeeds.forEach((ps, i) => {
        const p = prog(g, ps.grow);
        const cycle = reducedMotion ? 0.3 : (time * ps.speed + ps.phase) % 1;
        const edge = smooth(clamp01(cycle / 0.12)) * (1 - smooth(clamp01((cycle - 0.82) / 0.18)));
        vP.set(
          ps.start.x + Math.sin(time * 0.8 + i) * 0.18 * cycle,
          ps.start.y - cycle * 2.6,
          ps.start.z + Math.cos(time * 0.6 + i * 2) * 0.12
        );
        euler.set(time * ps.spin + i, time * ps.spin * 0.7, i);
        q.setFromEuler(euler);
        vS.setScalar(Math.max(p * edge, 1e-5));
        m4.compose(vP, q, vS);
        petals.setMatrixAt(i, m4);
      });
      petals.instanceMatrix.needsUpdate = true;
    }

    // Quả đào: phồng lên khi chín, to ra khi rê chuột
    fruitRefs.current.forEach((fruit, i) => {
      if (!fruit) return;
      const p = prog(g, { a: 3.45 + i * 0.12, d: 0.35 });
      const hover = hoveredRef.current === i ? 1.16 : 1;
      const cur = fruit.userData.hover ?? 1;
      const next = lerp(cur, hover, 0.18);
      fruit.userData.hover = next;
      fruit.scale.setScalar(Math.max(p * next, 1e-5));
      fruit.rotation.z = reducedMotion ? 0 : Math.sin(time * 1.3 + i * 1.7) * 0.06;
      // Quả bị xoay ra sau tán thì làm mờ icon (lớp HTML không bị khối 3D che)
      const icon = iconRefs.current[i];
      if (icon) {
        fruit.getWorldPosition(vP);
        const behind = vP.distanceTo(state.camera.position) - target.distanceTo(state.camera.position) > 0.12;
        icon.style.opacity = behind ? '0.12' : '1';
      }
    });

    if (Math.abs(g - lastG.current) < 1e-5) return;
    lastG.current = g;

    // ---------- Hạt rơi xuống đất rồi nứt vỏ ----------
    const fall = smooth(clamp01(g / 0.5));
    const seedFade = 1 - smooth(clamp01((g - 0.42) / 0.16));
    const SEED_R = 0.28;
    if (seedRef.current) {
      seedRef.current.position.set(0, lerp(0.78, 0.11, fall), 0);
      seedRef.current.scale.setScalar(Math.max(SEED_R * (1 - 0.55 * fall) * seedFade, 1e-5));
      seedRef.current.rotation.set(0.15, reducedMotion ? 0.4 : 0.4 + g * 1.2, 0.18 * (1 - fall));
    }
    const crack = prog(g, { a: 0.42, d: 0.35, oa: 1.2, od: 0.3 });
    const open = smooth(clamp01((g - 0.42) / 0.45));
    const shellScale = Math.max(SEED_R * 0.45 * crack, 1e-5);
    [shellLRef.current, shellRRef.current].forEach((shell, side) => {
      if (!shell) return;
      const dir = side === 0 ? -1 : 1;
      shell.position.set(dir * open * 0.06, 0.11 - open * 0.03, 0);
      shell.rotation.set(0, 0.4, dir * open * 0.9);
      shell.scale.setScalar(shellScale);
    });

    // ---------- Mầm vươn lên, xoè 2 lá mầm ----------
    const sproutFade = 1 - smooth(clamp01((g - 1.15) / 0.35));
    if (sproutRef.current) sproutRef.current.scale.setScalar(Math.max(sproutFade, 1e-5));
    const stem = prog(g, { a: 0.5, d: 0.4 });
    const STEM_H = 0.5;
    if (stemRef.current) stemRef.current.scale.set(0.022, Math.max(STEM_H * stem, 1e-5), 0.022);
    const coty = prog(g, { a: 0.72, d: 0.3 });
    [cotyLRef.current, cotyRRef.current].forEach((leaf, side) => {
      if (!leaf) return;
      leaf.position.set(0, STEM_H * stem * 0.82, 0);
      leaf.rotation.set(0, side === 0 ? 0 : Math.PI, lerp(0.1, 1.15, coty));
      leaf.scale.setScalar(Math.max(coty * 0.75, 1e-5));
    });
    [topLeafLRef.current, topLeafRRef.current].forEach((leaf, side) => {
      if (!leaf) return;
      const p = prog(g, { a: side === 0 ? 0.84 : 0.88, d: 0.25 });
      leaf.position.set(0, STEM_H * stem, 0);
      leaf.rotation.set(0, side === 0 ? Math.PI / 2 : -Math.PI / 2, lerp(0.05, 0.5, p));
      leaf.scale.setScalar(Math.max(p * 0.45, 1e-5));
    });

    // ---------- Gò đất + cỏ ----------
    const mound = prog(g, { a: 0.3, d: 0.35 });
    const width = lerp(0.36, 1.45, smooth(clamp01((g - 1) / 3)));
    if (moundRef.current) moundRef.current.scale.set(Math.max(width * mound, 1e-5), Math.max(0.1 * mound, 1e-5), Math.max(width * 0.85 * mound, 1e-5));
    const grassMesh = grassRef.current;
    if (grassMesh) {
      grass.forEach((gr, i) => {
        const p = prog(g, gr.grow) * mound;
        const x = Math.cos(gr.a) * gr.d * width;
        const z = Math.sin(gr.a) * gr.d * width * 0.85;
        const yOnMound = 0.1 * mound * Math.sqrt(Math.max(0, 1 - gr.d * gr.d)) - 0.01;
        vP.set(x, yOnMound, z);
        euler.set(gr.tilt, gr.a, gr.tilt * 0.5);
        q.setFromEuler(euler);
        vS.set(1, Math.max(gr.h * p, 1e-5), 1).multiplyScalar(p > 0 ? 1 : 1e-5);
        m4.compose(vP, q, vS);
        grassMesh.setMatrixAt(i, m4);
      });
      grassMesh.instanceMatrix.needsUpdate = true;
    }

    // ---------- Cây gỗ: thân/cành vươn dài, tán lá, nụ, hoa ----------
    if (treeRef.current) treeRef.current.scale.setScalar(treeScaleAt(g));
    branches.forEach((b, i) => {
      const p = prog(g, b.grow);
      const segs = Math.round(p * b.tubular);
      const mesh = branchRefs.current[i];
      if (mesh) {
        mesh.visible = segs > 0;
        b.geo.setDrawRange(0, segs * b.indicesPerSegment);
      }
      const cap = capRefs.current[i];
      if (cap) {
        const t = segs / b.tubular;
        cap.visible = segs > 0;
        b.curve.getPointAt(t, cap.position);
        cap.scale.setScalar(lerp(b.r[0], b.r[1], t));
      }
    });
    updateItems(leavesRef.current, leaves, g, 1);
    updateItems(blossomsRef.current, blossoms, g, 1, 1.6);
    if (budsRef.current) {
      // Nụ hình giọt: kéo dài theo trục mọc
      buds.forEach((it, i) => {
        const p = prog(g, it.grow);
        const s = Math.max(p * it.size, 1e-5);
        vS.set(0.035 * s, 0.06 * s, 0.035 * s);
        m4.compose(it.pos, it.quat, vS);
        budsRef.current!.setMatrixAt(i, m4);
      });
      budsRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <hemisphereLight args={['#ffe8d6', '#2e1c14', 1.1]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[-3, 6, 4]} intensity={2.2} color="#fff4e6" />
      <directionalLight position={[3, 3, -4]} intensity={0.8} color="#ff8fab" />

      {/* Gò đất + cỏ */}
      <mesh ref={moundRef} geometry={moundGeo} material={soilMat} />
      <instancedMesh ref={grassRef} args={[grassGeo, grassMat, grass.length]} frustumCulled={false} />

      {/* Hạt đào nguyên vẹn */}
      <mesh ref={seedRef} geometry={seedGeo} material={seedMat} />

      {/* Vỏ hạt nứt làm đôi (2 nửa khối hạt, lộ ruột sáng màu) */}
      {[shellLRef, shellRRef].map((ref, side) => (
        <group key={side} ref={ref}>
          <mesh scale={[0.78, 1.05, 0.62]} rotation={[0, side === 0 ? Math.PI : 0, 0]}>
            <sphereGeometry args={[1, 24, 16, 0, Math.PI]} />
            <primitive object={seedMat} attach="material" />
          </mesh>
          <mesh scale={[0.74, 1.0, 0.58]} rotation={[0, side === 0 ? Math.PI : 0, 0]}>
            <sphereGeometry args={[1, 24, 16, 0, Math.PI]} />
            <primitive object={seedInnerMat} attach="material" />
          </mesh>
        </group>
      ))}

      {/* Mầm cây */}
      <group ref={sproutRef} position={[0, 0.08, 0]}>
        <mesh ref={stemRef} geometry={stemGeo} material={sproutMat} />
        {[cotyLRef, cotyRRef].map((ref, side) => (
          <group key={side} ref={ref}>
            <mesh geometry={leafGeo} material={cotyMat} />
          </group>
        ))}
        {[topLeafLRef, topLeafRRef].map((ref, side) => (
          <group key={side} ref={ref}>
            <mesh geometry={leafGeo} material={sproutMat} />
          </group>
        ))}
      </group>

      {/* Cây đào gỗ */}
      <group ref={swayRef}>
        <group ref={treeRef}>
          {branches.map((b, i) => (
            <mesh key={`b${i}`} ref={(el) => (branchRefs.current[i] = el)} geometry={b.geo} material={barkMat} />
          ))}
          {branches.map((_, i) => (
            <mesh key={`c${i}`} ref={(el) => (capRefs.current[i] = el)} geometry={capGeo} material={capMat} />
          ))}
          <instancedMesh ref={leavesRef} args={[leafGeo, leafMat, leaves.length]} frustumCulled={false} />
          <instancedMesh ref={budsRef} args={[budGeo, budMat, buds.length]} frustumCulled={false} />
          <instancedMesh ref={blossomsRef} args={[blossomGeo, blossomMat, blossoms.length]} frustumCulled={false} />
          <instancedMesh ref={petalsRef} args={[petalGeo, petalMat, petalSeeds.length]} frustumCulled={false} />

          {/* Quả đào Microservices treo ở đầu 3 cành chính */}
          {projects.map((proj, i) => {
            const anchor = FRUIT_ANCHORS[i % FRUIT_ANCHORS.length].clone();
            if (i >= FRUIT_ANCHORS.length) anchor.add(new THREE.Vector3(0.15 * (i - 2), -0.22, 0.2));
            return (
              <group key={proj.id} position={anchor}>
                <group ref={(el) => (fruitRefs.current[i] = el)}>
                  <mesh geometry={peachGeo} material={peachMat} scale={FRUIT_RADIUS} />
                  <mesh geometry={stemGeo} material={capMat} position={[0, FRUIT_RADIUS * 0.85, 0]} scale={[0.012, 0.07, 0.012]} />
                  <mesh
                    geometry={leafGeo}
                    material={fruitLeafMat}
                    position={[0.01, FRUIT_RADIUS * 0.95, 0]}
                    rotation={[0.3, 0.4, -1.0]}
                    scale={0.42}
                  />
                </group>
                {isMature && (
                  <Html center zIndexRange={[20, 10]}>
                    <button
                      type="button"
                      className="peach3d-hit"
                      onPointerEnter={() => (hoveredRef.current = i)}
                      onPointerLeave={() => (hoveredRef.current = -1)}
                      onFocus={() => (hoveredRef.current = i)}
                      onBlur={() => (hoveredRef.current = -1)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectProject) onSelectProject(proj);
                        else document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      title={proj.title}
                      aria-label={`Microservice Quả Đào: ${proj.title}`}
                    >
                      <span className="peach3d-icon" ref={(el) => (iconRefs.current[i] = el)}>{getIcon(proj.icon)}</span>
                      <span className="peach-tooltip">
                        <span className="peach-tooltip-header">
                          <Sparkles size={13} color="#ff758f" />
                          <span>Quả Đào: {proj.title}</span>
                        </span>
                        <span className="peach-tooltip-cat">
                          {proj.category} • {proj.statusLabel}
                        </span>
                        <span className="peach-tooltip-action">
                          <span>Nhấn để khám phá Live Demo</span>
                          <ExternalLink size={11} />
                        </span>
                      </span>
                    </button>
                  </Html>
                )}
              </group>
            );
          })}
        </group>
      </group>

      <ContactShadows position={[0, 0.002, 0]} opacity={0.5} scale={6} blur={2.6} far={4} resolution={512} color="#000000" />

      {interactive && (
        <OrbitControls
          makeDefault
          enableZoom={false}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.6}
          minPolarAngle={1.05}
          maxPolarAngle={1.72}
          minAzimuthAngle={-1.1}
          maxAzimuthAngle={1.1}
        />
      )}
    </>
  );
};

// ============================================================================
// THẺ CÂY 3D (giữ cùng khung/lớp CSS với bản SVG để bố cục trang không đổi)
// ============================================================================
export const EcoTree3D: React.FC<EcoTree3DProps> = ({ currentStage, projects, onSelectProject }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(true);
  const [interactive] = useState(() => !isCoarsePointer());
  const [reducedMotion] = useState(prefersReducedMotion);
  const [hintShown, setHintShown] = useState(true);
  const growth = useRef<GrowthState>({
    g: STAGE_INDEX[currentStage],
    from: STAGE_INDEX[currentStage],
    to: STAGE_INDEX[currentStage],
    start: 0,
    duration: 0,
  });

  // Đổi mốc: chạy g từ độ lớn hiện tại tới giai đoạn mới (nối tiếp nếu đang lớn dở, ngược lại khi cuộn xuống)
  useEffect(() => {
    const gs = growth.current;
    const to = STAGE_INDEX[currentStage];
    const distance = Math.abs(to - gs.g);
    if (distance < 0.001 || reducedMotion) {
      gs.g = to;
      gs.duration = 0;
      return;
    }
    gs.from = gs.g;
    gs.to = to;
    gs.start = performance.now();
    gs.duration = GROW_FIRST_STEP_MS * Math.min(distance, 1) + GROW_EXTRA_STEP_MS * Math.max(distance - 1, 0);
  }, [currentStage, reducedMotion]);

  // Ngừng vẽ khi cây ra khỏi màn hình để đỡ tốn GPU/pin
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="tree-sticky-card tree-sticky-card--bare">
      <div
        ref={wrapRef}
        className="eco-tree-canvas eco-tree-3d"
        style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1.15', '--aura': STAGE_AURA[currentStage] } as React.CSSProperties}
        onPointerDown={() => setHintShown(false)}
      >
        <div className="eco-tree-3d__aura" aria-hidden="true" />
        <Canvas
          flat
          dpr={[1, 2]}
          frameloop={visible ? 'always' : 'never'}
          camera={{ fov: 38, position: [0, 1.4, 3.3], near: 0.05, far: 60 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          style={{ position: 'absolute', inset: 0 }}
          aria-label="Cây đào 3D: lớn lên theo từng mốc hành trình"
        >
          <TreeScene
            growth={growth}
            projects={projects}
            isMature={currentStage === 'mature'}
            onSelectProject={onSelectProject}
            interactive={interactive}
            reducedMotion={reducedMotion}
          />
        </Canvas>
        {interactive && (
          <div className={`eco-tree-3d__hint${hintShown ? '' : ' is-hidden'}`} aria-hidden="true">
            <Rotate3d size={14} />
            <span>Kéo để xoay cây</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default EcoTree3D;
