import { ping } from '@community/store';

import { db } from '@/lib/db';
import { log } from '@/lib/log';

/**
 * Readiness: this instance can serve real pages, which today means the
 * configuration loads and Postgres answers. 503 otherwise. The body says which
 * check failed, never why: the reason is in the log, and may name a secret.
 */
export async function GET() {
  let database = false;
  try {
    database = await ping(db());
  } catch (error) {
    log().error({ err: error }, 'readiness: database check threw');
  }
  return Response.json(
    { status: database ? 'ready' : 'not-ready', checks: { database } },
    { status: database ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
