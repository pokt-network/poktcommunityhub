/** Sign-in users, the admin bootstrap and database sessions (phase 3). */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createDiscordUser,
  createSession,
  deleteExpiredSessions,
  deleteSession,
  extendSession,
  findUserByDiscordId,
  hashSessionToken,
  recordSignIn,
  sessionUser,
} from './auth.js';
import { createUser, resetDatabase, snowflake, testDatabaseUrl, testPool } from './testing.js';

const url = testDatabaseUrl();
const DAY = 24 * 60 * 60 * 1000;
const fromNow = (ms: number) => new Date(Date.now() + ms);

describe.skipIf(url === undefined)('sign-in users and sessions (integration)', () => {
  const pool = testPool(url ?? '');

  beforeEach(() => resetDatabase(pool));
  afterAll(() => pool.end());

  const newUser = (discordId: string, bootstrapIds: string[] = []) =>
    createDiscordUser(pool, { discordId, name: 'Ada', avatarUrl: null, bootstrapIds });

  describe('owner bootstrap', () => {
    it('makes the first listed user the owner', async () => {
      const id = snowflake();
      expect((await newUser(id, [id])).role).toBe('owner');
    });

    it('does nothing once anyone is staff', async () => {
      for (const role of ['admin', 'owner'] as const) {
        await resetDatabase(pool);
        await createUser(pool, { role });
        const id = snowflake();
        expect((await newUser(id, [id])).role).toBe('ambassador');
      }
    });

    it('never promotes an existing user, even with no admins', async () => {
      const id = snowflake();
      const first = await newUser(id);
      const again = await newUser(id, [id]);
      expect(again).toEqual(first);
      expect(again.role).toBe('ambassador');
    });

    it('applies again once nobody is staff (an owner removed on the host)', async () => {
      const owner = await createUser(pool, { role: 'owner' });
      await pool.query(`UPDATE users SET role = 'ambassador' WHERE id = $1`, [owner]);
      const id = snowflake();
      expect((await newUser(id, [id])).role).toBe('owner');
    });
  });

  it('refreshes the name and avatar on sign-in, never the role', async () => {
    const id = snowflake();
    const user = await newUser(id, [id]);
    await recordSignIn(pool, user.id, { name: 'Ada L.', avatarUrl: 'https://cdn.example/a.png' });
    expect(await findUserByDiscordId(pool, id)).toMatchObject({
      name: 'Ada L.',
      avatarUrl: 'https://cdn.example/a.png',
      role: 'owner',
    });
  });

  describe('sessions', () => {
    it('round-trips a session to its user', async () => {
      const user = await newUser(snowflake());
      const expires = fromNow(30 * DAY);
      await createSession(pool, { token: 'tok-1', userId: user.id, expires });

      const found = await sessionUser(pool, 'tok-1');
      expect(found?.user).toEqual(user);
      expect(found?.expires.getTime()).toBe(expires.getTime());
    });

    it('stores only the hash of the token', async () => {
      const user = await newUser(snowflake());
      await createSession(pool, { token: 'tok-raw', userId: user.id, expires: fromNow(DAY) });

      const { rows } = await pool.query<{ token_hash: string }>('SELECT token_hash FROM sessions');
      expect(rows).toEqual([{ token_hash: hashSessionToken('tok-raw') }]);
      expect(JSON.stringify(rows)).not.toContain('tok-raw');
    });

    it('does not return an expired session', async () => {
      const user = await newUser(snowflake());
      await createSession(pool, { token: 'old', userId: user.id, expires: fromNow(-1) });
      expect(await sessionUser(pool, 'old')).toBeNull();
    });

    it('extends, deletes and sweeps', async () => {
      const user = await newUser(snowflake());
      await createSession(pool, { token: 'a', userId: user.id, expires: fromNow(DAY) });
      await createSession(pool, { token: 'b', userId: user.id, expires: fromNow(-DAY) });

      const later = fromNow(30 * DAY);
      expect(await extendSession(pool, 'a', later)).toBe(true);
      expect((await sessionUser(pool, 'a'))?.expires.getTime()).toBe(later.getTime());
      expect(await extendSession(pool, 'missing', later)).toBe(false);

      expect(await deleteExpiredSessions(pool)).toBe(1);
      await deleteSession(pool, 'a');
      expect(await sessionUser(pool, 'a')).toBeNull();
    });
  });
});
