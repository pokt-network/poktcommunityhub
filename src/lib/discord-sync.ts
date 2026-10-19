/**
 * Discord Role Synchronization Service
 * Coordinates database roles (server_roles / user_roles) with the Discord server.
 */

import {
  getUserDiscordId,
  getUserAssignedServerRoles,
  listServerRoles,
  listAllUsersWithDiscord,
  setServerRoleDiscordId,
  type ServerRole,
} from "@/lib/db";
import {
  addDiscordMemberRole,
  createDiscordGuildRole,
  getDiscordConfig,
  getDiscordGuildMember,
  getDiscordGuildRoles,
  removeDiscordMemberRole,
  type DiscordGuildRole,
} from "@/lib/discord";

export type UserSyncResult = {
  success: boolean;
  userId: string;
  discordId?: string;
  reason?: string;
  addedRoles?: string[];
  removedRoles?: string[];
};

export type BulkSyncResult = {
  success: boolean;
  totalUsers: number;
  syncedUsers: number;
  skippedNoDiscord: number;
  notInServer: number;
  errors: string[];
};

/**
 * Resolves the Discord snowflake ID for a server role:
 * 1. Checks explicit `discord_role_id` stored on the role.
 * 2. Falls back to matching by name (case-insensitive) against the guild's roles.
 */
export function resolveDiscordRoleId(
  role: Pick<ServerRole, "name" | "discord_role_id">,
  guildRoles: DiscordGuildRole[],
): string | null {
  if (role.discord_role_id && role.discord_role_id.trim()) {
    return role.discord_role_id.trim();
  }

  const normalized = role.name.trim().toLowerCase();
  const match = guildRoles.find(
    (gr) => gr.name.trim().toLowerCase() === normalized,
  );
  return match?.id ?? null;
}

/**
 * Synchronize all Community Hub roles for a specific user to their Discord account.
 * Grants any newly earned roles and revokes managed roles they no longer qualify for.
 */
export async function syncUserRolesToDiscord(
  userId: string,
): Promise<UserSyncResult> {
  const { isConfigured } = getDiscordConfig();
  if (!isConfigured) {
    return {
      success: false,
      userId,
      reason: "Discord Bot not configured (DISCORD_BOT_TOKEN / DISCORD_GUILD_ID missing)",
    };
  }

  const discordId = await getUserDiscordId(userId);
  if (!discordId) {
    return {
      success: false,
      userId,
      reason: "User has not connected a Discord account",
    };
  }

  // 1. Fetch current server roles in Discord
  const rolesRes = await getDiscordGuildRoles();
  if (!rolesRes.ok) {
    return {
      success: false,
      userId,
      discordId,
      reason: `Failed to fetch Discord server roles: ${rolesRes.error}`,
    };
  }
  const guildRoles = rolesRes.data;

  // 2. Fetch the user's membership in the Discord server
  const memberRes = await getDiscordGuildMember(discordId);
  if (!memberRes.ok) {
    return {
      success: false,
      userId,
      discordId,
      reason: `Failed to check member in Discord: ${memberRes.error}`,
    };
  }

  const member = memberRes.data;
  if (!member) {
    return {
      success: false,
      userId,
      discordId,
      reason: "User is not a member of the Discord server",
    };
  }

  // 3. Fetch all Hub roles and the ones assigned to this user
  const allHubRoles = await listServerRoles();
  const userAssigned = await getUserAssignedServerRoles(userId);
  const userAssignedIds = new Set(userAssigned.map((r) => r.id));

  // Map each Hub role to its Discord role ID (explicit or name match)
  const roleMappings: Array<{
    hubRole: ServerRole;
    discordRoleId: string;
    userShouldHave: boolean;
  }> = [];

  for (const hubRole of allHubRoles) {
    const discordRoleId = resolveDiscordRoleId(hubRole, guildRoles);
    if (discordRoleId) {
      roleMappings.push({
        hubRole,
        discordRoleId,
        userShouldHave: userAssignedIds.has(hubRole.id),
      });
    }
  }

  const currentDiscordRoles = new Set(member.roles);
  const added: string[] = [];
  const removed: string[] = [];

  // 4. Apply role additions & removals
  for (const { hubRole, discordRoleId, userShouldHave } of roleMappings) {
    const hasRoleInDiscord = currentDiscordRoles.has(discordRoleId);

    if (userShouldHave && !hasRoleInDiscord) {
      const res = await addDiscordMemberRole(
        discordId,
        discordRoleId,
        `Earned ${hubRole.name} on POKT Community Hub`,
      );
      if (res.ok) {
        added.push(hubRole.name);
      } else {
        console.warn(
          `[DiscordSync] Could not add role "${hubRole.name}" (${discordRoleId}) to user ${discordId}: ${res.error}`,
        );
      }
    } else if (!userShouldHave && hasRoleInDiscord) {
      const res = await removeDiscordMemberRole(
        discordId,
        discordRoleId,
        `Revoked ${hubRole.name} on POKT Community Hub`,
      );
      if (res.ok) {
        removed.push(hubRole.name);
      } else {
        console.warn(
          `[DiscordSync] Could not remove role "${hubRole.name}" (${discordRoleId}) from user ${discordId}: ${res.error}`,
        );
      }
    }
  }

  return {
    success: true,
    userId,
    discordId,
    addedRoles: added,
    removedRoles: removed,
  };
}

/**
 * Bulk synchronize all users who have connected Discord accounts to the Discord server.
 */
export async function syncAllUsersToDiscord(): Promise<BulkSyncResult> {
  const { isConfigured } = getDiscordConfig();
  if (!isConfigured) {
    return {
      success: false,
      totalUsers: 0,
      syncedUsers: 0,
      skippedNoDiscord: 0,
      notInServer: 0,
      errors: ["Discord bot is not configured."],
    };
  }

  const users = await listAllUsersWithDiscord();
  let synced = 0;
  let notInServer = 0;
  const errors: string[] = [];

  for (const user of users) {
    try {
      const res = await syncUserRolesToDiscord(user.id);
      if (res.success) {
        synced += 1;
      } else if (res.reason?.includes("not a member")) {
        notInServer += 1;
      } else if (res.reason) {
        errors.push(`${user.name}: ${res.reason}`);
      }
    } catch (err) {
      errors.push(
        `${user.name}: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  }

  return {
    success: errors.length === 0,
    totalUsers: users.length,
    syncedUsers: synced,
    skippedNoDiscord: 0,
    notInServer,
    errors,
  };
}

export type ProvisionResult = {
  ok: boolean;
  message: string;
  createdCount: number;
  linkedCount: number;
  errors?: string[];
};

/**
 * Ensures all Server Roles in the Community Hub exist in the Discord server.
 * 1. Checks if each role already exists in Discord (by explicit ID or case-insensitive name).
 * 2. If it exists in Discord, links its `discord_role_id` in the database.
 * 3. If it does not exist in Discord, creates it via the Discord REST API with matching name and color,
 *    and saves the new Discord role ID to the database.
 */
export async function provisionDiscordRoles(): Promise<ProvisionResult> {
  const { isConfigured } = getDiscordConfig();
  if (!isConfigured) {
    return {
      ok: false,
      message: "Discord Bot is not configured. Add DISCORD_BOT_TOKEN and DISCORD_GUILD_ID to .env.",
      createdCount: 0,
      linkedCount: 0,
    };
  }

  const rolesRes = await getDiscordGuildRoles();
  if (!rolesRes.ok) {
    return {
      ok: false,
      message: `Failed to fetch Discord server roles: ${rolesRes.error}`,
      createdCount: 0,
      linkedCount: 0,
    };
  }

  const guildRoles = [...rolesRes.data];
  const hubRoles = await listServerRoles();
  let createdCount = 0;
  let linkedCount = 0;
  const errors: string[] = [];

  for (const hubRole of hubRoles) {
    // Check if matching role already exists in Discord
    const existingDiscordId = resolveDiscordRoleId(hubRole, guildRoles);

    if (existingDiscordId) {
      // If found in Discord, make sure it is linked in the database
      if (hubRole.discord_role_id !== existingDiscordId) {
        await setServerRoleDiscordId(hubRole.id, existingDiscordId);
      }
      linkedCount++;
    } else {
      // Role does not exist in Discord, create it!
      const hexColor = hubRole.color.replace(/^#/, "");
      const colorInt = parseInt(hexColor, 16);
      const validColor = Number.isNaN(colorInt) ? 0 : colorInt;

      const createRes = await createDiscordGuildRole({
        name: hubRole.name,
        color: validColor,
        hoist: true,
        reason: "Provisioned by POKT Community Hub",
      });

      if (createRes.ok) {
        const newDiscordRole = createRes.data;
        await setServerRoleDiscordId(hubRole.id, newDiscordRole.id);
        guildRoles.push(newDiscordRole);
        createdCount++;
      } else {
        errors.push(
          `Failed to create role "${hubRole.name}": ${createRes.error}`,
        );
      }
    }
  }

  if (errors.length > 0 && createdCount === 0 && linkedCount === 0) {
    return {
      ok: false,
      message: `Failed to provision roles: ${errors.join("; ")}`,
      createdCount,
      linkedCount,
      errors,
    };
  }

  const parts: string[] = [];
  if (createdCount > 0) {
    parts.push(`Created ${createdCount} role${createdCount > 1 ? "s" : ""} in Discord`);
  }
  if (linkedCount > 0) {
    parts.push(`Linked ${linkedCount} existing role${linkedCount > 1 ? "s" : ""}`);
  }
  if (parts.length === 0) {
    parts.push("All roles already exist and are linked in Discord");
  }

  return {
    ok: errors.length === 0,
    message: parts.join(". ") + (errors.length > 0 ? ` (${errors.length} failed)` : "."),
    createdCount,
    linkedCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

