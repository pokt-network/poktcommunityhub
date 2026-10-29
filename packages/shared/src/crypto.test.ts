import { describe, expect, it } from 'vitest';

import { decryptSetting, encryptSetting } from './crypto.js';

const KEY = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);
const URL = 'https://discord.com/api/webhooks/111111111111111111/token';

describe('settings encryption', () => {
  it('round-trips, with a fresh IV every time', () => {
    const one = encryptSetting(URL, KEY, 'webhook');
    const two = encryptSetting(URL, KEY, 'webhook');
    expect(one).not.toBe(two);
    expect(one).not.toContain('token');
    expect(decryptSetting(one, KEY, 'webhook')).toBe(URL);
  });

  it('refuses another key, another purpose, or a tampered value', () => {
    const stored = encryptSetting(URL, KEY, 'webhook');
    expect(decryptSetting(stored, OTHER, 'webhook')).toBeNull();
    expect(decryptSetting(stored, KEY, 'avatar')).toBeNull();
    const parts = stored.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(decryptSetting(parts.join('.'), KEY, 'webhook')).toBeNull();
    expect(decryptSetting('plaintext', KEY, 'webhook')).toBeNull();
  });

  it('rejects a key that is not 32 bytes of hex', () => {
    expect(() => encryptSetting(URL, 'short', 'webhook')).toThrow(/64 hex/);
  });
});
