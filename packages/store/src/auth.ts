import { createHash } from 'node:crypto';

import { initialRole, type UserRole } from '@community/core';

import type { Pool } from './pool.js';
import { withTransaction } from './tx.js';

/** A hub user as sign-in and the authorization gate see one. */
export type HubUser = {
  id: string;
  discordId: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
};

type UserRow = {
  id: string;
  discord_id: string;
  name: string;
  avatar_url: string | null;
  role: UserRole;
};

const USER_COLUMNS = 'u.id, u.discord_id, u.name, u.avatar_url, u.role';

const toUser = (row: UserRow): HubUser => ({
  id: row.id,
  discordId: row.discord_id,
  name: row.name,
  avatarUrl: row.avatar_url,
  role: row.role,
});

export async function findUser(pool: Pool, id: string): Promise<HubUser | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users u WHERE u.id = $1`,
    [id],
  );
  return rows[0] === undefined ? null : toUser(rows[0]);
}

export async function findUserByDiscordId(pool: Pool, discordId: string): Promise<HubUser | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users u WHERE u.discord_id = $1`,
    [discordId],
  );
  return rows[0] === undefined ? null : toUser(rows[0]);
}

/**
 * Create the user for a first Discord sign-in (flow 1), choosing their role by
 * the bootstrap rule in core.
 *
 * Every creation takes one advisory lock, so counting admins and inserting are
 * atomic across requests: two bootstrap ids signing in at once cannot both see
 * zero admins. If the user already exists (a doubled callback), that row is
 * returned unchanged; the bootstrap list never promotes an existing user.
 */
export async function createDiscordUser(
  pool: Pool,
  input: {
    discordId: string;
    name: string;
    avatarUrl: string | null;
    bootstrapIds: readonly string[];
  },
): Promise<HubUser> {
  return withTransaction(pool, async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('community.users.create'))`);

    const existing = await client.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users u WHERE u.discord_id = $1`,
      [input.discordId],
    );
    if (existing.rows[0] !== undefined) return toUser(existing.rows[0]);

    const admins = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM users WHERE role = 'admin'`,
    );
    const role = initialRole({
      discordId: input.discordId,
      bootstrapIds: input.bootstrapIds,
      adminCount: admins.rows[0]?.n ?? 0,
    });

    const { rows } = await client.query<UserRow>(
      `INSERT INTO users AS u (discord_id, name, avatar_url, role, last_login_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING ${USER_COLUMNS}`,
      [input.discordId, input.name, input.avatarUrl, role],
    );
    return toUser(rows[0]!);
  });
}

/** Every sign-in refreshes the name and avatar from Discord. The role is untouched. */
export async function recordSignIn(
  pool: Pool,
  userId: string,
  profile: { name: string; avatarUrl: string | null },
): Promise<void> {
  await pool.query(
    `UPDATE users SET name = $2, avatar_url = $3, last_login_at = now(), updated_at = now()
      WHERE id = $1`,
    [userId, profile.name, profile.avatarUrl],
  );
}

// ── Sessions ────────────────────────────────────────────────────────────────

/** Only the token's hash is stored (migration 0002). */
export const hashSessionToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

export async function createSession(
  pool: Pool,
  input: { token: string; userId: string; expires: Date },
): Promise<void> {
  await pool.query('INSERT INTO sessions (token_hash, user_id, expires) VALUES ($1, $2, $3)', [
    hashSessionToken(input.token),
    input.userId,
    input.expires,
  ]);
}

/**
 * The session for a cookie's token and its user, read fresh on every request so
 * a demotion or a deletion applies on the next one. An expired session is not
 * returned, whatever the caller does with its expiry.
 */
export async function sessionUser(
  pool: Pool,
  token: string,
  now: Date = new Date(),
): Promise<{ expires: Date; user: HubUser } | null> {
  const { rows } = await pool.query<UserRow & { expires: Date }>(
    `SELECT ${USER_COLUMNS}, s.expires
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires > $2`,
    [hashSessionToken(token), now],
  );
  const row = rows[0];
  return row === undefined ? null : { expires: row.expires, user: toUser(row) };
}

export async function extendSession(pool: Pool, token: string, expires: Date): Promise<boolean> {
  const result = await pool.query('UPDATE sessions SET expires = $2 WHERE token_hash = $1', [
    hashSessionToken(token),
    expires,
  ]);
  return result.rowCount === 1;
}

export async function deleteSession(pool: Pool, token: string): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashSessionToken(token)]);
}

/** Housekeeping for the worker (phase 6). Returns how many were removed. */
export async function deleteExpiredSessions(pool: Pool, now: Date = new Date()): Promise<number> {
  const result = await pool.query('DELETE FROM sessions WHERE expires <= $1', [now]);
  return result.rowCount ?? 0;
}
