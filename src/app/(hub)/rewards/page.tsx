import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { FaTrophy } from "react-icons/fa";
import { ConnectDiscordGate } from "@/components/connect-discord-gate";
import { listActiveQuestsForUser } from "@/lib/db";
import { getSession } from "@/lib/session";

function RewardsFallback() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <div className="h-64 animate-pulse rounded-[1.75rem] border border-white/10 bg-white/[0.03]" />
    </div>
  );
}

async function RewardsContent() {
  const session = await getSession();

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
        <ConnectDiscordGate
          title="Your rewards await"
          body="Connect Discord to track XP from approved quests, see your submissions, and climb the leaderboard."
          callbackURL="/rewards"
          imageSrc="/xp-chest.png"
          imageAlt="POKT XP reward chest"
        />
      </main>
    );
  }

  const quests = await listActiveQuestsForUser(session.user.id);
  let submitted = 0;
  let approved = 0;
  for (const q of quests) {
    if (!q.submission_status) continue;
    submitted += 1;
    if (q.submission_status === "approved") approved += 1;
  }
  const totalXp = session.user.totalXp ?? 0;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <div className="space-y-6">
        <header>
          <p className="text-sm font-medium text-[#8eb6ff]">Earnings</p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-white">
            Rewards
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            XP from approved quests. Rankings update as reviews land.
          </p>
        </header>

        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0f1a]/70 p-6 sm:p-8">
          <div
            className="pointer-events-none absolute -top-16 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-[#2f6bff]/25 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-center sm:text-left">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">
                Total XP
              </p>
              <p className="font-display mt-2 text-5xl font-semibold tabular-nums text-white sm:text-6xl">
                {totalXp.toLocaleString()}
              </p>
              <p className="mt-3 text-sm text-muted">
                Credited automatically when proofs are approved.
              </p>
            </div>
            <Image
              src="/xp-chest.png"
              alt=""
              width={180}
              height={180}
              className="h-32 w-32 shrink-0 object-contain drop-shadow-[0_0_28px_rgba(26,109,255,0.45)] sm:h-40 sm:w-40"
              priority
            />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#0a0f1a]/70 px-4 py-3.5">
            <p className="text-xs text-muted">Submissions</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
              {submitted}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0a0f1a]/70 px-4 py-3.5">
            <p className="text-xs text-muted">Approved quests</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
              {approved}
            </p>
          </div>
        </section>

        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#8eb6ff] transition hover:text-white"
        >
          <FaTrophy className="h-3.5 w-3.5" aria-hidden />
          See where you rank
        </Link>
      </div>
    </main>
  );
}

export default function RewardsPage() {
  return (
    <Suspense fallback={<RewardsFallback />}>
      <RewardsContent />
    </Suspense>
  );
}
