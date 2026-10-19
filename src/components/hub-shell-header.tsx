import Link from "next/link";
import { Suspense } from "react";
import { HomeHeaderAuth } from "@/components/home-auth-actions";
import { HubPillNavServer } from "@/components/hub-pill-nav-server";
import { StickyGlassHeader } from "@/components/sticky-glass-header";

function AuthFallback({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-full bg-white/10 ${className}`} />;
}

function NavFallback({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-full bg-white/10 ${className}`} />;
}

export function HubShellHeader() {
  return (
    <StickyGlassHeader>
      {/* Mobile: logo | icon tabs | Open Hub */}
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-3 md:hidden">
        <Link href="/" className="flex shrink-0 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Pocket-Logo-White.svg" alt="Pocket" className="h-6 w-auto" />
        </Link>
        <Suspense fallback={<NavFallback className="h-8 w-[7.5rem]" />}>
          <HubPillNavServer iconsOnly />
        </Suspense>
        <Suspense fallback={<AuthFallback className="h-9 w-20" />}>
          <HomeHeaderAuth />
        </Suspense>
      </div>

      {/* Desktop: logo | labeled tabs | actions */}
      <div className="mx-auto hidden w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 py-4 md:grid">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 justify-self-start"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Pocket-Logo-White.svg"
            alt="Pocket"
            className="h-7 w-auto shrink-0"
          />
          <span className="font-display truncate text-sm font-semibold tracking-tight text-foreground">
            Community Hub
          </span>
        </Link>

        <div className="justify-self-center">
          <Suspense fallback={<NavFallback className="h-9 w-72" />}>
            <HubPillNavServer />
          </Suspense>
        </div>

        <div className="flex items-center justify-end gap-2 justify-self-end">
          <Suspense fallback={<AuthFallback className="h-11 w-28" />}>
            <HomeHeaderAuth />
          </Suspense>
        </div>
      </div>
    </StickyGlassHeader>
  );
}
