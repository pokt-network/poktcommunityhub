"use client";

import { useActionState, useState, useTransition } from "react";
import { FaCheck, FaTimes } from "react-icons/fa";
import {
  approveSubmissionAction,
  rejectSubmissionAction,
  type ReviewActionState,
} from "@/app/actions/reviews";

const initial: ReviewActionState = { ok: false };

export function ReviewActions({ submissionId }: { submissionId: string }) {
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectSubmissionAction,
    initial,
  );
  const [approvePending, startApprove] = useTransition();
  const [approveError, setApproveError] = useState<string | undefined>();
  const isBusy = approvePending || rejectPending;

  return (
    <div className="w-full space-y-1.5">
      <form action={rejectAction} className="flex w-full items-center gap-2">
        <input type="hidden" name="submissionId" value={submissionId} />

        {/* Optional Rejection Note */}
        <label htmlFor={`note-${submissionId}`} className="sr-only">
          Rejection note
        </label>
        <input
          id={`note-${submissionId}`}
          name="reviewNote"
          type="text"
          disabled={isBusy}
          placeholder="Optional rejection note"
          className="h-8.5 min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.06] px-3.5 text-xs text-foreground outline-none backdrop-blur-xl placeholder:text-muted focus:border-primary/40 focus:ring-1 focus:ring-primary/30 disabled:opacity-50 sm:text-sm"
        />

        {/* Small round Reject button */}
        <button
          type="submit"
          disabled={isBusy}
          title="Reject submission"
          className="inline-flex h-8.5 shrink-0 items-center justify-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-semibold text-rose-300 backdrop-blur-xl transition-all hover:bg-rose-500/20 active:scale-95 disabled:opacity-50 sm:px-3.5"
        >
          <FaTimes className="h-3 w-3 shrink-0" aria-hidden />
          <span>{rejectPending ? "Rejecting…" : "Reject"}</span>
        </button>

        {/* Small round Approve button */}
        <button
          type="button"
          disabled={isBusy}
          title="Approve submission"
          onClick={() => {
            setApproveError(undefined);
            startApprove(async () => {
              const result = await approveSubmissionAction(submissionId);
              if (!result.ok) {
                setApproveError(result.error ?? "Approve failed.");
              }
            });
          }}
          className="inline-flex h-8.5 shrink-0 items-center justify-center gap-1.5 rounded-full bg-success px-3.5 text-xs font-semibold text-white shadow-[0_0_14px_rgba(34,197,94,0.3)] transition-all hover:bg-success/90 hover:shadow-[0_0_18px_rgba(34,197,94,0.45)] active:scale-95 disabled:opacity-50 sm:px-4"
        >
          <FaCheck className="h-3 w-3 shrink-0" aria-hidden />
          <span>{approvePending ? "Approving…" : "Approve"}</span>
        </button>
      </form>

      {approveError ? (
        <p className="text-xs text-danger" role="alert">
          {approveError}
        </p>
      ) : null}
      {rejectState.error ? (
        <p className="text-xs text-danger" role="alert">
          {rejectState.error}
        </p>
      ) : null}
    </div>
  );
}
