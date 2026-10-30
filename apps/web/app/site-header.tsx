import { LogIn } from 'lucide-react';
import Link from 'next/link';

import { currentViewer } from '@/lib/authz';
import type { Theme } from '@/lib/theme';

import { Avatar } from './avatar';
import styles from './hub.module.css';
import { NavPills } from './nav-pills';
import { ThemeToggle } from './theme-toggle';

/** The bar on every page: the way round, the theme, and who you are signed in as. */
export async function SiteHeader({ theme }: { theme: Theme }) {
  const viewer = await currentViewer();

  return (
    <header className={styles.header}>
      <div className={styles.headerBar}>
        <Link className={styles.brand} href="/">
          <img src="/pokt-mark.svg" alt="" width={30} height={30} />
          <span>Community Hub</span>
        </Link>
        <NavPills />
        <div className={styles.headerActions}>
          <ThemeToggle initial={theme} />
          {viewer === null ? (
            <Link className={styles.gold} href="/signin">
              <LogIn size={18} aria-hidden />
              <span>Sign in</span>
            </Link>
          ) : (
            <Link className={styles.me} href="/me" aria-label={`Your profile (${viewer.name})`}>
              <Avatar url={viewer.avatarUrl} name={viewer.name} size={30} />
              <span>{viewer.name}</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
