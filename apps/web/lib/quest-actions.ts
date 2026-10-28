'use server';

import { submitProof, takeSubmissionAttempt, type SubmitResult } from '@community/store';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { userAction } from './actions';
import { webConfig } from './config';
import { db } from './db';
import { isUuid } from './ids';
import { log } from './log';
import { deleteProof, reencodeProof, saveProof, type ProofImageError } from './proofs';

export type SubmitState = { error: string | null };

const REFUSALS: Record<Exclude<SubmitResult, { ok: true }>['reason'], string> = {
  quest_not_found: 'That quest no longer exists.',
  quest_not_live: 'This quest is not open for submissions.',
  already_pending: 'Your proof for this quest is already waiting for review.',
  already_approved: 'You have already completed this quest.',
  wrong_link_count: 'Fill in every link box for this quest.',
  invalid_link: 'Each link must be a full web address, starting with https://.',
};

const IMAGE_ERRORS: Record<ProofImageError, string> = {
  too_large: 'The screenshot is over 5 MB. Try a smaller one.',
  not_an_image: 'The screenshot must be a PNG, JPEG or WebP image.',
  unreadable: 'That screenshot could not be read. Try saving it again.',
};

/**
 * Flows 3 and 4: submit proof, or resubmit after a rejection. Called from the
 * quest page's form through useActionState, so it answers with an error to show
 * or redirects back to the quest on success.
 *
 * Order matters: the rate limit is taken before any work, the screenshot is
 * redrawn before it touches the disk, and a file is only kept if the submission
 * it belongs to was recorded.
 */
export const submitProofAction = userAction(
  'submitProof',
  async (viewer, _previous: SubmitState, form: FormData): Promise<SubmitState> => {
    const questId = form.get('questId');
    if (typeof questId !== 'string' || !isUuid(questId)) return { error: REFUSALS.quest_not_found };
    const links = form.getAll('link').filter((v): v is string => typeof v === 'string');
    const upload = form.get('screenshot');
    const file = upload instanceof File && upload.size > 0 ? upload : null;

    const attempt = await takeSubmissionAttempt(db(), {
      userId: viewer.id,
      withFile: file !== null,
    });
    if (!attempt.allowed) {
      const seconds = Math.ceil(attempt.retryAfterMs / 1000);
      return { error: `You are submitting too quickly. Try again in ${seconds} seconds.` };
    }

    const dir = webConfig().PROOFS_DIR;
    let saved: string | null = null;
    if (file !== null) {
      const image = await reencodeProof(new Uint8Array(await file.arrayBuffer()));
      if (!image.ok) return { error: IMAGE_ERRORS[image.reason] };
      saved = await saveProof(dir, image.webp);
    }

    let result: SubmitResult;
    try {
      result = await submitProof(db(), { userId: viewer.id, questId, links, proofFile: saved });
    } catch (error) {
      if (saved !== null) await deleteProof(dir, saved);
      throw error;
    }

    if (!result.ok) {
      if (saved !== null) await deleteProof(dir, saved);
      return { error: REFUSALS[result.reason] };
    }
    if (result.replacedFile !== null) {
      // The submission already points at the new file; a leftover old one is
      // untidy, not wrong, so it is logged rather than failing the submission.
      await deleteProof(dir, result.replacedFile).catch((error: unknown) =>
        log().warn({ err: error, submissionId: result.submissionId }, 'old proof not deleted'),
      );
    }

    revalidatePath('/');
    redirect(`/quests/${questId}?submitted=1`);
  },
);
