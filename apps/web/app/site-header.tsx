import { LogIn } from 'lucide-react';
import Link from 'next/link';

import { currentViewer } from '@/lib/authz';

import styles from './hub.module.css';
import { NavPills } from './nav-pills';

/** The bar on every page: the way round, and who you are signed in as. */
export async function SiteHeader() {
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
          {viewer === null ? (
            <Link className={styles.gold} href="/signin">
              <LogIn size={18} aria-hidden />
              <span>Sign in</span>
            </Link>
          ) : (
            <Link className={styles.me} href="/me" aria-label={`Your profile (${viewer.name})`}>
              {viewer.avatarUrl !== null ? (
                <img src={viewer.avatarUrl} alt="" width={30} height={30} />
              ) : (
                // The name is hidden on narrow screens, so the link needs something to show.
                <span className={styles.initial} aria-hidden>
                  {Array.from(viewer.name)[0]?.toUpperCase()}
                </span>
              )}
              <span>{viewer.name}</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
