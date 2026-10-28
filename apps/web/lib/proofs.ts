import 'server-only';

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

/**
 * Proof screenshots (flow 3; brief sections 4.6, 9.6 and 12.3).
 *
 * An upload is accepted only if its first bytes say PNG, JPEG or WebP, whatever
 * the browser claimed. It is then decoded and drawn again as a fresh WebP: the
 * metadata (EXIF, GPS location, comments) does not survive, and neither does
 * anything appended to or hidden inside the original. Files live on the proofs
 * volume under random names and are served only by app/proofs/[id]/route.ts.
 */

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

/** Larger than any screen; refuses decompression bombs before they are decoded. */
const MAX_INPUT_PIXELS = 40_000_000;

export type ImageType = 'png' | 'jpeg' | 'webp';

/** The image type by magic bytes, or null. */
export function sniffImage(bytes: Uint8Array): ImageType | null {
  const starts = (sig: number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (starts([0xff, 0xd8, 0xff])) return 'jpeg';
  // RIFF....WEBP
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
  return null;
}

export type ProofImageError = 'too_large' | 'not_an_image' | 'unreadable';

/** Check and redraw an upload. Returns WebP bytes with no metadata, or why not. */
export async function reencodeProof(
  bytes: Uint8Array,
): Promise<{ ok: true; webp: Buffer } | { ok: false; reason: ProofImageError }> {
  if (bytes.byteLength > MAX_PROOF_BYTES) return { ok: false, reason: 'too_large' };
  if (sniffImage(bytes) === null) return { ok: false, reason: 'not_an_image' };
  try {
    const webp = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
      // Apply the EXIF orientation to the pixels before the EXIF is dropped.
      .rotate()
      .webp({ quality: 85 })
      .toBuffer();
    return { ok: true, webp };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}

/** Names this module writes, and the only names it will read or delete. */
const NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

function pathFor(dir: string, name: string): string {
  if (!NAME.test(name)) throw new Error('not a proof file name');
  return path.join(dir, name);
}

/** Write a re-encoded proof; returns the name stored in submissions.proof_file. */
export async function saveProof(dir: string, webp: Buffer): Promise<string> {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const name = `${randomUUID()}.webp`;
  await writeFile(pathFor(dir, name), webp, { mode: 0o600, flag: 'wx' });
  return name;
}

export async function readProof(dir: string, name: string): Promise<Buffer | null> {
  try {
    return await readFile(pathFor(dir, name));
  } catch {
    return null;
  }
}

/** Delete a proof; a file already gone is not an error. */
export async function deleteProof(dir: string, name: string): Promise<void> {
  await rm(pathFor(dir, name), { force: true });
}
