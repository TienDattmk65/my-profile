import { parse } from 'yaml';
import { ProfileConfig } from '../types/profile';

let cachedConfig: ProfileConfig | null = null;
let cachedRawYaml: string = '';

export async function loadProfileConfig(): Promise<{ config: ProfileConfig; rawYaml: string }> {
  if (cachedConfig && cachedRawYaml) {
    return { config: cachedConfig, rawYaml: cachedRawYaml };
  }

  try {
    const response = await fetch('/profile.config.yml?v=' + Date.now());
    if (!response.ok) {
      throw new Error(`Không thể tải file cấu hình YAML: ${response.statusText}`);
    }

    const yamlText = await response.text();
    const parsedData = parse(yamlText) as ProfileConfig;

    if (!parsedData || !parsedData.personal) {
      throw new Error('Dữ liệu file YAML không hợp lệ hoặc thiếu trường personal.');
    }

    cachedConfig = parsedData;
    cachedRawYaml = yamlText;

    return { config: parsedData, rawYaml: yamlText };
  } catch (error) {
    console.error('Lỗi khi nạp file YAML, kích hoạt fallback mặc định:', error);
    // Trả về fallback data an toàn để web không bị crash
    const fallbackConfig: ProfileConfig = {
      personal: {
        name: 'Tiến Đạt',
        headline: 'Cloud & DevOps Engineer • AI & Data Driven',
        subheadline: 'Xây dựng hệ thống phân tán chịu tải cao và tự động hóa hạ tầng đám mây.',
        location: 'Hà Nội, Việt Nam',
        statusBadge: { text: 'Sẵn sàng đón nhận cơ hội mới', type: 'available' },
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
        resumeUrl: '#contact',
        bio: 'Kỹ sư phần mềm định hướng Cloud Native, Kubernetes, CI/CD và trí tuệ nhân tạo.'
      },
      stats: [
        { label: 'Microservices', value: '3+', icon: 'Server' },
        { label: 'CI/CD Pipelines', value: '100%', icon: 'GitBranch' },
        { label: 'Container Uptime', value: '99.9%', icon: 'Activity' }
      ],
      skills: [],
      showcase: [],
      timeline: [],
      contacts: {
        email: 'tiendat.devops@example.com',
        github: 'https://github.com/TienDattmk65',
        linkedin: 'https://linkedin.com/in/tiendat-dev',
        telegram: 'https://t.me/tiendat_dev',
        location: 'Hà Nội, Việt Nam'
      }
    };
    return { config: fallbackConfig, rawYaml: '# Fallback config loaded due to fetch error' };
  }
}
