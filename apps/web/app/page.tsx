import Link from 'next/link';

import styles from './page.module.css';

/**
 * Holding page: the brand shell and the way in. The quest board replaces it in
 * phase 4.
 */
export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <img className={styles.mark} src="/pokt-mark.svg" alt="" width={64} height={64} />
        <h1 className={styles.title}>POKT Community Hub</h1>
        <p className={styles.lede}>Quests, proof and recognition for Pocket Network ambassadors.</p>
        <Link className={styles.signin} href="/signin">
          Sign in with Discord
        </Link>
        <span className={styles.badge}>under construction</span>
      </div>
    </main>
  );
}
