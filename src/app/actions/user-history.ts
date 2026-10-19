"use server";

import {
  getManagedUserById,
  getUserLeaderboardRank,
  getUserQuestHistory,
  type UserQuestHistoryItem,
} from "@/lib/db";
import { getSession } from "@/lib/session";

export type UserHistoryProfile = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  totalXp: number;
  discordId: string | null;
  createdAt: string;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  leaderboardRank: number | null;
  roles: Array<{
    id: string;
    name: string;
    color: string;
    xp_required: number;
  }>;
};

export type UserHistoryResponse = {
  ok: boolean;
  error?: string;
  user?: UserHistoryProfile;
  history?: UserQuestHistoryItem[];
  isPrivileged?: boolean;
};

export async function getUserQuestHistoryAction(
  userId: string,
): Promise<UserHistoryResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return { ok: false, error: "Please sign in to view quest history." };
    }

    const id = String(userId ?? "").trim();
    if (!id) {
      return { ok: false, error: "Invalid user identifier." };
    }

    const isAdmin = session.user.role === "admin";
    const isSelf = session.user.id === id;
    if (!isAdmin && !isSelf) {
      return {
        ok: false,
        error: "You can only view your own quest history.",
      };
    }

    const [managedUser, rank, history] = await Promise.all([
      getManagedUserById(id),
      getUserLeaderboardRank(id),
      getUserQuestHistory(id),
    ]);

    if (!managedUser) {
      return { ok: false, error: "User not found." };
    }

    return {
      ok: true,
      isPrivileged: true,
      user: {
        id: managedUser.id,
        name: managedUser.name,
        email: managedUser.email,
        image: managedUser.image,
        role: managedUser.role,
        totalXp: managedUser.totalXp,
        discordId: managedUser.discordId,
        createdAt:
          managedUser.createdAt instanceof Date
            ? managedUser.createdAt.toISOString()
            : String(managedUser.createdAt),
        pendingCount: managedUser.pendingCount,
        approvedCount: managedUser.approvedCount,
        rejectedCount: managedUser.rejectedCount,
        leaderboardRank: rank,
        roles: managedUser.roles ?? [],
      },
      history,
    };
  } catch (err) {
    console.error("getUserQuestHistoryAction error:", err);
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Failed to load quest history.",
    };
  }
}
