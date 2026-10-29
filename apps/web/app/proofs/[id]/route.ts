import { isStaff } from '@community/core';
import { proofFile } from '@community/store';

import { requireUser } from '@/lib/authz';
import { webConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/ids';
import { readProof } from '@/lib/proofs';

const notFound = () => new Response('Not found', { status: 404 });

/**
 * A proof screenshot (brief section 4.6): only to the submission's owner and to
 * admins. Anyone else gets the same 404 as a submission that does not exist, so
 * the route cannot be used to learn which ids are real.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireUser();
  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const proof = await proofFile(db(), id);
  if (proof === null || (proof.userId !== viewer.id && !isStaff(viewer.role))) return notFound();

  const bytes = await readProof(webConfig().PROOFS_DIR, proof.file);
  if (bytes === null) return notFound();

  return new Response(new Uint8Array(bytes), {
    headers: {
      // Every stored proof was redrawn as WebP (lib/proofs.ts), whatever was uploaded.
      'Content-Type': 'image/webp',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
