/**
 * Attacks on sign-in state: races on the admin bootstrap, and sessions that
 * outlive the authority they were issued under.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createDiscordUser, createSession, sessionUser } from './auth.js';
import {
  createUser,
  resetDatabase,
  snowflake,
  testDatabaseUrl,
  testPool,
  whileLocked,
} from './testing.js';

const url = testDatabaseUrl();
const DAY = 24 * 60 * 60 * 1000;
const fromNow = (ms: number) => new Date(Date.now() + ms);
const CREATE_LOCK = {
  sql: `SELECT pg_advisory_xact_lock(hashtext('community.users.create'))`,
  params: [],
};

describe.skipIf(url === undefined)('sign-in adversarial (integration)', () => {
  const pool = testPool(url ?? '');

  beforeEach(() => resetDatabase(pool));
  afterAll(() => pool.end());

  it('makes exactly one owner when several listed ids sign in at once', async () => {
    const ids = Array.from({ length: 5 }, snowflake);

    const created = await whileLocked(pool, CREATE_LOCK, () =>
      ids.map((discordId) =>
        createDiscordUser(pool, { discordId, name: 'Racer', avatarUrl: null, bootstrapIds: ids }),
      ),
    );

    expect(created.filter((user) => user.role === 'owner')).toHaveLength(1);
    const { rows } = await pool.query(`SELECT 1 FROM users WHERE role IN ('admin', 'owner')`);
    expect(rows).toHaveLength(1);
  });

  it('creates one row when the same first sign-in arrives twice', async () => {
    const discordId = snowflake();

    const created = await whileLocked(pool, CREATE_LOCK, () =>
      [1, 2].map(() =>
        createDiscordUser(pool, { discordId, name: 'Twice', avatarUrl: null, bootstrapIds: [] }),
      ),
    );

    expect(created[0]).toEqual(created[1]);
    const { rows } = await pool.query('SELECT 1 FROM users WHERE discord_id = $1', [discordId]);
    expect(rows).toHaveLength(1);
  });

  it('sees a demotion on the very next lookup of an existing session', async () => {
    const admin = await createUser(pool, { role: 'admin' });
    await createSession(pool, { token: 'adm', userId: admin, expires: fromNow(DAY) });
    expect((await sessionUser(pool, 'adm'))?.user.role).toBe('admin');

    await pool.query(`UPDATE users SET role = 'ambassador' WHERE id = $1`, [admin]);

    expect((await sessionUser(pool, 'adm'))?.user.role).toBe('ambassador');
  });

  it('ends every session of a deleted user', async () => {
    const user = await createUser(pool);
    await createSession(pool, { token: 's1', userId: user, expires: fromNow(DAY) });
    await createSession(pool, { token: 's2', userId: user, expires: fromNow(DAY) });

    await pool.query('DELETE FROM users WHERE id = $1', [user]);

    expect(await sessionUser(pool, 's1')).toBeNull();
    expect(await sessionUser(pool, 's2')).toBeNull();
    const { rows } = await pool.query('SELECT 1 FROM sessions');
    expect(rows).toHaveLength(0);
  });

  it('does not accept the stored hash as a token', async () => {
    const user = await createUser(pool);
    await createSession(pool, { token: 'secret', userId: user, expires: fromNow(DAY) });
    const { rows } = await pool.query<{ token_hash: string }>('SELECT token_hash FROM sessions');

    expect(await sessionUser(pool, rows[0]!.token_hash)).toBeNull();
  });
});
