export const SUPERADMIN_EMAIL = "ranasufyankhan12@gmail.com";

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPERADMIN_EMAIL;
}

export function isSuperAdmin(
  user: { email?: string | null } | null | undefined,
): boolean {
  return isSuperAdminEmail(user?.email);
}

/**
 * @deprecated Roles are DB-owned via Admin → Users.
 * Kept only so old imports fail loudly if reintroduced.
 */
export function roleForDiscordId() {
  return "ambassador" as const;
}
