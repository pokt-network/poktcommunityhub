/** XP totals and the leaderboard (flow 6), read from the ledger. */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createQuest,
  createSubmission,
  createUser,
  resetDatabase,
  testDatabaseUrl,
  testPool,
} from './testing.js';
import { leaderboard, leaderboardRank, xpTotal } from './xp.js';

const url = testDatabaseUrl();
const NOW = new Date('2026-10-28T12:00:00Z');
const LAST_MONTH = new Date('2026-09-20T12:00:00Z');

describe.skipIf(url === undefined)('XP totals and leaderboard (integration)', () => {
  const pool = testPool(url ?? '');

  beforeEach(() => resetDatabase(pool));
  afterAll(() => pool.end());

  /** An approved submission and its award, dated `at`. Returns the award's id. */
  async function award(userId: string, xp: number, at: Date): Promise<string> {
    const submission = await createSubmission(pool, userId, await createQuest(pool, { xp }));
    await pool.query(`UPDATE submissions SET status = 'approved', reviewed_at = $2 WHERE id = $1`, [
      submission,
      at,
    ]);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO xp_events (user_id, submission_id, delta, reason, at)
       VALUES ($1, $2, $3, 'approved', $4) RETURNING id`,
      [userId, submission, xp, at],
    );
    return rows[0]!.id;
  }

  async function undo(awardId: string, at: Date): Promise<void> {
    await pool.query(
      `INSERT INTO xp_events (user_id, submission_id, delta, reason, reverses, at)
       SELECT user_id, submission_id, -delta, 'undone', id, $2 FROM xp_events WHERE id = $1`,
      [awardId, at],
    );
  }

  it('ranks all-time totals with ties sharing a rank, and leaves out users with none', async () => {
    const ada = await createUser(pool, { name: 'Ada' });
    const bo = await createUser(pool, { name: 'Bo' });
    const cy = await createUser(pool, { name: 'Cy' });
    await createUser(pool, { name: 'Nobody' });
    await award(ada, 100, NOW);
    await award(bo, 100, LAST_MONTH);
    await award(cy, 40, NOW);

    const board = await leaderboard(pool, { period: 'all', now: NOW });

    expect(board.map(({ name, xp, rank }) => ({ name, xp, rank }))).toEqual([
      { name: 'Ada', xp: 100, rank: 1 },
      { name: 'Bo', xp: 100, rank: 1 },
      { name: 'Cy', xp: 40, rank: 3 },
    ]);
  });

  it('counts only this UTC month for the monthly board', async () => {
    const ada = await createUser(pool, { name: 'Ada' });
    const bo = await createUser(pool, { name: 'Bo' });
    await award(ada, 100, LAST_MONTH);
    await award(ada, 10, NOW);
    await award(bo, 30, NOW);

    const board = await leaderboard(pool, { period: 'month', now: NOW });

    expect(board.map(({ name, xp }) => ({ name, xp }))).toEqual([
      { name: 'Bo', xp: 30 },
      { name: 'Ada', xp: 10 },
    ]);
  });

  it("charges an undo to the award's month, not the month of the undo", async () => {
    const ada = await createUser(pool, { name: 'Ada' });
    const bo = await createUser(pool, { name: 'Bo' });
    const lastMonthsAward = await award(ada, 100, LAST_MONTH);
    await award(ada, 20, NOW);
    await award(bo, 5, NOW);
    await undo(lastMonthsAward, NOW);

    const thisMonth = await leaderboard(pool, { period: 'month', now: NOW });
    const lastMonth = await leaderboard(pool, { period: 'month', now: LAST_MONTH });

    // This month Ada keeps the 20 earned in it; the undo does not drive the total to -80.
    expect(thisMonth.map(({ name, xp }) => ({ name, xp }))).toEqual([
      { name: 'Ada', xp: 20 },
      { name: 'Bo', xp: 5 },
    ]);
    expect(lastMonth).toEqual([]);
    expect(await xpTotal(pool, ada)).toBe(20);
  });

  it("finds one user's rank, or null with no XP in the period", async () => {
    const ada = await createUser(pool, { name: 'Ada' });
    const bo = await createUser(pool, { name: 'Bo' });
    await award(ada, 100, NOW);
    await award(bo, 50, LAST_MONTH);

    expect(await leaderboardRank(pool, { userId: bo, period: 'all', now: NOW })).toMatchObject({
      xp: 50,
      rank: 2,
    });
    expect(await leaderboardRank(pool, { userId: bo, period: 'month', now: NOW })).toBeNull();
  });

  it('drops a deleted user from every board', async () => {
    const ada = await createUser(pool, { name: 'Ada' });
    await award(ada, 100, NOW);

    await pool.query('DELETE FROM users WHERE id = $1', [ada]);

    expect(await leaderboard(pool, { period: 'all', now: NOW })).toEqual([]);
  });
});
