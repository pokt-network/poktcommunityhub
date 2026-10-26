"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import {
  LuAward,
  LuBell,
  LuCheck,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuFilter,
  LuImage,
  LuPencil,
  LuPlus,
  LuRefreshCw,
  LuSearch,
  LuTrash2,
  LuUpload,
  LuUsers,
  LuX,
} from "react-icons/lu";
import { FaDiscord } from "react-icons/fa6";
import {
  createServerRoleAction,
  updateServerRoleAction,
  deleteServerRoleAction,
  toggleUserRoleAction,
  syncUserDiscordRolesAction,
  syncAllDiscordRolesAction,
  provisionDiscordRolesAction,
  type RoleActionState,
} from "@/app/actions/roles";
import {
  saveDiscordNotificationSettingsAction,
  testDiscordWebhookAction,
  uploadDiscordWebhookAvatarAction,
} from "@/app/actions/notification-settings";
import type {
  DiscordNotificationSettingsView,
  QuestPingMode,
} from "@/lib/notification-settings";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { ServerRoleBadge } from "@/components/server-role-badge";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ServerRole, ManagedUser, Quest } from "@/lib/db";
import { cn } from "@/lib/utils";

const MEMBERS_PAGE_SIZE = 8;

const DISCORD_SWATCHES = [
  { name: "POKT Blue", hex: "#3b82f6" },
  { name: "Blurple", hex: "#5865F2" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Neon Violet", hex: "#a855f7" },
  { name: "Gold", hex: "#f59e0b" },
  { name: "Fuchsia", hex: "#eb459e" },
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Slate", hex: "#94a3b8" },
];

const initialAction: RoleActionState = { ok: false };

const glassControl =
  "h-10 rounded-full border border-white/15 bg-white/[0.06] text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl backdrop-saturate-150 placeholder:text-muted focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30 hover:border-white/25 hover:bg-white/[0.1]";

type RoleManagementProps = {
  roles: ServerRole[];
  users: ManagedUser[];
  quests?: Pick<Quest, "id" | "title" | "xp_reward" | "status">[];
  currentUserId: string;
  discordWebhookConfigured?: boolean;
  notificationSettings?: DiscordNotificationSettingsView;
};

const DEFAULT_SETTINGS_VIEW: DiscordNotificationSettingsView = {
  botName: "POKT Community Hub",
  botAvatarUrl: null,
  announceNewQuests: true,
  announceRoleUnlocks: true,
  announceQuestCompletions: false,
  mentionMembers: true,
  questPingMode: "none",
  questPingRoleId: null,
  hasCustomWebhook: false,
  webhookPreview: null,
  envWebhookConfigured: false,
};

export function RoleManagement({
  roles,
  users,
  quests = [],
  discordWebhookConfigured = false,
  notificationSettings = DEFAULT_SETTINGS_VIEW,
}: RoleManagementProps) {
  const [tab, setTab] = useState<"studio" | "members">("studio");
  const [editingRole, setEditingRole] = useState<ServerRole | null>(null);
  const [webhookSettingsOpen, setWebhookSettingsOpen] = useState(false);

  // Studio form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [xpRequired, setXpRequired] = useState("0");
  const [color, setColor] = useState("#3b82f6");
  const [questId, setQuestId] = useState("");
  const [discordRoleId, setDiscordRoleId] = useState("");

  // Discord sync notification states
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [bulkSyncPending, startBulkSync] = useTransition();
  const [provisionPending, startProvision] = useTransition();
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);

  // Member search & filter & pagination
  const [userQuery, setUserQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [memberPage, setMemberPage] = useState(1);
  const [assignPending, startAssign] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<ServerRole | null>(null);

  const [createState, createAction, createPending] = useActionState(
    createServerRoleAction,
    initialAction,
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateServerRoleAction,
    initialAction,
  );

  function startEdit(r: ServerRole) {
    setEditingRole(r);
    setName(r.name);
    setDescription(r.description || "");
    setXpRequired(String(r.xp_required));
    setColor(r.color);
    setQuestId(r.quest_id || "");
    setDiscordRoleId(r.discord_role_id || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingRole(null);
    setName("");
    setDescription("");
    setXpRequired("0");
    setColor("#3b82f6");
    setQuestId("");
    setDiscordRoleId("");
  }

  function confirmDeleteRole() {
    if (!deleteTarget) return;
    startDelete(async () => {
      await deleteServerRoleAction(deleteTarget.id);
      if (editingRole?.id === deleteTarget.id) cancelEdit();
      setDeleteTarget(null);
    });
  }

  function handleToggleRole(userId: string, roleId: string, hasRole: boolean) {
    startAssign(async () => {
      await toggleUserRoleAction(userId, roleId, hasRole);
    });
  }

  // Notification settings modal state
  const [savedSettings, setSavedSettings] =
    useState<DiscordNotificationSettingsView>(notificationSettings);
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [clearCustomWebhook, setClearCustomWebhook] = useState(false);
  const [botNameInput, setBotNameInput] = useState(notificationSettings.botName);
  const [botAvatarUrl, setBotAvatarUrl] = useState(
    notificationSettings.botAvatarUrl,
  );
  const [clearAvatar, setClearAvatar] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [announceNewQuests, setAnnounceNewQuests] = useState(
    notificationSettings.announceNewQuests,
  );
  const [announceRoleUnlocks, setAnnounceRoleUnlocks] = useState(
    notificationSettings.announceRoleUnlocks,
  );
  const [announceQuestCompletions, setAnnounceQuestCompletions] = useState(
    notificationSettings.announceQuestCompletions,
  );
  const [mentionMembers, setMentionMembers] = useState(
    notificationSettings.mentionMembers,
  );
  const [questPingMode, setQuestPingMode] = useState<QuestPingMode>(
    notificationSettings.questPingMode,
  );
  const [questPingRoleId, setQuestPingRoleId] = useState(
    notificationSettings.questPingRoleId || "",
  );
  const [modalNotice, setModalNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [testWebhookPending, startTestWebhook] = useTransition();
  const [saveWebhookPending, startSaveWebhook] = useTransition();
  const [avatarUploadPending, startAvatarUpload] = useTransition();

  const isWebhookReady =
    Boolean(webhookUrlInput.trim()) ||
    (!clearCustomWebhook && savedSettings.hasCustomWebhook) ||
    savedSettings.envWebhookConfigured ||
    discordWebhookConfigured;

  const avatarPreview =
    !clearAvatar && botAvatarUrl ? botAvatarUrl : null;

  function openWebhookSettingsModal() {
    setModalNotice(null);
    setWebhookUrlInput("");
    setClearCustomWebhook(false);
    setBotNameInput(savedSettings.botName);
    setBotAvatarUrl(savedSettings.botAvatarUrl);
    setClearAvatar(false);
    setAnnounceNewQuests(savedSettings.announceNewQuests);
    setAnnounceRoleUnlocks(savedSettings.announceRoleUnlocks);
    setAnnounceQuestCompletions(savedSettings.announceQuestCompletions);
    setMentionMembers(savedSettings.mentionMembers);
    setQuestPingMode(savedSettings.questPingMode);
    setQuestPingRoleId(savedSettings.questPingRoleId || "");
    setWebhookSettingsOpen(true);
  }

  function handleAvatarFileChange(file: File | null) {
    if (!file) return;
    setModalNotice(null);
    startAvatarUpload(async () => {
      try {
        const fd = new FormData();
        fd.set("avatar", file);
        const res = await uploadDiscordWebhookAvatarAction(fd);
        if (res.ok && res.url) {
          setBotAvatarUrl(res.url);
          setClearAvatar(false);
          setModalNotice({
            type: "success",
            text: "Avatar uploaded — Save settings to apply it to announcements.",
          });
        } else {
          setModalNotice({
            type: "error",
            text: res.error || "Failed to upload avatar.",
          });
        }
      } catch {
        setModalNotice({
          type: "error",
          text: "Network error uploading avatar.",
        });
      } finally {
        if (avatarFileRef.current) avatarFileRef.current.value = "";
      }
    });
  }

  function handleTestDiscordWebhook() {
    setModalNotice(null);
    startTestWebhook(async () => {
      try {
        const res = await testDiscordWebhookAction({
          webhookUrl: webhookUrlInput.trim() || undefined,
          botAvatarUrl: clearAvatar ? null : botAvatarUrl,
          clearAvatar,
        });
        if (res.ok) {
          setModalNotice({
            type: "success",
            text: res.message || "Test message sent to Discord!",
          });
        } else {
          setModalNotice({
            type: "error",
            text: res.error || "Failed to deliver test message to Discord.",
          });
        }
      } catch {
        setModalNotice({
          type: "error",
          text: "Network error sending test webhook.",
        });
      }
    });
  }

  function handleSaveNotificationSettings() {
    setModalNotice(null);
    startSaveWebhook(async () => {
      try {
        const res = await saveDiscordNotificationSettingsAction({
          webhookUrl: webhookUrlInput.trim() || undefined,
          clearWebhook: clearCustomWebhook,
          botName: botNameInput.trim() || "POKT Community Hub",
          botAvatarUrl: clearAvatar ? undefined : botAvatarUrl || undefined,
          clearAvatar,
          announceNewQuests,
          announceRoleUnlocks,
          announceQuestCompletions,
          mentionMembers,
          questPingMode,
          questPingRoleId: questPingMode === "role" ? questPingRoleId.trim() : undefined,
        });
        if (res.ok && res.settings) {
          setSavedSettings(res.settings);
          setWebhookUrlInput("");
          setClearCustomWebhook(false);
          setBotAvatarUrl(res.settings.botAvatarUrl);
          setClearAvatar(false);
          setModalNotice({
            type: "success",
            text: "Notification settings saved.",
          });
        } else {
          setModalNotice({
            type: "error",
            text: res.error || "Failed to save notification settings.",
          });
        }
      } catch {
        setModalNotice({
          type: "error",
          text: "Network error saving notification settings.",
        });
      }
    });
  }

  function handleBulkSyncDiscord() {
    setSyncMessage(null);
    setSyncError(null);
    startBulkSync(async () => {
      const res = await syncAllDiscordRolesAction();
      if (res.ok) {
        setSyncMessage(res.message || "Discord sync complete.");
      } else {
        setSyncError(res.error || "Failed to sync roles with Discord.");
      }
    });
  }

  function handleProvisionDiscordRoles() {
    setSyncMessage(null);
    setSyncError(null);
    startProvision(async () => {
      const res = await provisionDiscordRolesAction();
      if (res.ok) {
        setSyncMessage(res.message || "Roles created and linked in Discord!");
      } else {
        setSyncError(res.error || "Failed to provision Discord roles.");
      }
    });
  }

  async function handleSyncSingleUser(userId: string) {
    setSyncingUserId(userId);
    setSyncMessage(null);
    setSyncError(null);
    try {
      const res = await syncUserDiscordRolesAction(userId);
      if (res.ok) {
        setSyncMessage(res.message || "Ambassador roles synced to Discord.");
      } else {
        setSyncError(res.error || "Failed to sync ambassador roles to Discord.");
      }
    } finally {
      setSyncingUserId(null);
    }
  }

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const matchesQuery =
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.discordId && u.discordId.includes(q));
        if (!matchesQuery) return false;
      }

      if (roleFilter !== "all") {
        const userRoleIds = (u.roles ?? []).map((r) => r.id);
        if (roleFilter === "none") {
          if (userRoleIds.length > 0) return false;
        } else {
          if (!userRoleIds.includes(roleFilter)) return false;
        }
      }

      return true;
    });
  }, [users, userQuery, roleFilter]);

  const hasFilters = userQuery.trim().length > 0 || roleFilter !== "all";

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / MEMBERS_PAGE_SIZE));
  const safePage = Math.min(memberPage, totalPages);
  const paginatedUsers = useMemo(() => {
    const start = (safePage - 1) * MEMBERS_PAGE_SIZE;
    return filteredUsers.slice(start, start + MEMBERS_PAGE_SIZE);
  }, [filteredUsers, safePage]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-[#8eb6ff] uppercase">
            Operations
          </p>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Server roles & badges
          </h1>
          <p className="mt-1 text-sm text-muted">
            Configure Discord-style community achievement roles and manage ambassador ranks.
          </p>
        </div>

        {/* Tab selector & Discord sync */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex shrink-0 items-center rounded-full border border-white/10 bg-[#0a0f1a]/90 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setTab("studio")}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all select-none cursor-pointer",
                tab === "studio"
                  ? "bg-primary text-white shadow-[0_0_20px_rgba(26,109,255,0.5)]"
                  : "text-muted hover:text-white hover:bg-white/[0.04]",
              )}
            >
              <LuAward className="h-4 w-4 shrink-0" />
              <span>Role Studio</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  tab === "studio"
                    ? "bg-white/20 text-white"
                    : "bg-white/10 text-muted",
                )}
              >
                {roles.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab("members")}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all select-none cursor-pointer",
                tab === "members"
                  ? "bg-primary text-white shadow-[0_0_20px_rgba(26,109,255,0.5)]"
                  : "text-muted hover:text-white hover:bg-white/[0.04]",
              )}
            >
              <LuUsers className="h-4 w-4 shrink-0" />
              <span>Member assignments</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  tab === "members"
                    ? "bg-white/20 text-white"
                    : "bg-white/10 text-muted",
                )}
              >
                {users.length}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
              <FaDiscord className="h-3.5 w-3.5 text-[#5865F2]" />
              <span>Discord sync:</span>
            </span>

            <Button
              type="button"
              disabled={provisionPending || bulkSyncPending}
              onClick={handleProvisionDiscordRoles}
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-white/15 bg-white/[0.04] px-2.5 sm:px-3 text-xs font-medium text-white transition hover:bg-white/10 hover:border-white/25 disabled:opacity-60 inline-flex items-center gap-1.5"
              title="Automatically create any missing roles in your Discord server and link their IDs"
              aria-label="Auto-Create Discord Roles"
            >
              <LuPlus className={cn("h-3.5 w-3.5 text-[#8eb6ff] shrink-0", provisionPending && "animate-spin")} />
              <span>
                {provisionPending ? (
                  "Provisioning…"
                ) : (
                  <>
                    <span className="sm:hidden">Create roles</span>
                    <span className="hidden sm:inline">Auto-Create Roles</span>
                  </>
                )}
              </span>
            </Button>

            <Button
              type="button"
              disabled={bulkSyncPending || provisionPending}
              onClick={handleBulkSyncDiscord}
              size="sm"
              className="h-8 rounded-full border border-[#5865F2]/40 bg-[#5865F2]/15 px-2.5 sm:px-3 text-xs font-medium text-white shadow-[0_0_12px_rgba(88,101,242,0.2)] transition hover:bg-[#5865F2]/30 disabled:opacity-60 inline-flex items-center gap-1.5"
              title="Synchronize all community hub roles directly with the Discord server"
              aria-label="Sync Member Roles"
            >
              <LuRefreshCw className={cn("h-3.5 w-3.5 text-[#a5b4fc] shrink-0", bulkSyncPending && "animate-spin")} />
              <span>
                {bulkSyncPending ? (
                  "Syncing…"
                ) : (
                  <>
                    <span className="sm:hidden">Sync</span>
                    <span className="hidden sm:inline">Sync Members</span>
                  </>
                )}
              </span>
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openWebhookSettingsModal}
            className="ml-auto h-8 w-8 shrink-0 rounded-full border-white/15 bg-white/[0.04] p-0 text-[#8eb6ff] transition hover:bg-white/10 hover:border-white/25 hover:text-white"
            title="Discord announcement & webhook settings"
            aria-label="Discord announcement & webhook settings"
          >
            <LuBell className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </header>

      <Dialog
        open={webhookSettingsOpen}
        onOpenChange={(open) => {
          if (testWebhookPending || saveWebhookPending || avatarUploadPending) return;
          setWebhookSettingsOpen(open);
        }}
      >
        <DialogContent className="flex max-h-[min(90vh,720px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:p-0">
          <DialogHeader className="shrink-0 border-b border-white/8 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
            <div className="flex items-center gap-2.5 pr-8">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-[#8eb6ff]">
                <LuBell className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <DialogTitle>Discord Announcements</DialogTitle>
                <DialogDescription>
                  Configure the announcements channel webhook and choose which events to broadcast.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="scrollbar-none min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
            {/* Webhook Channel Connection */}
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wider text-[#8eb6ff] uppercase">
                  Announcements Channel Webhook
                </p>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
                    isWebhookReady
                      ? "border border-success/40 bg-success/15 text-success"
                      : "border border-warning/40 bg-warning/15 text-warning",
                  )}
                >
                  {isWebhookReady ? "Connected" : "Not set"}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                {!clearCustomWebhook && savedSettings.hasCustomWebhook ? (
                  <>
                    <span>
                      Active webhook:{" "}
                      <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-white">
                        {savedSettings.webhookPreview}
                      </code>
                    </span>
                    <button
                      type="button"
                      onClick={() => setClearCustomWebhook(true)}
                      className="text-[11px] font-medium text-warning hover:underline"
                    >
                      Clear saved URL
                    </button>
                  </>
                ) : savedSettings.envWebhookConfigured ? (
                  <span>Using default webhook from environment (DISCORD_WEBHOOK_URL).</span>
                ) : (
                  <span>Paste your Discord channel webhook URL below to enable broadcasts.</span>
                )}
              </div>

              <details className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <summary className="cursor-pointer select-none text-xs font-medium text-[#8eb6ff] outline-none marker:text-[#8eb6ff]">
                  How to get a channel webhook URL
                </summary>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[11px] leading-relaxed text-muted">
                  <li>Open Discord → the channel that should receive announcements.</li>
                  <li>
                    Click the gear next to the channel name (or right-click →{" "}
                    <span className="text-slate-300">Edit Channel</span>).
                  </li>
                  <li>
                    Go to <span className="text-slate-300">Integrations → Webhooks</span> →{" "}
                    <span className="text-slate-300">New Webhook</span> (or Create Webhook).
                  </li>
                  <li>Name it (e.g. POKT Hub), confirm the channel, then Copy Webhook URL.</li>
                  <li>Paste the URL below and click Save settings.</li>
                </ol>
              </details>

              <div className="space-y-1.5">
                <label
                  htmlFor="webhook-url-input"
                  className="block text-xs font-medium text-slate-300"
                >
                  {!clearCustomWebhook && savedSettings.hasCustomWebhook
                    ? "Replace Webhook URL (leave blank to keep current)"
                    : "Discord Webhook URL"}
                </label>
                <Input
                  id="webhook-url-input"
                  type="url"
                  value={webhookUrlInput}
                  onChange={(e) => {
                    setWebhookUrlInput(e.target.value);
                    if (e.target.value.trim()) setClearCustomWebhook(false);
                  }}
                  placeholder="https://discord.com/api/webhooks/..."
                  className={cn(glassControl, "h-9 text-xs font-mono")}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="webhook-bot-name"
                  className="block text-xs font-medium text-slate-300"
                >
                  Webhook Display Name
                </label>
                <Input
                  id="webhook-bot-name"
                  type="text"
                  value={botNameInput}
                  onChange={(e) => setBotNameInput(e.target.value)}
                  placeholder="POKT Community Hub"
                  maxLength={80}
                  className={cn(glassControl, "h-9 text-xs")}
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-300">Webhook Avatar</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/[0.06]">
                    {avatarPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarPreview}
                        alt="Webhook avatar preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <LuImage className="h-5 w-5 text-muted" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <input
                      ref={avatarFileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(e) =>
                        handleAvatarFileChange(e.target.files?.[0] ?? null)
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={avatarUploadPending || saveWebhookPending}
                        onClick={() => avatarFileRef.current?.click()}
                        className="h-8 rounded-full border-white/15 bg-white/[0.04] text-xs text-white hover:bg-white/10"
                        aria-busy={avatarUploadPending}
                      >
                        <LuUpload className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                        {avatarUploadPending ? "Uploading…" : "Upload image"}
                      </Button>
                      {avatarPreview || savedSettings.botAvatarUrl ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={avatarUploadPending || saveWebhookPending}
                          onClick={() => {
                            setClearAvatar(true);
                            setBotAvatarUrl(null);
                          }}
                          className="h-8 rounded-full border-white/15 bg-white/[0.04] text-xs text-warning hover:bg-white/10"
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted">
                      PNG / JPEG / WebP · max 2MB. Shown on Discord posts after Save.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* What to Announce */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2.5">
              <p className="text-xs font-semibold tracking-wider text-[#8eb6ff] uppercase">
                What to Announce
              </p>

              <label className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3 cursor-pointer hover:bg-white/[0.05] transition">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">New Quests</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Post an embed with XP reward, category, role reward, and deadline when a quest is published.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={announceNewQuests}
                  onChange={(e) => setAnnounceNewQuests(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/40 accent-[#5865F2] cursor-pointer"
                />
              </label>

              <label className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3 cursor-pointer hover:bg-white/[0.05] transition">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">
                    Ambassador Rank-Ups &amp; Role Unlocks
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Celebrate when an ambassador unlocks a new server role or crosses an XP milestone.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={announceRoleUnlocks}
                  onChange={(e) => setAnnounceRoleUnlocks(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/40 accent-[#5865F2] cursor-pointer"
                />
              </label>

              <label className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3 cursor-pointer hover:bg-white/[0.05] transition">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Quest Completions</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Post to the channel whenever a member&apos;s quest submission is approved.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={announceQuestCompletions}
                  onChange={(e) => setAnnounceQuestCompletions(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/40 accent-[#5865F2] cursor-pointer"
                />
              </label>
            </div>

            {/* Mentions & Pings */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-xs font-semibold tracking-wider text-[#8eb6ff] uppercase">
                Mentions &amp; Pings
              </p>

              <label className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3 cursor-pointer hover:bg-white/[0.05] transition">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">
                    Ping Ambassador (@user) on Rank-Ups
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Mentions the member&apos;s linked Discord account so they get a notification.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={mentionMembers}
                  onChange={(e) => setMentionMembers(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/40 accent-[#5865F2] cursor-pointer"
                />
              </label>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    New Quest Ping
                  </label>
                  <Select
                    value={questPingMode}
                    onValueChange={(v) => setQuestPingMode(v as QuestPingMode)}
                  >
                    <SelectTrigger className={cn(glassControl, "h-9 text-xs")}>
                      <SelectValue placeholder="No ping" />
                    </SelectTrigger>
                    <SelectContent className="border-white/15 bg-[#0a0f1a] text-white">
                      <SelectItem value="none">No ping</SelectItem>
                      <SelectItem value="here">@here (online members)</SelectItem>
                      <SelectItem value="everyone">@everyone</SelectItem>
                      <SelectItem value="role">Specific Discord role (@role)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {questPingMode === "role" ? (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="quest-ping-role-id"
                      className="block text-xs font-medium text-slate-300"
                    >
                      Discord Role ID to Ping
                    </label>
                    <Input
                      id="quest-ping-role-id"
                      type="text"
                      value={questPingRoleId}
                      onChange={(e) => setQuestPingRoleId(e.target.value)}
                      placeholder="e.g. 123456789012345678"
                      className={cn(glassControl, "h-9 text-xs font-mono")}
                    />
                  </div>
                ) : null}
              </div>

              {questPingMode === "role" &&
              roles.some((r) => Boolean(r.discord_role_id)) ? (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] text-muted">Quick pick:</span>
                  {roles
                    .filter((r) => Boolean(r.discord_role_id))
                    .map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setQuestPingRoleId(r.discord_role_id || "")}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
                          questPingRoleId === r.discord_role_id
                            ? "border-primary bg-primary/20 text-white"
                            : "border-white/15 bg-white/[0.04] text-muted hover:text-white",
                        )}
                      >
                        @{r.name}
                      </button>
                    ))}
                </div>
              ) : null}
            </div>

            {modalNotice ? (
              <p
                className={cn(
                  "rounded-xl border px-3 py-2 text-xs font-medium",
                  modalNotice.type === "success"
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-warning/30 bg-warning/10 text-warning",
                )}
              >
                {modalNotice.text}
              </p>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-white/8 px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              disabled={testWebhookPending || saveWebhookPending || avatarUploadPending}
              onClick={() => setWebhookSettingsOpen(false)}
              className="rounded-full border-white/15 bg-white/[0.04] text-white hover:bg-white/10"
            >
              Close
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={
                testWebhookPending ||
                saveWebhookPending ||
                avatarUploadPending ||
                !isWebhookReady
              }
              onClick={handleTestDiscordWebhook}
              className="rounded-full border-[#5865F2]/40 bg-[#5865F2]/15 text-white hover:bg-[#5865F2]/30"
              aria-busy={testWebhookPending}
            >
              {testWebhookPending ? "Sending…" : "Send test"}
            </Button>
            <Button
              type="button"
              disabled={saveWebhookPending || testWebhookPending || avatarUploadPending}
              onClick={handleSaveNotificationSettings}
              className="rounded-full"
              aria-busy={saveWebhookPending}
            >
              {saveWebhookPending ? "Saving…" : "Save settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {syncMessage ? (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-success/30 bg-success/10 px-4 py-2.5 text-xs font-medium text-success">
          <span>{syncMessage}</span>
          <button
            type="button"
            onClick={() => setSyncMessage(null)}
            className="text-muted hover:text-white"
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {syncError ? (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs font-medium text-warning">
          <span>{syncError}</span>
          <button
            type="button"
            onClick={() => setSyncError(null)}
            className="text-muted hover:text-white"
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {tab === "studio" ? (
        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          {/* Create / Edit Form */}
          <div className="rounded-3xl border border-white/10 bg-[#0a0f1a]/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl lg:col-span-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-white">
                {editingRole ? `Edit role: ${editingRole.name}` : "Create server role"}
              </h2>
              {editingRole ? (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-xs text-muted hover:text-white underline"
                >
                  Cancel
                </button>
              ) : null}
            </div>

            <p className="mt-1 text-xs text-muted">
              Roles are auto-awarded when users reach the XP threshold, or can be assigned by moderators.
            </p>

            {/* Live Role Badge Preview */}
            <div className="my-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-center">
              <p className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">
                Live Badge Preview
              </p>
              <ServerRoleBadge
                role={{
                  name: name.trim() || "Preview Role",
                  color: color || "#3b82f6",
                  xp_required: Number(xpRequired) || 0,
                }}
                size="md"
                showXp
              />
            </div>

            <form
              action={editingRole ? updateAction : createAction}
              className="space-y-4"
            >
              {editingRole ? (
                <input type="hidden" name="id" value={editingRole.id} />
              ) : null}

              <div>
                <label className="block text-xs font-medium text-white mb-1.5">
                  Role Name
                </label>
                <input
                  name="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Relay Runner, Shannon Master"
                  className={cn(glassControl, "w-full px-4")}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white mb-1.5">
                  Unlock Threshold (XP Required)
                </label>
                <input
                  name="xpRequired"
                  type="number"
                  min={0}
                  required
                  value={xpRequired}
                  onChange={(e) => setXpRequired(e.target.value)}
                  placeholder="0 for manual mod-only role"
                  className={cn(glassControl, "w-full px-4")}
                />
                <p className="mt-1 text-[11px] text-muted">
                  Set to 0 to make it an honorary role given manually by mods, or granted via quest completion.
                </p>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-white mb-1.5">
                  <LuAward className="h-3.5 w-3.5 text-[#8eb6ff]" />
                  <span>Attach Quest Completion (Optional)</span>
                </label>
                <div className="relative">
                  <select
                    name="questId"
                    value={questId}
                    onChange={(e) => setQuestId(e.target.value)}
                    className={cn(
                      glassControl,
                      "w-full px-4 appearance-none cursor-pointer pr-10 bg-[#0a0f1a]/90 text-foreground",
                    )}
                  >
                    <option value="" className="bg-[#0a0f1a] text-muted">
                      No quest requirement (XP milestone or manual only)
                    </option>
                    {quests.map((q) => (
                      <option key={q.id} value={q.id} className="bg-[#0a0f1a] text-white">
                        ⚡ {q.title} (+{q.xp_reward.toLocaleString()} XP){q.status === "closed" ? " [Closed]" : ""}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted">
                    <LuChevronDown className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-muted leading-relaxed">
                  When an ambassador completes this quest and an admin approves it, this role will be automatically granted.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-white mb-1.5">
                  Role Color
                </label>
                <div className="flex flex-wrap gap-2 mb-2.5">
                  {DISCORD_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.hex}
                      type="button"
                      onClick={() => setColor(swatch.hex)}
                      className={cn(
                        "flex h-7 items-center gap-1.5 rounded-full border px-2 text-xs font-medium transition",
                        color.toLowerCase() === swatch.hex.toLowerCase()
                          ? "border-white bg-white/20 text-white"
                          : "border-white/10 bg-white/5 text-muted hover:border-white/20",
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: swatch.hex }}
                      />
                      <span>{swatch.name}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-white/15 bg-transparent p-1"
                    title="Custom color picker"
                  />
                  <input
                    name="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#3b82f6"
                    className={cn(glassControl, "flex-1 px-4 font-mono text-xs")}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white mb-1.5">
                  Description / Lore (Optional)
                </label>
                <textarea
                  name="description"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this role represent in Pocket Network?"
                  className="w-full rounded-2xl border border-white/15 bg-white/[0.06] p-3 text-xs text-foreground outline-none backdrop-blur-xl placeholder:text-muted focus:border-primary/40 focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white mb-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#5865F2]" />
                    <span>Discord Role ID (Optional)</span>
                  </span>
                </label>
                <input
                  name="discordRoleId"
                  value={discordRoleId}
                  onChange={(e) => setDiscordRoleId(e.target.value)}
                  placeholder="e.g. 112233445566778899 (blank = match by name)"
                  className={cn(glassControl, "w-full px-4 font-mono text-xs")}
                />
                <p className="mt-1 text-[11px] text-muted leading-relaxed">
                  The Discord snowflake ID for this role. If left blank, the bot automatically links by matching the role name (e.g. &quot;{name || "Role Name"}&quot;).
                </p>
              </div>

              {createState.error ? (
                <p className="text-xs text-danger">{createState.error}</p>
              ) : null}
              {updateState.error ? (
                <p className="text-xs text-danger">{updateState.error}</p>
              ) : null}

              <button
                type="submit"
                disabled={createPending || updatePending}
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-white shadow-[0_0_20px_rgba(47,107,255,0.4)] transition hover:bg-primary-hover disabled:opacity-60"
              >
                {createPending || updatePending
                  ? "Saving…"
                  : editingRole
                    ? "Update server role"
                    : "Create server role"}
              </button>
            </form>
          </div>

          {/* Configured Roles List */}
          <div className="space-y-3 lg:col-span-7">
            <h2 className="font-display text-lg font-semibold text-white">
              Active server roles ({roles.length})
            </h2>

            {roles.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-[#0a0f1a]/50 p-8 text-center text-sm text-muted">
                No server roles configured yet. Create one on the left.
              </p>
            ) : (
              <div className="space-y-3">
                {roles.map((r) => (
                  <div
                    key={r.id}
                    className="scroll-list-item flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0c121c] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition sm:flex-row sm:items-center sm:justify-between sm:p-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <ServerRoleBadge
                          role={r}
                          size="md"
                          showXp={r.xp_required > 0}
                        />
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-muted tabular-nums">
                          {r.member_count} {r.member_count === 1 ? "member" : "members"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted leading-relaxed">
                        {r.description || (
                          <span className="italic">No description provided</span>
                        )}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        {r.xp_required === 0 && !r.quest_title ? (
                          <span className="text-muted">Manual moderator assignment only</span>
                        ) : null}
                        {r.xp_required > 0 ? (
                          <span className="text-[#8eb6ff]">
                            Auto-granted at <strong className="font-semibold">{r.xp_required.toLocaleString()} XP</strong>
                          </span>
                        ) : null}
                        {r.quest_title ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-primary">
                            <LuAward className="h-3 w-3" />
                            <span>
                              Awarded on completing: <strong className="font-semibold text-white">{r.quest_title}</strong>
                            </span>
                          </span>
                        ) : null}
                        {r.discord_role_id ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#5865F2]/40 bg-[#5865F2]/10 px-2 py-0.5 text-[10px] font-mono text-[#8eb6ff]">
                            <FaDiscord className="h-3 w-3 text-[#5865F2] shrink-0" />
                            <span>ID: {r.discord_role_id}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-muted">
                            <FaDiscord className="h-3 w-3 text-[#5865F2]/70 shrink-0" />
                            <span>Auto (name)</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(r)}
                        className="h-8 rounded-full border border-white/10 bg-white/5 px-3 text-xs text-muted hover:text-white"
                      >
                        <LuPencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(r)}
                        className="h-8 rounded-full border border-danger/30 bg-danger/10 px-3 text-xs text-danger hover:bg-danger/20"
                      >
                        <LuTrash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Member Assignment Tab */
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:max-w-xl">
              <div className="relative min-w-0 flex-1 sm:max-w-xs">
                <LuSearch className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <Input
                  value={userQuery}
                  onChange={(e) => {
                    setUserQuery(e.target.value);
                    setMemberPage(1);
                  }}
                  placeholder="Search ambassadors by name or email…"
                  className={cn(glassControl, "pl-9")}
                />
              </div>

              <Select
                value={roleFilter}
                onValueChange={(val) => {
                  setRoleFilter(val);
                  setMemberPage(1);
                }}
              >
                <SelectTrigger
                  className={cn(
                    glassControl,
                    "w-full sm:w-52 sm:shrink-0 px-3.5 text-xs",
                  )}
                  aria-label="Filter by role"
                >
                  <div className="flex items-center gap-2 truncate">
                    <LuFilter className="h-3.5 w-3.5 text-muted shrink-0" />
                    <SelectValue placeholder="All roles" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-white/15 bg-[#0a0f1a]/95 backdrop-blur-xl">
                  <SelectItem value="all">
                    <span>All roles</span>
                  </SelectItem>
                  <SelectItem value="none">
                    <span>No roles assigned</span>
                  </SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: r.color }}
                        />
                        <span className="font-medium">{r.name}</span>
                        <span className="text-muted text-[11px] tabular-nums">
                          ({r.member_count})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setUserQuery("");
                    setRoleFilter("all");
                    setMemberPage(1);
                  }}
                  className="h-10 rounded-full px-3 text-xs text-muted hover:text-white sm:shrink-0"
                  title="Clear filters"
                >
                  <LuX className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              ) : null}
            </div>

            <p className="text-xs text-muted sm:text-right">
              Showing <span className="text-white font-medium">{filteredUsers.length}</span> ambassadors.
              Click role pills to assign or revoke.
            </p>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#0a0f1a]/80 p-12 text-center text-sm text-muted backdrop-blur-xl">
              <p>No ambassadors found matching the selected filters.</p>
              {hasFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setUserQuery("");
                    setRoleFilter("all");
                    setMemberPage(1);
                  }}
                  className="mt-3 rounded-full text-xs text-[#8eb6ff] hover:text-white"
                >
                  Clear all filters
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-[#0a0f1a]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
              {paginatedUsers.map((user) => {
                const assignedIds = new Set((user.roles ?? []).map((r) => r.id));

                return (
                  <div
                    key={user.id}
                    className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar name={user.name} src={user.image} size={42} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-white">
                            {user.name}
                          </p>
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-[#8eb6ff] tabular-nums">
                            {user.totalXp.toLocaleString()} XP
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <p className="truncate text-xs text-muted">
                            {user.email}
                          </p>
                          {user.discordId ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5865F2]/15 px-2 py-0.5 text-[10px] font-mono text-[#a5b4fc]">
                              <FaDiscord className="h-3 w-3 text-[#5865F2] shrink-0" />
                              <span>{user.discordId}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted/60">
                              (No Discord linked)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Active & Available Roles */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:max-w-md sm:justify-end">
                      {roles.map((r) => {
                        const hasRole = assignedIds.has(r.id);

                        return (
                          <button
                            key={r.id}
                            type="button"
                            disabled={assignPending}
                            onClick={() => handleToggleRole(user.id, r.id, hasRole)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                              hasRole
                                ? "border-transparent text-white"
                                : "border-white/10 bg-white/[0.03] text-muted hover:border-white/20 hover:text-white",
                            )}
                            style={
                              hasRole
                                ? {
                                    backgroundColor: `${r.color}25`,
                                    borderColor: `${r.color}50`,
                                    color: "#ffffff",
                                  }
                                : undefined
                            }
                            title={
                              hasRole
                                ? `Click to remove ${r.name}`
                                : `Click to assign ${r.name} (Requires ${r.xp_required} XP)`
                            }
                          >
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                !hasRole && "opacity-40",
                              )}
                              style={{ backgroundColor: r.color }}
                            />
                            <span>{r.name}</span>
                            {hasRole ? (
                              <LuCheck className="h-3 w-3 text-success ml-0.5" />
                            ) : (
                              <LuPlus className="h-3 w-3 opacity-50 ml-0.5" />
                            )}
                          </button>
                        );
                      })}

                      {user.discordId && (
                        <button
                          type="button"
                          disabled={syncingUserId === user.id}
                          onClick={() => handleSyncSingleUser(user.id)}
                          className={cn(
                            "inline-flex items-center justify-center gap-1 rounded-full border border-[#5865F2]/30 bg-[#5865F2]/10 h-7 w-7 p-0 sm:h-auto sm:w-auto sm:px-2.5 sm:py-1 text-xs font-medium text-[#c7d2fe] hover:bg-[#5865F2]/20 hover:border-[#5865F2]/50 transition",
                            syncingUserId === user.id && "opacity-60 cursor-not-allowed",
                          )}
                          title="Sync active roles to Discord for this user"
                          aria-label="Sync Discord roles for user"
                        >
                          <LuRefreshCw
                            className={cn(
                              "h-3 w-3 shrink-0",
                              syncingUserId === user.id && "animate-spin text-[#818cf8]",
                            )}
                          />
                          <span className="hidden sm:inline">Sync Discord</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-white/10 pt-4">
              <p className="text-xs text-muted tabular-nums">
                Showing <span className="font-medium text-white">{(safePage - 1) * MEMBERS_PAGE_SIZE + 1}–{Math.min(safePage * MEMBERS_PAGE_SIZE, filteredUsers.length)}</span> of <span className="font-medium text-white">{filteredUsers.length}</span> ambassadors
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(glassControl, "h-9 px-3.5 text-xs")}
                  disabled={safePage <= 1}
                  onClick={() => setMemberPage((p) => Math.max(1, p - 1))}
                >
                  <LuChevronLeft className="h-4 w-4 mr-1" />
                  Prev
                </Button>
                <span className="text-xs text-muted tabular-nums px-2">
                  Page <strong className="text-white font-semibold">{safePage}</strong> of <strong className="text-white font-semibold">{totalPages}</strong>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(glassControl, "h-9 px-3.5 text-xs")}
                  disabled={safePage >= totalPages}
                  onClick={() => setMemberPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <LuChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title="Delete role"
        description={
          <>
            Delete{" "}
            <span className="font-semibold text-white">
              {deleteTarget?.name}
            </span>
            ? This will remove it from all members. This can’t be undone.
          </>
        }
        pending={deletePending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteRole}
      />
    </div>
  );
}
