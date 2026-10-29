import { questPhase } from '@community/core';
import { adminQuests } from '@community/store';
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireAdmin } from '@/lib/authz';
import { db } from '@/lib/db';
import { formatDate, formatXp } from '@/lib/format';

import styles from '../../hub.module.css';
import { QuestIcon } from '../../quest-icon';
import { AdminFrame } from '../admin-frame';

export const metadata: Metadata = { title: 'Quests' };

const PHASE_LABELS = { live: 'Live', scheduled: 'Scheduled', ended: 'Ended', closed: 'Closed' };

/** Flow 9: every quest, live or not, with its submissions. */
export default async function AdminQuestsPage() {
  await requireAdmin();
  const quests = await adminQuests(db());
  const now = new Date();

  return (
    <AdminFrame title="Quests">
      <div>
        <Link className={styles.button} href="/admin/quests/new">
          New quest
        </Link>
      </div>
      {quests.length === 0 ? (
        <p className={styles.empty}>No quests yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Quest</th>
                <th scope="col">State</th>
                <th scope="col">Window</th>
                <th className={styles.num} scope="col">
                  XP
                </th>
                <th className={styles.num} scope="col">
                  Pending / all
                </th>
              </tr>
            </thead>
            <tbody>
              {quests.map((q) => (
                <tr key={q.id}>
                  <td>
                    <span className={styles.person}>
                      <QuestIcon icon={q.icon} size={16} />
                      <Link href={`/admin/quests/${q.id}`}>{q.title}</Link>
                    </span>
                    {q.categoryName !== null && (
                      <span className={styles.muted}> {q.categoryName}</span>
                    )}
                  </td>
                  <td>{PHASE_LABELS[questPhase(q, now)]}</td>
                  <td className={styles.muted}>
                    {q.startsAt === null && q.endsAt === null
                      ? 'Always'
                      : `${q.startsAt === null ? '…' : formatDate(q.startsAt)} – ${
                          q.endsAt === null ? '…' : formatDate(q.endsAt)
                        }`}
                  </td>
                  <td className={styles.num}>{formatXp(q.xpReward)}</td>
                  <td className={styles.num}>
                    {q.pending} / {q.submissions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminFrame>
  );
}
