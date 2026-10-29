/**
 * Fixtures for the integration suites. Not exported from the package and not
 * compiled into dist (tsconfig.json excludes it).
 *
 * The suites run against DATABASE_TEST_URL, a migrated database whose contents
 * they own: every suite empties it before each test.
 */
import { randomInt } from 'node:crypto';

import { createPool, type Pool } from './pool.js';

/**
 * The test database, or undefined to skip. CI sets REQUIRE_DATABASE_TESTS=1 in
 * the job that runs them, so a missing URL there is a failure, not a quiet skip
 * that leaves the job green having tested nothing.
 */
export function testDatabaseUrl(): string | undefined {
  const url = process.env['DATABASE_TEST_URL'];
  if (url !== undefined && url !== '') return url;
  if (process.env['REQUIRE_DATABASE_TESTS'] === '1') {
    throw new Error('REQUIRE_DATABASE_TESTS=1 but DATABASE_TEST_URL is not set.');
  }
  return undefined;
}

export function testPool(url: string): Pool {
  return createPool({ connectionString: url, max: 20, application_name: 'store-tests' });
}

/** Empty every table. Users go first: that is the one way xp_events rows may leave. */
export async function resetDatabase(pool: Pool): Promise<void> {
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM quests');
  await pool.query('DELETE FROM server_roles');
  await pool.query('DELETE FROM quest_categories');
  await pool.query('DELETE FROM discord_jobs');
  await pool.query('DELETE FROM app_settings');
}

export const snowflake = () => `${randomInt(1e8, 1e9)}${randomInt(1e8, 1e9)}`;

export async function createUser(
  pool: Pool,
  fields: { name?: string; role?: 'ambassador' | 'admin' | 'owner' } = {},
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    'INSERT INTO users (discord_id, name, role) VALUES ($1, $2, $3) RETURNING id',
    [snowflake(), fields.name ?? 'Tester', fields.role ?? 'ambassador'],
  );
  return rows[0]!.id;
}

export async function createQuest(
  pool: Pool,
  fields: {
    xp?: number;
    status?: 'active' | 'closed';
    linkCount?: number;
    startsAt?: Date | null;
    endsAt?: Date | null;
    rewardRoleId?: string | null;
  } = {},
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO quests (title, xp_reward, status, link_count, starts_at, ends_at, reward_role_id)
     VALUES ('Quest', $1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      fields.xp ?? 50,
      fields.status ?? 'active',
      fields.linkCount ?? 1,
      fields.startsAt ?? null,
      fields.endsAt ?? null,
      fields.rewardRoleId ?? null,
    ],
  );
  return rows[0]!.id;
}

export async function createRole(
  pool: Pool,
  fields: { name: string; xpRequired?: number | null },
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    'INSERT INTO server_roles (name, xp_required) VALUES ($1, $2) RETURNING id',
    [fields.name, fields.xpRequired ?? null],
  );
  return rows[0]!.id;
}

/** A pending submission, inserted directly (submitProof has its own suite). */
export async function createSubmission(
  pool: Pool,
  userId: string,
  questId: string,
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO submissions (user_id, quest_id, proof_urls)
     VALUES ($1, $2, '{https://example.org/proof}') RETURNING id`,
    [userId, questId],
  );
  return rows[0]!.id;
}

export async function heldRoles(pool: Pool, userId: string): Promise<Record<string, string>> {
  const { rows } = await pool.query<{ name: string; source: string }>(
    `SELECT r.name, ur.source FROM user_roles ur JOIN server_roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1 ORDER BY r.name`,
    [userId],
  );
  return Object.fromEntries(rows.map((row) => [row.name, row.source]));
}

export async function ledger(
  pool: Pool,
  submissionId: string,
): Promise<{ delta: number; reason: string }[]> {
  const { rows } = await pool.query<{ delta: number; reason: string }>(
    'SELECT delta, reason FROM xp_events WHERE submission_id = $1 ORDER BY id',
    [submissionId],
  );
  return rows;
}

export async function jobs(pool: Pool): Promise<{ kind: string; event: string | null }[]> {
  const { rows } = await pool.query<{ kind: string; event: string | null }>(
    `SELECT kind, payload->>'event' AS event FROM discord_jobs ORDER BY id`,
  );
  return rows;
}

/**
 * Make concurrent requests genuinely overlap.
 *
 * Firing requests "at once" from one process does not guarantee they interleave:
 * a fast transaction can commit before the next one starts, and a test of a race
 * then passes with the race guard removed. So a separate connection takes a row
 * lock every request needs, holds it until every one of them is blocked on it,
 * then lets them all go together.
 */
export async function whileLocked<T>(
  pool: Pool,
  lock: { sql: string; params: unknown[] },
  requests: () => Promise<T>[],
): Promise<T[]> {
  const blocker = await pool.connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query(lock.sql, lock.params);
    // Started exactly once, after the lock is held.
    const started = requests();
    const pending = Promise.all(started);
    pending.catch(() => {}); // surfaced by the await below, not as unhandled
    // Polled through the pool, not the blocker: inside a transaction Postgres
    // keeps returning the same pg_stat_activity snapshot, which never changes.
    await waitForLockWaiters(pool, started.length);
    await blocker.query('ROLLBACK');
    return await pending;
  } finally {
    blocker.release();
  }
}

async function waitForLockWaiters(pool: Pool, waiters: number): Promise<void> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    const blocked = rows[0]?.n ?? 0;
    if (blocked >= waiters) return;
    if (Date.now() > deadline) {
      throw new Error(`only ${blocked} of ${waiters} requests reached the lock`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
