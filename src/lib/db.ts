import { Pool, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as { pgPool?: Pool };

function poolMax() {
  const fromEnv = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  // Session pooler ~15 TOTAL for the whole Supabase project (local + Vercel).
  return 1;
}

/**
 * Single shared Pool for the whole app (auth + queries).
 *
 * Supabase session-mode pooler caps clients (~15) across every consumer of
 * this project — local `next dev`, production, and scripts share that budget.
 * Default max is 1; raise via DATABASE_POOL_MAX after upgrading compute.
 */
export function getPool() {
  if (!globalForDb.pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("Missing DATABASE_URL");
    }
    globalForDb.pgPool = new Pool({
      connectionString,
      max: poolMax(),
      idleTimeoutMillis: 3_000,
      connectionTimeoutMillis: 15_000,
      allowExitOnIdle: true,
      maxUses: 7_500,
    });
    globalForDb.pgPool.on("error", (err) => {
      console.error("[pg pool]", err.message);
    });
  }
  return globalForDb.pgPool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  return getPool().query<T>(text, params);
}

export type QuestCategory = {
  id: string;
  name: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  quest_count?: number;
};

export type Quest = {
  id: string;
  title: string;
  description: string;
  xp_reward: number;
  icon: string | null;
  status: "active" | "closed";
  category_id?: string | null;
  category_name?: string | null;
  link_description?: string | null;
  link_count?: number;
  reward_role_id?: string | null;
  reward_role_name?: string | null;
  reward_role_color?: string | null;
  starts_at?: Date | null;
  ends_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const QUEST_SELECT = `
  q.id,
  q.title,
  q.description,
  q.xp_reward,
  q.icon,
  q.status,
  q.category_id,
  c.name AS category_name,
  q.link_description,
  q.link_count,
  q.reward_role_id,
  r.name AS reward_role_name,
  r.color AS reward_role_color,
  q.starts_at,
  q.ends_at,
  q."createdAt",
  q."updatedAt"
`;

const QUEST_FROM = `
  FROM public.quests q
  LEFT JOIN public.quest_categories c ON c.id = q.category_id
  LEFT JOIN public.server_roles r ON r.id = q.reward_role_id
`;

/** Accepting submissions right now: active and inside its schedule window. */
const QUEST_LIVE_WHERE = `
  q.status = 'active'
  AND (q.starts_at IS NULL OR q.starts_at <= now())
  AND (q.ends_at IS NULL OR q.ends_at > now())
`;

/** Shown on ambassador boards: live + upcoming (scheduled) — ended quests auto-hide. */
const QUEST_VISIBLE_WHERE = `
  q.status = 'active'
  AND (q.ends_at IS NULL OR q.ends_at > now())
`;

/** Live first, then upcoming by launch time, then newest. */
const QUEST_BOARD_ORDER = `
  (q.starts_at IS NOT NULL AND q.starts_at > now()) ASC,
  CASE WHEN q.starts_at > now() THEN q.starts_at END ASC,
  q."createdAt" DESC
`;

const QUEST_RETURNING = `
  id, title, description, xp_reward, icon, status, category_id,
  reward_role_id, link_description, link_count, starts_at, ends_at,
  "createdAt", "updatedAt"
`;

export type SubmissionStatus = "pending" | "approved" | "rejected";

export type Submission = {
  id: string;
  user_id: string;
  quest_id: string;
  proof_url: string | null;
  proof_urls?: string[] | null;
  proof_path: string | null;
  status: SubmissionStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type QuestWithSubmission = Quest & {
  submission_id: string | null;
  submission_status: SubmissionStatus | null;
  submission_created_at: Date | null;
  proof_url: string | null;
  proof_urls?: string[] | null;
  proof_path: string | null;
  review_note: string | null;
};

export function normalizeProofUrls(
  urls: unknown,
  fallback?: string | null,
): string[] {
  if (Array.isArray(urls)) {
    return urls
      .map((u) => String(u ?? "").trim())
      .filter(Boolean);
  }
  if (typeof urls === "string" && urls.trim()) {
    try {
      const parsed = JSON.parse(urls) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((u) => String(u ?? "").trim()).filter(Boolean);
      }
    } catch {
      /* ignore */
    }
  }
  const single = fallback?.trim();
  return single ? [single] : [];
}

export type PendingSubmissionRow = Submission & {
  quest_title: string;
  quest_xp: number;
  reward_role_id?: string | null;
  reward_role_name?: string | null;
  reward_role_color?: string | null;
  user_name: string;
  user_image: string | null;
  user_discord_id: string | null;
  proof_urls?: string[] | null;
};

export type ServerRoleSummary = {
  id: string;
  name: string;
  color: string;
  xp_required: number;
};

export type LeaderboardRow = {
  id: string;
  name: string;
  image: string | null;
  totalXp: number;
  discordId: string | null;
  role: string | null;
  roles: ServerRoleSummary[];
};

export async function listActiveQuests(
  limit = 12,
  options: { includeUpcoming?: boolean } = {},
) {
  const where = options.includeUpcoming ? QUEST_VISIBLE_WHERE : QUEST_LIVE_WHERE;
  const { rows } = await query<Quest>(
    `SELECT ${QUEST_SELECT}
     ${QUEST_FROM}
     WHERE ${where}
     ORDER BY ${QUEST_BOARD_ORDER}
     LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function listActiveQuestsForUser(userId: string) {
  const { rows } = await query<QuestWithSubmission>(
    `SELECT
       ${QUEST_SELECT},
       s.id AS submission_id,
       s.status AS submission_status,
       s."createdAt" AS submission_created_at,
       s.proof_url,
       s.proof_urls,
       s.proof_path,
       s.review_note
     ${QUEST_FROM}
     LEFT JOIN public.submissions s
       ON s.quest_id = q.id AND s.user_id = $1
     WHERE ${QUEST_VISIBLE_WHERE}
     ORDER BY ${QUEST_BOARD_ORDER}`,
    [userId],
  );
  return rows.map((row) => ({
    ...row,
    proof_urls: normalizeProofUrls(row.proof_urls, row.proof_url),
  }));
}

/** Live quest only (active + inside schedule window) — used for submit gating. */
export async function getActiveQuestById(questId: string) {
  const { rows } = await query<Quest>(
    `SELECT ${QUEST_SELECT}
     ${QUEST_FROM}
     WHERE q.id = $1 AND ${QUEST_LIVE_WHERE}`,
    [questId],
  );
  return rows[0] ?? null;
}

/** Visible quest (live + scheduled upcoming) — used for detail pages and previews. */
export async function getVisibleQuestById(questId: string) {
  const { rows } = await query<Quest>(
    `SELECT ${QUEST_SELECT}
     ${QUEST_FROM}
     WHERE q.id = $1 AND ${QUEST_VISIBLE_WHERE}`,
    [questId],
  );
  return rows[0] ?? null;
}

export async function getQuestById(questId: string) {
  const { rows } = await query<Quest>(
    `SELECT ${QUEST_SELECT}
     ${QUEST_FROM}
     WHERE q.id = $1`,
    [questId],
  );
  return rows[0] ?? null;
}

export async function getUserSubmission(userId: string, questId: string) {
  const { rows } = await query<Submission>(
    `SELECT id, user_id, quest_id, proof_url, proof_urls, proof_path, status, review_note,
            reviewed_by, reviewed_at, "createdAt", "updatedAt"
     FROM public.submissions
     WHERE user_id = $1 AND quest_id = $2`,
    [userId, questId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    proof_urls: normalizeProofUrls(row.proof_urls, row.proof_url),
  };
}

export async function upsertSubmission(input: {
  userId: string;
  questId: string;
  proofUrl: string | null;
  proofUrls: string[];
  proofPath: string | null;
}) {
  const proofUrls = input.proofUrls.filter(Boolean);
  const proofUrl = proofUrls[0] ?? input.proofUrl ?? null;
  const { rows } = await query<Submission>(
    `INSERT INTO public.submissions (user_id, quest_id, proof_url, proof_urls, proof_path, status)
     VALUES ($1, $2, $3, $4::jsonb, $5, 'pending')
     ON CONFLICT (user_id, quest_id) DO UPDATE SET
       proof_url = EXCLUDED.proof_url,
       proof_urls = EXCLUDED.proof_urls,
       proof_path = COALESCE(EXCLUDED.proof_path, public.submissions.proof_path),
       status = 'pending',
       review_note = NULL,
       reviewed_by = NULL,
       reviewed_at = NULL,
       "updatedAt" = now()
     RETURNING id, user_id, quest_id, proof_url, proof_urls, proof_path, status, review_note,
               reviewed_by, reviewed_at, "createdAt", "updatedAt"`,
    [
      input.userId,
      input.questId,
      proofUrl,
      JSON.stringify(proofUrls),
      input.proofPath,
    ],
  );
  const row = rows[0];
  if (!row) return row;
  return {
    ...row,
    proof_urls: normalizeProofUrls(row.proof_urls, row.proof_url),
  };
}

export async function listPendingSubmissions() {
  const { rows } = await query<PendingSubmissionRow>(
    `SELECT
       s.id,
       s.user_id,
       s.quest_id,
       s.proof_url,
       s.proof_urls,
       s.proof_path,
       s.status,
       s.review_note,
       s.reviewed_by,
       s.reviewed_at,
       s."createdAt",
       s."updatedAt",
       q.title AS quest_title,
       q.xp_reward AS quest_xp,
       q.reward_role_id,
       r.name AS reward_role_name,
       r.color AS reward_role_color,
       u.name AS user_name,
       u.image AS user_image,
       u."discordId" AS user_discord_id
     FROM public.submissions s
     JOIN public.quests q ON q.id = s.quest_id
     LEFT JOIN public.server_roles r ON r.id = q.reward_role_id
     JOIN public."user" u ON u.id = s.user_id
     WHERE s.status = 'pending'
     ORDER BY s."createdAt" ASC`,
  );
  return rows.map((row) => ({
    ...row,
    proof_urls: normalizeProofUrls(row.proof_urls, row.proof_url),
  }));
}

export type AdminOpsStats = {
  pendingReviews: number;
  activeQuests: number;
  closedQuests: number;
  approvedToday: number;
};

export async function getAdminOpsStats(): Promise<AdminOpsStats> {
  const { rows } = await query<{
    pending_reviews: string;
    active_quests: string;
    closed_quests: string;
    approved_today: string;
  }>(
    `SELECT
       (SELECT COUNT(*)::text FROM public.submissions WHERE status = 'pending') AS pending_reviews,
       (SELECT COUNT(*)::text FROM public.quests WHERE status = 'active') AS active_quests,
       (SELECT COUNT(*)::text FROM public.quests WHERE status = 'closed') AS closed_quests,
       (SELECT COUNT(*)::text FROM public.submissions
         WHERE status = 'approved' AND reviewed_at >= date_trunc('day', now())) AS approved_today`,
  );
  const row = rows[0];
  return {
    pendingReviews: Number(row?.pending_reviews ?? 0),
    activeQuests: Number(row?.active_quests ?? 0),
    closedQuests: Number(row?.closed_quests ?? 0),
    approvedToday: Number(row?.approved_today ?? 0),
  };
}

export async function updateSubmissionReview(input: {
  submissionId: string;
  status: "approved" | "rejected";
  reviewNote: string | null;
  reviewedBy: string;
}) {
  const { rows } = await query<Submission>(
    `UPDATE public.submissions
     SET status = $2,
         review_note = $3,
         reviewed_by = $4,
         reviewed_at = now(),
         "updatedAt" = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING id, user_id, quest_id, proof_url, proof_path, status, review_note,
               reviewed_by, reviewed_at, "createdAt", "updatedAt"`,
    [input.submissionId, input.status, input.reviewNote, input.reviewedBy],
  );
  return rows[0] ?? null;
}

/** Clear stored screenshot path after approved proofs are removed from Storage. */
export async function clearSubmissionProofPath(submissionId: string) {
  await query(
    `UPDATE public.submissions
     SET proof_path = NULL, "updatedAt" = now()
     WHERE id = $1`,
    [submissionId],
  );
}

/** Revert an approved or rejected submission back to pending review, deducting XP and resyncing roles if it was approved. */
export async function revertSubmissionToPending(submissionId: string) {
  const { rows: subRows } = await query<{
    id: string;
    user_id: string;
    quest_id: string;
    status: string;
    xp_reward: number;
    reward_role_id: string | null;
  }>(
    `SELECT s.id, s.user_id, s.quest_id, s.status, q.xp_reward, q.reward_role_id
     FROM public.submissions s
     JOIN public.quests q ON q.id = s.quest_id
     WHERE s.id = $1`,
    [submissionId],
  );

  const sub = subRows[0];
  if (!sub) return null;

  const wasApproved = sub.status === "approved";

  const { rows: updatedRows } = await query<Submission>(
    `UPDATE public.submissions
     SET status = 'pending',
         review_note = NULL,
         reviewed_by = NULL,
         reviewed_at = NULL,
         "updatedAt" = now()
     WHERE id = $1
     RETURNING id, user_id, quest_id, proof_url, proof_path, status, review_note,
               reviewed_by, reviewed_at, "createdAt", "updatedAt"`,
    [submissionId],
  );

  const updated = updatedRows[0];
  if (!updated) return null;

  if (wasApproved) {
    // Recalculate user totalXp strictly from actual approved submissions
    await query(
      `UPDATE public."user"
       SET "totalXp" = COALESCE(
         (
           SELECT SUM(q.xp_reward)::int
           FROM public.submissions s
           JOIN public.quests q ON q.id = s.quest_id
           WHERE s.user_id = $1 AND s.status = 'approved'
         ),
         0
       ),
       "updatedAt" = now()
       WHERE id = $1`,
      [sub.user_id],
    );

    // If this quest rewarded a role, check if user still qualifies via another approved submission
    if (sub.reward_role_id) {
      const { rows: otherApproved } = await query<{ count: string }>(
        `SELECT COUNT(*)::text as count
         FROM public.submissions
         WHERE user_id = $1 AND quest_id = $2 AND status = 'approved'`,
        [sub.user_id, sub.quest_id],
      );
      if (Number(otherApproved[0]?.count ?? 0) === 0) {
        await removeRoleFromUser(sub.user_id, sub.reward_role_id);
      }
    }

    // Clean up XP-unlocked achievement roles user no longer qualifies for
    await query(
      `DELETE FROM public.user_roles ur
       USING public.server_roles r, public."user" u
       WHERE ur.role_id = r.id
         AND ur.user_id = u.id
         AND ur.user_id = $1
         AND ur.assigned_by IS NULL
         AND r.xp_required > 0
         AND r.xp_required > COALESCE(u."totalXp", 0)`,
      [sub.user_id],
    );
  }

  return updated;
}

export type UserQuestHistoryItem = {
  id: string;
  userId: string;
  questId: string;
  questTitle: string;
  questDescription: string;
  questXp: number;
  questIcon: string | null;
  questStatus: "active" | "closed";
  categoryId?: string | null;
  categoryName: string | null;
  rewardRoleId?: string | null;
  rewardRoleName: string | null;
  rewardRoleColor: string | null;
  status: SubmissionStatus;
  proofUrl: string | null;
  proofUrls: string[];
  proofPath: string | null;
  proofImageUrl: string | null;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewerName: string | null;
  reviewerImage: string | null;
  reviewerRole: string | null;
  reviewedAt: string | null;
  submittedAt: string;
  updatedAt: string;
};

export async function getUserQuestHistory(userId: string): Promise<UserQuestHistoryItem[]> {
  const { rows } = await query<{
    id: string;
    user_id: string;
    quest_id: string;
    proof_url: string | null;
    proof_urls: unknown;
    proof_path: string | null;
    status: SubmissionStatus;
    review_note: string | null;
    reviewed_by: string | null;
    reviewed_at: Date | string | null;
    created_at: Date | string;
    updated_at: Date | string;
    quest_title: string;
    quest_description: string;
    quest_xp: number;
    quest_icon: string | null;
    quest_status: "active" | "closed";
    category_id: string | null;
    category_name: string | null;
    reward_role_id: string | null;
    reward_role_name: string | null;
    reward_role_color: string | null;
    reviewer_name: string | null;
    reviewer_image: string | null;
    reviewer_role: string | null;
  }>(
    `SELECT
       s.id,
       s.user_id,
       s.quest_id,
       s.proof_url,
       s.proof_urls,
       s.proof_path,
       s.status,
       s.review_note,
       s.reviewed_by,
       s.reviewed_at,
       s."createdAt" AS created_at,
       s."updatedAt" AS updated_at,
       q.title AS quest_title,
       q.description AS quest_description,
       q.xp_reward AS quest_xp,
       q.icon AS quest_icon,
       q.status AS quest_status,
       q.category_id,
       c.name AS category_name,
       q.reward_role_id,
       r.name AS reward_role_name,
       r.color AS reward_role_color,
       reviewer.name AS reviewer_name,
       reviewer.image AS reviewer_image,
       reviewer.role AS reviewer_role
     FROM public.submissions s
     JOIN public.quests q ON q.id = s.quest_id
     LEFT JOIN public.quest_categories c ON c.id = q.category_id
     LEFT JOIN public.server_roles r ON r.id = q.reward_role_id
     LEFT JOIN public."user" reviewer ON reviewer.id = s.reviewed_by
     WHERE s.user_id = $1
     ORDER BY
       CASE
         WHEN s.status = 'approved' THEN 1
         WHEN s.status = 'rejected' THEN 2
         ELSE 3
       END,
       COALESCE(s.reviewed_at, s."createdAt") DESC`,
    [userId],
  );

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  return rows.map((row) => {
    let proofImageUrl: string | null = null;
    if (row.proof_path && baseUrl) {
      proofImageUrl = `${baseUrl}/storage/v1/object/public/proofs/${row.proof_path}`;
    }

    return {
      id: row.id,
      userId: row.user_id,
      questId: row.quest_id,
      questTitle: row.quest_title,
      questDescription: row.quest_description,
      questXp: row.quest_xp,
      questIcon: row.quest_icon,
      questStatus: row.quest_status,
      categoryId: row.category_id,
      categoryName: row.category_name,
      rewardRoleId: row.reward_role_id,
      rewardRoleName: row.reward_role_name,
      rewardRoleColor: row.reward_role_color,
      status: row.status,
      proofUrl: row.proof_url,
      proofUrls: normalizeProofUrls(row.proof_urls, row.proof_url),
      proofPath: row.proof_path,
      proofImageUrl,
      reviewNote: row.review_note,
      reviewedBy: row.reviewed_by,
      reviewerName: row.reviewer_name || (row.status !== "pending" ? "Admin" : null),
      reviewerImage: row.reviewer_image,
      reviewerRole: row.reviewer_role,
      reviewedAt: row.reviewed_at
        ? row.reviewed_at instanceof Date
          ? row.reviewed_at.toISOString()
          : String(row.reviewed_at)
        : null,
      submittedAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : String(row.updated_at),
    };
  });
}

export async function listAllQuests() {
  const { rows } = await query<Quest>(
    `SELECT ${QUEST_SELECT}
     ${QUEST_FROM}
     ORDER BY q."createdAt" DESC`,
  );
  return rows;
}

export async function listQuestCategories() {
  const { rows } = await query<QuestCategory>(
    `SELECT
       c.id,
       c.name,
       c.position,
       c."createdAt",
       c."updatedAt",
       COUNT(q.id)::int AS quest_count
     FROM public.quest_categories c
     LEFT JOIN public.quests q ON q.category_id = c.id
     GROUP BY c.id, c.name, c.position, c."createdAt", c."updatedAt"
     ORDER BY c.position ASC, c.name ASC`,
  );
  return rows;
}

export async function createQuestCategory(name: string) {
  const trimmed = name.trim();
  const { rows } = await query<QuestCategory>(
    `INSERT INTO public.quest_categories (name, position)
     VALUES (
       $1,
       COALESCE((SELECT MAX(position) + 1 FROM public.quest_categories), 1)
     )
     RETURNING id, name, position, "createdAt", "updatedAt"`,
    [trimmed],
  );
  return rows[0];
}

export async function updateQuestCategory(id: string, name: string) {
  const { rows } = await query<QuestCategory>(
    `UPDATE public.quest_categories
     SET name = $2, "updatedAt" = now()
     WHERE id = $1
     RETURNING id, name, position, "createdAt", "updatedAt"`,
    [id, name.trim()],
  );
  return rows[0] ?? null;
}

export async function getQuestCategoryById(
  id: string,
): Promise<QuestCategory | null> {
  const { rows } = await query<QuestCategory>(
    `SELECT id, name, position, "createdAt", "updatedAt"
     FROM public.quest_categories
     WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function deleteQuestCategory(id: string) {
  const { rows } = await query<{ id: string }>(
    `DELETE FROM public.quest_categories WHERE id = $1 RETURNING id`,
    [id],
  );
  return rows[0] ?? null;
}

export async function createQuest(input: {
  title: string;
  description: string;
  xpReward: number;
  icon?: string | null;
  categoryId?: string | null;
  rewardRoleId?: string | null;
  linkDescription?: string | null;
  linkCount?: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
}) {
  const linkCount = Math.min(8, Math.max(1, input.linkCount ?? 1));
  const { rows } = await query<Quest>(
    `INSERT INTO public.quests (
       title, description, xp_reward, icon, status, category_id, reward_role_id,
       link_description, link_count, starts_at, ends_at
     )
     VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9, $10)
     RETURNING ${QUEST_RETURNING}`,
    [
      input.title,
      input.description,
      input.xpReward,
      input.icon ?? null,
      input.categoryId ?? null,
      input.rewardRoleId ?? null,
      input.linkDescription ?? "",
      linkCount,
      input.startsAt ?? null,
      input.endsAt ?? null,
    ],
  );
  return rows[0];
}

export async function updateQuest(input: {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  icon?: string | null;
  status: "active" | "closed";
  categoryId?: string | null;
  rewardRoleId?: string | null;
  linkDescription?: string | null;
  linkCount?: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
}) {
  const linkCount = Math.min(8, Math.max(1, input.linkCount ?? 1));
  const { rows } = await query<Quest>(
    `UPDATE public.quests
     SET title = $2,
         description = $3,
         xp_reward = $4,
         icon = $5,
         status = $6,
         category_id = $7,
         reward_role_id = $8,
         link_description = $9,
         link_count = $10,
         starts_at = $11,
         ends_at = $12,
         "updatedAt" = now()
     WHERE id = $1
     RETURNING ${QUEST_RETURNING}`,
    [
      input.id,
      input.title,
      input.description,
      input.xpReward,
      input.icon ?? null,
      input.status,
      input.categoryId ?? null,
      input.rewardRoleId ?? null,
      input.linkDescription ?? "",
      linkCount,
      input.startsAt ?? null,
      input.endsAt ?? null,
    ],
  );
  return rows[0] ?? null;
}

export async function setQuestStatus(
  id: string,
  status: "active" | "closed",
) {
  const { rows } = await query<Quest>(
    `UPDATE public.quests
     SET status = $2, "updatedAt" = now()
     WHERE id = $1
     RETURNING id, title, description, xp_reward, icon, status, category_id, reward_role_id, "createdAt", "updatedAt"`,
    [id, status],
  );
  return rows[0] ?? null;
}

export async function deleteQuest(id: string) {
  const { rows } = await query<{ id: string }>(
    `DELETE FROM public.quests WHERE id = $1 RETURNING id`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listLeaderboard(limit = 50) {
  const { rows } = await query<LeaderboardRow>(
    `SELECT
       u.id,
       u.name,
       u.image,
       u."totalXp" AS "totalXp",
       u."discordId" AS "discordId",
       u.role,
       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'id', r.id,
               'name', r.name,
               'color', r.color,
               'xp_required', r.xp_required
             ) ORDER BY r.position ASC, r.xp_required ASC
           )
           FROM public.user_roles ur
           JOIN public.server_roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id
         ),
         '[]'::json
       ) AS roles
     FROM public."user" u
     WHERE COALESCE("totalXp", 0) > 0
     ORDER BY "totalXp" DESC NULLS LAST, name ASC
     LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function getUserLeaderboardRank(userId: string): Promise<number | null> {
  const { rows } = await query<{ rank: string }>(
    `SELECT sub.rank
     FROM (
       SELECT id, ROW_NUMBER() OVER (ORDER BY COALESCE("totalXp", 0) DESC NULLS LAST, name ASC) AS rank
       FROM public."user"
       WHERE COALESCE("totalXp", 0) > 0
     ) sub
     WHERE sub.id = $1`,
    [userId],
  );
  return rows[0] ? Number(rows[0].rank) : null;
}

/** Monthly rank from XP approved in the current calendar month (UTC). */
export async function getUserMonthlyLeaderboardRank(
  userId: string,
): Promise<number | null> {
  const { rows } = await query<{ rank: string }>(
    `SELECT sub.rank
     FROM (
       SELECT
         u.id,
         ROW_NUMBER() OVER (
           ORDER BY COALESCE(SUM(q.xp_reward), 0) DESC, u.name ASC
         ) AS rank
       FROM public."user" u
       INNER JOIN public.submissions s
         ON s.user_id = u.id AND s.status = 'approved'
       INNER JOIN public.quests q
         ON q.id = s.quest_id
       WHERE COALESCE(s.reviewed_at, s."updatedAt") >= date_trunc('month', timezone('utc', now()))
       GROUP BY u.id, u.name
       HAVING COALESCE(SUM(q.xp_reward), 0) > 0
     ) sub
     WHERE sub.id = $1`,
    [userId],
  );
  return rows[0] ? Number(rows[0].rank) : null;
}

/** XP earned from approvals in the current calendar month (UTC). */
export async function listMonthlyLeaderboard(limit = 50) {
  const { rows } = await query<LeaderboardRow>(
    `SELECT
       u.id,
       u.name,
       u.image,
       COALESCE(SUM(q.xp_reward), 0)::int AS "totalXp",
       u."discordId" AS "discordId",
       u.role,
       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'id', r.id,
               'name', r.name,
               'color', r.color,
               'xp_required', r.xp_required
             ) ORDER BY r.position ASC, r.xp_required ASC
           )
           FROM public.user_roles ur
           JOIN public.server_roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id
         ),
         '[]'::json
       ) AS roles
     FROM public."user" u
     INNER JOIN public.submissions s
       ON s.user_id = u.id AND s.status = 'approved'
     INNER JOIN public.quests q
       ON q.id = s.quest_id
     WHERE COALESCE(s.reviewed_at, s."updatedAt") >= date_trunc('month', timezone('utc', now()))
     GROUP BY u.id, u.name, u.image, u."discordId", u.role
     HAVING COALESCE(SUM(q.xp_reward), 0) > 0
     ORDER BY "totalXp" DESC, u.name ASC
     LIMIT $1`,
    [limit],
  );
  return rows;
}

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  totalXp: number;
  discordId: string | null;
  createdAt: Date;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  roles: ServerRoleSummary[];
};

export async function listManagedUsers() {
  const { rows } = await query<ManagedUser>(
    `SELECT
       u.id,
       u.name,
       u.email,
       u.image,
       COALESCE(u.role, 'ambassador') AS role,
       COALESCE(u."totalXp", 0)::int AS "totalXp",
       u."discordId" AS "discordId",
       u."createdAt",
       COALESCE(COUNT(s.id) FILTER (WHERE s.status = 'pending'), 0)::int AS "pendingCount",
       COALESCE(COUNT(s.id) FILTER (WHERE s.status = 'approved'), 0)::int AS "approvedCount",
       COALESCE(COUNT(s.id) FILTER (WHERE s.status = 'rejected'), 0)::int AS "rejectedCount",
       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'id', r.id,
               'name', r.name,
               'color', r.color,
               'xp_required', r.xp_required
             ) ORDER BY r.position ASC, r.xp_required ASC
           )
           FROM public.user_roles ur
           JOIN public.server_roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id
         ),
         '[]'::json
       ) AS roles
     FROM public."user" u
     LEFT JOIN public.submissions s ON s.user_id = u.id
     GROUP BY u.id, u.name, u.email, u.image, u.role, u."totalXp", u."discordId", u."createdAt"
     ORDER BY
       CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END,
       u.name ASC`,
  );
  return rows;
}

export async function getManagedUserById(userId: string): Promise<ManagedUser | null> {
  const { rows } = await query<ManagedUser>(
    `SELECT
       u.id,
       u.name,
       u.email,
       u.image,
       COALESCE(u.role, 'ambassador') AS role,
       COALESCE(u."totalXp", 0)::int AS "totalXp",
       u."discordId" AS "discordId",
       u."createdAt",
       COALESCE(COUNT(s.id) FILTER (WHERE s.status = 'pending'), 0)::int AS "pendingCount",
       COALESCE(COUNT(s.id) FILTER (WHERE s.status = 'approved'), 0)::int AS "approvedCount",
       COALESCE(COUNT(s.id) FILTER (WHERE s.status = 'rejected'), 0)::int AS "rejectedCount",
       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'id', r.id,
               'name', r.name,
               'color', r.color,
               'xp_required', r.xp_required
             ) ORDER BY r.position ASC, r.xp_required ASC
           )
           FROM public.user_roles ur
           JOIN public.server_roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id
         ),
         '[]'::json
       ) AS roles
     FROM public."user" u
     LEFT JOIN public.submissions s ON s.user_id = u.id
     WHERE u.id = $1
     GROUP BY u.id, u.name, u.email, u.image, u.role, u."totalXp", u."discordId", u."createdAt"`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function countAdmins() {
  const { rows } = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public."user" WHERE role = 'admin'`,
  );
  return rows[0]?.n ?? 0;
}

export async function getUserRole(userId: string) {
  const { rows } = await query<{ role: string; email: string }>(
    `SELECT COALESCE(role, 'ambassador') AS role, email
     FROM public."user"
     WHERE id = $1
     LIMIT 1`,
    [userId],
  );
  return rows[0]?.role ?? null;
}

export async function getUserIdentity(userId: string) {
  const { rows } = await query<{ id: string; role: string; email: string }>(
    `SELECT id, COALESCE(role, 'ambassador') AS role, email
     FROM public."user"
     WHERE id = $1
     LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function updateUserRole(input: {
  userId: string;
  role: "admin" | "ambassador";
}) {
  const { rows } = await query<{ id: string; role: string }>(
    `UPDATE public."user"
     SET role = $2, "updatedAt" = now()
     WHERE id = $1
       AND lower(email) <> 'ranasufyankhan12@gmail.com'
     RETURNING id, role`,
    [input.userId, input.role],
  );
  return rows[0] ?? null;
}

export async function deleteManagedUser(userId: string) {
  const { rows } = await query<{ id: string; role: string }>(
    `DELETE FROM public."user"
     WHERE id = $1
       AND lower(email) <> 'ranasufyankhan12@gmail.com'
     RETURNING id, COALESCE(role, 'ambassador') AS role`,
    [userId],
  );
  return rows[0] ?? null;
}

export type ServerRole = {
  id: string;
  name: string;
  description: string;
  xp_required: number;
  color: string;
  icon: string | null;
  position: number;
  discord_role_id?: string | null;
  member_count: number;
  quest_id?: string | null;
  quest_title?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function listServerRoles() {
  const { rows } = await query<ServerRole>(
    `SELECT
       r.id,
       r.name,
       r.description,
       r.xp_required,
       r.color,
       r.icon,
       r.position,
       r.discord_role_id,
       r."createdAt",
       r."updatedAt",
       COUNT(DISTINCT ur.id)::int AS member_count,
       (
         SELECT q.id FROM public.quests q
         WHERE q.reward_role_id = r.id
         ORDER BY q."createdAt" DESC
         LIMIT 1
       ) AS quest_id,
       (
         SELECT q.title FROM public.quests q
         WHERE q.reward_role_id = r.id
         ORDER BY q."createdAt" DESC
         LIMIT 1
       ) AS quest_title
     FROM public.server_roles r
     LEFT JOIN public.user_roles ur ON ur.role_id = r.id
     GROUP BY r.id, r.name, r.description, r.xp_required, r.color, r.icon, r.position, r.discord_role_id, r."createdAt", r."updatedAt"
     ORDER BY r.position ASC, r.xp_required ASC`,
  );
  return rows;
}

export async function createServerRole(input: {
  name: string;
  description?: string;
  xpRequired: number;
  color: string;
  icon?: string | null;
  questId?: string | null;
  discordRoleId?: string | null;
}) {
  const { rows } = await query<ServerRole>(
    `INSERT INTO public.server_roles (name, description, xp_required, color, icon, discord_role_id, position)
     VALUES (
       $1,
       $2,
       $3,
       $4,
       $5,
       $6,
       COALESCE((SELECT MAX(position) + 1 FROM public.server_roles), 1)
     )
     RETURNING id, name, description, xp_required, color, icon, position, discord_role_id, "createdAt", "updatedAt"`,
    [
      input.name,
      input.description ?? "",
      input.xpRequired,
      input.color,
      input.icon ?? null,
      input.discordRoleId?.trim() || null,
    ],
  );

  const role = rows[0];
  if (role) {
    // Automatically grant to all existing users whose XP qualifies
    if (role.xp_required > 0) {
      await query(
        `INSERT INTO public.user_roles (user_id, role_id, assigned_by)
         SELECT u.id, $1, NULL
         FROM public."user" u
         WHERE u."totalXp" >= $2
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [role.id, role.xp_required],
      );
    }

    // If a quest is attached, link it and backfill users who already had this quest approved
    if (input.questId) {
      await query(
        `UPDATE public.quests
         SET reward_role_id = $1, "updatedAt" = now()
         WHERE id = $2`,
        [role.id, input.questId],
      );

      await query(
        `INSERT INTO public.user_roles (user_id, role_id, assigned_by)
         SELECT s.user_id, $1, NULL
         FROM public.submissions s
         WHERE s.quest_id = $2 AND s.status = 'approved'
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [role.id, input.questId],
      );
    }
  }
  return role;
}

export async function updateServerRole(input: {
  id: string;
  name: string;
  description?: string;
  xpRequired: number;
  color: string;
  icon?: string | null;
  questId?: string | null;
  discordRoleId?: string | null;
}) {
  const { rows } = await query<ServerRole>(
    `UPDATE public.server_roles
     SET name = $2,
         description = $3,
         xp_required = $4,
         color = $5,
         icon = $6,
         discord_role_id = $7,
         "updatedAt" = now()
     WHERE id = $1
     RETURNING id, name, description, xp_required, color, icon, position, discord_role_id, "createdAt", "updatedAt"`,
    [
      input.id,
      input.name,
      input.description ?? "",
      input.xpRequired,
      input.color,
      input.icon ?? null,
      input.discordRoleId !== undefined ? (input.discordRoleId?.trim() || null) : null,
    ],
  );

  const role = rows[0];
  if (role) {
    // Backfill any users newly qualifying for this role by XP
    if (role.xp_required > 0) {
      await query(
        `INSERT INTO public.user_roles (user_id, role_id, assigned_by)
         SELECT u.id, $1, NULL
         FROM public."user" u
         WHERE u."totalXp" >= $2
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [role.id, role.xp_required],
      );
    }

    if (input.questId !== undefined) {
      if (input.questId) {
        // Detach this role from any other quest
        await query(
          `UPDATE public.quests
           SET reward_role_id = NULL, "updatedAt" = now()
           WHERE reward_role_id = $1 AND id != $2`,
          [role.id, input.questId],
        );

        // Attach to the chosen quest
        await query(
          `UPDATE public.quests
           SET reward_role_id = $1, "updatedAt" = now()
           WHERE id = $2`,
          [role.id, input.questId],
        );

        // Backfill users with approved submissions for this quest
        await query(
          `INSERT INTO public.user_roles (user_id, role_id, assigned_by)
           SELECT s.user_id, $1, NULL
           FROM public.submissions s
           WHERE s.quest_id = $2 AND s.status = 'approved'
           ON CONFLICT (user_id, role_id) DO NOTHING`,
          [role.id, input.questId],
        );
      } else {
        // None selected: detach any quest that had this role
        await query(
          `UPDATE public.quests
           SET reward_role_id = NULL, "updatedAt" = now()
           WHERE reward_role_id = $1`,
          [role.id],
        );
      }
    }
  }
  return role ?? null;
}

export async function deleteServerRole(id: string) {
  const { rows } = await query<ServerRole>(
    `DELETE FROM public.server_roles
     WHERE id = $1
     RETURNING id, name, description, xp_required, color, icon, position, "createdAt", "updatedAt"`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listRolesForUser(userId: string) {
  const { rows } = await query<ServerRoleSummary>(
    `SELECT r.id, r.name, r.color, r.xp_required
     FROM public.user_roles ur
     JOIN public.server_roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
     ORDER BY r.position ASC, r.xp_required ASC`,
    [userId],
  );
  return rows;
}

export async function assignRoleToUser(
  userId: string,
  roleId: string,
  assignedBy?: string,
) {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO public.user_roles (user_id, role_id, assigned_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, role_id) DO NOTHING
     RETURNING id`,
    [userId, roleId, assignedBy ?? null],
  );
  return Boolean(rows[0]);
}

export async function removeRoleFromUser(userId: string, roleId: string) {
  const { rows } = await query<{ id: string }>(
    `DELETE FROM public.user_roles
     WHERE user_id = $1 AND role_id = $2
     RETURNING id`,
    [userId, roleId],
  );
  return Boolean(rows[0]);
}

/**
 * Ensures user has all server roles they have unlocked by reaching required XP.
 */
export async function syncUserXpRoles(userId: string) {
  await query(
    `INSERT INTO public.user_roles (user_id, role_id, assigned_by)
     SELECT $1, r.id, NULL
     FROM public.server_roles r
     WHERE r.xp_required <= (
       SELECT COALESCE("totalXp", 0) FROM public."user" WHERE id = $1
     )
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [userId],
  );
}

export async function getServerRoleById(roleId: string): Promise<ServerRole | null> {
  const { rows } = await query<ServerRole>(
    `SELECT
       r.id,
       r.name,
       r.description,
       r.xp_required,
       r.color,
       r.icon,
       r.position,
       r.discord_role_id,
       r."createdAt",
       r."updatedAt",
       COUNT(DISTINCT ur.id)::int AS member_count
     FROM public.server_roles r
     LEFT JOIN public.user_roles ur ON ur.role_id = r.id
     WHERE r.id = $1
     GROUP BY r.id, r.name, r.description, r.xp_required, r.color, r.icon, r.position, r.discord_role_id, r."createdAt", r."updatedAt"`,
    [roleId],
  );
  return rows[0] ?? null;
}

export async function getUserById(userId: string): Promise<{
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  totalXp: number;
  discordId: string | null;
} | null> {
  const { rows } = await query<{
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: string;
    totalXp: number;
    discordId: string | null;
  }>(
    `SELECT
       id,
       name,
       email,
       image,
       role,
       COALESCE("totalXp", 0)::int AS "totalXp",
       "discordId" AS "discordId"
     FROM public."user"
     WHERE id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function getUserDiscordId(userId: string): Promise<string | null> {
  const { rows } = await query<{ discordId: string | null }>(
    `SELECT "discordId" FROM public."user" WHERE id = $1`,
    [userId],
  );
  return rows[0]?.discordId ?? null;
}

export async function getUserAssignedServerRoles(userId: string) {
  const { rows } = await query<{
    id: string;
    name: string;
    color: string;
    xp_required: number;
    discord_role_id: string | null;
  }>(
    `SELECT r.id, r.name, r.color, r.xp_required, r.discord_role_id
     FROM public.user_roles ur
     JOIN public.server_roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
     ORDER BY r.position ASC, r.xp_required ASC`,
    [userId],
  );
  return rows;
}

export async function listAllUsersWithDiscord() {
  const { rows } = await query<{
    id: string;
    name: string;
    discordId: string;
    roles: Array<{ id: string; name: string; discord_role_id: string | null }>;
  }>(
    `SELECT
       u.id,
       u.name,
       u."discordId" AS "discordId",
       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'id', r.id,
               'name', r.name,
               'discord_role_id', r.discord_role_id
             )
           )
           FROM public.user_roles ur
           JOIN public.server_roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id
         ),
         '[]'::json
       ) AS roles
     FROM public."user" u
     WHERE u."discordId" IS NOT NULL
     ORDER BY u.name ASC`,
  );
  return rows;
}

export async function setServerRoleDiscordId(
  roleId: string,
  discordRoleId: string,
) {
  await query(
    `UPDATE public.server_roles
     SET discord_role_id = $2, "updatedAt" = now()
     WHERE id = $1`,
    [roleId, discordRoleId],
  );
}
