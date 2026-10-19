"use client";

import Image from "next/image";
import { createElement, useState, useTransition, type ReactNode } from "react";
import {
  LuArrowRight,
  LuBolt,
  LuCheck,
  LuClock,
  LuSearch,
} from "react-icons/lu";
import { getMyQuestDetailAction } from "@/app/actions/quest-detail";
import { QuestDetailPanel } from "@/components/quest-detail-panel";
import {
  glassControl,
  QuestFilterBar,
  useQuestFilters,
} from "@/components/quest-filters";
import { DateRangePicker } from "@/components/date-range-picker";
import { DiscordLoginButton } from "@/components/discord-login-button";
import { QuestDescription } from "@/components/quest-description";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmissionStatusBadge } from "@/components/submission-status-badge";
import { QuestScheduleChip } from "@/components/quest-schedule-chip";
import { ServerRoleBadge } from "@/components/server-role-badge";
import { XpBadge } from "@/components/xp-badge";
import type { QuestCategory } from "@/lib/db";
import { questIconFor, questIconVisual } from "@/lib/quest-icons";
import {
  questCategoryLabel,
  xpLevelProgress,
  type FilterableQuest,
  type QuestListItem,
} from "@/lib/quest-filters";
import { toMs } from "@/lib/quest-schedule";
import { cn } from "@/lib/utils";

type AmbassadorQuestsProps = {
  quests: QuestListItem[];
  categories?: QuestCategory[];
  variant?: "list" | "grid" | "board";
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  headerAction?: ReactNode;
  backLabel?: string;
  totalXp?: number;
  authenticated?: boolean;
  authCallbackURL?: string;
  emptyTitle?: string;
  emptyBody?: string;
};

function ctaLabel(
  status: QuestListItem["submission_status"],
  isUpcoming = false,
) {
  if (isUpcoming) return "Preview";
  if (status === "approved") return "View";
  if (status === "pending") return "View progress";
  if (status === "rejected") return "Resubmit";
  return "Start";
}

function progressFor(status: QuestListItem["submission_status"]) {
  if (status === "approved") return { done: 1, total: 1 };
  if (status === "pending") return { done: 1, total: 1 };
  if (status === "rejected") return { done: 0, total: 1 };
  return { done: 0, total: 1 };
}

export function AmbassadorQuests({
  quests,
  categories = [],
  variant = "list",
  title = "Quests",
  subtitle = "Complete tasks, earn XP and unlock rewards.",
  eyebrow,
  headerAction,
  backLabel = "Back to quests",
  totalXp = 0,
  authenticated = true,
  authCallbackURL = "/quests",
  emptyTitle = "No active quests",
  emptyBody = "Check back soon for new tasks.",
}: AmbassadorQuestsProps) {
  const {
    query,
    setQuery,
    status,
    setStatus,
    range,
    setRange,
    filtered: statusFiltered,
    hasFilters: baseHasFilters,
    resetFilters: resetBaseFilters,
  } = useQuestFilters(quests);
  const [categoryId, setCategoryId] = useState<string>("all");
  const [activeQuest, setActiveQuest] = useState<FilterableQuest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const level = xpLevelProgress(totalXp);

  const categoryPills = [
    { value: "all", label: "All Quests" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const filtered =
    categoryId === "all"
      ? statusFiltered
      : statusFiltered.filter((q) => q.category_id === categoryId);

  const hasFilters = baseHasFilters || categoryId !== "all";

  function resetFilters() {
    resetBaseFilters();
    setCategoryId("all");
  }

  function openQuest(item: QuestListItem) {
    setLoadError(null);

    if (!authenticated) {
      setActiveQuest({
        ...item,
        proof_url: null,
        proof_image_url: null,
        review_note: null,
      });
      return;
    }

    startTransition(async () => {
      const result = await getMyQuestDetailAction(item.id);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setActiveQuest(result.quest);
    });
  }

  if (activeQuest) {
    return (
      <QuestDetailPanel
        quest={activeQuest}
        backLabel={backLabel}
        onBack={() => setActiveQuest(null)}
        authenticated={authenticated}
        authCallbackURL={authCallbackURL}
        onSubmitted={({ questId, proofImageUrl, proofUrls }) => {
          setActiveQuest((prev) =>
            prev && prev.id === questId
              ? {
                  ...prev,
                  submission_status: "pending",
                  review_note: null,
                  proof_image_url: proofImageUrl ?? prev.proof_image_url,
                  proof_urls: proofUrls.length ? proofUrls : prev.proof_urls,
                  proof_url: proofUrls[0] ?? prev.proof_url ?? null,
                }
              : prev,
          );
        }}
      />
    );
  }

  if (variant === "board") {
    return (
      <div className="space-y-6 sm:space-y-8">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#070b14]/80 px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-8 sm:py-8">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(26,109,255,0.28),transparent_55%)]"
            aria-hidden
          />
          <div className="relative grid gap-6 lg:grid-cols-[1fr_auto_auto] lg:items-center">
            <div className="min-w-0">
              {eyebrow ? (
                <p className="text-xs font-medium tracking-wide text-[#8eb6ff]">
                  {eyebrow}
                </p>
              ) : null}
              <h1 className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                {title}
              </h1>
              <p className="mt-2 max-w-md text-sm text-muted sm:text-base">
                {subtitle}
              </p>
              <p className="mt-4 inline-flex items-center gap-2 text-sm text-[#8eb6ff]">
                <LuBolt className="h-4 w-4" aria-hidden />
                {filtered.length} quests available
              </p>
            </div>

            <div className="hidden justify-center md:flex">
              <Image
                src="/pokt-xp.png"
                alt=""
                width={144}
                height={144}
                className="h-28 w-28 object-contain drop-shadow-[0_0_24px_rgba(26,109,255,0.45)] sm:h-36 sm:w-36"
                priority
              />
            </div>

            <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl sm:p-5">
              {authenticated ? (
                <>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-[#8eb6ff]">
                    <LuBolt className="h-3.5 w-3.5" aria-hidden />
                    Your XP
                  </p>
                  <p className="mt-2 font-display text-4xl font-semibold tabular-nums text-white">
                    {level.totalXp.toLocaleString()}
                  </p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-[#5b8cff]"
                      style={{
                        width: `${Math.min(100, (level.intoLevel / level.perLevel) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Level {level.level} · {level.intoLevel.toLocaleString()} /{" "}
                    {level.perLevel.toLocaleString()} XP
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium text-[#8eb6ff]">Join the hub</p>
                  <p className="mt-2 text-sm text-muted">
                    Connect Discord to track XP and submit quests.
                  </p>
                  <DiscordLoginButton
                    callbackURL={authCallbackURL}
                    label="Connect Discord"
                    className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover"
                  />
                </>
              )}
            </div>
          </div>
        </section>

        {/* Filters */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categoryPills.map((pill) => {
              const active = categoryId === pill.value;
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => {
                    setCategoryId(pill.value);
                    setStatus("all");
                  }}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition sm:px-4 sm:py-2 sm:text-sm",
                    active
                      ? "bg-primary text-white shadow-[0_0_20px_rgba(26,109,255,0.45)]"
                      : "border border-white/10 bg-white/[0.04] text-muted hover:border-white/20 hover:text-foreground",
                  )}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
              <LuSearch className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search quests…"
                className={cn(glassControl, "pl-9")}
                aria-label="Search quests"
              />
            </div>
            <DateRangePicker
              range={range}
              onRangeChange={setRange}
              triggerClassName={glassControl}
            />
            {hasFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 rounded-full"
                onClick={resetFilters}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        {loadError ? (
          <p className="text-sm text-danger" role="alert">
            {loadError}
          </p>
        ) : null}
        {pending ? (
          <p className="text-xs text-muted">Opening quest…</p>
        ) : null}

        {quests.length === 0 ? (
          <EmptyState title={emptyTitle} body={emptyBody} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No quests match"
            body="Try a different filter, search, or date range."
            action={
              hasFilters ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-4 rounded-full"
                  onClick={resetFilters}
                >
                  Clear filters
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((quest) => (
              <QuestBoardCard
                key={quest.id}
                quest={quest}
                pending={pending}
                onOpen={() => openQuest(quest)}
              />
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Compact layout for dashboard My Quests
  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-xs font-medium tracking-wide text-[#8eb6ff] uppercase">
                {eyebrow}
              </p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {title}
              </h1>
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-[#8eb6ff] tabular-nums">
                {filtered.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{subtitle}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:items-end lg:w-auto lg:max-w-xl xl:max-w-none">
            {headerAction}
            <QuestFilterBar
              query={query}
              onQueryChange={setQuery}
              status={status}
              onStatusChange={setStatus}
              range={range}
              onRangeChange={setRange}
              hasFilters={hasFilters}
              onReset={resetFilters}
              className="lg:min-w-[28rem]"
            />
          </div>
        </div>
      </header>

      {quests.length === 0 ? (
        <EmptyState title={emptyTitle} body={emptyBody} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No quests match"
          body="Try adjusting filters."
          action={
            hasFilters ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-4 rounded-full"
                onClick={resetFilters}
              >
                Clear filters
              </Button>
            ) : null
          }
        />
      ) : (
        <ul
          className={cn(
            variant === "grid" ? "grid gap-3 sm:grid-cols-2" : "space-y-3",
          )}
        >
          {filtered.map((quest) => {
            const { Icon: QuestIcon, containerClass: iconContainerClass } =
              questIconVisual(quest);
            return (
              <li key={quest.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => openQuest(quest)}
                  className="group flex w-full items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-primary/40 sm:p-5"
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-transform duration-200 group-hover:scale-105 sm:h-11 sm:w-11",
                      iconContainerClass,
                    )}
                  >
                    <QuestIcon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-semibold text-white">
                      {quest.title}
                    </h2>
                    <SubmissionStatusBadge status={quest.submission_status} />
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
                  <QuestDescription
                    text={quest.description}
                    compact
                    className="mt-1"
                  />
                  <p className="mt-2 text-sm font-bold tabular-nums text-[#8eb6ff]">
                    {quest.xp_reward.toLocaleString()} XP
                  </p>
                </div>
              </button>
            </li>
          );
        })}
        </ul>
      )}
    </div>
  );
}

function QuestBoardCard({
  quest,
  pending,
  onOpen,
}: {
  quest: QuestListItem;
  pending: boolean;
  onOpen: () => void;
}) {
  const tag = questCategoryLabel(quest);
  const progress = progressFor(quest.submission_status);
  const pct = (progress.done / progress.total) * 100;
  const startMs = toMs(quest.starts_at);
  const isUpcoming = startMs !== null && startMs > Date.now();
  const { Icon: QuestIcon, containerClass: iconContainerClass } =
    questIconVisual(quest);

  return (
    <li>
      <button
        type="button"
        disabled={pending}
        onClick={onOpen}
        className="scroll-list-item group flex h-full w-full flex-col rounded-xl border border-white/10 bg-[#0c121c] p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-primary/45 hover:bg-[#101828] disabled:opacity-60"
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-transform duration-200 group-hover:scale-105 sm:h-11 sm:w-11",
              iconContainerClass,
            )}
          >
            <QuestIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[10px] font-medium tracking-wide text-[#8eb6ff] uppercase">
                {tag}
              </p>
              {quest.starts_at || quest.ends_at ? (
                <QuestScheduleChip quest={quest} size="xs" />
              ) : null}
              {quest.reward_role_name ? (
                <ServerRoleBadge
                  role={{
                    name: quest.reward_role_name,
                    color: quest.reward_role_color || "#3b82f6",
                  }}
                  size="xs"
                />
              ) : null}
            </div>
            <h2 className="font-display mt-0.5 line-clamp-1 text-sm font-semibold text-white">
              {quest.title}
            </h2>
            <QuestDescription
              text={quest.description}
              compact
              className="mt-1 line-clamp-1 text-xs"
            />
          </div>
          <div className="shrink-0 self-center">
            <XpBadge amount={quest.xp_reward} size="sm" />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted tabular-nums">
            {quest.submission_status === "approved" ? (
              <LuCheck className="h-3 w-3 text-success" />
            ) : quest.submission_status === "pending" ? (
              <LuClock className="h-3 w-3 text-warning" />
            ) : null}
            {progress.done}/{progress.total}
          </span>
          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                quest.submission_status === "approved"
                  ? "bg-success"
                  : quest.submission_status === "pending"
                    ? "bg-warning"
                    : "bg-primary",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-white transition group-hover:bg-primary-hover">
            {ctaLabel(quest.submission_status, isUpcoming)}
            <LuArrowRight className="h-3 w-3" aria-hidden />
          </span>
        </div>
      </button>
    </li>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-5 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}
