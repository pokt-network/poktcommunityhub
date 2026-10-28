import 'server-only';

import { notFound, redirect } from 'next/navigation';

import { auth, type Viewer } from './auth';

/**
 * The one place authorization is decided (brief section 4.4). Every page under
 * app/admin and every server action goes through here; the adversarial suite
 * (authz.adversarial.test.ts) holds them to it.
 *
 * The viewer is read from the database on every call (database sessions), so
 * a demotion, a deletion or a signed-out session takes effect on the next
 * request, not when a cookie expires.
 */

export type { Viewer };

/** Who is asking, or null when signed out. */
export async function currentViewer(): Promise<Viewer | null> {
  const session = await auth();
  return session?.viewer ?? null;
}

/** Signed in, or sent to /signin. */
export async function requireUser(): Promise<Viewer> {
  const viewer = await currentViewer();
  if (viewer === null) redirect('/signin');
  return viewer;
}

/**
 * An admin, or a 404. A signed-in ambassador is not told the page exists; a
 * signed-out visitor is sent to sign in first, as anywhere else.
 */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireUser();
  if (viewer.role !== 'admin') notFound();
  return viewer;
}
