/** The admin console's writes (flows 8 to 12) against real Postgres. */
import type { QuestInput, RankInput } from '@community/core';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  adminCategories,
  adminRanks,
  adminUser,
  adminUsers,
  assignRank,
  createCategory,
  createQuest,
  createRank,
  deleteCategory,
  deleteQuest,
  deleteRank,
  deleteUser,
  moveCategory,
  removeRank,
  reviewQueue,
  setUserRole,
  updateQuest,
  updateRank,
} from './admin.js';
import { reviewSubmission } from './reviews.js';
import { submitProof } from './submissions.js';
import {
  createQuest as fixtureQuest,
  createRole,
  createUser,
  heldRoles,
  jobs,
  resetDatabase,
  testDatabaseUrl,
  testPool,
} from './testing.js';
import { xpTotal } from './xp.js';

const url = testDatabaseUrl();

const QUEST: QuestInput = {
  title: 'Write a thread',
  descriptionMd: '',
  xpReward: 40,
  icon: 'megaphone',
  categoryId: null,
  linkCount: 1,
  linkHint: null,
  startsAt: null,
  endsAt: null,
  rewardRoleId: null,
};

const RANK: RankInput = {
  name: 'Scout',
  description: '',
  color: null,
  icon: null,
  xpRequired: 100,
  discordRoleId: null,
};

describe.skipIf(url === undefined)('admin console (integration)', () => {
  const pool = testPool(url ?? '');
  let owner: string;
  let admin: string;
  let amb: string;

  beforeEach(async () => {
    await resetDatabase(pool);
    owner = await createUser(pool, { name: 'Owner', role: 'owner' });
    admin = await createUser(pool, { name: 'Admin', role: 'admin' });
    amb = await createUser(pool, { name: 'Ambassador' });
  });
  afterAll(() => pool.end());

  /** A pending submission by `userId`, approved by the admin when asked. */
  const earn = async (userId: string, questId: string, approve = true) => {
    const s = await submitProof(pool, {
      userId,
      questId,
      links: ['https://x.com/1'],
      proofFile: null,
    });
    if (!s.ok) throw new Error(`setup: ${s.reason}`);
    if (approve) {
      const r = await reviewSubmission(pool, {
        submissionId: s.submissionId,
        action: 'approve',
        actorId: userId === admin ? owner : admin,
      });
      if (!r.ok) throw new Error(`setup: ${r.reason}`);
    }
    return s.submissionId;
  };

  const roleOf = async (id: string) =>
    (await pool.query<{ role: string }>('SELECT role FROM users WHERE id = $1', [id])).rows[0]
      ?.role;

  describe('roles: only the owner manages admins (section 13.1)', () => {
    it('lets the owner promote and demote', async () => {
      expect(await setUserRole(pool, { actorId: owner, targetId: amb, to: 'admin' })).toEqual({
        ok: true,
        value: null,
      });
      expect(await roleOf(amb)).toBe('admin');
      await setUserRole(pool, { actorId: owner, targetId: amb, to: 'ambassador' });
      expect(await roleOf(amb)).toBe('ambassador');
    });

    it('never lets an admin change a role, least of all the owner’s', async () => {
      for (const [targetId, to] of [
        [owner, 'ambassador'],
        [amb, 'admin'],
      ] as const) {
        expect(await setUserRole(pool, { actorId: admin, targetId, to })).toEqual({
          ok: false,
          reason: 'owner_only',
        });
      }
      expect(await roleOf(owner)).toBe('owner');
      expect(await roleOf(amb)).toBe('ambassador');
    });

    it('reads the actor’s role from the database, not from the caller', async () => {
      // The owner was demoted on the host while their tab stayed open.
      await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [owner]);
      expect(await setUserRole(pool, { actorId: owner, targetId: amb, to: 'admin' })).toEqual({
        ok: false,
        reason: 'owner_only',
      });
    });

    it('allows at most one owner, in the database itself', async () => {
      await expect(
        pool.query(`UPDATE users SET role = 'owner' WHERE id = $1`, [admin]),
      ).rejects.toThrow(/users_one_owner/);
    });
  });

  describe('deleting users (section 13.5)', () => {
    it('removes everything of theirs and hands back their proof files', async () => {
      const quest = await fixtureQuest(pool, { xp: 30 });
      const submission = await earn(amb, quest);
      await pool.query(`UPDATE submissions SET proof_file = 'p.webp' WHERE id = $1`, [submission]);
      const discordId = (
        await pool.query<{ discord_id: string }>('SELECT discord_id FROM users WHERE id = $1', [
          amb,
        ])
      ).rows[0]!.discord_id;

      expect(
        await deleteUser(pool, { actorId: admin, targetId: amb, confirmName: 'Ambassador' }),
      ).toEqual({
        ok: true,
        value: ['p.webp'],
      });
      expect(await roleOf(amb)).toBeUndefined();
      expect(await xpTotal(pool, amb)).toBe(0);
      const { rows } = await pool.query(
        `SELECT payload FROM discord_jobs WHERE payload->>'deleted' = 'true'`,
      );
      expect(rows).toEqual([{ payload: { userId: amb, discordId, deleted: true } }]);
    });

    it('needs the name typed exactly', async () => {
      expect(
        await deleteUser(pool, { actorId: admin, targetId: amb, confirmName: 'ambassador' }),
      ).toEqual({
        ok: false,
        reason: 'name_mismatch',
      });
      expect(await roleOf(amb)).toBe('ambassador');
    });

    it('lets only the owner delete an admin, and nobody the owner', async () => {
      const admin2 = await createUser(pool, { name: 'Admin Two', role: 'admin' });
      expect(
        await deleteUser(pool, { actorId: admin, targetId: admin2, confirmName: 'Admin Two' }),
      ).toEqual({
        ok: false,
        reason: 'not_permitted',
      });
      expect(
        await deleteUser(pool, { actorId: admin, targetId: owner, confirmName: 'Owner' }),
      ).toEqual({
        ok: false,
        reason: 'owner_protected',
      });
      expect(
        await deleteUser(pool, { actorId: owner, targetId: owner, confirmName: 'Owner' }),
      ).toEqual({
        ok: false,
        reason: 'self',
      });
      expect(
        (await deleteUser(pool, { actorId: owner, targetId: admin2, confirmName: 'Admin Two' })).ok,
      ).toBe(true);
    });
  });

  describe('reviewing (section 13.3)', () => {
    it('refuses an admin reviewing their own submission', async () => {
      const quest = await fixtureQuest(pool);
      const mine = await earn(admin, quest, false);
      expect(
        await reviewSubmission(pool, { submissionId: mine, action: 'approve', actorId: admin }),
      ).toEqual({
        ok: false,
        reason: 'own_submission',
      });
    });

    it('refuses a rejection with no note', async () => {
      const submission = await earn(amb, await fixtureQuest(pool), false);
      expect(
        await reviewSubmission(pool, {
          submissionId: submission,
          action: 'reject',
          actorId: admin,
          note: ' ',
        }),
      ).toEqual({ ok: false, reason: 'note_required' });
    });

    it('queues pending oldest first, and shows who reviewed the rest', async () => {
      const first = await earn(amb, await fixtureQuest(pool), false);
      const second = await earn(amb, await fixtureQuest(pool), false);
      await pool.query(
        `UPDATE submissions SET updated_at = now() - interval '1 hour' WHERE id = $1`,
        [first],
      );
      expect((await reviewQueue(pool, { status: 'pending' })).map((q) => q.id)).toEqual([
        first,
        second,
      ]);

      await reviewSubmission(pool, { submissionId: second, action: 'approve', actorId: admin });
      expect(await reviewQueue(pool, { status: 'approved' })).toMatchObject([
        { id: second, reviewerName: 'Admin', user: { name: 'Ambassador' } },
      ]);
    });
  });

  describe('ranks (section 13.4)', () => {
    it('rechecks everyone when a threshold changes, sparing hand-assigned holders', async () => {
      const quest = await fixtureQuest(pool, { xp: 120 });
      await earn(amb, quest);
      const other = await createUser(pool, { name: 'Other' });
      const rank = await createRank(pool, { rank: RANK, actorId: admin }); // 100 XP
      if (!rank.ok) throw new Error('setup');
      expect(await heldRoles(pool, amb)).toEqual({ Scout: 'xp' });

      await assignRank(pool, { userId: other, roleId: rank.value, actorId: admin });
      await updateRank(pool, {
        id: rank.value,
        rank: { ...RANK, xpRequired: 500 },
        actorId: admin,
      });
      expect(await heldRoles(pool, amb)).toEqual({});
      expect(await heldRoles(pool, other)).toEqual({ Scout: 'manual' });

      await updateRank(pool, { id: rank.value, rank: { ...RANK, xpRequired: 50 }, actorId: admin });
      expect(await heldRoles(pool, amb)).toEqual({ Scout: 'xp' });
    });

    it('moves a quest’s reward role to everyone who completed it', async () => {
      const herald = await createRole(pool, { name: 'Herald' });
      const scribe = await createRole(pool, { name: 'Scribe' });
      const quest = await createQuest(pool, {
        quest: { ...QUEST, rewardRoleId: herald },
        actorId: admin,
      });
      if (!quest.ok) throw new Error('setup');
      await earn(amb, quest.value);
      expect(await heldRoles(pool, amb)).toEqual({ Herald: 'quest' });

      await updateQuest(pool, {
        id: quest.value,
        quest: { ...QUEST, rewardRoleId: scribe },
        actorId: admin,
      });
      expect(await heldRoles(pool, amb)).toEqual({ Scribe: 'quest' });
    });

    it('deletes a held rank from every holder and queues their syncs', async () => {
      const rank = await createRole(pool, { name: 'Gone' });
      await assignRank(pool, { userId: amb, roleId: rank, actorId: admin });
      await assignRank(pool, { userId: admin, roleId: rank, actorId: owner });
      await pool.query('DELETE FROM discord_jobs');

      expect(await deleteRank(pool, rank)).toEqual({ ok: true, value: 2 });
      expect(await heldRoles(pool, amb)).toEqual({});
      expect((await jobs(pool)).filter((j) => j.kind === 'sync_member_roles')).toHaveLength(2);
    });

    it('removes only hand-assigned ranks by hand', async () => {
      await earn(amb, await fixtureQuest(pool, { xp: 150 }));
      const scout = await createRank(pool, { rank: RANK, actorId: admin });
      const badge = await createRole(pool, { name: 'Badge' });
      if (!scout.ok) throw new Error('setup');
      await assignRank(pool, { userId: amb, roleId: badge, actorId: admin });

      expect(await assignRank(pool, { userId: amb, roleId: badge, actorId: admin })).toEqual({
        ok: false,
        reason: 'already_held',
      });
      expect(await removeRank(pool, { userId: amb, roleId: scout.value, actorId: admin })).toEqual({
        ok: false,
        reason: 'not_manual',
      });
      expect(await removeRank(pool, { userId: amb, roleId: badge, actorId: admin })).toEqual({
        ok: true,
      });
      expect(await heldRoles(pool, amb)).toEqual({ Scout: 'xp' });
    });

    it('counts holders and refuses a duplicate name', async () => {
      await createRank(pool, { rank: RANK, actorId: admin });
      expect(await createRank(pool, { rank: RANK, actorId: admin })).toEqual({
        ok: false,
        reason: 'duplicate',
      });
      expect((await adminRanks(pool)).map((r) => [r.name, r.holders])).toEqual([['Scout', 0]]);
    });
  });

  describe('quests and categories', () => {
    it('deletes a quest nobody submitted to, and refuses one with submissions', async () => {
      const empty = await createQuest(pool, { quest: QUEST, actorId: admin });
      const used = await createQuest(pool, { quest: QUEST, actorId: admin });
      if (!empty.ok || !used.ok) throw new Error('setup');
      await earn(amb, used.value, false);

      expect(await deleteQuest(pool, empty.value)).toEqual({ ok: true, value: null });
      expect(await deleteQuest(pool, used.value)).toEqual({ ok: false, reason: 'in_use' });
    });

    it('refuses a quest pointing at a category that does not exist', async () => {
      expect(
        await createQuest(pool, {
          quest: { ...QUEST, categoryId: '00000000-0000-0000-0000-000000000000' },
          actorId: admin,
        }),
      ).toEqual({ ok: false, reason: 'invalid_reference' });
    });

    it('creates, reorders and deletes categories', async () => {
      const a = await createCategory(pool, 'Alpha');
      const b = await createCategory(pool, 'Beta');
      if (!a.ok || !b.ok) throw new Error('setup');
      expect(await createCategory(pool, 'Alpha')).toEqual({ ok: false, reason: 'duplicate' });

      await moveCategory(pool, b.value, 'up');
      expect((await adminCategories(pool)).map((c) => c.name)).toEqual(['Beta', 'Alpha']);
      await moveCategory(pool, b.value, 'up'); // already first: no change
      expect((await adminCategories(pool)).map((c) => c.name)).toEqual(['Beta', 'Alpha']);

      expect(await deleteCategory(pool, a.value)).toEqual({ ok: true, value: null });
      expect((await adminCategories(pool)).map((c) => c.name)).toEqual(['Beta']);
    });
  });

  it('lists users staff first, searches by name, and shows ranks with their source', async () => {
    expect((await adminUsers(pool)).map((u) => u.role)).toEqual(['owner', 'admin', 'ambassador']);
    expect((await adminUsers(pool, { search: 'amba' })).map((u) => u.name)).toEqual(['Ambassador']);
    expect(await adminUsers(pool, { search: '%' })).toEqual([]);

    const badge = await createRole(pool, { name: 'Badge' });
    await assignRank(pool, { userId: amb, roleId: badge, actorId: admin });
    expect((await adminUser(pool, amb))?.ranks).toEqual([
      { roleId: badge, name: 'Badge', source: 'manual' },
    ]);
  });
});
