import { describe, expect, it } from 'vitest';

import {
  afterJobFailure,
  announcementText,
  botReadiness,
  checkWebhookSettings,
  isWebhookUrl,
  maskWebhook,
  planMemberSync,
  proofRetentionCutoff,
  roleColor,
} from './discord.js';

const GUILD = '100000000000000000';
const [A, B, C, OTHER] = [
  '111111111111111111',
  '222222222222222222',
  '333333333333333333',
  '999999999999999999',
];

describe('planMemberSync', () => {
  it('adds held roles the member lacks and removes managed roles they no longer hold', () => {
    expect(planMemberSync({ held: [A], managed: [A, B], current: [B, OTHER] })).toEqual({
      add: [A],
      remove: [B],
    });
  });

  it('never touches a role the hub does not manage', () => {
    expect(planMemberSync({ held: [], managed: [A], current: [OTHER] })).toEqual({
      add: [],
      remove: [],
    });
  });

  it('removes a role a rank let go of, unless the member still holds it through another rank', () => {
    expect(planMemberSync({ held: [], managed: [C], current: [C] }).remove).toEqual([C]);
    expect(planMemberSync({ held: [C], managed: [C], current: [C] })).toEqual({
      add: [],
      remove: [],
    });
  });

  it('takes every managed role from a deleted member', () => {
    expect(planMemberSync({ held: [], managed: [A, B], current: [A, B, OTHER] }).remove).toEqual([
      A,
      B,
    ]);
  });
});

describe('afterJobFailure', () => {
  const now = new Date('2026-10-29T12:00:00Z');
  const wait = (attempts: number) => {
    const r = afterJobFailure({ attempts, now });
    return r.kind === 'retry' ? r.at.getTime() - now.getTime() : null;
  };

  it('doubles from 30 seconds to at most an hour', () => {
    expect([1, 2, 3, 4].map(wait)).toEqual([30_000, 60_000, 120_000, 240_000]);
    expect(wait(8)).toBe(3_600_000);
    expect(wait(9)).toBe(3_600_000);
  });

  it('gives up on the tenth failure', () => {
    expect(afterJobFailure({ attempts: 10, now })).toEqual({ kind: 'failed' });
  });

  it('waits as long as a rate limit asks, without using an attempt', () => {
    expect(afterJobFailure({ attempts: 10, now, retryAfterMs: 1500 })).toEqual({
      kind: 'retry',
      at: new Date(now.getTime() + 1500),
      countsAsAttempt: false,
    });
  });
});

describe('botReadiness', () => {
  const roles = [
    { id: GUILD, name: '@everyone', position: 0, permissions: '0' },
    { id: A, name: 'Herald', position: 2, permissions: '0' },
    { id: B, name: 'Bot', position: 5, permissions: String(1n << 28n) },
    { id: C, name: 'Mods', position: 8, permissions: '0' },
  ];

  it('is ready when the bot manages roles and sits above every linked one', () => {
    expect(
      botReadiness({ guildId: GUILD, botRoleIds: [B], guildRoles: roles, linkedRoleIds: [A] }),
    ).toEqual({ manageRoles: true, outranked: [], missing: [], ready: true });
  });

  it('reports linked roles at or above the bot, and ones the server lacks', () => {
    const r = botReadiness({
      guildId: GUILD,
      botRoleIds: [B],
      guildRoles: roles,
      linkedRoleIds: [A, C, OTHER, B],
    });
    expect(r).toMatchObject({ outranked: [C, B], missing: [OTHER], ready: false });
  });

  it('needs Manage Roles or Administrator, from any role including @everyone', () => {
    const plain = roles.map((r) => ({ ...r, permissions: '0' }));
    expect(
      botReadiness({ guildId: GUILD, botRoleIds: [B], guildRoles: plain, linkedRoleIds: [] })
        .manageRoles,
    ).toBe(false);
    const everyoneAdmin = plain.map((r) => (r.id === GUILD ? { ...r, permissions: '8' } : r));
    expect(
      botReadiness({
        guildId: GUILD,
        botRoleIds: [B],
        guildRoles: everyoneAdmin,
        linkedRoleIds: [],
      }).manageRoles,
    ).toBe(true);
  });
});

describe('announcements', () => {
  it('escapes Markdown and mentions in names and titles', () => {
    const text = announcementText({
      event: 'quest_completed',
      memberName: '@everyone **boss**',
      questTitle: 'Share_it',
      xp: 50,
    });
    expect(text).not.toContain('@everyone');
    expect(text).toContain(String.raw`\*\*boss\*\*`);
    expect(text).toContain(String.raw`Share\_it`);
    expect(text).toContain('(+50 XP)');
  });

  it('links a new quest', () => {
    expect(
      announcementText({
        event: 'new_quest',
        questTitle: 'Run a node',
        xp: 500,
        questUrl: 'https://community.pocket.network/quests/x',
      }),
    ).toBe('New quest: **Run a node** (500 XP)\nhttps://community.pocket.network/quests/x');
  });
});

describe('webhook settings', () => {
  const url = `https://discord.com/api/webhooks/${A}/${'t'.repeat(68)}`;

  it('accepts only Discord webhook URLs', () => {
    expect(isWebhookUrl(url)).toBe(true);
    expect(isWebhookUrl(url.replace('discord.com', 'canary.discord.com'))).toBe(true);
    for (const bad of [
      url.replace('https', 'http'),
      url.replace('discord.com', 'discord.com.evil.example'),
      url.replace('discord.com', 'evil.example'),
      `${url}?wait=true`,
      `https://discord.com/api/channels/${A}`,
      'not a url',
    ]) {
      expect(isWebhookUrl(bad), bad).toBe(false);
    }
  });

  it('masks the token', () => {
    expect(maskWebhook(url)).toBe('webhook …1111');
    expect(maskWebhook(url)).not.toContain('ttt');
  });

  it('checks the name and avatar', () => {
    expect(
      checkWebhookSettings({ webhookUrl: url, botName: 'POKT Community', avatarUrl: null }),
    ).toEqual({});
    const errors = checkWebhookSettings({
      webhookUrl: 'https://example.com',
      botName: 'My Discord bot',
      avatarUrl: 'http://example.com/a.png',
    });
    expect(Object.keys(errors).sort()).toEqual(['avatarUrl', 'botName', 'webhookUrl']);
  });
});

it('converts rank colours for Discord', () => {
  expect(roleColor('#025AF2')).toBe(0x025af2);
  expect(roleColor(null)).toBe(0);
});

it('keeps screenshots 60 days after review', () => {
  expect(proofRetentionCutoff(new Date('2026-03-02T00:00:00Z')).toISOString()).toBe(
    '2026-01-01T00:00:00.000Z',
  );
});
