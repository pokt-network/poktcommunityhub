"use server";

import { revalidatePath } from "next/cache";
import { isSuperAdmin } from "@/lib/admin";
import {
  deleteManagedUser,
  getUserIdentity,
  updateUserRole,
} from "@/lib/db";
import { getSession } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase-server";

export type UserActionState = {
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

export async function setUserRoleAction(
  userId: string,
  role: "admin" | "ambassador",
): Promise<UserActionState> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }

    if (!isSuperAdmin(authz.session.user)) {
      return {
        ok: false,
        error: "Only Super Admin (Sufyan Khan) can grant or remove admin privileges.",
      };
    }

    if (!userId) {
      return { ok: false, error: "User not found." };
    }

    if (userId === authz.session.user.id) {
      return { ok: false, error: "You can’t change your own role." };
    }

    if (role !== "admin" && role !== "ambassador") {
      return { ok: false, error: "Invalid role." };
    }

    const target = await getUserIdentity(userId);
    if (!target) {
      return { ok: false, error: "User not found." };
    }

    if (isSuperAdmin(target)) {
      return {
        ok: false,
        error: "Super Admin privileges cannot be modified.",
      };
    }

    if (target.role === role) {
      return { ok: true };
    }

    const updated = await updateUserRole({ userId, role });
    if (!updated) {
      return { ok: false, error: "User not found or protected." };
    }

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    revalidatePath(`/users/${userId}`);
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    console.error("[setUserRoleAction]", err);
    return { ok: false, error: "Could not update role." };
  }
}

export async function deleteUserAction(
  userId: string,
): Promise<UserActionState> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }

    if (!userId) {
      return { ok: false, error: "User not found." };
    }

    if (userId === authz.session.user.id) {
      return { ok: false, error: "You can’t delete your own account." };
    }

    const target = await getUserIdentity(userId);
    if (!target) {
      return { ok: false, error: "User not found." };
    }

    if (isSuperAdmin(target)) {
      return {
        ok: false,
        error: "The Super Admin account cannot be deleted.",
      };
    }

    if (target.role === "admin" && !isSuperAdmin(authz.session.user)) {
      return {
        ok: false,
        error: "Only Super Admin (Sufyan Khan) can remove an admin account.",
      };
    }

    const deleted = await deleteManagedUser(userId);
    if (!deleted) {
      return { ok: false, error: "User not found or protected." };
    }

    try {
      const supabase = createSupabaseServiceClient();
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) {
        console.error("[deleteUserAction] auth delete", error.message);
      }
    } catch (err) {
      console.error("[deleteUserAction] auth delete", err);
    }

    revalidatePath("/admin/users");
    revalidatePath("/admin");
    revalidatePath("/leaderboard");
    return { ok: true };
  } catch (err) {
    console.error("[deleteUserAction]", err);
    return { ok: false, error: "Could not delete user." };
  }
}
