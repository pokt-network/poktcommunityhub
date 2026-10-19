"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  LuChevronLeft,
  LuChevronRight,
  LuHistory,
  LuSearch,
  LuX,
} from "react-icons/lu";
import Link from "next/link";
import { DateRangePicker } from "@/components/date-range-picker";
import { UserActions } from "@/components/user-actions";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isSuperAdminEmail } from "@/lib/admin";
import { cn } from "@/lib/utils";

export type ManagedUserItem = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  totalXp: number;
  discordId: string | null;
  createdAt: string;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
};

const PAGE_SIZE = 8;

const glassControl =
  "h-8.5 sm:h-9 rounded-full border border-white/15 bg-[#121826] text-xs sm:text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] placeholder:text-muted focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30 hover:border-white/25 hover:bg-[#182033] md:bg-white/[0.06] md:backdrop-blur-xl md:backdrop-saturate-150";

type SortKey = "name" | "xp" | "joined";

export function UserManagement({
  users,
  currentUserId,
  currentUserEmail,
}: {
  users: ManagedUserItem[];
  currentUserId: string;
  currentUserEmail: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [range, setRange] = useState<DateRange | undefined>();
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);
  const isCurrentUserSuperAdmin = isSuperAdminEmail(currentUserEmail);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const list = users.filter((user) => {
      if (q) {
        const hay =
          `${user.name} ${user.email} ${user.discordId ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      const joined = new Date(user.createdAt);
      if (range?.from && isBefore(joined, startOfDay(range.from))) return false;
      if (range?.to && isAfter(joined, endOfDay(range.to))) return false;

      return true;
    });

    list.sort((a, b) => {
      if (sort === "xp") return b.totalXp - a.totalXp;
      if (sort === "joined") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [users, deferredQuery, range, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const hasFilters =
    query.trim().length > 0 || sort !== "name" || Boolean(range?.from);

  function resetFilters() {
    setQuery("");
    setSort("name");
    setRange(undefined);
    setPage(1);
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-[#8eb6ff] uppercase">
              Operations
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="font-display text-2xl font-semibold tracking-tight whitespace-nowrap text-white sm:text-3xl">
                Users
              </h1>
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-[#8eb6ff] tabular-nums">
                {filtered.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">
              Search, assign roles, and remove hub users.
            </p>
          </div>

          <div className="flex w-full max-w-full min-w-0 flex-col gap-2 rounded-3xl border border-white/10 bg-white/[0.04] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:rounded-full sm:p-1 lg:w-auto lg:shrink-0">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 min-w-0">
              <div className="relative min-w-0 flex-1 sm:w-36 lg:w-44 sm:flex-none">
                <LuSearch className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search…"
                  className={cn(
                    glassControl,
                    "border-transparent bg-transparent pl-8.5 text-xs shadow-none hover:bg-white/[0.06] sm:text-sm",
                  )}
                  aria-label="Search users"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:gap-2">
                <Select
                  value={sort}
                  onValueChange={(value) => {
                    setSort(value as SortKey);
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      glassControl,
                      "w-full min-w-0 px-3 text-xs sm:text-sm sm:w-[8rem] sm:shrink-0 justify-between [&>span]:truncate [&>svg]:shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5",
                    )}
                    aria-label="Sort users"
                  >
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-white/15 bg-[#0a0f1a]/90 backdrop-blur-xl">
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="xp">XP</SelectItem>
                    <SelectItem value="joined">Joined</SelectItem>
                  </SelectContent>
                </Select>

                <DateRangePicker
                  range={range}
                  onRangeChange={(next) => {
                    setRange(next);
                    setPage(1);
                  }}
                  triggerClassName={cn(
                    glassControl,
                    "w-full min-w-0 px-3 text-xs sm:text-sm sm:w-[8rem] sm:shrink-0 justify-start [&>span]:truncate [&>svg]:shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5",
                  )}
                />
              </div>

              {hasFilters ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] p-0 backdrop-blur-xl hover:bg-white/10"
                    onClick={resetFilters}
                    aria-label="Clear filters"
                    title="Clear filters"
                  >
                    <LuX className="h-4 w-4" />
                  </Button>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="flex sm:hidden h-7 w-full items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-medium text-muted hover:text-white"
                  >
                    <LuX className="h-3.5 w-3.5" />
                    <span>Clear filters</span>
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted">
          Showing{" "}
          <span className="tabular-nums text-foreground/80">
            {pageItems.length}
          </span>{" "}
          of{" "}
          <span className="tabular-nums text-foreground/80">
            {filtered.length}
          </span>{" "}
          users
          {filtered.length !== users.length ? (
            <>
              {" "}
              <span className="text-muted/80">(from {users.length})</span>
            </>
          ) : null}
        </p>
      </header>

      {pageItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1e3a5f] bg-[#0a0f1a]/50 px-5 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No users match</p>
          <p className="mt-1 text-sm text-muted">
            Try a different search, sort, or date range.
          </p>
          {hasFilters ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={cn("mt-4", glassControl, "px-5")}
              onClick={resetFilters}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3 sm:space-y-4">
          {pageItems.map((user) => {
            const isSelf = user.id === currentUserId;
            const isAdmin = user.role === "admin";
            const isTargetSuperAdmin = isSuperAdminEmail(user.email);

            return (
              <li
                key={user.id}
                className="scroll-list-item rounded-2xl border border-white/10 bg-[#0c121c] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="group flex min-w-0 flex-1 items-start gap-3.5 rounded-xl p-1.5 -m-1.5 transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    title={`Open ${user.name}’s quest history page`}
                  >
                    <div className="relative shrink-0 transition-transform group-hover:scale-105">
                      <UserAvatar name={user.name} src={user.image} size={44} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p className="font-semibold text-white group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <span>{user.name}</span>
                          {isSelf ? (
                            <span className="ml-1 text-xs font-medium text-muted">
                              (you)
                            </span>
                          ) : null}
                        </p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
                            isTargetSuperAdmin
                              ? "border border-[#2f6bff]/50 bg-[#2f6bff]/20 text-[#8eb6ff] shadow-[0_0_12px_rgba(47,107,255,0.25)]"
                              : isAdmin
                                ? "bg-accent/15 text-accent"
                                : "bg-white/8 text-muted",
                          )}
                        >
                          {isTargetSuperAdmin
                            ? "Super Admin"
                            : isAdmin
                              ? "Admin"
                              : "Ambassador"}
                        </span>
                        <time
                          dateTime={user.createdAt}
                          className="text-xs text-muted"
                        >
                          Joined{" "}
                          {format(new Date(user.createdAt), "MMM d, yyyy")}
                        </time>
                      </div>

                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="truncate text-sm text-muted">
                          {user.email}
                        </p>
                        <span
                          className="inline-flex items-center gap-1 text-xs text-[#8eb6ff]/75 group-hover:text-primary transition-colors shrink-0"
                          title="View quest history"
                        >
                          <LuHistory className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      </div>

                      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="tabular-nums text-[#8eb6ff] font-medium">
                          {user.totalXp.toLocaleString()} XP
                        </span>
                        <span className="tabular-nums group-hover:text-emerald-300/90 transition-colors">
                          {user.approvedCount} approved
                        </span>
                        <span className="tabular-nums group-hover:text-amber-300/90 transition-colors">
                          {user.pendingCount} pending
                        </span>
                        <span className="tabular-nums group-hover:text-rose-300/90 transition-colors">
                          {user.rejectedCount} rejected
                        </span>
                      </p>
                    </div>
                  </Link>

                  <div className="w-full border-t border-[#1e3a5f]/80 pt-3.5 lg:w-52 lg:shrink-0 lg:border-t-0 lg:pt-0">
                    <UserActions
                      userId={user.id}
                      userName={user.name}
                      role={user.role}
                      discordId={user.discordId}
                      email={user.email}
                      isSelf={isSelf}
                      isCurrentUserSuperAdmin={isCurrentUserSuperAdmin}
                      isTargetSuperAdmin={isTargetSuperAdmin}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-[#1e3a5f]/60 pt-4">
        <p className="text-xs text-muted tabular-nums">
          Page {safePage} of {pageCount}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(glassControl, "px-3.5")}
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <LuChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Prev</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(glassControl, "px-3.5")}
            disabled={safePage >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            <span className="hidden sm:inline">Next</span>
            <LuChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
