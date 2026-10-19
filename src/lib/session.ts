import { cache } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import {
  discordIdFromAuthUser,
  ensureAppUser,
  type AppUser,
} from "@/lib/profile";
import { query } from "@/lib/db";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AppSession = {
  user: AppUser;
};

async function loadAppUser(id: string): Promise<AppUser | null> {
  const { rows } = await query<AppUser>(
    `SELECT
       id,
       name,
       email,
       image,
       role,
       COALESCE("totalXp", 0)::int AS "totalXp",
       "discordId" AS "discordId"
     FROM public."user"
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * One session lookup per request (header/nav/page all share this).
 * Auth is Supabase Auth (cookies/JWT). App profile + role live in public."user".
 */
export const getSession = cache(async (): Promise<AppSession | null> => {
  await connection();

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  try {
    const existing = await loadAppUser(data.user.id);
    const discordId = discordIdFromAuthUser(data.user);

    if (existing && existing.discordId === discordId) {
      return { user: existing };
    }

    const appUser = await ensureAppUser(data.user);
    return { user: appUser };
  } catch (err) {
    console.error("[getSession] profile sync failed", err);
    return null;
  }
});

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }
  return session;
}
