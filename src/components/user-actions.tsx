"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  LuCopy,
  LuSettings,
  LuShieldAlert,
  LuShieldCheck,
  LuTrash2,
} from "react-icons/lu";
import { deleteUserAction, setUserRoleAction } from "@/app/actions/users";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { ConfirmRoleDialog } from "@/components/confirm-role-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type UserActionsProps = {
  userId: string;
  userName: string;
  role: string;
  discordId: string | null;
  email: string;
  isSelf: boolean;
  isCurrentUserSuperAdmin: boolean;
  isTargetSuperAdmin: boolean;
};

const compactControl =
  "h-8 rounded-full border border-white/15 bg-white/[0.06] text-xs font-semibold text-foreground backdrop-blur-xl hover:bg-white/10 focus:ring-1 focus:ring-primary/30";

export function UserActions({
  userId,
  userName,
  role,
  discordId,
  email,
  isSelf,
  isCurrentUserSuperAdmin,
  isTargetSuperAdmin,
}: UserActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRole, setConfirmRole] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const isAdmin = role === "admin";
  const canModifyAdminRole =
    isCurrentUserSuperAdmin && !isSelf && !isTargetSuperAdmin;
  const canDeleteUser =
    !isSelf &&
    !isTargetSuperAdmin &&
    (!isAdmin || isCurrentUserSuperAdmin);

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setError(`Could not copy ${label}.`);
    }
  }

  function onConfirmRole() {
    setError(null);
    const target = isAdmin ? "ambassador" : "admin";
    startTransition(async () => {
      const result = await setUserRoleAction(userId, target);
      if (!result.ok) {
        setError(result.error ?? "Could not update role.");
        setConfirmRole(false);
        return;
      }
      setConfirmRole(false);
      setSettingsOpen(false);
      router.refresh();
    });
  }

  function onConfirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteUserAction(userId);
      if (!result.ok) {
        setError(result.error ?? "Could not delete user.");
        setConfirmDelete(false);
        return;
      }
      setConfirmDelete(false);
      setSettingsOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={!discordId}
          onClick={() => discordId && copyText("Discord ID", discordId)}
          className={cn(
            compactControl,
            "inline-flex flex-1 items-center justify-center gap-1 px-2.5 disabled:opacity-40",
          )}
        >
          <LuCopy className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">
            {copied === "Discord ID" ? "Copied" : "Discord"}
          </span>
        </button>

        <button
          type="button"
          disabled={!email}
          onClick={() => email && copyText("email", email)}
          className={cn(
            compactControl,
            "inline-flex flex-1 items-center justify-center gap-1 px-2.5 disabled:opacity-40",
          )}
        >
          <LuCopy className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">
            {copied === "email" ? "Copied" : "Email"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setSettingsOpen(true);
          }}
          title={`Manage privileges & settings for ${userName}`}
          aria-label={`Manage privileges & settings for ${userName}`}
          className={cn(
            compactControl,
            "inline-flex h-8 w-8 shrink-0 items-center justify-center border-white/15 bg-white/[0.06] px-0 text-muted hover:border-primary/40 hover:bg-primary/15 hover:text-white transition",
          )}
        >
          <LuSettings className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {/* User Settings & Privileges Modal */}
      <Dialog
        open={settingsOpen}
        onOpenChange={(open) => {
          if (!isPending) {
            setSettingsOpen(open);
            if (!open) setError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-[#8eb6ff]">
                <LuSettings className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <DialogTitle className="truncate">
                  User settings &amp; privileges
                </DialogTitle>
                <DialogDescription className="truncate text-xs">
                  {userName} · {email}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            {/* Admin Privileges Section */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-[#8eb6ff] uppercase">
                    Admin privilege
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Current role:{" "}
                    <span className="font-semibold text-white">
                      {isTargetSuperAdmin
                        ? "Super Admin"
                        : isAdmin
                          ? "Admin"
                          : "Ambassador"}
                    </span>
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
                    isTargetSuperAdmin
                      ? "border border-[#2f6bff]/50 bg-[#2f6bff]/20 text-[#8eb6ff] shadow-[0_0_12px_rgba(47,107,255,0.25)]"
                      : isAdmin
                        ? "bg-accent/15 text-accent"
                        : "bg-white/8 text-muted",
                  )}
                >
                  {isTargetSuperAdmin
                    ? "Super Admin"
                    : isAdmin
                      ? "Admin"
                      : "Ambassador"}
                </span>
              </div>

              {isTargetSuperAdmin ? (
                <p className="text-xs text-[#8eb6ff]">
                  This account is the root Super Admin. Its privileges are permanent and cannot be revoked.
                </p>
              ) : !isCurrentUserSuperAdmin ? (
                <p className="text-xs text-muted">
                  Only Super Admin (<span className="text-white font-medium">Sufyan Khan</span>) can grant or remove admin privileges.
                </p>
              ) : isSelf ? (
                <p className="text-xs text-muted">
                  You cannot modify your own role.
                </p>
              ) : null}

              {isAdmin ? (
                <button
                  type="button"
                  disabled={!canModifyAdminRole || isPending}
                  onClick={() => {
                    setError(null);
                    setConfirmRole(true);
                  }}
                  className={cn(
                    compactControl,
                    "w-full h-9 inline-flex items-center justify-center gap-2 border-white/15 bg-white/[0.05] px-4 text-xs font-semibold text-white hover:border-amber-500/40 hover:bg-amber-500/15 hover:text-amber-200 transition disabled:opacity-40 disabled:pointer-events-none",
                  )}
                >
                  <LuShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
                  <span>Remove admin privilege</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canModifyAdminRole || isPending}
                  onClick={() => {
                    setError(null);
                    setConfirmRole(true);
                  }}
                  className={cn(
                    compactControl,
                    "w-full h-9 inline-flex items-center justify-center gap-2 border-[#2a4a7a] bg-[#1a6dff]/15 px-4 text-xs font-semibold text-[#8eb6ff] hover:bg-[#1a6dff]/25 hover:border-[#3d6bb0] hover:text-white transition disabled:opacity-40 disabled:pointer-events-none",
                  )}
                >
                  <LuShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                  <span>Grant admin privilege</span>
                </button>
              )}
            </div>

            {/* Account Removal Section */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2.5">
              <div>
                <p className="text-xs font-semibold tracking-wider text-white/80 uppercase">
                  Account removal
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {isTargetSuperAdmin
                    ? "The Super Admin account cannot be deleted."
                    : isSelf
                      ? "You cannot delete your own account."
                      : isAdmin && !isCurrentUserSuperAdmin
                        ? "Only Super Admin (Sufyan Khan) can delete an admin account."
                        : "Permanently remove this user, their submissions, and XP."}
                </p>
              </div>

              <button
                type="button"
                disabled={!canDeleteUser || isPending}
                onClick={() => {
                  setError(null);
                  setConfirmDelete(true);
                }}
                className={cn(
                  compactControl,
                  "w-full h-9 inline-flex items-center justify-center gap-2 border-white/15 bg-white/[0.06] px-4 text-xs font-semibold text-white/90 hover:border-rose-500/35 hover:bg-rose-500/10 hover:text-white transition disabled:opacity-40 disabled:pointer-events-none",
                )}
              >
                <LuTrash2 className="h-4 w-4 shrink-0 text-rose-400/80" aria-hidden />
                <span>Delete user account</span>
              </button>
            </div>

            {error ? (
              <p className="text-xs text-danger" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={confirmDelete}
        title="Delete user"
        description={
          <>
            Delete <span className="font-semibold text-white">{userName}</span>?
            Their submissions and XP will be removed. This can’t be undone.
          </>
        }
        pending={isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onConfirmDelete}
      />

      <ConfirmRoleDialog
        open={confirmRole}
        userName={userName}
        targetRole={isAdmin ? "ambassador" : "admin"}
        pending={isPending}
        onCancel={() => setConfirmRole(false)}
        onConfirm={onConfirmRole}
      />
    </div>
  );
}
