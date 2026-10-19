"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type DiscordLoginButtonProps = {
  className?: string;
  label?: string;
  /** Where to return after Discord OAuth (defaults to /dashboard). */
  callbackURL?: string;
};

const AUTH_NEXT_COOKIE = "auth_next";

export function DiscordLoginButton({
  className,
  label = "Login with Discord",
  callbackURL = "/dashboard",
}: DiscordLoginButtonProps) {
  return (
    <button
      type="button"
      onClick={async () => {
        const supabase = createBrowserSupabaseClient();
        const next = callbackURL.startsWith("/") ? callbackURL : "/dashboard";

        // Keep redirectTo exact (no query) so Supabase Redirect URLs match
        // localhost in local dev instead of falling back to the Site URL (prod).
        document.cookie = `${AUTH_NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=600; SameSite=Lax`;

        const redirectTo = `${window.location.origin}/auth/callback`;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "discord",
          options: { redirectTo },
        });
        if (error) {
          console.error("[DiscordLogin]", error.message);
        }
      }}
      className={
        className ??
        "inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
      }
    >
      {label}
    </button>
  );
}
