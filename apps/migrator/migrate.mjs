#!/usr/bin/env node
/**
 * Apply migrations, and refuse to report success without checking.
 *
 * Adapted from the Agentic Portal's tools/migrate.mjs, which exists because of a
 * false green there: a stale migrator image ran its own, older `migrations/`
 * directory and announced "No migrations to run!", which was true of the image
 * and false of the release. Two schema changes were silently skipped.
 *
 * Three checks:
 *   1. Before: every migration the database has applied must exist here. If the
 *      database knows names this image does not, the image is older than the
 *      schema. Refuse: applying "up" from there cannot be what anyone meant.
 *   2. Apply: the node-pg-migrate installed in this image, at the version
 *      pnpm-lock.yaml pins. Never `npx`, which falls back to fetching whatever
 *      is newest (the portal applied 9.0.0 for months against a 7.9.1 pin).
 *   3. After: every migration here must now be applied.
 *
 * What this does NOT catch: an image that is stale but self-consistent (seven
 * migrations in the image, the same seven applied, nine in the repository).
 * Neither side knows about the other two. That is caught by tools/deploy.mjs
 * building the migrator on every deploy and asserting its revision label.
 *
 * Usage: node migrate.mjs --dir <migrations directory>
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));

const fail = (message) => {
  console.error(`\nMIGRATION REFUSED: ${message}\n`);
  process.exit(1);
};

const dirFlag = process.argv.indexOf('--dir');
const dir = dirFlag >= 0 ? process.argv[dirFlag + 1] : undefined;
if (dir === undefined) fail('usage: node migrate.mjs --dir <migrations directory>');

/** The migration names this copy carries, as node-pg-migrate records them. */
function onDisk() {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  if (files.length === 0) {
    fail(`no .sql files in ${dir}. The image was built without them; that is not an empty schema.`);
  }
  return files.map((name) => name.replace(/\.sql$/, ''));
}

/**
 * What the database has applied. An absent `pgmigrations` table is a database
 * never migrated, a legitimate first run; an unreachable database is not, and
 * throws rather than reading as "nothing applied yet".
 */
async function applied(client) {
  const { rows } = await client.query(`SELECT to_regclass('public.pgmigrations') AS present`);
  if (rows[0]?.present === null) return [];
  const result = await client.query('SELECT name FROM pgmigrations ORDER BY id');
  return result.rows.map((row) => row.name);
}

async function main() {
  const connectionString = process.env['DATABASE_URL'];
  if (connectionString === undefined || connectionString.length === 0) {
    fail('DATABASE_URL is not set.');
  }

  const files = onDisk();
  const client = new pg.Client({ connectionString });
  await client.connect();
  const before = await applied(client);
  await client.end();

  console.log(`image     ${process.env['APP_COMMIT'] ?? 'local'}`);
  console.log(`on disk   ${files.length}, newest ${files.at(-1)}`);
  console.log(`applied   ${before.length}${before.length > 0 ? `, newest ${before.at(-1)}` : ''}`);

  // ── 1. Is this copy older than the schema? ──────────────────────────────
  const unknown = before.filter((name) => !files.includes(name));
  if (unknown.length > 0) {
    fail(
      `the database has applied migrations this copy does not contain: ${unknown.join(', ')}.\n` +
        '  It is OLDER than the schema: a stale image, or a rollback, which this tool cannot do.',
    );
  }
  const pending = files.filter((name) => !before.includes(name));
  console.log(
    `pending   ${pending.length}${pending.length > 0 ? `: ${pending.join(', ')}` : ''}\n`,
  );

  // ── 2. Apply, with the installed binary ──────────────────────────────────
  // Spawned through node, not the .bin shim, so it runs the same on Windows.
  const cli = join(here, 'node_modules', 'node-pg-migrate', 'bin', 'node-pg-migrate.js');
  execFileSync(
    process.execPath,
    [cli, 'up', '--migrations-dir', dir, '--migration-file-language', 'sql'],
    { stdio: 'inherit' },
  );

  // ── 3. Did it land? ──────────────────────────────────────────────────────
  const verifier = new pg.Client({ connectionString });
  await verifier.connect();
  const after = await applied(verifier);
  await verifier.end();

  const missing = files.filter((name) => !after.includes(name));
  if (missing.length > 0) {
    fail(
      `still not applied: ${missing.join(', ')}. The migrator reported success and the schema did not change.`,
    );
  }
  console.log(`\nOK: all ${files.length} migrations applied.`);
}

main().catch((error) => {
  console.error(error);
  fail('the migrator threw. The schema may be partially applied; check pgmigrations.');
});
