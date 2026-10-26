/**
 * Quest scheduling helpers — safe for both server and client.
 *
 * A quest is:
 * - closed:   status = 'closed' (manually deactivated)
 * - upcoming: active, starts_at in the future
 * - ended:    active, ends_at in the past (auto-closed)
 * - live:     active and inside its window
 */

export type QuestScheduleState = "live" | "upcoming" | "ended" | "closed";

export type DateLike = Date | string | number | null | undefined;

export type QuestScheduleFields = {
  status?: "active" | "closed";
  starts_at?: DateLike;
  ends_at?: DateLike;
};

export function toMs(value: DateLike): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function toIsoOrNull(value: DateLike): string | null {
  const ms = toMs(value);
  return ms === null ? null : new Date(ms).toISOString();
}

export function isFutureSchedule(
  value: DateLike,
  now: number = Date.now(),
): boolean {
  const ms = toMs(value);
  return ms !== null && ms > now;
}

export function questScheduleState(
  quest: QuestScheduleFields,
  now: number = Date.now(),
): QuestScheduleState {
  if (quest.status === "closed") return "closed";
  const start = toMs(quest.starts_at);
  const end = toMs(quest.ends_at);
  if (end !== null && end <= now) return "ended";
  if (start !== null && start > now) return "upcoming";
  return "live";
}

/** Why a quest is not accepting submissions (server actions / errors). */
export function scheduleClosedMessage(
  quest: QuestScheduleFields | null | undefined,
  now: number = Date.now(),
): string {
  if (!quest) return "Quest not found or closed.";
  const state = questScheduleState(quest, now);
  if (state === "upcoming") return "This quest hasn't opened yet.";
  if (state === "ended") return "This quest has ended.";
  return "Quest not found or closed.";
}

/** Compact countdown: "2d 4h", "3h 12m", "12m 05s", "45s". */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/** "Oct 20" in the viewer's locale/timezone. */
export function formatScheduleDate(value: DateLike): string {
  const ms = toMs(value);
  if (ms === null) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(ms);
}

/** Quest schedule fields → DateRange for DateRangePicker. */
export function questToDateRange(quest: {
  starts_at?: DateLike;
  ends_at?: DateLike;
}): { from: Date | undefined; to?: Date | undefined } | undefined {
  const fromMs = toMs(quest.starts_at);
  const toMsVal = toMs(quest.ends_at);
  if (fromMs === null && toMsVal === null) return undefined;
  return {
    from:
      fromMs !== null
        ? new Date(fromMs)
        : toMsVal !== null
          ? new Date(toMsVal)
          : undefined,
    to: toMsVal !== null ? new Date(toMsVal) : undefined,
  };
}

/** DateRange → ISO strings for hidden form fields (start of from-day, end of to-day). */
export function dateRangeToScheduleIso(
  range: { from?: Date; to?: Date } | undefined,
): { startsAt: string; endsAt: string } {
  if (!range?.from) return { startsAt: "", endsAt: "" };
  const start = new Date(range.from);
  start.setHours(0, 0, 0, 0);
  if (!range.to) {
    return { startsAt: start.toISOString(), endsAt: "" };
  }
  const end = new Date(range.to);
  end.setHours(23, 59, 59, 999);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}
