/** A sliding-window limit: at most `limit` attempts in `windowMs`, `minIntervalMs` apart. */
export type RateRule = { limit: number; windowMs: number; minIntervalMs: number };

/**
 * Submission limits (brief section 12, item 4): the MVP's numbers. A screenshot
 * costs a re-encode and disk, so it gets the tighter rule.
 */
export const SUBMISSION_LIMITS = {
  withFile: { limit: 3, windowMs: 60_000, minIntervalMs: 5_000 },
  linksOnly: { limit: 6, windowMs: 60_000, minIntervalMs: 3_000 },
} as const satisfies Record<string, RateRule>;

export type RateDecision = { allowed: true } | { allowed: false; retryAfterMs: number };

/**
 * Whether one more attempt is allowed at `now`, given the earlier attempts under
 * the same rule. Attempts outside the window are ignored, so the caller may pass
 * more history than the window holds. A refusal says how long until the next
 * attempt would be allowed.
 */
export function checkRate(previous: readonly Date[], now: Date, rule: RateRule): RateDecision {
  const t = now.getTime();
  const recent = previous.map((d) => d.getTime()).filter((at) => at > t - rule.windowMs && at <= t);
  if (recent.length === 0) return { allowed: true };

  const latest = Math.max(...recent);
  const waits: number[] = [];
  if (t - latest < rule.minIntervalMs) waits.push(latest + rule.minIntervalMs - t);
  if (recent.length >= rule.limit) {
    // The window frees a slot when the oldest attempt that still counts ages out.
    const sorted = recent.sort((a, b) => a - b);
    const oldestCounting = sorted[sorted.length - rule.limit]!;
    waits.push(oldestCounting + rule.windowMs - t);
  }
  return waits.length === 0
    ? { allowed: true }
    : { allowed: false, retryAfterMs: Math.max(...waits) };
}
