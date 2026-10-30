'use client';

import { Swords, Trophy, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import styles from './hub.module.css';

const LINKS: {
  href: string;
  label: string;
  icon: LucideIcon;
  matches: (path: string) => boolean;
}[] = [
  {
    href: '/',
    label: 'Quests',
    icon: Swords,
    matches: (path) => path === '/' || path.startsWith('/quests'),
  },
  {
    href: '/leaderboard',
    label: 'Leaderboard',
    icon: Trophy,
    matches: (path) => path.startsWith('/leaderboard'),
  },
];

/** The main nav, with the current section lit. A client component only for the path. */
export function NavPills() {
  const path = usePathname();
  return (
    <nav className={styles.pills} aria-label="Main">
      {LINKS.map(({ href, label, icon: Icon, matches }) => (
        <Link key={href} href={href} aria-current={matches(path) ? 'page' : undefined}>
          <Icon size={16} aria-hidden />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
