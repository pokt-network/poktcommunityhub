export type UserRole = 'ambassador' | 'admin' | 'owner';

/** Staff can use the admin console: admins and the owner. */
export const isStaff = (role: UserRole): boolean => role === 'admin' || role === 'owner';

/**
 * The role a NEW user gets (brief sections 4.5 and 13.1). Owner only when their
 * Discord id is on the bootstrap list AND the hub has no staff at all. An
 * existing user is never promoted this way, and once anyone is staff the list
 * does nothing: after the first sign-in, roles live in the database.
 *
 * The caller must count staff and insert the user under one lock, or two listed
 * ids signing in together would both see zero.
 */
export function initialRole(input: {
  discordId: string;
  bootstrapIds: readonly string[];
  staffCount: number;
}): UserRole {
  return input.staffCount === 0 && input.bootstrapIds.includes(input.discordId)
    ? 'owner'
    : 'ambassador';
}

type Party = { id: string; role: UserRole };

export type StaffRefusal =
  /** Only the owner changes roles (section 13.1). */
  | 'owner_only'
  /** Admins may delete ambassadors only; the owner may delete admins too. */
  | 'not_permitted'
  /** Nobody demotes or deletes themselves. */
  | 'self'
  /** The owner is never demoted or deleted in the app; ownership moves on the host. */
  | 'owner_protected'
  /** The target already has that role. */
  | 'unchanged';

export type StaffPlan = { ok: true } | { ok: false; reason: StaffRefusal };

/**
 * Flow 12: may `actor` set `target`'s role to `to`? Only the owner promotes and
 * demotes, never themselves, and `owner` is not a role that can be given here.
 * An admin cannot touch roles at all, so adding an admin never hands anyone
 * the power to remove the owner or another admin.
 */
export function planRoleChange(input: {
  actor: Party;
  target: Party;
  to: 'ambassador' | 'admin';
}): StaffPlan {
  const { actor, target, to } = input;
  if (actor.role !== 'owner') return { ok: false, reason: 'owner_only' };
  if (actor.id === target.id) return { ok: false, reason: 'self' };
  if (target.role === 'owner') return { ok: false, reason: 'owner_protected' };
  if (target.role === to) return { ok: false, reason: 'unchanged' };
  return { ok: true };
}

/**
 * Flow 12: may `actor` delete `target`'s account? Staff only; nobody deletes
 * themselves or the owner; deleting an admin is the owner's alone.
 */
export function planUserDeletion(input: { actor: Party; target: Party }): StaffPlan {
  const { actor, target } = input;
  if (!isStaff(actor.role)) return { ok: false, reason: 'not_permitted' };
  if (actor.id === target.id) return { ok: false, reason: 'self' };
  if (target.role === 'owner') return { ok: false, reason: 'owner_protected' };
  if (target.role === 'admin' && actor.role !== 'owner') {
    return { ok: false, reason: 'not_permitted' };
  }
  return { ok: true };
}
