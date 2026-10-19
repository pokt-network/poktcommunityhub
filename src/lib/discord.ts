/**
 * Discord REST API v10 Client
 * Manages guild member roles for ambassador achievement synchronization.
 */

const DISCORD_API_BASE = "https://discord.com/api/v10";

export type DiscordGuildRole = {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
};

export type DiscordGuildMember = {
  user: {
    id: string;
    username: string;
    discriminator?: string;
    global_name?: string | null;
  };
  nick?: string | null;
  roles: string[];
};

export type DiscordApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number; code?: number };

export function getDiscordConfig() {
  const token = process.env.DISCORD_BOT_TOKEN?.trim() || "";
  const guildId = process.env.DISCORD_GUILD_ID?.trim() || "";
  return {
    token,
    guildId,
    isConfigured: Boolean(token && guildId),
  };
}

async function discordFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<DiscordApiResult<T>> {
  const { token, isConfigured } = getDiscordConfig();

  if (!isConfigured) {
    return {
      ok: false,
      error: "Discord Bot is not configured (missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID)",
      status: 0,
    };
  }

  const url = `${DISCORD_API_BASE}${endpoint}`;
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bot ${token}`);
  headers.set("User-Agent", "POKTCommunityHub (https://pocket.network, 1.0)");
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      cache: "no-store",
    });

    if (res.status === 204) {
      return { ok: true, data: null as unknown as T, status: 204 };
    }

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message =
        (data && typeof data === "object" && "message" in data && typeof data.message === "string"
          ? data.message
          : null) ||
        `Discord API error (${res.status} ${res.statusText})`;

      const code =
        data && typeof data === "object" && "code" in data && typeof data.code === "number"
          ? data.code
          : undefined;

      return {
        ok: false,
        error: message,
        status: res.status,
        code,
      };
    }

    return { ok: true, data: data as T, status: res.status };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error contacting Discord API",
      status: 0,
    };
  }
}

/**
 * Fetch all roles in the configured Discord server.
 */
export async function getDiscordGuildRoles(): Promise<
  DiscordApiResult<DiscordGuildRole[]>
> {
  const { guildId } = getDiscordConfig();
  if (!guildId) {
    return { ok: false, error: "Missing DISCORD_GUILD_ID", status: 0 };
  }
  return discordFetch<DiscordGuildRole[]>(`/guilds/${guildId}/roles`);
}

/**
 * Fetch a member in the configured Discord server by their Discord User ID.
 * Returns null if the user is not in the server (404).
 */
export async function getDiscordGuildMember(
  discordUserId: string,
): Promise<DiscordApiResult<DiscordGuildMember | null>> {
  const { guildId } = getDiscordConfig();
  if (!guildId) {
    return { ok: false, error: "Missing DISCORD_GUILD_ID", status: 0 };
  }

  const res = await discordFetch<DiscordGuildMember>(
    `/guilds/${guildId}/members/${discordUserId}`,
  );

  if (!res.ok && res.status === 404) {
    return { ok: true, data: null, status: 404 };
  }

  return res;
}

/**
 * Add a role to a member in the configured Discord server.
 */
export async function addDiscordMemberRole(
  discordUserId: string,
  discordRoleId: string,
  reason = "POKT Community Hub Role Grant",
): Promise<DiscordApiResult<void>> {
  const { guildId } = getDiscordConfig();
  if (!guildId) {
    return { ok: false, error: "Missing DISCORD_GUILD_ID", status: 0 };
  }

  return discordFetch<void>(
    `/guilds/${guildId}/members/${discordUserId}/roles/${discordRoleId}`,
    {
      method: "PUT",
      headers: {
        "X-Audit-Log-Reason": reason,
      },
    },
  );
}

/**
 * Remove a role from a member in the configured Discord server.
 */
export async function removeDiscordMemberRole(
  discordUserId: string,
  discordRoleId: string,
  reason = "POKT Community Hub Role Revocation",
): Promise<DiscordApiResult<void>> {
  const { guildId } = getDiscordConfig();
  if (!guildId) {
    return { ok: false, error: "Missing DISCORD_GUILD_ID", status: 0 };
  }

  return discordFetch<void>(
    `/guilds/${guildId}/members/${discordUserId}/roles/${discordRoleId}`,
    {
      method: "DELETE",
      headers: {
        "X-Audit-Log-Reason": reason,
      },
    },
  );
}

export type CreateDiscordRoleInput = {
  name: string;
  color?: number;
  hoist?: boolean;
  mentionable?: boolean;
  reason?: string;
};

/**
 * Creates a new role in the configured Discord server.
 * Requires the bot to have MANAGE_ROLES permission.
 */
export async function createDiscordGuildRole(
  input: CreateDiscordRoleInput,
): Promise<DiscordApiResult<DiscordGuildRole>> {
  const { guildId } = getDiscordConfig();
  if (!guildId) {
    return { ok: false, error: "Missing DISCORD_GUILD_ID", status: 0 };
  }

  return discordFetch<DiscordGuildRole>(`/guilds/${guildId}/roles`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      color: input.color,
      hoist: input.hoist ?? true,
      mentionable: input.mentionable ?? false,
    }),
    headers: input.reason ? { "X-Audit-Log-Reason": input.reason } : undefined,
  });
}

