import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  /**
   * Resolve `@community/*` to SOURCE, not to `dist`. Each package's `main` points
   * at `dist/index.js`, so without this a bare `pnpm test` tests whatever was last
   * built, and a stale `dist` gives a result about code nobody is looking at.
   */
  resolve: {
    alias: [
      {
        find: /^@community\/([^/]+)$/,
        replacement: fileURLToPath(new URL('./packages/$1/src/index.ts', import.meta.url)),
      },
    ],
  },
  test: {
    include: ['packages/**/src/**/*.test.ts', 'apps/**/lib/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
    // Integration suites (phase 2 on) share one database; files run one at a time.
    fileParallelism: false,
  },
});
