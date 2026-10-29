import { adminRanks } from '@community/store';
import type { Metadata } from 'next';
import Link from 'next/link';

import { moveRankAction } from '@/lib/admin-actions';
import { requireAdmin } from '@/lib/authz';
import { db } from '@/lib/db';

import { ActionForm } from '../../action-form';
import styles from '../../hub.module.css';
import { AdminFrame } from '../admin-frame';
import { RankForm } from './rank-form';

export const metadata: Metadata = { title: 'Ranks' };

/** Flow 11: the ranks (server roles), in display order, with how many hold each. */
export default async function RanksPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const ranks = await adminRanks(db());
  const { saved } = await searchParams;

  return (
    <AdminFrame title="Ranks">
      {saved === '1' && (
        <p className={styles.success} role="status">
          Rank created. Members who already qualify have it.
        </p>
      )}
      {ranks.length === 0 ? (
        <p className={styles.empty}>No ranks yet.</p>
      ) : (
        <ul className={styles.list}>
          {ranks.map((r, i) => (
            <li key={r.id} className={styles.item}>
              <div className={styles.spread}>
                <span className={styles.row}>
                  <span
                    className={styles.role}
                    style={r.color === null ? undefined : { borderColor: r.color, color: r.color }}
                  >
                    {r.icon !== null && <span aria-hidden>{r.icon} </span>}
                    {r.name}
                  </span>
                  <Link href={`/admin/ranks/${r.id}`}>Edit</Link>
                </span>
                <span className={styles.meta}>
                  <span>
                    {r.xpRequired === null
                      ? 'Reward or by hand'
                      : `${r.xpRequired.toLocaleString('en-US')} XP`}
                  </span>
                  <span>
                    {r.holders} {r.holders === 1 ? 'holder' : 'holders'}
                  </span>
                  <span>{r.discordRoleId === null ? 'No Discord role' : 'Discord role set'}</span>
                </span>
              </div>
              <div className={styles.row}>
                {i > 0 && (
                  <ActionForm
                    action={moveRankAction}
                    submit="Move up"
                    tone="quiet"
                    className={styles.inline}
                  >
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="direction" value="up" />
                  </ActionForm>
                )}
                {i < ranks.length - 1 && (
                  <ActionForm
                    action={moveRankAction}
                    submit="Move down"
                    tone="quiet"
                    className={styles.inline}
                  >
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="direction" value="down" />
                  </ActionForm>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className={styles.panel} aria-labelledby="new-rank">
        <h2 id="new-rank" className={styles.subtitle}>
          New rank
        </h2>
        <RankForm rank={null} id={null} />
      </section>
    </AdminFrame>
  );
}
