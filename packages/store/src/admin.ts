import {
  planRoleChange,
  planUserDeletion,
  type QuestInput,
  type RankInput,
  type StaffRefusal,
  type SubmissionStatus,
  type UserRole,
} from '@community/core';
import type pg from 'pg';

import type { Pool } from './pool.js';
import { enqueue, reconcileRoles } from './roles.js';
import { rollback, withTransaction, type Client } from './tx.js';

/**
 * The admin console's reads and writes (flows 8 to 12). Validation of what an
 * admin typed is core's (catalog.ts); who may do what to whom is core's too
 * (users.ts). These functions apply it, one transaction per change.
 *
 * Every function here is called only behind requireAdmin() in the web app; the
 * owner-only rules are enforced again here, from the database's own idea of
 * the actor's role, not from anything the caller passes in.
 */

// ── Shared ───────────────────────────────────────────────────────────────────

const pgCode = (error: unknown): string | undefined =>
  (error as pg.DatabaseError | undefined)?.code;
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

/** Lock users in id order, so two multi-user changes cannot deadlock each other. */
async function lockUsers(client: Client, userIds: readonly string[]): Promise<void> {
  if (userIds.length === 0) return;
  await client.query('SELECT 1 FROM users WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [
    userIds,
  ]);
}

/**
 * Bring every listed user's derived ranks in line, each in its own short
 * transaction under that user's lock (the same lock a review takes).
 */
async function reconcileUsers(
  pool: Pool,
  userIds: readonly string[],
  actorId: string,
): Promise<void> {
  for (const userId of userIds) {
    await withTransaction(pool, async (client) => {
      await lockUsers(client, [userId]);
      await reconcileRoles(client, userId, actorId);
    });
  }
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export type AdminCounts = { pending: number; liveQuests: number; users: number };

export async function adminCounts(pool: Pool, now = new Date()): Promise<AdminCounts> {
  const { rows } = await pool.query<{ pending: number; live: number; users: number }>(
    `SELECT (SELECT count(*)::int FROM submissions WHERE status = 'pending') AS pending,
            (SELECT count(*)::int FROM quests
              WHERE status = 'active'
                AND (starts_at IS NULL OR starts_at <= $1)
                AND (ends_at IS NULL OR ends_at > $1)) AS live,
            (SELECT count(*)::int FROM users) AS users`,
    [now],
  );
  const row = rows[0]!;
  return { pending: row.pending, liveQuests: row.live, users: row.users };
}

// ── Review (flow 8) ──────────────────────────────────────────────────────────

export type QueueItem = {
  id: string;
  status: SubmissionStatus;
  proofUrls: string[];
  hasFile: boolean;
  reviewNote: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewerName: string | null;
  user: { id: string; name: string; avatarUrl: string | null };
  quest: { id: string; title: string; xpReward: number; linkHint: string | null };
};

/** Pending oldest first (first come, first reviewed); reviewed ones newest first. */
export async function reviewQueue(
  pool: Pool,
  input: { status: SubmissionStatus; limit?: number },
): Promise<QueueItem[]> {
  const order = input.status === 'pending' ? 's.updated_at ASC' : 's.reviewed_at DESC';
  const { rows } = await pool.query<{
    id: string;
    status: SubmissionStatus;
    proof_urls: string[];
    has_file: boolean;
    review_note: string | null;
    updated_at: Date;
    reviewed_at: Date | null;
    reviewer_name: string | null;
    user_id: string;
    user_name: string;
    avatar_url: string | null;
    quest_id: string;
    title: string;
    xp_reward: number;
    link_hint: string | null;
  }>(
    `SELECT s.id, s.status, s.proof_urls, s.proof_file IS NOT NULL AS has_file, s.review_note,
            s.updated_at, s.reviewed_at, r.name AS reviewer_name,
            u.id AS user_id, u.name AS user_name, u.avatar_url,
            q.id AS quest_id, q.title, q.xp_reward, q.link_hint
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       JOIN quests q ON q.id = s.quest_id
       LEFT JOIN users r ON r.id = s.reviewed_by
      WHERE s.status = $1
      ORDER BY ${order}, s.id
      LIMIT $2`,
    [input.status, input.limit ?? 100],
  );
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    proofUrls: row.proof_urls,
    hasFile: row.has_file,
    reviewNote: row.review_note,
    submittedAt: row.updated_at,
    reviewedAt: row.reviewed_at,
    reviewerName: row.reviewer_name,
    user: { id: row.user_id, name: row.user_name, avatarUrl: row.avatar_url },
    quest: { id: row.quest_id, title: row.title, xpReward: row.xp_reward, linkHint: row.link_hint },
  }));
}

// ── Quests (flow 9) ──────────────────────────────────────────────────────────

export type AdminQuest = {
  id: string;
  title: string;
  icon: string | null;
  xpReward: number;
  status: 'active' | 'closed';
  startsAt: Date | null;
  endsAt: Date | null;
  categoryName: string | null;
  submissions: number;
  pending: number;
};

export async function adminQuests(pool: Pool): Promise<AdminQuest[]> {
  const { rows } = await pool.query<{
    id: string;
    title: string;
    icon: string | null;
    xp_reward: number;
    status: 'active' | 'closed';
    starts_at: Date | null;
    ends_at: Date | null;
    category_name: string | null;
    submissions: number;
    pending: number;
  }>(
    `SELECT q.id, q.title, q.icon, q.xp_reward, q.status, q.starts_at, q.ends_at,
            c.name AS category_name,
            (SELECT count(*)::int FROM submissions s WHERE s.quest_id = q.id) AS submissions,
            (SELECT count(*)::int FROM submissions s
              WHERE s.quest_id = q.id AND s.status = 'pending') AS pending
       FROM quests q LEFT JOIN quest_categories c ON c.id = q.category_id
      ORDER BY q.status, q.created_at DESC, q.id`,
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    icon: row.icon,
    xpReward: row.xp_reward,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    categoryName: row.category_name,
    submissions: row.submissions,
    pending: row.pending,
  }));
}

export type EditableQuest = QuestInput & { id: string; status: 'active' | 'closed' };

export async function questForEdit(pool: Pool, id: string): Promise<EditableQuest | null> {
  const { rows } = await pool.query<{
    id: string;
    status: 'active' | 'closed';
    title: string;
    description_md: string;
    xp_reward: number;
    icon: string | null;
    category_id: string | null;
    link_count: number;
    link_hint: string | null;
    starts_at: Date | null;
    ends_at: Date | null;
    reward_role_id: string | null;
  }>(
    `SELECT id, status, title, description_md, xp_reward, icon, category_id, link_count,
            link_hint, starts_at, ends_at, reward_role_id
       FROM quests WHERE id = $1`,
    [id],
  );
  const q = rows[0];
  if (q === undefined) return null;
  return {
    id: q.id,
    status: q.status,
    title: q.title,
    descriptionMd: q.description_md,
    xpReward: q.xp_reward,
    icon: q.icon ?? '',
    categoryId: q.category_id,
    linkCount: q.link_count,
    linkHint: q.link_hint,
    startsAt: q.starts_at,
    endsAt: q.ends_at,
    rewardRoleId: q.reward_role_id,
  };
}

export type CatalogRefusal = 'not_found' | 'invalid_reference' | 'duplicate' | 'in_use';
export type CatalogResult<T = null> =
  { ok: true; value: T } | { ok: false; reason: CatalogRefusal };

const QUEST_VALUES = (q: QuestInput) => [
  q.title,
  q.descriptionMd,
  q.xpReward,
  q.icon,
  q.categoryId,
  q.linkCount,
  q.linkHint,
  q.startsAt,
  q.endsAt,
  q.rewardRoleId,
];

/** Create a quest from checked input (core checkQuest). */
export async function createQuest(
  pool: Pool,
  input: { quest: QuestInput; actorId: string },
): Promise<CatalogResult<string>> {
  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO quests (title, description_md, xp_reward, icon, category_id, link_count,
                           link_hint, starts_at, ends_at, reward_role_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [...QUEST_VALUES(input.quest), input.actorId],
    );
    return { ok: true, value: rows[0]!.id };
  } catch (error) {
    if (pgCode(error) === FOREIGN_KEY_VIOLATION) return { ok: false, reason: 'invalid_reference' };
    throw error;
  }
}

/**
 * Edit a quest. Its XP applies to future approvals only: the ledger keeps what
 * was awarded. A changed reward role rechecks everyone with an approved
 * submission for it (section 13.4): they gain the new role and lose the old one
 * unless something else still grants it.
 */
export async function updateQuest(
  pool: Pool,
  input: { id: string; quest: QuestInput; actorId: string },
): Promise<CatalogResult> {
  let affected: string[] = [];
  try {
    const result = await withTransaction<CatalogResult>(pool, async (client) => {
      const before = await client.query<{ reward_role_id: string | null }>(
        'SELECT reward_role_id FROM quests WHERE id = $1 FOR UPDATE',
        [input.id],
      );
      if (before.rows[0] === undefined)
        return rollback({ ok: false, reason: 'not_found' } as const);
      await client.query(
        `UPDATE quests
            SET title = $2, description_md = $3, xp_reward = $4, icon = $5, category_id = $6,
                link_count = $7, link_hint = $8, starts_at = $9, ends_at = $10,
                reward_role_id = $11, updated_at = now()
          WHERE id = $1`,
        [input.id, ...QUEST_VALUES(input.quest)],
      );
      if (before.rows[0].reward_role_id !== input.quest.rewardRoleId) {
        const approved = await client.query<{ user_id: string }>(
          `SELECT DISTINCT user_id FROM submissions WHERE quest_id = $1 AND status = 'approved'`,
          [input.id],
        );
        affected = approved.rows.map((row) => row.user_id);
      }
      return { ok: true, value: null };
    });
    if (result.ok) await reconcileUsers(pool, affected, input.actorId);
    return result;
  } catch (error) {
    if (pgCode(error) === FOREIGN_KEY_VIOLATION) return { ok: false, reason: 'invalid_reference' };
    throw error;
  }
}

export async function setQuestStatus(
  pool: Pool,
  input: { id: string; status: 'active' | 'closed' },
): Promise<CatalogResult> {
  const { rowCount } = await pool.query(
    'UPDATE quests SET status = $2, updated_at = now() WHERE id = $1',
    [input.id, input.status],
  );
  return rowCount === 1 ? { ok: true, value: null } : { ok: false, reason: 'not_found' };
}

/**
 * Delete a quest nobody has submitted to. One with submissions holds awarded XP
 * and its audit trail, so it is closed instead (section 10.2); the database
 * refuses too (ON DELETE RESTRICT).
 */
export async function deleteQuest(pool: Pool, id: string): Promise<CatalogResult> {
  try {
    const { rowCount } = await pool.query('DELETE FROM quests WHERE id = $1', [id]);
    return rowCount === 1 ? { ok: true, value: null } : { ok: false, reason: 'not_found' };
  } catch (error) {
    if (pgCode(error) === FOREIGN_KEY_VIOLATION) return { ok: false, reason: 'in_use' };
    throw error;
  }
}

// ── Ordering (categories and ranks) ──────────────────────────────────────────

/**
 * Move a row one place up or down in its table's `position` order. Positions
 * are renumbered 0..n first, so ties left by earlier inserts cannot stall a move.
 */
async function move(
  pool: Pool,
  table: 'quest_categories' | 'server_roles',
  id: string,
  direction: 'up' | 'down',
): Promise<CatalogResult> {
  return withTransaction<CatalogResult>(pool, async (client) => {
    // The whole table, locked: two moves at once would otherwise renumber from stale positions.
    await client.query(`LOCK TABLE ${table} IN SHARE ROW EXCLUSIVE MODE`);
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM ${table} ORDER BY position, name, id`,
    );
    const ids = rows.map((row) => row.id);
    const at = ids.indexOf(id);
    if (at === -1) return rollback({ ok: false, reason: 'not_found' } as const);
    const to = direction === 'up' ? at - 1 : at + 1;
    if (to >= 0 && to < ids.length) [ids[at], ids[to]] = [ids[to]!, ids[at]!];
    await client.query(
      `UPDATE ${table} t SET position = o.position - 1
         FROM unnest($1::uuid[]) WITH ORDINALITY AS o(id, position)
        WHERE t.id = o.id`,
      [ids],
    );
    return { ok: true, value: null };
  });
}

// ── Categories (flow 10) ─────────────────────────────────────────────────────

export type AdminCategory = { id: string; name: string; quests: number };

export async function adminCategories(pool: Pool): Promise<AdminCategory[]> {
  const { rows } = await pool.query<AdminCategory>(
    `SELECT c.id, c.name, (SELECT count(*)::int FROM quests q WHERE q.category_id = c.id) AS quests
       FROM quest_categories c ORDER BY c.position, c.name, c.id`,
  );
  return rows;
}

export async function createCategory(pool: Pool, name: string): Promise<CatalogResult<string>> {
  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO quest_categories (name, position)
       VALUES ($1, (SELECT coalesce(max(position) + 1, 0) FROM quest_categories))
       RETURNING id`,
      [name],
    );
    return { ok: true, value: rows[0]!.id };
  } catch (error) {
    if (pgCode(error) === UNIQUE_VIOLATION) return { ok: false, reason: 'duplicate' };
    throw error;
  }
}

export async function renameCategory(
  pool: Pool,
  input: { id: string; name: string },
): Promise<CatalogResult> {
  try {
    const { rowCount } = await pool.query('UPDATE quest_categories SET name = $2 WHERE id = $1', [
      input.id,
      input.name,
    ]);
    return rowCount === 1 ? { ok: true, value: null } : { ok: false, reason: 'not_found' };
  } catch (error) {
    if (pgCode(error) === UNIQUE_VIOLATION) return { ok: false, reason: 'duplicate' };
    throw error;
  }
}

export const moveCategory = (pool: Pool, id: string, direction: 'up' | 'down') =>
  move(pool, 'quest_categories', id, direction);

/** Its quests become uncategorised (ON DELETE SET NULL); nothing else is lost. */
export async function deleteCategory(pool: Pool, id: string): Promise<CatalogResult> {
  const { rowCount } = await pool.query('DELETE FROM quest_categories WHERE id = $1', [id]);
  return rowCount === 1 ? { ok: true, value: null } : { ok: false, reason: 'not_found' };
}

// ── Ranks (flow 11) ──────────────────────────────────────────────────────────

export type AdminRank = RankInput & { id: string; holders: number };

export async function adminRanks(pool: Pool): Promise<AdminRank[]> {
  const { rows } = await pool.query<{
    id: string;
    name: string;
    description: string;
    color: string | null;
    icon: string | null;
    xp_required: number | null;
    discord_role_id: string | null;
    holders: number;
  }>(
    `SELECT r.id, r.name, r.description, r.color, r.icon, r.xp_required, r.discord_role_id,
            (SELECT count(*)::int FROM user_roles ur WHERE ur.role_id = r.id) AS holders
       FROM server_roles r ORDER BY r.position, r.name, r.id`,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    icon: row.icon,
    xpRequired: row.xp_required,
    discordRoleId: row.discord_role_id,
    holders: row.holders,
  }));
}

const RANK_VALUES = (r: RankInput) => [
  r.name,
  r.description,
  r.color,
  r.icon,
  r.xpRequired,
  r.discordRoleId,
];

/** Everyone who could gain or lose a rank by XP: anyone with ledger rows or a derived rank. */
async function xpCandidates(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM xp_events
     UNION SELECT user_id FROM user_roles WHERE source = 'xp'`,
  );
  return rows.map((row) => row.user_id);
}

/** A new rank with a threshold is granted at once to everyone who already meets it. */
export async function createRank(
  pool: Pool,
  input: { rank: RankInput; actorId: string },
): Promise<CatalogResult<string>> {
  let id: string;
  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO server_roles (name, description, color, icon, xp_required, discord_role_id,
                                 position)
       VALUES ($1, $2, $3, $4, $5, $6, (SELECT coalesce(max(position) + 1, 0) FROM server_roles))
       RETURNING id`,
      RANK_VALUES(input.rank),
    );
    id = rows[0]!.id;
  } catch (error) {
    if (pgCode(error) === UNIQUE_VIOLATION) return { ok: false, reason: 'duplicate' };
    throw error;
  }
  if (input.rank.xpRequired !== null) {
    await reconcileUsers(pool, await xpCandidates(pool), input.actorId);
  }
  return { ok: true, value: id };
}

/** A changed threshold rechecks everyone (section 13.4); hand-assigned holders keep it. */
export async function updateRank(
  pool: Pool,
  input: { id: string; rank: RankInput; actorId: string },
): Promise<CatalogResult> {
  let thresholdChanged = false;
  try {
    const result = await withTransaction<CatalogResult>(pool, async (client) => {
      const before = await client.query<{
        xp_required: number | null;
        discord_role_id: string | null;
      }>('SELECT xp_required, discord_role_id FROM server_roles WHERE id = $1 FOR UPDATE', [
        input.id,
      ]);
      const prior = before.rows[0];
      if (prior === undefined) return rollback({ ok: false, reason: 'not_found' } as const);
      await client.query(
        `UPDATE server_roles
            SET name = $2, description = $3, color = $4, icon = $5, xp_required = $6,
                discord_role_id = $7
          WHERE id = $1`,
        [input.id, ...RANK_VALUES(input.rank)],
      );
      thresholdChanged = prior.xp_required !== input.rank.xpRequired;
      if (prior.discord_role_id !== input.rank.discordRoleId) {
        // The rank now maps to another Discord role: every holder needs a sync.
        const holders = await client.query<{ user_id: string }>(
          'SELECT user_id FROM user_roles WHERE role_id = $1',
          [input.id],
        );
        for (const { user_id } of holders.rows) {
          await enqueue(client, 'sync_member_roles', { userId: user_id });
        }
      }
      return { ok: true, value: null };
    });
    if (result.ok && thresholdChanged) {
      await reconcileUsers(pool, await xpCandidates(pool), input.actorId);
    }
    return result;
  } catch (error) {
    if (pgCode(error) === UNIQUE_VIOLATION) return { ok: false, reason: 'duplicate' };
    throw error;
  }
}

export const moveRank = (pool: Pool, id: string, direction: 'up' | 'down') =>
  move(pool, 'server_roles', id, direction);

/**
 * Delete a rank, held or not (section 13.5): it leaves every holder, each gets
 * a Discord sync, and quests that rewarded it reward nothing (SET NULL).
 * Returns how many held it.
 */
export async function deleteRank(pool: Pool, id: string): Promise<CatalogResult<number>> {
  return withTransaction<CatalogResult<number>>(pool, async (client) => {
    const holders = await client.query<{ user_id: string }>(
      'SELECT user_id FROM user_roles WHERE role_id = $1',
      [id],
    );
    const { rowCount } = await client.query('DELETE FROM server_roles WHERE id = $1', [id]);
    if (rowCount !== 1) return rollback({ ok: false, reason: 'not_found' } as const);
    for (const { user_id } of holders.rows) {
      await enqueue(client, 'sync_member_roles', { userId: user_id });
    }
    return { ok: true, value: holders.rows.length };
  });
}

export type RankAssignment =
  { ok: true } | { ok: false; reason: 'not_found' | 'already_held' | 'not_manual' };

/** Flow 11: give one member a rank by hand. Hand-assigned ranks are never revoked by XP or undo. */
export async function assignRank(
  pool: Pool,
  input: { userId: string; roleId: string; actorId: string },
): Promise<RankAssignment> {
  return withTransaction<RankAssignment>(pool, async (client) => {
    await lockUsers(client, [input.userId]);
    try {
      const { rowCount } = await client.query(
        `INSERT INTO user_roles (user_id, role_id, source, assigned_by)
         VALUES ($1, $2, 'manual', $3) ON CONFLICT (user_id, role_id) DO NOTHING`,
        [input.userId, input.roleId, input.actorId],
      );
      if (rowCount !== 1) return rollback({ ok: false, reason: 'already_held' } as const);
    } catch (error) {
      if (pgCode(error) === FOREIGN_KEY_VIOLATION)
        return rollback({ ok: false, reason: 'not_found' } as const);
      throw error;
    }
    await enqueue(client, 'sync_member_roles', { userId: input.userId });
    return { ok: true };
  });
}

/**
 * Flow 11: take back a rank given by hand. A rank earned by XP or a quest is not
 * removable here (it would only come back); if the member still earns this one,
 * the recheck right after gives it back as earned.
 */
export async function removeRank(
  pool: Pool,
  input: { userId: string; roleId: string; actorId: string },
): Promise<RankAssignment> {
  return withTransaction<RankAssignment>(pool, async (client) => {
    await lockUsers(client, [input.userId]);
    const held = await client.query<{ source: string }>(
      'SELECT source FROM user_roles WHERE user_id = $1 AND role_id = $2',
      [input.userId, input.roleId],
    );
    const source = held.rows[0]?.source;
    if (source === undefined) return rollback({ ok: false, reason: 'not_found' } as const);
    if (source !== 'manual') return rollback({ ok: false, reason: 'not_manual' } as const);
    await client.query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [
      input.userId,
      input.roleId,
    ]);
    await enqueue(client, 'sync_member_roles', { userId: input.userId });
    await reconcileRoles(client, input.userId, input.actorId);
    return { ok: true };
  });
}

// ── Users (flow 12) ──────────────────────────────────────────────────────────

export type AdminUser = {
  id: string;
  discordId: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  xp: number;
  submissions: number;
  pending: number;
  joinedAt: Date;
  lastLoginAt: Date | null;
};

type AdminUserRow = {
  id: string;
  discord_id: string;
  name: string;
  avatar_url: string | null;
  role: UserRole;
  xp: string;
  submissions: number;
  pending: number;
  created_at: Date;
  last_login_at: Date | null;
};

const ADMIN_USER_SELECT = `
  SELECT u.id, u.discord_id, u.name, u.avatar_url, u.role, u.created_at, u.last_login_at,
         coalesce((SELECT sum(delta) FROM xp_events e WHERE e.user_id = u.id), 0) AS xp,
         (SELECT count(*)::int FROM submissions s WHERE s.user_id = u.id) AS submissions,
         (SELECT count(*)::int FROM submissions s
           WHERE s.user_id = u.id AND s.status = 'pending') AS pending
    FROM users u`;

const toAdminUser = (row: AdminUserRow): AdminUser => ({
  id: row.id,
  discordId: row.discord_id,
  name: row.name,
  avatarUrl: row.avatar_url,
  role: row.role,
  xp: Number(row.xp),
  submissions: row.submissions,
  pending: row.pending,
  joinedAt: row.created_at,
  lastLoginAt: row.last_login_at,
});

/** Staff first, then by name; `search` matches names and Discord ids. */
export async function adminUsers(
  pool: Pool,
  input: { search?: string; limit?: number } = {},
): Promise<AdminUser[]> {
  const search = input.search?.trim() ?? '';
  const { rows } = await pool.query<AdminUserRow>(
    `${ADMIN_USER_SELECT}
      WHERE $1 = '' OR u.name ILIKE '%' || $1 || '%' OR u.discord_id = $1
      ORDER BY CASE u.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.name, u.id
      LIMIT $2`,
    // ILIKE wildcards in the search are taken literally.
    [search.replace(/[\\%_]/g, (c) => `\\${c}`), input.limit ?? 200],
  );
  return rows.map(toAdminUser);
}

export type HeldRank = { roleId: string; name: string; source: 'xp' | 'quest' | 'manual' };

export async function adminUser(
  pool: Pool,
  id: string,
): Promise<(AdminUser & { ranks: HeldRank[] }) | null> {
  const { rows } = await pool.query<AdminUserRow>(`${ADMIN_USER_SELECT} WHERE u.id = $1`, [id]);
  if (rows[0] === undefined) return null;
  const ranks = await pool.query<{ role_id: string; name: string; source: HeldRank['source'] }>(
    `SELECT ur.role_id, r.name, ur.source
       FROM user_roles ur JOIN server_roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1 ORDER BY r.position, r.name`,
    [id],
  );
  return {
    ...toAdminUser(rows[0]),
    ranks: ranks.rows.map((r) => ({ roleId: r.role_id, name: r.name, source: r.source })),
  };
}

export type StaffResult<T = null> =
  { ok: true; value: T } | { ok: false; reason: StaffRefusal | 'not_found' | 'name_mismatch' };

/** Both parties as the database has them now, locked, in id order. */
async function partiesFor(
  client: Client,
  actorId: string,
  targetId: string,
): Promise<{
  actor: { id: string; role: UserRole };
  target: { id: string; role: UserRole; name: string; discordId: string };
} | null> {
  const { rows } = await client.query<{
    id: string;
    role: UserRole;
    name: string;
    discord_id: string;
  }>(
    `SELECT id, role, name, discord_id FROM users WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
    [[actorId, targetId]],
  );
  const actor = rows.find((row) => row.id === actorId);
  const target = rows.find((row) => row.id === targetId);
  if (actor === undefined || target === undefined) return null;
  return {
    actor: { id: actor.id, role: actor.role },
    target: { id: target.id, role: target.role, name: target.name, discordId: target.discord_id },
  };
}

/**
 * Flow 12: promote or demote (section 13.1). The actor's role is read from the
 * database under lock, so a demoted owner's open tab cannot still act as one.
 * The change applies on the target's next request (database sessions).
 */
export async function setUserRole(
  pool: Pool,
  input: { actorId: string; targetId: string; to: 'ambassador' | 'admin' },
): Promise<StaffResult> {
  return withTransaction<StaffResult>(pool, async (client) => {
    const parties = await partiesFor(client, input.actorId, input.targetId);
    if (parties === null) return rollback({ ok: false, reason: 'not_found' } as const);
    const plan = planRoleChange({ ...parties, to: input.to });
    if (!plan.ok) return rollback(plan);
    await client.query('UPDATE users SET role = $2, updated_at = now() WHERE id = $1', [
      input.targetId,
      input.to,
    ]);
    return { ok: true, value: null };
  });
}

/**
 * Flow 12: delete an account (section 13.5). The admin confirms by typing the
 * member's name. Everything of theirs goes: submissions, XP (the one way ledger
 * rows may leave), ranks and sessions. Returns their proof files for the caller
 * to delete once this has committed; a Discord sync is queued with their
 * Discord id, since the user row it would look up is gone.
 */
export async function deleteUser(
  pool: Pool,
  input: { actorId: string; targetId: string; confirmName: string },
): Promise<StaffResult<string[]>> {
  return withTransaction<StaffResult<string[]>>(pool, async (client) => {
    const parties = await partiesFor(client, input.actorId, input.targetId);
    if (parties === null) return rollback({ ok: false, reason: 'not_found' } as const);
    const plan = planUserDeletion(parties);
    if (!plan.ok) return rollback(plan);
    if (input.confirmName.trim() !== parties.target.name) {
      return rollback({ ok: false, reason: 'name_mismatch' } as const);
    }
    const files = await client.query<{ proof_file: string }>(
      'SELECT proof_file FROM submissions WHERE user_id = $1 AND proof_file IS NOT NULL',
      [input.targetId],
    );
    await enqueue(client, 'sync_member_roles', {
      userId: input.targetId,
      discordId: parties.target.discordId,
      deleted: true,
    });
    await client.query('DELETE FROM users WHERE id = $1', [input.targetId]);
    return { ok: true, value: files.rows.map((row) => row.proof_file) };
  });
}
