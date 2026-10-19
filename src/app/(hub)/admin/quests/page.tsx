import { Suspense } from "react";
import { QuestBoardList } from "@/components/quest-admin-forms";
import {
  listAllQuests,
  listQuestCategories,
  listServerRoles,
} from "@/lib/db";
import { requireAdmin } from "@/lib/session";

function AdminQuestsFallback() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
      <div className="h-48 animate-pulse rounded-2xl border border-[#1e3a5f] bg-[#0a0f1a]/60" />
    </div>
  );
}

async function AdminQuestsContent() {
  await requireAdmin();
  const [quests, roles, categories] = await Promise.all([
    listAllQuests(),
    listServerRoles(),
    listQuestCategories(),
  ]);

  return (
    <QuestBoardList quests={quests} roles={roles} categories={categories} />
  );
}

export default function AdminQuestsPage() {
  return (
    <Suspense fallback={<AdminQuestsFallback />}>
      <AdminQuestsContent />
    </Suspense>
  );
}
