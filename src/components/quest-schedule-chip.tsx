"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LuCalendarClock, LuHourglass } from "react-icons/lu";
import {
  formatCountdown,
  formatScheduleDate,
  questScheduleState,
  toMs,
  type QuestScheduleFields,
} from "@/lib/quest-schedule";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/**
 * Current time that ticks on the client. Returns null during SSR / first
 * render so server and client markup match (no hydration mismatch).
 * Ticks every second when the next boundary is under an hour away.
 */
export function useNow(
  startMs: number | null = null,
  endMs: number | null = null,
): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      const next = nextBoundary(startMs, endMs, current);
      const remaining = next === null ? Infinity : next - current;
      const delay = remaining < HOUR_MS ? 1000 : 30_000;
      timer = window.setTimeout(tick, delay);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [startMs, endMs]);

  return now;
}

function nextBoundary(
  startMs: number | null,
  endMs: number | null,
  now: number,
): number | null {
  if (startMs !== null && startMs > now) return startMs;
  if (endMs !== null && endMs > now) return endMs;
  return null;
}

/** Refresh server data once when a schedule boundary is crossed. */
function useRefreshOnBoundary(
  startMs: number | null,
  endMs: number | null,
  now: number | null,
  enabled: boolean,
) {
  const router = useRouter();
  const target = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled || now === null) return;
    if (target.current === null) {
      target.current = nextBoundary(startMs, endMs, now);
      return;
    }
    if (now >= target.current) {
      target.current = nextBoundary(startMs, endMs, now);
      router.refresh();
    }
  }, [startMs, endMs, now, enabled, router]);
}

type ChipSize = "xs" | "sm";

const sizeClass: Record<ChipSize, string> = {
  xs: "gap-1 px-2 py-0.5 text-[10px]",
  sm: "gap-1.5 px-2.5 py-1 text-xs",
};

/**
 * Schedule pill for quest cards / headers:
 * - upcoming → "Starts in 2d 4h" (blue)
 * - live w/ end → "Ends in 3h 12m" (amber when < 24h)
 * - ended → "Ended Oct 20, 2:00 PM"
 * Renders nothing for live quests without an end date.
 */
export function QuestScheduleChip({
  quest,
  size = "xs",
  className,
  refreshOnBoundary = true,
}: {
  quest: QuestScheduleFields;
  size?: ChipSize;
  className?: string;
  refreshOnBoundary?: boolean;
}) {
  const start = toMs(quest.starts_at);
  const end = toMs(quest.ends_at);
  const now = useNow(start, end);
  useRefreshOnBoundary(start, end, now, refreshOnBoundary);

  if (now === null) return null;

  const state = questScheduleState(quest, now);

  let label: string;
  let tone: string;
  let Icon = LuHourglass;

  if (state === "upcoming" && start !== null) {
    label = `Starts in ${formatCountdown(start - now)}`;
    tone = "border-primary/30 bg-primary/12 text-[#8eb6ff]";
    Icon = LuCalendarClock;
  } else if (state === "live" && end !== null) {
    const remaining = end - now;
    label = `Ends in ${formatCountdown(remaining)}`;
    tone =
      remaining < DAY_MS
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-white/10 bg-white/[0.04] text-muted";
  } else if (state === "ended" && end !== null) {
    label = `Ended ${formatScheduleDate(end)}`;
    tone = "border-white/10 bg-white/[0.04] text-muted";
  } else {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border font-semibold tabular-nums whitespace-nowrap",
        sizeClass[size],
        tone,
        className,
      )}
      title={
        start !== null || end !== null
          ? [
              start !== null ? `Starts ${formatScheduleDate(start)}` : null,
              end !== null ? `Ends ${formatScheduleDate(end)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
    >
      <Icon className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      {label}
    </span>
  );
}
