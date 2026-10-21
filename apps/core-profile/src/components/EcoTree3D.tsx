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
  /** Phình to ở gốc (chỉ thân cây) */
  flare?: number;
}

const BRANCH_DEFS: BranchDef[] = [
  // Thân
  { p: [[210, 412], [203, 350], [216, 290], [207, 225]], z: [0, 0, 0, 0], r: [0.2, 0.085], grow: { a: 0.95, d: 0.55 }, tubular: 56, flare: 0.55 },
  // 3 cành chính -> 3 quả đào
  { p: [[204, 266], [172, 236], [132, 206], [109, 160]], z: [0, 0.1, 0.2, 0.25], r: [0.09, 0.028], grow: { a: 1.15, d: 0.55 }, tubular: 44 },
  { p: [[208, 258], [198, 205], [216, 145], [210, 98]], z: [0, -0.05, -0.1, -0.1], r: [0.1, 0.032], grow: { a: 1.23, d: 0.55 }, tubular: 44 },
  { p: [[213, 266], [250, 236], [290, 208], [311, 164]], z: [0, 0.1, 0.25, 0.3], r: [0.09, 0.028], grow: { a: 1.31, d: 0.55 }, tubular: 44 },
  // Cành nhỏ toả ra mọi hướng cho tán tròn đầy khi xoay
  { p: [[160, 222], [130, 214], [100, 214], [74, 204]], z: [0.15, 0.3, 0.45, 0.55], r: [0.04, 0.012], grow: { a: 1.3, d: 0.38 }, tubular: 28 },
  { p: [[146, 198], [146, 170], [152, 146], [160, 124]], z: [0.2, 0, -0.2, -0.35], r: [0.035, 0.012], grow: { a: 1.34, d: 0.38 }, tubular: 28 },
  { p: [[205, 160], [190, 140], [176, 120], [168, 96]], z: [-0.08, -0.2, -0.35, -0.45], r: [0.03, 0.01], grow: { a: 1.38, d: 0.38 }, tubular: 28 },
  { p: [[212, 168], [232, 146], [250, 130], [266, 116]], z: [-0.08, 0.1, 0.3, 0.45], r: [0.035, 0.012], grow: { a: 1.42, d: 0.38 }, tubular: 28 },
  { p: [[264, 222], [292, 216], [320, 216], [348, 206]], z: [0.15, 0, -0.25, -0.45], r: [0.04, 0.012], grow: { a: 1.46, d: 0.38 }, tubular: 28 },
  { p: [[286, 202], [284, 176], [276, 152], [262, 136]], z: [0.25, 0.4, 0.5, 0.55], r: [0.03, 0.01], grow: { a: 1.5, d: 0.38 }, tubular: 28 },
  { p: [[207, 248], [200, 215], [190, 190], [185, 162]], z: [0, -0.3, -0.6, -0.8], r: [0.05, 0.015], grow: { a: 1.36, d: 0.38 }, tubular: 28 },
  { p: [[209, 252], [222, 222], [236, 200], [240, 180]], z: [0, 0.3, 0.55, 0.75], r: [0.05, 0.015], grow: { a: 1.44, d: 0.38 }, tubular: 28 },
];

const BRANCH_CURVES = BRANCH_DEFS.map((b) => {
  const [p0, p1, p2, p3] = b.p.map((pt, i) => P3(pt, b.z[i]));
  return new THREE.CubicBezierCurve3(p0, p1, p2, p3);
});

// ----------------------------------------------------------------------------
// Nhiễu giá trị 3D (value noise) có hạt giống: tạo vân vỏ cây, rãnh hạt đào, đất, đốm quả
// ----------------------------------------------------------------------------
const hash3 = (x: number, y: number, z: number) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
};
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const u = fade(x - xi);
  const v = fade(y - yi);
  const w = fade(z - zi);
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u);
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), u);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u);
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}
/** Nhiễu nhiều tầng, giá trị ~0..1 */
function fbm(x: number, y: number, z: number, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * freq, y * freq, z * freq);
    norm += amp;
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
}
/** Nhiễu gờ (ridged): 1 ở sống gờ, 0 ở đáy rãnh */
const ridged = (x: number, y: number, z: number, octaves = 4) => 1 - Math.abs(fbm(x, y, z, octaves) * 2 - 1);

// ----------------------------------------------------------------------------
// Rễ nổi trên mặt đất + cành con (twig) mọc thêm từ các cành, cho cây nhiều chi tiết hơn
// ----------------------------------------------------------------------------
interface BranchBuilt {
  curve: THREE.Curve<THREE.Vector3>;
  r: [number, number];
  grow: Grow;
  tubular: number;
  flare?: number;
  radial: number;
  seed: number;
}

const ROOTS: BranchBuilt[] = Array.from({ length: 6 }, (_, k) => {
  const rand = seededRandom(600 + k);
  const a = (k / 6) * Math.PI * 2 + rand() * 0.5;
  const len = 0.5 + rand() * 0.25;
  const dir = (s: number, y: number) => new THREE.Vector3(Math.cos(a) * s * len, y, Math.sin(a) * s * len);
  return {
    curve: new THREE.CubicBezierCurve3(dir(0.15, 0.12), dir(0.45, 0.05), dir(0.75, 0.0), dir(1, -0.04)),
    r: [0.075, 0.012],
    grow: { a: 1.25 + k * 0.05, d: 0.5 },
    tubular: 20,
    radial: 9,
    seed: 600 + k,
  };
});

const TWIGS: BranchBuilt[] = BRANCH_DEFS.slice(1).flatMap((b, bi) => {
  const curve = BRANCH_CURVES[bi + 1];
  const rand = seededRandom(700 + bi);
  const count = bi < 3 ? 3 : 2;
  return Array.from({ length: count }, (_, k) => {
    const t = 0.35 + ((k + rand() * 0.6) / count) * 0.5;
    const start = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const side = new THREE.Vector3(rand() - 0.5, rand() * 0.8 + 0.3, rand() - 0.5).normalize();
    const dir = side.addScaledVector(tangent, 0.6).normalize();
    const len = 0.16 + rand() * 0.16;
    const p1 = start.clone().addScaledVector(dir, len * 0.35);
    const p2 = start.clone().addScaledVector(dir, len * 0.7).add(new THREE.Vector3(0, len * 0.12, 0));
    const p3 = start.clone().addScaledVector(dir, len).add(new THREE.Vector3(0, len * 0.18, 0));
    const r0 = lerp(b.r[0], b.r[1], t) * 0.45;
    return {
      curve: new THREE.CubicBezierCurve3(start, p1, p2, p3),
      r: [r0, Math.max(0.004, r0 * 0.3)] as [number, number],
      grow: { a: b.grow.a + b.grow.d * t + 0.05, d: 0.25 },
      tubular: 12,
      radial: 7,
      seed: 700 + bi * 10 + k,
    };
  });
});

const ALL_BRANCHES: BranchBuilt[] = [
  ...BRANCH_DEFS.map((b, i) => ({
    curve: BRANCH_CURVES[i],
    r: b.r,
    grow: b.grow,
    tubular: b.tubular,
    flare: b.flare,
    radial: i === 0 ? 18 : i < 4 ? 14 : 10,
    seed: i * 17,
  })),
  ...ROOTS,
  ...TWIGS,
];

const BARK_DARK = new THREE.Color('#3b2216');
const BARK_MID = new THREE.Color('#6f4532');
const BARK_LIGHT = new THREE.Color('#a8775a');
const BARK_MOSS = new THREE.Color('#4f6b3a');

const radiusAt = (b: Pick<BranchBuilt, 'r' | 'flare'>, t: number) =>
  lerp(b.r[0], b.r[1], Math.pow(t, 0.85)) * (1 + (b.flare ?? 0) * Math.exp(-t * 14));

/**
 * Ống thon dần dọc đường cong, vỏ sần có gờ dọc & nốt sẹo (nhiễu gờ), màu tối trong rãnh, sáng trên gờ,
 * rêu xanh nhạt ở mặt dưới gần gốc. Thứ tự chỉ số theo từng đoạn -> drawRange cho cành "vươn" ra.
 */
function buildTaperedTube(b: BranchBuilt) {
  const { curve, tubular, radial, seed } = b;
  const frames = curve.computeFrenetFrames(tubular, false);
  const length = curve.getLength();
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, P);
    const r = radiusAt(b, t);
    const along = t * length;
    for (let j = 0; j <= radial; j++) {
      // j = radial trùng góc với j = 0 để đường nối kín, không lộ khe
      const v = ((j % radial) / radial) * Math.PI * 2;
      N.copy(frames.normals[i]).multiplyScalar(Math.cos(v)).addScaledVector(frames.binormals[i], Math.sin(v)).normalize();
      // Gờ vỏ chạy dọc thân: kéo giãn nhiễu theo chiều dài
      const ridge = ridged(Math.cos(v) * 1.6 + seed, along * 7, Math.sin(v) * 1.6, 3);
      const knot = Math.pow(noise3(Math.cos(v) * 2 + seed, along * 2.2, Math.sin(v) * 2), 6);
      const bump = 0.92 + ridge * 0.12 + knot * 0.25;
      pos.push(P.x + N.x * r * bump, P.y + N.y * r * bump, P.z + N.z * r * bump);
      const lit = 0.5 + 0.5 * (-N.x * 0.6 + N.z * 0.4 + N.y * 0.3);
      c.copy(BARK_DARK).lerp(BARK_MID, clamp01(0.25 + ridge * 0.75));
      c.lerp(BARK_LIGHT, clamp01(ridge * ridge * 0.55 + lit * 0.25 - 0.1));
      const moss = clamp01((0.35 - N.y) * 1.2) * clamp01(1 - along * 1.5) * fbm(Math.cos(v) * 3, along * 5 + seed, Math.sin(v) * 3, 2);
      c.lerp(BARK_MOSS, clamp01(moss * 0.9));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const bb = (i + 1) * (radial + 1) + j;
      idx.push(a, bb, a + 1, bb, bb + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
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

// Lá chỉ có ở giai đoạn cây non (g 1.3 -> 2.4); khi vào mùa hoa (Lv.4, Lv.5) lá rụng hết, nhường chỗ cho hoa
const leafFall = (cluster: number, j: number) => ({ oa: 2.4 + ((j * 7 + cluster * 3) % 10) * 0.04, od: 0.35 });
// Mọc xong hết trước g = 2 nên tán cây non ở Lv.3 xanh dày, không xơ xác
const backLeafGrow = (cluster: number, j: number): Grow => {
  const main = cluster < MAIN_CLUSTERS;
  return { a: (main ? 1.45 : 1.55 + cluster * 0.01) + j * 0.012, d: 0.3, ...leafFall(cluster, j) };
};
const frontLeafGrow = (cluster: number, j: number): Grow => {
  const main = cluster < MAIN_CLUSTERS;
  return { a: (main ? 1.3 + cluster * 0.03 : 1.55 + cluster * 0.01) + j * 0.014, d: 0.3, ...leafFall(cluster, j + 3) };
};
const budGrow = (cluster: number, j: number): Grow => ({
  a: (cluster < MAIN_CLUSTERS ? 1.65 : 2.35) + j * 0.1,
  d: 0.3,
  oa: 3.2 + j * 0.1,
  od: 0.3,
});
// Hoa nở dần đúng lúc lá rụng (g 2.3 -> 2.95): Lv.4 phủ kín hoa. Sang Lv.5 khoảng 1/2 số hoa rụng dần
// khi quả đào chín, tán vẫn hồng nhưng thưa hơn để quả nổi bật
const blossomGrow = (cluster: number, j: number, count: number): Grow => ({
  a: 2.3 + (j / count) * 0.6 + cluster * 0.005,
  d: 0.3,
  ...(j % 2 === 1 ? { oa: 3.1 + ((j * 7 + cluster * 5) % 20) * 0.025, od: 0.3 } : {}),
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
    grow.a = Math.max(grow.a, branchGrow.a + branchGrow.d * t * 0.6);
    return { pos, quat, size, grow, color };
  });
}

// ============================================================================
// HÌNH KHỐI
// ============================================================================

/**
 * Lá đào thon dài, mép răng cưa rất nhỏ, gấp theo gân giữa (chữ V), chóp cong nhẹ xuống.
 * Màu theo đỉnh (nhân với màu từng lá): gốc tối, chóp sáng, gân giữa & gân phụ sáng hơn phiến lá.
 * Cuống ở (0,0), mọc theo +Y
 */
function buildLeafGeometry(length = 0.34) {
  // Lưới dọc (rows) x ngang (cols) để gân giữa, nếp gấp và độ cong hiện rõ (ShapeGeometry chỉ có đỉnh ở mép)
  const rows = 20;
  const cols = 6;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    // Bề rộng lá: hẹp ở cuống, rộng nhất ~40% chiều dài, nhọn dần về chóp; mép răng cưa rất nhỏ
    const tooth = i % 2 === 0 ? 1 : 0.9;
    const w = Math.sin(Math.pow(t, 0.8) * Math.PI) * (1 - t * 0.35) * 0.062 * (length / 0.34) * tooth;
    for (let j = 0; j <= cols; j++) {
      const u = (j / cols) * 2 - 1;
      const x = u * w;
      const y = t * length;
      const z = -Math.abs(u) * w * 0.55 - t * t * length * 0.22 + Math.sin(t * Math.PI) * length * 0.05;
      pos.push(x, y, z);
      const vein = Math.exp(-(u * u) / 0.02);
      const side = Math.pow(Math.abs(Math.sin((t * 9 - Math.abs(u) * 1.6) * Math.PI)), 10) * (1 - Math.abs(u)) * 0.5;
      const edge = Math.abs(u) * 0.08;
      const shade = clamp01(0.74 + t * 0.22 + vein * 0.22 + side * 0.15 - edge);
      col.push(shade * 0.96, shade, shade * 0.92);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j;
      const b = a + cols + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
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

const PETAL_DEEP = new THREE.Color('#e63e62');
const PETAL_MID = new THREE.Color('#ffb3c6');
const PETAL_LIGHT = new THREE.Color('#fff5f7');
const POLLEN = new THREE.Color('#ffd166');
const FILAMENT = new THREE.Color('#ff8fab');
const CALYX = new THREE.Color('#9d2449');

const petalColor = (radius: number, max: number, vein = 0) => {
  const t = clamp01(radius / max);
  const c = t < 0.4 ? PETAL_DEEP.clone().lerp(PETAL_MID, t / 0.4) : PETAL_MID.clone().lerp(PETAL_LIGHT, (t - 0.4) / 0.6);
  return c.lerp(PETAL_DEEP, vein * 0.35 * (1 - t));
};

/** Cánh hoa tròn có khía nhỏ ở đầu, chia lưới mịn để uốn cong được */
function buildPetalGeometry(scale = 0.5) {
  const s = scale / 100; // 1 đơn vị bản vẽ SVG -> mét 3D
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-8 * s, 3 * s, -12 * s, 13 * s, -6 * s, 18.5 * s);
  shape.quadraticCurveTo(-2 * s, 20 * s, 0, 16.5 * s);
  shape.quadraticCurveTo(2 * s, 20 * s, 6 * s, 18.5 * s);
  shape.bezierCurveTo(12 * s, 13 * s, 8 * s, 3 * s, 0, 0);
  return new THREE.ShapeGeometry(shape, 10);
}

/**
 * Hoa đào 5 cánh khum thành chén, mép cánh hơi gợn, gân hồng đậm toả từ tâm,
 * đài hoa đỏ sẫm phía sau, ~14 nhị mảnh với bao phấn vàng. Mặt hoa hướng +Z
 */
function buildBlossomGeometry() {
  const max = 0.095;
  const parts: THREE.BufferGeometry[] = [];
  [0, 1, 2, 3, 4].forEach((k) => {
    const g = buildPetalGeometry();
    g.rotateZ((k * Math.PI * 2) / 5 + 0.08 * Math.sin(k * 2.3));
    const pos = g.attributes.position as THREE.BufferAttribute;
    const col: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const r = Math.hypot(x, y);
      const ang = Math.atan2(y, x);
      pos.setZ(i, r * r * 4.2 + Math.sin(ang * 9 + k) * r * 0.06);
      const vein = Math.pow(Math.abs(Math.cos(ang * 11 + k)), 16);
      const c = petalColor(r, max, vein);
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    parts.push(g);
  });
  // Đài hoa: 5 lá đài nhỏ phía sau cánh
  [0, 1, 2, 3, 4].forEach((k) => {
    const g = new THREE.ConeGeometry(0.012, 0.03, 4).rotateX(Math.PI / 2).translate(0, 0.018, -0.004);
    g.rotateZ((k * Math.PI * 2) / 5 + Math.PI / 5);
    parts.push(colorize(g, () => CALYX));
  });
  // Nhị hoa: sợi mảnh hơi toả ra + bao phấn vàng
  const rand = seededRandom(55);
  for (let k = 0; k < 14; k++) {
    const ang = (k / 14) * Math.PI * 2 + rand() * 0.3;
    const len = 0.026 + rand() * 0.014;
    const tilt = 0.45 + rand() * 0.35;
    const dir = new THREE.Vector3(Math.cos(ang) * Math.sin(tilt), Math.sin(ang) * Math.sin(tilt), Math.cos(tilt));
    const quat = new THREE.Quaternion().setFromUnitVectors(AXIS_Y, dir);
    const fil = new THREE.CylinderGeometry(0.0012, 0.0016, len, 3).translate(0, len / 2, 0).applyQuaternion(quat);
    parts.push(colorize(fil, () => FILAMENT));
    const tip = dir.clone().multiplyScalar(len);
    const anther = new THREE.SphereGeometry(0.0042, 6, 4).translate(tip.x, tip.y, tip.z + 0.004);
    parts.push(colorize(anther, () => POLLEN));
  }
  // Nhuỵ giữa
  parts.push(colorize(new THREE.SphereGeometry(0.011, 8, 6).scale(1, 1, 0.7).translate(0, 0, 0.01), () => new THREE.Color('#c9e265')));
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  merged.computeVertexNormals();
  return merged;
}

function buildFallingPetalGeometry() {
  const g = buildPetalGeometry(0.42);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    pos.setZ(i, r * r * 3);
  }
  g.computeVertexNormals();
  return colorize(g, (x, y) => petalColor(Math.hypot(x, y), 0.08));
}

/**
 * Hạt đào (hạch đào): hình hạnh nhân dẹt, chóp nhọn, đáy tròn có sẹo cuống.
 * Bề mặt có các rãnh sâu ngoằn ngoèo chạy chủ yếu theo chiều dọc (nhiễu gờ kéo giãn theo trục Y),
 * một gờ sống (đường khâu) chạy quanh mép. Màu: rãnh nâu sẫm, gờ nâu vàng sáng.
 * `phiStart/phiLength` cho phép dựng nửa hạt (z >= 0 hoặc z <= 0) để làm 2 mảnh vỏ khi nứt.
 */
const SEED_DARK = new THREE.Color('#3d2117');
const SEED_MID = new THREE.Color('#7a4a33');
const SEED_LIGHT = new THREE.Color('#c48e66');

function seedSurface(v: THREE.Vector3) {
  const y = v.y;
  // Dáng hạnh nhân: thu hẹp & nhọn ở chóp, đáy tròn hơn
  const taper = 1 - 0.42 * smooth(clamp01((y - 0.05) / 0.95));
  const base = 1 - 0.1 * smooth(clamp01((-y - 0.6) / 0.4));
  const x = v.x * 0.8 * taper * base;
  const z = v.z * 0.56 * taper * base;
  const yy = y * 1.08 + (y > 0 ? y * y * y * 0.16 : 0);
  const n = new THREE.Vector3(v.x, v.y, v.z).normalize();
  // Rãnh: nhiễu gờ kéo dài theo chiều dọc
  const ridge = ridged(n.x * 2.6 + 11, n.y * 1.4, n.z * 2.6, 4);
  const fine = fbm(n.x * 9, n.y * 6, n.z * 9, 2);
  // Gờ khâu chạy quanh mép (mặt phẳng z = 0, phía x > 0)
  const suture = Math.exp(-(n.z * n.z) / 0.006) * smooth(clamp01((n.x + 0.2) / 0.6));
  const relief = 1 + (Math.pow(ridge, 2.2) - 0.55) * 0.13 + (fine - 0.5) * 0.03 + suture * 0.07;
  const out = new THREE.Vector3(x, yy, z).multiplyScalar(relief);
  const groove = clamp01(Math.pow(ridge, 1.6) + suture * 0.6);
  return { out, groove, fine };
}

function buildSeedGeometry(phiStart = 0, phiLength = Math.PI * 2) {
  const geo = new THREE.SphereGeometry(1, 128, 96, phiStart, phiLength);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const col: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const { out, groove, fine } = seedSurface(v);
    pos.setXYZ(i, out.x, out.y, out.z);
    c.copy(SEED_DARK).lerp(SEED_MID, clamp01(groove * 1.3));
    c.lerp(SEED_LIGHT, clamp01((groove - 0.55) * 1.6 + (fine - 0.5) * 0.4));
    // Sẹo cuống ở đáy tối màu
    if (v.y < -0.92) c.lerp(SEED_DARK, 0.6);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Quả đào: tròn hơi dẹt, có rãnh dọc ở một bên, chóp nhọn nhẹ, hõm cuống ở đỉnh.
 * Màu: vàng kem ở mặt khuất, má đỏ hồng ở mặt hướng sáng, thêm đốm loang nhỏ cho tự nhiên.
 */
function buildPeachGeometry() {
  const geo = new THREE.SphereGeometry(1, 64, 48);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const light = new THREE.Vector3(-0.5, 0.6, 0.65).normalize();
  const cCream = new THREE.Color('#ffd8a8');
  const cWarm = new THREE.Color('#ff9a76');
  const cBlush = new THREE.Color('#e8365d');
  const cDeep = new THREE.Color('#a3123a');
  const col: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone();
    const crease = 0.09 * Math.exp(-(v.x * v.x) / 0.008) * clamp01(v.z + 0.2);
    const cavity = 0.12 * Math.exp(-((v.x * v.x + v.z * v.z) / 0.03)) * clamp01(v.y);
    const tip = v.y < -0.75 ? (v.y + 0.75) * 0.18 : 0;
    v.multiplyScalar(1 - crease);
    v.set(v.x * 1.02, v.y * 0.94 - cavity + tip, v.z * 0.97);
    pos.setXYZ(i, v.x, v.y, v.z);
    const lit = clamp01(n.dot(light) * 0.5 + 0.5);
    const mottle = fbm(n.x * 4 + 3, n.y * 4, n.z * 4, 3);
    const blush = clamp01((lit - 0.3) * 1.6 + (mottle - 0.5) * 0.9);
    c.copy(cCream).lerp(cWarm, clamp01(lit * 1.2));
    c.lerp(cBlush, blush);
    c.lerp(cDeep, clamp01((blush - 0.75) * 2) * 0.5 + crease * 2);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Lá cỏ: dải mảnh thon nhọn, cong về một phía, gốc xanh sẫm -> ngọn xanh non. Gốc ở (0,0), cao 1 */
function buildGrassBladeGeometry() {
  const segs = 5;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const dark = new THREE.Color('#1f4d36');
  const light = new THREE.Color('#8fd19e');
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = 0.022 * (1 - t);
    const bend = t * t * 0.35;
    pos.push(-w, t, bend, w, t, bend);
    const c = dark.clone().lerp(light, t);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    if (i < segs) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Gò đất: chỏm cầu có mặt sần (nhiễu), màu đất ẩm loang tối/sáng */
function buildMoundGeometry() {
  const geo = new THREE.SphereGeometry(1, 72, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const col: number[] = [];
  const dark = new THREE.Color('#3a241a');
  const mid = new THREE.Color('#5e3d2c');
  const light = new THREE.Color('#8a6448');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = fbm(v.x * 6, v.y * 6, v.z * 6, 4);
    const crumb = Math.pow(noise3(v.x * 28, v.y * 28, v.z * 28), 4);
    pos.setXYZ(i, v.x, v.y * (1 + (n - 0.5) * 0.9 + crumb * 0.6), v.z);
    c.copy(dark).lerp(mid, clamp01(n * 1.4));
    c.lerp(light, clamp01(crumb * 1.5 + (n - 0.6)));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

// ----------------------------------------------------------------------------
// MẦM CÂY (mốc Lv.2): thân mảnh cong chữ S, xanh non ở ngọn, đỏ tía nhẹ ở gốc như mầm đào thật;
// 2 lá mầm mập, tròn, khum lòng chảo; cặp lá thật răng cưa nhú giữa 2 lá mầm cùng chồi đỉnh
// ----------------------------------------------------------------------------
const SPROUT_H = 0.52;
const SPROUT_CURVE = new THREE.CubicBezierCurve3(
  new THREE.Vector3(0, -0.04, 0),
  new THREE.Vector3(0.045, SPROUT_H * 0.35, 0.01),
  new THREE.Vector3(-0.035, SPROUT_H * 0.7, -0.01),
  new THREE.Vector3(0.005, SPROUT_H, 0)
);
const SPROUT_TUBULAR = 36;
const SPROUT_RADIAL = 10;

function buildSproutStemGeometry() {
  const frames = SPROUT_CURVE.computeFrenetFrames(SPROUT_TUBULAR, false);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const base = new THREE.Color('#8c3b4a');
  const mid = new THREE.Color('#5fae6e');
  const tip = new THREE.Color('#b7e4a8');
  const c = new THREE.Color();
  for (let i = 0; i <= SPROUT_TUBULAR; i++) {
    const t = i / SPROUT_TUBULAR;
    SPROUT_CURVE.getPointAt(t, P);
    const r = lerp(0.026, 0.014, t) * (1 + 0.35 * Math.exp(-t * 10));
    for (let j = 0; j <= SPROUT_RADIAL; j++) {
      const v = ((j % SPROUT_RADIAL) / SPROUT_RADIAL) * Math.PI * 2;
      N.copy(frames.normals[i]).multiplyScalar(Math.cos(v)).addScaledVector(frames.binormals[i], Math.sin(v)).normalize();
      pos.push(P.x + N.x * r, P.y + N.y * r, P.z + N.z * r);
      c.copy(base).lerp(mid, smooth(clamp01(t * 3.2))).lerp(tip, smooth(clamp01((t - 0.55) / 0.45)));
      // Vệt sáng dọc thân phía hướng sáng
      c.multiplyScalar(0.86 + 0.18 * clamp01(-N.x * 0.6 + N.z * 0.5 + 0.5));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < SPROUT_TUBULAR; i++) {
    for (let j = 0; j < SPROUT_RADIAL; j++) {
      const a = i * (SPROUT_RADIAL + 1) + j;
      const b = (i + 1) * (SPROUT_RADIAL + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Lá mầm: phiến bầu dục mập, hơi lõm ở chóp (hình thận), khum lòng chảo, mép sáng hơn. Gốc ở (0,0), dài theo +Y */
function buildCotyledonGeometry(length = 0.2) {
  const rows = 16;
  const cols = 10;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const dark = new THREE.Color('#3f8f5a');
  const light = new THREE.Color('#a8e3a1');
  const c = new THREE.Color();
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const w = Math.pow(Math.sin(Math.min(1, t * 1.08) * Math.PI), 0.62) * length * 0.42 * (t < 0.12 ? 0.35 + t * 5.4 : 1);
    for (let j = 0; j <= cols; j++) {
      const u = (j / cols) * 2 - 1;
      // Chóp hơi lõm ở giữa
      const notch = t > 0.85 ? Math.exp(-(u * u) / 0.08) * (t - 0.85) * length * 0.6 : 0;
      const y = t * length - notch;
      const x = u * w;
      const z = (u * u - 1) * w * 0.32 + Math.sin(t * Math.PI) * length * 0.06;
      pos.push(x, y, z);
      const vein = Math.exp(-(u * u) / 0.015) * 0.18;
      c.copy(dark).lerp(light, clamp01(Math.abs(u) * 0.55 + t * 0.35 + vein));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j;
      const b = a + cols + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Hoa dại nhỏ trên thảm cỏ: cuống xanh, 5-6 cánh tròn (màu theo từng bông), nhuỵ vàng. Gốc ở (0,0) */
function buildWildflowerGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const stemH = 0.07;
  parts.push(colorize(new THREE.CylinderGeometry(0.0022, 0.003, stemH, 4).translate(0, stemH / 2, 0), () => new THREE.Color('#3d7a4c')));
  const petals = 6;
  for (let k = 0; k < petals; k++) {
    const a = (k / petals) * Math.PI * 2;
    const g = new THREE.CircleGeometry(0.011, 8).scale(1, 1.6, 1).translate(0, 0.014, 0);
    g.rotateZ(a);
    g.rotateX(-Math.PI / 2 + 0.35);
    g.translate(0, stemH, 0);
    parts.push(colorize(g, () => new THREE.Color('#ffffff')));
  }
  parts.push(colorize(new THREE.SphereGeometry(0.0075, 8, 6).scale(1, 0.6, 1).translate(0, stemH + 0.004, 0), () => new THREE.Color('#ffc53d')));
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  merged.computeVertexNormals();
  return merged;
}

const WILDFLOWER_COLORS = ['#ffffff', '#fff3b0', '#ffc8dd', '#cdb4db', '#ffafcc', '#bde0fe', '#ffe5ec'].map((c) => new THREE.Color(c));
const GRASS_TINTS = ['#5aa469', '#7cc47f', '#4c9a5b', '#93d39a', '#6bbf72', '#a7d98b'].map((c) => new THREE.Color(c));

/** Thảm cỏ: lớp phủ xanh mịn ôm sát gò đất (che các khe đất giữa các lá cỏ), loang đậm nhạt */
function buildTurfGeometry() {
  const geo = buildMoundGeometry();
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col: number[] = [];
  const a = new THREE.Color('#2f6b3f');
  const b = new THREE.Color('#5fae6e');
  const soil = new THREE.Color('#5e3d2c');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    pos.setY(i, y * 1.04 + 0.004);
    const n = fbm(x * 7 + 5, y * 7, z * 7, 3);
    c.copy(a).lerp(b, clamp01(n * 1.5 - 0.2));
    // Mép gò lẫn đất nâu cho tự nhiên
    const rim = smooth(clamp01((Math.hypot(x, z) - 0.86) / 0.14));
    c.lerp(soil, rim * 0.7);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

const SEED_R = 0.28;
// Khoảng cách tâm -> đáy hạt trong toạ độ hình học (bản lề của 2 mảnh vỏ)
const SEED_BOTTOM = 1.08;
// Độ lớn g lúc hạt chạm đất và nứt làm đôi
const SEED_CRACK_G = 0.5;

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
  const branches = useMemo(() => ALL_BRANCHES.map((b) => ({ ...b, ...buildTaperedTube(b) })), []);

  const leafGeo = useMemo(() => buildLeafGeometry(0.4), []);
  const blossomGeo = useMemo(() => buildBlossomGeometry(), []);
  const petalGeo = useMemo(() => buildFallingPetalGeometry(), []);
  const seedGeo = useMemo(() => buildSeedGeometry(), []);
  // 2 mảnh vỏ khi nứt: nửa trước (z >= 0) & nửa sau, dời lên để bản lề nằm ở đáy hạt
  const shellGeos = useMemo(
    () => [buildSeedGeometry(0, Math.PI).translate(0, SEED_BOTTOM, 0), buildSeedGeometry(Math.PI, Math.PI).translate(0, SEED_BOTTOM, 0)],
    []
  );
  const peachGeo = useMemo(() => buildPeachGeometry(), []);
  // Nụ: giọt hồng, đài xanh ôm gốc
  const budGeo = useMemo(
    () =>
      colorize(new THREE.SphereGeometry(1, 14, 12), (_x, y) =>
        y < -0.35 ? new THREE.Color('#4d7c42') : new THREE.Color('#c9184a').lerp(new THREE.Color('#ffb3c6'), clamp01((y + 0.35) / 1.35))
      ),
    []
  );
  const capGeo = useMemo(() => new THREE.SphereGeometry(1, 14, 10), []);
  const pebbleGeo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);
  const stemGeo = useMemo(() => new THREE.CylinderGeometry(0.6, 1, 1, 10, 1, true).translate(0, 0.5, 0), []);
  const moundGeo = useMemo(() => buildMoundGeometry(), []);
  const grassGeo = useMemo(() => buildGrassBladeGeometry(), []);
  const turfGeo = useMemo(() => buildTurfGeometry(), []);
  const flowerGeo = useMemo(() => buildWildflowerGeometry(), []);
  const sproutStemGeo = useMemo(() => buildSproutStemGeometry(), []);
  const cotyGeo = useMemo(() => buildCotyledonGeometry(), []);

  const barkMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }), []);
  const capMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a3828', roughness: 0.92 }), []);
  const leafMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.02, side: THREE.DoubleSide }), []);
  const blossomMat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide, emissive: '#ff4d6d', emissiveIntensity: 0.08 }),
    []
  );
  const petalMat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }),
    []
  );
  const budMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }), []);
  const sproutMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9be08f', vertexColors: true, roughness: 0.45, side: THREE.DoubleSide }), []);
  const sproutStemMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, side: THREE.DoubleSide }), []);
  // Lá mầm mập, bóng nhẹ như có lớp sáp
  const cotyMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.5, side: THREE.DoubleSide }),
    []
  );
  const turfMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, transparent: true, opacity: 0, depthWrite: false }), []);
  const flowerMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }), []);
  const seedMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.04 }), []);
  // Mặt trong vỏ hạt (thấy khi 2 mảnh tách ra): gỗ sáng màu, nhẵn hơn
  const seedInnerMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e2b48c', roughness: 0.6, side: THREE.BackSide }), []);
  const soilMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), []);
  const grassMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }), []);
  const pebbleMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8d8378', roughness: 0.85, flatShading: true }), []);
  // Vỏ đào có lông tơ: sheen tạo lớp ánh mịn như nhung ở mép quả
  const peachMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.55,
        sheen: 1,
        sheenColor: new THREE.Color('#ffd6e0'),
        sheenRoughness: 0.45,
        emissive: '#ff758f',
        emissiveIntensity: 0.04,
      }),
    []
  );
  const fruitLeafMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7dd3a0', vertexColors: true, roughness: 0.5, side: THREE.DoubleSide }), []);

  const leaves = useMemo(() => {
    const light = [new THREE.Color('#74c69d'), new THREE.Color('#52b788'), new THREE.Color('#95d5b2')];
    const dark = [new THREE.Color('#2d6a4f'), new THREE.Color('#1b4332'), new THREE.Color('#40916c')];
    return CANOPY_CLUSTERS.flatMap((_, i) => {
      const main = i < MAIN_CLUSTERS;
      return [
        ...scatter(i, 100 + i, main ? 24 : 18, AXIS_Y, (j) => backLeafGrow(i, j), { zBias: -0.35, size: [0.85, 1.3], colors: dark }),
        ...scatter(i, 200 + i, main ? 18 : 13, AXIS_Y, (j) => frontLeafGrow(i, j), { zBias: 0.35, size: [0.85, 1.25], colors: light }),
      ];
    });
  }, []);
  const blossoms = useMemo(
    () =>
      CANOPY_CLUSTERS.flatMap((_, i) => {
        const count = i < MAIN_CLUSTERS ? 64 : 46;
        return scatter(i, 400 + i, count, AXIS_Z, (j) => blossomGrow(i, j, count), { shell: 0.2, size: [0.9, 1.45] });
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
    // Khóm cỏ rải đều trên gò (lấy mẫu theo diện tích), mỗi khóm 6 lá toả ra như bụi cỏ thật
    const blades: { a: number; d: number; h: number; yaw: number; tilt: number; grow: Grow; color: THREE.Color }[] = [];
    const CLUMPS = 150;
    for (let k = 0; k < CLUMPS; k++) {
      const a = (k * 2.39996 + rand() * 0.4) % (Math.PI * 2);
      const d = Math.min(0.98, Math.sqrt((k + 0.5) / CLUMPS) * 0.97 + (rand() - 0.5) * 0.04);
      const clumpH = 0.035 + rand() * 0.05;
      // Khóm gần gốc mọc trước, lan dần ra mép
      const start = 0.62 + d * 0.8 + rand() * 0.3;
      const tint = GRASS_TINTS[Math.floor(rand() * GRASS_TINTS.length)];
      for (let b = 0; b < 6; b++) {
        const off = rand() * 0.035;
        const ang = rand() * Math.PI * 2;
        blades.push({
          a: a + (Math.cos(ang) * off) / Math.max(d, 0.2),
          d: Math.min(0.99, d + Math.sin(ang) * off),
          h: clumpH * (0.6 + rand() * 0.8),
          yaw: ang + (rand() - 0.5) * 0.8,
          tilt: 0.15 + rand() * 0.45,
          grow: { a: start + rand() * 0.15, d: 0.4 },
          color: tint.clone().multiplyScalar(0.85 + rand() * 0.3),
        });
      }
    }
    return blades;
  }, []);
  const flowers = useMemo(() => {
    const rand = seededRandom(1234);
    return Array.from({ length: 46 }, (_, k) => {
      const a = rand() * Math.PI * 2;
      const d = 0.25 + Math.sqrt(rand()) * 0.72;
      return {
        a,
        d,
        s: 0.75 + rand() * 0.6,
        yaw: rand() * Math.PI * 2,
        tilt: (rand() - 0.5) * 0.35,
        color: WILDFLOWER_COLORS[k % WILDFLOWER_COLORS.length],
        grow: { a: 1.3 + d * 0.9 + rand() * 0.4, d: 0.35 } as Grow,
      };
    });
  }, []);
  const pebbles = useMemo(() => {
    const rand = seededRandom(88);
    return Array.from({ length: 16 }, () => ({
      a: rand() * Math.PI * 2,
      d: 0.35 + rand() * 0.6,
      s: 0.012 + rand() * 0.022,
      rot: new THREE.Euler(rand() * 3, rand() * 3, rand() * 3),
      grow: { a: 0.4 + rand() * 0.4, d: 0.3 } as Grow,
    }));
  }, []);
  const petalSeeds = useMemo(() => {
    const rand = seededRandom(91);
    return Array.from({ length: 32 }, (_, i) => ({
      start: P3([90 + rand() * 240, 110 + rand() * 90], (rand() - 0.5) * 1.2),
      phase: rand(),
      speed: 0.09 + rand() * 0.05,
      spin: 0.8 + rand() * 1.4,
      grow: { a: 2.5 + i * 0.012, d: 0.3 } as Grow,
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
  const pebblesRef = useRef<THREE.InstancedMesh>(null);
  const flowersRef = useRef<THREE.InstancedMesh>(null);
  const turfRef = useRef<THREE.Mesh>(null);
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
    set(grassRef.current, grass as unknown as Item[]);
    set(flowersRef.current, flowers as unknown as Item[]);
  }, [leaves, grass, flowers]);

  useEffect(
    () => () => {
      branches.forEach((b) => b.geo.dispose());
      [leafGeo, blossomGeo, petalGeo, turfGeo, flowerGeo, sproutStemGeo, cotyGeo, seedGeo, ...shellGeos, peachGeo, budGeo, capGeo, pebbleGeo, stemGeo, moundGeo, grassGeo].forEach((g) => g.dispose());
      [barkMat, capMat, pebbleMat, leafMat, blossomMat, petalMat, budMat, sproutMat, sproutStemMat, cotyMat, turfMat, flowerMat, seedMat, seedInnerMat, soilMat, grassMat, peachMat, fruitLeafMat].forEach((m) =>
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
    const cracked = g >= SEED_CRACK_G;
    const seedSize = SEED_R * (1 - 0.55 * fall);
    const seedYaw = 0.35 + fall * 0.55;
    const SEED_GROUND_Y = 0.16;
    if (seedRef.current) {
      seedRef.current.visible = !cracked;
      seedRef.current.position.set(0, lerp(0.78, SEED_GROUND_Y, fall), 0);
      seedRef.current.scale.setScalar(Math.max(seedSize, 1e-5));
      seedRef.current.rotation.set(0.15 * (1 - fall), seedYaw, 0.18 * (1 - fall));
    }
    // Hai mảnh vỏ mở ra như bản lề ở đáy hạt (mảnh trước ngả về phía người xem, mảnh sau ngả ra sau),
    // rồi lún dần vào đất khi thân gỗ mọc lên
    const open = smooth(clamp01((g - SEED_CRACK_G) / 0.5));
    const shellGone = smooth(clamp01((g - 1.2) / 0.3));
    [shellLRef.current, shellRRef.current].forEach((shell, side) => {
      if (!shell) return;
      shell.visible = cracked && shellGone < 1;
      const sz = Math.max(seedSize * (1 - shellGone), 1e-5);
      shell.position.set(0, SEED_GROUND_Y - SEED_BOTTOM * seedSize - shellGone * 0.04, 0);
      shell.rotation.set((side === 0 ? 1 : -1) * open * 0.8, seedYaw, 0, 'YXZ');
      shell.scale.setScalar(sz);
    });

    // ---------- Mầm vươn lên, xoè 2 lá mầm ----------
    const sproutFade = 1 - smooth(clamp01((g - 1.15) / 0.35));
    if (sproutRef.current) sproutRef.current.scale.setScalar(Math.max(sproutFade, 1e-5));
    const stem = prog(g, { a: 0.5, d: 0.42 });
    const stemSegs = Math.round(stem * SPROUT_TUBULAR);
    sproutStemGeo.setDrawRange(0, stemSegs * SPROUT_RADIAL * 6);
    if (stemRef.current) stemRef.current.visible = stemSegs > 0;
    // Ngọn thân lúc đang vươn: nơi gắn lá mầm (đi lên cùng ngọn)
    SPROUT_CURVE.getPointAt(Math.max(stemSegs / SPROUT_TUBULAR, 0.001), vP);
    const tipX = vP.x;
    const tipY = vP.y;
    const coty = prog(g, { a: 0.7, d: 0.32 });
    [cotyLRef.current, cotyRRef.current].forEach((leaf, side) => {
      if (!leaf) return;
      leaf.visible = stem > 0.05;
      leaf.position.set(tipX, tipY - 0.01, 0);
      // Lúc đầu 2 lá mầm úp sát nhau dựng đứng, rồi xoè ngang và hơi rủ xuống
      leaf.rotation.set(0, side === 0 ? 0.25 : Math.PI + 0.25, lerp(0.08, 1.32, coty));
      leaf.scale.setScalar(Math.max(lerp(0.35, 1, coty), 1e-5));
    });
    [topLeafLRef.current, topLeafRRef.current].forEach((leaf, side) => {
      if (!leaf) return;
      const p = prog(g, { a: side === 0 ? 0.74 : 0.78, d: 0.2 });
      leaf.position.set(tipX, tipY + 0.005, 0);
      leaf.rotation.set(0, (side === 0 ? 1 : -1) * Math.PI / 2 + 0.25, lerp(0.02, 0.38, p));
      leaf.scale.setScalar(Math.max(p * 0.55, 1e-5));
    });

    // ---------- Gò đất + cỏ ----------
    const mound = prog(g, { a: 0.3, d: 0.35 });
    const width = lerp(0.36, 1.45, smooth(clamp01((g - 1) / 3)));
    if (moundRef.current) moundRef.current.scale.set(Math.max(width * mound, 1e-5), Math.max(0.1 * mound, 1e-5), Math.max(width * 0.85 * mound, 1e-5));
    const onMound = (a: number, d: number) => {
      const x = Math.cos(a) * d * width;
      const z = Math.sin(a) * d * width * 0.85;
      return vP.set(x, 0.1 * mound * Math.sqrt(Math.max(0, 1 - d * d)) - 0.008, z);
    };
    const grassMesh = grassRef.current;
    if (grassMesh) {
      grass.forEach((gr, i) => {
        const p = prog(g, gr.grow) * mound;
        onMound(gr.a, gr.d);
        euler.set(gr.tilt, gr.yaw, gr.tilt * 0.5);
        q.setFromEuler(euler);
        const sp = Math.max(p, 1e-5);
        vS.set(sp * 0.7, Math.max(gr.h * p, 1e-5), Math.max(gr.h * p, 1e-5));
        m4.compose(vP, q, vS);
        grassMesh.setMatrixAt(i, m4);
      });
      grassMesh.instanceMatrix.needsUpdate = true;
    }
    // Thảm cỏ xanh phủ dần lên đất cùng lúc với cỏ
    const turf = prog(g, { a: 0.62, d: 0.9 }) * mound;
    if (turfRef.current) {
      turfRef.current.visible = turf > 0.001;
      turfRef.current.scale.set(Math.max(width * mound, 1e-5), Math.max(0.1 * mound, 1e-5), Math.max(width * 0.85 * mound, 1e-5));
      turfMat.opacity = turf * 0.92;
    }
    const flowerMesh = flowersRef.current;
    if (flowerMesh) {
      flowers.forEach((fl, i) => {
        const p = prog(g, fl.grow) * mound;
        onMound(fl.a, fl.d);
        euler.set(fl.tilt, fl.yaw, fl.tilt * 0.6);
        q.setFromEuler(euler);
        vS.setScalar(Math.max(p * fl.s, 1e-5));
        m4.compose(vP, q, vS);
        flowerMesh.setMatrixAt(i, m4);
      });
      flowerMesh.instanceMatrix.needsUpdate = true;
    }
    const pebbleMesh = pebblesRef.current;
    if (pebbleMesh) {
      pebbles.forEach((pb, i) => {
        const p = prog(g, pb.grow) * mound;
        onMound(pb.a, pb.d);
        vP.y -= pb.s * 0.3;
        q.setFromEuler(pb.rot);
        vS.set(pb.s, pb.s * 0.6, pb.s * 0.85).multiplyScalar(Math.max(p, 1e-5));
        m4.compose(vP, q, vS);
        pebbleMesh.setMatrixAt(i, m4);
      });
      pebbleMesh.instanceMatrix.needsUpdate = true;
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
        cap.scale.setScalar(radiusAt(b, t) * 0.97);
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
      <directionalLight
        position={[-3, 6, 4]}
        intensity={2.4}
        color="#fff4e6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-1}
        shadow-camera-near={0.5}
        shadow-camera-far={16}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-radius={4}
      />
      {/* Ánh viền hồng phía sau cho khối tách khỏi nền tối */}
      <directionalLight position={[3, 3, -4]} intensity={1.1} color="#ff8fab" />
      <directionalLight position={[0, 2, 6]} intensity={0.35} color="#bde0fe" />

      {/* Gò đất + cỏ */}
      <mesh ref={moundRef} geometry={moundGeo} material={soilMat} receiveShadow />
      <mesh ref={turfRef} geometry={turfGeo} material={turfMat} receiveShadow renderOrder={1} />
      <instancedMesh ref={grassRef} args={[grassGeo, grassMat, grass.length]} frustumCulled={false} receiveShadow />
      <instancedMesh ref={flowersRef} args={[flowerGeo, flowerMat, flowers.length]} frustumCulled={false} castShadow />
      <instancedMesh ref={pebblesRef} args={[pebbleGeo, pebbleMat, pebbles.length]} frustumCulled={false} castShadow receiveShadow />

      {/* Hạt đào nguyên vẹn */}
      <mesh ref={seedRef} geometry={seedGeo} material={seedMat} castShadow />

      {/* Vỏ hạt nứt làm đôi (2 nửa khối hạt, lộ ruột sáng màu) */}
      {[shellLRef, shellRRef].map((ref, side) => (
        <group key={side} ref={ref}>
          <mesh geometry={shellGeos[side]} material={seedMat} castShadow />
          <mesh geometry={shellGeos[side]} material={seedInnerMat} />
        </group>
      ))}

      {/* Mầm cây */}
      <group ref={sproutRef} position={[0, 0.08, 0]}>
        <mesh ref={stemRef} geometry={sproutStemGeo} material={sproutStemMat} castShadow />
        {[cotyLRef, cotyRRef].map((ref, side) => (
          <group key={side} ref={ref}>
            <mesh geometry={cotyGeo} material={cotyMat} castShadow />
          </group>
        ))}
        {[topLeafLRef, topLeafRRef].map((ref, side) => (
          <group key={side} ref={ref}>
            <mesh geometry={leafGeo} material={sproutMat} castShadow />
          </group>
        ))}
      </group>

      {/* Cây đào gỗ */}
      <group ref={swayRef}>
        <group ref={treeRef}>
          {branches.map((b, i) => (
            <mesh key={`b${i}`} ref={(el) => (branchRefs.current[i] = el)} geometry={b.geo} material={barkMat} castShadow receiveShadow />
          ))}
          {branches.map((_, i) => (
            <mesh key={`c${i}`} ref={(el) => (capRefs.current[i] = el)} geometry={capGeo} material={capMat} />
          ))}
          <instancedMesh ref={leavesRef} args={[leafGeo, leafMat, leaves.length]} frustumCulled={false} castShadow receiveShadow />
          <instancedMesh ref={budsRef} args={[budGeo, budMat, buds.length]} frustumCulled={false} />
          <instancedMesh ref={blossomsRef} args={[blossomGeo, blossomMat, blossoms.length]} frustumCulled={false} castShadow />
          <instancedMesh ref={petalsRef} args={[petalGeo, petalMat, petalSeeds.length]} frustumCulled={false} />

          {/* Quả đào Microservices treo ở đầu 3 cành chính */}
          {projects.map((proj, i) => {
            const anchor = FRUIT_ANCHORS[i % FRUIT_ANCHORS.length].clone();
            if (i >= FRUIT_ANCHORS.length) anchor.add(new THREE.Vector3(0.15 * (i - 2), -0.22, 0.2));
            return (
              <group key={proj.id} position={anchor}>
                <group ref={(el) => (fruitRefs.current[i] = el)}>
                  <mesh geometry={peachGeo} material={peachMat} scale={FRUIT_RADIUS} castShadow />
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

      <ContactShadows position={[0, 0.002, 0]} opacity={0.35} scale={6} blur={2.6} far={4} resolution={512} color="#000000" />

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
          shadows
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
