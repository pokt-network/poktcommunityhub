import type { SubmissionStatus } from '@community/core';

import type { Pool } from './pool.js';

/** The reads behind the ambassador pages (flows 2, 3, 5 and 7). */

export type Category = { id: string; name: string };

export async function listCategories(pool: Pool): Promise<Category[]> {
  const { rows } = await pool.query<Category>(
    'SELECT id, name FROM quest_categories ORDER BY position, name',
  );
  return rows;
}

export type BoardFilter = {
  categoryId?: string | undefined;
  /** The viewer's progress. Ignored when signed out: there is none. */
  progress?: 'not_started' | SubmissionStatus | undefined;
  sort?: 'newest' | 'ending' | undefined;
};

export type BoardQuest = {
  id: string;
  title: string;
  icon: string | null;
  xpReward: number;
  category: Category | null;
  endsAt: Date | null;
  viewerStatus: SubmissionStatus | null;
};

/**
 * Flow 2: the live quests. Live means active with `now` inside the half-open
 * window [starts_at, ends_at), the same rule as core's questPhase.
 */
export async function questBoard(
  pool: Pool,
  input: { viewerId: string | null; filter?: BoardFilter; now?: Date },
): Promise<BoardQuest[]> {
  const filter = input.filter ?? {};
  const progress = input.viewerId === null ? undefined : filter.progress;
  const order =
    filter.sort === 'ending' ? 'q.ends_at ASC NULLS LAST, q.created_at DESC' : 'q.created_at DESC';

  const { rows } = await pool.query<{
    id: string;
    title: string;
    icon: string | null;
    xp_reward: number;
    category_id: string | null;
    category_name: string | null;
    ends_at: Date | null;
    viewer_status: SubmissionStatus | null;
  }>(
    `SELECT q.id, q.title, q.icon, q.xp_reward, c.id AS category_id, c.name AS category_name,
            q.ends_at, s.status AS viewer_status
       FROM quests q
       LEFT JOIN quest_categories c ON c.id = q.category_id
       LEFT JOIN submissions s ON s.quest_id = q.id AND s.user_id = $1
      WHERE q.status = 'active'
        AND (q.starts_at IS NULL OR q.starts_at <= $2)
        AND (q.ends_at IS NULL OR q.ends_at > $2)
        AND ($3::uuid IS NULL OR q.category_id = $3)
        AND ($4::text IS NULL
             OR ($4 = 'not_started' AND s.id IS NULL)
             OR s.status = $4)
      ORDER BY ${order}, q.id`,
    [input.viewerId, input.now ?? new Date(), filter.categoryId ?? null, progress ?? null],
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    icon: row.icon,
    xpReward: row.xp_reward,
    category:
      row.category_id === null ? null : { id: row.category_id, name: row.category_name ?? '' },
    endsAt: row.ends_at,
    viewerStatus: row.viewer_status,
  }));
}

export type ViewerSubmission = {
  id: string;
  status: SubmissionStatus;
  proofUrls: string[];
  hasFile: boolean;
  reviewNote: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
};

export type QuestDetail = {
  id: string;
  title: string;
  descriptionMd: string;
  icon: string | null;
  xpReward: number;
  status: 'active' | 'closed';
  startsAt: Date | null;
  endsAt: Date | null;
  linkCount: number;
  linkHint: string | null;
  category: Category | null;
  rewardRole: { name: string; color: string | null } | null;
  /** The viewer's own submission, with its review note. Never anyone else's. */
  submission: ViewerSubmission | null;
};

/** Flow 3: one quest, live or not (history links to ended ones), and the viewer's submission. */
export async function questDetail(
  pool: Pool,
  input: { questId: string; viewerId: string | null },
): Promise<QuestDetail | null> {
  const quest = await pool.query<{
    id: string;
    title: string;
    description_md: string;
    icon: string | null;
    xp_reward: number;
    status: 'active' | 'closed';
    starts_at: Date | null;
    ends_at: Date | null;
    link_count: number;
    link_hint: string | null;
    category_id: string | null;
    category_name: string | null;
    role_name: string | null;
    role_color: string | null;
  }>(
    `SELECT q.id, q.title, q.description_md, q.icon, q.xp_reward, q.status, q.starts_at,
            q.ends_at, q.link_count, q.link_hint, c.id AS category_id, c.name AS category_name,
            r.name AS role_name, r.color AS role_color
       FROM quests q
       LEFT JOIN quest_categories c ON c.id = q.category_id
       LEFT JOIN server_roles r ON r.id = q.reward_role_id
      WHERE q.id = $1`,
    [input.questId],
  );
  const q = quest.rows[0];
  if (q === undefined) return null;

  let submission: ViewerSubmission | null = null;
  if (input.viewerId !== null) {
    const { rows } = await pool.query<SubmissionRow>(
      `${SUBMISSION_COLUMNS} WHERE s.user_id = $1 AND s.quest_id = $2`,
      [input.viewerId, input.questId],
    );
    submission = rows[0] === undefined ? null : toSubmission(rows[0]);
  }

  return {
    id: q.id,
    title: q.title,
    descriptionMd: q.description_md,
    icon: q.icon,
    xpReward: q.xp_reward,
    status: q.status,
    startsAt: q.starts_at,
    endsAt: q.ends_at,
    linkCount: q.link_count,
    linkHint: q.link_hint,
    category: q.category_id === null ? null : { id: q.category_id, name: q.category_name ?? '' },
    rewardRole: q.role_name === null ? null : { name: q.role_name, color: q.role_color },
    submission,
  };
}

const SUBMISSION_COLUMNS = `
  SELECT s.id, s.status, s.proof_urls, s.proof_file IS NOT NULL AS has_file, s.review_note,
         s.updated_at, s.reviewed_at
    FROM submissions s`;

type SubmissionRow = {
  id: string;
  status: SubmissionStatus;
  proof_urls: string[];
  has_file: boolean;
  review_note: string | null;
  updated_at: Date;
  reviewed_at: Date | null;
};

const toSubmission = (row: SubmissionRow): ViewerSubmission => ({
  id: row.id,
  status: row.status,
  proofUrls: row.proof_urls,
  hasFile: row.has_file,
  reviewNote: row.review_note,
  submittedAt: row.updated_at,
  reviewedAt: row.reviewed_at,
});

export type HistoryEntry = ViewerSubmission & {
  questId: string;
  questTitle: string;
  /** Net XP this submission holds in the ledger: its award less any undo. */
  xp: number;
};

/** Flow 5: every submission the user has made, newest activity first. Owner only. */
export async function submissionHistory(pool: Pool, userId: string): Promise<HistoryEntry[]> {
  const { rows } = await pool.query<
    SubmissionRow & { quest_id: string; title: string; xp: string }
  >(
    `SELECT s.id, s.status, s.proof_urls, s.proof_file IS NOT NULL AS has_file, s.review_note,
            s.updated_at, s.reviewed_at, q.id AS quest_id, q.title,
            coalesce((SELECT sum(delta) FROM xp_events e WHERE e.submission_id = s.id), 0) AS xp
       FROM submissions s JOIN quests q ON q.id = s.quest_id
      WHERE s.user_id = $1
      ORDER BY s.updated_at DESC, s.id`,
    [userId],
  );
  return rows.map((row) => ({
    ...toSubmission(row),
    questId: row.quest_id,
    questTitle: row.title,
    xp: Number(row.xp),
  }));
}

export type Profile = {
  id: string;
  name: string;
  avatarUrl: string | null;
  joinedAt: Date;
  xp: number;
  roles: { name: string; color: string | null; icon: string | null }[];
  completed: { questId: string; title: string; xp: number; approvedAt: Date }[];
};

/**
 * Flow 7: what members may see of each other (brief section 12, item 2): XP,
 * ranks held and completed quests. Nothing pending, rejected or reviewed-with-a-note.
 */
export async function profile(pool: Pool, userId: string): Promise<Profile | null> {
  const user = await pool.query<{
    id: string;
    name: string;
    avatar_url: string | null;
    created_at: Date;
    xp: string;
  }>(
    `SELECT u.id, u.name, u.avatar_url, u.created_at,
            coalesce((SELECT sum(delta) FROM xp_events e WHERE e.user_id = u.id), 0) AS xp
       FROM users u WHERE u.id = $1`,
    [userId],
  );
  const u = user.rows[0];
  if (u === undefined) return null;

  const [roles, completed] = await Promise.all([
    pool.query<{ name: string; color: string | null; icon: string | null }>(
      `SELECT r.name, r.color, r.icon
         FROM user_roles ur JOIN server_roles r ON r.id = ur.role_id
        WHERE ur.user_id = $1
        ORDER BY r.position, r.name`,
      [userId],
    ),
    pool.query<{ quest_id: string; title: string; xp_reward: number; reviewed_at: Date }>(
      `SELECT q.id AS quest_id, q.title, q.xp_reward, s.reviewed_at
         FROM submissions s JOIN quests q ON q.id = s.quest_id
        WHERE s.user_id = $1 AND s.status = 'approved'
        ORDER BY s.reviewed_at DESC, q.id`,
      [userId],
    ),
  ]);

  return {
    id: u.id,
    name: u.name,
    avatarUrl: u.avatar_url,
    joinedAt: u.created_at,
    xp: Number(u.xp),
    roles: roles.rows,
    completed: completed.rows.map((row) => ({
      questId: row.quest_id,
      title: row.title,
      xp: row.xp_reward,
      approvedAt: row.reviewed_at,
    })),
  };
}

/** Who owns a submission's proof file, and where it is. For the authenticated file route. */
export async function proofFile(
  pool: Pool,
  submissionId: string,
): Promise<{ userId: string; file: string } | null> {
  const { rows } = await pool.query<{ user_id: string; proof_file: string | null }>(
    'SELECT user_id, proof_file FROM submissions WHERE id = $1',
    [submissionId],
  );
  const row = rows[0];
  if (row === undefined || row.proof_file === null) return null;
  return { userId: row.user_id, file: row.proof_file };
}
