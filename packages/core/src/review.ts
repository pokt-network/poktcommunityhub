export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export type ReviewAction = 'approve' | 'reject' | 'undo';

export type ReviewRefusal =
  /** approve or reject on a submission that is not pending. */
  | 'not_pending'
  /** undo on a submission that has not been reviewed. */
  | 'not_reviewed'
  /** The ledger disagrees with the status. Never guessed around: it means a bug. */
  | 'ledger_inconsistent';

export type ReviewPlan =
  | { ok: true; from: SubmissionStatus; to: SubmissionStatus; xpDelta: number }
  | { ok: false; reason: ReviewRefusal };

/**
 * The review state machine (build brief, section 4.2):
 *
 *     pending ──approve──▶ approved      (+ the quest's XP)
 *     pending ──reject───▶ rejected
 *     approved ──undo────▶ pending       (− exactly what this submission holds)
 *     rejected ──undo────▶ pending
 *
 * `awardedXp` is the submission's net in the ledger. Undo reverses THAT, not the
 * quest's current XP, so editing a quest's reward after an approval cannot make
 * an undo take back more or less than was given.
 *
 * The store applies the plan with `UPDATE … WHERE status = from`, so two admins
 * acting on one submission at once cannot both succeed.
 */
export function planReview(input: {
  status: SubmissionStatus;
  action: ReviewAction;
  questXp: number;
  awardedXp: number;
}): ReviewPlan {
  const { status, action, questXp, awardedXp } = input;

  // Only an approved submission holds XP, and it holds a positive amount.
  const consistent = status === 'approved' ? awardedXp > 0 : awardedXp === 0;
  if (!consistent) return { ok: false, reason: 'ledger_inconsistent' };

  switch (action) {
    case 'approve':
      if (status !== 'pending') return { ok: false, reason: 'not_pending' };
      if (!Number.isInteger(questXp) || questXp <= 0) {
        throw new RangeError(`quest XP must be a positive integer, got ${questXp}`);
      }
      return { ok: true, from: 'pending', to: 'approved', xpDelta: questXp };

    case 'reject':
      if (status !== 'pending') return { ok: false, reason: 'not_pending' };
      return { ok: true, from: 'pending', to: 'rejected', xpDelta: 0 };

    case 'undo':
      if (status === 'pending') return { ok: false, reason: 'not_reviewed' };
      // `0 - x`, not `-x`: negating 0 gives -0, which is not "no change" to Object.is.
      return { ok: true, from: status, to: 'pending', xpDelta: 0 - awardedXp };
  }
}

export const MAX_REVIEW_NOTE_LENGTH = 1000;

export type ReviewerRefusal =
  /** An admin never reviews, or undoes the review of, their own submission (section 13.3). */
  | 'own_submission'
  /** A rejection must say why: the ambassador reads it when they resubmit. */
  | 'note_required'
  | 'note_too_long';

/**
 * Who may review, and what a review must say (brief section 13.3). Returns the
 * note to store: trimmed, and null when empty.
 */
export function checkReview(input: {
  action: ReviewAction;
  note: string | null;
  actorId: string;
  submitterId: string;
}): { ok: true; note: string | null } | { ok: false; reason: ReviewerRefusal } {
  if (input.actorId === input.submitterId) return { ok: false, reason: 'own_submission' };
  const note = input.note?.trim() ?? '';
  if (note.length > MAX_REVIEW_NOTE_LENGTH) return { ok: false, reason: 'note_too_long' };
  if (input.action === 'reject' && note === '') return { ok: false, reason: 'note_required' };
  return { ok: true, note: note === '' ? null : note };
}
