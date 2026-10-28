import { describe, expect, it, vi } from 'vitest';

import { avatarUrl, discordProfile, guildMembership } from './discord';

const ID = '80351110224678912';
const HASH = '8342729096ea3675442027381ff50dfe';

describe('discordProfile', () => {
  it('prefers the display name and builds the avatar URL', () => {
    expect(
      discordProfile({ id: ID, username: 'nelly', global_name: 'Nelly', avatar: HASH }),
    ).toEqual({
      discordId: ID,
      name: 'Nelly',
      avatarUrl: `https://cdn.discordapp.com/avatars/${ID}/${HASH}.png`,
    });
  });

  it('falls back to the username when there is no display name', () => {
    expect(
      discordProfile({ id: ID, username: 'nelly', global_name: null, avatar: null }).name,
    ).toBe('nelly');
    expect(discordProfile({ id: ID, username: 'nelly', global_name: '  ' }).name).toBe('nelly');
  });

  it('cuts a long name to 100 code points without splitting a character', () => {
    const name = discordProfile({ id: ID, username: 'x', global_name: '🦊'.repeat(150) }).name;
    expect(Array.from(name)).toHaveLength(100);
    expect(name).toBe('🦊'.repeat(100));
  });

  it('refuses a response that is not a Discord user', () => {
    expect(() => discordProfile({ id: 'not-an-id', username: 'x' })).toThrow();
    expect(() => discordProfile({ id: ID })).toThrow();
    expect(() => discordProfile(null)).toThrow();
  });
});

describe('avatarUrl', () => {
  it('serves animated avatars as gif', () => {
    expect(avatarUrl(ID, `a_${HASH}`)).toBe(
      `https://cdn.discordapp.com/avatars/${ID}/a_${HASH}.gif`,
    );
  });

  it("uses Discord's default avatar for no hash or anything that is not one", () => {
    const fallback = 'https://cdn.discordapp.com/embed/avatars/';
    expect(avatarUrl(ID, null)).toMatch(new RegExp(`^${fallback}[0-5]\\.png$`));
    expect(avatarUrl(ID, '../../evil')).toMatch(new RegExp(`^${fallback}[0-5]\\.png$`));
  });
});

describe('guildMembership', () => {
  const GUILD = '553741558869131266';
  const answer = (status: number, body: unknown = {}) =>
    vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }));

  it('is a member on a valid member object, asking with the bearer token', async () => {
    const fetchImpl = answer(200, { joined_at: '2024-01-01T00:00:00Z', roles: [] });
    expect(await guildMembership('tok', GUILD, fetchImpl)).toBe('member');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(`https://discord.com/api/v10/users/@me/guilds/${GUILD}/member`);
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer tok');
  });

  it('is not a member only on a 404', async () => {
    expect(await guildMembership('tok', GUILD, answer(404, { code: 10004 }))).toBe('not_member');
  });

  it('is unavailable on any other failure', async () => {
    for (const status of [401, 403, 429, 500, 502]) {
      expect(await guildMembership('tok', GUILD, answer(status))).toBe('unavailable');
    }
    expect(await guildMembership('tok', GUILD, answer(200, { nope: true }))).toBe('unavailable');
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));
    expect(await guildMembership('tok', GUILD, offline)).toBe('unavailable');
  });
});
