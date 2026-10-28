#!/usr/bin/env node
/**
 * Every SQL migration must carry both direction markers, up first.
 *
 * node-pg-migrate splits a `.sql` migration on two comment markers, and with no
 * `-- Up Migration` marker the up SQL is the ENTIRE FILE, down statements
 * included. The Agentic Portal shipped one like that: it applied cleanly,
 * recorded itself in pgmigrations, and changed nothing, because its own
 * reversal ran straight after it. CI's up/down/up cycle cannot see that either;
 * a self-cancelling migration leaves nothing behind.
 *
 * The regex is copied from node-pg-migrate's sqlMigration (9.0.0), so this check
 * and the splitter agree by construction. `String.raw` matters: in a plain
 * template literal `\s` collapses to `s` and the pattern matches nothing.
 *
 * Also enforced: file names are `NNNN_name.sql`, numbered without gaps from 0001,
 * so two branches that each add "the next" migration collide here, not in prod.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'packages', 'store', 'migrations');

const markerRegex = (direction) =>
  new RegExp(String.raw`^\s*--[\s-]*` + direction + String.raw`\s+migration`, 'im');
const UP = markerRegex('up');
const DOWN = markerRegex('down');

const files = readdirSync(DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error(`No .sql migrations in ${DIR}. That is itself suspicious.`);
  process.exit(1);
}

const problems = [];

for (const [index, name] of files.entries()) {
  const expected = String(index + 1).padStart(4, '0');
  if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(name) || !name.startsWith(`${expected}_`)) {
    problems.push(`${name}: expected ${expected}_<name>.sql (lowercase, numbered without gaps).`);
    continue;
  }

  const content = readFileSync(join(DIR, name), 'utf8');
  const up = content.search(UP);
  const down = content.search(DOWN);

  if (up < 0) {
    problems.push(
      `${name}: no '-- Up Migration' marker, so the WHOLE FILE runs as up and does nothing.`,
    );
  } else if (down < 0) {
    problems.push(`${name}: no '-- Down Migration' marker, so it cannot be reverted.`);
  } else if (down < up) {
    problems.push(
      `${name}: '-- Down Migration' comes before '-- Up Migration'; the sections are inverted.`,
    );
  } else {
    console.log(`ok    ${name}`);
  }
}

if (problems.length > 0) {
  console.error(`\n${problems.length} migration problem(s):\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`\nAll ${files.length} migrations are numbered and carry both markers, in order.`);
