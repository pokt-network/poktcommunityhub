import type { ReactNode } from "react";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/session";

function AdminShellFallback() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:flex-row lg:gap-8 lg:py-10">
      <div className="h-48 w-full animate-pulse rounded-2xl border border-[#1e3a5f] bg-[#0a0f1a]/50 lg:w-60" />
      <div className="h-64 min-w-0 flex-1 animate-pulse rounded-2xl border border-[#1e3a5f] bg-[#0a0f1a]/50" />
    </div>
  );
}

function AdminPageFallback() {
  return (
    <div className="h-64 min-w-0 animate-pulse rounded-2xl border border-[#1e3a5f] bg-[#0a0f1a]/50" />
  );
}

async function AdminLayoutContent({ children }: { children: ReactNode }) {
  const session = await requireAdmin();

  return (
    <AdminShell
      user={{
        name: session.user.name,
        image: session.user.image ?? null,
      }}
    >
      <Suspense fallback={<AdminPageFallback />}>{children}</Suspense>
    </AdminShell>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AdminShellFallback />}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}
