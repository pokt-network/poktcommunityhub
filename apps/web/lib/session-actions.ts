'use server';

import { publicAction } from './actions';
import { signIn, signOut } from './auth';

/** Public: it is how a signed-out visitor becomes a signed-in one. */
export const signInWithDiscord = publicAction('signInWithDiscord', async () => {
  await signIn('discord', { redirectTo: '/me' });
});

/** Public: signing out with no session is a no-op, and refusing it would help nobody. */
export const signOutOfHub = publicAction('signOut', async () => {
  await signOut({ redirectTo: '/' });
});
