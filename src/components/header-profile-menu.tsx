"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LuLogOut } from "react-icons/lu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserAvatar } from "@/components/user-avatar";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type HeaderProfileMenuProps = {
  name: string;
  image: string | null;
  isAdmin?: boolean;
};

export function HeaderProfileMenu({
  name,
  image,
  isAdmin = false,
}: HeaderProfileMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
      setOpen(false);
      router.push("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${name} account menu`}
          title={name}
          className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-white/20 transition hover:ring-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
        >
          <UserAvatar name={name} src={image} size={36} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-52 rounded-2xl border border-white/12 bg-[#0a0f1a]/95 p-2 shadow-[0_16px_48px_rgba(0,0,0,0.65)] backdrop-blur-xl"
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-2.5 py-2">
          <UserAvatar name={name} src={image} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{name}</p>
            <p className="truncate text-[10px] font-semibold tracking-wide text-[#8eb6ff] uppercase">
              {isAdmin ? "Manager console" : "Ambassador"}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={signingOut}
          onClick={handleSignOut}
          className="mt-1.5 inline-flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-xs font-semibold text-white/90 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
        >
          <LuLogOut className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
          <span>{signingOut ? "Logging out…" : "Log out"}</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
