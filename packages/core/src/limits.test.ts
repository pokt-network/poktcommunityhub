import { describe, expect, it } from 'vitest';

import { checkRate, SUBMISSION_LIMITS } from './limits.js';

const NOW = new Date('2026-10-28T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const rule = SUBMISSION_LIMITS.withFile; // 3 a minute, 5 s apart

describe('checkRate', () => {
  it('allows the first attempt', () => {
    expect(checkRate([], NOW, rule)).toEqual({ allowed: true });
  });

  it('enforces the minimum interval', () => {
    expect(checkRate([ago(2_000)], NOW, rule)).toEqual({ allowed: false, retryAfterMs: 3_000 });
    expect(checkRate([ago(5_000)], NOW, rule)).toEqual({ allowed: true });
  });

  it('allows up to the limit in the window, then waits for the oldest to age out', () => {
    expect(checkRate([ago(40_000), ago(20_000)], NOW, rule)).toEqual({ allowed: true });
    expect(checkRate([ago(50_000), ago(30_000), ago(10_000)], NOW, rule)).toEqual({
      allowed: false,
      retryAfterMs: 10_000,
    });
  });

  it('ignores attempts outside the window', () => {
    expect(checkRate([ago(60_000), ago(70_000), ago(80_000), ago(90_000)], NOW, rule)).toEqual({
      allowed: true,
    });
  });

  it('reports the longer of the two waits', () => {
    // Full window, and the latest attempt is 1 s old: the window wait (20 s) wins.
    const decision = checkRate([ago(40_000), ago(20_000), ago(1_000)], NOW, rule);
    expect(decision).toEqual({ allowed: false, retryAfterMs: 20_000 });
  });

  it('gives links-only submissions the looser rule', () => {
    const links = SUBMISSION_LIMITS.linksOnly;
    const five = [50, 40, 30, 20, 10].map((s) => ago(s * 1_000));
    expect(checkRate(five, NOW, links)).toEqual({ allowed: true });
    expect(checkRate([...five, ago(5_000)], NOW, links)).toEqual({
      allowed: false,
      retryAfterMs: 10_000,
    });
  });
});
