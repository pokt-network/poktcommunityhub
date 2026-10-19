"use client";

import Image from "next/image";
import { FaShieldAlt } from "react-icons/fa";
import { ServerRoleBadge } from "@/components/server-role-badge";
import { UserAvatar } from "@/components/user-avatar";
import type { ServerRole, ServerRoleSummary } from "@/lib/db";
import { cn } from "@/lib/utils";

export type PoktProfileCardProps = {
  user?: {
    name: string;
    image: string | null;
    totalXp: number;
    discordId?: string | null;
  };
  roles?: ServerRoleSummary[];
  nextRole?: ServerRole | null;
  completedCount?: number;
  submittedCount?: number;
  leaderboardRank?: number | null;
  className?: string;
};

const DEFAULT_USER = {
  name: "basit100",
  image: null,
  totalXp: 150,
  discordId: "basit100",
};

const DEFAULT_ROLE: ServerRoleSummary = {
  id: "default-role",
  name: "Node Scout",
  color: "#3b82f6",
  xp_required: 100,
};

export function PoktProfileCard({
  user = DEFAULT_USER,
  roles = [DEFAULT_ROLE],
  nextRole,
  completedCount = 1,
  submittedCount = 1,
  leaderboardRank = 1,
  className,
}: PoktProfileCardProps) {
  const currentRole = roles.length > 0 ? roles[roles.length - 1] : DEFAULT_ROLE;
  const primaryColor = currentRole?.color || "#2f6bff";

  const targetNextRole =
    nextRole ??
    ({
      id: "demo-next",
      name: "Relay Runner",
      description: "Proven relay contributor",
      xp_required: 300,
      color: "#5865F2",
      icon: null,
      position: 2,
      member_count: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ServerRole);

  const xpProgress = targetNextRole
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((user.totalXp - (currentRole?.xp_required ?? 0)) /
              (targetNextRole.xp_required - (currentRole?.xp_required ?? 0))) *
              100,
          ),
        ),
      )
    : 100;

  return (
    <div
      className={cn(
        "relative w-[340px] sm:w-[380px] overflow-hidden rounded-[26px] border border-white/15 bg-[#070b16] p-5 shadow-[0_0_60px_rgba(47,107,255,0.3),inset_0_1px_1px_rgba(255,255,255,0.25)] select-none text-white",
        className,
      )}
      style={{
        boxShadow: `0 0 60px ${primaryColor}40, inset 0 1px 1px rgba(255,255,255,0.25)`,
      }}
    >
      {/* Dynamic ambient background glow */}
      <div
        className="pointer-events-none absolute -top-24 -left-16 h-56 w-56 rounded-full blur-3xl opacity-60"
        style={{ backgroundColor: primaryColor }}
      />
      <div className="pointer-events-none absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-[#2f6bff]/25 blur-3xl" />

      {/* Cyber circuit grid texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"
        aria-hidden
      />

      {/* Top Header: Logo & Card Pill */}
      <div className="relative flex items-center justify-between border-b border-white/10 pb-3.5">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Pocket-Logo-White.svg"
            alt="Pocket Network"
            className="h-5 w-auto"
          />
          <span className="font-display text-xs font-semibold tracking-wider text-slate-300 uppercase">
            Pass
          </span>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold tracking-wider text-[#8eb6ff] uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          Verified Ambassador
        </div>
      </div>

      {/* Profile Identity Row */}
      <div className="relative mt-4 flex items-center gap-3.5">
        <div className="relative">
          <div
            className="absolute -inset-1 rounded-full opacity-70 blur-sm"
            style={{ backgroundColor: primaryColor }}
          />
          <div className="relative rounded-full ring-2 ring-white/20">
            <UserAvatar name={user.name} src={user.image} size={54} />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-display truncate text-lg font-bold tracking-tight text-white">
            {user.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {roles.map((r) => (
              <ServerRoleBadge key={r.id} role={r} size="xs" />
            ))}
          </div>
        </div>
      </div>

      {/* Centerpiece: XP Badge with number inside slot & Total XP Showcase */}
      <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-3.5 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold tracking-widest text-[#8eb6ff] uppercase">
              Accumulated XP
            </p>
            <p className="font-display mt-0.5 text-3xl font-extrabold tabular-nums tracking-tight text-white sm:text-4xl drop-shadow-[0_0_18px_rgba(47,107,255,0.4)]">
              {user.totalXp.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              Official Network Contribution Points
            </p>
          </div>

          <div className="relative h-24 w-24 shrink-0 flex items-center justify-center">
            {/* XP Badge Artwork */}
            <Image
              src="/pokt-xp-badge.png"
              alt="POKT XP Badge"
              width={96}
              height={96}
              className="h-full w-full object-contain drop-shadow-[0_0_20px_rgba(47,107,255,0.6)]"
              priority
            />
            {/* XP Number overlay positioned directly inside the badge bottom pill slot */}
            <div className="pointer-events-none absolute inset-x-0 bottom-[14%] flex items-center justify-center">
              <span className="font-display font-extrabold text-xs text-white tabular-nums tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                {user.totalXp.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Milestone Progression inside card */}
        {targetNextRole ? (
          <div className="mt-3 border-t border-white/10 pt-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted">
                Next:{" "}
                <span className="font-semibold text-white">
                  {targetNextRole.name}
                </span>
              </span>
              <span className="font-mono text-[#8eb6ff] font-semibold">
                {Math.max(0, targetNextRole.xp_required - user.totalXp).toLocaleString()} XP to unlock
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${xpProgress}%`,
                  backgroundColor: targetNextRole.color || primaryColor,
                  boxShadow: `0 0 10px ${targetNextRole.color || primaryColor}`,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom Mini Metrics Bar: Completed, Submitted, Leaderboard */}
      <div className="relative mt-3.5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2">
          <p className="text-[10px] text-muted uppercase tracking-wider">Completed</p>
          <p className="font-display mt-0.5 text-sm font-bold text-emerald-400">
            {completedCount}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2">
          <p className="text-[10px] text-muted uppercase tracking-wider">Submitted</p>
          <p className="font-display mt-0.5 text-sm font-bold text-[#8eb6ff]">
            {submittedCount}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2">
          <p className="text-[10px] text-muted uppercase tracking-wider">Leaderboard</p>
          <p className="font-display mt-0.5 text-sm font-bold text-amber-300">
            {leaderboardRank != null ? `#${leaderboardRank}` : "#--"}
          </p>
        </div>
      </div>

      {/* Footer Strip */}
      <div className="relative mt-4 flex items-center justify-between border-t border-white/10 pt-2.5 text-[10px] font-mono text-muted">
        <div className="flex items-center gap-1.5">
          <FaShieldAlt className="h-3 w-3 text-[#2f6bff]" />
          <span>SHANNON UPGRADE READY</span>
        </div>
        <span className="text-white/40">POKT • HUB 2026</span>
      </div>
    </div>
  );
}
