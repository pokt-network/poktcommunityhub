import { describe, expect, it } from 'vitest';

import { checkProofLinks, MAX_LINK_LENGTH, planSubmission } from './submissions.js';

describe('planSubmission', () => {
  it('creates the first submission on a live quest', () => {
    expect(planSubmission({ questLive: true, existing: null })).toEqual({
      ok: true,
      kind: 'create',
    });
  });

  it('allows a resubmission only after a rejection', () => {
    expect(planSubmission({ questLive: true, existing: 'rejected' })).toEqual({
      ok: true,
      kind: 'resubmit',
    });
    expect(planSubmission({ questLive: true, existing: 'pending' })).toEqual({
      ok: false,
      reason: 'already_pending',
    });
    expect(planSubmission({ questLive: true, existing: 'approved' })).toEqual({
      ok: false,
      reason: 'already_approved',
    });
  });

  it('refuses anything on a quest that is not live, first', () => {
    for (const existing of [null, 'pending', 'approved', 'rejected'] as const) {
      expect(planSubmission({ questLive: false, existing })).toEqual({
        ok: false,
        reason: 'quest_not_live',
      });
    }
  });
});

describe('checkProofLinks', () => {
  it('accepts exactly the required number of http(s) links, trimmed', () => {
    expect(checkProofLinks([' https://x.com/a ', 'http://example.org'], 2)).toEqual({
      ok: true,
      links: ['https://x.com/a', 'http://example.org'],
    });
  });

  it('refuses too few or too many', () => {
    expect(checkProofLinks(['https://a.io'], 2)).toEqual({ ok: false, reason: 'wrong_link_count' });
    expect(checkProofLinks(['https://a.io', 'https://b.io'], 1)).toEqual({
      ok: false,
      reason: 'wrong_link_count',
    });
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://example.org/file',
    'example.org/no-scheme',
    '',
    '   ',
    `https://example.org/${'a'.repeat(MAX_LINK_LENGTH)}`,
  ])('refuses %j', (link) => {
    expect(checkProofLinks([link], 1)).toEqual({ ok: false, reason: 'invalid_link', index: 0 });
  });

  it('names which link was refused', () => {
    expect(checkProofLinks(['https://ok.io', 'javascript:void(0)'], 2)).toEqual({
      ok: false,
      reason: 'invalid_link',
      index: 1,
    });
  });
});
