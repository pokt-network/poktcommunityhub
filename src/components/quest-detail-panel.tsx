"use client";

import { useState } from "react";
import {
  LuArrowLeft,
  LuCalendarClock,
  LuCircleAlert,
  LuHourglass,
} from "react-icons/lu";
import { DiscordLoginButton } from "@/components/discord-login-button";
import { ProofSubmissionForm } from "@/components/proof-submission-form";
import { QuestDescription } from "@/components/quest-description";
import { QuestScheduleChip } from "@/components/quest-schedule-chip";
import { SubmissionStatusBadge } from "@/components/submission-status-badge";
import { ServerRoleBadge } from "@/components/server-role-badge";
import { Button } from "@/components/ui/button";
import { XpBadge } from "@/components/xp-badge";
import { ZoomableImage } from "@/components/zoomable-image";
import {
  questCategoryLabel,
  type FilterableQuest,
} from "@/lib/quest-filters";
import { formatScheduleDate, questScheduleState } from "@/lib/quest-schedule";

type QuestDetailPanelProps = {
  quest: FilterableQuest;
  onBack: () => void;
  backLabel?: string;
  /** When false, show Discord connect instead of the proof form. */
  authenticated?: boolean;
  authCallbackURL?: string;
  /** Admin preview — same ambassador layout, non-interactive submit. */
  preview?: boolean;
  onSubmitted?: (payload: {
    questId: string;
    proofImageUrl: string | null;
    proofUrls: string[];
  }) => void;
};

function QuestHeader({
  quest,
  authenticated,
  showInlineImage = false,
}: {
  quest: FilterableQuest;
  authenticated: boolean;
  showInlineImage?: boolean;
}) {
  const proofUrls = quest.proof_urls?.length
    ? quest.proof_urls
    : quest.proof_url
      ? [quest.proof_url]
      : [];

  return (
    <div className="min-w-0 space-y-2">
      <p className="text-[11px] font-medium tracking-wide text-[#8eb6ff] uppercase">
        {questCategoryLabel(quest)}
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
        {authenticated ? (
          <SubmissionStatusBadge status={quest.submission_status} />
        ) : null}
        {quest.starts_at || quest.ends_at ? (
          <QuestScheduleChip quest={quest} size="xs" />
        ) : null}
      </div>
      <QuestDescription text={quest.description} className="max-w-2xl" />

      {authenticated &&
      quest.review_note &&
      quest.submission_status === "rejected" ? (
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
                {quest.review_note}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {authenticated &&
      (proofUrls.length > 0 || (showInlineImage && quest.proof_image_url)) ? (
        <div className="space-y-2 border-t border-white/10 pt-3">
          <p className="text-sm font-medium text-foreground">Your current proof</p>
          {proofUrls.map((url) => (
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
          {showInlineImage && quest.proof_image_url ? (
            <ZoomableImage
              src={quest.proof_image_url}
              alt="Submitted proof screenshot"
              className="max-h-48 max-w-full rounded-xl object-contain sm:max-h-60"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function QuestDetailPanel({
  quest,
  onBack,
  backLabel = "Back to quests",
  authenticated = true,
  authCallbackURL = "/quests",
  preview = false,
  onSubmitted,
}: QuestDetailPanelProps) {
  const [submittedPatch, setSubmittedPatch] = useState<{
    questId: string;
    proofImageUrl: string | null;
    proofUrls: string[];
  } | null>(null);

  const effectiveQuest: FilterableQuest =
    submittedPatch && submittedPatch.questId === quest.id
      ? {
          ...quest,
          submission_status: "pending",
          review_note: null,
          proof_image_url:
            submittedPatch.proofImageUrl ?? quest.proof_image_url,
          proof_urls: submittedPatch.proofUrls.length
            ? submittedPatch.proofUrls
            : quest.proof_urls,
          proof_url:
            submittedPatch.proofUrls[0] ?? quest.proof_url ?? null,
        }
      : quest;

  const state = questScheduleState(effectiveQuest, Date.now());
  const isUpcoming = state === "upcoming";
  const isEnded = state === "ended";
  const showEndedBanner =
    isEnded && effectiveQuest.submission_status !== "approved";

  const header = (
    <QuestHeader
      quest={effectiveQuest}
      authenticated={authenticated}
      showInlineImage={showEndedBanner}
    />
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="h-9 rounded-full px-3 text-muted hover:text-foreground"
      >
        <LuArrowLeft className="h-4 w-4" />
        {backLabel}
      </Button>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:p-5">
        {preview ? (
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-5">
            <div className="space-y-4">
              {header}
              <div className="space-y-3 border-t border-white/10 pt-4">
                <h2 className="text-lg font-semibold text-white">Submit proof</h2>
                <div className="space-y-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-4">
                  <p className="text-sm text-muted">
                    Ambassadors attach a proof link or screenshot here to earn XP.
                  </p>
                  <div className="h-11 rounded-full border border-white/12 bg-white/[0.04] px-4 text-sm leading-[2.75rem] text-muted/70">
                    Proof URL
                  </div>
                  <div className="inline-flex h-10 items-center rounded-full bg-primary/80 px-5 text-sm font-semibold text-white/90">
                    Submit proof
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.02] text-sm text-muted lg:flex">
              Screenshot preview
            </div>
          </div>
        ) : isUpcoming ? (
          <div className="space-y-4">
            {header}
            <div className="rounded-2xl border border-primary/25 bg-primary/10 p-5 text-center sm:p-6">
              <LuCalendarClock className="mx-auto h-7 w-7 text-primary" aria-hidden />
              <h2 className="font-display mt-2 text-lg font-semibold text-white">
                Quest opens soon
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                This quest is scheduled to open on {formatScheduleDate(effectiveQuest.starts_at)}. Review the requirements above to get your submission ready.
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
                The deadline for this quest was {formatScheduleDate(effectiveQuest.ends_at)}. Submissions are no longer accepted.
              </p>
            </div>
          </div>
        ) : authenticated ? (
          <ProofSubmissionForm
            questId={effectiveQuest.id}
            locked={effectiveQuest.submission_status === "approved"}
            existingProofUrls={
              effectiveQuest.proof_urls?.length
                ? effectiveQuest.proof_urls
                : effectiveQuest.proof_url
                  ? [effectiveQuest.proof_url]
                  : []
            }
            existingProofImageUrl={effectiveQuest.proof_image_url}
            linkCount={effectiveQuest.link_count ?? 1}
            linkDescription={effectiveQuest.link_description}
            header={header}
            onSubmitted={({ proofImageUrl, proofUrls }) => {
              setSubmittedPatch({
                questId: effectiveQuest.id,
                proofImageUrl,
                proofUrls,
              });
              onSubmitted?.({
                questId: effectiveQuest.id,
                proofImageUrl,
                proofUrls,
              });
            }}
          />
        ) : (
          <div className="space-y-4">
            {header}
            <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-5 sm:px-5">
              <h2 className="text-lg font-semibold text-white">
                Connect Discord to start
              </h2>
              <p className="mt-1 text-sm text-muted">
                Sign in with Discord to submit proof and earn XP for this quest.
              </p>
              <DiscordLoginButton
                callbackURL={authCallbackURL}
                label="Connect Discord"
                className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-white transition hover:bg-primary-hover"
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
