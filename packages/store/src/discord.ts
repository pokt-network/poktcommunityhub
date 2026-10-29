import { ANNOUNCE_EVENTS, type AnnounceEvent } from '@community/core';

import type { Pool } from './pool.js';
import { rollback, withTransaction } from './tx.js';

/**
 * The Discord outbox's other half (brief sections 4.3 and 14): the worker claims
 * jobs, reads what it needs to act on them, and records the outcome; the console
 * reads the queue, retries failed jobs and queues syncs. Also the announcement
 * settings and the 60-day screenshot retention, which the worker runs.
 */

// ── The queue ────────────────────────────────────────────────────────────────

export type JobKind = 'sync_member_roles' | 'announce';

export type Job = { id: string; kind: JobKind; payload: unknown; attempts: number };

/**
 * How long a claimed job is the worker's. A worker that dies mid-job leaves it
 * to come due again after this, so a crash delays a job rather than losing it.
 */
const LEASE = "interval '5 minutes'";

/**
 * Take the next due job, counting the attempt. SKIP LOCKED, so a second worker
 * (there is one today) would take a different job rather than wait.
 */
export async function claimJob(pool: Pool): Promise<Job | null> {
  const { rows } = await pool.query<{
    id: string;
    kind: JobKind;
    payload: unknown;
    attempts: number;
  }>(
    `UPDATE discord_jobs
        SET attempts = attempts + 1, next_attempt_at = now() + ${LEASE}
      WHERE id = (SELECT id FROM discord_jobs
                   WHERE done_at IS NULL AND failed_at IS NULL AND next_attempt_at <= now()
                   ORDER BY next_attempt_at, id
                   LIMIT 1
                   FOR UPDATE SKIP LOCKED)
      RETURNING id::text, kind, payload, attempts`,
  );
  return rows[0] ?? null;
}

/** Done. A note says why nothing was sent (a skipped announcement, a member who left). */
export async function finishJob(pool: Pool, id: string, note: string | null = null): Promise<void> {
  await pool.query(
    'UPDATE discord_jobs SET done_at = now(), note = $2, last_error = NULL WHERE id = $1',
    [id, note],
  );
}

/** Try again at `at`. A rate limit gives the attempt back (section 14.3). */
export async function rescheduleJob(
  pool: Pool,
  id: string,
  input: { at: Date; error: string; countsAsAttempt: boolean },
): Promise<void> {
  await pool.query(
    `UPDATE discord_jobs
        SET next_attempt_at = $2, last_error = $3,
            attempts = CASE WHEN $4 THEN attempts ELSE greatest(attempts - 1, 0) END
      WHERE id = $1`,
    [id, input.at, input.error, input.countsAsAttempt],
  );
}

/** Out of attempts: shown in the console until an admin retries it. */
export async function failJob(pool: Pool, id: string, error: string): Promise<void> {
  await pool.query('UPDATE discord_jobs SET failed_at = now(), last_error = $2 WHERE id = $1', [
    id,
    error,
  ]);
}

/** An admin's Retry: a failed job starts again with all its attempts. */
export async function retryFailedJob(pool: Pool, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE discord_jobs
        SET failed_at = NULL, attempts = 0, next_attempt_at = now()
      WHERE id = $1 AND failed_at IS NOT NULL`,
    [id],
  );
  return rowCount === 1;
}

/** Retry every failed job at once (after fixing the bot's permissions, say). */
export async function retryAllFailedJobs(pool: Pool): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE discord_jobs SET failed_at = NULL, attempts = 0, next_attempt_at = now()
      WHERE failed_at IS NOT NULL`,
  );
  return rowCount ?? 0;
}

export type QueueSummary = { due: number; waiting: number; failed: number; doneToday: number };

export async function queueSummary(pool: Pool): Promise<QueueSummary> {
  const { rows } = await pool.query<QueueSummary>(
    `SELECT count(*) FILTER (WHERE done_at IS NULL AND failed_at IS NULL AND next_attempt_at <= now())::int AS due,
            count(*) FILTER (WHERE done_at IS NULL AND failed_at IS NULL AND next_attempt_at > now())::int AS waiting,
            count(*) FILTER (WHERE failed_at IS NOT NULL)::int AS failed,
            count(*) FILTER (WHERE done_at > now() - interval '1 day')::int AS "doneToday"
       FROM discord_jobs`,
  );
  return rows[0]!;
}

export type FailedJob = {
  id: string;
  kind: JobKind;
  /** The member it was for, when it was for one who still exists. */
  memberName: string | null;
  event: string | null;
  attempts: number;
  lastError: string | null;
  failedAt: Date;
};

export async function failedJobs(pool: Pool, limit = 50): Promise<FailedJob[]> {
  const { rows } = await pool.query<{
    id: string;
    kind: JobKind;
    member_name: string | null;
    event: string | null;
    attempts: number;
    last_error: string | null;
    failed_at: Date;
  }>(
    `SELECT j.id::text, j.kind, u.name AS member_name, j.payload->>'event' AS event,
            j.attempts, j.last_error, j.failed_at
       FROM discord_jobs j
       LEFT JOIN users u ON u.id::text = j.payload->>'userId'
      WHERE j.failed_at IS NOT NULL
      ORDER BY j.failed_at DESC
      LIMIT $1`,
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    memberName: row.member_name,
    event: row.event,
    attempts: row.attempts,
    lastError: row.last_error,
    failedAt: row.failed_at,
  }));
}

/** Flow 13: sync one member now. */
export async function queueMemberSync(pool: Pool, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO discord_jobs (kind, payload)
     SELECT 'sync_member_roles', jsonb_build_object('userId', id) FROM users WHERE id = $1`,
    [userId],
  );
  return rowCount === 1;
}

/** Flow 13 and section 14.4: one sync per member. Returns how many were queued. */
export async function queueSyncAll(pool: Pool): Promise<number> {
  const { rowCount } = await pool.query(
    `INSERT INTO discord_jobs (kind, payload)
     SELECT 'sync_member_roles', jsonb_build_object('userId', id) FROM users ORDER BY created_at`,
  );
  return rowCount ?? 0;
}

// ── What a member sync needs ─────────────────────────────────────────────────

/** Every Discord role id a rank links to: the roles the hub manages (section 14.1). */
export async function linkedRoleIds(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query<{ id: string }>(
    'SELECT discord_role_id AS id FROM server_roles WHERE discord_role_id IS NOT NULL',
  );
  return rows.map((row) => row.id);
}

/** A member's Discord id and the linked roles they hold, or null if they are gone. */
export async function memberRoleState(
  pool: Pool,
  userId: string,
): Promise<{ discordId: string; name: string; held: string[] } | null> {
  const user = await pool.query<{ discord_id: string; name: string }>(
    'SELECT discord_id, name FROM users WHERE id = $1',
    [userId],
  );
  const row = user.rows[0];
  if (row === undefined) return null;
  const held = await pool.query<{ id: string }>(
    `SELECT r.discord_role_id AS id
       FROM user_roles ur JOIN server_roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1 AND r.discord_role_id IS NOT NULL`,
    [userId],
  );
  return { discordId: row.discord_id, name: row.name, held: held.rows.map((r) => r.id) };
}

export type LinkableRank = {
  id: string;
  name: string;
  color: string | null;
  discordRoleId: string | null;
  holders: number;
};

/** Ranks in order, with their Discord link, for the console's Discord page. */
export async function linkableRanks(pool: Pool): Promise<LinkableRank[]> {
  const { rows } = await pool.query<{
    id: string;
    name: string;
    color: string | null;
    discord_role_id: string | null;
    holders: number;
  }>(
    `SELECT r.id, r.name, r.color, r.discord_role_id,
            (SELECT count(*)::int FROM user_roles ur WHERE ur.role_id = r.id) AS holders
       FROM server_roles r
      ORDER BY r.position, r.name`,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    discordRoleId: row.discord_role_id,
    holders: row.holders,
  }));
}

/**
 * Link a rank to a Discord role the console just created for it, if the rank
 * still has the link it had when the console looked (`expected`), and queue a
 * sync for each holder so they get the role. Returns false when the rank was
 * changed or deleted meanwhile; the caller then has a stray role to report.
 */
export async function linkRankRole(
  pool: Pool,
  input: { rankId: string; expected: string | null; discordRoleId: string },
): Promise<boolean> {
  return withTransaction(pool, async (client) => {
    const { rowCount } = await client.query(
      `UPDATE server_roles SET discord_role_id = $3
        WHERE id = $1 AND discord_role_id IS NOT DISTINCT FROM $2`,
      [input.rankId, input.expected, input.discordRoleId],
    );
    if (rowCount !== 1) return rollback(false);
    await client.query(
      `INSERT INTO discord_jobs (kind, payload)
       SELECT 'sync_member_roles', jsonb_build_object('userId', user_id, 'unlinked', $2::jsonb)
         FROM user_roles WHERE role_id = $1`,
      [input.rankId, JSON.stringify(input.expected === null ? [] : [input.expected])],
    );
    return true;
  });
}

// ── Announcements ────────────────────────────────────────────────────────────

/**
 * Queue a "new quest" announcement for every quest that is live and not yet
 * announced (section 14.5): created live, reopened, or reaching its start time.
 * One statement, so a quest is marked and queued together or not at all.
 */
export async function queueNewQuestAnnouncements(pool: Pool): Promise<number> {
  const { rowCount } = await pool.query(
    `WITH due AS (
       UPDATE quests SET announced_at = now()
        WHERE announced_at IS NULL AND status = 'active'
          AND (starts_at IS NULL OR starts_at <= now())
          AND (ends_at IS NULL OR ends_at > now())
       RETURNING id
     )
     INSERT INTO discord_jobs (kind, payload)
     SELECT 'announce', jsonb_build_object('event', 'new_quest', 'questId', id) FROM due`,
  );
  return rowCount ?? 0;
}

/** What an announcement names, read when it is sent; null if any of it is gone. */
export async function announcementSubjects(
  pool: Pool,
  ids: { userId?: string; questId?: string; roleId?: string },
): Promise<{ memberName?: string; questTitle?: string; xp?: number; rankName?: string } | null> {
  const found: { memberName?: string; questTitle?: string; xp?: number; rankName?: string } = {};
  if (ids.userId !== undefined) {
    const { rows } = await pool.query<{ name: string }>('SELECT name FROM users WHERE id = $1', [
      ids.userId,
    ]);
    if (rows[0] === undefined) return null;
    found.memberName = rows[0].name;
  }
  if (ids.questId !== undefined) {
    const { rows } = await pool.query<{ title: string; xp_reward: number }>(
      'SELECT title, xp_reward FROM quests WHERE id = $1',
      [ids.questId],
    );
    if (rows[0] === undefined) return null;
    found.questTitle = rows[0].title;
    found.xp = rows[0].xp_reward;
  }
  if (ids.roleId !== undefined) {
    const { rows } = await pool.query<{ name: string }>(
      'SELECT name FROM server_roles WHERE id = $1',
      [ids.roleId],
    );
    if (rows[0] === undefined) return null;
    found.rankName = rows[0].name;
  }
  return found;
}

/**
 * Whether an announcement is still true when it is sent: an approval undone,
 * or a rank lost, between queueing and sending is not announced.
 */
export async function stillTrue(
  pool: Pool,
  check: { approvedSubmissionId: string } | { userId: string; holdsRoleId: string },
): Promise<boolean> {
  const { rows } =
    'approvedSubmissionId' in check
      ? await pool.query(`SELECT 1 FROM submissions WHERE id = $1 AND status = 'approved'`, [
          check.approvedSubmissionId,
        ])
      : await pool.query('SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2', [
          check.userId,
          check.holdsRoleId,
        ]);
  return rows.length === 1;
}

// ── Settings ─────────────────────────────────────────────────────────────────

export type AnnouncementSettings = {
  /** Ciphertext (shared's encryptSetting); the store never sees the key. */
  webhookCipher: string | null;
  botName: string;
  avatarUrl: string | null;
  enabled: Record<AnnounceEvent, boolean>;
};

const SETTINGS_KEY = 'announcements';

/** Bound into the webhook's ciphertext (shared's encryptSetting), so it decrypts as nothing else. */
export const WEBHOOK_PURPOSE = 'announcements.webhook';

/** Section 14.6: everything off until an admin turns it on. */
export const DEFAULT_ANNOUNCEMENTS: AnnouncementSettings = {
  webhookCipher: null,
  botName: 'POKT Community',
  avatarUrl: null,
  enabled: { new_quest: false, quest_completed: false, role_unlocked: false },
};

export async function announcementSettings(pool: Pool): Promise<AnnouncementSettings> {
  const { rows } = await pool.query<{ value: Partial<AnnouncementSettings> }>(
    'SELECT value FROM app_settings WHERE key = $1',
    [SETTINGS_KEY],
  );
  const saved = rows[0]?.value ?? {};
  const enabled = { ...DEFAULT_ANNOUNCEMENTS.enabled };
  for (const event of ANNOUNCE_EVENTS) {
    if (saved.enabled?.[event] === true) enabled[event] = true;
  }
  return {
    webhookCipher: typeof saved.webhookCipher === 'string' ? saved.webhookCipher : null,
    botName: typeof saved.botName === 'string' ? saved.botName : DEFAULT_ANNOUNCEMENTS.botName,
    avatarUrl: typeof saved.avatarUrl === 'string' ? saved.avatarUrl : null,
    enabled,
  };
}

export async function saveAnnouncementSettings(
  pool: Pool,
  settings: AnnouncementSettings,
  actorId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [SETTINGS_KEY, settings, actorId],
  );
}

// ── Screenshot retention (section 9.6) ───────────────────────────────────────

/**
 * Delete reviewed screenshots older than `cutoff`, one at a time: lock the
 * row, delete the file (through `remove`), then clear proof_file, in one
 * transaction. A crash after the file goes and before the commit leaves the row
 * pointing at nothing, and the next run finishes it (removing a missing file is
 * not an error). A resubmission meanwhile makes the row pending again, which
 * the lock and the status check keep out.
 */
export async function purgeExpiredProofs(
  pool: Pool,
  cutoff: Date,
  remove: (file: string) => Promise<void>,
  limit = 100,
): Promise<number> {
  let purged = 0;
  for (; purged < limit; purged += 1) {
    const done = await withTransaction(pool, async (client) => {
      const { rows } = await client.query<{ id: string; proof_file: string }>(
        `SELECT id, proof_file FROM submissions
          WHERE proof_file IS NOT NULL AND status <> 'pending' AND reviewed_at < $1
          ORDER BY reviewed_at
          LIMIT 1
          FOR UPDATE SKIP LOCKED`,
        [cutoff],
      );
      const row = rows[0];
      if (row === undefined) return false;
      await remove(row.proof_file);
      await client.query('UPDATE submissions SET proof_file = NULL WHERE id = $1', [row.id]);
      return true;
    });
    if (!done) break;
  }
  return purged;
}
