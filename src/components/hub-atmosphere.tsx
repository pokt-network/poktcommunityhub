"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Soft hero bloom — animated on marketing pages, static + dim on app shells. */
export function HubAtmosphere() {
  const pathname = usePathname();
  const dimAppShell =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/quests") ||
    pathname.startsWith("/leaderboard") ||
    pathname.startsWith("/rewards");

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-0 h-dvh overflow-hidden"
      aria-hidden
    >
      <div
        className={cn(
          "bg-hero-glow absolute inset-0",
          dimAppShell ? "opacity-25" : "animate-hub-pulse",
        )}
      />
    </div>
  );
}
