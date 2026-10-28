/**
 * The review transaction against real Postgres: the ledger, roles and outbox
 * rows one review writes, together or not at all.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { reviewSubmission } from './reviews.js';
import {
  createQuest,
  createRole,
  createSubmission,
  createUser,
  heldRoles,
  jobs,
  ledger,
  resetDatabase,
  testDatabaseUrl,
  testPool,
} from './testing.js';
import { xpTotal } from './xp.js';

const url = testDatabaseUrl();

describe.skipIf(url === undefined)('reviewSubmission (integration)', () => {
  const pool = testPool(url ?? '');
  let admin: string;
  let user: string;

  beforeEach(async () => {
    await resetDatabase(pool);
    admin = await createUser(pool, { name: 'Admin', role: 'admin' });
    user = await createUser(pool, { name: 'Ambassador' });
  });
  afterAll(() => pool.end());

  const review = (submissionId: string, action: 'approve' | 'reject' | 'undo', note?: string) =>
    reviewSubmission(pool, { submissionId, action, actorId: admin, note: note ?? null });

  it('approves: awards the quest XP once, grants met ranks, queues Discord work', async () => {
    await createRole(pool, { name: 'Bronze', xpRequired: 0 });
    await createRole(pool, { name: 'Silver', xpRequired: 50 });
    await createRole(pool, { name: 'Gold', xpRequired: 500 });
    const submission = await createSubmission(pool, user, await createQuest(pool, { xp: 50 }));

    const result = await review(submission, 'approve', 'nice');

    expect(result).toMatchObject({ ok: true, status: 'approved', xpDelta: 50 });
    expect(await ledger(pool, submission)).toEqual([{ delta: 50, reason: 'approved' }]);
    expect(await xpTotal(pool, user)).toBe(50);
    expect(await heldRoles(pool, user)).toEqual({ Bronze: 'xp', Silver: 'xp' });
    expect(await jobs(pool)).toEqual([
      { kind: 'announce', event: 'quest_completed' },
      { kind: 'announce', event: 'role_unlocked' },
      { kind: 'announce', event: 'role_unlocked' },
      { kind: 'sync_member_roles', event: null },
    ]);

    const { rows } = await pool.query(
      'SELECT status, review_note, reviewed_by, reviewed_at FROM submissions WHERE id = $1',
      [submission],
    );
    expect(rows[0]).toMatchObject({ status: 'approved', review_note: 'nice', reviewed_by: admin });
    expect(rows[0].reviewed_at).toBeInstanceOf(Date);
  });

  it('rejects with a note and no XP', async () => {
    const submission = await createSubmission(pool, user, await createQuest(pool));

    expect(await review(submission, 'reject', 'link is private')).toMatchObject({
      ok: true,
      status: 'rejected',
      xpDelta: 0,
    });
    expect(await ledger(pool, submission)).toEqual([]);
    expect(await jobs(pool)).toEqual([]);
  });

  it('undo reverses the award, clears the review and revokes what it earned', async () => {
    const founder = await createRole(pool, { name: 'Founder' });
    await createRole(pool, { name: 'Silver', xpRequired: 50 });
    const quest = await createQuest(pool, { xp: 50, rewardRoleId: founder });
    const submission = await createSubmission(pool, user, quest);
    await review(submission, 'approve');
    expect(await heldRoles(pool, user)).toEqual({ Founder: 'quest', Silver: 'xp' });

    expect(await review(submission, 'undo')).toMatchObject({
      ok: true,
      status: 'pending',
      xpDelta: -50,
      roles: { grant: [], revoke: expect.arrayContaining([founder]) },
    });

    expect(await ledger(pool, submission)).toEqual([
      { delta: 50, reason: 'approved' },
      { delta: -50, reason: 'undone' },
    ]);
    expect(await xpTotal(pool, user)).toBe(0);
    expect(await heldRoles(pool, user)).toEqual({});
    const { rows } = await pool.query(
      'SELECT status, review_note, reviewed_by, reviewed_at FROM submissions WHERE id = $1',
      [submission],
    );
    expect(rows[0]).toEqual({
      status: 'pending',
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
    });
  });

  it('undo takes back what was awarded, even after the quest XP is edited', async () => {
    const quest = await createQuest(pool, { xp: 50 });
    const submission = await createSubmission(pool, user, quest);
    await review(submission, 'approve');
    await pool.query('UPDATE quests SET xp_reward = 80 WHERE id = $1', [quest]);

    expect(await review(submission, 'undo')).toMatchObject({ ok: true, xpDelta: -50 });
    expect(await xpTotal(pool, user)).toBe(0);

    // Approved again, it earns the quest's XP as it is now.
    expect(await review(submission, 'approve')).toMatchObject({ ok: true, xpDelta: 80 });
    expect(await ledger(pool, submission)).toEqual([
      { delta: 50, reason: 'approved' },
      { delta: -50, reason: 'undone' },
      { delta: 80, reason: 'approved' },
    ]);
    expect(await xpTotal(pool, user)).toBe(80);
  });

  it('undo of a rejection returns it to pending with no ledger entry', async () => {
    const submission = await createSubmission(pool, user, await createQuest(pool));
    await review(submission, 'reject');

    expect(await review(submission, 'undo')).toMatchObject({
      ok: true,
      status: 'pending',
      xpDelta: 0,
    });
    expect(await ledger(pool, submission)).toEqual([]);
  });

  it('leaves a hand-assigned role alone on undo', async () => {
    const silver = await createRole(pool, { name: 'Silver', xpRequired: 50 });
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id, source, assigned_by) VALUES ($1, $2, 'manual', $3)`,
      [user, silver, admin],
    );
    const submission = await createSubmission(pool, user, await createQuest(pool, { xp: 50 }));
    await review(submission, 'approve');
    await review(submission, 'undo');

    expect(await heldRoles(pool, user)).toEqual({ Silver: 'manual' });
  });

  it('refuses moves the state machine does not allow, changing nothing', async () => {
    const submission = await createSubmission(pool, user, await createQuest(pool));

    expect(await review(submission, 'undo')).toEqual({ ok: false, reason: 'not_reviewed' });
    await review(submission, 'approve');
    expect(await review(submission, 'approve')).toEqual({ ok: false, reason: 'not_pending' });
    expect(await review(submission, 'reject')).toEqual({ ok: false, reason: 'not_pending' });
    expect(await xpTotal(pool, user)).toBe(50);
  });

  it('answers not_found for a submission that does not exist', async () => {
    expect(await review('00000000-0000-0000-0000-000000000000', 'approve')).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });
});
