"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  getAppBaseUrl,
  resolveWebhookUrl,
  sendDiscordWebhook,
} from "@/lib/discord-webhook";
import {
  getDiscordNotificationSettings,
  isValidBotAvatarUrl,
  isValidDiscordWebhookUrl,
  saveDiscordNotificationSettings,
  toSettingsView,
  type DiscordNotificationSettingsView,
  type QuestPingMode,
} from "@/lib/notification-settings";
import { uploadWebhookAvatarFile } from "@/lib/supabase-server";

async function requireAdminSession() {
  const session = await getSession();
  if (!session) {
    return { error: "Please sign in again." as const };
  }
  if (session.user.role !== "admin") {
    return { error: "Admin access required." as const };
  }
  return { session };
}

export type SaveNotificationSettingsInput = {
  /** New webhook URL. Empty string/undefined keeps the current one. */
  webhookUrl?: string;
  /** Remove the saved custom webhook (fall back to env var). */
  clearWebhook?: boolean;
  botName: string;
  /** Public avatar URL; empty/undefined keeps current unless clearAvatar. */
  botAvatarUrl?: string;
  clearAvatar?: boolean;
  announceNewQuests: boolean;
  announceRoleUnlocks: boolean;
  announceQuestCompletions: boolean;
  mentionMembers: boolean;
  questPingMode: QuestPingMode;
  questPingRoleId?: string;
};

export async function saveDiscordNotificationSettingsAction(
  input: SaveNotificationSettingsInput,
): Promise<{ ok: boolean; error?: string; settings?: DiscordNotificationSettingsView }> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) return { ok: false, error: authz.error };

    const current = await getDiscordNotificationSettings();

    let webhookUrl = current.webhookUrl;
    const typedUrl = input.webhookUrl?.trim() ?? "";
    if (input.clearWebhook) {
      webhookUrl = null;
    } else if (typedUrl) {
      if (!isValidDiscordWebhookUrl(typedUrl)) {
        return {
          ok: false,
          error:
            "That doesn't look like a Discord webhook URL (https://discord.com/api/webhooks/…).",
        };
      }
      webhookUrl = typedUrl;
    }

    let botAvatarUrl = current.botAvatarUrl;
    const typedAvatar = input.botAvatarUrl?.trim() ?? "";
    if (input.clearAvatar) {
      botAvatarUrl = null;
    } else if (typedAvatar) {
      if (!isValidBotAvatarUrl(typedAvatar)) {
        return { ok: false, error: "Avatar must be a public https:// image URL." };
      }
      botAvatarUrl = typedAvatar;
    }

    const pingRoleId = input.questPingRoleId?.trim() ?? "";
    if (input.questPingMode === "role" && !/^\d{5,25}$/.test(pingRoleId)) {
      return { ok: false, error: "Enter a valid Discord role ID to ping (numbers only)." };
    }

    const saved = await saveDiscordNotificationSettings(
      {
        webhookUrl,
        botName: input.botName,
        botAvatarUrl,
        announceNewQuests: Boolean(input.announceNewQuests),
        announceRoleUnlocks: Boolean(input.announceRoleUnlocks),
        announceQuestCompletions: Boolean(input.announceQuestCompletions),
        mentionMembers: Boolean(input.mentionMembers),
        questPingMode: input.questPingMode,
        questPingRoleId: input.questPingMode === "role" ? pingRoleId : null,
      },
      authz.session.user.id,
    );

    revalidatePath("/admin/roles");
    revalidatePath("/admin/quests");
    return { ok: true, settings: toSettingsView(saved) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save notification settings.",
    };
  }
}

/** Upload a webhook avatar image and return its public URL (does not save settings). */
export async function uploadDiscordWebhookAvatarAction(
  formData: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) return { ok: false, error: authz.error };

    const file = formData.get("avatar");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose an image file (PNG, JPEG, or WebP)." };
    }

    const url = await uploadWebhookAvatarFile(file);
    return { ok: true, url };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to upload avatar.",
    };
  }
}

export type TestDiscordWebhookInput = {
  webhookUrl?: string;
  /** Preview avatar for this test only (does not persist). */
  botAvatarUrl?: string | null;
  clearAvatar?: boolean;
};

/**
 * Sends a test announcement. If `webhookUrl` is provided (unsaved value typed
 * in the modal) it's used; otherwise the saved/env webhook is used.
 */
export async function testDiscordWebhookAction(
  input?: string | TestDiscordWebhookInput,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) return { ok: false, error: authz.error };

    const opts: TestDiscordWebhookInput =
      typeof input === "string" ? { webhookUrl: input } : input ?? {};

    const settings = await getDiscordNotificationSettings();
    const typedUrl = opts.webhookUrl?.trim() ?? "";
    if (typedUrl && !isValidDiscordWebhookUrl(typedUrl)) {
      return { ok: false, error: "That doesn't look like a Discord webhook URL." };
    }

    const target = typedUrl || resolveWebhookUrl(settings);
    if (!target) {
      return {
        ok: false,
        error: "No webhook configured. Paste a webhook URL or set DISCORD_WEBHOOK_URL.",
      };
    }

    let botAvatarUrl = settings.botAvatarUrl;
    if (opts.clearAvatar) {
      botAvatarUrl = null;
    } else if (opts.botAvatarUrl !== undefined) {
      const candidate = opts.botAvatarUrl?.trim() || "";
      if (candidate && !isValidBotAvatarUrl(candidate)) {
        return { ok: false, error: "Avatar must be a public https:// image URL." };
      }
      botAvatarUrl = candidate || null;
    }

    const testSettings = { ...settings, botAvatarUrl };

    const enabled = [
      settings.announceNewQuests && "New quests",
      settings.announceRoleUnlocks && "Rank-ups",
      settings.announceQuestCompletions && "Quest completions",
    ].filter(Boolean);

    const result = await sendDiscordWebhook(
      {
        content: "🔔 **POKT Community Hub — webhook test**",
        embeds: [
          {
            title: "🔌 Webhook connected",
            description:
              "This channel will receive announcements from the POKT Community Hub.",
            color: 0x10b981,
            fields: [
              {
                name: "Announcing",
                value: enabled.length
                  ? enabled.join(" • ")
                  : "Nothing (all announcements off)",
                inline: false,
              },
              {
                name: "Triggered by",
                value: authz.session.user.name || "Hub admin",
                inline: true,
              },
              { name: "Hub", value: getAppBaseUrl(), inline: true },
            ],
            footer: { text: "POKT Community Hub integration test" },
            timestamp: new Date().toISOString(),
          },
        ],
      },
      { webhookUrl: target, settings: testSettings },
    );

    if (!result.ok) {
      return { ok: false, error: result.error || "Failed to deliver test message." };
    }
    return { ok: true, message: "Test message sent — check your Discord channel." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error testing Discord webhook.",
    };
  }
}
