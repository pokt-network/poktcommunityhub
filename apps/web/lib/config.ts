import 'server-only';

import { loadConfig, logLevel, postgresUrl } from '@community/shared';
import { z } from 'zod';

/**
 * The web app's whole environment surface. Phase 3 adds the Discord and Auth.js
 * variables here; `.env.example` at the repo root lists the same names.
 */
const schema = z.object({
  DATABASE_URL: postgresUrl,
  LOG_LEVEL: logLevel,
});

export type WebConfig = z.output<typeof schema>;

let cached: WebConfig | undefined;

/**
 * Read once, on first use rather than at import: `next build` imports server
 * modules with no runtime environment, and a config check there would fail the
 * build for a variable only the running container has.
 */
export function webConfig(): WebConfig {
  cached ??= loadConfig(schema);
  return cached;
}
