/** The worker's job handling against real Postgres, with Discord faked. */
import { DiscordError } from '@community/discord';
import { createLogger, encryptSetting } from '@community/shared';
import {
  claimJob,
  createPool,
  deleteRank,
  queueMemberSync,
  queueNewQuestAnnouncements,
  saveAnnouncementSettings,
  WEBHOOK_PURPOSE,
  type Pool,
} from '@community/store';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { settle, type WorkerDeps } from './jobs.js';

const url = process.env['DATABASE_TEST_URL'] || undefined;
if (url === undefined && process.env['REQUIRE_DATABASE_TESTS'] === '1') {
  throw new Error('REQUIRE_DATABASE_TESTS=1 but DATABASE_TEST_URL is not set.');
}

// The store's own fixtures are not part of its surface; these are the few needed here.
const snowflake = () => `${Date.now()}${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
const resetDatabase = async (pool: Pool) => {
  for (const table of ['users', 'quests', 'server_roles', 'discord_jobs', 'app_settings']) {
    await pool.query(`DELETE FROM ${table}`);
  }
};
const insertId = async (pool: Pool, sql: string, values: unknown[]) =>
  (await pool.query<{ id: string }>(sql, values)).rows[0]!.id;
const createUser = (pool: Pool, fields: { name?: string; role?: string } = {}) =>
  insertId(pool, 'INSERT INTO users (discord_id, name, role) VALUES ($1, $2, $3) RETURNING id', [
    snowflake(),
    fields.name ?? 'Tester',
    fields.role ?? 'ambassador',
  ]);
const createQuest = (pool: Pool, fields: { xp?: number } = {}) =>
  insertId(pool, `INSERT INTO quests (title, xp_reward) VALUES ('Quest', $1) RETURNING id`, [
    fields.xp ?? 50,
  ]);
const createRole = (pool: Pool, fields: { name: string }) =>
  insertId(pool, 'INSERT INTO server_roles (name) VALUES ($1) RETURNING id', [fields.name]);
const KEY = 'c'.repeat(64);
const WEBHOOK = `https://discord.com/api/webhooks/111111111111111111/${'t'.repeat(68)}`;

describe.skipIf(url === undefined)('worker jobs (integration)', () => {
  const pool = createPool({ connectionString: url!, application_name: 'worker-test' });
  afterAll(() => pool.end());

  /** A Discord server in memory: member id → role ids. */
  let members: Map<string, Set<string>>;
  let posts: { url: string; content: string; username: string }[];
  let failNext: Error | null;
  let deps: WorkerDeps;

  beforeEach(async () => {
    await resetDatabase(pool);
    members = new Map();
    posts = [];
    failNext = null;
    const maybeFail = () => {
      const error = failNext;
      failNext = null;
      if (error !== null) throw error;
    };
    deps = {
      pool,
      bot: {
        memberRoles: async (id) => {
          maybeFail();
          const roles = members.get(id);
          return roles === undefined ? null : [...roles];
        },
        addRole: async (id, role) => void members.get(id)!.add(role),
        removeRole: async (id, role) => void members.get(id)!.delete(role),
      },
      postWebhook: async (to, message) => {
        maybeFail();
        posts.push({ url: to, content: message.content, username: message.username });
      },
      settingsKey: KEY,
      publicUrl: 'https://community.example',
      log: createLogger({ name: 'test', level: 'silent' }),
      now: () => new Date(),
    };
  });

  const runNext = async () => {
    const job = await claimJob(pool);
    if (job === null) throw new Error('no job due');
    await settle(deps, job);
    return job.id;
  };
  const jobRow = async (id: string) =>
    (
      await pool.query<{
        done: boolean;
        failed: boolean;
        note: string | null;
        last_error: string | null;
        attempts: number;
        wait_s: number;
      }>(
        `SELECT done_at IS NOT NULL AS done, failed_at IS NOT NULL AS failed, note, last_error,
                attempts, extract(epoch FROM next_attempt_at - now())::int AS wait_s
           FROM discord_jobs WHERE id = $1`,
        [id],
      )
    ).rows[0]!;

  /** A member in the hub and in the server, holding `ranks`. */
  const member = async (ranks: { id: string }[], discordRoles: string[] = []) => {
    const user = await createUser(pool, { name: 'Ada' });
    const { rows } = await pool.query<{ discord_id: string }>(
      'SELECT discord_id FROM users WHERE id = $1',
      [user],
    );
    const discordId = rows[0]!.discord_id;
    members.set(discordId, new Set(discordRoles));
    for (const rank of ranks) {
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id, source) VALUES ($1, $2, 'manual')`,
        [user, rank.id],
      );
    }
    return { user, discordId };
  };
  const linkedRank = async (name: string) => {
    const id = await createRole(pool, { name });
    const discordId = snowflake();
    await pool.query('UPDATE server_roles SET discord_role_id = $2 WHERE id = $1', [id, discordId]);
    return { id, discordId };
  };

  describe('member sync', () => {
    it('adds held linked roles, removes unheld ones, and leaves the rest alone', async () => {
      const herald = await linkedRank('Herald');
      const scout = await linkedRank('Scout');
      const moderator = snowflake();
      const ada = await member([herald], [scout.discordId, moderator]);
      await queueMemberSync(pool, ada.user);

      const id = await runNext();
      expect([...members.get(ada.discordId)!].sort()).toEqual([herald.discordId, moderator].sort());
      expect(await jobRow(id)).toMatchObject({ done: true, note: 'added 1, removed 1' });
    });

    it("takes a deleted rank's role off its former holders", async () => {
      const herald = await linkedRank('Herald');
      const ada = await member([herald], [herald.discordId]);
      await deleteRank(pool, herald.id);
      await runNext();
      expect(members.get(ada.discordId)!.size).toBe(0);
    });

    it('finishes with a note for a member who left the server (section 14.2)', async () => {
      const ada = await member([]);
      members.delete(ada.discordId);
      await queueMemberSync(pool, ada.user);
      expect(await jobRow(await runNext())).toMatchObject({
        done: true,
        note: 'not in the Discord server',
      });
    });

    it('retries a failure with backoff, and a rate limit after exactly the wait asked', async () => {
      const ada = await member([]);
      await queueMemberSync(pool, ada.user);
      failNext = new DiscordError(500, 'Discord answered 500');
      const id = await runNext();
      expect(await jobRow(id)).toMatchObject({
        done: false,
        failed: false,
        attempts: 1,
        wait_s: 30,
      });

      await pool.query('UPDATE discord_jobs SET next_attempt_at = now() WHERE id = $1', [id]);
      failNext = new DiscordError(429, 'Discord rate limit', null, 90_000);
      await runNext();
      expect(await jobRow(id)).toMatchObject({ attempts: 1, wait_s: 90 });
    });

    it('fails for good on the tenth attempt, and at once on a malformed payload', async () => {
      const ada = await member([]);
      await queueMemberSync(pool, ada.user);
      await pool.query('UPDATE discord_jobs SET attempts = 9');
      failNext = new DiscordError(403, 'Discord answered 403: Missing Permissions', 50013);
      const id = await runNext();
      expect(await jobRow(id)).toMatchObject({
        failed: true,
        last_error: 'Discord answered 403: Missing Permissions',
      });

      await pool.query(
        `INSERT INTO discord_jobs (kind, payload) VALUES ('sync_member_roles', '{"userId": 42}')`,
      );
      expect(await jobRow(await runNext())).toMatchObject({ failed: true, attempts: 1 });
    });
  });

  describe('announcements', () => {
    const settings = async (enabled: boolean, webhook: string | null = WEBHOOK) => {
      const admin = await createUser(pool, { role: 'admin' });
      await saveAnnouncementSettings(
        pool,
        {
          webhookCipher: webhook === null ? null : encryptSetting(webhook, KEY, WEBHOOK_PURPOSE),
          botName: 'Hub',
          avatarUrl: null,
          enabled: { new_quest: enabled, quest_completed: enabled, role_unlocked: enabled },
        },
        admin,
      );
    };

    it('skips, with a note, while announcements are off (section 14.6)', async () => {
      await createQuest(pool);
      await queueNewQuestAnnouncements(pool);
      expect(await jobRow(await runNext())).toMatchObject({
        done: true,
        note: 'announcements of this kind are off',
      });
      expect(posts).toEqual([]);
    });

    it('posts a new quest with its link', async () => {
      await settings(true);
      const quest = await createQuest(pool, { xp: 120 });
      await queueNewQuestAnnouncements(pool);
      await runNext();
      expect(posts).toEqual([
        {
          url: WEBHOOK,
          username: 'Hub',
          content: `New quest: **Quest** (120 XP)\nhttps://community.example/quests/${quest}`,
        },
      ]);
    });

    it('does not announce an approval that was undone before sending', async () => {
      await settings(true);
      const ada = await member([]);
      const quest = await createQuest(pool);
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO submissions (user_id, quest_id, proof_urls) VALUES ($1, $2, '{https://x.org}')
         RETURNING id`,
        [ada.user, quest],
      );
      await pool.query(`INSERT INTO discord_jobs (kind, payload) VALUES ('announce', $1)`, [
        { event: 'quest_completed', userId: ada.user, questId: quest, submissionId: rows[0]!.id },
      ]);
      expect(await jobRow(await runNext())).toMatchObject({ note: 'the approval was undone' });
      expect(posts).toEqual([]);
    });

    it('fails visibly, not silently, when the webhook does not decrypt', async () => {
      await settings(true);
      deps = { ...deps, settingsKey: 'd'.repeat(64) };
      await createQuest(pool);
      await queueNewQuestAnnouncements(pool);
      expect(await jobRow(await runNext())).toMatchObject({
        done: false,
        last_error: 'the saved webhook does not decrypt with this key',
      });
    });
  });
});
