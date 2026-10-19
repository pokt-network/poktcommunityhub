import Link from "next/link";
import { DiscordLoginButton } from "@/components/discord-login-button";
import { HeaderProfileMenu } from "@/components/header-profile-menu";
import { getSession } from "@/lib/session";

const primaryBtn =
  "inline-flex h-9 items-center justify-center rounded-full bg-white px-3.5 text-xs font-semibold text-background transition hover:bg-white/90 sm:h-11 sm:px-5 sm:text-sm";

const heroPrimary =
  "inline-flex h-11 w-full items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-background transition hover:bg-white/90 sm:h-10 sm:w-auto sm:px-5 sm:text-sm";

const heroSecondary =
  "inline-flex h-11 w-full items-center justify-center rounded-full border border-white/25 bg-white/5 px-6 text-sm font-semibold text-foreground backdrop-blur transition hover:border-white/40 hover:bg-white/10 sm:h-10 sm:w-auto sm:px-5 sm:text-sm";

export async function HomeHeaderAuth() {
  const session = await getSession();

  if (session) {
    const isAdmin = session.user.role === "admin";
    if (isAdmin) {
      return (
        <div className="flex items-center gap-2">
          <Link href="/admin" className={primaryBtn}>
            Manage
          </Link>
          <HeaderProfileMenu
            name={session.user.name}
            image={session.user.image ?? null}
            isAdmin={isAdmin}
          />
        </div>
      );
    }

    return (
      <Link href="/dashboard" className={primaryBtn}>
        Open Hub
      </Link>
    );
  }

  return <DiscordLoginButton className={primaryBtn} label="Launch App" />;
}

export async function HomeHeroCta() {
  const session = await getSession();

  if (session) {
    if (session.user.role === "admin") {
      return (
        <>
          <Link href="/admin" className={heroPrimary}>
            Open Manager
          </Link>
          <Link href="/admin/review" className={heroSecondary}>
            Review queue
          </Link>
        </>
      );
    }

    return (
      <>
        <Link href="/quests" className={heroPrimary}>
          Enter Quests
        </Link>
        <Link href="/leaderboard" className={heroSecondary}>
          View Leaderboard
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/quests" className={heroPrimary}>
        Explore Quests
      </Link>
      <DiscordLoginButton
        className={heroSecondary}
        label="Connect Discord"
        callbackURL="/quests"
      />
    </>
  );
}

export async function HomePartnersCta() {
  const session = await getSession();

  if (session) {
    return (
      <Link
        href="/dashboard"
        className="hidden h-9 items-center justify-center rounded-full border border-white/20 px-3 text-xs font-medium text-foreground transition hover:border-white/40 sm:inline-flex sm:h-10 sm:px-4 sm:text-sm"
      >
        Open Hub
      </Link>
    );
  }

  return (
    <DiscordLoginButton
      className="hidden h-9 items-center justify-center rounded-full border border-white/20 px-3 text-xs font-medium text-foreground transition hover:border-white/40 sm:inline-flex sm:h-10 sm:px-4 sm:text-sm"
      label="Sign in"
    />
  );
}
