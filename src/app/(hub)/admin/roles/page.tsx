import { Suspense } from "react";
import { RoleManagement } from "@/components/role-management";
import { listAllQuests, listManagedUsers, listServerRoles } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

function RolesFallback() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
      <div className="h-48 animate-pulse rounded-2xl border border-[#1e3a5f] bg-[#0a0f1a]/60" />
    </div>
  );
}

async function RolesContent() {
  const session = await requireAdmin();
  const [roles, users, quests] = await Promise.all([
    listServerRoles(),
    listManagedUsers(),
    listAllQuests(),
  ]);

  return (
    <RoleManagement
      roles={roles}
      users={users}
      quests={quests}
      currentUserId={session.user.id}
    />
  );
}

export default function AdminRolesPage() {
  return (
    <Suspense fallback={<RolesFallback />}>
      <RolesContent />
    </Suspense>
  );
}
