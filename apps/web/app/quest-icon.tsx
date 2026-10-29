import type { QuestIcon as QuestIconId } from '@community/core';
import {
  AtSign,
  BookOpen,
  Bug,
  Code,
  Compass,
  Diamond,
  GitPullRequest,
  GraduationCap,
  Languages,
  Mail,
  Megaphone,
  Newspaper,
  Share2,
  Terminal,
  Trophy,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';

import styles from './hub.module.css';

/** The drawing for each id in core's QUEST_ICONS (brief section 13.2). */
const ICONS: Record<QuestIconId, LucideIcon> = {
  megaphone: Megaphone,
  share: Share2,
  'at-sign': AtSign,
  newspaper: Newspaper,
  'book-open': BookOpen,
  video: Video,
  languages: Languages,
  users: Users,
  mail: Mail,
  'graduation-cap': GraduationCap,
  code: Code,
  'git-pull-request': GitPullRequest,
  terminal: Terminal,
  bug: Bug,
  compass: Compass,
  trophy: Trophy,
};

/** A quest's icon in its brand tile. An unknown or missing id draws a plain diamond. */
export function QuestIcon({ icon, size = 22 }: { icon: string | null; size?: number }) {
  const Icon = (icon !== null && ICONS[icon as QuestIconId]) || Diamond;
  return (
    <span className={styles.iconTile} aria-hidden>
      <Icon size={size} strokeWidth={1.75} />
    </span>
  );
}
