import {
  planReview,
  type ReviewAction,
  type ReviewRefusal,
  type RoleChanges,
  type SubmissionStatus,
} from '@community/core';

import type { Pool } from './pool.js';
import { enqueue, reconcileRoles } from './roles.js';
import { rollback, withTransaction } from './tx.js';

export type ReviewResult =
  | { ok: true; status: SubmissionStatus; xpDelta: number; roles: RoleChanges }
  | { ok: false; reason: ReviewRefusal | 'not_found' | 'conflict' };

/**
 * Approve, reject or undo one submission (flow 8), as one transaction.
 *
 * Two locks make concurrent reviews safe:
 *   1. The submitter's `users` row, FOR UPDATE, taken first. Every review of any
 *      of that user's submissions queues behind it, so the XP total that rank
 *      eligibility reads cannot change underneath it, and the state read after
 *      the lock is the state the move applies to.
 *   2. `UPDATE … WHERE status = from` as the move itself. Redundant with (1)
 *      today; kept so a future path that forgets the lock still cannot apply a
 *      move twice. It answers `conflict`, never a second award.
 */
export async function reviewSubmission(
  pool: Pool,
  input: { submissionId: string; action: ReviewAction; actorId: string; note?: string | null },
): Promise<ReviewResult> {
  const { submissionId, action, actorId } = input;

  return withTransaction<ReviewResult>(pool, async (client) => {
    const owner = await client.query<{ user_id: string }>(
      'SELECT user_id FROM submissions WHERE id = $1',
      [submissionId],
    );
    const userId = owner.rows[0]?.user_id;
    if (userId === undefined) return rollback({ ok: false, reason: 'not_found' });

    await client.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);

    const current = await client.query<{
      status: SubmissionStatus;
      xp_reward: number;
      quest_id: string;
      awarded: string;
    }>(
      `SELECT s.status, q.xp_reward, q.id AS quest_id,
              (SELECT coalesce(sum(delta), 0) FROM xp_events WHERE submission_id = s.id) AS awarded
         FROM submissions s JOIN quests q ON q.id = s.quest_id
        WHERE s.id = $1`,
      [submissionId],
    );
    const row = current.rows[0];
    // Gone between the two reads: the user was deleted while we waited for the lock.
    if (row === undefined) return rollback({ ok: false, reason: 'not_found' });

    const plan = planReview({
      status: row.status,
      action,
      questXp: row.xp_reward,
      awardedXp: Number(row.awarded),
    });
    if (!plan.ok) return rollback(plan);

    const reviewed = plan.to !== 'pending';
    const moved = await client.query(
      `UPDATE submissions
          SET status = $3, review_note = $4, reviewed_by = $5,
              reviewed_at = CASE WHEN $6 THEN now() END, updated_at = now()
        WHERE id = $1 AND status = $2`,
      [
        submissionId,
        plan.from,
        plan.to,
        reviewed ? (input.note ?? null) : null,
        reviewed ? actorId : null,
        reviewed,
      ],
    );
    if (moved.rowCount !== 1) return rollback({ ok: false, reason: 'conflict' });

    if (plan.xpDelta > 0) {
      await client.query(
        `INSERT INTO xp_events (user_id, submission_id, delta, reason, actor_id)
         VALUES ($1, $2, $3, 'approved', $4)`,
        [userId, submissionId, plan.xpDelta, actorId],
      );
      await enqueue(client, 'announce', {
        event: 'quest_completed',
        userId,
        questId: row.quest_id,
        submissionId,
      });
    } else if (plan.xpDelta < 0) {
      // Cancel the one award still standing. The ledger check in planReview has
      // already established that exactly this much is held.
      const reversed = await client.query(
        `INSERT INTO xp_events (user_id, submission_id, delta, reason, reverses, actor_id)
         SELECT user_id, submission_id, -delta, 'undone', id, $2
           FROM xp_events award
          WHERE award.submission_id = $1 AND award.reason = 'approved'
            AND NOT EXISTS (SELECT 1 FROM xp_events r WHERE r.reverses = award.id)
         RETURNING delta`,
        [submissionId, actorId],
      );
      const total = reversed.rows.reduce((sum, r: { delta: number }) => sum + r.delta, 0);
      if (total !== plan.xpDelta) {
        throw new Error(
          `ledger for submission ${submissionId}: reversed ${total}, expected ${plan.xpDelta}`,
        );
      }
    }

    const roles = await reconcileRoles(client, userId, actorId);
    return { ok: true, status: plan.to, xpDelta: plan.xpDelta, roles };
  });
}
