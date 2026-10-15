export interface StatusBadge {
  text: string;
  type: 'available' | 'busy' | 'open_to_work';
}

export interface PersonalInfo {
  name: string;
  headline: string;
  subheadline: string;
  location: string;
  statusBadge: StatusBadge;
  avatar: string;
  resumeUrl: string;
  bio: string;
}

export interface QuickStat {
  label: string;
  value: string;
  icon: string;
}

export interface SkillItem {
  name: string;
  level: number;
  tags: string[];
}

export interface SkillCategory {
  category: string;
  icon: string;
  description: string;
  items: SkillItem[];
}

export interface ShowcaseProject {
  id: string;
  title: string;
  category: string;
  status: 'live' | 'demo' | 'coming_soon';
  statusLabel: string;
  description: string;
  architecture: string;
  techStack: string[];
  liveUrl: string;
  githubUrl: string;
  icon: string;
  fruitColor?: string;
  fruitPosition?: { x: number; y: number };
}

export interface TimelineItem {
  year: string;
  title: string;
  organization: string;
  badge: string;
  description: string;
  skills: string[];
  treeStage?: 'seed' | 'sprout' | 'sapling' | 'blooming' | 'mature';
  altitude?: string;
  level?: number;
  linkedFruits?: string[];
}


export interface ContactsInfo {
  email: string;
  github: string;
  linkedin: string;
  telegram: string;
  location: string;
}

export type AscentStationKey =
  | 'summit'
  | 'contact'
  | 'stats'
  | 'showcase'
  | 'skills'
  | 'journey'
  | 'ground';

export interface AscentStationInfo {
  icon: string;
  label: string;
  caption?: string;
}

export interface AscentConfig {
  stations?: Partial<Record<AscentStationKey, AscentStationInfo>>;
}

export interface ProfileConfig {
  ascent?: AscentConfig;
  personal: PersonalInfo;
  stats: QuickStat[];
  skills: SkillCategory[];
  showcase: ShowcaseProject[];
  timeline: TimelineItem[];
  contacts: ContactsInfo;
}
