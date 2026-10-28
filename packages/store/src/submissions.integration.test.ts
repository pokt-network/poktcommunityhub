/** Submitting and resubmitting proof (flows 3 and 4) against real Postgres. */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { reviewSubmission } from './reviews.js';
import { submitProof } from './submissions.js';
import {
  createQuest,
  createUser,
  resetDatabase,
  testDatabaseUrl,
  testPool,
  whileLocked,
} from './testing.js';

const url = testDatabaseUrl();
const NOW = new Date('2026-10-28T12:00:00Z');
const hours = (n: number) => new Date(NOW.getTime() + n * 3_600_000);

describe.skipIf(url === undefined)('submitProof (integration)', () => {
  const pool = testPool(url ?? '');
  let admin: string;
  let user: string;

  beforeEach(async () => {
    await resetDatabase(pool);
    admin = await createUser(pool, { role: 'admin' });
    user = await createUser(pool);
  });
  afterAll(() => pool.end());

  const submit = (
    questId: string,
    links = ['https://x.com/post/1'],
    proofFile: string | null = null,
  ) => submitProof(pool, { userId: user, questId, links, proofFile, now: NOW });

  it('creates a pending submission with trimmed links', async () => {
    const quest = await createQuest(pool, { linkCount: 2 });

    const result = await submit(quest, [' https://a.io/1 ', 'https://b.io/2'], 'proofs/a.png');

    expect(result).toMatchObject({ ok: true, kind: 'create', replacedFile: null });
    const { rows } = await pool.query(
      'SELECT status, proof_urls, proof_file FROM submissions WHERE user_id = $1',
      [user],
    );
    expect(rows).toEqual([
      {
        status: 'pending',
        proof_urls: ['https://a.io/1', 'https://b.io/2'],
        proof_file: 'proofs/a.png',
      },
    ]);
  });

  it('refuses a second submission while the first is pending or approved', async () => {
    const quest = await createQuest(pool);
    const first = await submit(quest);
    expect(await submit(quest)).toEqual({ ok: false, reason: 'already_pending' });

    if (!first.ok) throw new Error('setup');
    await reviewSubmission(pool, {
      submissionId: first.submissionId,
      action: 'approve',
      actorId: admin,
    });
    expect(await submit(quest)).toEqual({ ok: false, reason: 'already_approved' });
  });

  it('resubmits after a rejection: back to pending, review cleared, old file handed back', async () => {
    const quest = await createQuest(pool);
    const first = await submit(quest, undefined, 'proofs/old.png');
    if (!first.ok) throw new Error('setup');
    await reviewSubmission(pool, {
      submissionId: first.submissionId,
      action: 'reject',
      actorId: admin,
      note: 'blurry',
    });

    const again = await submit(quest, ['https://x.com/post/2'], 'proofs/new.png');

    expect(again).toEqual({
      ok: true,
      submissionId: first.submissionId,
      kind: 'resubmit',
      replacedFile: 'proofs/old.png',
    });
    const { rows } = await pool.query('SELECT * FROM submissions WHERE id = $1', [
      first.submissionId,
    ]);
    expect(rows[0]).toMatchObject({
      status: 'pending',
      proof_urls: ['https://x.com/post/2'],
      proof_file: 'proofs/new.png',
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
    });
  });

  it.each([
    ['closed', { status: 'closed' as const }],
    ['not yet started', { startsAt: hours(1) }],
    ['ended', { endsAt: hours(-1) }],
    ['ending at this instant', { endsAt: NOW }],
  ])('refuses a quest that is %s', async (_label, fields) => {
    const quest = await createQuest(pool, fields);
    expect(await submit(quest)).toEqual({ ok: false, reason: 'quest_not_live' });
  });

  it('refuses the wrong number of links, or a link that is not http(s)', async () => {
    const quest = await createQuest(pool, { linkCount: 2 });
    expect(await submit(quest, ['https://a.io'])).toEqual({
      ok: false,
      reason: 'wrong_link_count',
    });
    expect(await submit(quest, ['https://a.io', 'javascript:alert(1)'])).toEqual({
      ok: false,
      reason: 'invalid_link',
    });
    const { rows } = await pool.query('SELECT 1 FROM submissions');
    expect(rows).toEqual([]);
  });

  it('answers quest_not_found for a quest that does not exist', async () => {
    expect(await submit('00000000-0000-0000-0000-000000000000')).toEqual({
      ok: false,
      reason: 'quest_not_found',
    });
  });

  // ── Adversarial ──────────────────────────────────────────────────────────

  it('creates one submission when ten arrive at once', async () => {
    const quest = await createQuest(pool);

    const results = await Promise.all(Array.from({ length: 10 }, () => submit(quest)));

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM submissions');
    expect(rows[0].n).toBe(1);
  });

  it('accepts one of ten simultaneous resubmissions', async () => {
    const quest = await createQuest(pool);
    const first = await submit(quest);
    if (!first.ok) throw new Error('setup');
    await reviewSubmission(pool, {
      submissionId: first.submissionId,
      action: 'reject',
      actorId: admin,
    });

    const results = await whileLocked(
      pool,
      { sql: 'SELECT 1 FROM submissions WHERE id = $1 FOR UPDATE', params: [first.submissionId] },
      () => Array.from({ length: 10 }, (_, i) => submit(quest, [`https://x.com/post/${i}`])),
    );

    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it('cannot resubmit over an approval being made at the same moment', async () => {
    const quest = await createQuest(pool);
    const first = await submit(quest);
    if (!first.ok) throw new Error('setup');
    await reviewSubmission(pool, {
      submissionId: first.submissionId,
      action: 'reject',
      actorId: admin,
    });
    await reviewSubmission(pool, {
      submissionId: first.submissionId,
      action: 'undo',
      actorId: admin,
    });

    // Pending again: an approval and a resubmission race. The resubmission must lose.
    const [approved, resubmitted] = await Promise.all([
      reviewSubmission(pool, {
        submissionId: first.submissionId,
        action: 'approve',
        actorId: admin,
      }),
      submit(quest, ['https://x.com/swapped']),
    ]);

    expect(approved.ok).toBe(true);
    expect(resubmitted.ok).toBe(false);
    const { rows } = await pool.query('SELECT proof_urls FROM submissions WHERE id = $1', [
      first.submissionId,
    ]);
    expect(rows[0].proof_urls).toEqual(['https://x.com/post/1']);
  });
});
