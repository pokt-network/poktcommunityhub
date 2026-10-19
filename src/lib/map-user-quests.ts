import type { QuestWithSubmission } from "@/lib/db";
import { toFilterableQuest, type FilterableQuest } from "@/lib/quest-filters";
import { getProofPublicUrl } from "@/lib/supabase-server";

export function mapUserQuests(
  quests: QuestWithSubmission[],
): FilterableQuest[] {
  return quests.map((q) => {
    let proofImageUrl: string | null = null;
    if (q.proof_path) {
      try {
        proofImageUrl = getProofPublicUrl(q.proof_path);
      } catch {
        proofImageUrl = null;
      }
    }

    return toFilterableQuest(
      {
        id: q.id,
        title: q.title,
        description: q.description,
        xp_reward: q.xp_reward,
        submission_status: q.submission_status,
        submission_created_at: q.submission_created_at,
        createdAt: q.createdAt,
        proof_url: q.proof_url,
        review_note: q.review_note,
      },
      proofImageUrl,
    );
  });
}
