import type { Metadata } from 'next';
import Link from 'next/link';

import { requireUser } from '@/lib/authz';
import { signOutOfHub } from '@/lib/session-actions';

import styles from '../shell.module.css';

export const metadata: Metadata = { title: 'Your profile' };

/**
 * The signed-in landing page. Phase 4 adds XP, ranks and history (flows 5 to 7);
 * for now it proves who the hub thinks you are.
 */
export default async function MePage() {
  const viewer = await requireUser();

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        {viewer.avatarUrl !== null && (
          <img className={styles.avatar} src={viewer.avatarUrl} alt="" width={96} height={96} />
        )}
        <h1 className={styles.title}>{viewer.name}</h1>
        <span className={styles.badge}>{viewer.role}</span>
        <p className={styles.lede}>Quests, XP and your history arrive here next.</p>
        <div className={styles.row}>
          {viewer.role === 'admin' && (
            <Link className={styles.button} href="/admin">
              Admin console
            </Link>
          )}
          <form action={signOutOfHub}>
            <button className={styles.quiet} type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
