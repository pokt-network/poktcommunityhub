import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Settings that are secrets at rest (brief section 9.7: the announcements
 * webhook URL, whose token lets anyone post as the hub). AES-256-GCM with
 * SETTINGS_ENCRYPTION_KEY, 32 bytes as 64 hex characters, from 1Password.
 *
 * The stored form is `v1.<iv>.<tag>.<ciphertext>`, each part base64url. The
 * version prefix leaves room to change the scheme without guessing at old rows.
 * `purpose` is bound in as associated data, so a ciphertext saved for one
 * setting does not decrypt as another.
 */

const VERSION = 'v1';

function keyBytes(keyHex: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex))
    throw new Error('the settings key must be 64 hex characters');
  return Buffer.from(keyHex, 'hex');
}

export function encryptSetting(plaintext: string, keyHex: string, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(keyHex), iv);
  cipher.setAAD(Buffer.from(purpose, 'utf8'));
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), body]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

/**
 * The plaintext, or null when the value was not encrypted with this key and
 * purpose (a rotated key, a tampered row). Callers treat null as "not set".
 */
export function decryptSetting(stored: string, keyHex: string, purpose: string): string | null {
  const parts = stored.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  const [, iv, tag, body] = parts.map((part) => Buffer.from(part, 'base64url'));
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyBytes(keyHex), iv!);
    decipher.setAAD(Buffer.from(purpose, 'utf8'));
    decipher.setAuthTag(tag!);
    return Buffer.concat([decipher.update(body!), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
