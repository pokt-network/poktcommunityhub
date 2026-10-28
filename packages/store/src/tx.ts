import type pg from 'pg';

import type { Pool } from './pool.js';

export type Client = pg.PoolClient;

/**
 * Run `fn` in one transaction on one connection. Commits when `fn` resolves,
 * rolls back when it throws or when it returns a result marked `rollback`.
 *
 * A refusal found part-way through (a lost race, a state that no longer allows
 * the move) is a normal outcome, not an exception, so it rolls back without
 * throwing and the caller gets the refusal as a value.
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: Client) => Promise<T | Rollback<T>>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    if (result instanceof Rollback) {
      await client.query('ROLLBACK');
      return result.value;
    }
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Wraps a result that must be returned with the transaction rolled back. */
export class Rollback<T> {
  constructor(readonly value: T) {}
}

export const rollback = <T>(value: T) => new Rollback(value);
