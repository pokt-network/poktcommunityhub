#!/usr/bin/env node
/**
 * Asserts the package-boundary lint rules actually fire.
 *
 * A lint rule nobody tests silently stops working the next time the config is
 * refactored. The fixtures in tools/lint-fixtures/ are excluded from the normal
 * lint run so they can be linted here and asserted to FAIL.
 *
 * Exit 0 = the boundaries are enforced. Exit 1 = a guard has rotted.
 */
import { ESLint } from 'eslint';

const FIXTURES = [
  {
    file: 'tools/lint-fixtures/deep-import-by-package-name.ts',
    what: 'deep import via package name (@community/store/src/pool.js)',
  },
  {
    file: 'tools/lint-fixtures/deep-import-by-relative-path.ts',
    what: 'deep import via relative path (../../packages/store/src/pool.js)',
  },
  {
    file: 'tools/lint-fixtures/package-imports-app.ts',
    what: 'a package importing an app (@community/web)',
  },
];

// `ignore: false` so the global ignores in eslint.config.js do not skip them.
const eslint = new ESLint({ ignore: false });

let failures = 0;

for (const { file, what } of FIXTURES) {
  const [result] = await eslint.lintFiles([file]);
  const hits = (result?.messages ?? []).filter(
    (m) => m.ruleId === 'no-restricted-imports' && m.severity === 2,
  );

  if (hits.length === 0) {
    failures += 1;
    console.error(`FAIL  ${what}`);
    console.error(`      ${file} produced no boundary error. The guard is not working.`);
  } else {
    console.log(`ok    ${what}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} boundary guard(s) not enforced.`);
  process.exit(1);
}

console.log('\nPackage boundaries enforced.');
