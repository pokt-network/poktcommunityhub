import { planRoleChanges, type RoleChanges, type RoleSource } from '@community/core';

import type { Client } from './tx.js';

/**
 * Bring a user's derived roles (XP thresholds and quest rewards) in line with
 * their ledger and approved quests, inside the caller's transaction. Hand-assigned
 * roles are left alone. Any change queues one Discord sync for the user.
 *
 * The caller must already hold the user's row lock (see reviews.ts): the total
 * read here is only final while no other review for the user can commit.
 */
export async function reconcileRoles(
  client: Client,
  userId: string,
  actorId: string | null,
): Promise<RoleChanges> {
  // One after another: a pg client runs one query at a time, and queueing them
  // concurrently on it is deprecated.
  const roles = await client.query<{ id: string; xp_required: number | null }>(
    'SELECT id, xp_required FROM server_roles',
  );
  const held = await client.query<{ role_id: string; source: RoleSource }>(
    'SELECT role_id, source FROM user_roles WHERE user_id = $1',
    [userId],
  );
  const total = await client.query<{ total: string }>(
    'SELECT coalesce(sum(delta), 0) AS total FROM xp_events WHERE user_id = $1',
    [userId],
  );
  const rewards = await client.query<{ reward_role_id: string }>(
    `SELECT DISTINCT q.reward_role_id
       FROM submissions s JOIN quests q ON q.id = s.quest_id
      WHERE s.user_id = $1 AND s.status = 'approved' AND q.reward_role_id IS NOT NULL`,
    [userId],
  );

  const changes = planRoleChanges({
    roles: roles.rows.map((row) => ({ id: row.id, xpRequired: row.xp_required })),
    held: held.rows.map((row) => ({ roleId: row.role_id, source: row.source })),
    totalXp: Number(total.rows[0]?.total ?? 0),
    questRewardRoleIds: rewards.rows.map((row) => row.reward_role_id),
  });

  for (const { roleId, source } of changes.grant) {
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, source, assigned_by)
       VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, roleId, source, actorId],
    );
    await enqueue(client, 'announce', { event: 'role_unlocked', userId, roleId });
  }
  if (changes.revoke.length > 0) {
    await client.query(
      `DELETE FROM user_roles
        WHERE user_id = $1 AND role_id = ANY($2::uuid[]) AND source <> 'manual'`,
      [userId, changes.revoke],
    );
  }
  if (changes.grant.length > 0 || changes.revoke.length > 0) {
    // The worker reconciles the member's Discord roles with user_roles as they
    // are when it runs, so one job per change is enough and replays are harmless.
    await enqueue(client, 'sync_member_roles', { userId });
  }

  return changes;
}

/** Queue a Discord side effect in the caller's transaction (the outbox, brief 4.3). */
export async function enqueue(
  client: Client,
  kind: 'sync_member_roles' | 'announce',
  payload: Record<string, unknown>,
): Promise<void> {
  await client.query('INSERT INTO discord_jobs (kind, payload) VALUES ($1, $2)', [kind, payload]);
}
