import { headers } from "next/headers";

type RateLimitRecord = {
  timestamps: number[];
  lastAttempt?: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  minIntervalMs?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  retryAfterSec: number;
  error?: string;
};

const globalForRateLimit = globalThis as unknown as {
  rateLimitStores?: Map<string, RateLimitRecord>;
  lastRateLimitGc?: number;
};

function getStore(): Map<string, RateLimitRecord> {
  if (!globalForRateLimit.rateLimitStores) {
    globalForRateLimit.rateLimitStores = new Map();
  }
  return globalForRateLimit.rateLimitStores;
}

function runGc(now: number) {
  const store = getStore();
  const lastGc = globalForRateLimit.lastRateLimitGc ?? 0;
  if (now - lastGc < 60_000 && store.size < 500) return;

  globalForRateLimit.lastRateLimitGc = now;
  for (const [key, record] of store.entries()) {
    // Drop if last attempt was more than 10 minutes ago
    if (!record.lastAttempt || now - record.lastAttempt > 600_000) {
      store.delete(key);
    }
  }
}

/**
 * Generic sliding-window rate limiter with optional minimum interval (cooldown).
 */
export function rateLimit({
  key,
  limit,
  windowMs,
  minIntervalMs,
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  runGc(now);

  const store = getStore();
  let record = store.get(key);

  if (!record) {
    record = { timestamps: [], lastAttempt: undefined };
    store.set(key, record);
  }

  // 1. Check minimum cooldown between actions
  if (minIntervalMs && record.lastAttempt) {
    const elapsed = now - record.lastAttempt;
    if (elapsed < minIntervalMs) {
      const retryAfterMs = minIntervalMs - elapsed;
      const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
      return {
        allowed: false,
        remaining: 0,
        resetMs: retryAfterMs,
        retryAfterSec,
      };
    }
  }

  // 2. Filter out timestamps outside the sliding window
  const windowStart = now - windowMs;
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  // 3. Check window limit
  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0] ?? now;
    const retryAfterMs = oldest + windowMs - now;
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetMs: retryAfterMs,
      retryAfterSec,
    };
  }

  // 4. Record this action
  record.timestamps.push(now);
  record.lastAttempt = now;

  return {
    allowed: true,
    remaining: Math.max(0, limit - record.timestamps.length),
    resetMs: windowMs,
    retryAfterSec: 0,
  };
}

/**
 * Extracts client IP from standard reverse-proxy headers in Next.js.
 */
async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first;
    }
    const realIp = h.get("x-real-ip")?.trim();
    if (realIp) return realIp;
    const cfConnectingIp = h.get("cf-connecting-ip")?.trim();
    if (cfConnectingIp) return cfConnectingIp;
  } catch {
    // headers() might throw outside request context
  }
  return "unknown";
}

/**
 * Rate limiter specifically tailored for `submitProofAction`.
 * Protects Supabase storage and database from spam loops and bot floods.
 */
export async function checkSubmissionRateLimit(
  userId: string,
  hasFile: boolean,
): Promise<{ allowed: boolean; error?: string; retryAfterSec?: number }> {
  const ip = await getClientIp();

  // 1. User screenshot upload limit (strict to protect storage)
  if (hasFile) {
    // Max 3 uploads per 60s, minimum 5s cooldown between uploads
    const userUploadCheck = rateLimit({
      key: `upload:user:${userId}`,
      limit: 3,
      windowMs: 60_000,
      minIntervalMs: 5_000,
    });

    if (!userUploadCheck.allowed) {
      return {
        allowed: false,
        retryAfterSec: userUploadCheck.retryAfterSec,
        error: `You're uploading screenshots too quickly. Please wait ${userUploadCheck.retryAfterSec}s before uploading again.`,
      };
    }
  }

  // 2. User submission limit (all submissions including links)
  // Max 6 submissions per 60s, minimum 3s cooldown between submissions
  const userSubCheck = rateLimit({
    key: `sub:user:${userId}`,
    limit: 6,
    windowMs: 60_000,
    minIntervalMs: 3_000,
  });

  if (!userSubCheck.allowed) {
    return {
      allowed: false,
      retryAfterSec: userSubCheck.retryAfterSec,
      error: `You're submitting proofs too quickly. Please wait ${userSubCheck.retryAfterSec}s before trying again.`,
    };
  }

  // 3. IP-level safety check against distributed multi-account bots
  if (ip !== "unknown" && ip !== "127.0.0.1" && ip !== "::1") {
    if (hasFile) {
      const ipUploadCheck = rateLimit({
        key: `upload:ip:${ip}`,
        limit: 10,
        windowMs: 60_000,
      });
      if (!ipUploadCheck.allowed) {
        return {
          allowed: false,
          retryAfterSec: ipUploadCheck.retryAfterSec,
          error: `Too many file uploads from your network. Please wait ${ipUploadCheck.retryAfterSec}s before trying again.`,
        };
      }
    }

    const ipSubCheck = rateLimit({
      key: `sub:ip:${ip}`,
      limit: 25,
      windowMs: 60_000,
    });
    if (!ipSubCheck.allowed) {
      return {
        allowed: false,
        retryAfterSec: ipSubCheck.retryAfterSec,
        error: `Too many submissions from your network. Please wait ${ipSubCheck.retryAfterSec}s before trying again.`,
      };
    }
  }

  return { allowed: true };
}

/** For testing or administrative reset */
export function _resetRateLimits(): void {
  getStore().clear();
}
