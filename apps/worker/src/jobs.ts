import {
  afterJobFailure,
  announcementText,
  planMemberSync,
  type AnnouncementFacts,
} from '@community/core';
import { DiscordError, type DiscordBot } from '@community/discord';
import { decryptSetting, SNOWFLAKE, type Logger } from '@community/shared';
import {
  announcementSettings,
  announcementSubjects,
  failJob,
  finishJob,
  linkedRoleIds,
  memberRoleState,
  rescheduleJob,
  stillTrue,
  WEBHOOK_PURPOSE,
  type Job,
  type Pool,
} from '@community/store';
import { z } from 'zod';

/**
 * What the worker does with one claimed job (brief sections 4.3 and 14). A job
 * either finishes (perhaps with a note saying why nothing was sent) or throws;
 * `settle` turns a throw into a retry or a final failure.
 */

export type WorkerDeps = {
  pool: Pool;
  bot: Pick<DiscordBot, 'memberRoles' | 'addRole' | 'removeRole'>;
  postWebhook: (
    url: string,
    message: { content: string; username: string; avatarUrl: string | null },
  ) => Promise<void>;
  settingsKey: string;
  publicUrl: string;
  log: Logger;
  now: () => Date;
};

/** A job that can never succeed as queued (a malformed payload); not retried. */
export class PermanentError extends Error {
  override readonly name = 'PermanentError';
}

const uuid = z.uuid();
const snowflake = z.string().regex(SNOWFLAKE);

const syncPayload = z.union([
  z.object({ userId: uuid, discordId: snowflake, deleted: z.literal(true) }),
  z.object({ userId: uuid, unlinked: z.array(snowflake).optional() }),
]);

const announcePayload = z.discriminatedUnion('event', [
  z.object({ event: z.literal('new_quest'), questId: uuid }),
  z.object({
    event: z.literal('quest_completed'),
    userId: uuid,
    questId: uuid,
    submissionId: uuid,
  }),
  z.object({ event: z.literal('role_unlocked'), userId: uuid, roleId: uuid }),
]);

function parse<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) throw new PermanentError('the job payload is not one the worker knows');
  return result.data;
}

const REASON = 'POKT Community Hub: rank sync';

/**
 * Bring one member's Discord roles in line with the ranks they hold (section
 * 14.1). The hub's state is read now, not when the job was queued, so a job
 * replayed or run late does the right thing.
 */
async function syncMember(deps: WorkerDeps, payload: unknown): Promise<string | null> {
  const job = parse(syncPayload, payload);
  let discordId: string;
  let held: string[];
  if ('deleted' in job) {
    // The account is gone: take off every role the hub manages.
    discordId = job.discordId;
    held = [];
  } else {
    const state = await memberRoleState(deps.pool, job.userId);
    // Deleted since: their deletion queued its own job.
    if (state === null) return 'the member is no longer in the hub';
    discordId = state.discordId;
    held = state.held;
  }

  const current = await deps.bot.memberRoles(discordId);
  if (current === null) return 'not in the Discord server'; // section 14.2

  const managed = [
    ...(await linkedRoleIds(deps.pool)),
    ...('unlinked' in job ? (job.unlinked ?? []) : []),
  ];
  const plan = planMemberSync({ held, managed, current });
  for (const roleId of plan.add) await deps.bot.addRole(discordId, roleId, REASON);
  for (const roleId of plan.remove) await deps.bot.removeRole(discordId, roleId, REASON);
  return plan.add.length + plan.remove.length === 0
    ? 'already in sync'
    : `added ${plan.add.length}, removed ${plan.remove.length}`;
}

/** Post one announcement, if its kind is on and what it says is still true. */
async function announce(deps: WorkerDeps, payload: unknown): Promise<string | null> {
  const job = parse(announcePayload, payload);
  const settings = await announcementSettings(deps.pool);
  if (!settings.enabled[job.event]) return 'announcements of this kind are off';
  if (settings.webhookCipher === null) return 'no webhook is set';
  const webhook = decryptSetting(settings.webhookCipher, deps.settingsKey, WEBHOOK_PURPOSE);
  // Retried, then failed where admins see it: saving the webhook again fixes it.
  if (webhook === null) throw new Error('the saved webhook does not decrypt with this key');

  let facts: AnnouncementFacts | null = null;
  if (job.event === 'new_quest') {
    const found = await announcementSubjects(deps.pool, { questId: job.questId });
    if (found?.questTitle !== undefined && found.xp !== undefined) {
      facts = {
        event: 'new_quest',
        questTitle: found.questTitle,
        xp: found.xp,
        questUrl: `${deps.publicUrl}/quests/${job.questId}`,
      };
    }
  } else if (job.event === 'quest_completed') {
    if (!(await stillTrue(deps.pool, { approvedSubmissionId: job.submissionId }))) {
      return 'the approval was undone';
    }
    const found = await announcementSubjects(deps.pool, {
      userId: job.userId,
      questId: job.questId,
    });
    if (
      found?.memberName !== undefined &&
      found.questTitle !== undefined &&
      found.xp !== undefined
    ) {
      facts = {
        event: 'quest_completed',
        memberName: found.memberName,
        questTitle: found.questTitle,
        xp: found.xp,
      };
    }
  } else {
    if (!(await stillTrue(deps.pool, { userId: job.userId, holdsRoleId: job.roleId }))) {
      return 'the rank was lost again';
    }
    const found = await announcementSubjects(deps.pool, { userId: job.userId, roleId: job.roleId });
    if (found?.memberName !== undefined && found.rankName !== undefined) {
      facts = { event: 'role_unlocked', memberName: found.memberName, rankName: found.rankName };
    }
  }
  if (facts === null) return 'what it announced no longer exists';

  await deps.postWebhook(webhook, {
    content: announcementText(facts),
    username: settings.botName,
    avatarUrl: settings.avatarUrl,
  });
  return null;
}

export async function runJob(deps: WorkerDeps, job: Job): Promise<string | null> {
  switch (job.kind) {
    case 'sync_member_roles':
      return syncMember(deps, job.payload);
    case 'announce':
      return announce(deps, job.payload);
  }
}

/** Run a claimed job and record what happened. Never throws for the job's own failure. */
export async function settle(deps: WorkerDeps, job: Job): Promise<void> {
  try {
    const note = await runJob(deps, job);
    await finishJob(deps.pool, job.id, note);
    deps.log.info({ job: job.id, kind: job.kind, note }, 'job done');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof PermanentError) {
      await failJob(deps.pool, job.id, message);
      deps.log.error({ job: job.id, kind: job.kind, error: message }, 'job failed: malformed');
      return;
    }
    const decision = afterJobFailure({
      attempts: job.attempts,
      now: deps.now(),
      retryAfterMs: error instanceof DiscordError ? error.retryAfterMs : null,
    });
    if (decision.kind === 'failed') {
      await failJob(deps.pool, job.id, message);
      deps.log.error(
        { job: job.id, kind: job.kind, error: message },
        'job failed after its last attempt',
      );
    } else {
      await rescheduleJob(deps.pool, job.id, {
        at: decision.at,
        error: message,
        countsAsAttempt: decision.countsAsAttempt,
      });
      deps.log.warn(
        { job: job.id, kind: job.kind, error: message, retryAt: decision.at },
        'job will be retried',
      );
    }
  }
}
