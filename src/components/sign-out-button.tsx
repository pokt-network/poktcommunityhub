"use client";

import { useRouter } from "next/navigation";
import { FiLogOut } from "react-icons/fi";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  className?: string;
  /** Icon-only control (good for tight phone headers). */
  iconOnly?: boolean;
};

export function SignOutButton({
  className,
  iconOnly = false,
}: SignOutButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        const supabase = createBrowserSupabaseClient();
        await supabase.auth.signOut();
        router.push("/");
        router.refresh();
      }}
      aria-label="Sign out"
      className={cn(
        iconOnly
          ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-foreground transition hover:border-white/30 hover:bg-white/10"
          : "inline-flex h-9 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 text-xs font-medium text-foreground transition hover:border-white/30 hover:bg-white/10 sm:h-10 sm:px-4 sm:text-sm",
        className,
      )}
    >
      <FiLogOut className="h-4 w-4" aria-hidden />
      {iconOnly ? null : (
        <>
          <span className="hidden sm:inline">Sign out</span>
          <span className="sm:hidden">Out</span>
        </>
      )}
    </button>
  );
}
