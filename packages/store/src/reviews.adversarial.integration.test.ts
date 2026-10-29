/**
 * Adversarial: double clicks, two admins at once, and a tampered ledger.
 *
 * The MVP could award XP twice for one approval. Each test here fires the
 * conflicting requests concurrently on separate connections and asserts the
 * database ends in exactly one consistent state.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { reviewSubmission } from './reviews.js';
import {
  createQuest,
  createRole,
  createSubmission,
  createUser,
  heldRoles,
  ledger,
  resetDatabase,
  testDatabaseUrl,
  testPool,
  whileLocked,
} from './testing.js';
import { xpTotal } from './xp.js';

const url = testDatabaseUrl();
const TIMES = 10;

describe.skipIf(url === undefined)('reviewSubmission (adversarial)', () => {
  const pool = testPool(url ?? '');
  let admin: string;
  let user: string;

  beforeEach(async () => {
    await resetDatabase(pool);
    admin = await createUser(pool, { name: 'Admin', role: 'admin' });
    user = await createUser(pool, { name: 'Ambassador' });
  });
  afterAll(() => pool.end());

  const review = (submissionId: string, action: 'approve' | 'reject' | 'undo') =>
    // A rejection needs a note (section 13.3); approve and undo take none here.
    reviewSubmission(pool, {
      submissionId,
      action,
      actorId: admin,
      note: action === 'reject' ? 'Not enough proof.' : null,
    });

  const succeeded = (results: { ok: boolean }[]) => results.filter((r) => r.ok).length;

  /** Every request queued on the submission's row before any may proceed. */
  const contended = <T>(submissionIds: string[], requests: () => Promise<T>[]) =>
    whileLocked(
      pool,
      { sql: 'SELECT 1 FROM submissions WHERE id = ANY($1) FOR UPDATE', params: [submissionIds] },
      requests,
    );

  it(`awards XP once when the same approval arrives ${TIMES} times at once`, async () => {
    const submission = await createSubmission(pool, user, await createQuest(pool, { xp: 50 }));

    const results = await contended([submission], () =>
      Array.from({ length: TIMES }, () => review(submission, 'approve')),
    );

    expect(succeeded(results)).toBe(1);
    for (const result of results.filter((r) => !r.ok)) {
      expect(['not_pending', 'conflict']).toContain(result.ok ? null : result.reason);
    }
    expect(await ledger(pool, submission)).toEqual([{ delta: 50, reason: 'approved' }]);
    expect(await xpTotal(pool, user)).toBe(50);
  });

  it('lets exactly one of a simultaneous approve and reject win', async () => {
    const submission = await createSubmission(pool, user, await createQuest(pool, { xp: 50 }));

    const results = await contended([submission], () => [
      ...Array.from({ length: TIMES / 2 }, () => review(submission, 'approve')),
      ...Array.from({ length: TIMES / 2 }, () => review(submission, 'reject')),
    ]);

    expect(succeeded(results)).toBe(1);
    const { rows } = await pool.query<{ status: string }>(
      'SELECT status FROM submissions WHERE id = $1',
      [submission],
    );
    // Whichever won, the ledger matches it.
    expect(await xpTotal(pool, user)).toBe(rows[0]!.status === 'approved' ? 50 : 0);
  });

  it(`reverses an award once when undo arrives ${TIMES} times at once`, async () => {
    const submission = await createSubmission(pool, user, await createQuest(pool, { xp: 50 }));
    await review(submission, 'approve');

    const results = await contended([submission], () =>
      Array.from({ length: TIMES }, () => review(submission, 'undo')),
    );

    expect(succeeded(results)).toBe(1);
    expect(await ledger(pool, submission)).toEqual([
      { delta: 50, reason: 'approved' },
      { delta: -50, reason: 'undone' },
    ]);
    expect(await xpTotal(pool, user)).toBe(0);
  });

  it('grants a rank crossed by two approvals reviewed at the same moment', async () => {
    // Each quest alone is 60; the rank needs 100. Without the per-user lock, each
    // transaction sees only its own 60 and neither grants the rank.
    await createRole(pool, { name: 'Silver', xpRequired: 100 });
    const first = await createSubmission(pool, user, await createQuest(pool, { xp: 60 }));
    const second = await createSubmission(pool, user, await createQuest(pool, { xp: 60 }));

    const results = await contended([first, second], () => [
      review(first, 'approve'),
      review(second, 'approve'),
    ]);

    expect(succeeded(results)).toBe(2);
    expect(await xpTotal(pool, user)).toBe(120);
    expect(await heldRoles(pool, user)).toEqual({ Silver: 'xp' });
  });

  it('refuses to review a submission whose ledger disagrees with its status', async () => {
    const submission = await createSubmission(pool, user, await createQuest(pool, { xp: 50 }));
    // XP held by a submission that was never approved: a bug or a hand edit.
    await pool.query(
      `INSERT INTO xp_events (user_id, submission_id, delta, reason) VALUES ($1, $2, 50, 'approved')`,
      [user, submission],
    );

    expect(await review(submission, 'approve')).toEqual({
      ok: false,
      reason: 'ledger_inconsistent',
    });
    expect(await ledger(pool, submission)).toEqual([{ delta: 50, reason: 'approved' }]);
  });

  it('refuses to edit or delete ledger rows, or truncate the ledger', async () => {
    const submission = await createSubmission(pool, user, await createQuest(pool, { xp: 50 }));
    await review(submission, 'approve');

    await expect(pool.query('UPDATE xp_events SET delta = 5000')).rejects.toThrow(/append-only/);
    await expect(pool.query('DELETE FROM xp_events')).rejects.toThrow(/append-only/);
    await expect(pool.query('TRUNCATE xp_events')).rejects.toThrow(/append-only/);
    // And a submission holding XP cannot be deleted out from under its ledger.
    await expect(pool.query('DELETE FROM submissions')).rejects.toThrow(/append-only/);
    expect(await xpTotal(pool, user)).toBe(50);
  });

  it('removes the ledger with its user, and only then (account deletion)', async () => {
    const submission = await createSubmission(pool, user, await createQuest(pool, { xp: 50 }));
    await review(submission, 'approve');

    await pool.query('DELETE FROM users WHERE id = $1', [user]);

    expect(await ledger(pool, submission)).toEqual([]);
  });
});
