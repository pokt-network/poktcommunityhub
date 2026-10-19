"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { FaClipboardList, FaTrophy } from "react-icons/fa";
import { LuPackage, LuSwords } from "react-icons/lu";
import type { IconType } from "react-icons";
import { cn } from "@/lib/utils";

type HubPillNavProps = {
  /** Icon-only compact pills (mobile header). */
  iconsOnly?: boolean;
  /** Admins get manager nav instead of ambassador Quests. */
  isAdmin?: boolean;
};

type Tab = {
  key: string;
  label: string;
  href: string;
  match: (pathname: string) => boolean;
  Icon: IconType;
};

const AMBASSADOR_TABS: Tab[] = [
  {
    key: "quests",
    label: "Quests",
    href: "/quests",
    match: (p) => p.startsWith("/quests") || p === "/",
    Icon: LuSwords,
  },
  {
    key: "leaderboard",
    label: "Leaderboard",
    href: "/leaderboard",
    match: (p) => p.startsWith("/leaderboard"),
    Icon: FaTrophy,
  },
  {
    key: "rewards",
    label: "Rewards",
    href: "/rewards",
    match: (p) => p.startsWith("/rewards") || p.startsWith("/dashboard"),
    Icon: LuPackage,
  },
];

const ADMIN_TABS: Tab[] = [
  {
    key: "review",
    label: "Review",
    href: "/admin/review",
    match: (p) => p.startsWith("/admin/review"),
    Icon: FaClipboardList,
  },
  {
    key: "board",
    label: "Board",
    href: "/admin/quests",
    match: (p) => p.startsWith("/admin/quests"),
    Icon: LuSwords,
  },
  {
    key: "leaderboard",
    label: "Leaderboard",
    href: "/leaderboard",
    match: (p) => p.startsWith("/leaderboard"),
    Icon: FaTrophy,
  },
];

export function HubPillNav({
  iconsOnly = false,
  isAdmin = false,
}: HubPillNavProps) {
  const pathname = usePathname();
  const tabs = isAdmin ? ADMIN_TABS : AMBASSADOR_TABS;

  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.match(pathname)),
  );

  return (
    <nav
      aria-label="Hub"
      className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-[#1e3a5f] bg-[#0a0f1a] p-[3px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map(({ key, label, href, Icon }, index) => {
        const active = index === activeIndex;
        return (
          <Link
            key={key}
            href={href}
            title={label}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex items-center justify-center rounded-full font-medium transition-colors duration-200",
              iconsOnly
                ? "h-8 w-8"
                : "h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-[13px] leading-none",
              active ? "text-white" : "text-[#c4c9d4] hover:text-white",
            )}
          >
            {active ? (
              <motion.span
                layoutId={iconsOnly ? "hub-pill-mobile" : "hub-pill-desktop"}
                transition={{
                  type: "spring",
                  stiffness: 450,
                  damping: 32,
                  mass: 0.8,
                }}
                className="absolute inset-0 rounded-full bg-[#2f6bff] shadow-[0_0_20px_rgba(47,107,255,0.55)]"
              />
            ) : null}

            <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
              <Icon
                className={
                  iconsOnly
                    ? "h-3.5 w-3.5 shrink-0"
                    : "h-3.5 w-3.5 shrink-0 sm:h-[15px] sm:w-[15px]"
                }
                aria-hidden
              />
              {!iconsOnly ? (
                <span className="whitespace-nowrap">{label}</span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
