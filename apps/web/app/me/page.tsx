import { isStaff } from '@community/core';
import { leaderboardRank, profile, submissionHistory } from '@community/store';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/authz';
import { db } from '@/lib/db';
import { formatDate, STATUS_LABELS } from '@/lib/format';
import { signOutOfHub } from '@/lib/session-actions';

import styles from '../hub.module.css';
import { ProfileSummary } from '../profile-summary';

export const metadata: Metadata = { title: 'Your profile' };

/**
 * The signed-in home: your profile as members see it (flow 7), then your full
 * history (flow 5), which only you and admins see: pending and rejected
 * submissions, reviewer notes and the XP each one holds.
 */
export default async function MePage() {
  const viewer = await requireUser();
  const [me, rank, history] = await Promise.all([
    profile(db(), viewer.id),
    leaderboardRank(db(), { userId: viewer.id, period: 'all' }),
    submissionHistory(db(), viewer.id),
  ]);
  // A session outliving its user cannot happen (sessions cascade), but if it did,
  // signing in again is the answer.
  if (me === null) redirect('/signin');

  return (
    <main className={styles.narrow}>
      <ProfileSummary profile={me} rank={rank} />

      <div className={styles.row}>
        <Link className={styles.quiet} href="/">
          Find a quest
        </Link>
        {isStaff(viewer.role) && (
          <Link className={styles.quiet} href="/admin">
            Admin console
          </Link>
        )}
        <form action={signOutOfHub}>
          <button className={styles.quiet} type="submit">
            Sign out
          </button>
        </form>
      </div>

      <section className={styles.heading} aria-labelledby="history-heading">
        <h2 id="history-heading" className={styles.subtitle}>
          Your submissions
        </h2>
        <p className={styles.muted}>Only you and the hub&apos;s admins can see this list.</p>
        {history.length === 0 ? (
          <p className={styles.empty}>You have not submitted any proof yet.</p>
        ) : (
          <ul className={styles.list}>
            {history.map((h) => (
              <li key={h.id} className={styles.item}>
                <div className={styles.spread}>
                  <Link href={`/quests/${h.questId}`}>{h.questTitle}</Link>
                  <span className={styles.chip} data-status={h.status}>
                    {STATUS_LABELS[h.status]}
                  </span>
                </div>
                <div className={styles.meta}>
                  <span>Submitted {formatDate(h.submittedAt)}</span>
                  {h.reviewedAt !== null && <span>Reviewed {formatDate(h.reviewedAt)}</span>}
                  {h.xp !== 0 && (
                    <span className={styles.xp}>{h.xp.toLocaleString('en-US')} XP</span>
                  )}
                  {h.hasFile && (
                    <a href={`/proofs/${h.id}`} target="_blank" rel="noopener">
                      Screenshot
                    </a>
                  )}
                </div>
                {h.reviewNote !== null && h.reviewNote !== '' && (
                  <p>
                    <strong>Reviewer&apos;s note:</strong> {h.reviewNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
