import Image from "next/image";

/**
 * Ambient hero field — copy sits left; floats weight the right / corners.
 */
export function HomeHeroFloats() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      {/* Soft veil over the left copy column */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_55%_at_22%_42%,rgba(5,5,8,0.65)_0%,transparent_70%)]" />

      {/* Leaderboard — upper right */}
      <div className="animate-hub-float-delay-1 absolute top-[6%] right-[10%] w-[min(36vw,180px)] opacity-70 sm:top-[8%] sm:right-[12%] sm:w-[min(38vw,340px)] sm:opacity-85 lg:top-[10%] lg:right-[14%] lg:w-[min(32vw,360px)]">
        <Image
          src="/bg-leaderboard.png"
          alt=""
          width={687}
          height={453}
          className="h-auto w-full object-contain"
          priority
        />
      </div>

      {/* Community — mid-right, above coin */}
      <div className="animate-hub-float absolute top-[38%] right-[12%] hidden w-[min(28vw,240px)] opacity-70 sm:block sm:top-[42%] sm:right-[14%] sm:w-[min(26vw,260px)] sm:opacity-80 lg:right-[16%] lg:w-[min(22vw,280px)]">
        <Image
          src="/bg-community.png"
          alt=""
          width={650}
          height={354}
          className="h-auto w-full object-contain"
          priority
        />
      </div>

      {/* Rewards — phone: left; sm+: lower right, left of the coin */}
      <div className="animate-hub-float-delay-2 absolute bottom-[7%] left-[2%] w-[min(36vw,170px)] opacity-75 sm:right-[32%] sm:bottom-[10%] sm:left-auto sm:w-[min(26vw,260px)] sm:opacity-85 lg:right-[30%] lg:bottom-[12%] lg:w-[min(22vw,280px)]">
        <Image
          src="/bg-rewards.png"
          alt=""
          width={818}
          height={450}
          className="h-auto w-full object-contain"
          priority
        />
      </div>

      {/* Coin — lower right (unchanged) */}
      <div className="animate-hub-float-delay-3 absolute right-[12%] bottom-[10%] w-[min(18vw,110px)] opacity-80 sm:right-[14%] sm:bottom-[12%] sm:w-[min(14vw,130px)] sm:opacity-90 lg:right-[15%]">
        <Image
          src="/bg-coin.png"
          alt=""
          width={228}
          height={197}
          className="h-auto w-full object-contain drop-shadow-[0_0_24px_rgba(26,109,255,0.4)]"
          priority
        />
      </div>
    </div>
  );
}
