import { ANNOUNCE_EVENTS, ANNOUNCE_LABELS, maskWebhook } from '@community/core';
import { decryptSetting } from '@community/shared';
import {
  announcementSettings,
  failedJobs,
  linkableRanks,
  queueSummary,
  WEBHOOK_PURPOSE,
} from '@community/store';
import type { Metadata } from 'next';

import { requireAdmin } from '@/lib/authz';
import { webConfig } from '@/lib/config';
import {
  createMissingRolesAction,
  retryJobAction,
  saveAnnouncementsAction,
  syncAllAction,
  testWebhookAction,
} from '@/lib/discord-actions';
import { botStatus } from '@/lib/discord-bot';
import { db } from '@/lib/db';
import { formatDate } from '@/lib/format';

import { ActionForm } from '@/app/action-form';
import styles from '@/app/hub.module.css';
import { AdminFrame } from '../admin-frame';

export const metadata: Metadata = { title: 'Discord' };

const EVENT_HINTS = {
  new_quest: 'when a quest goes live',
  quest_completed: 'names the member',
  role_unlocked: 'names the member',
} as const;

/**
 * Flow 13 (brief section 14): the bot's status, ranks and their Discord roles,
 * the sync queue and its failures, and announcements.
 */
export default async function DiscordPage() {
  await requireAdmin();
  const pool = db();
  const [ranks, summary, failed, settings] = await Promise.all([
    linkableRanks(pool),
    queueSummary(pool),
    failedJobs(pool),
    announcementSettings(pool),
  ]);
  const linked = ranks.flatMap((r) => (r.discordRoleId === null ? [] : [r.discordRoleId]));
  const status = await botStatus(linked);
  const roleNames = new Map(status.ok ? status.roles.map((r) => [r.id, r.name]) : []);
  const outranked = new Set(status.ok ? status.readiness.outranked : []);
  const webhook =
    settings.webhookCipher === null
      ? null
      : decryptSetting(
          settings.webhookCipher,
          webConfig().SETTINGS_ENCRYPTION_KEY,
          WEBHOOK_PURPOSE,
        );

  return (
    <AdminFrame title="Discord">
      <section className={styles.panel} aria-labelledby="bot-heading">
        <h2 id="bot-heading" className={styles.subtitle}>
          Bot
        </h2>
        {!status.ok ? (
          <p className={styles.error} role="alert">
            {status.problem}
          </p>
        ) : (
          <ul className={styles.list}>
            <li>Connected as {status.botName}.</li>
            <li>
              {status.readiness.manageRoles
                ? 'It has Manage Roles.'
                : 'It does not have Manage Roles: give its role that permission.'}
            </li>
            {status.readiness.outranked.length > 0 && (
              <li className={styles.error}>
                Its role must be above every linked role in Server Settings → Roles. Move it above:{' '}
                {status.readiness.outranked.map((id) => roleNames.get(id) ?? id).join(', ')}.
              </li>
            )}
            {status.readiness.missing.length > 0 && (
              <li className={styles.error}>
                {status.readiness.missing.length} linked{' '}
                {status.readiness.missing.length === 1
                  ? 'role no longer exists'
                  : 'roles no longer exist'}{' '}
                in Discord. Create missing roles below.
              </li>
            )}
            {status.readiness.ready && <li className={styles.success}>Ready to sync roles.</li>}
          </ul>
        )}
      </section>

      <section className={styles.heading} aria-labelledby="roles-heading">
        <h2 id="roles-heading" className={styles.subtitle}>
          Ranks and roles
        </h2>
        <p className={styles.muted}>
          The hub manages only the Discord roles linked here: syncing adds them to members who hold
          the rank and removes them from members who do not. Other roles are never touched.
        </p>
        {ranks.length === 0 ? (
          <p className={styles.muted}>No ranks yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Discord role</th>
                  <th className={styles.num}>Holders</th>
                </tr>
              </thead>
              <tbody>
                {ranks.map((rank) => (
                  <tr key={rank.id}>
                    <td>{rank.name}</td>
                    <td>
                      {rank.discordRoleId === null
                        ? 'Not linked'
                        : !status.ok
                          ? rank.discordRoleId
                          : roleNames.has(rank.discordRoleId)
                            ? `${roleNames.get(rank.discordRoleId)}${outranked.has(rank.discordRoleId) ? ' (above the bot)' : ''}`
                            : 'Missing in Discord'}
                    </td>
                    <td className={styles.num}>{rank.holders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ActionForm action={createMissingRolesAction} submit="Create missing roles" tone="quiet">
          <p className={styles.muted}>
            Creates a Discord role, with no permissions, for each rank that is not linked or whose
            role was deleted, and links it.
          </p>
        </ActionForm>
      </section>

      <section className={styles.heading} aria-labelledby="sync-heading">
        <h2 id="sync-heading" className={styles.subtitle}>
          Sync
        </h2>
        <p className={styles.muted}>
          {summary.due} due now, {summary.waiting} waiting to retry, {summary.failed} failed,{' '}
          {summary.doneToday} done in the last day.
        </p>
        <ActionForm action={syncAllAction} submit="Sync all members" tone="quiet">
          <p className={styles.muted}>
            Puts every member&apos;s linked roles right, including any a moderator changed by hand
            in Discord.
          </p>
        </ActionForm>
        {failed.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Error</th>
                  <th>Failed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {failed.map((job) => (
                  <tr key={job.id}>
                    <td>
                      {job.kind === 'sync_member_roles'
                        ? `Sync ${job.memberName ?? 'a deleted member'}`
                        : `Announce: ${job.event ?? 'unknown'}`}
                    </td>
                    <td>{job.lastError ?? ''}</td>
                    <td>{formatDate(job.failedAt)}</td>
                    <td>
                      <ActionForm
                        action={retryJobAction}
                        submit="Retry"
                        tone="quiet"
                        className={styles.inline}
                      >
                        <input type="hidden" name="jobId" value={job.id} />
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Always drawn: it empties the list it acts on, and would take its notice with it. */}
        <ActionForm action={retryJobAction} submit="Retry all failed jobs" tone="quiet">
          <input type="hidden" name="jobId" value="all" />
        </ActionForm>
      </section>

      <section className={styles.heading} aria-labelledby="announce-heading">
        <h2 id="announce-heading" className={styles.subtitle}>
          Announcements
        </h2>
        <ActionForm action={saveAnnouncementsAction} submit="Save announcements">
          <label className={styles.field}>
            Webhook URL{' '}
            <span className={styles.muted}>
              {settings.webhookCipher === null
                ? '(none saved)'
                : webhook === null
                  ? '(saved, but unreadable with this key: save it again)'
                  : `(saved: ${maskWebhook(webhook)}; leave blank to keep it)`}
            </span>
            <input
              className={styles.wide}
              type="url"
              name="webhookUrl"
              autoComplete="off"
              placeholder="https://discord.com/api/webhooks/…"
            />
          </label>
          {settings.webhookCipher !== null && (
            <label className={styles.check}>
              <input type="checkbox" name="removeWebhook" /> Remove the saved webhook
            </label>
          )}
          <div className={styles.formGrid}>
            <label className={styles.field}>
              Name
              <input
                className={styles.input}
                name="botName"
                required
                maxLength={80}
                defaultValue={settings.botName}
              />
            </label>
            <label className={styles.field}>
              Avatar URL (optional)
              <input
                className={styles.input}
                type="url"
                name="avatarUrl"
                defaultValue={settings.avatarUrl ?? ''}
              />
            </label>
          </div>
          <fieldset className={styles.formStack}>
            <legend className={styles.muted}>Announce</legend>
            {ANNOUNCE_EVENTS.map((event) => (
              <label key={event} className={styles.check}>
                <input
                  type="checkbox"
                  name={`announce_${event}`}
                  defaultChecked={settings.enabled[event]}
                />
                {ANNOUNCE_LABELS[event]}{' '}
                <span className={styles.muted}>({EVENT_HINTS[event]})</span>
              </label>
            ))}
          </fieldset>
        </ActionForm>
        {settings.webhookCipher !== null && (
          <ActionForm action={testWebhookAction} submit="Send a test message" tone="quiet" />
        )}
      </section>
    </AdminFrame>
  );
}
