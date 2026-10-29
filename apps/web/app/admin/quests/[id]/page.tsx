import { adminCategories, adminQuests, adminRanks, questForEdit } from '@community/store';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { deleteQuestAction, setQuestStatusAction } from '@/lib/admin-actions';
import { requireAdmin } from '@/lib/authz';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';

import { ActionForm } from '@/app/action-form';
import styles from '@/app/hub.module.css';
import { AdminFrame } from '../../admin-frame';
import { QuestForm } from '../quest-form';

export const metadata: Metadata = { title: 'Edit quest' };

/** Flow 9: edit, close or reopen, or delete a quest nobody has submitted to. */
export default async function EditQuestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [quest, categories, ranks, all] = await Promise.all([
    questForEdit(db(), id),
    adminCategories(db()),
    adminRanks(db()),
    adminQuests(db()),
  ]);
  if (quest === null) notFound();
  const submissions = all.find((q) => q.id === id)?.submissions ?? 0;
  const { saved } = await searchParams;

  return (
    <AdminFrame title={quest.title}>
      <p className={styles.muted}>
        <Link href="/admin/quests">← All quests</Link> ·{' '}
        <Link href={`/quests/${id}`}>View as a member</Link>
      </p>
      {saved === '1' && (
        <p className={styles.success} role="status">
          Created.
        </p>
      )}

      <QuestForm quest={quest} id={id} categories={categories} ranks={ranks} />

      <section className={styles.panel} aria-labelledby="state-heading">
        <h2 id="state-heading" className={styles.subtitle}>
          {quest.status === 'closed' ? 'Closed' : 'Open'}
        </h2>
        <ActionForm
          action={setQuestStatusAction}
          tone="quiet"
          submit={quest.status === 'closed' ? 'Reopen quest' : 'Close quest'}
        >
          <input type="hidden" name="id" value={id} />
          <input
            type="hidden"
            name="status"
            value={quest.status === 'closed' ? 'active' : 'closed'}
          />
          <p className={styles.muted}>
            {quest.status === 'closed'
              ? 'Reopening puts it back on the board, within its dates.'
              : 'Closing takes it off the board. Submissions and XP already awarded are kept.'}
          </p>
        </ActionForm>
      </section>

      <section className={styles.panel} aria-labelledby="delete-heading">
        <h2 id="delete-heading" className={styles.subtitle}>
          Delete
        </h2>
        {submissions > 0 ? (
          <p className={styles.muted}>
            {submissions} {submissions === 1 ? 'submission holds' : 'submissions hold'} this quest’s
            history and XP, so it can be closed but not deleted.
          </p>
        ) : (
          <ActionForm action={deleteQuestAction} tone="danger" submit="Delete quest">
            <input type="hidden" name="id" value={id} />
            <label className={styles.check}>
              <input type="checkbox" name="confirm" value="yes" required /> Delete this quest for
              good
            </label>
          </ActionForm>
        )}
      </section>
    </AdminFrame>
  );
}
