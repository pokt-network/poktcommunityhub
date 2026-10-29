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
      // The web app's own `@/` paths (apps/web/tsconfig.json).
      { find: /^@\/(.*)$/, replacement: fileURLToPath(new URL('./apps/web/$1', import.meta.url)) },
      // `server-only` throws when imported outside a React server build, which a
      // test is. The guard it gives is a build-time one; tests do not need it.
      {
        find: /^server-only$/,
        replacement: fileURLToPath(new URL('./tools/test-stubs/server-only.ts', import.meta.url)),
      },
    ],
  },
  test: {
    include: [
      'packages/**/src/**/*.test.ts',
      'apps/**/lib/**/*.test.ts',
      'apps/worker/src/**/*.test.ts',
    ],
    environment: 'node',
    restoreMocks: true,
    // Integration suites (phase 2 on) share one database; files run one at a time.
    fileParallelism: false,
  },
});
