export type RoleSource = 'xp' | 'quest' | 'manual';

/** A server role as eligibility sees it. `xpRequired` null: never granted by XP. */
export type RankRole = { id: string; xpRequired: number | null };

export type HeldRole = { roleId: string; source: RoleSource };

export type RoleChanges = {
  grant: { roleId: string; source: 'xp' | 'quest' }[];
  revoke: string[];
};

/** The XP-threshold roles a total qualifies for (flow 8). */
export function eligibleXpRoles(roles: readonly RankRole[], totalXp: number): string[] {
  return roles
    .filter((role) => role.xpRequired !== null && totalXp >= role.xpRequired)
    .map((role) => role.id);
}

/**
 * Reconcile the roles a user should hold with the roles they hold.
 *
 * A role is earned while the user's XP total meets its threshold, or while one of
 * their approved quests rewards it. `questRewardRoleIds` is the reward roles of
 * the user's CURRENTLY approved submissions, so an undo that removes the last
 * reason for a role removes the role.
 *
 * Roles assigned by hand (`manual`) are never granted or revoked here: an admin's
 * decision outranks the arithmetic.
 */
export function planRoleChanges(input: {
  roles: readonly RankRole[];
  held: readonly HeldRole[];
  totalXp: number;
  questRewardRoleIds: readonly string[];
}): RoleChanges {
  const byXp = new Set(eligibleXpRoles(input.roles, input.totalXp));
  const byQuest = new Set(input.questRewardRoleIds);
  const held = new Map(input.held.map((role) => [role.roleId, role.source]));

  const grant: RoleChanges['grant'] = [];
  for (const roleId of byXp) {
    if (!held.has(roleId)) grant.push({ roleId, source: 'xp' });
  }
  for (const roleId of byQuest) {
    if (!held.has(roleId) && !byXp.has(roleId)) grant.push({ roleId, source: 'quest' });
  }

  const revoke: string[] = [];
  for (const [roleId, source] of held) {
    if (source === 'manual') continue;
    if (!byXp.has(roleId) && !byQuest.has(roleId)) revoke.push(roleId);
  }

  return { grant, revoke };
}
