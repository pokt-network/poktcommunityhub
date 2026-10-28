import {
  checkProofLinks,
  isQuestLive,
  planSubmission,
  type SubmissionRefusal,
  type SubmissionStatus,
} from '@community/core';

import type { Pool } from './pool.js';
import { rollback, withTransaction } from './tx.js';

export type SubmitResult =
  | {
      ok: true;
      submissionId: string;
      kind: 'create' | 'resubmit';
      /** The proof file this resubmission replaced; the caller deletes it. */
      replacedFile: string | null;
    }
  | { ok: false; reason: SubmissionRefusal | 'quest_not_found' };

/**
 * Submit proof for a quest, or resubmit after a rejection (flows 3 and 4).
 *
 * Races resolve in the database, not here: a first submission is an
 * `INSERT … ON CONFLICT DO NOTHING`, and a resubmission an `UPDATE … WHERE
 * status = 'rejected'`. Whichever request loses is told the submission is
 * already pending, which by then it is.
 */
export async function submitProof(
  pool: Pool,
  input: {
    userId: string;
    questId: string;
    links: readonly string[];
    proofFile: string | null;
    now?: Date;
  },
): Promise<SubmitResult> {
  const now = input.now ?? new Date();

  return withTransaction<SubmitResult>(pool, async (client) => {
    const quest = await client.query<{
      status: 'active' | 'closed';
      starts_at: Date | null;
      ends_at: Date | null;
      link_count: number;
    }>('SELECT status, starts_at, ends_at, link_count FROM quests WHERE id = $1', [input.questId]);
    const q = quest.rows[0];
    if (q === undefined) return rollback({ ok: false, reason: 'quest_not_found' });

    const existing = await client.query<{
      id: string;
      status: SubmissionStatus;
      proof_file: string | null;
    }>('SELECT id, status, proof_file FROM submissions WHERE user_id = $1 AND quest_id = $2', [
      input.userId,
      input.questId,
    ]);
    const prior = existing.rows[0];

    const plan = planSubmission({
      questLive: isQuestLive({ status: q.status, startsAt: q.starts_at, endsAt: q.ends_at }, now),
      existing: prior?.status ?? null,
    });
    if (!plan.ok) return rollback(plan);

    const links = checkProofLinks(input.links, q.link_count);
    if (!links.ok) return rollback({ ok: false, reason: links.reason });

    if (plan.kind === 'create') {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO submissions (user_id, quest_id, proof_urls, proof_file)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, quest_id) DO NOTHING
         RETURNING id`,
        [input.userId, input.questId, links.links, input.proofFile],
      );
      const id = inserted.rows[0]?.id;
      if (id === undefined) return rollback({ ok: false, reason: 'already_pending' });
      return { ok: true, submissionId: id, kind: 'create', replacedFile: null };
    }

    // planSubmission only answers 'resubmit' for an existing, rejected submission.
    if (prior === undefined) throw new Error('resubmit planned with no prior submission');
    const updated = await client.query(
      `UPDATE submissions
          SET status = 'pending', proof_urls = $2, proof_file = $3,
              review_note = NULL, reviewed_by = NULL, reviewed_at = NULL, updated_at = now()
        WHERE id = $1 AND status = 'rejected'`,
      [prior.id, links.links, input.proofFile],
    );
    if (updated.rowCount !== 1) return rollback({ ok: false, reason: 'already_pending' });
    return { ok: true, submissionId: prior.id, kind: 'resubmit', replacedFile: prior.proof_file };
  });
}
