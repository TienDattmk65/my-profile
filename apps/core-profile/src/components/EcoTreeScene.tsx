import React, { Suspense, lazy, useState } from 'react';
import { ShowcaseProject } from '../types/profile';
import { EcoTreeVisualizer } from './EcoTreeVisualizer';

interface EcoTreeSceneProps {
  currentStage: 'seed' | 'sprout' | 'sapling' | 'blooming' | 'mature';
  projects: ShowcaseProject[];
  onSelectProject?: (project: ShowcaseProject) => void;
}

// Three.js được tách thành chunk riêng, chỉ tải khi trình duyệt hỗ trợ WebGL
const EcoTree3D = lazy(() => import('./EcoTree3D'));

// Chỉ dò một lần: mỗi lần dò tạo thêm một WebGL context, trình duyệt giới hạn số context đang mở
let webglSupport: boolean | undefined;
export const supportsWebGL = () => {
  if (webglSupport !== undefined) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    webglSupport = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
};

// Lỗi khi dựng cảnh 3D (mất WebGL context, driver lỗi...) -> quay về cây SVG
export class TreeErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Cây đào 3D; cây SVG 2D hiện trong lúc tải và là bản dự phòng khi không có WebGL. */
export const EcoTreeScene: React.FC<EcoTreeSceneProps> = (props) => {
  const [webgl] = useState(supportsWebGL);
  const fallback = <EcoTreeVisualizer {...props} />;
  if (!webgl) return fallback;

  return (
    <TreeErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <EcoTree3D {...props} />
      </Suspense>
    </TreeErrorBoundary>
  );
};
