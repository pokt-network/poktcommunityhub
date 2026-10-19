import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LuArrowLeft, LuChevronRight } from "react-icons/lu";
import type { Metadata } from "next";
import { UserQuestHistoryView } from "@/components/user-quest-history-view";
import {
  getManagedUserById,
  getUserLeaderboardRank,
  getUserQuestHistory,
} from "@/lib/db";
import { getSession, requireAdmin } from "@/lib/session";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const session = await getSession();
  if (!session || session.user.role !== "admin") {
    return { title: "Admin Console | Pocket Community Hub" };
  }

  const { id } = await params;
  const user = await getManagedUserById(id);
  if (!user) {
    return { title: "User Not Found | Admin Console" };
  }
  return {
    title: `${user.name} - Quest History | Admin Console`,
    description: `Review completed and rejected quest history for ${user.name} on Pocket Community Hub.`,
  };
}

function HistoryFallback() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-48 animate-pulse rounded bg-white/10" />
      <div className="h-28 animate-pulse rounded-2xl border border-[#1e3a5f] bg-[#0a0f1a]/60" />
      <div className="space-y-3">
        <div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-[#0c121c]" />
        <div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-[#0c121c]" />
      </div>
    </div>
  );
}

async function AdminUserHistoryContent({ params }: PageProps) {
  const [{ id }, session] = await Promise.all([params, requireAdmin()]);

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
    <div className="space-y-5 min-w-0 max-w-full overflow-x-clip">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted min-w-0">
          <Link
            href="/admin"
            className="hover:text-white transition shrink-0"
          >
            Operations
          </Link>
          <LuChevronRight className="h-3 w-3 text-muted/60 shrink-0" />
          <Link
            href="/admin/users"
            className="hover:text-white transition shrink-0"
          >
            Users
          </Link>
          <LuChevronRight className="h-3 w-3 text-muted/60 shrink-0" />
          <span className="text-white font-medium truncate max-w-[140px] sm:max-w-[200px]">
            {managedUser.name}
          </span>
          <LuChevronRight className="h-3 w-3 text-muted/60 shrink-0" />
          <span className="text-[#8eb6ff] shrink-0">Quest History</span>
        </div>

        <Link
          href="/admin/users"
          aria-label="Back to Users"
          title="Back to Users"
          className="self-start sm:self-auto inline-flex h-8 w-8 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] text-xs font-semibold text-muted hover:text-white hover:bg-white/10 transition shrink-0 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5"
        >
          <LuArrowLeft className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Back to Users</span>
        </Link>
      </div>

      <UserQuestHistoryView
        user={profile}
        history={history}
        currentUserId={session.user.id}
        canManage={true}
      />
    </div>
  );
}

export default function AdminUserHistoryPage({ params }: PageProps) {
  return (
    <Suspense fallback={<HistoryFallback />}>
      <AdminUserHistoryContent params={params} />
    </Suspense>
  );
}
