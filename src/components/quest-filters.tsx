"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { endOfDay, isAfter, isBefore, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { LuSearch, LuX } from "react-icons/lu";
import { DateRangePicker } from "@/components/date-range-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SubmissionStatus } from "@/lib/db";
import type { QuestListItem } from "@/lib/quest-filters";
import { cn } from "@/lib/utils";

export type { FilterableQuest, QuestListItem } from "@/lib/quest-filters";

export const glassControl =
  "h-10 rounded-full border border-white/15 bg-white/[0.06] text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl backdrop-saturate-150 placeholder:text-muted focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30 hover:border-white/25 hover:bg-white/[0.1]";

export type StatusFilter = "all" | "none" | SubmissionStatus;

export function useQuestFilters<T extends QuestListItem>(items: T[]) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [range, setRange] = useState<DateRange | undefined>();
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (status === "none") {
        if (item.submission_status) return false;
      } else if (status !== "all" && item.submission_status !== status) {
        return false;
      }

      if (q) {
        const hay = `${item.title} ${item.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (range?.from || range?.to) {
        const dateValue = item.submittedAt ?? item.questCreatedAt;
        const created = new Date(dateValue);
        if (range.from && isBefore(created, startOfDay(range.from))) return false;
        if (range.to && isAfter(created, endOfDay(range.to))) return false;
      }

      return true;
    });
  }, [items, deferredQuery, status, range]);

  const hasFilters =
    query.trim().length > 0 || status !== "all" || Boolean(range?.from);

  function resetFilters() {
    setQuery("");
    setStatus("all");
    setRange(undefined);
  }

  return {
    query,
    setQuery,
    status,
    setStatus,
    range,
    setRange,
    filtered,
    hasFilters,
    resetFilters,
  };
}

type QuestFilterBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  range: DateRange | undefined;
  onRangeChange: (value: DateRange | undefined) => void;
  hasFilters: boolean;
  onReset: () => void;
  className?: string;
};

export function QuestFilterBar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  range,
  onRangeChange,
  hasFilters,
  onReset,
  className,
}: QuestFilterBarProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 rounded-3xl border border-white/10 bg-white/[0.04] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:flex-row sm:items-center sm:rounded-full sm:p-1.5",
        className,
      )}
    >
      <div className="relative min-w-0 flex-1 sm:max-w-xs lg:w-48 lg:flex-none xl:w-56">
        <LuSearch className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search quests…"
          className={cn(
            glassControl,
            "border-transparent bg-transparent pl-9 shadow-none hover:bg-white/[0.06]",
          )}
          aria-label="Search quests"
        />
      </div>

      <Select
        value={status}
        onValueChange={(value) => onStatusChange(value as StatusFilter)}
      >
        <SelectTrigger
          className={cn(glassControl, "w-full min-w-0 px-4 sm:w-[10.5rem] sm:shrink-0")}
          aria-label="Filter by status"
        >
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent className="rounded-2xl border-white/15 bg-[#0a0f1a]/90 backdrop-blur-xl">
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="none">Not started</SelectItem>
          <SelectItem value="pending">Submitted</SelectItem>
          <SelectItem value="approved">Completed</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>

      <DateRangePicker
        range={range}
        onRangeChange={onRangeChange}
        triggerClassName={glassControl}
      />

      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 w-full shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 backdrop-blur-xl sm:w-10 sm:px-0"
          onClick={onReset}
          aria-label="Clear filters"
        >
          <LuX className="h-4 w-4" />
          <span className="sm:hidden">Clear</span>
        </Button>
      ) : null}
    </div>
  );
}
