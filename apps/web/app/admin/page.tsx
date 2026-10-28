import type { Metadata } from 'next';
import Link from 'next/link';

import { requireAdmin } from '@/lib/authz';

import styles from '../shell.module.css';

export const metadata: Metadata = { title: 'Admin' };

/**
 * Every page under app/admin calls requireAdmin() itself; the adversarial suite
 * fails one that does not. A layout is not enough: it does not re-run when a
 * client navigates between the pages below it.
 */
export default async function AdminPage() {
  const admin = await requireAdmin();

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>Admin console</h1>
        <p className={styles.lede}>
          Signed in as {admin.name}. Review, quests, ranks and users arrive here in phase 5.
        </p>
        <Link className={styles.quiet} href="/me">
          Back to your profile
        </Link>
      </div>
    </main>
  );
}
