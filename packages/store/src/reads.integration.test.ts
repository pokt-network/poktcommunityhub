/** The ambassador-page reads (flows 2, 3, 5 and 7) against real Postgres. */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { reviewSubmission } from './reviews.js';
import {
  listCategories,
  profile,
  proofFile,
  questBoard,
  questDetail,
  submissionHistory,
} from './reads.js';
import { submitProof } from './submissions.js';
import {
  createQuest,
  createRole,
  createUser,
  resetDatabase,
  testDatabaseUrl,
  testPool,
} from './testing.js';

const url = testDatabaseUrl();
const NOW = new Date('2026-10-28T12:00:00Z');
const hours = (n: number) => new Date(NOW.getTime() + n * 3_600_000);

describe.skipIf(url === undefined)('ambassador reads (integration)', () => {
  const pool = testPool(url ?? '');
  let admin: string;
  let user: string;

  beforeEach(async () => {
    await resetDatabase(pool);
    admin = await createUser(pool, { role: 'admin', name: 'Admin' });
    user = await createUser(pool, { name: 'Ambassador' });
  });
  afterAll(() => pool.end());

  const category = async (name: string, position = 0) =>
    (
      await pool.query<{ id: string }>(
        'INSERT INTO quest_categories (name, position) VALUES ($1, $2) RETURNING id',
        [name, position],
      )
    ).rows[0]!.id;

  const titled = async (questId: string, title: string, categoryId: string | null = null) => {
    await pool.query('UPDATE quests SET title = $2, category_id = $3 WHERE id = $1', [
      questId,
      title,
      categoryId,
    ]);
    return questId;
  };

  const submit = (questId: string, proofFile: string | null = null, userId = user) =>
    submitProof(pool, {
      userId,
      questId,
      links: ['https://x.com/post/1'],
      proofFile,
      now: NOW,
    });

  const review = (submissionId: string, action: 'approve' | 'reject' | 'undo', note?: string) =>
    reviewSubmission(pool, { submissionId, action, actorId: admin, note: note ?? null });

  describe('questBoard', () => {
    it('shows live quests only, with the viewer status', async () => {
      const live = await titled(await createQuest(pool), 'Live');
      await titled(await createQuest(pool, { status: 'closed' }), 'Closed');
      await titled(await createQuest(pool, { startsAt: hours(1) }), 'Scheduled');
      await titled(await createQuest(pool, { endsAt: NOW }), 'Ended exactly now');
      await submit(live);

      const signedOut = await questBoard(pool, { viewerId: null, now: NOW });
      expect(signedOut.map((q) => [q.title, q.viewerStatus])).toEqual([['Live', null]]);
      const mine = await questBoard(pool, { viewerId: user, now: NOW });
      expect(mine.map((q) => [q.title, q.viewerStatus])).toEqual([['Live', 'pending']]);
    });

    it('filters by category and by progress, and sorts by deadline', async () => {
      const social = await category('Social');
      const a = await titled(await createQuest(pool, { endsAt: hours(48) }), 'A', social);
      const b = await titled(await createQuest(pool, { endsAt: hours(2) }), 'B', social);
      await titled(await createQuest(pool), 'C');
      await submit(a);

      const board = (filter: Parameters<typeof questBoard>[1]['filter']) =>
        questBoard(pool, { viewerId: user, filter, now: NOW }).then((qs) => qs.map((q) => q.title));

      expect(await board({ categoryId: social, sort: 'ending' })).toEqual(['B', 'A']);
      expect(await board({ progress: 'pending' })).toEqual(['A']);
      expect((await board({ progress: 'not_started' })).sort()).toEqual(['B', 'C']);
      void b;
    });

    it('ignores a progress filter when signed out', async () => {
      await titled(await createQuest(pool), 'Only');
      const qs = await questBoard(pool, {
        viewerId: null,
        filter: { progress: 'approved' },
        now: NOW,
      });
      expect(qs.map((q) => q.title)).toEqual(['Only']);
    });
  });

  describe('questDetail', () => {
    it("shows the viewer's own submission and nobody else's", async () => {
      const quest = await createQuest(pool);
      const other = await createUser(pool, { name: 'Other' });
      const theirs = await submit(quest, null, other);
      if (!theirs.ok) throw new Error('setup');
      await review(theirs.submissionId, 'reject', 'their private note');

      expect((await questDetail(pool, { questId: quest, viewerId: user }))?.submission).toBeNull();
      expect((await questDetail(pool, { questId: quest, viewerId: null }))?.submission).toBeNull();
      const forOther = await questDetail(pool, { questId: quest, viewerId: other });
      expect(forOther?.submission).toMatchObject({
        status: 'rejected',
        reviewNote: 'their private note',
      });
    });

    it('includes the reward role and category, and answers null for no quest', async () => {
      const role = await createRole(pool, { name: 'Herald' });
      const cat = await category('Content');
      const quest = await titled(await createQuest(pool, { rewardRoleId: role }), 'Write', cat);
      expect(await questDetail(pool, { questId: quest, viewerId: null })).toMatchObject({
        title: 'Write',
        category: { id: cat, name: 'Content' },
        rewardRole: { name: 'Herald', color: null },
      });
      expect(
        await questDetail(pool, {
          questId: '00000000-0000-0000-0000-000000000000',
          viewerId: null,
        }),
      ).toBeNull();
    });
  });

  it('listCategories orders by position, then name', async () => {
    await category('Zeta', 0);
    await category('Alpha', 1);
    await category('Beta', 0);
    expect((await listCategories(pool)).map((c) => c.name)).toEqual(['Beta', 'Zeta', 'Alpha']);
  });

  describe('submissionHistory', () => {
    it('lists every submission with its net XP', async () => {
      const q1 = await titled(await createQuest(pool, { xp: 30 }), 'Approved');
      const q2 = await titled(await createQuest(pool, { xp: 40 }), 'Undone');
      const s1 = await submit(q1);
      const s2 = await submit(q2);
      if (!s1.ok || !s2.ok) throw new Error('setup');
      await review(s1.submissionId, 'approve');
      await review(s2.submissionId, 'approve');
      await review(s2.submissionId, 'undo');

      const history = await submissionHistory(pool, user);
      const byTitle = Object.fromEntries(history.map((h) => [h.questTitle, [h.status, h.xp]]));
      expect(byTitle).toEqual({ Approved: ['approved', 30], Undone: ['pending', 0] });
      expect(await submissionHistory(pool, admin)).toEqual([]);
    });
  });

  describe('profile', () => {
    it('shows XP, roles and completed quests, and nothing pending or rejected', async () => {
      const role = await createRole(pool, { name: 'Scout', xpRequired: 10 });
      const done = await titled(await createQuest(pool, { xp: 25 }), 'Done');
      const waiting = await titled(await createQuest(pool), 'Waiting');
      const refused = await titled(await createQuest(pool), 'Refused');
      const s = await submit(done);
      const r = await submit(refused);
      await submit(waiting);
      if (!s.ok || !r.ok) throw new Error('setup');
      await review(s.submissionId, 'approve');
      await review(r.submissionId, 'reject', 'private refusal note');

      const p = await profile(pool, user);
      expect(p).toMatchObject({ name: 'Ambassador', xp: 25, roles: [{ name: 'Scout' }] });
      expect(p?.completed.map((c) => [c.title, c.xp])).toEqual([['Done', 25]]);
      expect(JSON.stringify(p)).not.toContain('private refusal note');
      expect(JSON.stringify(p)).not.toContain('Refused');
      expect(JSON.stringify(p)).not.toContain('Waiting');
      void role;
    });

    it('answers null for no such user', async () => {
      expect(await profile(pool, '00000000-0000-0000-0000-000000000000')).toBeNull();
    });
  });

  it('proofFile names the owner and the file, or null when there is none', async () => {
    const quest = await createQuest(pool);
    const withFile = await submit(quest, 'a.webp');
    const quest2 = await createQuest(pool);
    const without = await submit(quest2);
    if (!withFile.ok || !without.ok) throw new Error('setup');
    expect(await proofFile(pool, withFile.submissionId)).toEqual({ userId: user, file: 'a.webp' });
    expect(await proofFile(pool, without.submissionId)).toBeNull();
  });
});
