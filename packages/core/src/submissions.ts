import type { SubmissionStatus } from './review.js';

export type SubmissionRefusal =
  'quest_not_live' | 'already_pending' | 'already_approved' | 'wrong_link_count' | 'invalid_link';

export type SubmissionPlan =
  { ok: true; kind: 'create' | 'resubmit' } | { ok: false; reason: SubmissionRefusal };

/**
 * Flows 3 and 4: one submission per user per quest. A first submission creates
 * it; after a rejection the owner may resubmit, which returns it to pending.
 * Nothing else may overwrite proof, least of all proof that has been approved.
 */
export function planSubmission(input: {
  questLive: boolean;
  existing: SubmissionStatus | null;
}): SubmissionPlan {
  if (!input.questLive) return { ok: false, reason: 'quest_not_live' };
  switch (input.existing) {
    case null:
      return { ok: true, kind: 'create' };
    case 'rejected':
      return { ok: true, kind: 'resubmit' };
    case 'pending':
      return { ok: false, reason: 'already_pending' };
    case 'approved':
      return { ok: false, reason: 'already_approved' };
  }
}

export const MAX_LINK_LENGTH = 2048;

/**
 * Proof links: exactly the quest's `linkCount`, each an absolute http(s) URL.
 * Returns the links normalised (trimmed), or why they were refused.
 */
export function checkProofLinks(
  links: readonly string[],
  linkCount: number,
):
  | { ok: true; links: string[] }
  | { ok: false; reason: 'wrong_link_count' | 'invalid_link'; index?: number } {
  const trimmed = links.map((link) => link.trim());
  if (trimmed.length !== linkCount) return { ok: false, reason: 'wrong_link_count' };

  for (const [index, link] of trimmed.entries()) {
    if (link.length === 0 || link.length > MAX_LINK_LENGTH || !isHttpUrl(link)) {
      return { ok: false, reason: 'invalid_link', index };
    }
  }
  return { ok: true, links: trimmed };
}

function isHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  // `javascript:`, `data:` and friends would become live links on a review page.
  return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.length > 0;
}
