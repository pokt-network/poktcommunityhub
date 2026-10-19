import type { SubmissionStatus } from "@/lib/db";

/** Slim row for list/grid cards + filters (no proof payloads). */
export type QuestListItem = {
  id: string;
  title: string;
  description: string;
  xp_reward: number;
  icon: string | null;
  category_id?: string | null;
  category_name?: string | null;
  link_description?: string | null;
  link_count?: number;
  reward_role_name?: string | null;
  reward_role_color?: string | null;
  submission_status: SubmissionStatus | null;
  submittedAt: string | null;
  questCreatedAt: string;
  /** ISO — null = live immediately. */
  starts_at: string | null;
  /** ISO — null = never auto-closes. */
  ends_at: string | null;
};

/** Full quest for the inline detail / submit panel. */
export type FilterableQuest = QuestListItem & {
  proof_url: string | null;
  proof_urls?: string[];
  proof_image_url: string | null;
  review_note: string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function toQuestListItem(q: {
  id: string;
  title: string;
  description: string;
  xp_reward: number;
  icon?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  link_description?: string | null;
  link_count?: number;
  reward_role_name?: string | null;
  reward_role_color?: string | null;
  submission_status: SubmissionStatus | null;
  submission_created_at?: Date | string | null;
  createdAt: Date | string;
  starts_at?: Date | string | null;
  ends_at?: Date | string | null;
}): QuestListItem {
  return {
    id: q.id,
    title: q.title,
    description: q.description,
    xp_reward: q.xp_reward,
    icon: q.icon ?? null,
    category_id: q.category_id ?? null,
    category_name: q.category_name ?? null,
    link_description: q.link_description ?? null,
    link_count: q.link_count ?? 1,
    reward_role_name: q.reward_role_name ?? null,
    reward_role_color: q.reward_role_color ?? null,
    submission_status: q.submission_status ?? null,
    submittedAt: toIso(q.submission_created_at),
    questCreatedAt: toIso(q.createdAt) ?? new Date(0).toISOString(),
    starts_at: toIso(q.starts_at),
    ends_at: toIso(q.ends_at),
  };
}

export function toFilterableQuest(
  q: {
    id: string;
    title: string;
    description: string;
    xp_reward: number;
    icon?: string | null;
    category_id?: string | null;
    category_name?: string | null;
    link_description?: string | null;
    link_count?: number;
    reward_role_name?: string | null;
    reward_role_color?: string | null;
    submission_status: SubmissionStatus | null;
    submission_created_at?: Date | string | null;
    createdAt: Date | string;
    starts_at?: Date | string | null;
    ends_at?: Date | string | null;
    proof_url?: string | null;
    proof_urls?: string[] | null;
    review_note?: string | null;
  },
  proofImageUrl?: string | null,
): FilterableQuest {
  const proof_urls =
    q.proof_urls?.filter(Boolean) ??
    (q.proof_url ? [q.proof_url] : []);
  return {
    ...toQuestListItem(q),
    proof_url: proof_urls[0] ?? q.proof_url ?? null,
    proof_urls,
    proof_image_url: proofImageUrl ?? null,
    review_note: q.review_note ?? null,
  };
}

/** Display category label for a quest (DB category, else Other). */
export function questCategoryLabel(
  quest: Pick<QuestListItem, "category_name">,
): string {
  return quest.category_name?.trim() || "Other";
}

export function xpLevelProgress(totalXp: number) {
  const perLevel = 1000;
  const level = Math.floor(totalXp / perLevel) + 1;
  const intoLevel = totalXp % perLevel;
  return { level, intoLevel, perLevel, totalXp };
}
