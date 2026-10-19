import { Suspense } from "react";
import { UserManagement } from "@/components/user-management";
import { listManagedUsers } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

function UsersFallback() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 animate-pulse rounded bg-white/10" />
      <div className="h-40 animate-pulse rounded-2xl border border-[#1e3a5f] bg-[#0a0f1a]/60" />
    </div>
  );
}

async function UsersContent() {
  const session = await requireAdmin();
  const users = await listManagedUsers();

  return (
    <UserManagement
      currentUserId={session.user.id}
      currentUserEmail={session.user.email}
      users={users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        totalXp: user.totalXp,
        discordId: user.discordId,
        pendingCount: user.pendingCount,
        approvedCount: user.approvedCount,
        rejectedCount: user.rejectedCount,
        createdAt:
          user.createdAt instanceof Date
            ? user.createdAt.toISOString()
            : String(user.createdAt),
      }))}
    />
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<UsersFallback />}>
      <UsersContent />
    </Suspense>
  );
}
