import type { SubmissionStatus } from "@/lib/db";

const CONFIG: Record<
  string,
  { label: string; badgeClass: string; dotClass: string }
> = {
  none: {
    label: "Not started",
    badgeClass: "bg-white/5 text-muted border-white/10",
    dotClass: "bg-muted/50",
  },
  pending: {
    label: "Submitted",
    badgeClass:
      "bg-amber-500/10 text-amber-300 border-amber-500/25 shadow-[0_0_10px_rgba(245,158,11,0.1)]",
    dotClass: "bg-amber-400",
  },
  approved: {
    label: "Completed",
    badgeClass:
      "bg-emerald-500/10 text-emerald-300 border-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.1)]",
    dotClass: "bg-emerald-400",
  },
  rejected: {
    label: "Rejected",
    badgeClass:
      "bg-rose-500/10 text-rose-300 border-rose-500/25 shadow-[0_0_10px_rgba(244,63,94,0.12)]",
    dotClass: "bg-rose-400",
  },
};

export function SubmissionStatusBadge({
  status,
}: {
  status: SubmissionStatus | null | undefined;
}) {
  const key = status ?? "none";
  const item = CONFIG[key] ?? CONFIG.none;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${item.badgeClass}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${item.dotClass}`}
        aria-hidden
      />
      {item.label}
    </span>
  );
}
