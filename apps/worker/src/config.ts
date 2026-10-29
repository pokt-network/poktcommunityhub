import {
  encryptionKey,
  loadConfig,
  logLevel,
  originUrl,
  postgresUrl,
  requiredString,
  snowflake,
} from '@community/shared';
import { z } from 'zod';

/**
 * The worker's environment. It reads the same `.env.web` as the web app (the
 * names below are a subset), and like it fails closed: a missing variable stops
 * the process at start, before any job is claimed.
 */
const schema = z.object({
  DATABASE_URL: postgresUrl,
  LOG_LEVEL: logLevel,
  /** The public origin, for links in announcements. */
  AUTH_URL: originUrl,
  /** The bot's token (Discord developer portal → Bot). */
  DISCORD_BOT_TOKEN: requiredString,
  /** The server whose roles the hub manages. */
  DISCORD_GUILD_ID: snowflake,
  /** Decrypts the announcements webhook (brief section 9.7). */
  SETTINGS_ENCRYPTION_KEY: encryptionKey,
  /** The proofs volume, for the 60-day retention (section 9.6). */
  PROOFS_DIR: z.string().min(1).default('/data/proofs'),
});

export type WorkerConfig = z.output<typeof schema>;

export const workerConfig = (env?: Record<string, string | undefined>): WorkerConfig =>
  loadConfig(schema, env);
