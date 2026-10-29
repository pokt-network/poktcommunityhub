'use server';

import {
  ANNOUNCE_EVENTS,
  checkWebhookSettings,
  roleColor,
  type AnnounceEvent,
  type WebhookFields,
} from '@community/core';
import { executeWebhook } from '@community/discord';
import { decryptSetting, encryptSetting } from '@community/shared';
import {
  announcementSettings,
  linkableRanks,
  linkRankRole,
  queueMemberSync,
  queueSyncAll,
  retryAllFailedJobs,
  retryFailedJob,
  saveAnnouncementSettings,
  WEBHOOK_PURPOSE,
} from '@community/store';
import { revalidatePath } from 'next/cache';

import { adminAction } from './actions';
import { webConfig } from './config';
import { db } from './db';
import { bot, describeDiscordError } from './discord-bot';
import { describeErrors, optionalText, text, type FormState } from './forms';
import { isUuid } from './ids';
import { log } from './log';

/**
 * The console's Discord actions (flow 13). Role changes go through the outbox
 * (brief section 4.3): these queue jobs and the worker carries them out. Only
 * creating missing roles and testing the webhook call Discord directly, because
 * the admin is waiting on the answer.
 */

const ok = (notice: string): FormState => ({ error: null, notice });
const fail = (error: string): FormState => ({ error, notice: null });
const PAGE = '/admin/discord';

export const syncMemberAction = adminAction(
  'syncMember',
  async (_admin, _state: FormState, form: FormData): Promise<FormState> => {
    const userId = text(form, 'userId');
    if (!isUuid(userId) || !(await queueMemberSync(db(), userId))) {
      return fail('That member no longer exists. Reload the page.');
    }
    revalidatePath(PAGE);
    return ok('Queued: the worker syncs their Discord roles within a minute.');
  },
);

/** Section 14.4: the drift fix. */
export const syncAllAction = adminAction(
  'syncAll',
  async (_admin, _state: FormState, _form: FormData): Promise<FormState> => {
    const queued = await queueSyncAll(db());
    revalidatePath(PAGE);
    return ok(`Queued a sync for ${queued} ${queued === 1 ? 'member' : 'members'}.`);
  },
);

export const retryJobAction = adminAction(
  'retryJob',
  async (_admin, _state: FormState, form: FormData): Promise<FormState> => {
    const jobId = text(form, 'jobId');
    if (jobId === 'all') {
      const count = await retryAllFailedJobs(db());
      revalidatePath(PAGE);
      return ok(`Retrying ${count} ${count === 1 ? 'job' : 'jobs'}.`);
    }
    if (!/^\d{1,18}$/.test(jobId) || !(await retryFailedJob(db(), jobId))) {
      return fail('That job is no longer failed. Reload the page.');
    }
    revalidatePath(PAGE);
    return ok('Retrying.');
  },
);

/**
 * Flow 13: create a Discord role for each rank that has none (or whose role was
 * deleted in Discord), and link it. New roles have no permissions and land at
 * the bottom of the list, below the bot's own.
 */
export const createMissingRolesAction = adminAction(
  'createMissingRoles',
  async (_admin, _state: FormState, _form: FormData): Promise<FormState> => {
    const client = bot();
    let existing: Set<string>;
    try {
      existing = new Set((await client.roles()).map((role) => role.id));
    } catch (error) {
      return fail(describeDiscordError(error));
    }
    const missing = (await linkableRanks(db())).filter(
      (rank) => rank.discordRoleId === null || !existing.has(rank.discordRoleId),
    );
    if (missing.length === 0) return ok('Every rank already has its Discord role.');

    let created = 0;
    for (const rank of missing) {
      let roleId: string;
      try {
        roleId = await client.createRole(
          { name: rank.name, color: roleColor(rank.color) },
          'POKT Community Hub: role for a rank',
        );
      } catch (error) {
        revalidatePath(PAGE);
        const done = created === 0 ? '' : `Created ${created} before stopping. `;
        return fail(`${done}${describeDiscordError(error)}`);
      }
      if (
        await linkRankRole(db(), {
          rankId: rank.id,
          expected: rank.discordRoleId,
          discordRoleId: roleId,
        })
      ) {
        created += 1;
      } else {
        // Changed or deleted while this ran: the new role is linked to nothing.
        log().warn(
          { rank: rank.id, roleId },
          'created a Discord role for a rank that changed meanwhile',
        );
      }
    }
    revalidatePath(PAGE);
    revalidatePath('/admin/ranks');
    return ok(
      `Created and linked ${created} ${created === 1 ? 'role' : 'roles'}; holders are queued for a sync.`,
    );
  },
);

const WEBHOOK_LABELS: Record<WebhookFields, string> = {
  webhookUrl: 'Webhook URL',
  botName: 'Name',
  avatarUrl: 'Avatar',
};

/**
 * Announcement settings (flow 13; sections 9.7 and 14.6). The webhook URL is
 * write-only: a blank field keeps the saved one, and it is stored encrypted.
 */
export const saveAnnouncementsAction = adminAction(
  'saveAnnouncements',
  async (admin, _state: FormState, form: FormData): Promise<FormState> => {
    const webhookUrl = optionalText(form, 'webhookUrl');
    const botName = text(form, 'botName').trim();
    const avatarUrl = optionalText(form, 'avatarUrl');
    const errors = checkWebhookSettings({ webhookUrl, botName, avatarUrl });
    if (Object.keys(errors).length > 0) return fail(describeErrors(errors, WEBHOOK_LABELS));

    const current = await announcementSettings(db());
    const enabled = Object.fromEntries(
      ANNOUNCE_EVENTS.map((event) => [event, form.get(`announce_${event}`) === 'on']),
    ) as Record<AnnounceEvent, boolean>;
    const webhookCipher =
      form.get('removeWebhook') === 'on'
        ? null
        : webhookUrl !== null
          ? encryptSetting(webhookUrl, settingsKey(), WEBHOOK_PURPOSE)
          : current.webhookCipher;

    await saveAnnouncementSettings(db(), { webhookCipher, botName, avatarUrl, enabled }, admin.id);
    revalidatePath(PAGE);
    return ok('Saved.');
  },
);

export const testWebhookAction = adminAction(
  'testWebhook',
  async (admin, _state: FormState, _form: FormData): Promise<FormState> => {
    const settings = await announcementSettings(db());
    if (settings.webhookCipher === null) return fail('Save a webhook URL first.');
    const url = decryptSetting(settings.webhookCipher, settingsKey(), WEBHOOK_PURPOSE);
    if (url === null) return fail('The saved webhook cannot be read with this key. Save it again.');
    try {
      await executeWebhook(url, {
        content: `Test message from the POKT Community Hub, sent by ${admin.name}.`,
        username: settings.botName,
        avatarUrl: settings.avatarUrl,
      });
    } catch (error) {
      return fail(describeDiscordError(error));
    }
    return ok('Sent. Check the channel.');
  },
);

const settingsKey = () => webConfig().SETTINGS_ENCRYPTION_KEY;
