import type { User } from "@supabase/supabase-js";
import { isSuperAdminEmail } from "@/lib/admin";
import { query } from "@/lib/db";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: "ambassador" | "admin" | string;
  totalXp: number;
  discordId: string | null;
};

/** Discord identity from Auth — preferred for display. */
export function discordIdFromAuthUser(user: User): string | null {
  const trusted = trustedDiscordId(user);
  if (trusted) return trusted;

  const meta = user.user_metadata ?? {};
  if (typeof meta.provider_id === "string" && meta.provider_id) {
    return meta.provider_id;
  }
  if (typeof meta.sub === "string" && meta.sub) return meta.sub;
  return null;
}

/**
 * Verified Discord provider identity only (not user_metadata).
 * Used for legacy account merge so metadata cannot spoof a Discord id.
 */
function trustedDiscordId(user: User): string | null {
  const identity = user.identities?.find((item) => item.provider === "discord");
  return identity?.id ?? null;
}

export function displayNameFromAuthUser(user: User): string {
  const meta = user.user_metadata ?? {};
  return (
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.preferred_username === "string" && meta.preferred_username) ||
    user.email?.split("@")[0] ||
    "Ambassador"
  );
}

export function avatarFromAuthUser(user: User): string | null {
  const meta = user.user_metadata ?? {};
  if (typeof meta.avatar_url === "string") return meta.avatar_url;
  if (typeof meta.picture === "string") return meta.picture;
  return null;
}

/**
 * Upsert public."user" from a verified Supabase Auth user.
 * Role is DB-owned (admin UI) — login never grants or inherits admin.
 * Legacy merge only by verified Discord identity (not email).
 */
export async function ensureAppUser(user: User): Promise<AppUser> {
  const discordId = trustedDiscordId(user);
  const name = displayNameFromAuthUser(user);
  const image = avatarFromAuthUser(user);
  const email = user.email ?? `${user.id}@users.discord.local`;

  // Only merge when the Discord provider identity matches — never by email
  // (email match could let an attacker inherit another account's privileges).
  let legacy: { id: string; totalXp: number } | null = null;
  if (discordId) {
    const { rows: legacyRows } = await query<{
      id: string;
      totalXp: number;
    }>(
      `SELECT
         id,
         COALESCE("totalXp", 0)::int AS "totalXp"
       FROM public."user"
       WHERE id IS DISTINCT FROM $1
         AND "discordId" = $2
       ORDER BY "updatedAt" DESC NULLS LAST
       LIMIT 1`,
      [user.id, discordId],
    );
    legacy = legacyRows[0] ?? null;
  }

  const inheritedXp = legacy?.totalXp ?? 0;
  // Never auto-promote regular users: new rows are ambassador (except the Super Admin).
  const initialRole = isSuperAdminEmail(email) ? "admin" : "ambassador";

  if (legacy) {
    await query(
      `UPDATE public."user"
       SET email = $1,
           "discordId" = NULL,
           "updatedAt" = now()
       WHERE id = $2`,
      [`migrated+${legacy.id}@local.invalid`, legacy.id],
    );
  }

  const { rows } = await query<AppUser>(
    `INSERT INTO public."user" (
       id, name, email, "emailVerified", image,
       "discordId", role, "totalXp", "createdAt", "updatedAt"
     )
     VALUES ($1, $2, $3, true, $4, $5, $6, $7, now(), now())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       email = EXCLUDED.email,
       image = EXCLUDED.image,
       "discordId" = COALESCE(EXCLUDED."discordId", public."user"."discordId"),
       "totalXp" = GREATEST(public."user"."totalXp", EXCLUDED."totalXp"),
       "updatedAt" = now()
     RETURNING
       id,
       name,
       email,
       image,
       role,
       COALESCE("totalXp", 0)::int AS "totalXp",
       "discordId" AS "discordId"`,
    [user.id, name, email, image, discordId, initialRole, inheritedXp],
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to sync app user profile.");
  }

  if (legacy) {
    await query(
      `UPDATE public.submissions SET user_id = $1 WHERE user_id = $2`,
      [user.id, legacy.id],
    );
    await query(
      `UPDATE public.submissions SET reviewed_by = $1 WHERE reviewed_by = $2`,
      [user.id, legacy.id],
    );
    // Move roles that the new account doesn't already have; drop the rest.
    await query(
      `UPDATE public.user_roles ur
       SET user_id = $1
       WHERE ur.user_id = $2
         AND NOT EXISTS (
           SELECT 1 FROM public.user_roles existing
           WHERE existing.user_id = $1 AND existing.role_id = ur.role_id
         )`,
      [user.id, legacy.id],
    );
    await query(`DELETE FROM public.user_roles WHERE user_id = $1`, [legacy.id]);
    await query(
      `UPDATE public.user_roles SET assigned_by = $1 WHERE assigned_by = $2`,
      [user.id, legacy.id],
    );
    await query(`DELETE FROM public."user" WHERE id = $1`, [legacy.id]);
  }

  return row;
}
