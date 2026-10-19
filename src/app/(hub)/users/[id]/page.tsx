import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LuArrowLeft, LuChevronRight } from "react-icons/lu";
import type { Metadata } from "next";
import { UserQuestHistoryView } from "@/components/user-quest-history-view";
import {
  getManagedUserById,
  getUserLeaderboardRank,
  getUserQuestHistory,
} from "@/lib/db";
import { getSession } from "@/lib/session";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession();
  const canView =
    session &&
    (session.user.role === "admin" || session.user.id === id);

  if (!canView) {
    return { title: "Quest History | Pocket Community Hub" };
  }

  const user = await getManagedUserById(id);
  if (!user) {
    return { title: "User Not Found | Pocket Community Hub" };
  }
  return {
    title: `${user.name} - Quest History | Pocket Community Hub`,
    description: `View quest history, achievements, and approvals for ${user.name} on the Pocket Community Hub.`,
  };
}

function UserHistoryFallback() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      <div className="h-6 w-48 animate-pulse rounded bg-white/10" />
      <div className="h-28 animate-pulse rounded-2xl border border-[#1e3a5f] bg-[#0a0f1a]/60" />
      <div className="space-y-3">
        <div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-[#0c121c]" />
        <div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-[#0c121c]" />
      </div>
    </main>
  );
}

async function UserHistoryContent({ params }: PageProps) {
  const [{ id }, session] = await Promise.all([params, getSession()]);

  if (!session) {
    redirect("/");
  }

  const isAdmin = session.user.role === "admin";
  const isSelf = session.user.id === id;
  if (!isAdmin && !isSelf) {
    notFound();
  }

  const [managedUser, rank, history] = await Promise.all([
    getManagedUserById(id),
    getUserLeaderboardRank(id),
    getUserQuestHistory(id),
  ]);

  if (!managedUser) {
    notFound();
  }

  const profile = {
    id: managedUser.id,
    name: managedUser.name,
    email: managedUser.email,
    image: managedUser.image,
    role: managedUser.role,
    totalXp: managedUser.totalXp,
    discordId: managedUser.discordId,
    createdAt:
      managedUser.createdAt instanceof Date
        ? managedUser.createdAt.toISOString()
        : String(managedUser.createdAt),
    pendingCount: managedUser.pendingCount,
    approvedCount: managedUser.approvedCount,
    rejectedCount: managedUser.rejectedCount,
    leaderboardRank: rank,
    roles: managedUser.roles ?? [],
  };

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8 space-y-6 min-w-0 overflow-x-clip">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted min-w-0">
          <Link
            href={isAdmin && !isSelf ? "/admin/users" : "/leaderboard"}
            className="hover:text-white transition shrink-0"
          >
            {isAdmin && !isSelf ? "Users" : "Leaderboard"}
          </Link>
          <LuChevronRight className="h-3 w-3 text-muted/60 shrink-0" />
          <span className="text-white font-medium truncate max-w-[140px] sm:max-w-[200px]">
            {managedUser.name}
          </span>
          <LuChevronRight className="h-3 w-3 text-muted/60 shrink-0" />
          <span className="text-[#8eb6ff] shrink-0">Quest History</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Link
            href={isAdmin && !isSelf ? "/admin/users" : "/leaderboard"}
            aria-label={
              isAdmin && !isSelf ? "Back to Users" : "Back to Leaderboard"
            }
            title={isAdmin && !isSelf ? "Back to Users" : "Back to Leaderboard"}
            className="inline-flex h-8 w-8 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] text-xs font-semibold text-muted hover:text-white hover:bg-white/10 transition shrink-0 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5"
          >
            <LuArrowLeft className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">
              {isAdmin && !isSelf ? "Back to Users" : "Back to Leaderboard"}
            </span>
          </Link>

          {isAdmin ? (
            <Link
              href={`/admin/users/${managedUser.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-[#8eb6ff] hover:bg-primary/20 hover:text-white transition shrink-0 sm:h-auto sm:py-1.5"
            >
              <span>Manager console view</span>
            </Link>
          ) : null}
        </div>
      </div>

      <UserQuestHistoryView
        user={profile}
        history={history}
        currentUserId={session.user.id}
        canManage={isAdmin}
      />
    </main>
  );
}

export default function UserHistoryPage({ params }: PageProps) {
  return (
    <Suspense fallback={<UserHistoryFallback />}>
      <UserHistoryContent params={params} />
    </Suspense>
  );
}
