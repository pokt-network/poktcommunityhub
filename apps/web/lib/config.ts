import 'server-only';

import {
  encryptionKey,
  loadConfig,
  logLevel,
  originUrl,
  postgresUrl,
  requiredString,
  secret,
  snowflake,
  snowflakeList,
} from '@community/shared';
import { z } from 'zod';

/**
 * The web app's whole environment surface; `.env.example` at the repo root lists
 * the same names. Every sign-in variable is required: a deployment missing one
 * fails closed (no page that needs a session renders) instead of running open.
 */
const schema = z.object({
  DATABASE_URL: postgresUrl,
  LOG_LEVEL: logLevel,
  /**
   * The public origin, e.g. https://community.pocket.network. Auth.js builds the
   * OAuth redirect from it, and Discord refuses any redirect it was not given.
   * Not inferred from request headers: behind the standalone server those name
   * the container (0.0.0.0:3000), not the site. Auth.js reads it from the
   * environment itself; it is required here so a missing one fails readiness.
   */
  AUTH_URL: originUrl,
  /** Signs Auth.js cookies and CSRF tokens. */
  AUTH_SECRET: secret,
  AUTH_DISCORD_ID: snowflake,
  AUTH_DISCORD_SECRET: requiredString,
  /** The POKT server. Sign-in requires membership (brief section 9.4). */
  DISCORD_GUILD_ID: snowflake,
  /** First-admin bootstrap (brief section 4.5). Empty once an admin exists. */
  ADMIN_BOOTSTRAP_DISCORD_IDS: snowflakeList,
  /**
   * The bot (phase 6): the console's Discord page checks it, creates missing
   * roles and tests the webhook with it. The worker reads the same token.
   */
  DISCORD_BOT_TOKEN: requiredString,
  /** Encrypts the announcements webhook at rest (brief section 9.7). */
  SETTINGS_ENCRYPTION_KEY: encryptionKey,
  /** Where proof screenshots live: the `proofs` volume in docker-compose.yml. */
  PROOFS_DIR: z.string().min(1).default('/data/proofs'),
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
