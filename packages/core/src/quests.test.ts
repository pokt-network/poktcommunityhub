import { describe, expect, it } from 'vitest';

import { isQuestLive, monthWindow, questPhase } from './quests.js';

const at = (iso: string) => new Date(iso);
const open = { status: 'active' as const, startsAt: null, endsAt: null };

describe('questPhase', () => {
  it('is live when active with no window', () => {
    expect(questPhase(open, at('2026-10-28T00:00:00Z'))).toBe('live');
  });

  it('is closed whatever the window says', () => {
    expect(questPhase({ ...open, status: 'closed' }, at('2026-10-28T00:00:00Z'))).toBe('closed');
  });

  it('is scheduled before the start and live from the start instant', () => {
    const quest = { ...open, startsAt: at('2026-11-01T00:00:00Z') };
    expect(questPhase(quest, at('2026-10-31T23:59:59.999Z'))).toBe('scheduled');
    expect(questPhase(quest, at('2026-11-01T00:00:00Z'))).toBe('live');
  });

  it('has ended AT the end instant, not after it', () => {
    const quest = { ...open, endsAt: at('2026-11-01T00:00:00Z') };
    expect(questPhase(quest, at('2026-10-31T23:59:59.999Z'))).toBe('live');
    expect(questPhase(quest, at('2026-11-01T00:00:00Z'))).toBe('ended');
  });

  it('isQuestLive agrees with questPhase', () => {
    expect(isQuestLive(open, at('2026-10-28T00:00:00Z'))).toBe(true);
    expect(isQuestLive({ ...open, status: 'closed' }, at('2026-10-28T00:00:00Z'))).toBe(false);
  });
});

describe('monthWindow', () => {
  it('spans the UTC calendar month', () => {
    const { start, end } = monthWindow(at('2026-10-28T15:00:00Z'));
    expect(start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('rolls December into January', () => {
    const { start, end } = monthWindow(at('2026-12-31T23:59:59Z'));
    expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});
