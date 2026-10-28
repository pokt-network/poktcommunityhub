/**
 * The authorization gate, attacked (brief sections 4.4 and 8, phase 3 gate).
 *
 * Three layers, each of which fails loudly when something new slips past it:
 *   1. Every registered server action is called as a signed-out visitor, as a
 *      session with no viewer, and as an ambassador, and must be refused.
 *   2. A source scan: 'use server' files declare actions only through the
 *      wrappers in lib/actions.ts, every page and route under app/admin calls
 *      requireAdmin(), and nothing but lib/authz.ts reads the session.
 *   3. The scanners themselves are run against bad fixtures, so a regex that
 *      stops matching cannot quietly turn layer 2 green.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Session } from 'next-auth';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));

const { auth } = await import('./auth');
const { adminAction, registeredActions, userAction } = await import('./actions');
const { requireAdmin, requireUser } = await import('./authz');

const WEB = fileURLToPath(new URL('..', import.meta.url));
const mockedAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);

// ── Visitors ────────────────────────────────────────────────────────────────

const expires = new Date(Date.now() + 86_400_000).toISOString();
const ambassador = { id: 'u-amb', name: 'Amb', avatarUrl: null, role: 'ambassador' } as const;
const admin = { id: 'u-adm', name: 'Adm', avatarUrl: null, role: 'admin' } as const;

const VISITORS = {
  'signed out': null,
  'a session with no viewer': { expires },
  'an ambassador': { expires, viewer: ambassador },
  'an admin': { expires, viewer: admin },
} satisfies Record<string, Session | null>;

type Visitor = keyof typeof VISITORS;
const as = (visitor: Visitor) => mockedAuth.mockResolvedValue(VISITORS[visitor]);

/** What happened: the call went through, or which refusal stopped it. */
async function outcome(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return 'allowed';
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT;')) {
      return `redirect ${digest.split(';')[2]}`;
    }
    if (digest === 'NEXT_HTTP_ERROR_FALLBACK;404') return 'not found';
    throw error;
  }
}

// ── Source files ────────────────────────────────────────────────────────────

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name.startsWith('.')) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

const FILES = [...sourceFiles(join(WEB, 'app')), ...sourceFiles(join(WEB, 'lib'))].map((path) => ({
  path,
  rel: relative(WEB, path).split(sep).join('/'),
  source: readFileSync(path, 'utf8'),
}));

const isServerActionFile = (source: string) => /^\s*(['"])use server\1/.test(source);

/** Problems with a 'use server' file's exports; empty when every one is wrapped. */
function serverActionProblems(source: string): string[] {
  const problems: string[] = [];
  for (const line of source.split('\n')) {
    const exported = /^export\s+(.*)$/.exec(line.trim());
    if (exported === null) continue;
    const rest = exported[1]!;
    if (/^type\s|^interface\s/.test(rest)) continue;
    if (!/^const\s+\w+\s*=\s*(publicAction|userAction|adminAction)\(/.test(rest)) {
      problems.push(`unwrapped export: ${line.trim()}`);
    }
  }
  return problems;
}

const callsRequireAdmin = (source: string) => /\bawait\s+requireAdmin\(\)/.test(source);

const readsSession = (source: string) =>
  /import\s*\{[^}]*\bauth\b[^}]*\}\s*from\s*['"](@\/lib\/auth|\.\/auth|\.\.\/lib\/auth)['"]/.test(
    source,
  );

const PUBLIC_ACTIONS = ['signInWithDiscord', 'signOut'];

// ── 1. The gate ─────────────────────────────────────────────────────────────

describe('requireUser and requireAdmin', () => {
  const expected: Record<Visitor, [user: string, admin: string]> = {
    'signed out': ['redirect /signin', 'redirect /signin'],
    'a session with no viewer': ['redirect /signin', 'redirect /signin'],
    'an ambassador': ['allowed', 'not found'],
    'an admin': ['allowed', 'allowed'],
  };

  for (const [visitor, [user, adminOutcome]] of Object.entries(expected)) {
    it(`treats ${visitor} as user: ${user}, admin: ${adminOutcome}`, async () => {
      as(visitor as Visitor);
      expect(await outcome(requireUser)).toBe(user);
      expect(await outcome(requireAdmin)).toBe(adminOutcome);
    });
  }

  it('fails closed when the session cannot be read', async () => {
    mockedAuth.mockRejectedValue(new Error('Invalid configuration: AUTH_SECRET'));
    await expect(requireUser()).rejects.toThrow('Invalid configuration');
    await expect(requireAdmin()).rejects.toThrow('Invalid configuration');
  });
});

describe('the action wrappers', () => {
  const body = vi.fn(async (..._args: unknown[]) => 'ran');
  const guardedAdmin = adminAction('fixture:admin', body);
  const guardedUser = userAction('fixture:user', body);

  beforeEach(() => body.mockClear());

  it('never runs an admin body for anyone but an admin', async () => {
    for (const visitor of ['signed out', 'a session with no viewer', 'an ambassador'] as const) {
      as(visitor);
      expect(await outcome(() => guardedAdmin('x'))).not.toBe('allowed');
    }
    expect(body).not.toHaveBeenCalled();

    as('an admin');
    expect(await guardedAdmin('x')).toBe('ran');
    expect(body).toHaveBeenCalledWith(admin, 'x');
  });

  it('never runs a user body while signed out', async () => {
    for (const visitor of ['signed out', 'a session with no viewer'] as const) {
      as(visitor);
      expect(await outcome(() => guardedUser())).toBe('redirect /signin');
    }
    expect(body).not.toHaveBeenCalled();

    as('an ambassador');
    expect(await guardedUser()).toBe('ran');
    expect(body).toHaveBeenCalledWith(ambassador);
  });
});

// ── Every real action ───────────────────────────────────────────────────────

describe('every registered server action', () => {
  const real = () => registeredActions.filter((entry) => !entry.name.startsWith('fixture:'));

  beforeAll(async () => {
    for (const file of FILES.filter((f) => isServerActionFile(f.source))) {
      await import(pathToFileURL(file.path).href);
    }
  });

  it('found the actions, each with a unique name', () => {
    const names = real().map((entry) => entry.name);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
  });

  it('is public only when listed here on purpose', () => {
    const publicNames = real()
      .filter((entry) => entry.access === 'public')
      .map((entry) => entry.name);
    expect(publicNames.sort()).toEqual([...PUBLIC_ACTIONS].sort());
  });

  it('refuses every user and admin action to a signed-out visitor', async () => {
    for (const visitor of ['signed out', 'a session with no viewer'] as const) {
      as(visitor);
      for (const entry of real().filter((e) => e.access !== 'public')) {
        expect(await outcome(() => entry.action()), `${entry.name} as ${visitor}`).toBe(
          'redirect /signin',
        );
      }
    }
  });

  it('refuses every admin action to an ambassador', async () => {
    as('an ambassador');
    for (const entry of real().filter((e) => e.access === 'admin')) {
      expect(await outcome(() => entry.action()), entry.name).toBe('not found');
    }
  });
});

// ── 2. The source scan ──────────────────────────────────────────────────────

describe('source rules', () => {
  it("declares every 'use server' export through a wrapper", () => {
    const actionFiles = FILES.filter((f) => isServerActionFile(f.source));
    expect(actionFiles.length).toBeGreaterThan(0);
    for (const file of actionFiles) {
      expect(serverActionProblems(file.source), file.rel).toEqual([]);
    }
  });

  it('calls requireAdmin() in every page and route under app/admin', () => {
    const adminFiles = FILES.filter((f) =>
      /^app\/admin\/(.*\/)?(page\.tsx|route\.ts)$/.test(f.rel),
    );
    expect(adminFiles.length).toBeGreaterThan(0);
    for (const file of adminFiles) {
      expect(callsRequireAdmin(file.source), file.rel).toBe(true);
    }
  });

  it('reads the session only in lib/authz.ts', () => {
    const readers = FILES.filter((f) => readsSession(f.source)).map((f) => f.rel);
    expect(readers).toEqual(['lib/authz.ts']);
  });
});

// ── 3. The scanners, against bad fixtures ───────────────────────────────────

describe('the scanners catch what they are for', () => {
  it('flags unwrapped exports in a server action file', () => {
    const bad = [
      "'use server';",
      'export async function deleteUser(id: string) {}',
      'export const promote = async (id: string) => {};',
      'export default async function x() {}',
      'export { other };',
      "export const fine = adminAction('fine', async () => {});",
      'export type Fine = string;',
    ].join('\n');
    expect(serverActionProblems(bad)).toHaveLength(4);
  });

  it('flags an admin page that does not call requireAdmin()', () => {
    expect(callsRequireAdmin('export default async function P() { return null; }')).toBe(false);
    expect(callsRequireAdmin('// requireAdmin() is called by the layout')).toBe(false);
    expect(callsRequireAdmin('const a = await requireAdmin();')).toBe(true);
  });

  it('flags a file that reads the session directly', () => {
    expect(readsSession("import { auth } from '@/lib/auth';")).toBe(true);
    expect(readsSession("import { signIn, auth } from './auth';")).toBe(true);
    expect(readsSession("import { handlers } from '@/lib/auth';")).toBe(false);
  });
});
