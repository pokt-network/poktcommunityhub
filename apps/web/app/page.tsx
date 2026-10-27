import styles from './page.module.css';

/**
 * Holding page for phase 1: proves the brand shell, fonts and deployment end to
 * end. The quest board replaces it in phase 4.
 */
export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <img className={styles.mark} src="/pokt-mark.svg" alt="" width={64} height={64} />
        <h1 className={styles.title}>POKT Community Hub</h1>
        <p className={styles.lede}>
          Quests, proof and recognition for Pocket Network ambassadors. Sign in with Discord when we
          launch.
        </p>
        <span className={styles.badge}>under construction</span>
      </div>
    </main>
  );
}
