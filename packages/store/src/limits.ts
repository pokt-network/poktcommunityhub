import { checkRate, SUBMISSION_LIMITS, type RateDecision } from '@community/core';

import type { Pool } from './pool.js';
import { rollback, withTransaction } from './tx.js';

/**
 * Count one attempt to submit proof against the user's limit (brief section 12,
 * item 4), or refuse it. An allowed attempt is recorded before the caller does
 * any work, so a burst cannot slip through while the first upload is still
 * being processed.
 *
 * One user's attempts are serialised on an advisory lock, so two requests at
 * once cannot both read "one slot left" and both take it.
 */
export async function takeSubmissionAttempt(
  pool: Pool,
  input: { userId: string; withFile: boolean; now?: Date },
): Promise<RateDecision> {
  const now = input.now ?? new Date();
  const rule = input.withFile ? SUBMISSION_LIMITS.withFile : SUBMISSION_LIMITS.linksOnly;

  return withTransaction<RateDecision>(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('community.submit:' || $1))", [
      input.userId,
    ]);
    await client.query(
      `DELETE FROM submission_attempts WHERE user_id = $1 AND at < $2::timestamptz - interval '1 hour'`,
      [input.userId, now],
    );
    const { rows } = await client.query<{ at: Date }>(
      `SELECT at FROM submission_attempts
        WHERE user_id = $1 AND with_file = $2 AND at > $3::timestamptz - make_interval(secs => $4)`,
      [input.userId, input.withFile, now, rule.windowMs / 1000],
    );
    const decision = checkRate(
      rows.map((row) => row.at),
      now,
      rule,
    );
    if (!decision.allowed) return rollback(decision);
    await client.query(
      'INSERT INTO submission_attempts (user_id, with_file, at) VALUES ($1, $2, $3)',
      [input.userId, input.withFile, now],
    );
    return decision;
  });
}
