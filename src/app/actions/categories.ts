"use server";

import { revalidatePath } from "next/cache";
import {
  createQuestCategory,
  deleteQuestCategory,
  updateQuestCategory,
} from "@/lib/db";
import { getSession } from "@/lib/session";

export type CategoryActionState = {
  ok: boolean;
  error?: string;
};

async function requireAdminSession() {
  const session = await getSession();
  if (!session) {
    return { error: "Please sign in again." as const };
  }
  if (session.user.role !== "admin") {
    return { error: "Admin access required." as const };
  }
  return { session };
}

function revalidateQuestPaths() {
  revalidatePath("/admin/quests");
  revalidatePath("/quests");
  revalidatePath("/");
}

export async function createCategoryAction(
  _prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }

    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      return { ok: false, error: "Category name is required." };
    }
    if (name.length > 40) {
      return { ok: false, error: "Keep category names under 40 characters." };
    }

    await createQuestCategory(name);
    revalidateQuestPaths();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed.";
    if (/unique|duplicate/i.test(message)) {
      return { ok: false, error: "That category already exists." };
    }
    return { ok: false, error: message };
  }
}

export async function updateCategoryAction(
  categoryId: string,
  name: string,
): Promise<CategoryActionState> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }

    const id = String(categoryId ?? "").trim();
    const next = String(name ?? "").trim();
    if (!id) return { ok: false, error: "Missing category." };
    if (!next) return { ok: false, error: "Category name is required." };
    if (next.length > 40) {
      return { ok: false, error: "Keep category names under 40 characters." };
    }

    const updated = await updateQuestCategory(id, next);
    if (!updated) return { ok: false, error: "Category not found." };

    revalidateQuestPaths();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed.";
    if (/unique|duplicate/i.test(message)) {
      return { ok: false, error: "That category already exists." };
    }
    return { ok: false, error: message };
  }
}

export async function deleteCategoryAction(
  categoryId: string,
): Promise<CategoryActionState> {
  try {
    const authz = await requireAdminSession();
    if ("error" in authz) {
      return { ok: false, error: authz.error };
    }

    const id = String(categoryId ?? "").trim();
    if (!id) return { ok: false, error: "Missing category." };

    const deleted = await deleteQuestCategory(id);
    if (!deleted) return { ok: false, error: "Category not found." };

    revalidateQuestPaths();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Delete failed.",
    };
  }
}
