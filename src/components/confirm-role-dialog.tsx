"use client";

import { LuShieldAlert, LuShieldCheck } from "react-icons/lu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ConfirmRoleDialogProps = {
  open: boolean;
  userName: string;
  targetRole: "admin" | "ambassador";
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmRoleDialog({
  open,
  userName,
  targetRole,
  pending = false,
  onCancel,
  onConfirm,
}: ConfirmRoleDialogProps) {
  const isPromote = targetRole === "admin";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && !pending) onCancel();
    }}>
      <DialogContent className="max-w-md border-white/12 bg-[linear-gradient(180deg,rgba(14,22,38,0.99)_0%,rgba(8,12,20,1)_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
        <DialogHeader>
          <p className="text-[11px] font-semibold tracking-wide text-[#8eb6ff] uppercase">
            Role permissions
          </p>
          <DialogTitle className="mt-0.5 text-base sm:text-lg">
            {isPromote ? "Make user an admin?" : "Remove admin privileges?"}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted">
            {isPromote ? (
              <>
                Promote <span className="font-semibold text-white">{userName}</span> to an{" "}
                <span className="font-semibold text-[#8eb6ff]">Admin</span>? They will gain full
                access to the Manager Console, allowing them to review submissions, manage quests, and
                configure hub settings.
              </>
            ) : (
              <>
                Remove admin access from{" "}
                <span className="font-semibold text-white">{userName}</span>? They will return to
                standard <span className="font-semibold text-white">Ambassador</span> status and
                lose access to the Manager Console.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-foreground transition hover:bg-white/[0.08] disabled:opacity-60"
          >
            Cancel
          </button>

          {isPromote ? (
            <button
              type="button"
              disabled={pending}
              onClick={onConfirm}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-[0_0_16px_rgba(26,109,255,0.4)] transition hover:bg-primary-hover disabled:opacity-60"
            >
              <LuShieldCheck className="h-4 w-4" aria-hidden />
              {pending ? "Updating…" : "Make admin"}
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={onConfirm}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/20 px-4 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/30 disabled:opacity-60"
            >
              <LuShieldAlert className="h-4 w-4" aria-hidden />
              {pending ? "Updating…" : "Remove admin"}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
