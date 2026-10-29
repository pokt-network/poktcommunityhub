/**
 * The hub's rules for Discord (flow 13; brief section 14): which roles a sync
 * adds and removes, when a failed job is tried again, whether the bot can do
 * its job, and what announcements say. The worker and the console do the I/O;
 * everything they decide is decided here.
 */

// ── Role sync (section 14.1) ─────────────────────────────────────────────────

/**
 * What one member sync changes, by Discord role id.
 *
 * `held` are the linked roles the member holds in the hub. `managed` are the
 * roles the hub owns: every role linked to a rank now, plus any a rank let go of
 * since the job was queued (a deleted rank, a changed role id), so that those
 * come off too. `current` is what the member has in Discord. Roles the hub does
 * not manage are never touched.
 */
export function planMemberSync(input: {
  held: readonly string[];
  managed: readonly string[];
  current: readonly string[];
}): { add: string[]; remove: string[] } {
  const held = new Set(input.held);
  const current = new Set(input.current);
  const managed = new Set([...input.managed, ...input.held]);
  return {
    add: [...held].filter((id) => !current.has(id)).sort(),
    remove: [...managed].filter((id) => current.has(id) && !held.has(id)).sort(),
  };
}

// ── Retries (section 14.3) ───────────────────────────────────────────────────

export const JOB_RETRY = {
  firstDelayMs: 30_000,
  maxDelayMs: 60 * 60_000,
  maxAttempts: 10,
} as const;

export type JobFailure = { kind: 'retry'; at: Date; countsAsAttempt: boolean } | { kind: 'failed' };

/**
 * What happens to a job whose attempt number `attempts` (1 for the first) just
 * failed. A rate limit (`retryAfterMs`) waits exactly as long as Discord asked
 * and does not use up an attempt. Anything else doubles the wait from 30 seconds
 * to at most an hour, and the tenth failure is final.
 */
export function afterJobFailure(input: {
  attempts: number;
  now: Date;
  retryAfterMs?: number | null | undefined;
}): JobFailure {
  const { attempts, now, retryAfterMs } = input;
  if (typeof retryAfterMs === 'number' && retryAfterMs >= 0) {
    return { kind: 'retry', at: new Date(now.getTime() + retryAfterMs), countsAsAttempt: false };
  }
  if (attempts >= JOB_RETRY.maxAttempts) return { kind: 'failed' };
  const delay = Math.min(
    JOB_RETRY.firstDelayMs * 2 ** Math.max(0, attempts - 1),
    JOB_RETRY.maxDelayMs,
  );
  return { kind: 'retry', at: new Date(now.getTime() + delay), countsAsAttempt: true };
}

// ── Bot status (section 14.7) ────────────────────────────────────────────────

const ADMINISTRATOR = 1n << 3n;
const MANAGE_ROLES = 1n << 28n;

export type GuildRole = { id: string; name: string; position: number; permissions: string };

export type BotReadiness = {
  /** Manage Roles, directly or through Administrator, from any of the bot's roles. */
  manageRoles: boolean;
  /** Linked roles at or above the bot's highest role: Discord will not let it assign them. */
  outranked: string[];
  /** Linked role ids the server does not have (deleted in Discord). */
  missing: string[];
  ready: boolean;
};

/**
 * Whether the bot can manage every linked role. `guildRoles` is the server's
 * full role list; the @everyone role has the server's id and counts for every
 * member, the bot included.
 */
export function botReadiness(input: {
  guildId: string;
  botRoleIds: readonly string[];
  guildRoles: readonly GuildRole[];
  linkedRoleIds: readonly string[];
}): BotReadiness {
  const byId = new Map(input.guildRoles.map((role) => [role.id, role]));
  const own = [...new Set([input.guildId, ...input.botRoleIds])]
    .map((id) => byId.get(id))
    .filter((role): role is GuildRole => role !== undefined);

  let permissions = 0n;
  for (const role of own) {
    try {
      permissions |= BigInt(role.permissions);
    } catch {
      // Not a number Discord would send; it grants nothing.
    }
  }
  const manageRoles = (permissions & (ADMINISTRATOR | MANAGE_ROLES)) !== 0n;
  const top = Math.max(0, ...own.map((role) => role.position));

  const missing: string[] = [];
  const outranked: string[] = [];
  for (const id of input.linkedRoleIds) {
    const role = byId.get(id);
    if (role === undefined) missing.push(id);
    else if (role.position >= top) outranked.push(id);
  }
  return {
    manageRoles,
    outranked,
    missing,
    ready: manageRoles && outranked.length === 0 && missing.length === 0,
  };
}

/** A rank's `#rrggbb` colour as Discord's integer; no colour is 0. */
export function roleColor(hex: string | null): number {
  return hex !== null && /^#[0-9a-fA-F]{6}$/.test(hex) ? Number.parseInt(hex.slice(1), 16) : 0;
}

// ── Announcements (sections 9.7 and 14.5–14.6) ───────────────────────────────

export const ANNOUNCE_EVENTS = ['new_quest', 'quest_completed', 'role_unlocked'] as const;
export type AnnounceEvent = (typeof ANNOUNCE_EVENTS)[number];

export const ANNOUNCE_LABELS: Record<AnnounceEvent, string> = {
  new_quest: 'New quest',
  quest_completed: 'Quest completed',
  role_unlocked: 'Rank unlocked',
};

export type AnnouncementFacts =
  | { event: 'new_quest'; questTitle: string; xp: number; questUrl: string }
  | { event: 'quest_completed'; memberName: string; questTitle: string; xp: number }
  | { event: 'role_unlocked'; memberName: string; rankName: string };

/**
 * Text Discord shows as-is: Markdown and mention syntax in names and titles are
 * escaped, so a member called `@everyone` or `**x**` is printed, not acted on.
 * (The webhook also sends `allowed_mentions: { parse: [] }`.)
 */
export function escapeDiscord(text: string): string {
  return text.replace(/[\\*_~`|>#[\]()-]/g, (c) => `\\${c}`).replace(/@/g, '@\u200b');
}

/** The message an announcement posts. */
export function announcementText(facts: AnnouncementFacts): string {
  switch (facts.event) {
    case 'new_quest':
      return `New quest: **${escapeDiscord(facts.questTitle)}** (${facts.xp} XP)\n${facts.questUrl}`;
    case 'quest_completed':
      return `${escapeDiscord(facts.memberName)} completed **${escapeDiscord(facts.questTitle)}** (+${facts.xp} XP)`;
    case 'role_unlocked':
      return `${escapeDiscord(facts.memberName)} unlocked the **${escapeDiscord(facts.rankName)}** rank`;
  }
}

export const WEBHOOK_LIMITS = { botName: 80 } as const;

/**
 * A Discord webhook URL, and nothing else: the hub posts to it with no further
 * checks, so a URL that points anywhere else would be a way to make the server
 * send requests for whoever can edit the setting.
 */
export function isWebhookUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    /^(?:(?:ptb|canary)\.)?discord(?:app)?\.com$/.test(url.hostname) &&
    /^\/api(?:\/v\d+)?\/webhooks\/[0-9]{17,20}\/[A-Za-z0-9_-]{20,100}$/.test(url.pathname) &&
    url.search === '' &&
    url.hash === ''
  );
}

/** What admins see of a saved webhook: enough to recognise it, never the token. */
export function maskWebhook(value: string): string {
  const match = /\/webhooks\/([0-9]{17,20})\//.exec(value);
  return match === null ? 'a saved webhook' : `webhook …${match[1]!.slice(-4)}`;
}

export type WebhookFields = 'webhookUrl' | 'botName' | 'avatarUrl';

/**
 * Check the announcement settings an admin submitted. `webhookUrl` null keeps
 * the saved one; an empty string is turned into null by the caller only when
 * the admin asked to remove it.
 */
export function checkWebhookSettings(input: {
  webhookUrl: string | null;
  botName: string;
  avatarUrl: string | null;
}): Partial<Record<WebhookFields, string>> {
  const errors: Partial<Record<WebhookFields, string>> = {};
  if (input.webhookUrl !== null && !isWebhookUrl(input.webhookUrl)) {
    errors.webhookUrl =
      'Paste the webhook URL Discord gave you (https://discord.com/api/webhooks/…).';
  }
  const name = input.botName.trim();
  if (name.length === 0 || name.length > WEBHOOK_LIMITS.botName) {
    errors.botName = `Give a name of 1 to ${WEBHOOK_LIMITS.botName} characters.`;
  } else if (/discord|clyde/i.test(name) || /^(everyone|here)$/i.test(name)) {
    errors.botName = 'Discord refuses that name for a webhook.';
  }
  if (input.avatarUrl !== null) {
    let ok: boolean;
    try {
      ok = new URL(input.avatarUrl).protocol === 'https:';
    } catch {
      ok = false;
    }
    if (!ok) errors.avatarUrl = 'Use an https:// image URL, or leave it empty.';
  }
  return errors;
}

// ── Screenshot retention (section 9.6) ───────────────────────────────────────

export const PROOF_RETENTION_DAYS = 60;

/** Reviewed before this instant: the screenshot is due for deletion. */
export function proofRetentionCutoff(now: Date): Date {
  return new Date(now.getTime() - PROOF_RETENTION_DAYS * 24 * 60 * 60_000);
}
