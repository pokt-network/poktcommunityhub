import { monthWindow } from '@community/core';

import type { Pool } from './pool.js';

export type LeaderboardPeriod = 'all' | 'month';

export type LeaderboardRow = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  xp: number;
  /** Competition rank: ties share a rank and the next rank skips (1, 1, 3). */
  rank: number;
};

/** A user's all-time XP: the sum of their ledger. */
export async function xpTotal(pool: Pool, userId: string): Promise<number> {
  const { rows } = await pool.query<{ total: string }>(
    'SELECT coalesce(sum(delta), 0) AS total FROM xp_events WHERE user_id = $1',
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}

/**
 * The ranked totals for a period. The month is the UTC calendar month containing
 * `now`, and an undo counts in the month of the award it cancels
 * (`xp_events_attributed`), so undoing last month's approval corrects last month
 * rather than costing this one.
 */
const RANKED = `
  WITH totals AS (
    SELECT user_id, sum(delta) AS xp
      FROM xp_events_attributed
     WHERE ($1::timestamptz IS NULL OR attributed_at >= $1)
       AND ($2::timestamptz IS NULL OR attributed_at < $2)
     GROUP BY user_id
    HAVING sum(delta) > 0
  )
  SELECT u.id AS user_id, u.name, u.avatar_url, t.xp,
         rank() OVER (ORDER BY t.xp DESC) AS rank
    FROM totals t JOIN users u ON u.id = t.user_id`;

function bounds(period: LeaderboardPeriod, now: Date): [Date | null, Date | null] {
  if (period === 'all') return [null, null];
  const { start, end } = monthWindow(now);
  return [start, end];
}

type RankedRow = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  xp: string;
  rank: string;
};

const toRow = (row: RankedRow): LeaderboardRow => ({
  userId: row.user_id,
  name: row.name,
  avatarUrl: row.avatar_url,
  xp: Number(row.xp),
  rank: Number(row.rank),
});

/** Flow 6: the leaderboard, best first, then by name for a stable order within ties. */
export async function leaderboard(
  pool: Pool,
  input: { period: LeaderboardPeriod; now?: Date; limit?: number },
): Promise<LeaderboardRow[]> {
  const [start, end] = bounds(input.period, input.now ?? new Date());
  const { rows } = await pool.query<RankedRow>(`${RANKED} ORDER BY rank, u.name, u.id LIMIT $3`, [
    start,
    end,
    input.limit ?? 100,
  ]);
  return rows.map(toRow);
}

/** Flow 6, "your own rank": null when the user has no XP in the period. */
export async function leaderboardRank(
  pool: Pool,
  input: { userId: string; period: LeaderboardPeriod; now?: Date },
): Promise<LeaderboardRow | null> {
  const [start, end] = bounds(input.period, input.now ?? new Date());
  const { rows } = await pool.query<RankedRow>(
    `SELECT * FROM (${RANKED}) ranked WHERE user_id = $3`,
    [start, end, input.userId],
  );
  return rows[0] === undefined ? null : toRow(rows[0]);
}
