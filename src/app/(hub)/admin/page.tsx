import { Suspense } from "react";
import Link from "next/link";
import { FaClipboardList } from "react-icons/fa";
import { LuAward, LuChevronRight, LuPackage, LuSwords } from "react-icons/lu";
import type { IconType } from "react-icons";
import { getAdminOpsStats } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

function OverviewFallback() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-56 animate-pulse rounded bg-white/10" />
      <div className="h-40 animate-pulse rounded-2xl border border-[#1e3a5f] bg-[#0a0f1a]/60" />
    </div>
  );
}

async function OverviewContent() {
  await requireAdmin();
  const stats = await getAdminOpsStats();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-[#8eb6ff]">Operations</p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-white">
          Manager overview
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Community queue health — review proofs and keep the quest board live.
        </p>
      </header>

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0a0f1a]/80 p-6 sm:p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -top-20 left-1/4 h-56 w-80 -translate-x-1/2 rounded-full bg-[#2f6bff]/20 blur-3xl"
          aria-hidden
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 max-w-md">
            <p className="text-xs font-semibold tracking-wider text-[#8eb6ff] uppercase">
              Pending reviews
            </p>
            <p className="font-display mt-2 text-5xl font-semibold tabular-nums text-white sm:text-6xl">
              {stats.pendingReviews}
            </p>
            <p className="mt-2 text-sm text-muted">
              Submissions waiting for a decision.
            </p>
            <Link
              href="/admin/review"
              className="mt-5 inline-flex h-11 items-center rounded-full bg-[#2f6bff] px-6 text-sm font-semibold text-white shadow-[0_0_24px_rgba(47,107,255,0.4)] transition hover:bg-[#3b82f6]"
            >
              Open review queue →
            </Link>
          </div>

          <div className="flex flex-col gap-3 lg:w-[460px] lg:shrink-0">
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
              <StatCard label="Active quests" value={stats.activeQuests} />
              <StatCard label="Closed quests" value={stats.closedQuests} />
              <StatCard label="Approved today" value={stats.approvedToday} />
            </div>

            <Link
              href="/dashboard?personal=1"
              className="group flex w-full items-center gap-3 rounded-2xl border border-[#2a4a7a] bg-[linear-gradient(135deg,rgba(47,107,255,0.16)_0%,rgba(255,255,255,0.04)_100%)] px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-[#3d6bb0] hover:bg-[#2f6bff]/20 active:scale-[0.99]"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#2f6bff]/20 text-[#8eb6ff] shadow-[0_0_16px_rgba(47,107,255,0.25)]">
                <LuPackage className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold tracking-wide text-white">
                  Ambassador mode
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  Test the flow
                </span>
              </span>
              <LuChevronRight
                className="h-4 w-4 shrink-0 text-[#8eb6ff] transition group-hover:translate-x-0.5 group-hover:text-white"
                aria-hidden
              />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <ActionCard
          href="/admin/review"
          title="Review queue"
          body="Approve or reject pending ambassador proofs."
          Icon={FaClipboardList}
        />
        <ActionCard
          href="/admin/quests"
          title="Manage quests"
          body="Create, edit, or close tasks on the board."
          Icon={LuSwords}
        />
        <ActionCard
          href="/admin/roles"
          title="Server roles"
          body="Configure achievement roles and assign ranks."
          Icon={LuAward}
        />
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md sm:p-4">
      <p className="text-[11px] font-medium text-muted uppercase tracking-wider">{label}</p>
      <p className="font-display mt-1.5 text-2xl font-semibold tabular-nums text-white sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

function ActionCard({
  href,
  title,
  body,
  Icon,
}: {
  href: string;
  title: string;
  body: string;
  Icon: IconType;
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border border-white/10 bg-[#0a0f1a]/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl transition hover:border-[#2f6bff]/50 hover:bg-[#0a0f1a]/90"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#2f6bff]/20 text-[#8eb6ff] shadow-[0_0_20px_rgba(47,107,255,0.25)]">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <p className="font-display text-base font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
      <span className="mt-3 inline-block text-sm font-semibold text-[#8eb6ff] transition group-hover:text-white">
        Open →
      </span>
    </Link>
  );
}

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<OverviewFallback />}>
      <OverviewContent />
    </Suspense>
  );
}
