/** The outbox, announcement settings and screenshot retention against real Postgres. */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { deleteRank, setQuestStatus, updateRank } from './admin.js';
import {
  announcementSettings,
  announcementSubjects,
  claimJob,
  DEFAULT_ANNOUNCEMENTS,
  failedJobs,
  failJob,
  finishJob,
  linkedRoleIds,
  linkRankRole,
  memberRoleState,
  purgeExpiredProofs,
  queueMemberSync,
  queueNewQuestAnnouncements,
  queueSummary,
  queueSyncAll,
  rescheduleJob,
  retryFailedJob,
  saveAnnouncementSettings,
} from './discord.js';
import {
  createQuest,
  createRole,
  createSubmission,
  createUser,
  resetDatabase,
  snowflake,
  testDatabaseUrl,
  testPool,
} from './testing.js';

const url = testDatabaseUrl();

describe.skipIf(url === undefined)('the Discord outbox (integration)', () => {
  const pool = testPool(url!);
  afterAll(() => pool.end());
  beforeEach(() => resetDatabase(pool));

  const payloads = async () =>
    (
      await pool.query<{ payload: Record<string, unknown> }>(
        'SELECT payload FROM discord_jobs ORDER BY id',
      )
    ).rows.map((row) => row.payload);

  const linkRole = async (name: string) => {
    const id = await createRole(pool, { name });
    const discordId = snowflake();
    await pool.query('UPDATE server_roles SET discord_role_id = $2 WHERE id = $1', [id, discordId]);
    return { id, discordId };
  };

  describe('claiming and finishing', () => {
    it('claims due jobs one at a time, counting the attempt and leasing it', async () => {
      const user = await createUser(pool);
      await queueMemberSync(pool, user);
      const job = await claimJob(pool);
      expect(job).toMatchObject({
        kind: 'sync_member_roles',
        payload: { userId: user },
        attempts: 1,
      });
      // Leased: not due again until the lease runs out.
      expect(await claimJob(pool)).toBeNull();
      await finishJob(pool, job!.id, 'not in the server');
      expect(await queueSummary(pool)).toEqual({ due: 0, waiting: 0, failed: 0, doneToday: 1 });
    });

    it('two workers never claim the same job', async () => {
      const user = await createUser(pool);
      await queueMemberSync(pool, user);
      await queueMemberSync(pool, user);
      const [a, b, c] = await Promise.all([claimJob(pool), claimJob(pool), claimJob(pool)]);
      const ids = [a, b, c].filter((j) => j !== null).map((j) => j!.id);
      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(2);
    });

    it('reschedules, gives a rate-limited attempt back, and fails for good', async () => {
      const user = await createUser(pool, { name: 'Ada' });
      await queueMemberSync(pool, user);
      const job = (await claimJob(pool))!;
      await rescheduleJob(pool, job.id, { at: new Date(0), error: '429', countsAsAttempt: false });
      expect((await claimJob(pool))!.attempts).toBe(1);
      await rescheduleJob(pool, job.id, { at: new Date(0), error: '500', countsAsAttempt: true });
      expect((await claimJob(pool))!.attempts).toBe(2);
      await failJob(pool, job.id, 'Missing Permissions');

      expect(await claimJob(pool)).toBeNull();
      expect(await failedJobs(pool)).toEqual([
        expect.objectContaining({
          id: job.id,
          memberName: 'Ada',
          lastError: 'Missing Permissions',
        }),
      ]);
      expect(await retryFailedJob(pool, job.id)).toBe(true);
      expect(await retryFailedJob(pool, job.id)).toBe(false);
      expect((await claimJob(pool))!.attempts).toBe(1);
    });

    it('queues a sync for every member', async () => {
      await createUser(pool);
      await createUser(pool);
      expect(await queueSyncAll(pool)).toBe(2);
      expect(await queueMemberSync(pool, '00000000-0000-0000-0000-000000000000')).toBe(false);
    });
  });

  describe('what a sync needs', () => {
    it("reads a member's linked roles, and every linked role", async () => {
      const user = await createUser(pool);
      const linked = await linkRole('Herald');
      await linkRole('Scout');
      const unlinked = await createRole(pool, { name: 'Unlinked' });
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id, source) VALUES ($1, $2, 'manual'), ($1, $3, 'manual')`,
        [user, linked.id, unlinked],
      );
      const state = await memberRoleState(pool, user);
      expect(state?.held).toEqual([linked.discordId]);
      expect(await linkedRoleIds(pool)).toHaveLength(2);
      expect(await memberRoleState(pool, '00000000-0000-0000-0000-000000000000')).toBeNull();
    });

    it("names a deleted rank's Discord role in its holders' syncs", async () => {
      const user = await createUser(pool);
      const rank = await linkRole('Herald');
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id, source) VALUES ($1, $2, 'manual')`,
        [user, rank.id],
      );
      await deleteRank(pool, rank.id);
      expect(await payloads()).toEqual([{ userId: user, unlinked: [rank.discordId] }]);
    });

    it("names the old Discord role when a rank's link changes", async () => {
      const user = await createUser(pool);
      const rank = await linkRole('Herald');
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id, source) VALUES ($1, $2, 'manual')`,
        [user, rank.id],
      );
      const next = snowflake();
      await updateRank(pool, {
        id: rank.id,
        actorId: user,
        rank: {
          name: 'Herald',
          description: '',
          color: null,
          icon: null,
          xpRequired: null,
          discordRoleId: next,
        },
      });
      expect(await payloads()).toEqual([{ userId: user, unlinked: [rank.discordId] }]);
    });

    it('links a created role only if the rank is as the console saw it', async () => {
      const user = await createUser(pool);
      const rank = await createRole(pool, { name: 'Herald' });
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id, source) VALUES ($1, $2, 'manual')`,
        [user, rank],
      );
      const created = snowflake();
      expect(
        await linkRankRole(pool, { rankId: rank, expected: snowflake(), discordRoleId: created }),
      ).toBe(false);
      expect(
        await linkRankRole(pool, { rankId: rank, expected: null, discordRoleId: created }),
      ).toBe(true);
      expect(await linkedRoleIds(pool)).toEqual([created]);
      expect(await payloads()).toEqual([{ userId: user, unlinked: [] }]);
    });
  });

  describe('announcements', () => {
    it('queues each live quest once, and a reopened one again', async () => {
      const live = await createQuest(pool);
      await createQuest(pool, { startsAt: new Date(Date.now() + 86_400_000) });
      await createQuest(pool, { status: 'closed' });
      await createQuest(pool, {
        endsAt: new Date(Date.now() - 1000),
        startsAt: new Date(Date.now() - 86_400_000),
      });

      expect(await queueNewQuestAnnouncements(pool)).toBe(1);
      expect(await queueNewQuestAnnouncements(pool)).toBe(0);
      expect(await payloads()).toEqual([{ event: 'new_quest', questId: live }]);

      await setQuestStatus(pool, { id: live, status: 'closed' });
      expect(await queueNewQuestAnnouncements(pool)).toBe(0);
      await setQuestStatus(pool, { id: live, status: 'active' });
      expect(await queueNewQuestAnnouncements(pool)).toBe(1);
    });

    it('a scheduled quest is announced when its start time arrives', async () => {
      const quest = await createQuest(pool, { startsAt: new Date(Date.now() + 86_400_000) });
      expect(await queueNewQuestAnnouncements(pool)).toBe(0);
      await pool.query(`UPDATE quests SET starts_at = now() - interval '1 second' WHERE id = $1`, [
        quest,
      ]);
      expect(await queueNewQuestAnnouncements(pool)).toBe(1);
    });

    it('reads what an announcement names, or null when it is gone', async () => {
      const user = await createUser(pool, { name: 'Ada' });
      const quest = await createQuest(pool, { xp: 70 });
      expect(await announcementSubjects(pool, { userId: user, questId: quest })).toEqual({
        memberName: 'Ada',
        questTitle: 'Quest',
        xp: 70,
      });
      expect(
        await announcementSubjects(pool, { roleId: '00000000-0000-0000-0000-000000000000' }),
      ).toBeNull();
    });

    it('starts with every announcement off, and saves what an admin sets', async () => {
      expect(await announcementSettings(pool)).toEqual(DEFAULT_ANNOUNCEMENTS);
      const admin = await createUser(pool, { role: 'admin' });
      const saved = {
        webhookCipher: 'v1.a.b.c',
        botName: 'Hub',
        avatarUrl: null,
        enabled: { new_quest: true, quest_completed: false, role_unlocked: true },
      };
      await saveAnnouncementSettings(pool, saved, admin);
      expect(await announcementSettings(pool)).toEqual(saved);
    });
  });

  describe('screenshot retention', () => {
    const withProof = async (file: string, reviewedDaysAgo: number | null) => {
      const user = await createUser(pool);
      const id = await createSubmission(pool, user, await createQuest(pool));
      await pool.query(
        `UPDATE submissions
            SET proof_file = $2,
                status = CASE WHEN $3::int IS NULL THEN 'pending' ELSE 'rejected' END,
                reviewed_at = CASE WHEN $3::int IS NULL THEN NULL
                                   ELSE now() - make_interval(days => $3::int) END
          WHERE id = $1`,
        [id, file, reviewedDaysAgo],
      );
      return id;
    };
    const fileOf = async (id: string) =>
      (
        await pool.query<{ f: string | null }>(
          'SELECT proof_file AS f FROM submissions WHERE id = $1',
          [id],
        )
      ).rows[0]!.f;

    it('deletes only reviewed screenshots past the cutoff, file first', async () => {
      const old = await withProof('old.webp', 61);
      const recent = await withProof('recent.webp', 10);
      const pending = await withProof('pending.webp', null);
      const removed: string[] = [];
      const cutoff = new Date(Date.now() - 60 * 86_400_000);

      expect(await purgeExpiredProofs(pool, cutoff, async (f) => void removed.push(f))).toBe(1);
      expect(removed).toEqual(['old.webp']);
      expect([await fileOf(old), await fileOf(recent), await fileOf(pending)]).toEqual([
        null,
        'recent.webp',
        'pending.webp',
      ]);
    });

    it('keeps the row pointing at the file when deleting it fails', async () => {
      const old = await withProof('old.webp', 61);
      await expect(
        purgeExpiredProofs(pool, new Date(), async () => {
          throw new Error('disk');
        }),
      ).rejects.toThrow('disk');
      expect(await fileOf(old)).toBe('old.webp');
    });
  });
});
