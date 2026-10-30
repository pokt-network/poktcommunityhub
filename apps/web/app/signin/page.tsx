import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { currentViewer } from '@/lib/authz';
import { signInWithDiscord } from '@/lib/session-actions';

import styles from '../shell.module.css';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Why a sign-in came back here. Our own refusals (lib/auth.ts) say what to do;
 * anything Auth.js reports (a cancelled consent screen, a failed token
 * exchange) gets one generic line, and the detail is in the server log.
 */
const MESSAGES: Record<string, string> = {
  'not-member':
    'The hub is for members of the POKT Discord server. Join the server first, then sign in again.',
  'discord-unavailable':
    'Discord did not answer when we checked your server membership. Try again in a minute.',
};
const GENERIC = 'Sign-in did not complete. Try again.';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  if ((await currentViewer()) !== null) redirect('/me');

  const { error } = await searchParams;
  const code = Array.isArray(error) ? error[0] : error;
  const message = code === undefined ? null : (MESSAGES[code] ?? GENERIC);

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <img className={styles.mark} src="/pokt-mark.svg" alt="" width={64} height={64} />
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.lede}>
          The Community Hub uses your Discord account. You need to be a member of the POKT Discord
          server.
        </p>
        {message !== null && (
          <p className={styles.notice} role="alert">
            {message}
          </p>
        )}
        <form action={signInWithDiscord}>
          <button className={styles.button} type="submit">
            Sign in with Discord
          </button>
        </form>
      </div>
    </main>
  );
}
