import {
  createDiscordUser,
  createSession,
  deleteSession,
  extendSession,
  findUser,
  findUserByDiscordId,
  type HubUser,
  type Pool,
  sessionUser,
} from '@community/store';
import type { Adapter, AdapterUser } from 'next-auth/adapters';
import { z } from 'zod';

/**
 * Auth.js's database adapter, over the hub's own `users` and `sessions` tables
 * (brief section 11). Discord is the only provider, so the Discord id on `users`
 * is the account link and there is no `accounts` table.
 *
 * Not implemented, on purpose: email sign-in, account linking and unlinking.
 * `linkAccount` is a no-op because the OAuth tokens it is handed are never
 * stored; the access token is used once, in the sign-in callback, and dropped.
 */

/** An Auth.js user carrying the hub user it was read from. */
export type HubAdapterUser = AdapterUser & { hub: HubUser };

export const toAdapterUser = (user: HubUser): HubAdapterUser => ({
  id: user.id,
  // Required by the type and never read: the hub has no email addresses.
  email: '',
  emailVerified: null,
  name: user.name,
  image: user.avatarUrl,
  hub: user,
});

/** What `profile()` in lib/auth.ts hands Auth.js, which passes it to createUser. */
const newUserSchema = z.object({
  discordId: z.string(),
  name: z.string(),
  image: z.string().nullish(),
});

export function hubAdapter(pool: Pool, options: { bootstrapIds: readonly string[] }): Adapter {
  return {
    async createUser(user) {
      const input = newUserSchema.parse(user);
      const created = await createDiscordUser(pool, {
        discordId: input.discordId,
        name: input.name,
        avatarUrl: input.image ?? null,
        bootstrapIds: options.bootstrapIds,
      });
      return toAdapterUser(created);
    },

    async getUser(id) {
      const user = await findUser(pool, id);
      return user === null ? null : toAdapterUser(user);
    },

    async getUserByEmail() {
      return null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      if (provider !== 'discord') return null;
      const user = await findUserByDiscordId(pool, providerAccountId);
      return user === null ? null : toAdapterUser(user);
    },

    async updateUser(user) {
      // Auth.js calls this only for email sign-in, which the hub does not offer.
      // Profile refreshes go through recordSignIn, never through here.
      const current = await findUser(pool, user.id);
      if (current === null) throw new Error(`updateUser: no user ${user.id}`);
      return toAdapterUser(current);
    },

    async linkAccount() {
      // Tokens are not stored (brief section 11.2).
    },

    async createSession(session) {
      await createSession(pool, {
        token: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      });
      return session;
    },

    async getSessionAndUser(sessionToken) {
      const found = await sessionUser(pool, sessionToken);
      if (found === null) return null;
      return {
        session: { sessionToken, userId: found.user.id, expires: found.expires },
        user: toAdapterUser(found.user),
      };
    },

    async updateSession({ sessionToken, expires }) {
      // Auth.js ignores the return value; it re-reads the session when it needs it.
      if (expires !== undefined) await extendSession(pool, sessionToken, expires);
      return null;
    },

    async deleteSession(sessionToken) {
      await deleteSession(pool, sessionToken);
    },
  };
}
