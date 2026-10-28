import Link from 'next/link';

import { currentViewer } from '@/lib/authz';

import styles from './hub.module.css';

/** The bar on every page: the way round, and who you are signed in as. */
export async function SiteHeader() {
  const viewer = await currentViewer();

  return (
    <header className={styles.header}>
      <Link className={styles.brand} href="/">
        <img src="/pokt-mark.svg" alt="" width={28} height={28} />
        <span>Community Hub</span>
      </Link>
      <nav className={styles.nav} aria-label="Main">
        <Link href="/">Quests</Link>
        <Link href="/leaderboard">Leaderboard</Link>
        {viewer === null ? (
          <Link className={styles.navButton} href="/signin">
            Sign in
          </Link>
        ) : (
          <Link className={styles.me} href="/me" aria-label={`Your profile (${viewer.name})`}>
            {viewer.avatarUrl !== null ? (
              <img src={viewer.avatarUrl} alt="" width={28} height={28} />
            ) : (
              // The name is hidden on narrow screens, so the link needs something to show.
              <span className={styles.initial} aria-hidden>
                {Array.from(viewer.name)[0]?.toUpperCase()}
              </span>
            )}
            <span>{viewer.name}</span>
          </Link>
        )}
      </nav>
    </header>
  );
}
