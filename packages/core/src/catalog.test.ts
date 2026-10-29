import { describe, expect, it } from 'vitest';

import {
  checkCategoryName,
  checkQuest,
  checkRank,
  isQuestIcon,
  QUEST_ICONS,
  type QuestInput,
  type RankInput,
} from './catalog.js';

const quest: QuestInput = {
  title: ' Share the upgrade ',
  descriptionMd: 'Post about it.',
  xpReward: 50,
  icon: 'megaphone',
  categoryId: null,
  linkCount: 1,
  linkHint: '  ',
  startsAt: null,
  endsAt: null,
  rewardRoleId: null,
};

describe('checkQuest', () => {
  it('accepts a valid quest, trimming text and nulling an empty hint', () => {
    expect(checkQuest(quest)).toEqual({
      ok: true,
      value: { ...quest, title: 'Share the upgrade', linkHint: null },
    });
  });

  it('reports every bad field at once', () => {
    const result = checkQuest({
      ...quest,
      title: '',
      xpReward: 0,
      icon: '🚀',
      linkCount: 9,
      startsAt: new Date('2026-11-02'),
      endsAt: new Date('2026-11-01'),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      'endsAt',
      'icon',
      'linkCount',
      'title',
      'xpReward',
    ]);
  });

  it('refuses fractional XP and an end equal to the start', () => {
    const at = new Date('2026-11-01');
    const result = checkQuest({ ...quest, xpReward: 12.5, startsAt: at, endsAt: at });
    expect(result.ok ? [] : Object.keys(result.errors).sort()).toEqual(['endsAt', 'xpReward']);
  });
});

describe('the quest icon set', () => {
  it('has unique ids and refuses anything outside it', () => {
    const ids = QUEST_ICONS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(isQuestIcon('trophy')).toBe(true);
    expect(isQuestIcon('<img src=x onerror=alert(1)>')).toBe(false);
  });
});

describe('checkCategoryName', () => {
  it('trims, and refuses empty or long names', () => {
    expect(checkCategoryName(' Social ')).toEqual({ ok: true, value: 'Social' });
    expect(checkCategoryName('   ').ok).toBe(false);
    expect(checkCategoryName('x'.repeat(61)).ok).toBe(false);
  });
});

describe('checkRank', () => {
  const rank: RankInput = {
    name: 'Scout',
    description: '',
    color: '#48e5c2',
    icon: '🧭',
    xpRequired: 100,
    discordRoleId: ' 1234567890123456789 ',
  };

  it('accepts a valid rank, and quest-reward-only ranks with no threshold', () => {
    expect(checkRank(rank)).toEqual({
      ok: true,
      value: { ...rank, discordRoleId: '1234567890123456789' },
    });
    expect(checkRank({ ...rank, xpRequired: null, color: '', discordRoleId: '' })).toEqual({
      ok: true,
      value: { ...rank, xpRequired: null, color: null, discordRoleId: null },
    });
  });

  it('refuses a bad colour, threshold or Discord id', () => {
    const result = checkRank({ ...rank, color: 'red', xpRequired: -5, discordRoleId: '12ab' });
    expect(result.ok ? [] : Object.keys(result.errors).sort()).toEqual([
      'color',
      'discordRoleId',
      'xpRequired',
    ]);
  });
});
