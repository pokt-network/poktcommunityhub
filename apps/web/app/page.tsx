import { listCategories, questBoard, type BoardFilter } from '@community/store';
import Link from 'next/link';

import { currentViewer } from '@/lib/authz';
import { db } from '@/lib/db';
import { formatDate, formatXp, STATUS_LABELS } from '@/lib/format';
import { isUuid } from '@/lib/ids';

import styles from './hub.module.css';

type Search = Promise<Record<string, string | string[] | undefined>>;

const PROGRESS = ['not_started', 'pending', 'approved', 'rejected'] as const;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Read the filters from the query string, dropping anything that is not one. */
function parseFilter(search: Awaited<Search>): BoardFilter {
  const category = first(search['category']);
  const progress = first(search['progress']);
  const sort = first(search['sort']);
  return {
    categoryId: category !== undefined && isUuid(category) ? category : undefined,
    progress: PROGRESS.find((p) => p === progress),
    sort: sort === 'ending' ? 'ending' : 'newest',
  };
}

/**
 * Flow 2: the quest board. Public (brief section 12, item 1): anyone can see
 * what is on offer; signing in adds your progress and the way to submit.
 */
export default async function QuestBoard({ searchParams }: { searchParams: Search }) {
  const viewer = await currentViewer();
  const filter = parseFilter(await searchParams);
  const [categories, quests] = await Promise.all([
    listCategories(db()),
    questBoard(db(), { viewerId: viewer?.id ?? null, filter }),
  ]);

  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <h1 className={styles.title}>Quests</h1>
        <p className={styles.lede}>
          Complete a quest, submit your proof, and earn XP and ranks in the POKT community.
        </p>
        {viewer === null && (
          <p className={styles.muted}>
            <Link href="/signin">Sign in with Discord</Link> to submit proof and track your
            progress.
          </p>
        )}
      </div>

      <form className={styles.filters} method="get" role="search" aria-label="Filter quests">
        <label className={styles.field}>
          Category
          <select className={styles.input} name="category" defaultValue={filter.categoryId ?? ''}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {viewer !== null && (
          <label className={styles.field}>
            Your progress
            <select className={styles.input} name="progress" defaultValue={filter.progress ?? ''}>
              <option value="">Any</option>
              {PROGRESS.map((p) => (
                <option key={p} value={p}>
                  {STATUS_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={styles.field}>
          Sort
          <select className={styles.input} name="sort" defaultValue={filter.sort}>
            <option value="newest">Newest first</option>
            <option value="ending">Ending soonest</option>
          </select>
        </label>
        <button className={styles.quiet} type="submit">
          Apply
        </button>
      </form>

      {quests.length === 0 ? (
        <p className={styles.empty}>No live quests match. Check back soon.</p>
      ) : (
        <ul className={styles.grid}>
          {quests.map((q) => (
            <li key={q.id}>
              <Link className={styles.card} href={`/quests/${q.id}`}>
                <div className={styles.cardTop}>
                  <span className={styles.icon} aria-hidden>
                    {q.icon ?? '◆'}
                  </span>
                  {q.viewerStatus !== null && (
                    <span className={styles.chip} data-status={q.viewerStatus}>
                      {STATUS_LABELS[q.viewerStatus]}
                    </span>
                  )}
                </div>
                <h2 className={styles.cardTitle}>{q.title}</h2>
                <div className={styles.meta}>
                  <span className={styles.xp}>{formatXp(q.xpReward)}</span>
                  {q.category !== null && <span>{q.category.name}</span>}
                  {q.endsAt !== null && <span>Ends {formatDate(q.endsAt)}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
