import { adminCategories, adminRanks } from '@community/store';
import type { Metadata } from 'next';

import { requireAdmin } from '@/lib/authz';
import { db } from '@/lib/db';

import { AdminFrame } from '../../admin-frame';
import { QuestForm } from '../quest-form';

export const metadata: Metadata = { title: 'New quest' };

export default async function NewQuestPage() {
  await requireAdmin();
  const [categories, ranks] = await Promise.all([adminCategories(db()), adminRanks(db())]);

  return (
    <AdminFrame title="New quest">
      <QuestForm quest={null} id={null} categories={categories} ranks={ranks} />
    </AdminFrame>
  );
}
