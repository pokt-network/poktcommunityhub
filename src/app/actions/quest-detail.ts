"use server";

import {
  getQuestById,
  getUserSubmission,
  getVisibleQuestById,
} from "@/lib/db";
import { toFilterableQuest, type FilterableQuest } from "@/lib/quest-filters";
import { scheduleClosedMessage } from "@/lib/quest-schedule";
import { getSession } from "@/lib/session";
import { getProofPublicUrl } from "@/lib/supabase-server";

export async function getMyQuestDetailAction(
  questId: string,
): Promise<{ ok: true; quest: FilterableQuest } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Please sign in again." };
  }

  const id = String(questId ?? "").trim();
  if (!id) {
    return { ok: false, error: "Missing quest." };
  }

  const [quest, submission] = await Promise.all([
    getVisibleQuestById(id),
    getUserSubmission(session.user.id, id),
  ]);

  if (!quest) {
    const any = await getQuestById(id);
    return { ok: false, error: scheduleClosedMessage(any) };
  }

  let proofImage: string | null = null;
  if (submission?.proof_path) {
    try {
      proofImage = getProofPublicUrl(submission.proof_path);
    } catch {
      proofImage = null;
    }
  }

  return {
    ok: true,
    quest: toFilterableQuest(
      {
        id: quest.id,
        title: quest.title,
        description: quest.description,
        xp_reward: quest.xp_reward,
        icon: quest.icon,
        category_id: quest.category_id ?? null,
        category_name: quest.category_name ?? null,
        link_description: quest.link_description ?? null,
        link_count: quest.link_count ?? 1,
        reward_role_name: quest.reward_role_name ?? null,
        reward_role_color: quest.reward_role_color ?? null,
        submission_status: submission?.status ?? null,
        submission_created_at: submission?.createdAt ?? null,
        createdAt: quest.createdAt,
        starts_at: quest.starts_at ?? null,
        ends_at: quest.ends_at ?? null,
        proof_url: submission?.proof_url ?? null,
        proof_urls: submission?.proof_urls ?? null,
        review_note: submission?.review_note ?? null,
      },
      proofImage,
    ),
  };
}
