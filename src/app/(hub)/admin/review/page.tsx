import { Suspense } from "react";
import { ReviewQueue } from "@/components/review-queue";
import { listPendingSubmissions } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getProofPublicUrl } from "@/lib/supabase-server";

function ReviewFallback() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
      <div className="h-40 animate-pulse rounded-2xl border border-[#1e3a5f] bg-[#0a0f1a]/60" />
    </div>
  );
}

async function ReviewContent() {
  await requireAdmin();
  const pending = await listPendingSubmissions();

  const items = pending.map((item) => {
    let proof_image_url: string | null = null;
    if (item.proof_path) {
      try {
        proof_image_url = getProofPublicUrl(item.proof_path);
      } catch {
        proof_image_url = null;
      }
    }

    return {
      id: item.id,
      user_id: item.user_id,
      user_name: item.user_name,
      user_image: item.user_image,
      quest_title: item.quest_title,
      quest_xp: item.quest_xp,
      reward_role_name: item.reward_role_name ?? null,
      reward_role_color: item.reward_role_color ?? null,
      proof_url: item.proof_url,
      proof_urls: item.proof_urls ?? (item.proof_url ? [item.proof_url] : []),
      proof_image_url,
      createdAt:
        item.createdAt instanceof Date
          ? item.createdAt.toISOString()
          : String(item.createdAt),
    };
  });

  if (items.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-5">
        <header>
          <p className="text-xs font-medium tracking-wide text-[#8eb6ff] uppercase">
            Operations
          </p>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Review queue
          </h1>
          <p className="mt-1 text-sm text-muted">
            Search, filter, and review pending proofs.
          </p>
        </header>
        <div className="rounded-2xl border border-dashed border-[#1e3a5f] bg-[#0a0f1a]/50 px-5 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            No pending submissions
          </p>
          <p className="mt-1 text-sm text-muted">
            New proofs will show up here for review.
          </p>
        </div>
      </div>
    );
  }

  return <ReviewQueue items={items} />;
}

export default function AdminReviewPage() {
  return (
    <Suspense fallback={<ReviewFallback />}>
      <ReviewContent />
    </Suspense>
  );
}
