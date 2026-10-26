import { query } from "@/lib/db";

/**
 * Admin-configurable Discord announcement settings.
 * Stored in public.app_settings under the "discord_notifications" key.
 */
export type QuestPingMode = "none" | "everyone" | "here" | "role";

export type DiscordNotificationSettings = {
  /** Custom webhook URL; when null the DISCORD_WEBHOOK_URL env var is used. */
  webhookUrl: string | null;
  /** Display name used for webhook posts. */
  botName: string;
  /** Public HTTPS image URL used as the webhook avatar (avatar_url). */
  botAvatarUrl: string | null;
  announceNewQuests: boolean;
  announceRoleUnlocks: boolean;
  announceQuestCompletions: boolean;
  /** Ping the ambassador (<@id>) in rank-up / completion posts. */
  mentionMembers: boolean;
  /** Who to ping when a new quest is announced. */
  questPingMode: QuestPingMode;
  /** Discord role snowflake used when questPingMode === "role". */
  questPingRoleId: string | null;
};

/** Client-safe view: never exposes the full webhook secret. */
export type DiscordNotificationSettingsView = Omit<
  DiscordNotificationSettings,
  "webhookUrl"
> & {
  hasCustomWebhook: boolean;
  webhookPreview: string | null;
  envWebhookConfigured: boolean;
};

const SETTINGS_KEY = "discord_notifications";

export const DEFAULT_DISCORD_NOTIFICATION_SETTINGS: DiscordNotificationSettings = {
  webhookUrl: null,
  botName: "POKT Community Hub",
  botAvatarUrl: null,
  announceNewQuests: true,
  announceRoleUnlocks: true,
  announceQuestCompletions: false,
  mentionMembers: true,
  questPingMode: "none",
  questPingRoleId: null,
};

const AVATAR_URL_RE = /^https:\/\/[^\s]{8,500}$/i;

export function isValidBotAvatarUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!AVATAR_URL_RE.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const WEBHOOK_URL_RE =
  /^https:\/\/(?:(?:canary|ptb)\.)?(?:discord|discordapp)\.com\/api(?:\/v\d+)?\/webhooks\/\d{5,25}\/[\w-]{20,}$/;

export function isValidDiscordWebhookUrl(url: string): boolean {
  return WEBHOOK_URL_RE.test(url.trim());
}

export function maskWebhookUrl(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/webhooks\/(\d+)\/([\w-]+)/);
  if (!match) return "Custom webhook";
  const [, id, token] = match;
  return `…/webhooks/${id.slice(0, 4)}…${id.slice(-3)}/${token.slice(0, 4)}••••`;
}

function normalize(raw: unknown): DiscordNotificationSettings {
  const d = DEFAULT_DISCORD_NOTIFICATION_SETTINGS;
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bool = (key: keyof DiscordNotificationSettings) =>
    typeof v[key] === "boolean" ? (v[key] as boolean) : (d[key] as boolean);
  const pingMode = v.questPingMode;
  return {
    webhookUrl:
      typeof v.webhookUrl === "string" && isValidDiscordWebhookUrl(v.webhookUrl)
        ? v.webhookUrl
        : null,
    botName:
      typeof v.botName === "string" && v.botName.trim()
        ? v.botName.trim().slice(0, 80)
        : d.botName,
    botAvatarUrl:
      typeof v.botAvatarUrl === "string" && isValidBotAvatarUrl(v.botAvatarUrl)
        ? v.botAvatarUrl.trim()
        : null,
    announceNewQuests: bool("announceNewQuests"),
    announceRoleUnlocks: bool("announceRoleUnlocks"),
    announceQuestCompletions: bool("announceQuestCompletions"),
    mentionMembers: bool("mentionMembers"),
    questPingMode:
      pingMode === "everyone" || pingMode === "here" || pingMode === "role"
        ? pingMode
        : "none",
    questPingRoleId:
      typeof v.questPingRoleId === "string" && /^\d{5,25}$/.test(v.questPingRoleId)
        ? v.questPingRoleId
        : null,
  };
}

export async function getDiscordNotificationSettings(): Promise<DiscordNotificationSettings> {
  try {
    const { rows } = await query<{ value: unknown }>(
      `SELECT value FROM public.app_settings WHERE key = $1`,
      [SETTINGS_KEY],
    );
    return normalize(rows[0]?.value);
  } catch (err) {
    // Table may not exist yet (migration not applied) — fall back to defaults.
    console.warn("[notification-settings] Using defaults:", err instanceof Error ? err.message : err);
    return { ...DEFAULT_DISCORD_NOTIFICATION_SETTINGS };
  }
}

export async function saveDiscordNotificationSettings(
  settings: DiscordNotificationSettings,
  updatedBy: string,
): Promise<DiscordNotificationSettings> {
  const clean = normalize(settings);
  await query(
    `INSERT INTO public.app_settings (key, value, updated_by, "updatedAt")
     VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_by = EXCLUDED.updated_by,
       "updatedAt" = now()`,
    [SETTINGS_KEY, JSON.stringify(clean), updatedBy],
  );
  return clean;
}

export function toSettingsView(
  settings: DiscordNotificationSettings,
): DiscordNotificationSettingsView {
  const { webhookUrl, ...rest } = settings;
  return {
    ...rest,
    hasCustomWebhook: Boolean(webhookUrl),
    webhookPreview: maskWebhookUrl(webhookUrl),
    envWebhookConfigured: Boolean(process.env.DISCORD_WEBHOOK_URL?.trim()),
  };
}
