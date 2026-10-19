"use client";

import type { ReactNode } from "react";
import { LuTrash2 } from "react-icons/lu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ConfirmDeleteDialogProps = {
  open: boolean;
  title?: string;
  description: ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Shared destructive confirm modal used for deletes across the hub.
 */
export function ConfirmDeleteDialog({
  open,
  title = "Delete",
  description,
  confirmLabel = "Delete",
  pending = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !pending) onCancel();
      }}
    >
      <DialogContent className="max-w-md border-white/12 bg-[linear-gradient(180deg,rgba(14,22,38,0.99)_0%,rgba(8,12,20,1)_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
        <DialogHeader>
          <p className="text-[11px] font-semibold tracking-wide text-[#8eb6ff] uppercase">
            Confirm
          </p>
          <DialogTitle className="mt-0.5 text-base sm:text-lg text-white">
            {title}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-muted">
            {description}
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
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-danger px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 shadow-[0_0_16px_rgba(239,68,68,0.35)]"
          >
            <LuTrash2 className="h-3.5 w-3.5" aria-hidden />
            {pending ? "Deleting…" : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
