import { SNOWFLAKE } from '@community/shared';
import { z } from 'zod';

/**
 * The two things sign-in asks Discord (flow 1): who you are, and whether you are
 * in the POKT server. Both answers are validated here, at the boundary; nothing
 * past this file sees a raw Discord response.
 */

const API = 'https://discord.com/api/v10';
const CDN = 'https://cdn.discordapp.com';

/** Matches users.name: 1 to 100 characters. */
const MAX_NAME = 100;

const userSchema = z.object({
  id: z.string().regex(SNOWFLAKE),
  username: z.string().min(1),
  global_name: z.string().nullish(),
  avatar: z.string().nullish(),
});

export type DiscordProfile = { discordId: string; name: string; avatarUrl: string };

/**
 * The profile a hub user is created or refreshed from. Throws on a response that
 * is not a Discord user; sign-in fails rather than store something unchecked.
 */
export function discordProfile(raw: unknown): DiscordProfile {
  const user = userSchema.parse(raw);
  const display = user.global_name?.trim() || user.username.trim() || user.id;
  return {
    discordId: user.id,
    // By code point, as Postgres counts, so an emoji is never cut in half.
    name: Array.from(display).slice(0, MAX_NAME).join(''),
    avatarUrl: avatarUrl(user.id, user.avatar ?? null),
  };
}

/**
 * The user's avatar, or Discord's default for their id. The hash goes into a
 * URL, so anything that is not a Discord avatar hash falls back to the default.
 */
export function avatarUrl(discordId: string, avatar: string | null): string {
  if (avatar !== null && /^(a_)?[0-9a-f]{32}$/.test(avatar)) {
    return `${CDN}/avatars/${discordId}/${avatar}.${avatar.startsWith('a_') ? 'gif' : 'png'}`;
  }
  return `${CDN}/embed/avatars/${Number((BigInt(discordId) >> 22n) % 6n)}.png`;
}

export type Membership = 'member' | 'not_member' | 'unavailable';

const memberSchema = z.object({ joined_at: z.string() });

/**
 * Is the token's owner in `guildId`? Uses the `guilds.members.read` scope.
 *
 * Only a 404 means "not a member". Anything else that is not a valid member
 * (a timeout, a 5xx, a 429, a 401 from a missing scope, a body that does not
 * parse) is `unavailable`: sign-in is refused either way, but the person is told
 * to try again rather than to join a server they are already in.
 */
export async function guildMembership(
  accessToken: string,
  guildId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Membership> {
  let response: Response;
  try {
    response = await fetchImpl(`${API}/users/@me/guilds/${guildId}/member`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });
  } catch {
    return 'unavailable';
  }
  if (response.status === 404) return 'not_member';
  if (!response.ok) return 'unavailable';
  try {
    return memberSchema.safeParse(await response.json()).success ? 'member' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}
