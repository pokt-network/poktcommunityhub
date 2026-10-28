export type UserRole = 'ambassador' | 'admin';

/**
 * The role a NEW user gets (brief section 4.5). Admin only when their Discord id
 * is on the bootstrap list AND the hub has no admin at all. An existing user is
 * never promoted this way, and once any admin exists the list does nothing:
 * after the first sign-in, roles live in the database.
 *
 * The caller must count admins and insert the user under one lock, or two
 * listed ids signing in together would both see zero admins.
 */
export function initialRole(input: {
  discordId: string;
  bootstrapIds: readonly string[];
  adminCount: number;
}): UserRole {
  return input.adminCount === 0 && input.bootstrapIds.includes(input.discordId)
    ? 'admin'
    : 'ambassador';
}
