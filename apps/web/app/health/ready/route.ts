import { ping } from '@community/store';

import { webConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { log } from '@/lib/log';

/**
 * Readiness: this instance can serve real pages, which means the configuration
 * loads (sign-in included: without it every signed-in page fails closed) and
 * Postgres answers. 503 otherwise. The body says which check failed, never why:
 * the reason is in the log, and may name a secret.
 */
export async function GET() {
  let config = false;
  let database = false;
  try {
    webConfig();
    config = true;
  } catch (error) {
    log().error({ err: error }, 'readiness: configuration is invalid');
  }
  if (config) {
    try {
      database = await ping(db());
    } catch (error) {
      log().error({ err: error }, 'readiness: database check threw');
    }
  }
  const ready = config && database;
  return Response.json(
    { status: ready ? 'ready' : 'not-ready', checks: { config, database } },
    { status: ready ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
