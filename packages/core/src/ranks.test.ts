import { describe, expect, it } from 'vitest';

import { eligibleXpRoles, planRoleChanges, type RankRole } from './ranks.js';

const roles: RankRole[] = [
  { id: 'bronze', xpRequired: 0 },
  { id: 'silver', xpRequired: 100 },
  { id: 'gold', xpRequired: 500 },
  { id: 'founder', xpRequired: null },
];

describe('eligibleXpRoles', () => {
  it('includes a threshold met exactly, and never a quest-only role', () => {
    expect(eligibleXpRoles(roles, 100)).toEqual(['bronze', 'silver']);
    expect(eligibleXpRoles(roles, 99)).toEqual(['bronze']);
    expect(eligibleXpRoles(roles, 1_000_000)).not.toContain('founder');
  });
});

describe('planRoleChanges', () => {
  it('grants newly met thresholds and a quest reward', () => {
    expect(
      planRoleChanges({
        roles,
        held: [{ roleId: 'bronze', source: 'xp' }],
        totalXp: 150,
        questRewardRoleIds: ['founder'],
      }),
    ).toEqual({
      grant: [
        { roleId: 'silver', source: 'xp' },
        { roleId: 'founder', source: 'quest' },
      ],
      revoke: [],
    });
  });

  it('revokes an XP role the total no longer meets, after an undo', () => {
    expect(
      planRoleChanges({
        roles,
        held: [
          { roleId: 'bronze', source: 'xp' },
          { roleId: 'silver', source: 'xp' },
        ],
        totalXp: 60,
        questRewardRoleIds: [],
      }),
    ).toEqual({ grant: [], revoke: ['silver'] });
  });

  it('revokes a quest reward once no approved quest grants it', () => {
    expect(
      planRoleChanges({
        roles,
        held: [{ roleId: 'founder', source: 'quest' }],
        totalXp: 0,
        questRewardRoleIds: [],
      }),
    ).toEqual({ grant: [{ roleId: 'bronze', source: 'xp' }], revoke: ['founder'] });
  });

  it('keeps a role that is still earned the other way', () => {
    // Silver was a quest reward; the quest was undone but XP still meets 100.
    expect(
      planRoleChanges({
        roles,
        held: [
          { roleId: 'bronze', source: 'xp' },
          { roleId: 'silver', source: 'quest' },
        ],
        totalXp: 120,
        questRewardRoleIds: [],
      }),
    ).toEqual({ grant: [], revoke: [] });
  });

  it('never touches a role assigned by hand', () => {
    expect(
      planRoleChanges({
        roles,
        held: [
          { roleId: 'gold', source: 'manual' },
          { roleId: 'founder', source: 'manual' },
        ],
        totalXp: 0,
        questRewardRoleIds: ['founder'],
      }),
    ).toEqual({ grant: [{ roleId: 'bronze', source: 'xp' }], revoke: [] });
  });

  it('grants nothing twice when a role is earned both ways', () => {
    expect(
      planRoleChanges({ roles, held: [], totalXp: 100, questRewardRoleIds: ['silver'] }),
    ).toEqual({
      grant: [
        { roleId: 'bronze', source: 'xp' },
        { roleId: 'silver', source: 'xp' },
      ],
      revoke: [],
    });
  });
});
