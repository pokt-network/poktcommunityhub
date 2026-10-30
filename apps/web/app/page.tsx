import { listCategories, questBoard, type BoardFilter } from '@community/store';
import { ArrowRight, Check, Hourglass, LogIn, Sparkles, Target, X } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties } from 'react';

import { currentViewer } from '@/lib/authz';
import { categoryColor } from '@/lib/category-color';
import { db } from '@/lib/db';
import { formatDate, STATUS_LABELS } from '@/lib/format';
import { isUuid } from '@/lib/ids';

import styles from './hub.module.css';
import { QuestIcon } from './quest-icon';

type Search = Promise<Record<string, string | string[] | undefined>>;

const PROGRESS = ['not_started', 'pending', 'approved', 'rejected'] as const;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** How far along the viewer is, for the card's meter. */
const METER = { pending: '60%', approved: '100%', rejected: '0%' } as const;
const STATUS_ICONS = { pending: Hourglass, approved: Check, rejected: X } as const;

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

/** The board's URL with one category chosen, keeping the other filters. */
function categoryHref(filter: BoardFilter, categoryId: string | undefined): string {
  const params = new URLSearchParams();
  if (categoryId !== undefined) params.set('category', categoryId);
  if (filter.progress !== undefined) params.set('progress', filter.progress);
  if (filter.sort === 'ending') params.set('sort', 'ending');
  const query = params.toString();
  return query === '' ? '/' : `/?${query}`;
}

/** A custom property for the inline style; React types do not know them. */
const tint = (color: string) => ({ '--c': color }) as CSSProperties;

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
  const unfiltered = filter.categoryId === undefined && filter.progress === undefined;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>
            <Sparkles size={14} aria-hidden />
            POKT Community Hub
          </span>
          <h1 className={styles.heroTitle}>
            Complete quests, <span className={styles.goldText}>earn XP</span>, rise through the
            ranks
          </h1>
          <p className={styles.heroLede}>
            Share Pocket with the world, help new builders, and get recognised in the community for
            it.
          </p>
          <div className={styles.heroRow}>
            {viewer === null ? (
              <Link className={styles.gold} href="/signin">
                <LogIn size={18} aria-hidden />
                Sign in with Discord
              </Link>
            ) : (
              <Link className={styles.gold} href="/me">
                Your profile
                <ArrowRight size={18} aria-hidden />
              </Link>
            )}
            {unfiltered && (
              <span className={styles.count}>
                <Target size={18} aria-hidden />
                <b>{quests.length}</b> {quests.length === 1 ? 'quest' : 'quests'} available
              </span>
            )}
          </div>
        </div>
        <div className={styles.heroArt} aria-hidden>
          <span className={styles.coinBig}>XP</span>
          <span className={styles.coinSmall}>+50</span>
          <img className={styles.heroMark} src="/pokt-mark.svg" alt="" width={56} height={56} />
          <Sparkles className={styles.spark1} size={22} />
          <Sparkles className={styles.spark2} size={18} />
        </div>
      </section>

      <div className={styles.toolbar}>
        <nav className={styles.cats} aria-label="Category">
          <Link
            className={styles.cat}
            href={categoryHref(filter, undefined)}
            aria-current={filter.categoryId === undefined ? 'page' : undefined}
            style={tint('var(--brand-gold)')}
          >
            <i aria-hidden />
            All quests
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              className={styles.cat}
              href={categoryHref(filter, c.id)}
              aria-current={filter.categoryId === c.id ? 'page' : undefined}
              style={tint(categoryColor(categories, c.id))}
            >
              <i aria-hidden />
              {c.name}
            </Link>
          ))}
        </nav>

        <form className={styles.sortForm} method="get" role="search" aria-label="Filter quests">
          {filter.categoryId !== undefined && (
            <input type="hidden" name="category" value={filter.categoryId} />
          )}
          {viewer !== null && (
            <select
              className={styles.select}
              name="progress"
              aria-label="Your progress"
              defaultValue={filter.progress ?? ''}
            >
              <option value="">Any progress</option>
              {PROGRESS.map((p) => (
                <option key={p} value={p}>
                  {STATUS_LABELS[p]}
                </option>
              ))}
            </select>
          )}
          <select
            className={styles.select}
            name="sort"
            aria-label="Sort"
            defaultValue={filter.sort}
          >
            <option value="newest">Newest first</option>
            <option value="ending">Ending soonest</option>
          </select>
          <button className={styles.quiet} type="submit">
            Apply
          </button>
        </form>
      </div>

      {quests.length === 0 ? (
        <p className={styles.empty}>No live quests match. Check back soon.</p>
      ) : (
        <ul className={styles.grid}>
          {quests.map((q) => {
            const status = q.viewerStatus;
            const StatusIcon = status === null ? null : STATUS_ICONS[status];
            return (
              <li key={q.id}>
                <Link
                  className={styles.card}
                  href={`/quests/${q.id}`}
                  style={tint(categoryColor(categories, q.category?.id))}
                >
                  <div className={styles.cardTop}>
                    <QuestIcon icon={q.icon} />
                    <div className={styles.cardHeading}>
                      <span className={styles.kicker}>{q.category?.name ?? 'Quest'}</span>
                      <h2 className={styles.cardTitle}>{q.title}</h2>
                    </div>
                    <span className={styles.coin}>
                      <b>{q.xpReward.toLocaleString('en-US')}</b>
                      <small>XP</small>
                    </span>
                  </div>
                  <div className={styles.meta}>
                    {q.endsAt !== null ? (
                      <span>Ends {formatDate(q.endsAt)}</span>
                    ) : (
                      <span>Open</span>
                    )}
                  </div>
                  <div className={styles.cardFoot}>
                    {status !== null && StatusIcon !== null ? (
                      <span className={styles.chip} data-status={status}>
                        <StatusIcon size={13} aria-hidden />
                        {STATUS_LABELS[status]}
                      </span>
                    ) : (
                      <span className={styles.fraction}>0/1</span>
                    )}
                    <span className={styles.meter}>
                      <span style={{ width: status === null ? '0%' : METER[status] }} />
                    </span>
                    <span className={styles.go}>
                      {status === null || status === 'rejected' ? 'Start' : 'View'}
                      <ArrowRight size={16} aria-hidden />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
