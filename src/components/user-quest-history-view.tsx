"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { FaTrophy } from "react-icons/fa";
import {

  LuCalendar,
  LuCircleCheck,
  LuCircleX,
  LuClock,
  LuCopy,
  LuExternalLink,
  LuRotateCcw,
  LuSearch,
  LuShieldCheck,
  LuSwords,
  LuX,
} from "react-icons/lu";
import { undoSubmissionReviewAction } from "@/app/actions/reviews";
import type { UserHistoryProfile } from "@/app/actions/user-history";
import { ServerRoleBadge } from "@/components/server-role-badge";
import { UserAvatar } from "@/components/user-avatar";
import { ZoomableImage } from "@/components/zoomable-image";
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
import { isSuperAdminEmail } from "@/lib/admin";
import type { UserQuestHistoryItem } from "@/lib/db";
import { questIconFor } from "@/lib/quest-icons";
import { cn } from "@/lib/utils";

const glassControl =
  "h-8.5 sm:h-9 rounded-full border border-white/15 bg-[#121826] text-xs sm:text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] placeholder:text-muted focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30 hover:border-white/25 hover:bg-[#182033] md:bg-white/[0.06] md:backdrop-blur-xl md:backdrop-saturate-150";

type StatusTab = "all" | "approved" | "rejected" | "pending";
type SortOption = "newest" | "oldest" | "xp-desc" | "xp-asc";

type UserQuestHistoryViewProps = {
  user: UserHistoryProfile;
  history: UserQuestHistoryItem[];
  currentUserId?: string | null;
  className?: string;
  canManage?: boolean;
};

export function UserQuestHistoryView({
  user,
  history,
  currentUserId,
  className,
  canManage = false,
}: UserQuestHistoryViewProps) {
  const router = useRouter();
  const [tab, setTab] = useState<StatusTab>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [copied, setCopied] = useState<string | null>(null);

  const [items, setItems] = useState<UserQuestHistoryItem[]>(history);
  const [userXp, setUserXp] = useState<number>(user.totalXp);
  const [undoTarget, setUndoTarget] = useState<UserQuestHistoryItem | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [isPendingUndo, startTransition] = useTransition();

  const [prevHistory, setPrevHistory] = useState(history);
  if (prevHistory !== history) {
    setPrevHistory(history);
    setItems(history);
  }

  const [prevTotalXp, setPrevTotalXp] = useState(user.totalXp);
  if (prevTotalXp !== user.totalXp) {
    setPrevTotalXp(user.totalXp);
    setUserXp(user.totalXp);
  }

  const isSelf = Boolean(currentUserId && currentUserId === user.id);
  const isAdmin = user.role === "admin";

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const counts = useMemo(() => {
    let approved = 0;
    let rejected = 0;
    let pending = 0;

    for (const item of items) {
      if (item.status === "approved") {
        approved++;
      } else if (item.status === "rejected") {
        rejected++;
      } else if (item.status === "pending") {
        pending++;
      }
    }

    return {
      all: items.length,
      approved,
      rejected,
      pending,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter((item) => {
      if (tab !== "all" && item.status !== tab) return false;

      if (q) {
        const hay = [
          item.questTitle,
          item.questDescription,
          item.categoryName ?? "",
          item.reviewerName ?? "",
          item.reviewNote ?? "",
          item.proofUrl ?? "",
          ...(item.proofUrls ?? []),
        ]
          .join(" ")
          .toLowerCase();

        if (!hay.includes(q)) return false;
      }

      return true;
    });

    list.sort((a, b) => {
      const timeA = new Date(a.reviewedAt || a.submittedAt).getTime();
      const timeB = new Date(b.reviewedAt || b.submittedAt).getTime();

      if (sort === "oldest") return timeA - timeB;
      if (sort === "xp-desc") return b.questXp - a.questXp;
      if (sort === "xp-asc") return a.questXp - b.questXp;
      return timeB - timeA;
    });

    return list;
  }, [items, tab, search, sort]);

  function handleConfirmUndo() {
    if (!undoTarget) return;
    setUndoError(null);
    startTransition(async () => {
      const res = await undoSubmissionReviewAction(undoTarget.id);
      if (!res.ok) {
        setUndoError(res.error ?? "Failed to undo review.");
        return;
      }
      if (undoTarget.status === "approved") {
        setUserXp((prev) => Math.max(0, prev - undoTarget.questXp));
      }
      setItems((prev) =>
        prev.map((it) =>
          it.id === undoTarget.id
            ? {
              ...it,
              status: "pending",
              reviewedAt: null,
              reviewedBy: null,
              reviewerName: null,
              reviewerRole: null,
              reviewNote: null,
            }
            : it,
        ),
      );
      setUndoTarget(null);
      router.refresh();
    });
  }

  return (
    <div className={cn("space-y-6 w-full max-w-full min-w-0 overflow-x-clip", className)}>
      {/* Profile Header */}
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,38,0.95)_0%,rgba(10,15,26,0.98)_100%)] p-4 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl max-w-full min-w-0">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between min-w-0">
          <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center min-w-0 flex-1">
            <div className="relative shrink-0">
              <UserAvatar name={user.name} src={user.image} size={64} />
              {isAdmin ? (
                <span
                  title="Admin"
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-[#2a4a7a] bg-[#1a6dff] text-white shadow-md"
                >
                  <LuShieldCheck className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl break-words min-w-0">
                  {user.name}
                </h2>
                {isSelf ? (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-muted shrink-0">
                    you
                  </span>
                ) : null}
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase shrink-0",
                    isSuperAdminEmail(user.email)
                      ? "border border-[#2f6bff]/50 bg-[#2f6bff]/20 text-[#8eb6ff] shadow-[0_0_12px_rgba(47,107,255,0.25)]"
                      : isAdmin
                        ? "bg-accent/15 text-accent border border-accent/20"
                        : "bg-white/8 text-muted border border-white/10",
                  )}
                >
                  {isSuperAdminEmail(user.email)
                    ? "Super Admin"
                    : isAdmin
                      ? "Admin"
                      : "Ambassador"}
                </span>

                <span className="rounded-full bg-[#1a6dff]/15 border border-[#2a4a7a] px-2.5 py-0.5 text-xs font-semibold text-[#8eb6ff] tabular-nums shrink-0">
                  {userXp.toLocaleString()} XP
                </span>

                {user.leaderboardRank ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-300 shrink-0">
                    <FaTrophy className="h-3 w-3 text-amber-400" />
                    <span>Rank #{user.leaderboardRank}</span>
                  </span>
                ) : null}
              </div>

              {user.email ? (
                <p className="text-xs text-muted truncate max-w-full sm:text-sm">
                  {user.email}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted pt-0.5 min-w-0">
                {user.createdAt ? (
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <LuCalendar className="h-3.5 w-3.5" />
                    Joined {format(new Date(user.createdAt), "MMM d, yyyy")}
                  </span>
                ) : null}

                {user.discordId ? (
                  <button
                    type="button"
                    onClick={() => copyText("Discord", user.discordId!)}
                    className="inline-flex items-center gap-1 hover:text-white transition cursor-pointer max-w-full truncate"
                    title="Copy Discord ID"
                  >
                    <LuCopy className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {copied === "Discord" ? "Copied!" : `Discord: ${user.discordId}`}
                    </span>
                  </button>
                ) : null}
              </div>

              {user.roles && user.roles.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-1">
                  {user.roles.map((role) => (
                    <ServerRoleBadge key={role.id} role={role} size="xs" />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="space-y-3 min-w-0 max-w-full">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between min-w-0">
          {/* Status Tabs */}
          <div
            role="tablist"
            aria-label="Quest status filter"
            className="flex w-full max-w-full items-center justify-between overflow-x-auto rounded-full border border-white/10 bg-[#0a0f1a] p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto sm:justify-start gap-1"
          >
            {(
              [
                { key: "all", label: "All", count: counts.all },
                { key: "approved", label: "Approved", count: counts.approved },
                { key: "rejected", label: "Rejected", count: counts.rejected },
                { key: "pending", label: "Pending", count: counts.pending },
              ] as const
            ).map((item) => {
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.key)}
                  className={cn(
                    "inline-flex flex-1 sm:flex-initial shrink-0 justify-center items-center gap-1 sm:gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition sm:px-3.5",
                    active
                      ? "bg-primary text-white shadow-[0_0_12px_rgba(26,109,255,0.4)]"
                      : "text-muted hover:text-white",
                  )}
                >
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] tabular-nums",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-white/5 text-muted",
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Sort Controls */}
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto min-w-0">
            <div className="relative min-w-0 flex-1 sm:w-56 lg:w-60">
              <LuSearch className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search quests, admin, notes…"
                className={cn(
                  glassControl,
                  "pl-8.5 pr-8 text-xs sm:text-sm",
                )}
                aria-label="Search quest history"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted hover:text-white p-0.5"
                >
                  <LuX className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <Select
              value={sort}
              onValueChange={(val) => setSort(val as SortOption)}
            >
              <SelectTrigger
                className={cn(
                  glassControl,
                  "w-full sm:w-[8.5rem] px-3 text-xs sm:text-sm justify-between [&>span]:truncate shrink-0",
                )}
                aria-label="Sort quests"
              >
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-white/15 bg-[#0a0f1a]/95 backdrop-blur-xl">
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="xp-desc">Highest XP</SelectItem>
                <SelectItem value="xp-asc">Lowest XP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-xs text-muted">
          Showing <span className="tabular-nums text-foreground/80 font-medium">{filtered.length}</span>{" "}
          of <span className="tabular-nums text-foreground/80 font-medium">{items.length}</span> quest submissions
          {tab !== "all" ? ` (${tab})` : ""}
        </p>
      </div>

      {/* Quest History List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1e3a5f] bg-[#0a0f1a]/50 px-5 py-14 text-center">
          <LuSwords className="mx-auto h-8 w-8 text-muted/60" />
          <p className="mt-3 text-base font-semibold text-foreground">
            No quest history found
          </p>
          <p className="mt-1 text-sm text-muted">
            {search || tab !== "all"
              ? "Try adjusting your search query or status filter."
              : "This user has not submitted any quests yet."}
          </p>
          {search || tab !== "all" ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearch("");
                setTab("all");
              }}
              className={cn("mt-4", glassControl, "px-4")}
            >
              Reset filters
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3 sm:space-y-4">
          {filtered.map((item) => {
            const Icon = questIconFor({
              title: item.questTitle,
              description: item.questDescription,
              icon: item.questIcon,
            });

            const isApproved = item.status === "approved";
            const isRejected = item.status === "rejected";
            const isPending = item.status === "pending";

            return (
              <li
                key={item.id}
                className={cn(
                  "relative rounded-2xl border bg-[#0c121c] p-4 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all",
                  isApproved && "border-emerald-500/20 hover:border-emerald-500/35",
                  isRejected && "border-rose-500/25 hover:border-rose-500/40",
                  isPending && "border-amber-500/20 hover:border-amber-500/35",
                )}
              >
                <div className="flex flex-col gap-4">
                  {/* Top Header: Status + Quest Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-white/6 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {isApproved && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                          <LuCircleCheck className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Approved</span>
                        </span>
                      )}

                      {isRejected && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-300">
                          <LuCircleX className="h-3.5 w-3.5 text-rose-400" />
                          <span>Rejected</span>
                        </span>
                      )}

                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                          <LuClock className="h-3.5 w-3.5 text-amber-400" />
                          <span>Pending Review</span>
                        </span>
                      )}

                      {item.categoryName ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-muted">
                          {item.categoryName}
                        </span>
                      ) : null}

                      {item.rewardRoleName ? (
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-medium border"
                          style={{
                            borderColor: `${item.rewardRoleColor || "#3b82f6"}40`,
                            backgroundColor: `${item.rewardRoleColor || "#3b82f6"}15`,
                            color: item.rewardRoleColor || "#60a5fa",
                          }}
                        >
                          Role: {item.rewardRoleName}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#2a4a7a] bg-[#1a6dff]/15 px-3 py-0.5 text-xs font-bold text-[#8eb6ff] tabular-nums">
                        +{item.questXp.toLocaleString()} XP
                      </span>

                      {canManage && (isApproved || isRejected) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setUndoError(null);
                            setUndoTarget(item);
                          }}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition cursor-pointer shrink-0 border",
                            isApproved
                              ? "border-amber-500/35 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400"
                              : "border-white/15 bg-white/5 text-muted hover:text-white hover:bg-white/10",
                          )}
                          title={
                            isApproved
                              ? "Undo approval & revert quest back to pending review"
                              : "Undo rejection & revert quest back to pending review"
                          }
                        >
                          <LuRotateCcw className="h-3 w-3" />
                          <span>Undo {isApproved ? "approval" : "review"}</span>
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Quest Title & Description */}
                  <div className="flex items-start gap-3.5">
                    <div
                      className={cn(
                        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                        isApproved
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : isRejected
                            ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                            : "border-primary/30 bg-primary/10 text-[#8eb6ff]",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="font-display text-base font-semibold text-white sm:text-lg break-words">
                        {item.questTitle}
                      </h3>
                      {item.questDescription ? (
                        <p className="text-xs text-muted/90 sm:text-sm line-clamp-2 break-words">
                          {item.questDescription}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Reviewer / Admin Highlight Box (CRITICAL REQUIREMENT) */}
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 sm:p-3.5 min-w-0">
                    {isApproved && (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            name={item.reviewerName || "Admin"}
                            src={item.reviewerImage}
                            size={32}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs text-muted shrink-0">Approved by:</span>
                              <span className="font-semibold text-emerald-300 text-xs sm:text-sm truncate">
                                {item.reviewerName || "Admin"}
                              </span>
                              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-300 uppercase shrink-0">
                                {item.reviewerRole || "Admin"}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted truncate">
                              Quest verified and XP successfully credited
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 text-left sm:text-right text-[11px] text-muted sm:shrink-0">
                          {item.reviewedAt ? (
                            <span className="tabular-nums">
                              Approved {format(new Date(item.reviewedAt), "MMM d, yyyy 'at' h:mm a")}
                            </span>
                          ) : null}
                          {canManage ? (
                            <button
                              type="button"
                              onClick={() => {
                                setUndoError(null);
                                setUndoTarget(item);
                              }}
                              className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 hover:underline cursor-pointer font-medium transition ml-auto sm:ml-0"
                            >
                              <LuRotateCcw className="h-3 w-3" />
                              <span>Undo approval</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {isRejected && (
                      <div className="space-y-2.5 min-w-0">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar
                              name={item.reviewerName || "Admin"}
                              src={item.reviewerImage}
                              size={32}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs text-muted shrink-0">Rejected by:</span>
                                <span className="font-semibold text-rose-300 text-xs sm:text-sm truncate">
                                  {item.reviewerName || "Admin"}
                                </span>
                                <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.2 text-[10px] font-semibold text-rose-300 uppercase shrink-0">
                                  {item.reviewerRole || "Admin"}
                                </span>
                              </div>
                              <p className="text-[11px] text-rose-400/80 truncate">
                                Action required before XP can be awarded
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5 text-left sm:text-right text-[11px] text-muted sm:shrink-0">
                            {item.reviewedAt ? (
                              <span className="tabular-nums">
                                Rejected {format(new Date(item.reviewedAt), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            ) : null}
                            {canManage ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setUndoError(null);
                                  setUndoTarget(item);
                                }}
                                className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 hover:underline cursor-pointer font-medium transition ml-auto sm:ml-0"
                              >
                                <LuRotateCcw className="h-3 w-3" />
                                <span>Undo rejection</span>
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {/* Rejection Note from Admin */}
                        {item.reviewNote ? (
                          <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-xs min-w-0">
                            <p className="font-medium text-rose-300">
                              Feedback from {item.reviewerName || "Admin"}:
                            </p>
                            <p className="mt-1 text-rose-200/90 whitespace-pre-wrap break-words leading-relaxed">
                              &ldquo;{item.reviewNote}&rdquo;
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-rose-500/20 bg-rose-950/10 p-2 text-xs text-muted">
                            No additional feedback note provided by reviewer.
                          </div>
                        )}
                      </div>
                    )}

                    {isPending && (
                      <div className="flex items-center gap-2.5 text-xs text-amber-300 min-w-0">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-amber-200">
                            Awaiting Manager Review
                          </p>
                          <p className="text-[11px] text-amber-400/75 truncate">
                            This submission is queued in the admin review queue.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Proof Details Section */}
                  <div className="space-y-2 pt-1 border-t border-white/5 min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
                      Proof Submitted
                    </p>

                    {/* Proof Links */}
                    {item.proofUrls && item.proofUrls.length > 0 ? (
                      <div className="flex flex-wrap gap-2 min-w-0">
                        {item.proofUrls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#8eb6ff] hover:bg-white/10 hover:border-primary/40 hover:text-white transition min-w-0"
                          >
                            <LuExternalLink className="h-3 w-3 shrink-0" />
                            <span className="max-w-[200px] truncate sm:max-w-xs">{url}</span>
                          </a>
                        ))}
                      </div>
                    ) : item.proofUrl ? (
                      <div className="min-w-0">
                        <a
                          href={item.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#8eb6ff] hover:bg-white/10 hover:border-primary/40 hover:text-white transition min-w-0"
                        >
                          <LuExternalLink className="h-3 w-3 shrink-0" />
                          <span className="max-w-[200px] truncate sm:max-w-xs">{item.proofUrl}</span>
                        </a>
                      </div>
                    ) : null}

                    {/* Proof Screenshot Image (Zoomable) */}
                    {item.proofImageUrl ? (
                      <div className="pt-1.5 min-w-0">
                        <p className="text-[11px] text-muted mb-1">Attached screenshot:</p>
                        <div className="inline-block overflow-hidden rounded-xl border border-white/10 bg-black/40 max-w-full">
                          <ZoomableImage
                            src={item.proofImageUrl}
                            alt={`Proof for ${item.questTitle}`}
                            className="max-h-48 max-w-full rounded-xl object-contain"
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="flex items-center gap-2 pt-1 text-[11px] text-muted">
                      <LuClock className="h-3 w-3" />
                      <span>
                        Submitted on{" "}
                        {format(new Date(item.submittedAt), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Undo Review Confirmation Dialog */}
      <Dialog
        open={Boolean(undoTarget)}
        onOpenChange={(open) => {
          if (!open && !isPendingUndo) {
            setUndoTarget(null);
            setUndoError(null);
          }
        }}
      >
        <DialogContent className="border-white/15 bg-[#0a0f1a]/95 backdrop-blur-2xl text-foreground max-w-md sm:rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5 text-amber-400">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30">
                <LuRotateCcw className="h-4.5 w-4.5" />
              </div>
              <DialogTitle className="text-lg font-semibold text-white">
                Undo {undoTarget?.status === "approved" ? "Quest Approval" : "Quest Review"}?
              </DialogTitle>
            </div>
            <DialogDescription asChild>
              <div className="text-xs sm:text-sm text-muted pt-2 space-y-2">
                {undoTarget?.status === "approved" ? (
                  <>
                    <p>
                      Reverting <strong className="text-white">&ldquo;{undoTarget?.questTitle}&rdquo;</strong> will:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-muted/90 pt-1">
                      <li>
                        Deduct <strong className="text-amber-300">-{undoTarget?.questXp.toLocaleString()} XP</strong> from {user.name}&apos;s total balance.
                      </li>
                      <li>
                        Reset submission status back to <span className="text-amber-300 font-medium">Pending Review</span>.
                      </li>
                      <li>
                        Return it back to the Admin Review Queue.
                      </li>
                      {undoTarget?.rewardRoleName ? (
                        <li>
                          Revoke the role <span className="text-[#8eb6ff] font-medium">@{undoTarget.rewardRoleName}</span> if no other approved submission qualifies.
                        </li>
                      ) : null}
                    </ul>
                  </>
                ) : (
                  <p>
                    Reverting <strong className="text-white">&ldquo;{undoTarget?.questTitle}&rdquo;</strong> will reset its status back to <span className="text-amber-300 font-medium">Pending Review</span> and return it to the Admin Review Queue.
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          {undoError ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-950/30 p-2.5 text-xs text-rose-300">
              {undoError}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isPendingUndo}
              onClick={() => {
                setUndoTarget(null);
                setUndoError(null);
              }}
              className={cn(glassControl, "px-4")}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPendingUndo}
              onClick={handleConfirmUndo}
              className="bg-amber-500 text-black font-semibold hover:bg-amber-400 focus-visible:ring-amber-400 transition"
            >
              {isPendingUndo ? "Reverting…" : "Confirm & Revert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
