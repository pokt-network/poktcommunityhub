import { isWebhookUrl, type GuildRole } from '@community/core';
import { SNOWFLAKE } from '@community/shared';
import { z } from 'zod';

/**
 * The Discord REST calls the worker and the console make (flow 13): the bot's
 * view of the POKT server, member roles, role creation, and the announcements
 * webhook. Every response is validated here; nothing past this file sees a raw
 * Discord body.
 *
 * Rate limits: a 429 of up to five seconds is waited out once, here. A longer
 * one, or a second, is thrown as a DiscordError carrying `retryAfterMs`, and the
 * worker reschedules the job for exactly then (brief section 14.3). A response
 * that empties its bucket is followed by a short wait, so a run of calls on one
 * route stays under the limit instead of bouncing off it.
 */

const API = 'https://discord.com/api/v10';
const MAX_INLINE_WAIT_MS = 5_000;

/** Discord's JSON error codes the hub acts on. */
export const DISCORD_CODES = {
  unknownMember: 10007,
  unknownRole: 10011,
  unknownUser: 10013,
  unknownWebhook: 10015,
} as const;

export class DiscordError extends Error {
  readonly status: number;
  readonly code: number | null;
  readonly retryAfterMs: number | null;

  constructor(
    status: number,
    message: string,
    code: number | null = null,
    retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = 'DiscordError';
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

export type Fetch = (input: string, init: RequestInit) => Promise<Response>;

export type ClientOptions = {
  fetch?: Fetch;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const snowflake = z.string().regex(SNOWFLAKE);
const errorBody = z.object({ code: z.number().optional(), message: z.string().optional() });
const rateBody = z.object({ retry_after: z.number().nonnegative() });

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** One request, with the rate-limit handling described above. 204 answers null. */
async function request(
  url: string,
  init: RequestInit,
  { fetch: doFetch = fetch, timeoutMs = 10_000, sleep = defaultSleep }: ClientOptions,
): Promise<unknown> {
  for (let attempt = 0; ; attempt += 1) {
    let res: Response;
    try {
      res = await doFetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      // A timeout or a network failure: transient, retried with backoff.
      throw new DiscordError(0, 'Discord did not answer');
    }

    if (res.status === 429) {
      const body = rateBody.safeParse(await readJson(res));
      const header = Number(res.headers.get('retry-after'));
      const seconds = body.success ? body.data.retry_after : Number.isFinite(header) ? header : 5;
      const retryAfterMs = Math.ceil(seconds * 1000);
      if (attempt === 0 && retryAfterMs <= MAX_INLINE_WAIT_MS) {
        await sleep(retryAfterMs);
        continue;
      }
      throw new DiscordError(429, 'Discord rate limit', null, retryAfterMs);
    }

    if (res.headers.get('x-ratelimit-remaining') === '0') {
      const resetMs = Number(res.headers.get('x-ratelimit-reset-after')) * 1000;
      if (Number.isFinite(resetMs) && resetMs > 0)
        await sleep(Math.min(resetMs, MAX_INLINE_WAIT_MS));
    }

    if (res.status === 204) return null;
    const json = await readJson(res);
    if (!res.ok) {
      const parsed = errorBody.safeParse(json);
      const code = parsed.success ? (parsed.data.code ?? null) : null;
      const message = parsed.success && parsed.data.message ? parsed.data.message : res.statusText;
      throw new DiscordError(res.status, `Discord answered ${res.status}: ${message}`, code);
    }
    return json;
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const botUser = z.object({ id: snowflake, username: z.string() });
const member = z.object({ roles: z.array(snowflake) });
const guildRole = z.object({
  id: snowflake,
  name: z.string(),
  position: z.number().int(),
  permissions: z.string(),
  managed: z.boolean().optional(),
});
const createdRole = z.object({ id: snowflake });

export type DiscordBot = ReturnType<typeof discordBot>;

/** The bot, acting in one server. */
export function discordBot(
  config: { token: string; guildId: string },
  options: ClientOptions = {},
) {
  const guild = `${API}/guilds/${config.guildId}`;
  const call = (method: string, url: string, body?: unknown, reason?: string) => {
    const headers: Record<string, string> = { Authorization: `Bot ${config.token}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    // Shown in the server's audit log, so moderators can see why a role moved.
    if (reason !== undefined) headers['X-Audit-Log-Reason'] = encodeURIComponent(reason);
    return request(
      url,
      { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
      options,
    );
  };

  return {
    guildId: config.guildId,

    /** The bot's own user; a 401 here means the token is wrong. */
    async me() {
      return botUser.parse(await call('GET', `${API}/users/@me`));
    },

    /** A member's role ids, or null if they are not in the server. */
    async memberRoles(userId: string): Promise<string[] | null> {
      try {
        return member.parse(await call('GET', `${guild}/members/${userId}`)).roles;
      } catch (error) {
        if (
          error instanceof DiscordError &&
          error.status === 404 &&
          (error.code === DISCORD_CODES.unknownMember || error.code === DISCORD_CODES.unknownUser)
        ) {
          return null;
        }
        throw error;
      }
    },

    async addRole(userId: string, roleId: string, reason: string) {
      await call('PUT', `${guild}/members/${userId}/roles/${roleId}`, undefined, reason);
    },

    async removeRole(userId: string, roleId: string, reason: string) {
      await call('DELETE', `${guild}/members/${userId}/roles/${roleId}`, undefined, reason);
    },

    /** Every role in the server, @everyone included. */
    async roles(): Promise<GuildRole[]> {
      return z
        .array(guildRole)
        .parse(await call('GET', `${guild}/roles`))
        .map(({ id, name, position, permissions }) => ({ id, name, position, permissions }));
    },

    /** A role with no permissions, below the bot's, for a rank to link to. */
    async createRole(input: { name: string; color: number }, reason: string) {
      const body = {
        name: input.name,
        color: input.color,
        permissions: '0',
        hoist: false,
        mentionable: false,
      };
      return createdRole.parse(await call('POST', `${guild}/roles`, body, reason)).id;
    },
  };
}

/**
 * Post an announcement. Mentions are switched off whatever the text says, so a
 * member's name can never ping the server.
 */
export async function executeWebhook(
  url: string,
  message: { content: string; username: string; avatarUrl: string | null },
  options: ClientOptions = {},
): Promise<void> {
  if (!isWebhookUrl(url)) throw new DiscordError(0, 'not a Discord webhook URL');
  await request(
    `${url}?wait=true`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: message.content,
        username: message.username,
        ...(message.avatarUrl === null ? {} : { avatar_url: message.avatarUrl }),
        allowed_mentions: { parse: [] },
      }),
    },
    options,
  );
}
