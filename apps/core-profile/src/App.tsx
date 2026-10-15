import React, { useEffect, useState } from 'react';
import { loadProfileConfig } from './services/configService';
import { ProfileConfig } from './types/profile';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { StatsSection } from './components/StatsSection';
import { Skills } from './components/Skills';
import { Showcase } from './components/Showcase';
import { Timeline } from './components/Timeline';
import { Contact } from './components/Contact';
import { Footer } from './components/Footer';
import { YamlViewerModal } from './components/YamlViewerModal';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [profileData, setProfileData] = useState<ProfileConfig | null>(null);
  const [rawYaml, setRawYaml] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isYamlModalOpen, setIsYamlModalOpen] = useState<boolean>(false);

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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation */}
      <Navbar
        personal={profileData.personal}
        onOpenYamlModal={() => setIsYamlModalOpen(true)}
      />

      {/* Main Content Sections */}
      <main style={{ flex: 1 }}>
        <Hero
          personal={profileData.personal}
          onOpenYamlModal={() => setIsYamlModalOpen(true)}
        />

        {profileData.stats && profileData.stats.length > 0 && (
          <StatsSection stats={profileData.stats} />
        )}

        {profileData.skills && profileData.skills.length > 0 && (
          <Skills skills={profileData.skills} />
        )}

        {profileData.showcase && profileData.showcase.length > 0 && (
          <Showcase projects={profileData.showcase} />
        )}

        {profileData.timeline && profileData.timeline.length > 0 && (
          <Timeline timeline={profileData.timeline} />
        )}

        {profileData.contacts && (
          <Contact contacts={profileData.contacts} />
        )}
      </main>

      {/* Footer */}
      <Footer personal={profileData.personal} />

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
