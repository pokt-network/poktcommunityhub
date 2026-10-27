import { describe, expect, it } from 'vitest';

import { type Pool, ping } from './pool.js';

const fakePool = (query: () => Promise<unknown>) => ({ query }) as unknown as Pool;

describe('ping', () => {
  it('is true when the database answers', async () => {
    expect(await ping(fakePool(async () => ({ rows: [] })))).toBe(true);
  });

  it('is false when the query fails', async () => {
    expect(await ping(fakePool(async () => Promise.reject(new Error('ECONNREFUSED'))))).toBe(false);
  });

  it('is false, promptly, when the database hangs', async () => {
    const started = Date.now();
    expect(
      await ping(
        fakePool(() => new Promise(() => {})),
        50,
      ),
    ).toBe(false);
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
