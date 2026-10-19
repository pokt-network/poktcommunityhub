"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { FaTrophy } from "react-icons/fa";
import {
  LuChevronRight,
  LuHistory,
  LuIdCard,
  LuLayoutDashboard,
  LuLogOut,
  LuPackage,
  LuSwords,
  LuX,
} from "react-icons/lu";
import type { IconType } from "react-icons";
import { useRouter } from "next/navigation";
import { CometCardDemo } from "@/components/comet-card-demo";
import { ServerRoleBadge } from "@/components/server-role-badge";
import { UserAvatar } from "@/components/user-avatar";
import type { ServerRole, ServerRoleSummary } from "@/lib/db";
import type { QuestListItem } from "@/lib/quest-filters";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type DashboardQuest = QuestListItem;

const AmbassadorQuests = dynamic(
  () =>
    import("@/components/ambassador-quests").then((m) => m.AmbassadorQuests),
  {
    loading: () => (
      <div className="h-48 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
    ),
  },
);

export type DashboardUser = {
  id?: string;
  name: string;
  image: string | null;
  role: string;
  totalXp: number;
  discordId: string | null;
};

type TabKey = "overview" | "quests" | "rewards";

type DashboardShellProps = {
  user: DashboardUser;
  quests: DashboardQuest[];
  roles?: ServerRoleSummary[];
  allRoles?: ServerRole[];
  leaderboardRank?: number | null;
};

export function DashboardShell({
  user,
  quests,
  roles = [],
  allRoles = [],
  leaderboardRank,
}: DashboardShellProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("overview");

  const { submitted, approved, pending } = useMemo(() => {
    let submittedCount = 0;
    let approvedCount = 0;
    let pendingCount = 0;
    for (const q of quests) {
      if (!q.submission_status) continue;
      submittedCount += 1;
      if (q.submission_status === "approved") approvedCount += 1;
      if (q.submission_status === "pending") pendingCount += 1;
    }
    return {
      submitted: submittedCount,
      approved: approvedCount,
      pending: pendingCount,
    };
  }, [quests]);

  const tabs: {
    key: TabKey;
    label: string;
    shortLabel: string;
    Icon: IconType;
  }[] = [
      {
        key: "overview",
        label: "Overview",
        shortLabel: "Home",
        Icon: LuLayoutDashboard,
      },
      {
        key: "quests",
        label: "My Quests",
        shortLabel: "Quests",
        Icon: LuSwords,
      },
      {
        key: "rewards",
        label: "Rewards",
        shortLabel: "Rewards",
        Icon: LuPackage,
      },
    ];

  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:flex-row lg:gap-8 lg:py-10 lg:pb-10">
        {/* Desktop sidebar */}
        <aside className="hidden shrink-0 lg:block lg:w-56">
          <div className="rounded-2xl border border-[#1e3a5f] bg-[#0a0f1a]/90 p-2 lg:sticky lg:top-24">
            <Link
              href={`/users/${user.id}`}
              className="mb-2 flex items-center gap-3 px-2.5 py-2 rounded-xl transition hover:bg-white/5 group"
              title="View your quest history page"
            >
              <div className="shrink-0 transition-transform group-hover:scale-105">
                <UserAvatar name={user.name} src={user.image} size={36} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white group-hover:text-primary transition-colors">
                  {user.name}
                </p>
                <p className="text-[11px] text-[#8eb6ff] truncate">Quest history &rarr;</p>
              </div>
            </Link>

            <nav aria-label="Dashboard" className="flex flex-col gap-1">
              {tabs.map(({ key, label, Icon }) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={cn(
                      "relative inline-flex w-full items-center gap-2.5 rounded-full px-3.5 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "text-white"
                        : "text-muted hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="dashboard-sidebar-active"
                        transition={{
                          type: "spring",
                          stiffness: 450,
                          damping: 32,
                          mass: 0.8,
                        }}
                        className="absolute inset-0 rounded-full bg-primary shadow-[0_0_20px_rgba(26,109,255,0.55)]"
                      />
                    ) : null}
                    <span className="relative z-10 flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="whitespace-nowrap">{label}</span>
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={async () => {
                  const supabase = createBrowserSupabaseClient();
                  await supabase.auth.signOut();
                  router.push("/");
                  router.refresh();
                }}
                className="mt-1 inline-flex w-full items-center gap-2.5 rounded-full px-3.5 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-white"
              >
                <LuLogOut className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">Sign out</span>
              </button>
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {tab === "overview" ? (
            <OverviewPanel
              user={user}
              roles={roles}
              allRoles={allRoles}
              approvedCount={approved}
              submittedCount={submitted}
              pendingCount={pending}
              questCount={quests.length}
              leaderboardRank={leaderboardRank}
              onSignOut={async () => {
                const supabase = createBrowserSupabaseClient();
                await supabase.auth.signOut();
                router.push("/");
                router.refresh();
              }}
            />
          ) : null}

          {tab === "quests" ? <QuestsPanel quests={quests} /> : null}

          {tab === "rewards" ? (
            <RewardsPanel
              totalXp={user.totalXp}
              roles={roles}
              allRoles={allRoles}
              approvedCount={approved}
              submittedCount={submitted}
            />
          ) : null}
        </div>
      </main>

      {/* Mobile bottom tabs */}
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[#1e3a5f] bg-[#0a0f1a] px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around gap-1">
          {tabs.map(({ key, shortLabel, Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={
                  active
                    ? "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl bg-primary/20 px-2 py-2 text-primary"
                    : "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-muted"
                }
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="truncate text-[11px] font-semibold">
                  {shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function OverviewPanel({
  user,
  roles = [],
  allRoles = [],
  approvedCount,
  submittedCount,
  pendingCount,
  questCount,
  leaderboardRank,
  onSignOut,
}: {
  user: DashboardUser;
  roles?: ServerRoleSummary[];
  allRoles?: ServerRole[];
  approvedCount: number;
  submittedCount: number;
  pendingCount: number;
  questCount: number;
  leaderboardRank?: number | null;
  onSignOut: () => void | Promise<void>;
}) {
  const [showCardModal, setShowCardModal] = useState(false);
  const nextRole = allRoles.find((r) => r.xp_required > user.totalXp);
  const currentRole = roles.length > 0 ? roles[roles.length - 1] : null;

  const xpProgress = nextRole
    ? Math.min(
      100,
      Math.max(
        0,
        Math.round(
          ((user.totalXp - (currentRole?.xp_required ?? 0)) /
            (nextRole.xp_required - (currentRole?.xp_required ?? 0))) *
          100,
        ),
      ),
    )
    : 100;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-[#8eb6ff]">My Rewards</p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-white">
          Overview
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Your ambassador profile, XP, and quick paths into the hub.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-[#0a0f1a]/70 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
            <UserAvatar name={user.name} src={user.image} size={56} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display min-w-0 truncate text-lg font-semibold text-white sm:text-xl">
                  {user.name}
                </h2>
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-2.5 text-[11px] font-semibold text-muted transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white lg:hidden"
                >
                  <LuLogOut className="h-3.5 w-3.5" aria-hidden />
                  Log out
                </button>
              </div>

              {roles.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {roles.map((r) => (
                    <ServerRoleBadge key={r.id} role={r} size="xs" />
                  ))}
                </div>
              ) : null}

              {nextRole ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted">Next milestone:</span>
                  <ServerRoleBadge role={nextRole} size="xs" showXp />
                  <span className="font-semibold tabular-nums text-[#8eb6ff]">
                    • {(nextRole.xp_required - user.totalXp).toLocaleString()} XP
                    to unlock
                  </span>
                </div>
              ) : allRoles.length > 0 ? (
                <p className="mt-2 text-xs font-semibold text-amber-300">
                  ✦ All server roles unlocked! You have reached the pinnacle
                  rank.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 w-full lg:w-auto lg:shrink-0">
            <button
              type="button"
              onClick={() => setShowCardModal(true)}
              className="group flex w-full items-center gap-2.5 rounded-xl border border-[#2a4a7a] bg-[linear-gradient(135deg,rgba(26,109,255,0.16)_0%,rgba(10,15,26,0.92)_50%,rgba(10,15,26,0.96)_100%)] px-3 py-2 text-left transition hover:border-[#3d6bb0] active:scale-[0.99] lg:w-auto lg:max-w-[15.5rem] lg:py-1.5"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-[#8eb6ff] lg:h-7 lg:w-7">
                <LuIdCard className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold tracking-wide text-white lg:text-xs">
                  Pokt Pass
                </span>
                <span className="mt-0.5 block text-[11px] text-muted lg:text-[10px]">
                  View your card
                </span>
              </span>
              <LuChevronRight
                className="h-3.5 w-3.5 shrink-0 text-[#8eb6ff] transition group-hover:translate-x-0.5"
                aria-hidden
              />
            </button>

            {user.id ? (
              <Link
                href={`/users/${user.id}`}
                className="group flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition hover:border-primary/40 hover:bg-white/[0.08] active:scale-[0.99] lg:w-auto lg:max-w-[15.5rem] lg:py-1.5"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-[#8eb6ff] lg:h-7 lg:w-7">
                  <LuHistory className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold tracking-wide text-white lg:text-xs">
                    Quest History
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted lg:text-[10px]">
                    Approvals & reviews
                  </span>
                </span>
                <LuChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-[#8eb6ff] transition group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            ) : null}
          </div>
        </div>

        {nextRole ? (
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
              <span>Milestone progress</span>
              <span className="font-semibold text-white tabular-nums">
                {xpProgress}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${xpProgress}%`,
                  backgroundColor: nextRole.color || "#3b82f6",
                  boxShadow: `0 0 12px ${nextRole.color || "#3b82f6"}80`,
                }}
              />
            </div>
          </div>
        ) : null}
      </section>

      {/* Comet Card Modal */}
      {showCardModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl"
          onClick={() => setShowCardModal(false)}
        >
          <div
            className="relative flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowCardModal(false)}
              aria-label="Close"
              className="absolute -top-12 right-0 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 hover:scale-105"
            >
              <LuX className="h-4 w-4" />
            </button>

            <CometCardDemo
              user={user}
              roles={roles}
              nextRole={nextRole}
              completedCount={approvedCount}
              submittedCount={submittedCount}
              leaderboardRank={leaderboardRank}
            />
          </div>
        </div>
      ) : null}

      {/* Stats with Total XP unified in one single card */}
      <section className="rounded-2xl border border-white/10 bg-[#0a0f1a]/70 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-white/10">
          <div className="sm:px-5 first:sm:pl-0">
            <p className="text-xs font-medium text-muted">Total XP</p>
            <p className="font-display mt-1 text-2xl font-semibold tabular-nums text-white sm:text-3xl">
              {user.totalXp.toLocaleString()}
            </p>
          </div>
          <div className="sm:px-5">
            <p className="text-xs font-medium text-muted">Active quests</p>
            <p className="font-display mt-1 text-2xl font-semibold tabular-nums text-white sm:text-3xl">
              {questCount}
            </p>
          </div>
          <div className="sm:px-5">
            <p className="text-xs font-medium text-muted">Pending review</p>
            <p className="font-display mt-1 text-2xl font-semibold tabular-nums text-white sm:text-3xl">
              {pendingCount}
            </p>
          </div>
          <div className="sm:px-5 last:sm:pr-0">
            <p className="text-xs font-medium text-muted">Approved</p>
            <p className="font-display mt-1 text-2xl font-semibold tabular-nums text-white sm:text-3xl">
              {approvedCount}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <QuickLink
          href="/quests"
          title="Enter Quests"
          body="Browse active tasks and submit proof."
          Icon={LuSwords}
        />
        <QuickLink
          href="/leaderboard"
          title="View Leaderboard"
          body="See live ambassador XP rankings."
          Icon={FaTrophy}
        />
      </section>
    </div>
  );
}

function QuestsPanel({ quests }: { quests: DashboardQuest[] }) {
  const submitted = quests.filter((q) => q.submission_status != null);

  return (
    <AmbassadorQuests
      quests={submitted}
      variant="grid"
      eyebrow="Activity"
      title="My Quests"
      subtitle="Track submissions and jump back into open tasks."
      emptyTitle="No submissions yet"
      emptyBody="Browse all quests to start one and submit proof."
      backLabel="Back to My Quests"
      authenticated
      headerAction={
        <Link
          href="/quests"
          className="inline-flex h-10 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-background transition hover:bg-white/90 sm:w-auto"
        >
          Browse all
        </Link>
      }
    />
  );
}

function RewardsPanel({
  totalXp,
  roles = [],
  allRoles = [],
  approvedCount,
  submittedCount,
}: {
  totalXp: number;
  roles?: ServerRoleSummary[];
  allRoles?: ServerRole[];
  approvedCount: number;
  submittedCount: number;
}) {
  return (
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
        <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
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
            width={160}
            height={160}
            className="h-28 w-28 shrink-0 object-contain drop-shadow-[0_0_24px_rgba(26,109,255,0.4)] sm:h-36 sm:w-36"
          />
        </div>
      </section>

      {/* Community Role Roadmap */}
      {allRoles.length > 0 ? (
        <section className="rounded-2xl border border-white/10 bg-[#0a0f1a]/70 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              Achievement roles & milestones
            </h2>
            <span className="text-xs text-muted">
              {roles.length} of {allRoles.length} unlocked
            </span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {allRoles.map((r) => {
              const isUnlocked = roles.some((ur) => ur.id === r.id);
              return (
                <div
                  key={r.id}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-3 transition",
                    isUnlocked
                      ? "border-white/15 bg-white/[0.04]"
                      : "border-white/5 bg-white/[0.01] opacity-60",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ServerRoleBadge role={r} size="xs" />
                    <span className="text-xs text-muted">
                      {r.xp_required === 0 ? "Special role" : `${r.xp_required.toLocaleString()} XP`}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-semibold",
                      isUnlocked ? "text-success" : "text-muted",
                    )}
                  >
                    {isUnlocked ? "Unlocked ✓" : "Locked"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <StatBox label="Submissions" value={String(submittedCount)} />
        <StatBox label="Approved quests" value={String(approvedCount)} />
      </section>

      <Link
        href="/leaderboard"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#8eb6ff] transition hover:text-white"
      >
        <FaTrophy className="h-3.5 w-3.5" aria-hidden />
        See where you rank
      </Link>
    </div>
  );
}

function StatBox({
  label,
  value,
  capitalize,
  compact,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "rounded-xl border border-white/10 bg-[#0a0f1a]/70 px-2.5 py-2.5 sm:px-3 sm:py-3"
          : "rounded-2xl border border-white/10 bg-[#0a0f1a]/70 px-4 py-3.5"
      }
    >
      <p
        className={
          compact
            ? "text-[10px] leading-tight text-muted sm:text-xs"
            : "text-xs text-muted"
        }
      >
        {label}
      </p>
      <p
        className={
          compact
            ? `mt-0.5 text-lg font-semibold tabular-nums text-white sm:text-xl ${capitalize ? "capitalize" : ""
            }`
            : `mt-1 text-2xl font-semibold tabular-nums text-white ${capitalize ? "capitalize" : ""
            }`
        }
      >
        {value}
      </p>
    </div>
  );
}

function QuickLink({
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
      className="group rounded-2xl border border-white/10 bg-[#0a0f1a]/70 p-5 transition hover:border-[#2f6bff]/50"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-glow text-white shadow-[0_0_24px_rgba(26,109,255,0.45)]">
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
