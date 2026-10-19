"use server";

import { revalidatePath } from "next/cache";
import {
  createServerRole,
  updateServerRole,
  deleteServerRole,
  assignRoleToUser,
  removeRoleFromUser,
} from "@/lib/db";
import {
  syncUserRolesToDiscord,
  syncAllUsersToDiscord,
  provisionDiscordRoles,
} from "@/lib/discord-sync";
import { getDiscordConfig, getDiscordGuildRoles } from "@/lib/discord";
import { getSession } from "@/lib/session";

export type RoleActionState = {
  ok: boolean;
  error?: string;
};

async function requireAdminSession() {
  const session = await getSession();
  if (!session) {
    return { error: "Please sign in again." as const };
  }
  if (session.user.role !== "admin") {
    return { error: "Admin access required." as const };
  }
  return { session };
}

export async function createServerRoleAction(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }

    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const xpRaw = String(formData.get("xpRequired") ?? "0").trim();
    const color = String(formData.get("color") ?? "#3b82f6").trim();
    const xpRequired = Number.parseInt(xpRaw, 10);

    const questId = String(formData.get("questId") ?? "").trim() || null;
    const discordRoleId = String(formData.get("discordRoleId") ?? "").trim() || null;

    if (!name) {
      return { ok: false, error: "Role name is required." };
    }
    if (!Number.isFinite(xpRequired) || xpRequired < 0) {
      return { ok: false, error: "Required XP must be 0 or greater." };
    }

    await createServerRole({
      name,
      description,
      xpRequired,
      color: color.startsWith("#") ? color : `#${color}`,
      questId,
      discordRoleId,
    });

    revalidatePath("/admin/roles");
    revalidatePath("/admin/quests");
    revalidatePath("/admin/review");
    revalidatePath("/quests");
    revalidatePath("/admin/users");
    revalidatePath("/leaderboard");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create role.";
    if (/unique|already exists/i.test(message)) {
      return { ok: false, error: "A role with this name already exists." };
    }
    return { ok: false, error: message };
  }
}

export async function updateServerRoleAction(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }

    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const xpRaw = String(formData.get("xpRequired") ?? "0").trim();
    const color = String(formData.get("color") ?? "#3b82f6").trim();
    const questId = String(formData.get("questId") ?? "").trim() || null;
    const discordRoleId = String(formData.get("discordRoleId") ?? "").trim() || null;
    const xpRequired = Number.parseInt(xpRaw, 10);

    if (!id) {
      return { ok: false, error: "Missing role ID." };
    }
    if (!name) {
      return { ok: false, error: "Role name is required." };
    }
    if (!Number.isFinite(xpRequired) || xpRequired < 0) {
      return { ok: false, error: "Required XP must be 0 or greater." };
    }

    const updated = await updateServerRole({
      id,
      name,
      description,
      xpRequired,
      color: color.startsWith("#") ? color : `#${color}`,
      questId,
      discordRoleId,
    });

    if (!updated) {
      return { ok: false, error: "Role not found." };
    }

    revalidatePath("/admin/roles");
    revalidatePath("/admin/quests");
    revalidatePath("/admin/review");
    revalidatePath("/quests");
    revalidatePath("/admin/users");
    revalidatePath("/leaderboard");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update role.";
    if (/unique|already exists/i.test(message)) {
      return { ok: false, error: "A role with this name already exists." };
    }
    return { ok: false, error: message };
  }
}

export async function deleteServerRoleAction(
  roleId: string,
): Promise<RoleActionState> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }

    const deleted = await deleteServerRole(roleId);
    if (!deleted) {
      return { ok: false, error: "Role not found." };
    }

    revalidatePath("/admin/roles");
    revalidatePath("/admin/quests");
    revalidatePath("/admin/review");
    revalidatePath("/quests");
    revalidatePath("/admin/users");
    revalidatePath("/leaderboard");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete role.",
    };
  }
}

export async function toggleUserRoleAction(
  userId: string,
  roleId: string,
  currentlyAssigned: boolean,
): Promise<RoleActionState> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }

    if (currentlyAssigned) {
      await removeRoleFromUser(userId, roleId);
    } else {
      await assignRoleToUser(userId, roleId, authz.session.user.id);
    }

    // Sync changes to Discord member in background
    syncUserRolesToDiscord(userId).catch((err) => {
      console.warn("[toggleUserRoleAction] Discord sync warning:", err);
    });

    revalidatePath("/admin/roles");
    revalidatePath("/admin/users");
    revalidatePath("/leaderboard");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update member role.",
    };
  }
}

export async function syncUserDiscordRolesAction(
  userId: string,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }

    const result = await syncUserRolesToDiscord(userId);
    if (!result.success) {
      return { ok: false, error: result.reason ?? "Sync failed" };
    }

    const added = result.addedRoles?.length ? `Added: ${result.addedRoles.join(", ")}` : "";
    const removed = result.removedRoles?.length ? `Removed: ${result.removedRoles.join(", ")}` : "";
    const msg = [added, removed].filter(Boolean).join(". ") || "Discord roles are already in sync.";

    revalidatePath("/admin/roles");
    revalidatePath("/admin/users");
    return { ok: true, message: msg };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to sync Discord roles.",
    };
  }
}

export async function syncAllDiscordRolesAction(): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }

    const result = await syncAllUsersToDiscord();
    if (!result.success && result.syncedUsers === 0 && result.errors.length > 0) {
      return { ok: false, error: result.errors[0] || "Sync failed" };
    }

    const message = `Synced ${result.syncedUsers} of ${result.totalUsers} ambassadors with Discord (${result.notInServer} not in server)`;
    revalidatePath("/admin/roles");
    revalidatePath("/admin/users");
    return { ok: true, message };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to bulk sync Discord roles.",
    };
  }
}

export async function getDiscordStatusAction(): Promise<{
  isConfigured: boolean;
  guildId?: string;
  guildRolesCount?: number;
  error?: string;
}> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { isConfigured: false, error: authz.error };
    }

    const config = getDiscordConfig();
    if (!config.isConfigured) {
      return { isConfigured: false };
    }

    const rolesRes = await getDiscordGuildRoles();
    if (!rolesRes.ok) {
      return {
        isConfigured: true,
        guildId: config.guildId,
        error: rolesRes.error,
      };
    }

    return {
      isConfigured: true,
      guildId: config.guildId,
      guildRolesCount: rolesRes.data.length,
    };
  } catch (err) {
    return {
      isConfigured: false,
      error: err instanceof Error ? err.message : "Error checking Discord status",
    };
  }
}

export async function provisionDiscordRolesAction(): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }

    const result = await provisionDiscordRoles();
    revalidatePath("/admin/roles");
    revalidatePath("/admin/users");

    if (!result.ok) {
      return { ok: false, error: result.message };
    }

    return { ok: true, message: result.message };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to provision Discord roles.",
    };
  }
}


