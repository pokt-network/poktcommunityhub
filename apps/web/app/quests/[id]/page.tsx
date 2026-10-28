import { questPhase, type QuestPhase } from '@community/core';
import { questDetail } from '@community/store';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Markdown from 'react-markdown';

import { currentViewer } from '@/lib/authz';
import { db } from '@/lib/db';
import { formatDate, formatXp, STATUS_LABELS } from '@/lib/format';
import { isUuid } from '@/lib/ids';
import { signInWithDiscord } from '@/lib/session-actions';

import styles from '../../hub.module.css';
import { SubmitProofForm } from './submit-form';

type Params = Promise<{ id: string }>;
type Search = Promise<{ submitted?: string }>;

async function load(id: string) {
  if (!isUuid(id)) notFound();
  const viewer = await currentViewer();
  const quest = await questDetail(db(), { questId: id, viewerId: viewer?.id ?? null });
  if (quest === null) notFound();
  return { viewer, quest };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { quest } = await load((await params).id);
  return { title: quest.title };
}

const CLOSED_REASONS: Record<
  Exclude<QuestPhase, 'live'>,
  (q: { startsAt: Date | null }) => string
> = {
  scheduled: (q) =>
    `This quest opens on ${q.startsAt === null ? 'a later date' : formatDate(q.startsAt)}.`,
  ended: () => 'This quest has ended.',
  closed: () => 'This quest is closed.',
};

/**
 * Flow 3: one quest, and the way to submit proof for it. Public, like the board;
 * the submission panel is the viewer's own and needs a sign-in.
 */
export default async function QuestPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { viewer, quest } = await load((await params).id);
  const { submitted } = await searchParams;
  const phase = questPhase(quest, new Date());
  const mine = quest.submission;
  const canSubmit = phase === 'live' && (mine === null || mine.status === 'rejected');

  return (
    <main className={styles.narrow}>
      <p className={styles.muted}>
        <Link href="/">← All quests</Link>
      </p>

      <div className={styles.heading}>
        <div className={styles.row}>
          <span className={styles.icon} aria-hidden>
            {quest.icon ?? '◆'}
          </span>
          <h1 className={styles.title}>{quest.title}</h1>
        </div>
        <div className={styles.meta}>
          <span className={styles.xp}>{formatXp(quest.xpReward)}</span>
          {quest.category !== null && <span>{quest.category.name}</span>}
          {quest.rewardRole !== null && <span>Reward role: {quest.rewardRole.name}</span>}
          {quest.endsAt !== null && <span>Ends {formatDate(quest.endsAt)}</span>}
        </div>
      </div>

      {quest.descriptionMd.trim() !== '' && (
        <div className={styles.prose}>
          {/* Raw HTML in the Markdown is dropped, and react-markdown blanks javascript: links. */}
          <Markdown
            skipHtml
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                  {children}
                </a>
              ),
              img: () => null,
            }}
          >
            {quest.descriptionMd}
          </Markdown>
        </div>
      )}

      <section className={styles.panel} aria-labelledby="proof-heading">
        <h2 id="proof-heading" className={styles.subtitle}>
          Your proof
        </h2>
        <p className={styles.lede}>
          {quest.linkCount === 1 ? 'Submit one link' : `Submit ${quest.linkCount} links`} showing
          you completed the quest, and a screenshot if it helps.
          {quest.linkHint !== null && ` ${quest.linkHint}`}
        </p>

        {submitted === '1' && mine?.status === 'pending' && (
          <p className={styles.success} role="status">
            Submitted. An admin will review your proof.
          </p>
        )}

        {mine !== null && (
          <div className={styles.item}>
            <div className={styles.spread}>
              <span className={styles.chip} data-status={mine.status}>
                {STATUS_LABELS[mine.status]}
              </span>
              <span className={styles.muted}>Submitted {formatDate(mine.submittedAt)}</span>
            </div>
            <ul className={styles.links}>
              {mine.proofUrls.map((url) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer nofollow">
                    {url}
                  </a>
                </li>
              ))}
            </ul>
            {mine.hasFile && (
              <a href={`/proofs/${mine.id}`} target="_blank" rel="noopener">
                View your screenshot
              </a>
            )}
            {mine.reviewNote !== null && mine.reviewNote !== '' && (
              <p>
                <strong>Reviewer&apos;s note:</strong> {mine.reviewNote}
              </p>
            )}
          </div>
        )}

        {phase !== 'live' ? (
          <p className={styles.muted}>{CLOSED_REASONS[phase](quest)}</p>
        ) : viewer === null ? (
          <form action={signInWithDiscord}>
            <button className={styles.button} type="submit">
              Sign in with Discord to submit
            </button>
          </form>
        ) : canSubmit ? (
          <SubmitProofForm
            questId={quest.id}
            linkCount={quest.linkCount}
            resubmit={mine?.status === 'rejected'}
          />
        ) : null}
      </section>
    </main>
  );
}
