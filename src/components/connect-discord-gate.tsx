import Image from "next/image";
import { LuPackage } from "react-icons/lu";
import { DiscordLoginButton } from "@/components/discord-login-button";

type ConnectDiscordGateProps = {
  title?: string;
  body?: string;
  callbackURL?: string;
  /** Optional hero art (e.g. /xp-chest.png). */
  imageSrc?: string;
  imageAlt?: string;
};

export function ConnectDiscordGate({
  title = "Connect Discord to continue",
  body = "Sign in with Discord to unlock this part of the hub.",
  callbackURL = "/dashboard",
  imageSrc,
  imageAlt = "",
}: ConnectDiscordGateProps) {
  return (
    <section className="relative mx-auto w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#070b14]/85 px-6 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-10 sm:py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(26,109,255,0.28),transparent_55%)]"
        aria-hidden
      />
      <div className="relative">
        {imageSrc ? (
          <div className="mx-auto flex justify-center">
            <Image
              src={imageSrc}
              alt={imageAlt}
              width={220}
              height={220}
              className="h-40 w-40 object-contain drop-shadow-[0_0_32px_rgba(26,109,255,0.45)] sm:h-48 sm:w-48"
              priority
            />
          </div>
        ) : (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 text-primary shadow-[0_0_28px_rgba(26,109,255,0.35)]">
            <LuPackage className="h-7 w-7" aria-hidden />
          </div>
        )}
        <h1 className="font-display mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
          {body}
        </p>
        <DiscordLoginButton
          callbackURL={callbackURL}
          label="Connect Discord"
          className="mt-7 inline-flex h-11 items-center justify-center rounded-full bg-primary px-7 text-sm font-semibold text-white shadow-[0_0_24px_rgba(26,109,255,0.4)] transition hover:bg-primary-hover"
        />
        <p className="mt-4 text-xs text-muted">
          Free to join · XP starts after your first approved quest
        </p>
      </div>
    </section>
  );
}
