import { describe, expect, it } from 'vitest';

import { initialRole } from './users.js';

const LISTED = '111111111111111111';
const OTHER = '222222222222222222';

describe('initialRole', () => {
  it('makes a listed id admin while there are no admins', () => {
    expect(initialRole({ discordId: LISTED, bootstrapIds: [LISTED], adminCount: 0 })).toBe('admin');
  });

  it('ignores the list once any admin exists', () => {
    expect(initialRole({ discordId: LISTED, bootstrapIds: [LISTED], adminCount: 1 })).toBe(
      'ambassador',
    );
  });

  it('never makes an unlisted id admin, even with no admins', () => {
    expect(initialRole({ discordId: OTHER, bootstrapIds: [LISTED], adminCount: 0 })).toBe(
      'ambassador',
    );
    expect(initialRole({ discordId: OTHER, bootstrapIds: [], adminCount: 0 })).toBe('ambassador');
  });
});
