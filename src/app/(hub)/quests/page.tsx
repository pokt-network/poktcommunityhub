import { Suspense } from "react";
import { AmbassadorQuests } from "@/components/ambassador-quests";
import {
  listActiveQuests,
  listActiveQuestsForUser,
  listQuestCategories,
} from "@/lib/db";
import { toQuestListItem } from "@/lib/quest-filters";
import { getSession } from "@/lib/session";

function QuestsFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <div className="h-40 animate-pulse rounded-[1.75rem] border border-white/10 bg-white/[0.03]" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-52 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
          />
        ))}
      </div>
    </div>
  );
}

async function QuestsContent() {
  const session = await getSession();

  const [categories, quests] = await Promise.all([
    listQuestCategories(),
    session
      ? listActiveQuestsForUser(session.user.id).then((rows) =>
          rows.map(toQuestListItem),
        )
      : listActiveQuests(100, { includeUpcoming: true }).then((rows) =>
          rows.map((q) =>
            toQuestListItem({
              ...q,
              submission_status: null,
              submission_created_at: null,
            }),
          ),
        ),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <AmbassadorQuests
        quests={quests}
        categories={categories}
        variant="board"
        title="Quests"
        subtitle="Complete tasks, earn XP and unlock rewards."
        totalXp={session?.user.totalXp ?? 0}
        authenticated={Boolean(session)}
        authCallbackURL="/quests"
      />
    </main>
  );
}

export default function QuestsPage() {
  return (
    <Suspense fallback={<QuestsFallback />}>
      <QuestsContent />
    </Suspense>
  );
}
