import { Suspense } from "react";
import Link from "next/link";
import { FaDiscord, FaXTwitter } from "react-icons/fa6";
import { LuGlobe } from "react-icons/lu";
import { HomeHeroCta } from "@/components/home-auth-actions";
import { HomeHeroFloats } from "@/components/home-hero-floats";
import {
  HomeLeaderboardSection,
  HomeQuestsSection,
} from "@/components/home-live-sections";

function AuthFallback({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-full bg-white/10 ${className}`} />;
}

function SectionFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
      <div className="h-10 w-40 animate-pulse rounded bg-white/10 sm:w-56" />
      <div className="mt-8 h-40 animate-pulse rounded-2xl border border-white/10 bg-card/40 sm:h-48" />
    </div>
  );
}

export default function Home() {
  return (
    <>
      <div className="relative flex min-h-[calc(100dvh-4.25rem)] flex-col overflow-hidden">
        <HomeHeroFloats />
        <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-start justify-center px-4 pb-10 text-left sm:px-6 sm:pb-14">
          <p className="animate-hub-rise font-display text-base font-semibold tracking-tight text-white sm:text-xl">
            Community Hub
          </p>
          <h1 className="animate-hub-rise-delay-1 font-display mt-3 max-w-xl text-3xl font-semibold tracking-tight text-white sm:mt-4 sm:max-w-2xl sm:text-5xl sm:leading-[1.05] md:text-6xl">
            Your Pocket Network growth engine
          </h1>
          <p className="animate-hub-rise-delay-2 mt-4 max-w-md text-sm leading-relaxed text-muted sm:mt-5 sm:max-w-lg sm:text-lg">
            Quests, proof, XP, and rankings for ambassadors — in one dedicated
            portal.
          </p>

          <div className="animate-hub-rise-delay-3 mt-7 flex w-full flex-col items-stretch gap-3 sm:mt-9 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <Suspense
              fallback={
                <>
                  <AuthFallback className="h-11 w-full sm:h-12 sm:w-36" />
                  <AuthFallback className="h-11 w-full sm:h-12 sm:w-40" />
                </>
              }
            >
              <HomeHeroCta />
            </Suspense>
          </div>

          <p className="mt-10 text-[10px] font-medium tracking-[0.18em] text-muted uppercase sm:mt-14 sm:text-xs sm:tracking-[0.2em]">
            Built for Pocket Network ambassadors
          </p>
        </section>
      </div>

      <main className="relative z-10 bg-background">
        <Suspense fallback={<SectionFallback />}>
          <HomeQuestsSection />
        </Suspense>

        <Suspense fallback={<SectionFallback />}>
          <HomeLeaderboardSection />
        </Suspense>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-background">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10 lg:grid-cols-[1.4fr_0.9fr_1.2fr] lg:gap-x-12">
          <div>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/Pocket-Logo-White.svg" alt="" className="h-6 w-auto" />
              <span className="font-display text-sm font-semibold">
                Community Hub
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
              The ambassador quest and leaderboard portal for Pocket Network.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <a
                href="https://x.com/POKTnetwork"
                target="_blank"
                rel="noreferrer"
                aria-label="POKT Network on X"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted transition hover:border-[#8eb6ff]/50 hover:bg-[#8eb6ff]/10 hover:text-white"
              >
                <FaXTwitter className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://discord.com/invite/pocket-network"
                target="_blank"
                rel="noreferrer"
                aria-label="POKT Network Discord"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted transition hover:border-[#5865F2]/50 hover:bg-[#5865F2]/10 hover:text-[#5865F2]"
              >
                <FaDiscord className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://pocket.network/"
                target="_blank"
                rel="noreferrer"
                aria-label="Pocket Network Official Website"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
              >
                <LuGlobe className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 sm:gap-8 lg:contents">
            <div>
              <p className="text-sm font-semibold text-white">Explore</p>
              <ul className="mt-2.5 space-y-1.5 text-sm text-muted">
                <li>
                  <Link href="/quests" className="hover:text-foreground">
                    Quests
                  </Link>
                </li>
                <li>
                  <Link href="/leaderboard" className="hover:text-foreground">
                    Leaderboard
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard" className="hover:text-foreground">
                    My Rewards
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Network</p>
              <ul className="mt-2.5 space-y-2 text-sm text-muted">
                <li>
                  <a
                    href="https://pocket.network/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-start gap-2 transition hover:text-white"
                  >
                    <LuGlobe className="mt-0.5 h-4 w-4 shrink-0 text-[#8eb6ff]" />
                    <span>Pocket Network Official Website</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://x.com/POKTnetwork"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-start gap-2 transition hover:text-white"
                  >
                    <FaXTwitter className="mt-0.5 h-4 w-4 shrink-0 text-[#8eb6ff]" />
                    <span>@POKTnetwork on X</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://discord.com/invite/pocket-network"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-start gap-2 transition hover:text-white"
                  >
                    <FaDiscord className="mt-0.5 h-4 w-4 shrink-0 text-[#8eb6ff]" />
                    <span>POKT Network Discord</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-3.5 text-center text-xs text-muted sm:px-6">
          © 2026 Community Hub · Built for Pocket Network
        </div>
      </footer>
    </>
  );
}
