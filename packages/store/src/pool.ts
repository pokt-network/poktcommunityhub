import pg from 'pg';

export type Pool = pg.Pool;

export type PoolOptions = {
  connectionString: string;
  /** One app instance against its own Postgres; 10 is far more than the hub needs. */
  max?: number;
  application_name: string;
};

/**
 * One pool per process. The web app calls this from a module-level singleton,
 * the worker from its entrypoint; nothing else creates connections.
 */
export function createPool(options: PoolOptions): Pool {
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    max: options.max ?? 10,
    application_name: options.application_name,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // A query that runs longer than this is a bug, not a slow page.
    statement_timeout: 10_000,
  });
  // An idle client losing its connection emits here; unhandled, it kills the process.
  pool.on('error', () => {});
  return pool;
}

/**
 * Readiness: can this process run a query right now? Bounded, so a hung database
 * makes `/health/ready` answer 503 promptly instead of hanging the probe.
 */
export async function ping(pool: Pool, timeoutMs = 2_000): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([
      pool.query('SELECT 1').then(
        () => true,
        () => false,
      ),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
