"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  createQuest,
  deleteQuest,
  setQuestStatus,
  updateQuest,
  getQuestCategoryById,
  getServerRoleById,
} from "@/lib/db";
import { getSession } from "@/lib/session";
import { notifyNewQuest } from "@/lib/discord-webhook";

export type QuestActionState = {
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

/** Reads ISO `startsAt` / `endsAt` (empty = unset) and validates the window. */
function parseSchedule(
  formData: FormData,
  { requireFutureEnd }: { requireFutureEnd: boolean },
): { startsAt: Date | null; endsAt: Date | null } | { error: string } {
  const read = (key: string): Date | null | "invalid" => {
    const raw = String(formData.get(key) ?? "").trim();
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d : "invalid";
  };
  const startsAt = read("startsAt");
  const endsAt = read("endsAt");
  if (startsAt === "invalid") return { error: "Start time is not a valid date." };
  if (endsAt === "invalid") return { error: "End time is not a valid date." };
  if (startsAt && endsAt && endsAt <= startsAt) {
    return { error: "End time must be after the start time." };
  }
  if (requireFutureEnd && endsAt && endsAt.getTime() <= Date.now()) {
    return { error: "End time must be in the future." };
  }
  return { startsAt, endsAt };
}

export async function createQuestAction(
  _prev: QuestActionState,
  formData: FormData,
): Promise<QuestActionState> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }

    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const xpRaw = String(formData.get("xpReward") ?? "").trim();
    const icon = String(formData.get("icon") ?? "").trim() || null;
    const categoryIdRaw = String(formData.get("categoryId") ?? "").trim();
    const categoryId = categoryIdRaw || null;
    const rewardRoleIdRaw = String(formData.get("rewardRoleId") ?? "").trim();
    const rewardRoleId = rewardRoleIdRaw || null;
    const linkDescription = String(formData.get("linkDescription") ?? "").trim();
    const linkCountRaw = Number.parseInt(
      String(formData.get("linkCount") ?? "1"),
      10,
    );
    const linkCount = Number.isFinite(linkCountRaw) ? linkCountRaw : 1;
    const xpReward = Number.parseInt(xpRaw, 10);

    if (!title) {
      return { ok: false, error: "Title is required." };
    }
    if (!categoryId) {
      return { ok: false, error: "Category is required." };
    }
    if (!Number.isFinite(xpReward) || xpReward < 0) {
      return { ok: false, error: "XP reward must be a non-negative number." };
    }
    if (linkCount < 1 || linkCount > 8) {
      return { ok: false, error: "Number of links must be between 1 and 8." };
    }

    const schedule = parseSchedule(formData, { requireFutureEnd: true });
    if ("error" in schedule) {
      return { ok: false, error: schedule.error };
    }

    const broadcastDiscord =
      formData.get("broadcastDiscord") === "on" ||
      formData.get("broadcastDiscord") === "true";

    const createdQuest = await createQuest({
      title,
      description,
      xpReward,
      icon,
      categoryId,
      rewardRoleId,
      linkDescription,
      linkCount,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
    });

    if (createdQuest && broadcastDiscord) {
      after(async () => {
        try {
          const [category, role] = await Promise.all([
            categoryId ? getQuestCategoryById(categoryId) : Promise.resolve(null),
            rewardRoleId ? getServerRoleById(rewardRoleId) : Promise.resolve(null),
          ]);
          await notifyNewQuest({
            id: createdQuest.id,
            title: createdQuest.title,
            description: createdQuest.description,
            xp_reward: createdQuest.xp_reward,
            category_name: category?.name ?? null,
            reward_role_name: role?.name ?? null,
            reward_role_color: role?.color ?? null,
            ends_at: createdQuest.ends_at,
          });
        } catch (webhookErr) {
          console.warn("[createQuestAction] Discord webhook broadcast error:", webhookErr);
        }
      });
    }

    revalidatePath("/admin/quests");
    revalidatePath("/quests");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Create failed.",
    };
  }
}

export async function updateQuestAction(
  _prev: QuestActionState,
  formData: FormData,
): Promise<QuestActionState> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }

    const id = String(formData.get("id") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const xpRaw = String(formData.get("xpReward") ?? "").trim();
    const icon = String(formData.get("icon") ?? "").trim() || null;
    const categoryIdRaw = String(formData.get("categoryId") ?? "").trim();
    const categoryId = categoryIdRaw || null;
    const rewardRoleIdRaw = String(formData.get("rewardRoleId") ?? "").trim();
    const rewardRoleId = rewardRoleIdRaw || null;
    const linkDescription = String(formData.get("linkDescription") ?? "").trim();
    const linkCountRaw = Number.parseInt(
      String(formData.get("linkCount") ?? "1"),
      10,
    );
    const linkCount = Number.isFinite(linkCountRaw) ? linkCountRaw : 1;
    const statusRaw = String(formData.get("status") ?? "active").trim();
    const xpReward = Number.parseInt(xpRaw, 10);
    const status = statusRaw === "closed" ? "closed" : "active";

    if (!id) {
      return { ok: false, error: "Missing quest id." };
    }
    if (!title) {
      return { ok: false, error: "Title is required." };
    }
    if (!categoryId) {
      return { ok: false, error: "Category is required." };
    }
    if (!Number.isFinite(xpReward) || xpReward < 0) {
      return { ok: false, error: "XP reward must be a non-negative number." };
    }
    if (linkCount < 1 || linkCount > 8) {
      return { ok: false, error: "Number of links must be between 1 and 8." };
    }

    const schedule = parseSchedule(formData, { requireFutureEnd: false });
    if ("error" in schedule) {
      return { ok: false, error: schedule.error };
    }

    const updated = await updateQuest({
      id,
      title,
      description,
      xpReward,
      icon,
      status,
      categoryId,
      rewardRoleId,
      linkDescription,
      linkCount,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
    });

    if (!updated) {
      return { ok: false, error: "Quest not found." };
    }

    revalidatePath("/admin/quests");
    revalidatePath("/quests");
    revalidatePath(`/quests/${id}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Update failed.",
    };
  }
}

export async function setQuestStatusAction(
  questId: string,
  status: "active" | "closed",
): Promise<QuestActionState> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }
    if (!questId) {
      return { ok: false, error: "Missing quest id." };
    }
    if (status !== "active" && status !== "closed") {
      return { ok: false, error: "Invalid status." };
    }

    const updated = await setQuestStatus(questId, status);
    if (!updated) {
      return { ok: false, error: "Quest not found." };
    }

    revalidatePath("/admin/quests");
    revalidatePath("/quests");
    revalidatePath(`/quests/${questId}`);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Status update failed.",
    };
  }
}

export async function deleteQuestAction(
  questId: string,
): Promise<QuestActionState> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }
    if (!questId) {
      return { ok: false, error: "Missing quest id." };
    }

    const deleted = await deleteQuest(questId);
    if (!deleted) {
      return { ok: false, error: "Quest not found." };
    }

    revalidatePath("/admin/quests");
    revalidatePath("/quests");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Delete failed.",
    };
  }
}
