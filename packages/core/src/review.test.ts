import { describe, expect, it } from 'vitest';

import {
  checkReview,
  MAX_REVIEW_NOTE_LENGTH,
  planReview,
  type ReviewAction,
  type SubmissionStatus,
} from './review.js';

const plan = (status: SubmissionStatus, action: ReviewAction, awardedXp = 0, questXp = 50) =>
  planReview({ status, action, questXp, awardedXp });

describe('planReview', () => {
  it('approves a pending submission for the quest XP', () => {
    expect(plan('pending', 'approve')).toEqual({
      ok: true,
      from: 'pending',
      to: 'approved',
      xpDelta: 50,
    });
  });

  it('rejects a pending submission with no XP', () => {
    expect(plan('pending', 'reject')).toEqual({
      ok: true,
      from: 'pending',
      to: 'rejected',
      xpDelta: 0,
    });
  });

  it('undoes an approval by exactly what the ledger holds, not the current quest XP', () => {
    // The quest was worth 50 when approved and has since been edited to 80.
    expect(plan('approved', 'undo', 50, 80)).toEqual({
      ok: true,
      from: 'approved',
      to: 'pending',
      xpDelta: -50,
    });
  });

  it('undoes a rejection with no XP', () => {
    expect(plan('rejected', 'undo')).toEqual({
      ok: true,
      from: 'rejected',
      to: 'pending',
      xpDelta: 0,
    });
  });

  it.each([
    ['approved', 'approve', 50],
    ['approved', 'reject', 50],
    ['rejected', 'approve', 0],
    ['rejected', 'reject', 0],
  ] as const)('refuses %s → %s', (status, action, awarded) => {
    expect(plan(status, action, awarded)).toEqual({ ok: false, reason: 'not_pending' });
  });

  it('refuses to undo a pending submission', () => {
    expect(plan('pending', 'undo')).toEqual({ ok: false, reason: 'not_reviewed' });
  });

  it.each([
    ['pending', 50],
    ['rejected', 50],
    ['approved', 0],
    ['approved', -50],
  ] as const)('refuses every action when %s holds %i XP', (status, awarded) => {
    for (const action of ['approve', 'reject', 'undo'] as const) {
      expect(plan(status, action, awarded)).toEqual({ ok: false, reason: 'ledger_inconsistent' });
    }
  });

  it('throws on a non-positive or fractional quest XP rather than awarding it', () => {
    expect(() => plan('pending', 'approve', 0, 0)).toThrow(RangeError);
    expect(() => plan('pending', 'approve', 0, 1.5)).toThrow(RangeError);
  });
});

describe('checkReview', () => {
  const base = { actorId: 'admin', submitterId: 'amb' };

  it('refuses any review of your own submission', () => {
    for (const action of ['approve', 'reject', 'undo'] as const) {
      expect(checkReview({ ...base, actorId: 'amb', action, note: 'fine' })).toEqual({
        ok: false,
        reason: 'own_submission',
      });
    }
  });

  it('requires a note to reject, and trims it', () => {
    expect(checkReview({ ...base, action: 'reject', note: '   ' })).toEqual({
      ok: false,
      reason: 'note_required',
    });
    expect(checkReview({ ...base, action: 'reject', note: null })).toEqual({
      ok: false,
      reason: 'note_required',
    });
    expect(checkReview({ ...base, action: 'reject', note: ' Link is dead. ' })).toEqual({
      ok: true,
      note: 'Link is dead.',
    });
  });

  it('makes the note optional to approve, storing an empty one as null', () => {
    expect(checkReview({ ...base, action: 'approve', note: '' })).toEqual({ ok: true, note: null });
    expect(checkReview({ ...base, action: 'approve', note: 'Great work' })).toEqual({
      ok: true,
      note: 'Great work',
    });
  });

  it('caps the note length', () => {
    const long = 'x'.repeat(MAX_REVIEW_NOTE_LENGTH + 1);
    expect(checkReview({ ...base, action: 'approve', note: long })).toEqual({
      ok: false,
      reason: 'note_too_long',
    });
  });
});
