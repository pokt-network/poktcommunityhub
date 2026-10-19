"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuPencil, LuPlus, LuTrash2, LuX } from "react-icons/lu";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
  type CategoryActionState,
} from "@/app/actions/categories";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import type { QuestCategory } from "@/lib/db";
import { cn } from "@/lib/utils";

const initial: CategoryActionState = { ok: false };

const fieldShell =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-muted/70 focus:border-primary/40 focus:bg-white/[0.05] focus:ring-2 focus:ring-primary/25";

type CategoryManagementProps = {
  open: boolean;
  categories: QuestCategory[];
  onClose: () => void;
};

export function CategoryManagement({
  open,
  categories,
  onClose,
}: CategoryManagementProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<QuestCategory | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [createState, createAction, createPending] = useActionState(
    createCategoryAction,
    initial,
  );

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const id = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !deleteTarget) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, deleteTarget, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (createState.ok) router.refresh();
  }, [createState.ok, router]);

  function startEdit(cat: QuestCategory) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setActionError(null);
  }

  function saveEdit() {
    if (!editingId) return;
    setActionError(null);
    startTransition(async () => {
      const result = await updateCategoryAction(editingId, editName);
      if (!result.ok) {
        setActionError(result.error ?? "Could not rename category.");
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setActionError(null);
    startTransition(async () => {
      const result = await deleteCategoryAction(deleteTarget.id);
      if (!result.ok) {
        setActionError(result.error ?? "Could not delete category.");
        return;
      }
      setDeleteTarget(null);
      router.refresh();
    });
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
        <button
          type="button"
          aria-label="Close categories backdrop"
          className={cn(
            "absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-200",
            visible ? "opacity-100" : "opacity-0",
          )}
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Manage categories"
          className={cn(
            "relative z-10 flex max-h-[min(88dvh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(14,22,38,0.99)_0%,rgba(8,12,20,1)_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.55)] transition-all duration-200 sm:rounded-2xl",
            visible
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-4 scale-[0.98] opacity-0 sm:translate-y-2",
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wide text-[#8eb6ff] uppercase">
                Board
              </p>
              <h2 className="font-display mt-0.5 text-base font-semibold text-white sm:text-lg">
                Manage categories
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-muted transition hover:border-white/25 hover:text-white"
            >
              <LuX className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            <form action={createAction} className="flex gap-2">
              <input
                name="name"
                required
                maxLength={40}
                placeholder="New category name"
                className={cn(fieldShell, "min-w-0 flex-1")}
                aria-label="New category name"
              />
              <Button
                type="submit"
                disabled={createPending}
                className="h-auto shrink-0 rounded-xl bg-primary px-3.5 text-sm font-semibold text-white hover:bg-primary-hover"
              >
                <LuPlus className="h-4 w-4" aria-hidden />
                {createPending ? "Adding…" : "Add"}
              </Button>
            </form>

            {createState.error ? (
              <p className="text-sm text-danger" role="alert">
                {createState.error}
              </p>
            ) : null}
            {actionError ? (
              <p className="text-sm text-danger" role="alert">
                {actionError}
              </p>
            ) : null}

            {categories.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted">
                No categories yet. Add one to start tagging quests.
              </p>
            ) : (
              <ul className="space-y-2">
                {categories.map((cat) => {
                  const editing = editingId === cat.id;
                  return (
                    <li
                      key={cat.id}
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                    >
                      {editing ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          maxLength={40}
                          className={cn(fieldShell, "min-w-0 flex-1 py-2")}
                          aria-label="Rename category"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveEdit();
                            }
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                      ) : (
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-white">
                            {cat.name}
                          </p>
                          <p className="text-[11px] text-muted tabular-nums">
                            {cat.quest_count ?? 0} quest
                            {(cat.quest_count ?? 0) === 1 ? "" : "s"}
                          </p>
                        </div>
                      )}

                      <div className="flex shrink-0 items-center gap-1">
                        {editing ? (
                          <>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={saveEdit}
                              className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-full px-2.5 py-1.5 text-xs font-medium text-muted transition hover:text-white"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(cat)}
                              aria-label={`Rename ${cat.name}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-muted transition hover:border-white/25 hover:text-white"
                            >
                              <LuPencil className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(cat)}
                              aria-label={`Delete ${cat.name}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-muted transition hover:border-white/25 hover:text-white"
                            >
                              <LuTrash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title="Delete category"
        description={
          <>
            Delete{" "}
            <span className="font-semibold text-white">
              {deleteTarget?.name}
            </span>
            ? Quests in this category keep their content and become uncategorized
            until you assign another one.
          </>
        }
        pending={isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
