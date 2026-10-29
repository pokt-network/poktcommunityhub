'use server';

import {
  checkCategoryName,
  checkQuest,
  checkRank,
  type QuestInput,
  type RankInput,
  type ReviewAction,
} from '@community/core';
import {
  assignRank,
  createCategory,
  createQuest,
  createRank,
  deleteCategory,
  deleteQuest,
  deleteRank,
  deleteUser,
  moveCategory,
  moveRank,
  removeRank,
  renameCategory,
  reviewSubmission,
  setQuestStatus,
  setUserRole,
  updateQuest,
  updateRank,
  type CatalogRefusal,
  type ReviewResult,
  type StaffResult,
} from '@community/store';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { adminAction } from './actions';
import { webConfig } from './config';
import { db } from './db';
import {
  describeErrors,
  integer,
  optionalInteger,
  optionalText,
  optionalUtcDate,
  optionalUuid,
  text,
  type FormState,
} from './forms';
import { isUuid } from './ids';
import { log } from './log';
import { deleteProof } from './proofs';

/**
 * The admin console's actions (flows 8 to 12). Each is declared through
 * adminAction, so a non-admin is refused before anything here runs; the
 * owner-only rules (section 13.1) are enforced again in the store, from the
 * database's own record of who the actor is.
 *
 * Every action answers a FormState for ActionForm: an error to show, or a
 * notice. Anything that changes what members see revalidates their pages.
 */

const ok = (notice: string | null = null): FormState => ({ error: null, notice });
const fail = (error: string): FormState => ({ error, notice: null });
const MISSING = fail('That item no longer exists. Reload the page.');

const CATALOG_ERRORS: Record<CatalogRefusal, string> = {
  not_found: 'That item no longer exists. Reload the page.',
  invalid_reference: 'The category or reward rank chosen no longer exists. Reload the page.',
  duplicate: 'That name is already taken.',
  in_use: 'Members have submitted proof for this quest, so it can only be closed, not deleted.',
};

const memberPages = () => {
  revalidatePath('/', 'layout');
};

// ── Review (flow 8) ──────────────────────────────────────────────────────────

const REVIEW_ERRORS: Record<Exclude<ReviewResult, { ok: true }>['reason'], string> = {
  not_found: 'That submission no longer exists.',
  conflict: 'Another admin reviewed this at the same moment. Reload the queue.',
  not_pending: 'This submission has already been reviewed. Reload the queue.',
  not_reviewed: 'This submission has not been reviewed yet.',
  ledger_inconsistent:
    'The XP ledger disagrees with this submission. Nothing was changed; this needs a developer.',
  own_submission: 'You cannot review your own submission. Ask another admin.',
  note_required: 'Say why it is rejected: the member sees the note when they resubmit.',
  note_too_long: 'The note is too long (1,000 characters at most).',
};

const REVIEW_ACTIONS: readonly ReviewAction[] = ['approve', 'reject', 'undo'];

export const reviewAction = adminAction(
  'review',
  async (admin, _state: FormState, form: FormData): Promise<FormState> => {
    const submissionId = text(form, 'submissionId');
    const action = REVIEW_ACTIONS.find((a) => a === text(form, 'action'));
    if (!isUuid(submissionId) || action === undefined) return MISSING;

    const result = await reviewSubmission(db(), {
      submissionId,
      action,
      actorId: admin.id,
      note: optionalText(form, 'note'),
    });
    if (!result.ok) {
      if (result.reason === 'ledger_inconsistent') {
        log().error({ submissionId, action }, 'review refused: ledger inconsistent');
      }
      return fail(REVIEW_ERRORS[result.reason]);
    }
    revalidatePath('/admin', 'layout');
    memberPages();
    const done = { approve: 'Approved', reject: 'Rejected', undo: 'Returned to the queue' }[action];
    return ok(
      result.xpDelta === 0
        ? `${done}.`
        : `${done}: ${result.xpDelta > 0 ? '+' : ''}${result.xpDelta} XP.`,
    );
  },
);

// ── Quests (flow 9) ──────────────────────────────────────────────────────────

const QUEST_LABELS: Record<keyof QuestInput, string> = {
  title: 'Title',
  descriptionMd: 'Description',
  xpReward: 'XP',
  icon: 'Icon',
  categoryId: 'Category',
  linkCount: 'Links',
  linkHint: 'Link hint',
  startsAt: 'Starts',
  endsAt: 'Ends',
  rewardRoleId: 'Reward rank',
};

function questFromForm(form: FormData): QuestInput {
  return {
    title: text(form, 'title'),
    descriptionMd: text(form, 'descriptionMd'),
    xpReward: integer(form, 'xpReward'),
    icon: text(form, 'icon'),
    categoryId: optionalUuid(form, 'categoryId'),
    linkCount: integer(form, 'linkCount'),
    linkHint: optionalText(form, 'linkHint'),
    startsAt: optionalUtcDate(form, 'startsAt'),
    endsAt: optionalUtcDate(form, 'endsAt'),
    rewardRoleId: optionalUuid(form, 'rewardRoleId'),
  };
}

export const saveQuestAction = adminAction(
  'saveQuest',
  async (admin, _state: FormState, form: FormData): Promise<FormState> => {
    const checked = checkQuest(questFromForm(form));
    if (!checked.ok) return fail(describeErrors(checked.errors, QUEST_LABELS));

    const id = text(form, 'id');
    if (id === '') {
      const created = await createQuest(db(), { quest: checked.value, actorId: admin.id });
      if (!created.ok) return fail(CATALOG_ERRORS[created.reason]);
      memberPages();
      redirect(`/admin/quests/${created.value}?saved=1`);
    }
    if (!isUuid(id)) return MISSING;
    const updated = await updateQuest(db(), { id, quest: checked.value, actorId: admin.id });
    if (!updated.ok) return fail(CATALOG_ERRORS[updated.reason]);
    memberPages();
    return ok('Saved.');
  },
);

export const setQuestStatusAction = adminAction(
  'setQuestStatus',
  async (_admin, _state: FormState, form: FormData): Promise<FormState> => {
    const id = text(form, 'id');
    const status = text(form, 'status');
    if (!isUuid(id) || (status !== 'active' && status !== 'closed')) return MISSING;
    const result = await setQuestStatus(db(), { id, status });
    if (!result.ok) return fail(CATALOG_ERRORS[result.reason]);
    memberPages();
    return ok(status === 'closed' ? 'Closed: it is off the board.' : 'Reopened.');
  },
);

export const deleteQuestAction = adminAction(
  'deleteQuest',
  async (_admin, _state: FormState, form: FormData): Promise<FormState> => {
    const id = text(form, 'id');
    if (!isUuid(id)) return MISSING;
    if (text(form, 'confirm') !== 'yes') return fail('Tick the box to confirm.');
    const result = await deleteQuest(db(), id);
    if (!result.ok) return fail(CATALOG_ERRORS[result.reason]);
    memberPages();
    redirect('/admin/quests');
  },
);

// ── Categories (flow 10) ─────────────────────────────────────────────────────

export const createCategoryAction = adminAction(
  'createCategory',
  async (_admin, _state: FormState, form: FormData): Promise<FormState> => {
    const name = checkCategoryName(text(form, 'name'));
    if (!name.ok) return fail(name.errors.name ?? 'Invalid name.');
    const result = await createCategory(db(), name.value);
    if (!result.ok) return fail(CATALOG_ERRORS[result.reason]);
    memberPages();
    return ok(`Added “${name.value}”.`);
  },
);

export const renameCategoryAction = adminAction(
  'renameCategory',
  async (_admin, _state: FormState, form: FormData): Promise<FormState> => {
    const id = text(form, 'id');
    const name = checkCategoryName(text(form, 'name'));
    if (!isUuid(id)) return MISSING;
    if (!name.ok) return fail(name.errors.name ?? 'Invalid name.');
    const result = await renameCategory(db(), { id, name: name.value });
    if (!result.ok) return fail(CATALOG_ERRORS[result.reason]);
    memberPages();
    return ok('Renamed.');
  },
);

export const moveCategoryAction = adminAction(
  'moveCategory',
  async (_admin, _state: FormState, form: FormData): Promise<FormState> => {
    const id = text(form, 'id');
    const direction = text(form, 'direction');
    if (!isUuid(id) || (direction !== 'up' && direction !== 'down')) return MISSING;
    const result = await moveCategory(db(), id, direction);
    if (!result.ok) return fail(CATALOG_ERRORS[result.reason]);
    memberPages();
    return ok();
  },
);

export const deleteCategoryAction = adminAction(
  'deleteCategory',
  async (_admin, _state: FormState, form: FormData): Promise<FormState> => {
    const id = text(form, 'id');
    if (!isUuid(id)) return MISSING;
    const result = await deleteCategory(db(), id);
    if (!result.ok) return fail(CATALOG_ERRORS[result.reason]);
    memberPages();
    return ok();
  },
);

// ── Ranks (flow 11) ──────────────────────────────────────────────────────────

const RANK_LABELS: Record<keyof RankInput, string> = {
  name: 'Name',
  description: 'Description',
  color: 'Colour',
  icon: 'Icon',
  xpRequired: 'XP threshold',
  discordRoleId: 'Discord role id',
};

function rankFromForm(form: FormData): RankInput {
  return {
    name: text(form, 'name'),
    description: text(form, 'description'),
    color: optionalText(form, 'color'),
    icon: optionalText(form, 'icon'),
    xpRequired: optionalInteger(form, 'xpRequired'),
    discordRoleId: optionalText(form, 'discordRoleId'),
  };
}

export const saveRankAction = adminAction(
  'saveRank',
  async (admin, _state: FormState, form: FormData): Promise<FormState> => {
    const checked = checkRank(rankFromForm(form));
    if (!checked.ok) return fail(describeErrors(checked.errors, RANK_LABELS));

    const id = text(form, 'id');
    const result =
      id === ''
        ? await createRank(db(), { rank: checked.value, actorId: admin.id })
        : isUuid(id)
          ? await updateRank(db(), { id, rank: checked.value, actorId: admin.id })
          : null;
    if (result === null) return MISSING;
    if (!result.ok) {
      return fail(
        result.reason === 'duplicate'
          ? 'Another rank already has that name or Discord role id.'
          : CATALOG_ERRORS[result.reason],
      );
    }
    revalidatePath('/admin', 'layout');
    memberPages();
    if (id === '') redirect('/admin/ranks?saved=1');
    return ok('Saved. Members who now qualify, or no longer do, have been updated.');
  },
);

export const moveRankAction = adminAction(
  'moveRank',
  async (_admin, _state: FormState, form: FormData): Promise<FormState> => {
    const id = text(form, 'id');
    const direction = text(form, 'direction');
    if (!isUuid(id) || (direction !== 'up' && direction !== 'down')) return MISSING;
    const result = await moveRank(db(), id, direction);
    if (!result.ok) return fail(CATALOG_ERRORS[result.reason]);
    memberPages();
    return ok();
  },
);

export const deleteRankAction = adminAction(
  'deleteRank',
  async (_admin, _state: FormState, form: FormData): Promise<FormState> => {
    const id = text(form, 'id');
    if (!isUuid(id)) return MISSING;
    if (text(form, 'confirm') !== 'yes') return fail('Tick the box to confirm.');
    const result = await deleteRank(db(), id);
    if (!result.ok) return fail(CATALOG_ERRORS[result.reason]);
    memberPages();
    redirect('/admin/ranks');
  },
);

const ASSIGN_ERRORS = {
  not_found: 'That member or rank no longer exists. Reload the page.',
  already_held: 'They already hold that rank.',
  not_manual: 'That rank was earned (by XP or a quest), so it cannot be removed by hand.',
} as const;

export const assignRankAction = adminAction(
  'assignRank',
  async (admin, _state: FormState, form: FormData): Promise<FormState> => {
    const userId = text(form, 'userId');
    const roleId = text(form, 'roleId');
    if (!isUuid(userId) || !isUuid(roleId)) return fail('Choose a rank.');
    const result = await assignRank(db(), { userId, roleId, actorId: admin.id });
    if (!result.ok) return fail(ASSIGN_ERRORS[result.reason]);
    revalidatePath(`/admin/users/${userId}`);
    memberPages();
    return ok('Rank given.');
  },
);

export const removeRankAction = adminAction(
  'removeRank',
  async (admin, _state: FormState, form: FormData): Promise<FormState> => {
    const userId = text(form, 'userId');
    const roleId = text(form, 'roleId');
    if (!isUuid(userId) || !isUuid(roleId)) return MISSING;
    const result = await removeRank(db(), { userId, roleId, actorId: admin.id });
    if (!result.ok) return fail(ASSIGN_ERRORS[result.reason]);
    revalidatePath(`/admin/users/${userId}`);
    memberPages();
    return ok('Rank removed.');
  },
);

// ── Users (flow 12) ──────────────────────────────────────────────────────────

const STAFF_ERRORS: Record<Exclude<StaffResult, { ok: true }>['reason'], string> = {
  owner_only: 'Only the owner can change who is an admin.',
  not_permitted: 'Only the owner can delete an admin.',
  self: 'You cannot do that to your own account.',
  owner_protected: 'The owner cannot be demoted or deleted here. Ownership moves on the server.',
  unchanged: 'They already have that role.',
  not_found: 'That member no longer exists. Reload the page.',
  name_mismatch: 'Type their name exactly as shown to confirm.',
};

export const setUserRoleAction = adminAction(
  'setUserRole',
  async (admin, _state: FormState, form: FormData): Promise<FormState> => {
    const targetId = text(form, 'userId');
    const to = text(form, 'role');
    if (!isUuid(targetId) || (to !== 'admin' && to !== 'ambassador')) return MISSING;
    const result = await setUserRole(db(), { actorId: admin.id, targetId, to });
    if (!result.ok) return fail(STAFF_ERRORS[result.reason]);
    revalidatePath('/admin', 'layout');
    return ok(to === 'admin' ? 'Now an admin.' : 'No longer an admin.');
  },
);

export const deleteUserAction = adminAction(
  'deleteUser',
  async (admin, _state: FormState, form: FormData): Promise<FormState> => {
    const targetId = text(form, 'userId');
    if (!isUuid(targetId)) return MISSING;
    const result = await deleteUser(db(), {
      actorId: admin.id,
      targetId,
      confirmName: text(form, 'confirmName'),
    });
    if (!result.ok) return fail(STAFF_ERRORS[result.reason]);
    // The rows are gone; their screenshots follow. A file left behind is
    // logged for clean-up, not a reason to report the deletion as failed.
    const dir = webConfig().PROOFS_DIR;
    for (const file of result.value) {
      await deleteProof(dir, file).catch((error: unknown) =>
        log().warn({ err: error, file }, 'proof of a deleted user not removed'),
      );
    }
    memberPages();
    redirect('/admin/users?deleted=1');
  },
);
