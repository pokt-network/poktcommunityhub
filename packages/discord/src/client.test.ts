import { describe, expect, it, vi } from 'vitest';

import { discordBot, DiscordError, executeWebhook, type Fetch } from './client.js';

const GUILD = '100000000000000000';
const USER = '111111111111111111';
const ROLE = '222222222222222222';
const WEBHOOK = `https://discord.com/api/webhooks/${USER}/${'t'.repeat(68)}`;

type Call = { url: string; init: RequestInit };

/** A fetch that answers from a script, one response per call, and records the calls. */
function scripted(...responses: Response[]) {
  const calls: Call[] = [];
  const fetch: Fetch = async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (next === undefined) throw new Error('no scripted response left');
    return next;
  };
  return { fetch, calls };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const sleep = vi.fn(async () => {});

describe('discordBot', () => {
  it('reads a member, and answers null for one not in the server', async () => {
    const { fetch, calls } = scripted(
      json(200, { roles: [ROLE], user: { id: USER } }),
      json(404, { code: 10007, message: 'Unknown Member' }),
    );
    const bot = discordBot({ token: 'tok', guildId: GUILD }, { fetch, sleep });
    expect(await bot.memberRoles(USER)).toEqual([ROLE]);
    expect(await bot.memberRoles(USER)).toBeNull();
    expect(calls[0]!.url).toBe(`https://discord.com/api/v10/guilds/${GUILD}/members/${USER}`);
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bot tok');
  });

  it('puts the reason in the audit log header', async () => {
    const { fetch, calls } = scripted(new Response(null, { status: 204 }));
    await discordBot({ token: 'tok', guildId: GUILD }, { fetch, sleep }).addRole(
      USER,
      ROLE,
      'Rank: Herald',
    );
    expect(calls[0]!.init.method).toBe('PUT');
    expect((calls[0]!.init.headers as Record<string, string>)['X-Audit-Log-Reason']).toBe(
      'Rank%3A%20Herald',
    );
  });

  it('waits out a short rate limit once, then retries', async () => {
    const { fetch, calls } = scripted(
      json(429, { retry_after: 1.2, global: false }),
      new Response(null, { status: 204 }),
    );
    await discordBot({ token: 't', guildId: GUILD }, { fetch, sleep }).removeRole(USER, ROLE, 'x');
    expect(calls).toHaveLength(2);
    expect(sleep).toHaveBeenCalledWith(1200);
  });

  it('throws a long rate limit with how long to wait', async () => {
    const { fetch } = scripted(json(429, { retry_after: 42 }));
    const error = await discordBot({ token: 't', guildId: GUILD }, { fetch, sleep })
      .addRole(USER, ROLE, 'x')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DiscordError);
    expect(error).toMatchObject({ status: 429, retryAfterMs: 42_000 });
  });

  it('carries the status and code of other errors', async () => {
    const { fetch } = scripted(json(403, { code: 50013, message: 'Missing Permissions' }));
    await expect(
      discordBot({ token: 't', guildId: GUILD }, { fetch, sleep }).addRole(USER, ROLE, 'x'),
    ).rejects.toMatchObject({ status: 403, code: 50013 });
  });

  it('turns a network failure into a transient error', async () => {
    const fetch: Fetch = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(
      discordBot({ token: 't', guildId: GUILD }, { fetch, sleep }).me(),
    ).rejects.toMatchObject({
      status: 0,
    });
  });

  it('refuses a response that is not what Discord sends', async () => {
    const { fetch } = scripted(json(200, [{ id: 'not-a-snowflake' }]));
    await expect(
      discordBot({ token: 't', guildId: GUILD }, { fetch, sleep }).roles(),
    ).rejects.toThrow();
  });

  it('creates a role with no permissions', async () => {
    const { fetch, calls } = scripted(json(200, { id: ROLE, name: 'Herald' }));
    const id = await discordBot({ token: 't', guildId: GUILD }, { fetch, sleep }).createRole(
      { name: 'Herald', color: 0x025af2 },
      'Rank created in the hub',
    );
    expect(id).toBe(ROLE);
    expect(JSON.parse(calls[0]!.init.body as string)).toMatchObject({
      permissions: '0',
      color: 0x025af2,
    });
  });
});

describe('executeWebhook', () => {
  it('posts with mentions switched off', async () => {
    const { fetch, calls } = scripted(json(200, { id: ROLE }));
    await executeWebhook(
      WEBHOOK,
      { content: 'hi @everyone', username: 'Hub', avatarUrl: null },
      { fetch, sleep },
    );
    expect(calls[0]!.url).toBe(`${WEBHOOK}?wait=true`);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      content: 'hi @everyone',
      username: 'Hub',
      allowed_mentions: { parse: [] },
    });
  });

  it('never posts anywhere but Discord', async () => {
    const { fetch, calls } = scripted();
    await expect(
      executeWebhook(
        'https://evil.example/hook',
        { content: 'x', username: 'Hub', avatarUrl: null },
        { fetch, sleep },
      ),
    ).rejects.toBeInstanceOf(DiscordError);
    expect(calls).toHaveLength(0);
  });
});
