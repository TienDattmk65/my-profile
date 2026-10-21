import React, { Suspense, lazy, useEffect, useLayoutEffect, useState } from 'react';
import { loadProfileConfig } from './services/configService';
import { AscentStationInfo, AscentStationKey, ProfileConfig } from './types/profile';
import { Hero } from './components/Hero';
import { StatsSection } from './components/StatsSection';
import { Skills } from './components/Skills';
import { Showcase } from './components/Showcase';
import { Timeline } from './components/Timeline';
import { Contact } from './components/Contact';
import { YamlViewerModal } from './components/YamlViewerModal';
import { AscentStation } from './components/AscentStation';
import { AltitudeHUD } from './components/AltitudeHUD';
import { TypewriterGreeting } from './components/TypewriterGreeting';
import { SoundToggle } from './components/SoundToggle';
import { parseStartYear } from './services/yearUtils';
import { TreeErrorBoundary, supportsWebGL } from './components/EcoTreeScene';
import { useDepth3D } from './hooks/useDepth3D';
import { useCardTilt } from './hooks/useCardTilt';
import { Loader2 } from 'lucide-react';

// Nền 3D (Three.js) tách chunk riêng, chỉ tải khi có WebGL
const Background3D = lazy(() => import('./components/Background3D'));

// Lời chào dự phòng khi profile.config.yml thiếu mục ascent.greetings
const DEFAULT_GREETINGS = ["Hello,\nI'm Dao Manh Tien Dat", 'Xin chào,\nTôi là Đào Mạnh Tiến Đạt'];

// Nhãn trạm dự phòng khi profile.config.yml thiếu mục ascent.stations
const DEFAULT_STATIONS: Record<AscentStationKey, AscentStationInfo> = {
  summit: { icon: '🏔️', label: 'Đỉnh Cao • Hiện Tại' },
  contact: { icon: '📡', label: 'Trạm Kết Nối' },
  stats: { icon: '📊', label: 'Trạm Chỉ Số Vận Hành' },
  showcase: { icon: '🍑', label: 'Quả Ngọt Microservices' },
  skills: { icon: '🧰', label: 'Kỹ Năng Tích Lũy' },
  journey: { icon: '🌳', label: 'Hành Trình Cây Đào' },
  ground: { icon: '🌰', label: 'Mặt Đất • Điểm Xuất Phát' },
};

export const App: React.FC = () => {
  const [profileData, setProfileData] = useState<ProfileConfig | null>(null);
  const [rawYaml, setRawYaml] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isYamlModalOpen, setIsYamlModalOpen] = useState<boolean>(false);
  const [hasWebGL] = useState(supportsWebGL);

  // Chiều sâu 3D khi cuộn qua các trạm + thẻ kính nghiêng theo chuột
  useDepth3D(!loading);
  useCardTilt();

  useEffect(() => {
    let isMounted = true;
    loadProfileConfig().then((result) => {
      if (isMounted) {
        setProfileData(result.config);
        setRawYaml(result.rawYaml);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Luôn ghim trang ở ĐÁY (2002) khi mới vào để người xem cuộn dần LÊN. Giữ ghim trong lúc
  // ảnh/font còn làm thay đổi chiều cao trang, chỉ thả ra khi người xem tự tương tác.
  useLayoutEffect(() => {
    if (loading) return;

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    // Bỏ #anchor còn sót trên URL (vd: sau khi bấm menu rồi tải lại) để không nhảy khỏi đáy
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    const scrollToBottom = () =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });

    let pinned = true;
    const release = () => {
      pinned = false;
    };
    const keepPinned = () => {
      if (pinned) scrollToBottom();
    };

    scrollToBottom();
    const resizeObserver = new ResizeObserver(keepPinned);
    resizeObserver.observe(document.body);
    window.addEventListener('load', keepPinned);
    document.fonts?.ready.then(keepPinned);

    const releaseEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    releaseEvents.forEach((name) => window.addEventListener(name, release, { passive: true }));

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('load', keepPinned);
      releaseEvents.forEach((name) => window.removeEventListener(name, release));
    };
  }, [loading]);

  if (loading || !profileData) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
        }}
      >
        <Loader2 className="animate-spin" size={40} color="var(--neon-cyan)" />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Đang nạp cấu hình từ profile.config.yml...
        </div>
      </div>
    );
  }

  const station = (key: AscentStationKey): AscentStationInfo =>
    profileData.ascent?.stations?.[key] ?? DEFAULT_STATIONS[key];
  // Năm hiển thị trên bộ đếm: đáy trang = năm của mốc đầu tiên, đỉnh trang = năm hiện tại
  const currentYear = new Date().getFullYear();
  const startYear = profileData.timeline?.length ? parseStartYear(profileData.timeline[0].year) : currentYear;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {hasWebGL && (
        <TreeErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <Background3D />
          </Suspense>
        </TreeErrorBoundary>
      )}
      {/* 🍑 TRỤC TIMELINE VƯƠN LÊN TOÀN TRANG: ĐỈNH (HIỆN TẠI) Ở TRÊN -> MẶT ĐẤT (2002) Ở DƯỚI */}
      <main className="ascent-main" style={{ flex: 1 }}>
        <AscentStation station={station('summit')} year={currentYear} isSummit>
          <Hero
            personal={profileData.personal}
            onOpenYamlModal={() => setIsYamlModalOpen(true)}
          />
        </AscentStation>

        {profileData.contacts && (
          <AscentStation station={station('contact')} year={currentYear}>
            <Contact contacts={profileData.contacts} />
          </AscentStation>
        )}

        {profileData.stats && profileData.stats.length > 0 && (
          <AscentStation station={station('stats')} year={currentYear}>
            <StatsSection stats={profileData.stats} />
          </AscentStation>
        )}

        {profileData.showcase && profileData.showcase.length > 0 && (
          <AscentStation station={station('showcase')} year={currentYear}>
            <Showcase projects={profileData.showcase} />
          </AscentStation>
        )}

        {profileData.skills && profileData.skills.length > 0 && (
          <AscentStation station={station('skills')} year={currentYear}>
            <Skills skills={profileData.skills} />
          </AscentStation>
        )}

        {profileData.timeline && profileData.timeline.length > 0 && (
          <AscentStation station={station('journey')} year={currentYear} depth3d={false}>
            <Timeline
              timeline={profileData.timeline}
              showcase={profileData.showcase}
            />
          </AscentStation>
        )}

        {/* Trang khởi đầu (Mặt Đất): lời chào gõ kiểu terminal ở chính giữa */}
        <AscentStation station={station('ground')} year={startYear} isFullPage hideHead hideHud depth3d={false}>
          <div className="container ground-hero">
            <TypewriterGreeting texts={profileData.ascent?.greetings ?? DEFAULT_GREETINGS} />
          </div>
        </AscentStation>
      </main>

      <AltitudeHUD startYear={startYear} currentYear={currentYear} />
      <SoundToggle />

      {/* YAML Config Inspector Modal */}
      <YamlViewerModal
        isOpen={isYamlModalOpen}
        onClose={() => setIsYamlModalOpen(false)}
        rawYaml={rawYaml}
      />
    </div>
  );
};

export default App;
