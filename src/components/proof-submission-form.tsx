"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LuCheck, LuImage, LuX } from "react-icons/lu";
import {
  submitProofAction,
  type SubmissionActionState,
} from "@/app/actions/submissions";
import { cn } from "@/lib/utils";

const initial: SubmissionActionState = { ok: false };

const fieldClass =
  "h-11 w-full rounded-full border border-white/15 bg-white/[0.06] px-4 text-sm text-foreground outline-none backdrop-blur-xl placeholder:text-muted focus:border-primary/40 focus:ring-2 focus:ring-primary/30";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProofSubmissionForm({
  questId,
  locked,
  existingProofUrls = [],
  existingProofImageUrl = null,
  linkCount = 1,
  linkDescription = "",
  header,
  onSubmitted,
}: {
  questId: string;
  locked?: boolean;
  existingProofUrls?: string[];
  existingProofImageUrl?: string | null;
  linkCount?: number;
  linkDescription?: string | null;
  /** Renders in the left column above the form (title, description, etc.). */
  header?: ReactNode;
  onSubmitted?: (payload: {
    proofImageUrl: string | null;
    proofUrls: string[];
  }) => void;
}) {
  const [state, formAction, pending] = useActionState(
    submitProofAction,
    initial,
  );
  const inputId = useId();
  const activeBlobRef = useRef<string | null>(null);
  const submittedBlobRef = useRef<string | null>(null);
  const lastSubmittedAtRef = useRef<number | undefined>(undefined);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submittedPreviewUrl, setSubmittedPreviewUrl] = useState<string | null>(
    null,
  );

  const slots = Math.min(8, Math.max(1, linkCount));
  const defaults = Array.from(
    { length: slots },
    (_, i) => (state.proofUrls ?? existingProofUrls)[i] ?? "",
  );

  useEffect(() => {
    return () => {
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
      }
      if (
        submittedBlobRef.current &&
        submittedBlobRef.current !== activeBlobRef.current
      ) {
        URL.revokeObjectURL(submittedBlobRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!state.ok || !state.submittedAt) return;
    if (lastSubmittedAtRef.current === state.submittedAt) return;
    lastSubmittedAtRef.current = state.submittedAt;

    let nextSubmittedPreview =
      submittedBlobRef.current ??
      state.proofImageUrl ??
      existingProofImageUrl ??
      null;

    if (activeBlobRef.current) {
      if (
        submittedBlobRef.current &&
        submittedBlobRef.current !== activeBlobRef.current
      ) {
        URL.revokeObjectURL(submittedBlobRef.current);
      }
      submittedBlobRef.current = activeBlobRef.current;
      nextSubmittedPreview = activeBlobRef.current;
      activeBlobRef.current = null;
    } else if (state.proofImageUrl) {
      nextSubmittedPreview = state.proofImageUrl;
    }

    setSubmittedPreviewUrl(nextSubmittedPreview);
    setFile(null);
    setPreviewUrl(null);
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (input) input.value = "";

    onSubmitted?.({
      proofImageUrl: nextSubmittedPreview,
      proofUrls: state.proofUrls ?? existingProofUrls,
    });
  }, [
    state.ok,
    state.submittedAt,
    state.proofImageUrl,
    state.proofUrls,
    existingProofImageUrl,
    existingProofUrls,
    inputId,
    onSubmitted,
  ]);

  function handleFileSelect(next: File | null) {
    if (
      activeBlobRef.current &&
      activeBlobRef.current !== submittedBlobRef.current
    ) {
      URL.revokeObjectURL(activeBlobRef.current);
    }
    if (!next) {
      activeBlobRef.current = null;
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(next);
    activeBlobRef.current = url;
    setFile(next);
    setPreviewUrl(url);
  }

  function clearFile() {
    if (
      activeBlobRef.current &&
      activeBlobRef.current !== submittedBlobRef.current
    ) {
      URL.revokeObjectURL(activeBlobRef.current);
    }
    activeBlobRef.current = null;
    setFile(null);
    setPreviewUrl(null);
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (input) input.value = "";
  }

  const displayPreviewUrl =
    previewUrl ??
    submittedPreviewUrl ??
    state.proofImageUrl ??
    existingProofImageUrl ??
    null;

  if (locked) {
    return (
      <div
        className={cn(
          "space-y-4",
          displayPreviewUrl &&
            "grid gap-4 space-y-0 lg:grid-cols-2 lg:items-start lg:gap-5",
        )}
      >
        <div className="min-w-0 space-y-4">
          {header}
          <p className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            This quest is approved. XP has been credited.
          </p>
        </div>
        {displayPreviewUrl ? (
          <div className="relative min-h-[220px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] sm:min-h-[260px] lg:sticky lg:top-4 lg:min-h-[min(420px,70vh)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayPreviewUrl}
              alt="Approved proof screenshot"
              className="max-h-[48vh] w-full object-contain sm:max-h-[52vh] lg:absolute lg:inset-0 lg:h-full lg:max-h-none"
            />
            <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5 sm:px-4 lg:absolute lg:inset-x-0 lg:bottom-0 lg:border-t-0 lg:bg-gradient-to-t lg:from-black/75 lg:via-black/40 lg:to-transparent lg:pt-10">
              <LuCheck className="h-4 w-4 shrink-0 text-success" aria-hidden />
              <p className="truncate text-xs font-medium text-foreground lg:text-white">
                Approved screenshot
              </p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-2 lg:gap-5 lg:items-start">
      <input type="hidden" name="questId" value={questId} />
      <input type="hidden" name="linkCount" value={String(slots)} />

      <div className="min-w-0 space-y-4">
        {header}

        {linkDescription?.trim() ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-muted">
            {linkDescription.trim()}
          </p>
        ) : null}

        <div className="space-y-3 border-t border-white/10 pt-4">
          <h2 className="text-lg font-semibold text-white">Submit proof</h2>

          <div className="space-y-3">
            {defaults.map((value, index) => (
              <div key={index}>
                <label
                  htmlFor={`proofUrl-${questId}-${index}`}
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {slots === 1 ? "Proof URL" : `Proof URL ${index + 1}`}
                </label>
                <input
                  id={`proofUrl-${questId}-${index}`}
                  name={`proofUrl-${index}`}
                  type="url"
                  defaultValue={value}
                  placeholder="https://x.com/... or GitHub PR, article, etc."
                  className={fieldClass}
                />
              </div>
            ))}
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              Screenshot
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor={inputId}
                className={cn(
                  "inline-flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover",
                  pending && "pointer-events-none opacity-60",
                )}
              >
                {file || displayPreviewUrl ? "Change file" : "Choose file"}
              </label>
              <input
                id={inputId}
                name="screenshot"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const next = e.target.files?.[0] ?? null;
                  handleFileSelect(next);
                }}
              />
              {!file ? (
                <p className="text-sm text-muted">
                  {displayPreviewUrl
                    ? "Screenshot attached"
                    : "No file chosen"}
                </p>
              ) : (
                <div className="min-w-0 flex-1 lg:hidden">
                  <p className="truncate text-sm font-medium text-foreground">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted">{formatBytes(file.size)}</p>
                </div>
              )}
              {file ? (
                <button
                  type="button"
                  onClick={clearFile}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-muted transition hover:bg-white/10 hover:text-white lg:hidden"
                  aria-label="Remove screenshot"
                >
                  <LuX className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs text-muted">
              PNG, JPEG, or WebP · max 5MB. Provide URL
              {slots > 1 ? "s" : ""} and/or a screenshot.
            </p>
          </div>

          {state.error ? (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.ok ? (
            <p className="text-sm text-success" role="status">
              Proof submitted. An admin will review it shortly.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Submitting…" : "Submit proof"}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] lg:sticky lg:top-4 lg:min-h-[min(420px,70vh)]",
          displayPreviewUrl
            ? "min-h-[220px] sm:min-h-[260px]"
            : "hidden min-h-[220px] lg:flex lg:items-center lg:justify-center",
        )}
      >
        {displayPreviewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayPreviewUrl}
              alt={
                file ? "Selected screenshot preview" : "Submitted screenshot"
              }
              className="max-h-[48vh] w-full object-contain sm:max-h-[52vh] lg:absolute lg:inset-0 lg:max-h-none lg:h-full"
            />
            <div className="flex items-center gap-3 border-t border-white/10 px-3 py-2.5 sm:px-4 lg:absolute lg:inset-x-0 lg:bottom-0 lg:border-t-0 lg:bg-gradient-to-t lg:from-black/75 lg:via-black/40 lg:to-transparent lg:pt-10">
              {file ? (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground lg:text-white">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted lg:text-white/70">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 text-white/80 transition hover:bg-white/15 hover:text-white lg:inline-flex"
                    aria-label="Remove screenshot"
                  >
                    <LuX className="h-4 w-4" aria-hidden />
                  </button>
                </>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
                    <LuCheck className="h-3 w-3" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground lg:text-white">
                      Submitted screenshot
                    </p>
                    <p className="text-xs text-muted lg:text-white/70">
                      Choose a new file to replace it
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 text-center text-muted">
            <LuImage className="h-8 w-8 opacity-40" aria-hidden />
            <p className="text-sm">Screenshot preview</p>
            <p className="text-xs text-muted/80">
              Choose a file to preview it here
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
