import { rm, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { proofRetentionCutoff } from '@community/core';
import { discordBot, executeWebhook } from '@community/discord';
import { createLogger } from '@community/shared';
import {
  claimJob,
  createPool,
  purgeExpiredProofs,
  queueNewQuestAnnouncements,
} from '@community/store';

import { workerConfig } from './config.js';
import { settle, type WorkerDeps } from './jobs.js';

/**
 * The worker's loop. Every few seconds it queues announcements for quests that
 * have just gone live, then drains the due jobs one at a time; once an hour it
 * deletes screenshots past retention. One job at a time keeps it well inside
 * Discord's rate limits and needs no coordination.
 *
 * Health: each pass touches HEARTBEAT, and the compose health check fails when
 * it is more than a minute old, so a wedged loop shows as unhealthy.
 */

const IDLE_MS = 5_000;
const BATCH = 50;
const PURGE_EVERY_MS = 60 * 60_000;
const HEARTBEAT = '/tmp/worker-heartbeat';

const log = createLogger({ name: 'community-worker', level: process.env['LOG_LEVEL'] || 'info' });

/** The proofs volume's names, as web/lib/proofs.ts writes them; nothing else is deleted. */
const PROOF_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

async function main(): Promise<void> {
  const config = workerConfig();
  const pool = createPool({
    connectionString: config.DATABASE_URL,
    application_name: 'community-worker',
    max: 3,
  });
  const deps: WorkerDeps = {
    pool,
    bot: discordBot({ token: config.DISCORD_BOT_TOKEN, guildId: config.DISCORD_GUILD_ID }),
    postWebhook: (url, message) => executeWebhook(url, message),
    settingsKey: config.SETTINGS_ENCRYPTION_KEY,
    publicUrl: config.AUTH_URL,
    log,
    now: () => new Date(),
  };

  const removeProof = async (file: string) => {
    if (!PROOF_NAME.test(file)) throw new Error('not a proof file name');
    await rm(path.join(config.PROOFS_DIR, file), { force: true });
  };

  let stopping = false;
  let wake: (() => void) | undefined;
  const stop = () => {
    stopping = true;
    wake?.();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  log.info({ guild: config.DISCORD_GUILD_ID }, 'worker started');
  let lastPurge = 0;
  while (!stopping) {
    let ran = 0;
    try {
      const queued = await queueNewQuestAnnouncements(pool);
      if (queued > 0) log.info({ queued }, 'new quests queued for announcement');

      if (Date.now() - lastPurge >= PURGE_EVERY_MS) {
        const purged = await purgeExpiredProofs(
          pool,
          proofRetentionCutoff(new Date()),
          removeProof,
        );
        if (purged > 0) log.info({ purged }, 'expired proof screenshots deleted');
        lastPurge = Date.now();
      }

      while (!stopping && ran < BATCH) {
        const job = await claimJob(pool);
        if (job === null) break;
        await settle(deps, job);
        await touch(HEARTBEAT);
        ran += 1;
      }
    } catch (error) {
      // The database is down, or not migrated yet: log it and try again next pass.
      log.error({ err: error }, 'worker pass failed');
    }
    // Liveness, like web's /health/live: the loop is turning. A database it
    // cannot use shows in the logs and in the console's queue, not as a restart.
    await touch(HEARTBEAT).catch(() => {});
    // A full batch means more may be due: go again at once.
    if (!stopping && ran < BATCH) {
      await new Promise<void>((resolve) => {
        wake = resolve;
        setTimeout(resolve, IDLE_MS);
      });
    }
  }

  log.info('worker stopping');
  await pool.end();
}

async function touch(file: string): Promise<void> {
  const now = new Date();
  try {
    await utimes(file, now, now);
  } catch {
    await writeFile(file, '');
  }
}

main().catch((error: unknown) => {
  log.fatal({ err: error }, 'worker could not start');
  process.exit(1);
});
