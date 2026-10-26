"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ClipboardEvent,
  type ComponentProps,
} from "react";
import { useRouter } from "next/navigation";
import { FaDiscord } from "react-icons/fa6";
import type { DateRange } from "react-day-picker";
import {
  LuAward,
  LuCalendarClock,
  LuEye,
  LuPlus,
  LuSearch,
  LuSparkles,
  LuTags,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import {
  createQuestAction,
  deleteQuestAction,
  updateQuestAction,
  type QuestActionState,
} from "@/app/actions/quests";
import { CategoryManagement } from "@/components/category-management";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { DateRangePicker } from "@/components/date-range-picker";
import { QuestScheduleChip } from "@/components/quest-schedule-chip";
import { ServerRoleBadge } from "@/components/server-role-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QuestCategory, ServerRole } from "@/lib/db";
import { QUEST_ICON_PRESETS, questIconFor } from "@/lib/quest-icons";
import {
  dateRangeToScheduleIso,
  questToDateRange,
} from "@/lib/quest-schedule";
import { cn } from "@/lib/utils";

export type QuestFormValues = {
  id: string;
  title: string;
  description: string;
  xp_reward: number;
  icon: string | null;
  status: "active" | "closed";
  category_id?: string | null;
  category_name?: string | null;
  link_description?: string | null;
  link_count?: number;
  reward_role_id?: string | null;
  reward_role_name?: string | null;
  reward_role_color?: string | null;
  starts_at?: string | Date | null;
  ends_at?: string | Date | null;
};

const initial: QuestActionState = { ok: false };

const fieldShell =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-muted/70 focus:border-primary/40 focus:bg-white/[0.05] focus:ring-2 focus:ring-primary/25";

const xpFieldShell = cn(
  fieldShell,
  "pr-10 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
);

const selectTriggerShell = cn(
  fieldShell,
  "h-auto justify-between py-2.5 shadow-none data-[placeholder]:text-muted",
);

const selectMenu =
  "z-[120] rounded-xl border-white/15 bg-[#0a0f1a]/95 text-sm backdrop-blur-xl";

const labelClass =
  "mb-1.5 block text-[11px] font-semibold tracking-wide text-muted uppercase";

const glassSearch =
  "h-8 sm:h-9 rounded-full border border-white/12 bg-white/[0.05] pl-8 sm:pl-9 text-xs sm:text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-muted focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/25";

/** Normalize AI / rich clipboard text into clean plain text for textareas. */
function normalizePastedText(raw: string) {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\n{3,}/g, "\n\n");
}

function htmlClipboardToText(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blockTags = new Set([
    "P",
    "DIV",
    "LI",
    "BR",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "TR",
    "PRE",
  ]);

  let out = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.tagName === "BR") {
      out += "\n";
      return;
    }
    if (el.tagName === "LI") {
      out += out.endsWith("\n") || !out ? "- " : "\n- ";
    }
    for (const child of Array.from(el.childNodes)) walk(child);
    if (blockTags.has(el.tagName) && el.tagName !== "BR") {
      out += "\n";
    }
  };
  walk(doc.body);
  return normalizePastedText(out);
}

function handlePlainPaste(
  event: ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>,
) {
  const clipboard = event.clipboardData;
  if (!clipboard) return;

  const html = clipboard.getData("text/html");
  const plain = clipboard.getData("text/plain");
  const next = html
    ? htmlClipboardToText(html)
    : normalizePastedText(plain ?? "");

  if (!next && !plain && !html) return;

  event.preventDefault();
  const target = event.currentTarget;
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? target.value.length;
  const value = target.value;
  const merged = value.slice(0, start) + next + value.slice(end);
  target.value = merged;
  const caret = start + next.length;
  target.setSelectionRange(caret, caret);
  target.dispatchEvent(new Event("input", { bubbles: true }));
}

function QuestDescriptionField({
  className,
  ...props
}: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      spellCheck
      onPaste={handlePlainPaste}
      className={cn(
        fieldShell,
        "min-h-[8rem] resize-y whitespace-pre-wrap break-words leading-relaxed [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    />
  );
}

function openQuestPreview(questId: string) {
  window.open(`/quests/${questId}`, "_blank", "noopener,noreferrer");
}

function QuestIconSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const currentPreset = QUEST_ICON_PRESETS.find((p) => p.id === value);
  const CurrentIcon = currentPreset?.Icon;

  return (
    <Select
      value={value || "auto"}
      onValueChange={(v) => onChange(v === "auto" ? "" : v)}
    >
      <SelectTrigger className={selectTriggerShell} aria-label="Icon preset">
        <SelectValue>
          {currentPreset && CurrentIcon ? (
            <span className="flex items-center gap-2 truncate">
              <CurrentIcon
                className="h-4 w-4 shrink-0"
                style={{ color: currentPreset.colorHex }}
                aria-hidden
              />
              <span className="truncate text-white">{currentPreset.label}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2 truncate text-muted">
              <LuSparkles className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <span className="truncate">Auto-detect</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className={cn(selectMenu, "max-h-64")}>
        <SelectItem value="auto">
          <span className="flex items-center gap-2 text-muted">
            <LuSparkles className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            <span>Auto-detect from title</span>
          </span>
        </SelectItem>
        {QUEST_ICON_PRESETS.map((preset) => {
          const PresetIcon = preset.Icon;
          return (
            <SelectItem key={preset.id} value={preset.id}>
              <span className="flex items-center gap-2">
                <PresetIcon
                  className="h-4 w-4 shrink-0"
                  style={{ color: preset.colorHex }}
                  aria-hidden
                />
                <span className="truncate">{preset.label}</span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

const QUEST_MODAL_FORM_ID = "quest-admin-modal-form";

function UnsavedChangesDialog({
  open,
  pending = false,
  onKeepEditing,
  onDiscard,
  onSave,
}: {
  open: boolean;
  pending?: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setVisible(open));
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onKeepEditing();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onKeepEditing]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close unsaved dialog backdrop"
        disabled={pending}
        className={cn(
          "absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0",
        )}
        onClick={() => {
          if (!pending) onKeepEditing();
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        aria-describedby="unsaved-desc"
        className={cn(
          "relative z-10 w-full max-w-md overflow-hidden rounded-t-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(14,22,38,0.99)_0%,rgba(8,12,20,1)_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.55)] transition-all duration-200 sm:rounded-2xl",
          visible
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-4 scale-[0.98] opacity-0 sm:translate-y-2",
        )}
      >
        <div className="border-b border-white/10 px-4 py-3.5 sm:px-5">
          <p className="text-[11px] font-semibold tracking-wide text-[#8eb6ff] uppercase">
            Unsaved
          </p>
          <h2
            id="unsaved-title"
            className="font-display mt-0.5 text-base font-semibold text-white"
          >
            Save changes?
          </h2>
        </div>
        <div className="space-y-4 px-4 py-4 sm:px-5">
          <p id="unsaved-desc" className="text-sm leading-relaxed text-muted">
            You have unsaved edits. Save them before closing, or discard to leave
            without saving.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={pending}
              onClick={onDiscard}
              className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-foreground transition hover:bg-white/[0.08] disabled:opacity-60"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onKeepEditing}
              className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-foreground transition hover:bg-white/[0.08] disabled:opacity-60"
            >
              Keep editing
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onSave}
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-[0_0_14px_rgba(26,109,255,0.35)] transition hover:bg-primary-hover disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CreateQuestForm({
  roles = [],
  categories = [],
  onCancel,
  onDirtyChange,
  onSaved,
}: {
  roles?: ServerRole[];
  categories?: QuestCategory[];
  onCancel?: () => void;
  onDirtyChange?: () => void;
  onSaved?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    createQuestAction,
    initial,
  );
  const [rewardRoleId, setRewardRoleId] = useState("none");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [icon, setIcon] = useState("");
  const [scheduleRange, setScheduleRange] = useState<DateRange | undefined>(
    undefined,
  );
  const scheduleIso = dateRangeToScheduleIso(scheduleRange);

  useEffect(() => {
    if (state.ok) onSaved?.();
  }, [state.ok, onSaved]);

  return (
    <form
      id={QUEST_MODAL_FORM_ID}
      action={formAction}
      className="space-y-4"
      onInput={() => onDirtyChange?.()}
      onChange={() => onDirtyChange?.()}
    >
      <input type="hidden" name="categoryId" value={categoryId} />
      <input
        type="hidden"
        name="rewardRoleId"
        value={rewardRoleId === "none" ? "" : rewardRoleId}
      />
      <input type="hidden" name="icon" value={icon} />
      <input type="hidden" name="startsAt" value={scheduleIso.startsAt} />
      <input type="hidden" name="endsAt" value={scheduleIso.endsAt} />

        <div>
          <label htmlFor="create-title" className={labelClass}>
            Title
          </label>
          <input
            id="create-title"
            name="title"
            required
            placeholder="e.g. Local Meetup Recap"
            className={fieldShell}
            onPaste={handlePlainPaste}
          />
        </div>

        <div>
          <label htmlFor="create-description" className={labelClass}>
            Description
          </label>
          <QuestDescriptionField
            id="create-description"
            name="description"
            rows={6}
            placeholder="Paste requirements from notes or ChatGPT — line breaks and lists are kept."
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="min-w-0">
            <label htmlFor="create-xp" className={labelClass}>
              XP reward
          </label>
            <div className="relative">
              <input
                id="create-xp"
                name="xpReward"
                type="number"
                inputMode="numeric"
                min={0}
                required
                placeholder="150"
                className={xpFieldShell}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11px] font-semibold text-[#8eb6ff]">
                XP
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Category</label>
            <Select
              value={categoryId || undefined}
              onValueChange={(v) => {
                onDirtyChange?.();
                setCategoryId(v);
              }}
            >
              <SelectTrigger className={selectTriggerShell} aria-label="Category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className={selectMenu}>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categories.length === 0 ? (
              <p className="mt-1.5 text-xs text-warning">
                Add a category first via Manage categories.
              </p>
            ) : null}
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Status</label>
            <div
              className={cn(
                selectTriggerShell,
                "flex items-center text-muted",
              )}
            >
              Active
            </div>
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Icon</label>
            <QuestIconSelect
              value={icon}
              onChange={(v) => {
                onDirtyChange?.();
                setIcon(v);
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="min-w-0">
            <label className={labelClass}>
              <span className="inline-flex items-center gap-1">
                <LuAward className="h-3 w-3 text-[#8eb6ff]" aria-hidden />
                Award role
              </span>
            </label>
            <Select
              value={rewardRoleId}
              onValueChange={(v) => {
                onDirtyChange?.();
                setRewardRoleId(v);
              }}
            >
              <SelectTrigger className={selectTriggerShell} aria-label="Award role">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent className={selectMenu}>
                <SelectItem value="none">None</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <label className={labelClass}>
              <span className="inline-flex items-center gap-1">
                <LuCalendarClock className="h-3 w-3 text-[#8eb6ff]" aria-hidden />
                Schedule
              </span>
            </label>
            <DateRangePicker
              range={scheduleRange}
              onRangeChange={(next) => {
                onDirtyChange?.();
                setScheduleRange(next);
              }}
              placeholder="Optional"
              triggerClassName={cn(
                selectTriggerShell,
                "w-full sm:w-full justify-start gap-2 font-normal hover:bg-white/[0.05]",
                !scheduleRange?.from && "text-muted",
              )}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="create-link-desc" className={labelClass}>
              Link description
            </label>
            <input
              id="create-link-desc"
              name="linkDescription"
              placeholder="e.g. Tweet + screenshot link"
              className={fieldShell}
              onPaste={handlePlainPaste}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="create-link-count" className={labelClass}>
              Links
            </label>
            <input
              id="create-link-count"
              name="linkCount"
              type="number"
              inputMode="numeric"
              min={1}
              max={8}
              defaultValue={1}
              required
              className={xpFieldShell}
            />
        </div>
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
        <input
          type="checkbox"
          id="create-broadcast-discord"
          name="broadcastDiscord"
          defaultChecked
          className="h-4 w-4 rounded border-white/20 bg-black/40 text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer accent-[#5865F2]"
        />
        <label
          htmlFor="create-broadcast-discord"
          className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-200 select-none"
        >
          <FaDiscord className="h-4 w-4 text-[#5865F2] shrink-0" />
          <span>Broadcast quest to Discord announcements channel</span>
        </label>
      </div>

      {state.error ? (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
      ) : null}
      {state.ok ? (
          <p className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            Quest created.
          </p>
      ) : null}

      <div className="sticky bottom-0 z-20 -mx-4 -mb-4 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 bg-[#080c14]/95 px-4 py-3 backdrop-blur-md sm:-mx-5 sm:-mb-4 sm:px-5">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium text-muted transition hover:text-white"
          >
            Cancel
          </button>
        ) : null}
        <Button
          type="submit"
          disabled={pending}
          className="h-9 rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-[0_0_16px_rgba(26,109,255,0.35)] hover:bg-primary-hover"
        >
          <LuPlus className="h-4 w-4" aria-hidden />
          {pending ? "Creating…" : "Create quest"}
        </Button>
      </div>
    </form>
  );
}

type StatusFilter = "all" | "active" | "closed";
type ModalMode = "idle" | "create" | "edit";

function statusLabel(status: "active" | "closed") {
  return status === "active" ? "Active" : "Inactive";
}

export function QuestBoardList({
  quests,
  roles = [],
  categories = [],
}: {
  quests: QuestFormValues[];
  roles?: ServerRole[];
  categories?: QuestCategory[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [modalMode, setModalMode] = useState<ModalMode>("idle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuestFormValues | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [closeAfterSave, setCloseAfterSave] = useState(false);

  const categoryPills = useMemo(
    () => [
      { value: "all", label: "All" },
      ...categories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return quests.filter((quest) => {
      if (status !== "all" && quest.status !== status) return false;
      if (categoryId !== "all" && quest.category_id !== categoryId) return false;
      if (!q) return true;
      const hay =
        `${quest.title} ${quest.description} ${quest.status} ${quest.category_name ?? ""} ${quest.reward_role_name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [quests, query, status, categoryId]);

  const selected = useMemo(
    () => quests.find((q) => q.id === selectedId) ?? null,
    [quests, selectedId],
  );

  const modalOpen = modalMode !== "idle";

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      if (!modalOpen) {
        setModalVisible(false);
        return;
      }
      setDirty(false);
      setUnsavedOpen(false);
      setCloseAfterSave(false);
      setModalVisible(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, [modalOpen, modalMode, selectedId]);

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (dirty) {
          setUnsavedOpen(true);
        } else {
          setUnsavedOpen(false);
          setDirty(false);
          setCloseAfterSave(false);
          setModalVisible(false);
          window.setTimeout(() => {
            setModalMode("idle");
            setSelectedId(null);
          }, 200);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, dirty]);

  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modalOpen]);

  function forceClose() {
    setUnsavedOpen(false);
    setDirty(false);
    setCloseAfterSave(false);
    setModalVisible(false);
    window.setTimeout(() => {
      setModalMode("idle");
      setSelectedId(null);
    }, 200);
  }

  function requestClose() {
    if (dirty) {
      setUnsavedOpen(true);
      return;
    }
    forceClose();
  }

  function saveFromUnsaved() {
    setCloseAfterSave(true);
    const form = document.getElementById(
      QUEST_MODAL_FORM_ID,
    ) as HTMLFormElement | null;
    form?.requestSubmit();
  }

  function handleFormSaved() {
    setDirty(false);
    router.refresh();
    if (closeAfterSave) {
      forceClose();
    }
  }

  function openCreate() {
    setSelectedId(null);
    setDirty(false);
    setUnsavedOpen(false);
    setModalVisible(false);
    setModalMode("create");
  }

  function selectQuest(id: string) {
    setDirty(false);
    setUnsavedOpen(false);
    setModalVisible(false);
    setSelectedId(id);
    setModalMode("edit");
  }

  function confirmDeleteQuest() {
    if (!deleteTarget) return;
    setActionError(null);
    startTransition(async () => {
      const result = await deleteQuestAction(deleteTarget.id);
      if (!result.ok) {
        setActionError(result.error ?? "Could not delete quest.");
        return;
      }
      if (selectedId === deleteTarget.id) forceClose();
      setDeleteTarget(null);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 sm:space-y-6">
      <header className="flex flex-col gap-2.5 sm:gap-3">
        <div className="flex flex-col gap-2.5 sm:gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-wide text-[#8eb6ff] uppercase sm:text-xs">
              Operations
            </p>
            <h1 className="font-display mt-0.5 text-xl font-semibold tracking-tight text-white sm:mt-1 sm:text-3xl">
              Manage quests
            </h1>
          </div>

          <div className="flex w-full min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-2 lg:w-auto [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setCategoriesOpen(true)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] p-0 text-xs font-medium text-muted transition hover:border-white/25 hover:text-white sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
              title="Manage categories"
            >
              <LuTags className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Tags</span>
            </button>

            <div className="relative min-w-0 flex-1 sm:w-40 sm:flex-none">
              <LuSearch className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted sm:left-3" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className={glassSearch}
                aria-label="Search quests"
              />
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full bg-primary px-2.5 text-xs font-semibold text-white shadow-[0_0_14px_rgba(26,109,255,0.35)] transition hover:bg-primary-hover sm:h-9 sm:gap-1.5 sm:px-3.5"
            >
              <LuPlus className="h-3.5 w-3.5" aria-hidden />
              <span className="sm:hidden">New</span>
              <span className="hidden sm:inline">Create new</span>
            </button>

            <div
              role="tablist"
              aria-label="Filter by status"
              className="inline-flex shrink-0 rounded-full border border-white/10 bg-white/[0.03] p-0.5"
            >
              {(
                [
                  { value: "all", label: "All" },
                  { value: "active", label: "Active" },
                  { value: "closed", label: "Inactive" },
                ] as const
              ).map((tab) => {
                const active = status === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setStatus(tab.value)}
                    className={cn(
                      "rounded-full px-2 py-1 text-[10.5px] font-semibold transition sm:px-3 sm:py-1.5 sm:text-xs",
                      active
                        ? "bg-primary text-white shadow-[0_0_12px_rgba(26,109,255,0.35)]"
                        : "text-muted hover:text-white",
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-white/8 pt-2.5 sm:pt-3.5">
          <div
            role="tablist"
            aria-label="Filter by category"
            className="flex max-w-full items-center justify-start gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.03] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-auto sm:w-fit sm:justify-center [&::-webkit-scrollbar]:hidden"
          >
            {categoryPills.map((pill) => {
              const active = categoryId === pill.value;
              return (
                <button
                  key={pill.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategoryId(pill.value)}
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition sm:px-4 sm:py-1.5 sm:text-xs",
                    active
                      ? "bg-primary text-white shadow-[0_0_12px_rgba(26,109,255,0.35)]"
                      : "text-muted hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {actionError ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {actionError}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center text-sm text-muted">
          {quests.length === 0
            ? "No quests yet. Use Create new to add one."
            : "No quests match these filters."}
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 sm:gap-3">
          {filtered.map((quest) => {
            const selectedCard =
              modalMode === "edit" && selectedId === quest.id;
            const Icon = questIconFor(quest);
            const isActive = quest.status === "active";
            return (
              <li key={quest.id}>
                <div
                  className={cn(
                    "scroll-list-item relative flex h-full flex-col rounded-xl border p-3 transition sm:rounded-2xl sm:p-4",
                    selectedCard
                      ? "border-primary/45 bg-primary/15"
                      : "border-white/10 bg-[#0c121c]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectQuest(quest.id)}
                    aria-pressed={selectedCard}
                    className="flex w-full flex-1 gap-2.5 text-left sm:gap-3"
                  >
                    <span
                      className={cn(
                        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border sm:h-10 sm:w-10 sm:rounded-xl",
                        isActive
                          ? "border-primary/25 bg-primary/10 text-primary"
                          : "border-white/10 bg-white/[0.04] text-muted",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase">
                        <span className="truncate text-[#8eb6ff]">
                          {quest.category_name?.trim() || "Uncategorized"}
                        </span>
                        <span className="text-white/20" aria-hidden>
                          ·
                        </span>
                        <span
                          className={cn(
                            "shrink-0",
                            isActive ? "text-success" : "text-muted",
                          )}
                        >
                          {statusLabel(quest.status)}
                        </span>
                        <span className="ml-auto shrink-0 tabular-nums text-[#8eb6ff] normal-case tracking-normal">
                          {quest.xp_reward} XP
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm font-semibold text-white sm:text-base">
                        {quest.title}
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs leading-snug text-muted sm:mt-1.5 sm:line-clamp-2 sm:text-sm sm:leading-relaxed">
                        {quest.description || "No description."}
                      </p>
          {quest.reward_role_name || quest.starts_at || quest.ends_at ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {quest.reward_role_name ? (
                <ServerRoleBadge
                  role={{
                    name: quest.reward_role_name,
                    color: quest.reward_role_color || "#3b82f6",
                  }}
                  size="xs"
                />
              ) : null}
              {quest.starts_at || quest.ends_at ? (
                <QuestScheduleChip quest={quest} size="xs" />
              ) : null}
            </div>
          ) : null}
        </div>
                  </button>

                  {!isActive ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setDeleteTarget(quest)}
                      aria-label={`Delete ${quest.title}`}
                      className="absolute right-2 bottom-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/18 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-md transition hover:border-white/30 hover:bg-white/18 disabled:opacity-60 sm:right-3 sm:bottom-3 sm:h-8 sm:w-8"
                    >
                      <LuTrash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title="Delete quest"
        description={
          <>
            Delete{" "}
            <span className="font-semibold text-white">
              {deleteTarget?.title}
            </span>
            ? Submissions for this quest will be removed. This can’t be undone.
          </>
        }
        pending={isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteQuest}
      />

      <CategoryManagement
        open={categoriesOpen}
        categories={categories}
        onClose={() => setCategoriesOpen(false)}
      />

      {modalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close modal backdrop"
            className={cn(
              "absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-200",
              modalVisible ? "opacity-100" : "opacity-0",
            )}
            onClick={requestClose}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={modalMode === "create" ? "Create quest" : "Edit quest"}
            className={cn(
              "relative z-10 flex max-h-[min(92dvh,44rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(14,22,38,0.99)_0%,rgba(8,12,20,1)_100%)] pb-[env(safe-area-inset-bottom)] shadow-[0_24px_80px_rgba(0,0,0,0.55)] transition-all duration-200 sm:rounded-2xl sm:pb-0",
              modalVisible
                ? "translate-y-0 scale-100 opacity-100"
                : "translate-y-4 scale-[0.98] opacity-0 sm:translate-y-2",
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wide text-[#8eb6ff] uppercase">
                  {modalMode === "create" ? "New quest" : "Edit quest"}
                  {dirty ? (
                    <span className="ml-2 font-medium normal-case tracking-normal text-warning">
                      · Unsaved
        </span>
                  ) : null}
                </p>
                <h2 className="font-display mt-0.5 truncate text-base font-semibold text-white sm:text-lg">
                  {modalMode === "create"
                    ? "Create quest"
                    : (selected?.title ?? "Quest")}
                </h2>
              </div>
              <button
                type="button"
                onClick={requestClose}
                aria-label="Close"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-muted transition hover:border-white/25 hover:text-white"
              >
                <LuX className="h-4 w-4" aria-hidden />
              </button>
      </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-5 [&::-webkit-scrollbar]:hidden">
              {modalMode === "create" ? (
                <CreateQuestForm
                  roles={roles}
                  categories={categories}
                  onCancel={requestClose}
                  onDirtyChange={() => setDirty(true)}
                  onSaved={handleFormSaved}
                />
              ) : selected ? (
                <EditQuestForm
                  key={selected.id}
                  quest={selected}
                  roles={roles}
                  categories={categories}
                  onDirtyChange={() => setDirty(true)}
                  onSaved={handleFormSaved}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <UnsavedChangesDialog
        open={unsavedOpen}
        pending={isPending}
        onKeepEditing={() => setUnsavedOpen(false)}
        onDiscard={forceClose}
        onSave={saveFromUnsaved}
      />
    </section>
  );
}

export function EditQuestForm({
  quest,
  roles = [],
  categories = [],
  onDirtyChange,
  onSaved,
}: {
  quest: QuestFormValues;
  roles?: ServerRole[];
  categories?: QuestCategory[];
  onDirtyChange?: () => void;
  onSaved?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    updateQuestAction,
    initial,
  );
  const [rewardRoleId, setRewardRoleId] = useState(
    quest.reward_role_id || "none",
  );
  const [categoryId, setCategoryId] = useState(quest.category_id || "");
  const [status, setStatus] = useState<"active" | "closed">(quest.status);
  const [icon, setIcon] = useState(quest.icon ?? "");
  const [scheduleRange, setScheduleRange] = useState<DateRange | undefined>(
    () => questToDateRange(quest),
  );
  const scheduleIso = dateRangeToScheduleIso(scheduleRange);

  useEffect(() => {
    if (state.ok) onSaved?.();
  }, [state.ok, onSaved]);

  return (
    <form
      id={QUEST_MODAL_FORM_ID}
      action={formAction}
      className="space-y-4"
      onInput={() => onDirtyChange?.()}
      onChange={() => onDirtyChange?.()}
    >
      <input type="hidden" name="id" value={quest.id} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input
        type="hidden"
        name="rewardRoleId"
        value={rewardRoleId === "none" ? "" : rewardRoleId}
      />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="icon" value={icon} />
      <input type="hidden" name="startsAt" value={scheduleIso.startsAt} />
      <input type="hidden" name="endsAt" value={scheduleIso.endsAt} />

        <div>
          <label className={labelClass}>Title</label>
          <input
            name="title"
            required
            defaultValue={quest.title}
            className={fieldShell}
            onPaste={handlePlainPaste}
          />
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <QuestDescriptionField
            name="description"
            rows={5}
            defaultValue={quest.description}
            placeholder="Paste requirements from notes or ChatGPT — line breaks and lists are kept."
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="min-w-0">
            <label className={labelClass}>XP reward</label>
            <div className="relative">
              <input
                name="xpReward"
                type="number"
                inputMode="numeric"
                min={0}
                required
                defaultValue={quest.xp_reward}
                className={xpFieldShell}
              />
              <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] font-semibold text-[#8eb6ff] sm:right-3 sm:text-[11px]">
                XP
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Category</label>
            <Select
              value={categoryId || undefined}
              onValueChange={(v) => {
                onDirtyChange?.();
                setCategoryId(v);
              }}
            >
              <SelectTrigger className={selectTriggerShell} aria-label="Category">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className={selectMenu}>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Status</label>
            <Select
              value={status}
              onValueChange={(v) => {
                if (v === "active" || v === "closed") {
                  onDirtyChange?.();
                  setStatus(v);
                }
              }}
            >
              <SelectTrigger className={selectTriggerShell} aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectMenu}>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Icon</label>
            <QuestIconSelect
              value={icon}
              onChange={(v) => {
                onDirtyChange?.();
                setIcon(v);
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="min-w-0">
            <label className={labelClass}>
              <span className="inline-flex items-center gap-1">
                <LuAward className="h-3 w-3 text-[#8eb6ff]" aria-hidden />
                Award role
              </span>
            </label>
            <Select
              value={rewardRoleId}
              onValueChange={(v) => {
                onDirtyChange?.();
                setRewardRoleId(v);
              }}
            >
              <SelectTrigger className={selectTriggerShell} aria-label="Award role">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent className={selectMenu}>
                <SelectItem value="none">None</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <label className={labelClass}>
              <span className="inline-flex items-center gap-1">
                <LuCalendarClock className="h-3 w-3 text-[#8eb6ff]" aria-hidden />
                Schedule
              </span>
            </label>
            <DateRangePicker
              range={scheduleRange}
              onRangeChange={(next) => {
                onDirtyChange?.();
                setScheduleRange(next);
              }}
              placeholder="Optional"
              triggerClassName={cn(
                selectTriggerShell,
                "w-full sm:w-full justify-start gap-2 font-normal hover:bg-white/[0.05]",
                !scheduleRange?.from && "text-muted",
              )}
            />
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Link description</label>
            <input
              name="linkDescription"
              defaultValue={quest.link_description ?? ""}
              placeholder="e.g. Tweet + PR link"
              className={fieldShell}
              onPaste={handlePlainPaste}
            />
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Links</label>
            <input
              name="linkCount"
              type="number"
              inputMode="numeric"
              min={1}
              max={8}
              required
              defaultValue={quest.link_count ?? 1}
              className={xpFieldShell}
            />
          </div>
      </div>

      {state.error ? (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
      ) : null}
      {state.ok ? (
          <p className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            Quest saved.
          </p>
      ) : null}

      <div className="sticky bottom-0 z-20 -mx-4 -mb-4 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 bg-[#080c14]/95 px-4 py-3 backdrop-blur-md sm:-mx-5 sm:-mb-4 sm:px-5">
        <button
          type="button"
          onClick={() => openQuestPreview(quest.id)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
        >
          <LuEye className="h-3.5 w-3.5" aria-hidden />
          Preview quest
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-[0_0_16px_rgba(26,109,255,0.35)] transition hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
