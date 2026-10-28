/**
 * The Auth.js adapter, driven the way Auth.js drives it on a Discord sign-in:
 * look the account up, create the user, open a session, read it back, renew it,
 * sign out.
 */
import { createPool } from '@community/store';
import type { AdapterUser } from 'next-auth/adapters';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { type HubAdapterUser, hubAdapter } from './adapter';

const url = process.env['DATABASE_TEST_URL'] || undefined;
if (url === undefined && process.env['REQUIRE_DATABASE_TESTS'] === '1') {
  throw new Error('REQUIRE_DATABASE_TESTS=1 but DATABASE_TEST_URL is not set.');
}

const DISCORD_ID = '80351110224678912';
const DAY = 86_400_000;

describe.skipIf(url === undefined)('hubAdapter (integration)', () => {
  const pool = createPool({ connectionString: url ?? '', application_name: 'web-tests' });
  const adapter = hubAdapter(pool, { bootstrapIds: [DISCORD_ID] });

  beforeEach(async () => {
    await pool.query('DELETE FROM users');
  });
  afterAll(() => pool.end());

  /** What Auth.js passes createUser: our profile() output with a random `id`. */
  const fromProfile = {
    id: crypto.randomUUID(),
    discordId: DISCORD_ID,
    name: 'Nelly',
    email: null,
    image: 'https://cdn.discordapp.com/embed/avatars/1.png',
    emailVerified: null,
  } as unknown as AdapterUser;

  it('signs a new Discord user in, end to end', async () => {
    const account = { provider: 'discord', providerAccountId: DISCORD_ID };
    expect(await adapter.getUserByAccount!(account)).toBeNull();

    const user = (await adapter.createUser!(fromProfile)) as HubAdapterUser;
    expect(user.hub).toMatchObject({ discordId: DISCORD_ID, name: 'Nelly', role: 'admin' });
    expect(user.id).not.toBe(fromProfile.id);
    expect((await adapter.getUserByAccount!(account))?.id).toBe(user.id);
    await adapter.linkAccount!({
      ...account,
      type: 'oauth',
      userId: user.id,
      access_token: 'never-stored',
    });

    const expires = new Date(Date.now() + 30 * DAY);
    await adapter.createSession!({ sessionToken: 'cookie-token', userId: user.id, expires });
    const found = await adapter.getSessionAndUser!('cookie-token');
    expect(found?.session).toEqual({ sessionToken: 'cookie-token', userId: user.id, expires });
    expect((found?.user as HubAdapterUser).hub.role).toBe('admin');

    const renewed = new Date(Date.now() + 31 * DAY);
    await adapter.updateSession!({ sessionToken: 'cookie-token', expires: renewed });
    expect((await adapter.getSessionAndUser!('cookie-token'))?.session.expires).toEqual(renewed);

    await adapter.deleteSession!('cookie-token');
    expect(await adapter.getSessionAndUser!('cookie-token')).toBeNull();
  });

  it('stores no OAuth token anywhere', async () => {
    const user = await adapter.createUser!(fromProfile);
    await adapter.linkAccount!({
      provider: 'discord',
      providerAccountId: DISCORD_ID,
      type: 'oauth',
      userId: user.id,
      access_token: 'needle-access',
      refresh_token: 'needle-refresh',
    });
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('accounts', 'verification_token')`,
    );
    expect(rows).toEqual([]);
    const dump = await pool.query(`SELECT row_to_json(u)::text AS row FROM users u`);
    expect(JSON.stringify(dump.rows)).not.toMatch(/needle/);
  });

  it('refuses a createUser that did not come from the Discord profile', async () => {
    await expect(
      adapter.createUser!({ id: 'x', email: 'a@b.c', emailVerified: null } as AdapterUser),
    ).rejects.toThrow();
  });

  it('knows no other provider and no email lookups', async () => {
    await adapter.createUser!(fromProfile);
    expect(
      await adapter.getUserByAccount!({ provider: 'google', providerAccountId: DISCORD_ID }),
    ).toBeNull();
    expect(await adapter.getUserByEmail!('')).toBeNull();
  });
});
