import { leaderboardRank, profile } from '@community/store';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requireUser } from '@/lib/authz';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';

import styles from '../../hub.module.css';
import { ProfileSummary } from '../../profile-summary';

export const metadata: Metadata = { title: 'Profile' };

/**
 * Flow 7: a member's profile. Members only (brief section 12, item 2), and only
 * the public parts: XP, ranks and completed quests.
 */
export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [person, rank] = await Promise.all([
    profile(db(), id),
    leaderboardRank(db(), { userId: id, period: 'all' }),
  ]);
  if (person === null) notFound();

  return (
    <main className={styles.narrow}>
      <ProfileSummary profile={person} rank={rank} />
    </main>
  );
}
