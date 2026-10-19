"use server";

import { revalidatePath } from "next/cache";
import {
  getActiveQuestById,
  getQuestById,
  getUserSubmission,
  upsertSubmission,
} from "@/lib/db";
import { scheduleClosedMessage } from "@/lib/quest-schedule";
import { checkSubmissionRateLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import {
  deleteProofFile,
  getProofPublicUrl,
  uploadProofFile,
} from "@/lib/supabase-server";

export type SubmissionActionState = {
  ok: boolean;
  error?: string;
  submittedAt?: number;
  proofImageUrl?: string | null;
  proofUrls?: string[];
};

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getUploadFile(formData: FormData): File | null {
  const value = formData.get("screenshot");
  if (!(value instanceof File) || value.size <= 0) {
    return null;
  }
  return value;
}

function collectProofUrls(formData: FormData): string[] {
  const urls: string[] = [];
  const declared = Number.parseInt(String(formData.get("linkCount") ?? "1"), 10);
  const count = Number.isFinite(declared)
    ? Math.min(8, Math.max(1, declared))
    : 1;

  for (let i = 0; i < count; i += 1) {
    const value = String(formData.get(`proofUrl-${i}`) ?? "").trim();
    if (value) urls.push(value);
  }

  // Legacy single-field fallback
  const legacy = String(formData.get("proofUrl") ?? "").trim();
  if (!urls.length && legacy) urls.push(legacy);

  return urls;
}

export async function submitProofAction(
  _prev: SubmissionActionState,
  formData: FormData,
): Promise<SubmissionActionState> {
  try {
    const session = await getSession();
    if (!session) {
      return { ok: false, error: "Please sign in again." };
    }

    const questId = String(formData.get("questId") ?? "").trim();
    const file = getUploadFile(formData);

    if (!questId) {
      return { ok: false, error: "Missing quest." };
    }

    // Rate limiting: protects storage and database from rapid bursts / spam loops
    const rateLimitCheck = await checkSubmissionRateLimit(
      session.user.id,
      Boolean(file),
    );
    if (!rateLimitCheck.allowed) {
      return {
        ok: false,
        error:
          rateLimitCheck.error ??
          "You're submitting proofs too quickly. Please wait a moment.",
      };
    }

    const quest = await getActiveQuestById(questId);
    if (!quest) {
      return {
        ok: false,
        error: scheduleClosedMessage(await getQuestById(questId)),
      };
    }

    const existing = await getUserSubmission(session.user.id, questId);
    if (existing?.status === "approved") {
      return { ok: false, error: "This quest is already approved." };
    }

    const requiredLinks = Math.min(8, Math.max(1, quest.link_count ?? 1));
    const proofUrls = collectProofUrls(formData);

    for (const url of proofUrls) {
      if (!isValidHttpUrl(url)) {
        return { ok: false, error: "Each proof URL must be a valid http(s) link." };
      }
    }

    if (proofUrls.length > 0 && proofUrls.length < requiredLinks) {
      return {
        ok: false,
        error: `This quest needs ${requiredLinks} proof URL${requiredLinks === 1 ? "" : "s"}.`,
      };
    }

    if (!proofUrls.length && !file && !existing?.proof_path) {
      return {
        ok: false,
        error: "Add proof URL(s) and/or a screenshot.",
      };
    }

    let proofPath: string | null = null;
    if (file) {
      proofPath = await uploadProofFile({
        userId: session.user.id,
        questId,
        file,
      });
    }

    try {
      await upsertSubmission({
        userId: session.user.id,
        questId,
        proofUrl: proofUrls[0] ?? null,
        proofUrls,
        proofPath,
      });
    } catch (upsertErr) {
      // If DB upsert failed, clean up the newly uploaded file to avoid orphaned storage objects
      if (proofPath) {
        deleteProofFile(proofPath).catch(() => {});
      }
      throw upsertErr;
    }

    // If a new screenshot replaced an existing screenshot, clean up the old file in storage
    if (proofPath && existing?.proof_path && existing.proof_path !== proofPath) {
      deleteProofFile(existing.proof_path).catch(() => {});
    }

    const finalProofPath = proofPath ?? existing?.proof_path ?? null;
    let proofImageUrl: string | null = null;
    if (finalProofPath) {
      try {
        proofImageUrl = getProofPublicUrl(finalProofPath);
      } catch {
        proofImageUrl = null;
      }
    }

    revalidatePath("/");
    revalidatePath("/quests");
    revalidatePath(`/quests/${questId}`);
    revalidatePath("/admin");
    revalidatePath("/dashboard");

    return {
      ok: true,
      submittedAt: Date.now(),
      proofImageUrl,
      proofUrls,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong.";
    if (/body|size|too large|413/i.test(message)) {
      return {
        ok: false,
        error: "Screenshot is too large. Use an image under 5MB.",
      };
    }
    return { ok: false, error: message };
  }
}
