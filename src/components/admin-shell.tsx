"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  LuAward,
  LuClipboardList,
  LuLayoutDashboard,
  LuLogOut,
  LuPackage,
  LuSwords,
  LuUsers,
} from "react-icons/lu";
import type { IconType } from "react-icons";
import { motion } from "motion/react";
import { UserAvatar } from "@/components/user-avatar";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type AdminShellProps = {
  user: {
    name: string;
    image: string | null;
  };
  children: ReactNode;
};

const TABS: {
  key: string;
  label: string;
  shortLabel: string;
  href: string;
  match: (pathname: string) => boolean;
  Icon: IconType;
}[] = [
  {
    key: "overview",
    label: "Overview",
    shortLabel: "Home",
    href: "/admin",
    match: (p) => p === "/admin",
    Icon: LuLayoutDashboard,
  },
  {
    key: "review",
    label: "Review queue",
    shortLabel: "Review",
    href: "/admin/review",
    match: (p) => p.startsWith("/admin/review"),
    Icon: LuClipboardList,
  },
  {
    key: "quests",
    label: "Manage quests",
    shortLabel: "Board",
    href: "/admin/quests",
    match: (p) => p.startsWith("/admin/quests"),
    Icon: LuSwords,
  },
  {
    key: "roles",
    label: "Server roles",
    shortLabel: "Roles",
    href: "/admin/roles",
    match: (p) => p.startsWith("/admin/roles"),
    Icon: LuAward,
  },
  {
    key: "users",
    label: "Users",
    shortLabel: "Users",
    href: "/admin/users",
    match: (p) => p.startsWith("/admin/users"),
    Icon: LuUsers,
  },
];

export function AdminShell({ user, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:flex-row lg:gap-8 lg:py-10 lg:pb-10">
        {/* Desktop sidebar */}
        <aside className="hidden shrink-0 lg:block lg:w-60">
          <div className="rounded-2xl border border-[#1e3a5f] bg-[#0a0f1a]/90 p-2 lg:sticky lg:top-24">
            <div className="mb-3 flex items-center gap-3 px-2.5 py-2">
              <UserAvatar name={user.name} src={user.image} size={36} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {user.name}
                </p>
                <p className="text-[11px] font-semibold tracking-wide text-accent uppercase">
                  Manager console
                </p>
              </div>
            </div>

            <nav aria-label="Manager" className="flex flex-col gap-1">
              {TABS.map(({ key, label, href, match, Icon }) => {
                const active = match(pathname);
                return (
                  <Link
                    key={key}
                    href={href}
                    className={cn(
                      "relative inline-flex w-full items-center gap-2.5 rounded-full px-3.5 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "text-white"
                        : "text-muted hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="admin-sidebar-active"
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
                  </Link>
                );
              })}

              <Link
                href="/dashboard?personal=1"
                className="mt-2 inline-flex w-full items-center gap-2.5 rounded-full px-3.5 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-white"
              >
                <LuPackage className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">Personal hub</span>
              </Link>

              <button
                type="button"
                onClick={async () => {
                  const supabase = createBrowserSupabaseClient();
                  await supabase.auth.signOut();
                  router.push("/");
                  router.refresh();
                }}
                className="inline-flex w-full items-center gap-2.5 rounded-full px-3.5 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-white"
              >
                <LuLogOut className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">Sign out</span>
              </button>
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>

      {/* Mobile bottom tabs */}
      <nav
        aria-label="Manager"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[#1e3a5f] bg-[#0a0f1a] px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around gap-1">
          {TABS.map(({ key, shortLabel, href, match, Icon }) => {
            const active = match(pathname);
            return (
              <Link
                key={key}
                href={href}
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
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
