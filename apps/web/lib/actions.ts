import 'server-only';

import { requireAdmin, requireUser, type Viewer } from './authz';

/**
 * Every server action is declared through one of these three, never as a bare
 * `export async function` in a 'use server' file. The wrapper runs the gate
 * before the body can, so an action cannot forget it, and the registry lets the
 * adversarial suite call every action as every kind of visitor.
 *
 *   export const approve = adminAction('approve', async (admin, id: string) => { … });
 *
 * authz.adversarial.test.ts fails on a 'use server' export declared any other way.
 */

export type Access = 'public' | 'user' | 'admin';

export type RegisteredAction = {
  name: string;
  access: Access;
  // Called with no arguments by the adversarial suite: the gate runs before any are read.
  action: () => Promise<unknown>;
};

export const registeredActions: RegisteredAction[] = [];

function register<A extends unknown[], R>(
  name: string,
  access: Access,
  action: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  registeredActions.push({ name, access, action: action as unknown as RegisteredAction['action'] });
  return action;
}

/** Open to anyone, signed in or not. Say why at the call site. */
export function publicAction<A extends unknown[], R>(
  name: string,
  body: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return register(name, 'public', (...args: A) => body(...args));
}

export function userAction<A extends unknown[], R>(
  name: string,
  body: (viewer: Viewer, ...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return register(name, 'user', async (...args: A) => body(await requireUser(), ...args));
}

export function adminAction<A extends unknown[], R>(
  name: string,
  body: (admin: Viewer, ...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return register(name, 'admin', async (...args: A) => body(await requireAdmin(), ...args));
}
