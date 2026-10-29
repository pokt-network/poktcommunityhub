import 'server-only';

import { botReadiness, type BotReadiness, type GuildRole } from '@community/core';
import { discordBot, DiscordError, type DiscordBot } from '@community/discord';

import { webConfig } from './config';

/** The bot, acting in the POKT server, for the console's Discord page (flow 13). */
export function bot(): DiscordBot {
  const config = webConfig();
  return discordBot({ token: config.DISCORD_BOT_TOKEN, guildId: config.DISCORD_GUILD_ID });
}

export type BotStatus =
  | { ok: false; problem: string }
  | { ok: true; botName: string; readiness: BotReadiness; roles: GuildRole[] };

/** What an admin needs to hear about a Discord failure, without its internals. */
export function describeDiscordError(error: unknown): string {
  if (!(error instanceof DiscordError)) return 'Discord sent something unexpected. Try again.';
  if (error.status === 0) return 'Discord did not answer. Try again in a minute.';
  if (error.status === 401) return 'Discord refused the bot token. Check DISCORD_BOT_TOKEN.';
  if (error.status === 403) {
    return 'The bot is missing a permission (Manage Roles), or the role is above its own.';
  }
  if (error.status === 429) return 'Discord asked the hub to slow down. Try again shortly.';
  return `Discord refused: ${error.message}`;
}

/**
 * Bot status (brief section 14.7): a REST check, run when the page loads. The
 * token works, the bot is in the server, it may manage roles, and every linked
 * role is below its own.
 */
export async function botStatus(linkedRoleIds: readonly string[]): Promise<BotStatus> {
  const client = bot();
  try {
    const me = await client.me();
    const own = await client.memberRoles(me.id);
    if (own === null) {
      return { ok: false, problem: `${me.username} is not in the server. Invite it first.` };
    }
    const roles = await client.roles();
    return {
      ok: true,
      botName: me.username,
      readiness: botReadiness({
        guildId: client.guildId,
        botRoleIds: own,
        guildRoles: roles,
        linkedRoleIds,
      }),
      roles,
    };
  } catch (error) {
    return { ok: false, problem: describeDiscordError(error) };
  }
}
