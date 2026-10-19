import Link from "next/link";
import { FaArrowRight, FaTrophy } from "react-icons/fa";
import { LuSwords } from "react-icons/lu";
import { LeaderboardBoard } from "@/components/leaderboard-board";
import { QuestScheduleChip } from "@/components/quest-schedule-chip";
import { XpBadge } from "@/components/xp-badge";
import {
  listActiveQuests,
  listLeaderboard,
  listMonthlyLeaderboard,
} from "@/lib/db";

export async function HomeQuestsSection() {
  let quests: Awaited<ReturnType<typeof listActiveQuests>> = [];
  try {
    quests = await listActiveQuests(8);
  } catch {
    quests = [];
  }

  return (
    <section id="quests" className="scroll-mt-24 border-t border-white/10 sm:scroll-mt-28">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display flex items-center gap-2 text-2xl font-semibold tracking-tight text-white sm:gap-3 sm:text-3xl md:text-4xl">
              <LuSwords className="h-6 w-6 shrink-0 text-primary sm:h-7 sm:w-7" aria-hidden />
              Active quests
            </h2>
            <p className="mt-2 text-muted">
              Live ambassador tasks from the Hub — earn XP when approved.
            </p>
          </div>
          <Link
            href="/quests"
            prefetch
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-hover"
          >
            View all
            <FaArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>

        {quests.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-white/10 bg-card/50 px-5 py-10 text-center text-sm text-muted">
            No active quests yet. Check back soon.
          </p>
        ) : (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {quests.map((quest) => (
              <li key={quest.id}>
                <Link
                  href={`/quests/${quest.id}`}
                  className="flex h-full flex-col rounded-2xl border border-white/10 bg-[linear-gradient(165deg,rgba(18,26,42,0.92)_0%,rgba(8,12,20,0.96)_55%,rgba(6,9,14,0.98)_100%)] p-5 transition hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-semibold text-white">
                        {quest.title}
                      </h3>
                      {quest.ends_at ? (
                        <div className="mt-1.5">
                          <QuestScheduleChip quest={quest} size="xs" />
                        </div>
                      ) : null}
                    </div>
                    <XpBadge amount={quest.xp_reward} size="md" layout="row" />
                  </div>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">
                    {quest.description || "No description."}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
                    Submit proof
                    <FaArrowRight className="h-3 w-3" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export async function HomeLeaderboardSection() {
  let allTime: Awaited<ReturnType<typeof listLeaderboard>> = [];
  let monthly: Awaited<ReturnType<typeof listMonthlyLeaderboard>> = [];
  try {
    [allTime, monthly] = await Promise.all([
      listLeaderboard(10),
      listMonthlyLeaderboard(10),
    ]);
  } catch {
    allTime = [];
    monthly = [];
  }

  return (
    <section
      id="leaderboard"
      className="scroll-mt-24 border-t border-white/10 bg-white/[0.02] sm:scroll-mt-28"
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display flex items-center gap-2 text-2xl font-semibold tracking-tight text-white sm:gap-3 sm:text-3xl md:text-4xl">
              <FaTrophy
                className="h-6 w-6 shrink-0 text-primary sm:h-7 sm:w-7"
                aria-hidden
              />
              Leaderboard
            </h2>
            <p className="mt-2 text-muted">
              Live rankings by XP — updated when proofs are approved.
            </p>
          </div>
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-hover"
          >
            Full board
            <FaArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>

        <LeaderboardBoard
          className="mt-10"
          monthly={monthly}
          allTime={allTime}
          avatarSize={36}
          emptyMonthly="No XP earned this month yet. Be the first."
          emptyAllTime="No rankings yet. Be the first to earn XP."
        />
      </div>
    </section>
  );
}
