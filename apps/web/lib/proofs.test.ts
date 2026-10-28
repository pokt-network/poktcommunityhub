import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';

import {
  deleteProof,
  MAX_PROOF_BYTES,
  readProof,
  reencodeProof,
  saveProof,
  sniffImage,
} from './proofs';

const pixel = (format: 'png' | 'jpeg' | 'webp') =>
  sharp({ create: { width: 8, height: 4, channels: 3, background: '#025af2' } })
    .toFormat(format)
    .toBuffer();

describe('sniffImage', () => {
  it('knows PNG, JPEG and WebP by their bytes', async () => {
    expect(sniffImage(await pixel('png'))).toBe('png');
    expect(sniffImage(await pixel('jpeg'))).toBe('jpeg');
    expect(sniffImage(await pixel('webp'))).toBe('webp');
  });

  it('refuses anything else, whatever it is called', () => {
    expect(sniffImage(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
    expect(sniffImage(new TextEncoder().encode('GIF89a'))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe('reencodeProof', () => {
  it('redraws each accepted type as WebP of the same size', async () => {
    for (const format of ['png', 'jpeg', 'webp'] as const) {
      const result = await reencodeProof(await pixel(format));
      if (!result.ok) throw new Error(result.reason);
      expect(sniffImage(result.webp)).toBe('webp');
      expect(await sharp(result.webp).metadata()).toMatchObject({ width: 8, height: 4 });
    }
  });

  it('drops EXIF, including GPS location', async () => {
    const tagged = await sharp(await pixel('jpeg'))
      .withExif({ IFD0: { Make: 'TattleCam' }, IFD3: { GPSLatitudeRef: 'N' } })
      .jpeg()
      .toBuffer();
    expect((await sharp(tagged).metadata()).exif).toBeDefined();

    const result = await reencodeProof(tagged);
    if (!result.ok) throw new Error(result.reason);
    const meta = await sharp(result.webp).metadata();
    expect(meta.exif).toBeUndefined();
    expect(result.webp.includes('TattleCam')).toBe(false);
  });

  it('drops bytes appended after the image', async () => {
    const smuggled = Buffer.concat([await pixel('png'), Buffer.from('<script>steal()</script>')]);
    const result = await reencodeProof(smuggled);
    if (!result.ok) throw new Error(result.reason);
    expect(result.webp.includes('steal()')).toBe(false);
  });

  it('refuses oversized, non-image and corrupt uploads', async () => {
    expect(await reencodeProof(new Uint8Array(MAX_PROOF_BYTES + 1))).toEqual({
      ok: false,
      reason: 'too_large',
    });
    expect(await reencodeProof(new TextEncoder().encode('hello'))).toEqual({
      ok: false,
      reason: 'not_an_image',
    });
    const truncated = (await pixel('png')).subarray(0, 20);
    expect(await reencodeProof(truncated)).toEqual({ ok: false, reason: 'unreadable' });
  });
});

describe('proof storage', () => {
  const dirs: string[] = [];
  afterAll(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));
  const tempDir = async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'proofs-'));
    dirs.push(dir);
    return path.join(dir, 'nested');
  };

  it('saves under a random name, reads back and deletes', async () => {
    const dir = await tempDir();
    const name = await saveProof(dir, Buffer.from('webp'));
    expect(name).toMatch(/^[0-9a-f-]{36}\.webp$/);
    expect(await readProof(dir, name)).toEqual(Buffer.from('webp'));
    await deleteProof(dir, name);
    expect(await readdir(dir)).toEqual([]);
    expect(await readProof(dir, name)).toBeNull();
    await deleteProof(dir, name); // already gone: fine
  });

  it('will not touch a name it did not make', async () => {
    const dir = await tempDir();
    await expect(readProof(dir, '../../etc/passwd')).resolves.toBeNull();
    await expect(deleteProof(dir, '../secrets.webp')).rejects.toThrow('not a proof file name');
  });
});
