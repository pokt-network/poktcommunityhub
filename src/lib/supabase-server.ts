import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const PROOFS_BUCKET = "proofs";

let serviceClient: SupabaseClient | null = null;

/** Server-only Supabase client (service role). Never import in client components. */
export function createSupabaseServiceClient() {
  if (serviceClient) return serviceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

export function getProofPublicUrl(path: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return `${url}/storage/v1/object/public/${PROOFS_BUCKET}/${path}`;
}

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const MAX_BYTES = 5 * 1024 * 1024;

export async function uploadProofFile(input: {
  userId: string;
  questId: string;
  file: File;
}) {
  const { userId, questId, file } = input;

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Screenshot must be PNG, JPEG, or WebP.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Screenshot must be 5MB or smaller.");
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const path = `${userId}/${questId}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const supabase = createSupabaseServiceClient();

  const { error } = await supabase.storage
    .from(PROOFS_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || "Failed to upload screenshot.");
  }

  return path;
}

/** Delete proof files under a user/quest folder (used after approval). */
export async function deleteProofFilesForSubmission(input: {
  userId: string;
  questId: string;
  proofPath?: string | null;
}) {
  const { userId, questId, proofPath } = input;
  const supabase = createSupabaseServiceClient();
  const prefix = `${userId}/${questId}`;
  const paths = new Set<string>();

  if (proofPath) paths.add(proofPath);

  const { data: listed, error: listError } = await supabase.storage
    .from(PROOFS_BUCKET)
    .list(prefix, { limit: 100 });

  if (!listError && listed?.length) {
    for (const item of listed) {
      if (item.name) paths.add(`${prefix}/${item.name}`);
    }
  }

  if (paths.size === 0) return;

  const { error } = await supabase.storage
    .from(PROOFS_BUCKET)
    .remove([...paths]);

  if (error) {
    throw new Error(error.message || "Failed to delete proof files.");
  }
}

/** Delete a single proof file by path from Storage */
export async function deleteProofFile(path: string) {
  if (!path) return;
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.storage.from(PROOFS_BUCKET).remove([path]);
  if (error) {
    console.warn(`[deleteProofFile] Could not delete ${path}:`, error.message);
  }
}

const WEBHOOK_AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** Upload a public webhook avatar image; returns the public HTTPS URL. */
export async function uploadWebhookAvatarFile(file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Avatar must be PNG, JPEG, or WebP.");
  }
  if (file.size > WEBHOOK_AVATAR_MAX_BYTES) {
    throw new Error("Avatar must be 2MB or smaller.");
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const path = `webhook-avatar/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const supabase = createSupabaseServiceClient();

  const { error } = await supabase.storage.from(PROOFS_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || "Failed to upload avatar.");
  }

  return getProofPublicUrl(path);
}
