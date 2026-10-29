import { adminRanks } from '@community/store';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { deleteRankAction } from '@/lib/admin-actions';
import { requireAdmin } from '@/lib/authz';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';

import { ActionForm } from '@/app/action-form';
import styles from '@/app/hub.module.css';
import { AdminFrame } from '../../admin-frame';
import { RankForm } from '../rank-form';

export const metadata: Metadata = { title: 'Edit rank' };

/** Flow 11: edit a rank, or delete it after saying how many hold it (section 13.5). */
export default async function EditRankPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const rank = (await adminRanks(db())).find((r) => r.id === id);
  if (rank === undefined) notFound();

  return (
    <AdminFrame title={rank.name}>
      <p className={styles.muted}>
        <Link href="/admin/ranks">← All ranks</Link>
      </p>
      <RankForm rank={rank} id={id} />

      <section className={styles.panel} aria-labelledby="delete-heading">
        <h2 id="delete-heading" className={styles.subtitle}>
          Delete
        </h2>
        <ActionForm action={deleteRankAction} tone="danger" submit="Delete rank">
          <input type="hidden" name="id" value={id} />
          <label className={styles.check}>
            <input type="checkbox" name="confirm" value="yes" required />
            {rank.holders === 0
              ? 'Delete this rank. Nobody holds it.'
              : `Delete this rank and remove it from the ${rank.holders} ${
                  rank.holders === 1 ? 'member who holds' : 'members who hold'
                } it.`}
          </label>
          <p className={styles.muted}>Quests that reward it will reward no rank.</p>
        </ActionForm>
      </section>
    </AdminFrame>
  );
}
