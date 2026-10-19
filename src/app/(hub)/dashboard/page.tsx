import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  getUserLeaderboardRank,
  listActiveQuestsForUser,
  listRolesForUser,
  listServerRoles,
} from "@/lib/db";
import { toQuestListItem } from "@/lib/quest-filters";
import { requireSession } from "@/lib/session";

function DashboardFallback() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:flex-row lg:gap-8 lg:py-10">
      <div className="h-48 w-full animate-pulse rounded-2xl border border-white/10 bg-[#0a0f1a]/50 lg:w-56" />
      <div className="h-64 min-w-0 flex-1 animate-pulse rounded-2xl border border-white/10 bg-[#0a0f1a]/50" />
    </main>
  );
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<{ personal?: string }>;
}) {
  const [session, params] = await Promise.all([
    requireSession(),
    searchParams,
  ]);
  const { user } = session;

  if (user.role === "admin" && params.personal !== "1") {
    redirect("/admin");
  }

  const [quests, userRoles, allRoles, leaderboardRank] = await Promise.all([
    listActiveQuestsForUser(user.id),
    listRolesForUser(user.id),
    listServerRoles(),
    getUserLeaderboardRank(user.id),
  ]);

  return (
    <DashboardShell
      user={{
        id: user.id,
        name: user.name,
        image: user.image ?? null,
        role: user.role ?? "ambassador",
        totalXp: user.totalXp ?? 0,
        discordId: user.discordId ?? null,
      }}
      roles={userRoles}
      allRoles={allRoles}
      quests={quests.map(toQuestListItem)}
      leaderboardRank={leaderboardRank}
    />
  );
}

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ personal?: string }>;
}) {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}
