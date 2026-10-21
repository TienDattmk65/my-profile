import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Nền 3D phía sau toàn trang: bụi sáng nhiều lớp chiều sâu + cánh hoa đào bay.
// Camera trượt dọc theo vị trí cuộn (đỉnh trang = hiện tại ở trên, đáy = mặt đất 2002) nên các lớp
// gần/xa trôi với tốc độ khác nhau (parallax), và nghiêng nhẹ theo chuột.

const prefersReducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const isCoarsePointer = () => !!window.matchMedia?.('(pointer: coarse)').matches;

// Quãng đường camera đi hết từ đỉnh tới đáy trang (đơn vị 3D)
const TRAVEL = 26;
const TOP_Y = 4;

const seededRandom = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const scrollProgress = () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
};

const DUST_COLORS = ['#00f2fe', '#4facfe', '#8b5cf6', '#ff8fab', '#ffd166', '#00f59b'];

const DUST_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.15 + aPhase * 6.2831) * 0.25;
    p.y += cos(uTime * 0.12 + aPhase * 4.0) * 0.18;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (16.0 / -mv.z);
    vColor = aColor;
    vTwinkle = 0.55 + 0.45 * sin(uTime * (0.6 + aPhase) + aPhase * 12.0);
  }
`;

const DUST_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    gl_FragColor = vec4(vColor, a * 0.75 * vTwinkle);
  }
`;

const Dust: React.FC<{ count: number; reduced: boolean }> = ({ count, reduced }) => {
  const gl = useThree((s) => s.gl);
  const { geometry, material } = useMemo(() => {
    const rand = seededRandom(2002);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const z = -2 - Math.pow(rand(), 0.8) * 26;
      const spread = 6 + -z * 0.75;
      pos[i * 3] = (rand() * 2 - 1) * spread;
      pos[i * 3 + 1] = TOP_Y + 6 - rand() * (TRAVEL + 14);
      pos[i * 3 + 2] = z;
      c.set(DUST_COLORS[Math.floor(rand() * DUST_COLORS.length)]);
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = 1.2 + Math.pow(rand(), 3) * 5;
      phase[i] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: DUST_VERTEX,
      fragmentShader: DUST_FRAGMENT,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: geo, material: mat };
  }, [count]);

  useEffect(() => {
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
  }, [gl, material]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame((state) => {
    if (!reduced) material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
};

/** Cánh hoa đào: mặt cong nhẹ, hồng đậm ở gốc nhạt dần ra mép */
function buildPetalGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-0.08, 0.03, -0.11, 0.13, -0.05, 0.18);
  shape.quadraticCurveTo(0, 0.155, 0.05, 0.18);
  shape.bezierCurveTo(0.11, 0.13, 0.08, 0.03, 0, 0);
  const geo = new THREE.ShapeGeometry(shape, 6);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col: number[] = [];
  const deep = new THREE.Color('#ff4d6d');
  const light = new THREE.Color('#ffb3c6');
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    pos.setZ(i, r * r * 2.5);
    const c = deep.clone().lerp(light, Math.min(1, r / 0.18));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.translate(0, -0.09, 0);
  geo.computeVertexNormals();
  return geo;
}

const Petals: React.FC<{ count: number; reduced: boolean }> = ({ count, reduced }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(buildPetalGeometry, []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.7, depthWrite: false }),
    []
  );
  const seeds = useMemo(() => {
    const rand = seededRandom(91);
    return Array.from({ length: count }, () => ({
      x: (rand() * 2 - 1) * 9,
      z: -3 - rand() * 12,
      y0: rand(),
      speed: 0.012 + rand() * 0.02,
      sway: 0.4 + rand() * 0.8,
      spin: 0.3 + rand() * 0.9,
      size: 0.7 + rand() * 1.1,
      phase: rand() * Math.PI * 2,
    }));
  }, [count]);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const s = useMemo(() => new THREE.Vector3(), []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = reduced ? 0 : state.clock.elapsedTime;
    const camY = state.camera.position.y;
    const span = 16;
    seeds.forEach((p, i) => {
      // Cánh hoa rơi vòng lặp trong một "ô" cao `span` luôn bám quanh camera
      const fall = (p.y0 + t * p.speed) % 1;
      const y = camY + span / 2 - fall * span;
      pos.set(p.x + Math.sin(t * p.sway + p.phase) * 0.6, y, p.z);
      e.set(t * p.spin + p.phase, t * p.spin * 0.6, Math.sin(t * 0.5 + p.phase) * 0.8);
      q.setFromEuler(e);
      s.setScalar(p.size);
      m4.compose(pos, q, s);
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />;
};

const CameraRig: React.FC<{ reduced: boolean }> = ({ reduced }) => {
  const pointer = useRef({ x: 0, y: 0 });
  const progress = useRef(scrollProgress());
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const onScroll = () => {
      progress.current = scrollProgress();
      invalidate();
    };
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    if (!reduced) window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('pointermove', onMove);
    };
  }, [invalidate, reduced]);

  useFrame((state) => {
    const cam = state.camera;
    const targetY = TOP_Y - progress.current * TRAVEL;
    const targetX = pointer.current.x * 0.6;
    if (reduced) {
      cam.position.set(0, targetY, 6);
    } else {
      cam.position.x += (targetX - cam.position.x) * 0.04;
      cam.position.y += (targetY - pointer.current.y * 0.35 - cam.position.y) * 0.08;
    }
    cam.lookAt(cam.position.x * 0.4, cam.position.y, -10);
  });

  return null;
};

const Background3D: React.FC = () => {
  const reduced = useMemo(prefersReducedMotion, []);
  const coarse = useMemo(isCoarsePointer, []);

  return (
    <div className="bg3d" aria-hidden="true">
      <Canvas
        dpr={coarse ? 1 : [1, 1.5]}
        frameloop={reduced ? 'demand' : 'always'}
        camera={{ fov: 55, position: [0, TOP_Y - scrollProgress() * TRAVEL, 6], near: 0.1, far: 60 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      >
        <CameraRig reduced={reduced} />
        <Dust count={coarse ? 380 : 900} reduced={reduced} />
        <Petals count={coarse ? 14 : 28} reduced={reduced} />
      </Canvas>
    </div>
  );
};

export default Background3D;
