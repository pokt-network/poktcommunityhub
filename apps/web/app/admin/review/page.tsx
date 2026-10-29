import type { SubmissionStatus } from '@community/core';
import { reviewQueue } from '@community/store';
import type { Metadata } from 'next';
import Link from 'next/link';

import { reviewAction } from '@/lib/admin-actions';
import { requireAdmin } from '@/lib/authz';
import { db } from '@/lib/db';
import { formatDate, formatXp, STATUS_LABELS } from '@/lib/format';

import { ActionForm } from '../../action-form';
import styles from '../../hub.module.css';
import { AdminFrame } from '../admin-frame';

export const metadata: Metadata = { title: 'Review' };

const TABS: SubmissionStatus[] = ['pending', 'approved', 'rejected'];

/**
 * Flow 8: the review queue. Proof links open in a new tab with no referrer, and
 * screenshots through the authenticated route. Approve, reject (with a note) or
 * undo; the store refuses an admin's own submission (section 13.3).
 */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const admin = await requireAdmin();
  const { status: raw } = await searchParams;
  const status = TABS.find((s) => s === raw) ?? 'pending';
  const queue = await reviewQueue(db(), { status });

  return (
    <AdminFrame title="Review">
      <nav className={styles.tabs} aria-label="Status">
        {TABS.map((s) => (
          <Link
            key={s}
            className={styles.tab}
            href={`/admin/review?status=${s}`}
            aria-current={s === status ? 'page' : undefined}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </nav>

      {queue.length === 0 ? (
        <p className={styles.empty}>
          {status === 'pending' ? 'Nothing waiting for review.' : 'Nothing here yet.'}
        </p>
      ) : (
        <ul className={styles.list}>
          {queue.map((item) => (
            <li key={item.id} className={styles.panel}>
              <div className={styles.spread}>
                <span className={styles.person}>
                  {item.user.avatarUrl !== null && (
                    <img src={item.user.avatarUrl} alt="" width={24} height={24} />
                  )}
                  <Link href={`/admin/users/${item.user.id}`}>{item.user.name}</Link>
                </span>
                <span className={styles.meta}>
                  <Link href={`/quests/${item.quest.id}`}>{item.quest.title}</Link>
                  <span className={styles.xp}>{formatXp(item.quest.xpReward)}</span>
                </span>
              </div>
              <p className={styles.muted}>
                Submitted {formatDate(item.submittedAt)}
                {item.reviewedAt !== null &&
                  ` · ${STATUS_LABELS[item.status]} ${formatDate(item.reviewedAt)}${
                    item.reviewerName === null ? '' : ` by ${item.reviewerName}`
                  }`}
              </p>
              {item.quest.linkHint !== null && (
                <p className={styles.muted}>Asked for: {item.quest.linkHint}</p>
              )}
              <ul className={styles.links}>
                {item.proofUrls.map((url, i) => (
                  <li key={`${i}-${url}`}>
                    <a href={url} target="_blank" rel="noopener noreferrer nofollow">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
              {item.hasFile && (
                <a href={`/proofs/${item.id}`} target="_blank" rel="noopener">
                  View screenshot
                </a>
              )}
              {item.reviewNote !== null && (
                <p>
                  <strong>Note:</strong> {item.reviewNote}
                </p>
              )}

              {item.user.id === admin.id ? (
                <p className={styles.muted}>Your own submission: another admin reviews it.</p>
              ) : item.status === 'pending' ? (
                <div className={styles.formGrid}>
                  <ActionForm action={reviewAction} submit="Approve">
                    <input type="hidden" name="submissionId" value={item.id} />
                    <input type="hidden" name="action" value="approve" />
                    <label className={styles.field}>
                      Note (optional)
                      <input className={styles.wide} name="note" maxLength={1000} />
                    </label>
                  </ActionForm>
                  <ActionForm action={reviewAction} submit="Reject" tone="danger">
                    <input type="hidden" name="submissionId" value={item.id} />
                    <input type="hidden" name="action" value="reject" />
                    <label className={styles.field}>
                      Why (the member sees this)
                      <input className={styles.wide} name="note" required maxLength={1000} />
                    </label>
                  </ActionForm>
                </div>
              ) : (
                <ActionForm action={reviewAction} submit="Undo review" tone="quiet">
                  <input type="hidden" name="submissionId" value={item.id} />
                  <input type="hidden" name="action" value="undo" />
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminFrame>
  );
}
