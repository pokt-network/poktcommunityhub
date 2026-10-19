"use client";

import { useState } from "react";
import Link from "next/link";
import { ServerRoleBadge } from "@/components/server-role-badge";
import { UserAvatar } from "@/components/user-avatar";
import type { LeaderboardRow } from "@/lib/db";
import { cn } from "@/lib/utils";

export type LeaderboardPeriod = "monthly" | "all";

type LeaderboardBoardProps = {
  monthly: LeaderboardRow[];
  allTime: LeaderboardRow[];
  currentUserId?: string | null;
  /** Admins can open any user's history; others only their own. */
  canViewOthersHistory?: boolean;
  currentUserRankAllTime?: number | null;
  currentUserRankMonthly?: number | null;
  avatarSize?: number;
  className?: string;
  emptyMonthly?: string;
  emptyAllTime?: string;
};

function formatRank(rank: number | null | undefined) {
  if (rank == null || !Number.isFinite(rank) || rank < 1) return null;
  return `#${rank}`;
}

export function LeaderboardBoard({
  monthly,
  allTime,
  currentUserId,
  canViewOthersHistory = false,
  currentUserRankAllTime = null,
  currentUserRankMonthly = null,
  avatarSize = 40,
  className,
  emptyMonthly = "No XP earned this month yet.",
  emptyAllTime = "No ambassadors yet.",
}: LeaderboardBoardProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");
  const rows = period === "monthly" ? monthly : allTime;
  const empty = period === "monthly" ? emptyMonthly : emptyAllTime;
  const yourRank =
    period === "monthly" ? currentUserRankMonthly : currentUserRankAllTime;
  const yourRankLabel = formatRank(yourRank);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Leaderboard period"
          className="inline-flex rounded-full border border-white/10 bg-[#0a0f1a] p-1"
        >
          {(
            [
              { value: "monthly", label: "Monthly" },
              { value: "all", label: "All time" },
            ] as const
          ).map((tab) => {
            const active = period === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(tab.value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition sm:px-3.5 sm:py-1.5 sm:text-sm",
                  active
                    ? "bg-primary text-white shadow-[0_0_12px_rgba(26,109,255,0.35)]"
                    : "text-muted hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {currentUserId ? (
          <div
            className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold sm:text-sm"
            title={
              yourRankLabel
                ? `Your ${period === "monthly" ? "monthly" : "all-time"} rank`
                : "Earn XP to appear on the leaderboard"
            }
          >
            <span className="text-muted">Your rank</span>
            <span className="tabular-nums text-[#8eb6ff]">
              {yourRankLabel ?? "—"}
            </span>
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-card/60 px-5 py-8 text-sm text-muted">
          {empty}
        </p>
      ) : (
        <ol className="overflow-hidden rounded-2xl border border-white/10 bg-card/80">
          {rows.map((row, index) => {
            const isYou = Boolean(currentUserId && row.id === currentUserId);
            const canOpenHistory = isYou || canViewOthersHistory;
            const identity = (
              <>
                <div
                  className={cn(
                    "shrink-0",
                    canOpenHistory && "transition-transform group-hover:scale-105",
                  )}
                >
                  <UserAvatar name={row.name} src={row.image} size={avatarSize} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1">
                    <p
                      className={cn(
                        "flex items-center gap-1.5 truncate text-sm font-medium text-foreground sm:text-base",
                        canOpenHistory &&
                          "transition-colors group-hover:text-primary",
                      )}
                    >
                      <span>{row.name}</span>
                      {isYou ? (
                        <span className="ml-1 text-xs font-normal text-primary">
                          you
                        </span>
                      ) : null}
                    </p>
                    {row.roles && row.roles.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                        {row.roles.slice(-3).map((role) => (
                          <ServerRoleBadge key={role.id} role={role} size="xs" />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            );

            return (
              <li
                key={row.id}
                className={cn(
                  "flex items-center gap-2.5 border-b border-white/10 px-3 py-2.5 last:border-b-0 sm:gap-4 sm:px-5 sm:py-3",
                  isYou && "bg-primary/10",
                )}
              >
                <span className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-muted sm:w-8 sm:text-sm">
                  {index + 1}
                </span>

                {canOpenHistory ? (
                  <Link
                    href={`/users/${row.id}`}
                    className="group -m-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:gap-4"
                    title={
                      isYou
                        ? "Open your quest history"
                        : `Open ${row.name}’s quest history`
                    }
                  >
                    {identity}
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-4">
                    {identity}
                  </div>
                )}

                <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground sm:text-sm">
                  {(row.totalXp ?? 0).toLocaleString()} XP
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
