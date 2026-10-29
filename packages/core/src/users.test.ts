import { describe, expect, it } from 'vitest';

import { initialRole, isStaff, planRoleChange, planUserDeletion, type UserRole } from './users.js';

const LISTED = '111111111111111111';
const OTHER = '222222222222222222';

describe('initialRole', () => {
  it('makes a listed id the owner while there is no staff', () => {
    expect(initialRole({ discordId: LISTED, bootstrapIds: [LISTED], staffCount: 0 })).toBe('owner');
  });

  it('ignores the list once anyone is staff', () => {
    expect(initialRole({ discordId: LISTED, bootstrapIds: [LISTED], staffCount: 1 })).toBe(
      'ambassador',
    );
  });

  it('never makes an unlisted id staff, even with no staff', () => {
    expect(initialRole({ discordId: OTHER, bootstrapIds: [LISTED], staffCount: 0 })).toBe(
      'ambassador',
    );
    expect(initialRole({ discordId: OTHER, bootstrapIds: [], staffCount: 0 })).toBe('ambassador');
  });
});

describe('isStaff', () => {
  it('is admins and the owner', () => {
    expect((['ambassador', 'admin', 'owner'] as const).map(isStaff)).toEqual([false, true, true]);
  });
});

const owner = { id: 'o', role: 'owner' as UserRole };
const admin = { id: 'a', role: 'admin' as UserRole };
const admin2 = { id: 'a2', role: 'admin' as UserRole };
const amb = { id: 'm', role: 'ambassador' as UserRole };

describe('planRoleChange', () => {
  it('lets the owner promote and demote', () => {
    expect(planRoleChange({ actor: owner, target: amb, to: 'admin' })).toEqual({ ok: true });
    expect(planRoleChange({ actor: owner, target: admin, to: 'ambassador' })).toEqual({ ok: true });
  });

  it('never lets an admin change roles: not to promote, not to demote anyone', () => {
    for (const [target, to] of [
      [amb, 'admin'],
      [admin2, 'ambassador'],
      [owner, 'ambassador'],
      [admin, 'ambassador'],
    ] as const) {
      expect(planRoleChange({ actor: admin, target, to })).toEqual({
        ok: false,
        reason: 'owner_only',
      });
    }
    expect(planRoleChange({ actor: amb, target: amb, to: 'admin' })).toEqual({
      ok: false,
      reason: 'owner_only',
    });
  });

  it('protects the owner, even from themselves', () => {
    expect(planRoleChange({ actor: owner, target: owner, to: 'admin' })).toEqual({
      ok: false,
      reason: 'self',
    });
    const otherOwner = { id: 'o2', role: 'owner' as UserRole };
    expect(planRoleChange({ actor: owner, target: otherOwner, to: 'admin' })).toEqual({
      ok: false,
      reason: 'owner_protected',
    });
  });

  it('refuses a change to the role already held', () => {
    expect(planRoleChange({ actor: owner, target: admin, to: 'admin' })).toEqual({
      ok: false,
      reason: 'unchanged',
    });
  });
});

describe('planUserDeletion', () => {
  it('lets admins delete ambassadors, and only the owner delete admins', () => {
    expect(planUserDeletion({ actor: admin, target: amb })).toEqual({ ok: true });
    expect(planUserDeletion({ actor: owner, target: amb })).toEqual({ ok: true });
    expect(planUserDeletion({ actor: owner, target: admin })).toEqual({ ok: true });
    expect(planUserDeletion({ actor: admin, target: admin2 })).toEqual({
      ok: false,
      reason: 'not_permitted',
    });
  });

  it('never deletes the owner or yourself', () => {
    expect(planUserDeletion({ actor: admin, target: owner })).toEqual({
      ok: false,
      reason: 'owner_protected',
    });
    expect(planUserDeletion({ actor: owner, target: owner })).toEqual({
      ok: false,
      reason: 'self',
    });
    expect(planUserDeletion({ actor: admin, target: admin })).toEqual({
      ok: false,
      reason: 'self',
    });
  });

  it('refuses an ambassador outright', () => {
    expect(planUserDeletion({ actor: amb, target: { id: 'x', role: 'ambassador' } })).toEqual({
      ok: false,
      reason: 'not_permitted',
    });
  });
});
