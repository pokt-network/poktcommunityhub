import { leaderboard, leaderboardRank, type LeaderboardPeriod } from '@community/store';
import type { Metadata } from 'next';
import Link from 'next/link';

import { currentViewer } from '@/lib/authz';
import { db } from '@/lib/db';

import styles from '../hub.module.css';

export const metadata: Metadata = { title: 'Leaderboard' };

const PERIODS: { id: LeaderboardPeriod; label: string; href: string }[] = [
  { id: 'all', label: 'All time', href: '/leaderboard' },
  { id: 'month', label: 'This month', href: '/leaderboard?period=month' },
];

/**
 * Flow 6. Public (brief section 12, item 1). Names link to profiles only for a
 * signed-in viewer, since profiles are members-only (item 2).
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const { period: raw } = await searchParams;
  const period: LeaderboardPeriod = raw === 'month' ? 'month' : 'all';
  const viewer = await currentViewer();
  const [rows, mine] = await Promise.all([
    leaderboard(db(), { period }),
    viewer === null ? null : leaderboardRank(db(), { userId: viewer.id, period }),
  ]);
  const mineShown = mine !== null && rows.some((r) => r.userId === mine.userId);

  return (
    <main className={styles.narrow}>
      <div className={styles.heading}>
        <h1 className={styles.title}>Leaderboard</h1>
        <p className={styles.lede}>
          {period === 'month'
            ? 'XP earned this calendar month (UTC).'
            : 'Total XP earned on the hub.'}
        </p>
      </div>

      <nav className={styles.tabs} aria-label="Period">
        {PERIODS.map((p) => (
          <Link
            key={p.id}
            className={styles.tab}
            href={p.href}
            aria-current={p.id === period ? 'page' : undefined}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      {viewer !== null && (
        <p className={styles.muted}>
          {mine === null
            ? 'You have no XP in this period yet.'
            : `You are #${mine.rank} with ${mine.xp.toLocaleString('en-US')} XP.`}
        </p>
      )}

      {rows.length === 0 ? (
        <p className={styles.empty}>Nobody has earned XP in this period yet.</p>
      ) : (
        <div className={`${styles.board} ${styles.tableWrap}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Ambassador</th>
                <th className={styles.num} scope="col">
                  XP
                </th>
              </tr>
            </thead>
            <tbody>
              {[...rows, ...(mine !== null && !mineShown ? [mine] : [])].map((r) => (
                <tr key={r.userId} data-me={r.userId === viewer?.id}>
                  <td>
                    <span className={styles.medal} data-place={r.rank <= 3 ? r.rank : undefined}>
                      {r.rank}
                    </span>
                  </td>
                  <td>
                    <span className={styles.person}>
                      {r.avatarUrl !== null && (
                        <img src={r.avatarUrl} alt="" width={32} height={32} />
                      )}
                      {viewer === null ? r.name : <Link href={`/users/${r.userId}`}>{r.name}</Link>}
                    </span>
                  </td>
                  <td className={`${styles.num} ${styles.xp}`}>{r.xp.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
