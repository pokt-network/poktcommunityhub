import 'server-only';

import { randomBytes } from 'node:crypto';

import { type HubUser, recordSignIn } from '@community/store';
import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';

import { type HubAdapterUser, hubAdapter } from './adapter';
import { webConfig } from './config';
import { db } from './db';
import { discordProfile, guildMembership } from './discord';
import { log } from './log';

/**
 * Sign-in (flow 1, brief sections 9.4, 9.5 and 11): Discord OAuth, membership of
 * the POKT server checked at sign-in, database sessions.
 *
 * The config is built per request, not at import, so `next build` needs no
 * secrets. It fails closed: a missing or invalid variable throws in
 * `webConfig()`, and every request that needs a session errors instead of
 * running without one. There is no "auth disabled" mode.
 *
 * Nothing outside lib/authz.ts reads the session; pages and actions ask
 * `requireUser()` or `requireAdmin()` (brief section 4.4).
 */

export type Viewer = Pick<HubUser, 'id' | 'name' | 'avatarUrl' | 'role'>;

declare module 'next-auth' {
  interface Session {
    viewer?: Viewer;
  }
}

const DAY = 24 * 60 * 60;

/** Where a refused sign-in lands; app/signin/page.tsx explains each. */
export const SIGN_IN_ERRORS = {
  notMember: '/signin?error=not-member',
  unavailable: '/signin?error=discord-unavailable',
} as const;

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const config = webConfig();
  return {
    secret: config.AUTH_SECRET,
    // The origin comes from AUTH_URL (lib/config.ts), never from request headers.
    trustHost: true,
    adapter: hubAdapter(db(), { bootstrapIds: config.ADMIN_BOOTSTRAP_DISCORD_IDS }),
    session: {
      strategy: 'database',
      maxAge: 30 * DAY,
      updateAge: DAY,
      generateSessionToken: () => randomBytes(32).toString('hex'),
    },
    pages: { signIn: '/signin', error: '/signin' },
    providers: [
      Discord({
        clientId: config.AUTH_DISCORD_ID,
        clientSecret: config.AUTH_DISCORD_SECRET,
        // No `email`: the hub has no use for addresses and does not collect them.
        authorization: { params: { scope: 'identify guilds.members.read' } },
        profile(raw) {
          const profile = discordProfile(raw);
          // `discordId` rides along to createUser in lib/adapter.ts: Auth.js
          // replaces `id` with a random one before the adapter sees it.
          const user = {
            id: profile.discordId,
            discordId: profile.discordId,
            name: profile.name,
            email: null,
            image: profile.avatarUrl,
          };
          return user;
        },
      }),
    ],
    callbacks: {
      /**
       * The gate, run after the token exchange and before any user row is made.
       * The access token is used here and nowhere else; it is never stored.
       */
      async signIn({ account }) {
        if (account?.provider !== 'discord' || account.access_token === undefined) return false;
        const membership = await guildMembership(account.access_token, config.DISCORD_GUILD_ID);
        if (membership === 'member') return true;
        log().warn({ membership, discordId: account.providerAccountId }, 'sign-in refused');
        return membership === 'not_member' ? SIGN_IN_ERRORS.notMember : SIGN_IN_ERRORS.unavailable;
      },

      /** Only what the gate needs leaves the server: no Discord id, no tokens. */
      session({ session, user }) {
        const { hub } = user as HubAdapterUser;
        return {
          expires: session.expires,
          viewer: { id: hub.id, name: hub.name, avatarUrl: hub.avatarUrl, role: hub.role },
        };
      },
    },
    events: {
      /** A returning user's name and avatar follow Discord. A new one was just created from it. */
      async signIn({ user, profile, isNewUser }) {
        if (isNewUser === true || user.id === undefined || profile === undefined) return;
        const fresh = discordProfile(profile);
        await recordSignIn(db(), user.id, { name: fresh.name, avatarUrl: fresh.avatarUrl });
      },
    },
  };
});
