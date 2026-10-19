import { Suspense } from "react";
import { DiscordLoginButton } from "@/components/discord-login-button";
import { LeaderboardBoard } from "@/components/leaderboard-board";
import {
  getUserLeaderboardRank,
  getUserMonthlyLeaderboardRank,
  listLeaderboard,
  listMonthlyLeaderboard,
} from "@/lib/db";
import { getSession } from "@/lib/session";

const LEADERBOARD_LIMIT = 20;

function LeaderboardFallback() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
      <div className="mt-8 h-64 animate-pulse rounded-2xl border border-border bg-card/50" />
    </div>
  );
}

async function LeaderboardContent() {
  const session = await getSession();
  const [allTime, monthly, rankAllTime, rankMonthly] = await Promise.all([
    listLeaderboard(LEADERBOARD_LIMIT),
    listMonthlyLeaderboard(LEADERBOARD_LIMIT),
    session ? getUserLeaderboardRank(session.user.id) : Promise.resolve(null),
    session
      ? getUserMonthlyLeaderboardRank(session.user.id)
      : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="mt-2 text-muted">
            Top {LEADERBOARD_LIMIT} ambassadors by XP — monthly or all time.
          </p>
        </div>
        {!session ? (
          <DiscordLoginButton
            callbackURL="/leaderboard"
            label="Connect Discord"
            className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-hover"
          />
        ) : null}
      </div>

      <LeaderboardBoard
        monthly={monthly}
        allTime={allTime}
        currentUserId={session?.user.id}
        canViewOthersHistory={session?.user.role === "admin"}
        currentUserRankAllTime={rankAllTime}
        currentUserRankMonthly={rankMonthly}
      />
    </main>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LeaderboardFallback />}>
      <LeaderboardContent />
    </Suspense>
  );
}
