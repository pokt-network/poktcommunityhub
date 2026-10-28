/** Submission rate limits (brief section 12, item 4) against real Postgres. */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { takeSubmissionAttempt } from './limits.js';
import { createUser, resetDatabase, testDatabaseUrl, testPool, whileLocked } from './testing.js';

const url = testDatabaseUrl();
const NOW = new Date('2026-10-28T12:00:00Z');
const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1_000);

describe.skipIf(url === undefined)('takeSubmissionAttempt (integration)', () => {
  const pool = testPool(url ?? '');
  let user: string;

  beforeEach(async () => {
    await resetDatabase(pool);
    user = await createUser(pool);
  });
  afterAll(() => pool.end());

  const take = (withFile: boolean, now: Date, userId = user) =>
    takeSubmissionAttempt(pool, { userId, withFile, now });

  it('allows three screenshot submissions a minute, five seconds apart', async () => {
    expect(await take(true, at(0))).toEqual({ allowed: true });
    expect(await take(true, at(2))).toEqual({ allowed: false, retryAfterMs: 3_000 });
    expect(await take(true, at(5))).toEqual({ allowed: true });
    expect(await take(true, at(10))).toEqual({ allowed: true });
    expect(await take(true, at(15))).toEqual({ allowed: false, retryAfterMs: 45_000 });
    expect(await take(true, at(60))).toEqual({ allowed: true });
  });

  it('records only allowed attempts, so hammering does not extend the wait', async () => {
    await take(true, at(0));
    for (const s of [1, 2, 3, 4]) expect((await take(true, at(s))).allowed).toBe(false);
    expect(await take(true, at(5))).toEqual({ allowed: true });
  });

  it('keeps separate counts for screenshots and links only, and per user', async () => {
    const other = await createUser(pool);
    expect(await take(true, at(0))).toEqual({ allowed: true });
    expect(await take(false, at(1))).toEqual({ allowed: true });
    expect(await take(true, at(1), other)).toEqual({ allowed: true });
  });

  it('survives across connections: the limit is in the database, not the process', async () => {
    await take(false, at(0));
    const fresh = testPool(url ?? '');
    try {
      const again = await takeSubmissionAttempt(fresh, {
        userId: user,
        withFile: false,
        now: at(1),
      });
      expect(again.allowed).toBe(false);
    } finally {
      await fresh.end();
    }
  });

  it('sweeps attempts older than an hour', async () => {
    await take(false, at(0));
    await take(false, at(7_200));
    const { rows } = await pool.query('SELECT at FROM submission_attempts WHERE user_id = $1', [
      user,
    ]);
    expect(rows).toHaveLength(1);
  });

  it('lets exactly one of a burst through when they arrive at once', async () => {
    // Every request takes the user's advisory lock first; hold it until all are waiting.
    const results = await whileLocked(
      pool,
      { sql: 'SELECT pg_advisory_xact_lock(hashtext($1))', params: [`community.submit:${user}`] },
      () => Array.from({ length: 6 }, () => take(true, at(0))),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(1);
  });
});
