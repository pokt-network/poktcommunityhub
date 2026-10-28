/** What liveness needs to know about a quest. */
export type QuestSchedule = {
  status: 'active' | 'closed';
  startsAt: Date | null;
  endsAt: Date | null;
};

export type QuestPhase = 'live' | 'scheduled' | 'ended' | 'closed';

/**
 * Where a quest stands at `now`. The window is half-open, [startsAt, endsAt):
 * at exactly `endsAt` the quest has ended, so a submission and the deadline can
 * never both claim the same instant.
 */
export function questPhase(quest: QuestSchedule, now: Date): QuestPhase {
  if (quest.status === 'closed') return 'closed';
  if (quest.startsAt !== null && now < quest.startsAt) return 'scheduled';
  if (quest.endsAt !== null && now >= quest.endsAt) return 'ended';
  return 'live';
}

/** Flow 2: a quest is live when it is active and `now` is inside its window. */
export function isQuestLive(quest: QuestSchedule, now: Date): boolean {
  return questPhase(quest, now) === 'live';
}

/** The leaderboard's month: [start, end) in UTC. */
export function monthWindow(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}
