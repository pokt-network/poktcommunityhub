import { adminCounts } from '@community/store';
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireAdmin } from '@/lib/authz';
import { db } from '@/lib/db';

import styles from '../hub.module.css';
import { AdminFrame } from './admin-frame';

export const metadata: Metadata = { title: 'Admin' };

/**
 * Every page under app/admin calls requireAdmin() itself; the adversarial suite
 * fails one that does not. A layout is not enough: it does not re-run when a
 * client navigates between the pages below it.
 */
export default async function AdminPage() {
  const admin = await requireAdmin();
  const counts = await adminCounts(db());

  return (
    <AdminFrame title="Admin console">
      <p className={styles.lede}>
        Signed in as {admin.name} ({admin.role}).
      </p>
      <div className={styles.counts}>
        <Link className={styles.card} href="/admin/review">
          <span className={styles.statValue}>{counts.pending}</span>
          <span className={styles.muted}>Waiting for review</span>
        </Link>
        <Link className={styles.card} href="/admin/quests">
          <span className={styles.statValue}>{counts.liveQuests}</span>
          <span className={styles.muted}>Live quests</span>
        </Link>
        <Link className={styles.card} href="/admin/users">
          <span className={styles.statValue}>{counts.users}</span>
          <span className={styles.muted}>Members</span>
        </Link>
      </div>
    </AdminFrame>
  );
}
