import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  LuArrowLeft,
  LuCalendarClock,
  LuCircleAlert,
  LuHourglass,
} from "react-icons/lu";
import { ProofSubmissionForm } from "@/components/proof-submission-form";
import { QuestScheduleChip } from "@/components/quest-schedule-chip";
import { SubmissionStatusBadge } from "@/components/submission-status-badge";
import { XpBadge } from "@/components/xp-badge";
import {
  getQuestById,
  getUserSubmission,
  getVisibleQuestById,
} from "@/lib/db";
import { formatScheduleDate, questScheduleState } from "@/lib/quest-schedule";
import { requireSession } from "@/lib/session";
import { getProofPublicUrl } from "@/lib/supabase-server";
import { QuestDescription } from "@/components/quest-description";
import { ServerRoleBadge } from "@/components/server-role-badge";
import { ZoomableImage } from "@/components/zoomable-image";

function QuestDetailFallback() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:px-6 sm:py-6">
      <div className="h-8 w-56 animate-pulse rounded-full bg-white/10" />
      <div className="mt-4 h-64 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
    </div>
  );
}

async function QuestDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const quest =
    session.user.role === "admin"
      ? await getQuestById(id)
      : await getVisibleQuestById(id);
  if (!quest) {
    notFound();
  }

  const submission = await getUserSubmission(session.user.id, id);
  let proofImage: string | null = null;
  if (submission?.proof_path) {
    try {
      proofImage = getProofPublicUrl(submission.proof_path);
    } catch {
      proofImage = null;
    }
  }

  const state = questScheduleState(quest);
  const isUpcoming = state === "upcoming";
  const isEnded = state === "ended";
  const showEndedBanner = isEnded && submission?.status !== "approved";

  const header = (
    <div className="min-w-0 space-y-2">
      <p className="text-[11px] font-medium tracking-wide text-[#8eb6ff] uppercase">
        {quest.category_name?.trim() || "Other"}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
          {quest.title}
        </h1>
        <XpBadge amount={quest.xp_reward} size="sm" />
        {quest.reward_role_name ? (
          <ServerRoleBadge
            role={{
              name: quest.reward_role_name,
              color: quest.reward_role_color || "#3b82f6",
            }}
            size="xs"
          />
        ) : null}
        <SubmissionStatusBadge status={submission?.status} />
        {quest.status === "closed" ? (
          <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase">
            Inactive
          </span>
        ) : null}
        {quest.starts_at || quest.ends_at ? (
          <QuestScheduleChip quest={quest} size="xs" />
        ) : null}
      </div>
      <QuestDescription text={quest.description} className="max-w-2xl" />

      {submission?.review_note && submission.status === "rejected" ? (
        <div className="relative overflow-hidden rounded-xl border border-rose-500/25 bg-gradient-to-r from-rose-950/40 via-[#180d12]/70 to-rose-950/25 p-3.5 backdrop-blur-md">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
              <LuCircleAlert className="h-3.5 w-3.5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-rose-300">
                <span>Reviewer note</span>
                <span className="text-[11px] font-normal text-rose-400/70">
                  · Please review and resubmit proof
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-zinc-200">
                {submission.review_note}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {((submission?.proof_urls?.length ?? 0) > 0 ||
        submission?.proof_url ||
        (showEndedBanner && proofImage)) && (
        <div className="space-y-2 border-t border-white/10 pt-3">
          <p className="text-sm font-medium text-foreground">Your current proof</p>
          {(submission?.proof_urls?.length
            ? submission.proof_urls
            : submission?.proof_url
              ? [submission.proof_url]
              : []
          ).map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block break-all text-sm text-[#8eb6ff] hover:underline"
            >
              {url}
            </a>
          ))}
          {showEndedBanner && proofImage ? (
            <ZoomableImage
              src={proofImage}
              alt="Submitted proof screenshot"
              className="max-h-48 max-w-full rounded-xl object-contain sm:max-h-60"
            />
          ) : null}
        </div>
      )}
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:px-6 sm:py-6">
      <Link
        href="/quests"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <LuArrowLeft className="h-4 w-4" aria-hidden />
        Back to quests
      </Link>

      <section className="mt-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:mt-4 sm:p-5">
        {isUpcoming ? (
          <div className="space-y-4">
            {header}
            <div className="rounded-2xl border border-primary/25 bg-primary/10 p-5 text-center sm:p-6">
              <LuCalendarClock className="mx-auto h-7 w-7 text-primary" aria-hidden />
              <h2 className="font-display mt-2 text-lg font-semibold text-white">
                Quest opens soon
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                This quest is scheduled to open on {formatScheduleDate(quest.starts_at)}. Review the details above and get your proof ready.
              </p>
            </div>
          </div>
        ) : showEndedBanner ? (
          <div className="space-y-4">
            {header}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center sm:p-6">
              <LuHourglass className="mx-auto h-7 w-7 text-muted" aria-hidden />
              <h2 className="font-display mt-2 text-lg font-semibold text-white">
                Quest has ended
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                The deadline for this quest was {formatScheduleDate(quest.ends_at)}. Submissions are no longer accepted.
              </p>
            </div>
          </div>
        ) : (
          <ProofSubmissionForm
            questId={quest.id}
            locked={submission?.status === "approved"}
            existingProofUrls={
              submission?.proof_urls?.length
                ? submission.proof_urls
                : submission?.proof_url
                  ? [submission.proof_url]
                  : []
            }
            existingProofImageUrl={proofImage}
            linkCount={quest.link_count ?? 1}
            linkDescription={quest.link_description}
            header={header}
          />
        )}
      </section>
    </main>
  );
}

export default function QuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<QuestDetailFallback />}>
      <QuestDetailContent params={params} />
    </Suspense>
  );
}
