/**
 * Discord Webhook Client for POKT Community Hub
 * Handles real-time broadcasts for new quests, ambassador rank-ups, quest
 * completions, and admin tests. Behaviour is controlled by the admin
 * notification settings (see notification-settings.ts).
 */

import {
  getDiscordNotificationSettings,
  type DiscordNotificationSettings,
} from "@/lib/notification-settings";

export type DiscordEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

export type DiscordEmbedAuthor = {
  name: string;
  url?: string;
  icon_url?: string;
};

export type DiscordEmbedFooter = {
  text: string;
  icon_url?: string;
};

export type DiscordEmbed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  author?: DiscordEmbedAuthor;
  footer?: DiscordEmbedFooter;
  timestamp?: string;
  thumbnail?: { url: string };
};

export type DiscordAllowedMentions = {
  parse?: Array<"roles" | "users" | "everyone">;
  roles?: string[];
  users?: string[];
};

export type DiscordWebhookPayload = {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
  allowed_mentions?: DiscordAllowedMentions;
};

export type WebhookResult = { ok: boolean; skipped?: boolean; error?: string };

function envWebhookUrl(): string {
  return process.env.DISCORD_WEBHOOK_URL?.trim() || "";
}

/** Saved custom URL wins over the DISCORD_WEBHOOK_URL env var. */
export function resolveWebhookUrl(settings?: DiscordNotificationSettings | null): string {
  return settings?.webhookUrl || envWebhookUrl();
}

export function getDiscordWebhookUrl(): string {
  return envWebhookUrl();
}

export function isDiscordWebhookConfigured(): boolean {
  return Boolean(envWebhookUrl());
}

/**
 * Resolves the public base URL of the community hub.
 * Honors NEXT_PUBLIC_APP_URL first, then Vercel production system envs, then localhost.
 */
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

/**
 * Converts a hex color string (e.g. #1A6DFF or #10b981) to Discord integer format.
 */
export function hexToDiscordColor(
  hex?: string | null,
  fallback = 0x1a6dff,
): number {
  if (!hex) return fallback;
  const cleaned = hex.trim().replace(/^#/, "");
  const parsed = Number.parseInt(cleaned, 16);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Sends a payload to a Discord webhook endpoint.
 * Resilient: returns an error object without throwing uncaught exceptions.
 */
export async function sendDiscordWebhook(
  payload: DiscordWebhookPayload,
  options: { webhookUrl?: string; settings?: DiscordNotificationSettings } = {},
): Promise<WebhookResult> {
  const webhookUrl = options.webhookUrl || resolveWebhookUrl(options.settings);

  if (!webhookUrl) {
    return { ok: true, skipped: true };
  }

  try {
    const username =
      payload.username || options.settings?.botName || "POKT Community Hub";
    const avatarUrl =
      payload.avatar_url || options.settings?.botAvatarUrl || undefined;

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        allowed_mentions: { parse: [] },
        ...payload,
        username,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText);
      console.warn(
        `[discord-webhook] Discord API responded with HTTP ${res.status}: ${errorText}`,
      );
      return {
        ok: false,
        error: `Discord Webhook returned ${res.status}: ${errorText}`,
      };
    }

    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Network error contacting Discord Webhook";
    console.warn("[discord-webhook] Network error:", message);
    return { ok: false, error: message };
  }
}

function questPing(settings: DiscordNotificationSettings): {
  prefix: string;
  allowed: DiscordAllowedMentions;
} {
  switch (settings.questPingMode) {
    case "everyone":
      return { prefix: "@everyone ", allowed: { parse: ["everyone"] } };
    case "here":
      return { prefix: "@here ", allowed: { parse: ["everyone"] } };
    case "role":
      return settings.questPingRoleId
        ? {
            prefix: `<@&${settings.questPingRoleId}> `,
            allowed: { parse: [], roles: [settings.questPingRoleId] },
          }
        : { prefix: "", allowed: { parse: [] } };
    default:
      return { prefix: "", allowed: { parse: [] } };
  }
}

function memberMention(
  settings: DiscordNotificationSettings,
  user: { name: string; discordId?: string | null },
): { text: string; allowed: DiscordAllowedMentions } {
  if (user.discordId) {
    return {
      text: `<@${user.discordId}>`,
      allowed: settings.mentionMembers
        ? { parse: [], users: [user.discordId] }
        : { parse: [] },
    };
  }
  return { text: `**${user.name}**`, allowed: { parse: [] } };
}

/**
 * Announces a newly created quest in the Discord webhook channel.
 */
export async function notifyNewQuest(quest: {
  id: string;
  title: string;
  description?: string | null;
  xp_reward: number;
  category_name?: string | null;
  reward_role_name?: string | null;
  reward_role_color?: string | null;
  ends_at?: Date | string | null;
}): Promise<WebhookResult> {
  const settings = await getDiscordNotificationSettings();
  if (!settings.announceNewQuests) return { ok: true, skipped: true };

  const baseUrl = getAppBaseUrl();
  const questUrl = `${baseUrl}/quests/${quest.id}`;

  const fields: DiscordEmbedField[] = [
    {
      name: "⚡ XP Reward",
      value: `**+${quest.xp_reward.toLocaleString()} XP**`,
      inline: true,
    },
  ];

  if (quest.category_name) {
    fields.push({
      name: "📁 Category",
      value: quest.category_name,
      inline: true,
    });
  }

  if (quest.reward_role_name) {
    fields.push({
      name: "🎖️ Role Reward",
      value: `**${quest.reward_role_name}**`,
      inline: true,
    });
  }

  if (quest.ends_at) {
    const endDate = new Date(quest.ends_at);
    if (!Number.isNaN(endDate.getTime())) {
      const unixSecs = Math.floor(endDate.getTime() / 1000);
      fields.push({
        name: "⏳ Deadline",
        value: `<t:${unixSecs}:R>`,
        inline: true,
      });
    }
  }

  const rawDescription = (quest.description || "").trim();
  const cleanDescription =
    rawDescription.length > 300
      ? `${rawDescription.slice(0, 300)}…`
      : rawDescription;

  const embedColor = hexToDiscordColor(quest.reward_role_color, 0x1a6dff);
  const ping = questPing(settings);

  const payload: DiscordWebhookPayload = {
    content: `${ping.prefix}🎯 **New Quest Available on POKT Community Hub!**`,
    allowed_mentions: ping.allowed,
    embeds: [
      {
        title: quest.title,
        url: questUrl,
        description: cleanDescription || undefined,
        color: embedColor,
        fields,
        footer: {
          text: "POKT Community Hub • Click title to start quest",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  return sendDiscordWebhook(payload, { settings });
}

/**
 * Announces an ambassador rank-up or role unlock in the Discord webhook channel.
 */
export async function notifyRoleUnlocked(data: {
  user: {
    id: string;
    name: string;
    discordId?: string | null;
    totalXp: number;
  };
  role: {
    id: string;
    name: string;
    color?: string | null;
    xp_required?: number;
  };
}): Promise<WebhookResult> {
  const settings = await getDiscordNotificationSettings();
  if (!settings.announceRoleUnlocks) return { ok: true, skipped: true };

  const baseUrl = getAppBaseUrl();
  const leaderboardUrl = `${baseUrl}/leaderboard`;
  const mention = memberMention(settings, data.user);

  const fields: DiscordEmbedField[] = [
    {
      name: "🎖️ Role Earned",
      value: `**${data.role.name}**`,
      inline: true,
    },
    {
      name: "⚡ Total XP",
      value: `**${data.user.totalXp.toLocaleString()} XP**`,
      inline: true,
    },
  ];

  if (typeof data.role.xp_required === "number" && data.role.xp_required > 0) {
    fields.push({
      name: "🎯 Milestone",
      value: `${data.role.xp_required.toLocaleString()} XP`,
      inline: true,
    });
  }

  const embedColor = hexToDiscordColor(data.role.color, 0xf59e0b);
  const contentMention =
    settings.mentionMembers && data.user.discordId ? `${mention.text} ` : "";

  const payload: DiscordWebhookPayload = {
    content: `${contentMention}🎉 **Ambassador Rank Milestone Unlocked!**`,
    allowed_mentions: mention.allowed,
    embeds: [
      {
        title: `${data.user.name} unlocked ${data.role.name}!`,
        url: leaderboardUrl,
        description: `Congratulations to ${mention.text} for earning the **${data.role.name}** rank in the POKT Ambassador Program!`,
        color: embedColor,
        fields,
        footer: {
          text: "POKT Ambassador Program • Keep climbing the ranks!",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  return sendDiscordWebhook(payload, { settings });
}

/**
 * Announces an approved quest submission (quest completed) in Discord.
 */
export async function notifyQuestCompleted(data: {
  user: {
    id: string;
    name: string;
    discordId?: string | null;
    totalXp: number;
  };
  quest: {
    id: string;
    title: string;
    xp_reward: number;
  };
}): Promise<WebhookResult> {
  const settings = await getDiscordNotificationSettings();
  if (!settings.announceQuestCompletions) return { ok: true, skipped: true };

  const baseUrl = getAppBaseUrl();
  const mention = memberMention(settings, data.user);
  const contentMention =
    settings.mentionMembers && data.user.discordId ? `${mention.text} ` : "";

  const payload: DiscordWebhookPayload = {
    content: `${contentMention}✅ **Quest completed!**`,
    allowed_mentions: mention.allowed,
    embeds: [
      {
        title: data.quest.title,
        url: `${baseUrl}/quests/${data.quest.id}`,
        description: `${mention.text} completed **${data.quest.title}** and earned **+${data.quest.xp_reward.toLocaleString()} XP**.`,
        color: 0x10b981,
        fields: [
          {
            name: "⚡ Total XP",
            value: `**${data.user.totalXp.toLocaleString()} XP**`,
            inline: true,
          },
        ],
        footer: { text: "POKT Ambassador Program" },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  return sendDiscordWebhook(payload, { settings });
}
