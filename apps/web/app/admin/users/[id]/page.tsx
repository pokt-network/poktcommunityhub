import { planRoleChange, planUserDeletion } from '@community/core';
import { adminRanks, adminUser, submissionHistory } from '@community/store';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  assignRankAction,
  deleteUserAction,
  removeRankAction,
  setUserRoleAction,
} from '@/lib/admin-actions';
import { requireAdmin } from '@/lib/authz';
import { db } from '@/lib/db';
import { syncMemberAction } from '@/lib/discord-actions';
import { formatDate, STATUS_LABELS } from '@/lib/format';
import { isUuid } from '@/lib/ids';

import { ActionForm } from '@/app/action-form';
import styles from '@/app/hub.module.css';
import { AdminFrame } from '../../admin-frame';

export const metadata: Metadata = { title: 'Member' };

const SOURCE_LABELS = { xp: 'earned by XP', quest: 'quest reward', manual: 'given by hand' };

/**
 * Flow 12: one member, their full history (pending, rejected and notes
 * included), their ranks, and what this admin may do to them. Controls are
 * shown only when core's rules allow them; the store checks again on submit.
 */
export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [user, history, ranks] = await Promise.all([
    adminUser(db(), id),
    submissionHistory(db(), id),
    adminRanks(db()),
  ]);
  if (user === null) notFound();

  const actor = { id: admin.id, role: admin.role };
  const target = { id: user.id, role: user.role };
  const roleTo = user.role === 'admin' ? 'ambassador' : 'admin';
  const canChangeRole = planRoleChange({ actor, target, to: roleTo }).ok;
  const canDelete = planUserDeletion({ actor, target }).ok;
  const held = new Set(user.ranks.map((r) => r.roleId));
  const assignable = ranks.filter((r) => !held.has(r.id));

  return (
    <AdminFrame title={user.name}>
      <p className={styles.muted}>
        <Link href="/admin/users">← All members</Link> ·{' '}
        <Link href={`/users/${id}`}>Public profile</Link>
      </p>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{user.role}</span>
          <span className={styles.muted}>Role</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{user.xp.toLocaleString('en-US')}</span>
          <span className={styles.muted}>XP</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{formatDate(user.joinedAt)}</span>
          <span className={styles.muted}>Joined</span>
        </div>
      </div>
      <p className={styles.muted}>Discord id {user.discordId}</p>

      <section className={styles.heading} aria-labelledby="ranks-heading">
        <h2 id="ranks-heading" className={styles.subtitle}>
          Ranks
        </h2>
        {user.ranks.length === 0 ? (
          <p className={styles.muted}>None.</p>
        ) : (
          <ul className={styles.list}>
            {user.ranks.map((r) => (
              <li key={r.roleId} className={styles.spread}>
                <span>
                  {r.name} <span className={styles.muted}>({SOURCE_LABELS[r.source]})</span>
                </span>
                {r.source === 'manual' && (
                  <ActionForm
                    action={removeRankAction}
                    submit="Remove"
                    tone="quiet"
                    className={styles.inline}
                  >
                    <input type="hidden" name="userId" value={id} />
                    <input type="hidden" name="roleId" value={r.roleId} />
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
        {assignable.length > 0 && (
          <ActionForm
            action={assignRankAction}
            submit="Give rank"
            tone="quiet"
            className={styles.inline}
          >
            <input type="hidden" name="userId" value={id} />
            <label className={styles.field}>
              Give a rank by hand
              <select className={styles.input} name="roleId" required defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                {assignable.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          </ActionForm>
        )}
        <ActionForm
          action={syncMemberAction}
          submit="Sync Discord roles"
          tone="quiet"
          className={styles.inline}
        >
          <input type="hidden" name="userId" value={id} />
        </ActionForm>
      </section>

      <section className={styles.heading} aria-labelledby="history-heading">
        <h2 id="history-heading" className={styles.subtitle}>
          Submissions
        </h2>
        {history.length === 0 ? (
          <p className={styles.muted}>None.</p>
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
                  {h.xp !== 0 && <span className={styles.xp}>{h.xp} XP</span>}
                  {h.hasFile && (
                    <a href={`/proofs/${h.id}`} target="_blank" rel="noopener">
                      Screenshot
                    </a>
                  )}
                </div>
                {h.reviewNote !== null && <p className={styles.muted}>Note: {h.reviewNote}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canChangeRole && (
        <section className={styles.panel} aria-labelledby="role-heading">
          <h2 id="role-heading" className={styles.subtitle}>
            Role
          </h2>
          <ActionForm
            action={setUserRoleAction}
            tone="quiet"
            submit={roleTo === 'admin' ? 'Make admin' : 'Remove admin'}
          >
            <input type="hidden" name="userId" value={id} />
            <input type="hidden" name="role" value={roleTo} />
            <p className={styles.muted}>
              {roleTo === 'admin'
                ? 'Admins review proof and manage quests, ranks and ambassadors. They cannot change anyone’s role.'
                : 'They lose the admin console on their next page load.'}
            </p>
          </ActionForm>
        </section>
      )}

      {canDelete && (
        <section className={styles.panel} aria-labelledby="delete-heading">
          <h2 id="delete-heading" className={styles.subtitle}>
            Delete account
          </h2>
          <ActionForm action={deleteUserAction} tone="danger" submit="Delete account">
            <input type="hidden" name="userId" value={id} />
            <p className={styles.muted}>
              Removes their submissions, {user.xp.toLocaleString('en-US')} XP, ranks, screenshots
              and sessions, for good. If they sign in again they start from nothing.
            </p>
            <label className={styles.field}>
              Type “{user.name}” to confirm
              <input className={styles.input} name="confirmName" required autoComplete="off" />
            </label>
          </ActionForm>
        </section>
      )}
    </AdminFrame>
  );
}
