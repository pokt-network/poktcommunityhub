"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  LuArrowUpDown,
  LuChevronLeft,
  LuChevronRight,
  LuSearch,
  LuX,
} from "react-icons/lu";
import { DateRangePicker } from "@/components/date-range-picker";
import { ReviewActions } from "@/components/review-actions";
import { UserAvatar } from "@/components/user-avatar";
import { ZoomableImage } from "@/components/zoomable-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ServerRoleBadge } from "@/components/server-role-badge";
import { cn } from "@/lib/utils";

export type ReviewQueueItem = {
  id: string;
  user_id?: string;
  user_name: string;
  user_image: string | null;
  quest_title: string;
  quest_xp: number;
  reward_role_name?: string | null;
  reward_role_color?: string | null;
  proof_url: string | null;
  proof_urls?: string[];
  proof_image_url: string | null;
  createdAt: string;
};

const PAGE_SIZE = 5;

const glassControl =
  "h-8.5 sm:h-9 rounded-full border border-white/15 bg-white/[0.06] text-xs text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl backdrop-saturate-150 placeholder:text-muted focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30 hover:border-white/25 hover:bg-white/[0.1]";

export function ReviewQueue({ items }: { items: ReviewQueueItem[] }) {
  const [query, setQuery] = useState("");
  const [questFilter, setQuestFilter] = useState<string>("all");
  const [range, setRange] = useState<DateRange | undefined>();
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "xp-desc" | "xp-asc">("newest");
  const [page, setPage] = useState(1);

  const questOptions = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.quest_title))).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((item) => {
      if (questFilter !== "all" && item.quest_title !== questFilter) return false;

      if (q) {
        const hay =
          `${item.user_name} ${item.quest_title} ${item.proof_url ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      const created = new Date(item.createdAt);
      if (range?.from && isBefore(created, startOfDay(range.from))) return false;
      if (range?.to && isAfter(created, endOfDay(range.to))) return false;

      return true;
    });

    list.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (sortBy === "oldest") return timeA - timeB;
      if (sortBy === "xp-desc") return (b.quest_xp ?? 0) - (a.quest_xp ?? 0);
      if (sortBy === "xp-asc") return (a.quest_xp ?? 0) - (b.quest_xp ?? 0);
      return timeB - timeA;
    });

    return list;
  }, [items, query, questFilter, range, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const hasFilters =
    query.trim().length > 0 ||
    questFilter !== "all" ||
    Boolean(range?.from) ||
    sortBy !== "newest";

  function resetFilters() {
    setQuery("");
    setQuestFilter("all");
    setRange(undefined);
    setSortBy("newest");
    setPage(1);
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium tracking-wide text-[#8eb6ff] uppercase sm:text-xs">
              Operations
            </p>
            <div className="mt-0.5 flex items-center gap-2.5 sm:mt-1">
              <h1 className="font-display text-2xl font-semibold tracking-tight whitespace-nowrap text-white sm:text-3xl">
                Review queue
              </h1>
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-[#8eb6ff] tabular-nums">
                {filtered.length}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted sm:mt-1 sm:text-sm">
              Search, filter, and review pending proofs.
            </p>
          </div>

          <div className="flex w-full max-w-full min-w-0 flex-col gap-1.5 rounded-3xl border border-white/10 bg-white/[0.04] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:flex-row sm:items-center sm:rounded-full sm:p-1 lg:w-auto lg:shrink-0">
            <div className="relative min-w-0 flex-1 sm:w-32 lg:w-36 xl:w-44 sm:flex-none">
              <LuSearch className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search…"
                className={cn(glassControl, "border-transparent bg-transparent pl-8 text-xs shadow-none hover:bg-white/[0.06]")}
                aria-label="Search submissions"
              />
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-1.5">
              <Select
                value={questFilter}
                onValueChange={(value) => {
                  setQuestFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className={cn(
                    glassControl,
                    "w-full min-w-0 px-2 sm:px-2.5 text-[11px] sm:text-xs font-medium sm:w-28 lg:w-32 sm:shrink-0 justify-between gap-1 sm:gap-1.5 [&>span]:truncate [&>svg]:shrink-0 [&>svg]:h-3 [&>svg]:w-3 sm:[&>svg]:h-3.5 sm:[&>svg]:w-3.5",
                  )}
                  aria-label="Filter by quest"
                >
                  <SelectValue placeholder="All quests" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-white/15 bg-[#0a0f1a]/95 backdrop-blur-xl">
                  <SelectItem value="all">All quests</SelectItem>
                  {questOptions.map((title) => (
                    <SelectItem key={title} value={title}>
                      {title}
                    </SelectItem>
                  ))}
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
                  "w-full min-w-0 px-2 sm:px-2.5 text-[11px] sm:text-xs font-medium sm:w-22 lg:w-24 sm:shrink-0 justify-start gap-1 sm:gap-1.5 [&>span]:truncate [&>svg]:shrink-0 [&>svg]:h-3 [&>svg]:w-3 sm:[&>svg]:h-3.5 sm:[&>svg]:w-3.5",
                )}
              />

              <Select
                value={sortBy}
                onValueChange={(value: "newest" | "oldest" | "xp-desc" | "xp-asc") => {
                  setSortBy(value);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className={cn(
                    glassControl,
                    "w-full min-w-0 px-2 sm:px-2.5 text-[11px] sm:text-xs font-medium sm:w-20 lg:w-22 sm:shrink-0 justify-between gap-1 sm:gap-1.5 [&>svg]:shrink-0 [&>svg]:h-3 [&>svg]:w-3 sm:[&>svg]:h-3.5 sm:[&>svg]:w-3.5",
                  )}
                  title="Sort review queue"
                  aria-label="Sort review queue"
                >
                  <div className="flex min-w-0 items-center gap-1 sm:gap-1.5 truncate">
                    <LuArrowUpDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 text-[#8eb6ff]" />
                    <span className="truncate">
                      <SelectValue />
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-white/15 bg-[#0a0f1a]/95 backdrop-blur-xl">
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="xp-desc">Highest XP</SelectItem>
                  <SelectItem value="xp-asc">Lowest XP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasFilters ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex h-8.5 w-8.5 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] p-0 backdrop-blur-xl hover:bg-white/10"
                  onClick={resetFilters}
                  aria-label="Clear filters"
                  title="Clear filters"
                >
                  <LuX className="h-3.5 w-3.5" />
                </Button>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex sm:hidden h-7 w-full items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-medium text-muted hover:text-white"
                >
                  <LuX className="h-3 w-3" />
                  <span>Clear filters</span>
                </button>
              </>
            ) : null}
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
          pending
          {filtered.length !== items.length ? (
            <>
              {" "}
              <span className="text-muted/80">
                (from {items.length})
              </span>
            </>
          ) : null}
        </p>
      </header>

      {pageItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1e3a5f] bg-[#0a0f1a]/50 px-5 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            No submissions match
          </p>
          <p className="mt-1 text-sm text-muted">
            Try a different search, quest, or date range.
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
          {pageItems.map((item) => (
            <li
              key={item.id}
              className="scroll-list-item rounded-2xl border border-white/10 bg-[#0c121c] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  {item.user_id ? (
                    <Link
                      href={`/admin/users/${item.user_id}`}
                      className="shrink-0 transition-transform hover:scale-105"
                      title={`Open ${item.user_name}’s quest history page`}
                    >
                      <UserAvatar name={item.user_name} src={item.user_image} />
                    </Link>
                  ) : (
                    <UserAvatar name={item.user_name} src={item.user_image} />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      {item.user_id ? (
                        <Link
                          href={`/admin/users/${item.user_id}`}
                          className="font-semibold text-white hover:text-primary transition-colors"
                          title={`Open ${item.user_name}’s quest history page`}
                        >
                          {item.user_name}
                        </Link>
                      ) : (
                        <p className="font-semibold text-white">
                          {item.user_name}
                        </p>
                      )}
                      <time
                        dateTime={item.createdAt}
                        className="text-xs text-muted"
                      >
                        {format(new Date(item.createdAt), "MMM d, yyyy")}
                      </time>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-sm text-muted">
                        {item.quest_title}
                        <span className="mx-1.5 text-[#1e3a5f]">·</span>
                        <span className="tabular-nums text-[#8eb6ff]">
                          {item.quest_xp} XP
                        </span>
                      </p>
                      {item.reward_role_name ? (
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-[#8eb6ff]">
                          <span className="text-[10px] text-muted">Awards role:</span>
                          <ServerRoleBadge
                            role={{
                              name: item.reward_role_name,
                              color: item.reward_role_color || "#3b82f6",
                            }}
                            size="xs"
                          />
                        </div>
                      ) : null}
                    </div>
                    {(item.proof_urls?.length
                      ? item.proof_urls
                      : item.proof_url
                        ? [item.proof_url]
                        : []
                    ).map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block truncate text-sm text-[#8eb6ff] hover:underline"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                </div>

                {item.proof_image_url ? (
                  <ZoomableImage
                    src={item.proof_image_url}
                    alt="Proof screenshot"
                  />
                ) : null}

                <div className="w-full border-t border-[#1e3a5f]/80 pt-3">
                  <ReviewActions submissionId={item.id} />
                </div>
              </div>
            </li>
          ))}
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
