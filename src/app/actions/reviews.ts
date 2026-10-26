"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  updateSubmissionReview,
  revertSubmissionToPending,
  clearSubmissionProofPath,
  syncUserXpRoles,
  getQuestById,
  assignRoleToUser,
  getUserAssignedServerRoles,
  getUserById,
} from "@/lib/db";
import { getSession } from "@/lib/session";
import { deleteProofFilesForSubmission } from "@/lib/supabase-server";
import { syncUserRolesToDiscord } from "@/lib/discord-sync";
import { notifyQuestCompleted, notifyRoleUnlocked } from "@/lib/discord-webhook";

export type ReviewActionState = {
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

export async function approveSubmissionAction(
  submissionId: string,
): Promise<ReviewActionState> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }

    const updated = await updateSubmissionReview({
      submissionId,
      status: "approved",
      reviewNote: null,
      reviewedBy: authz.session.user.id,
    });

    if (!updated) {
      return { ok: false, error: "Submission not found or already reviewed." };
    }

    // Free storage: remove proof images after approval (rejected proofs are kept).
    try {
      await deleteProofFilesForSubmission({
        userId: updated.user_id,
        questId: updated.quest_id,
        proofPath: updated.proof_path,
      });
      await clearSubmissionProofPath(updated.id);
    } catch (cleanupErr) {
      console.error("Failed to delete approved proof files:", cleanupErr);
    }

    // Capture user roles before any new assignments/XP sync to detect unlocked roles
    const rolesBefore = await getUserAssignedServerRoles(updated.user_id);
    const existingRoleIds = new Set(rolesBefore.map((r) => r.id));

    // If this quest awards a specific server role, grant it to the user
    const quest = await getQuestById(updated.quest_id);
    if (quest?.reward_role_id) {
      await assignRoleToUser(
        updated.user_id,
        quest.reward_role_id,
        authz.session.user.id,
      );
    }

    // Auto-unlock any server achievement roles the user newly qualifies for via XP
    await syncUserXpRoles(updated.user_id);

    // Sync roles to Discord via Bot API
    syncUserRolesToDiscord(updated.user_id).catch((syncErr) => {
      console.warn("[approveSubmissionAction] Discord role sync:", syncErr);
    });

    // Announce quest completion + any newly unlocked roles via Discord webhook
    // (each announcement type is gated by the admin notification settings)
    after(async () => {
      try {
        const [rolesAfter, user] = await Promise.all([
          getUserAssignedServerRoles(updated.user_id),
          getUserById(updated.user_id),
        ]);
        if (!user) return;

        if (quest) {
          await notifyQuestCompleted({
            user: {
              id: user.id,
              name: user.name,
              discordId: user.discordId,
              totalXp: user.totalXp,
            },
            quest: { id: quest.id, title: quest.title, xp_reward: quest.xp_reward },
          });
        }

        const newlyEarnedRoles = rolesAfter.filter((r) => !existingRoleIds.has(r.id));
        for (const role of newlyEarnedRoles) {
          await notifyRoleUnlocked({
            user: {
              id: user.id,
              name: user.name,
              discordId: user.discordId,
              totalXp: user.totalXp,
            },
            role: {
              id: role.id,
              name: role.name,
              color: role.color,
              xp_required: role.xp_required,
            },
          });
        }
      } catch (notifyErr) {
        console.warn("[approveSubmissionAction] Discord webhook announcement error:", notifyErr);
      }
    });

    revalidatePath("/admin");
    revalidatePath("/admin/reviews");
    revalidatePath("/admin/roles");
    revalidatePath("/quests");
    revalidatePath("/leaderboard");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Approve failed.",
    };
  }
}

export async function rejectSubmissionAction(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }

    const submissionId = String(formData.get("submissionId") ?? "").trim();
    const reviewNote =
      String(formData.get("reviewNote") ?? "").trim() || null;

    if (!submissionId) {
      return { ok: false, error: "Missing submission." };
    }

    const updated = await updateSubmissionReview({
      submissionId,
      status: "rejected",
      reviewNote,
      reviewedBy: authz.session.user.id,
    });

    if (!updated) {
      return { ok: false, error: "Submission not found or already reviewed." };
    }

    revalidatePath("/admin");
    revalidatePath("/quests");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Reject failed.",
    };
  }
}

export async function undoSubmissionReviewAction(
  submissionId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }

    const updated = await revertSubmissionToPending(submissionId);
    if (!updated) {
      return { ok: false, error: "Submission not found." };
    }

    // Resync roles to Discord after undoing
    syncUserRolesToDiscord(updated.user_id).catch((syncErr) => {
      console.warn("[undoSubmissionReviewAction] Discord role sync:", syncErr);
    });

    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/admin/review");
    revalidatePath(`/admin/users/${updated.user_id}`);
    revalidatePath(`/users/${updated.user_id}`);
    revalidatePath("/leaderboard");
    revalidatePath("/dashboard");
    revalidatePath("/quests");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to undo review.",
    };
  }
}
