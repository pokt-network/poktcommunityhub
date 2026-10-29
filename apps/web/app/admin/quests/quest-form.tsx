import { LIMITS, QUEST_ICONS, type QuestInput } from '@community/core';
import type { AdminCategory, AdminRank } from '@community/store';

import { saveQuestAction } from '@/lib/admin-actions';
import { toUtcInput } from '@/lib/forms';

import { ActionForm } from '../../action-form';
import styles from '../../hub.module.css';
import { QuestIcon } from '../../quest-icon';

/** Flow 9: the quest editor, for a new quest (no `id`) or an existing one. */
export function QuestForm({
  quest,
  id,
  categories,
  ranks,
}: {
  quest: QuestInput | null;
  id: string | null;
  categories: AdminCategory[];
  ranks: AdminRank[];
}) {
  const q = quest;
  return (
    <ActionForm action={saveQuestAction} submit={id === null ? 'Create quest' : 'Save changes'}>
      <input type="hidden" name="id" value={id ?? ''} />
      <label className={styles.field}>
        Title
        <input
          className={styles.wide}
          name="title"
          required
          maxLength={LIMITS.title}
          defaultValue={q?.title}
        />
      </label>
      <label className={styles.field}>
        Description (Markdown: **bold**, lists, [links](https://…); no HTML or images)
        <textarea
          className={styles.textarea}
          name="descriptionMd"
          maxLength={LIMITS.description}
          defaultValue={q?.descriptionMd}
        />
      </label>
      <fieldset className={styles.field}>
        <legend>Icon</legend>
        <div className={styles.iconChoices}>
          {QUEST_ICONS.map((icon, i) => (
            <label key={icon.id} className={styles.iconChoice} title={icon.label}>
              <input
                type="radio"
                name="icon"
                value={icon.id}
                required
                defaultChecked={q === null ? i === 0 : q.icon === icon.id}
                aria-label={icon.label}
              />
              <QuestIcon icon={icon.id} />
            </label>
          ))}
        </div>
      </fieldset>
      <div className={styles.formGrid}>
        <label className={styles.field}>
          XP
          <input
            className={styles.wide}
            name="xpReward"
            type="number"
            min={1}
            max={LIMITS.maxXp}
            required
            defaultValue={q?.xpReward ?? 50}
          />
        </label>
        <label className={styles.field}>
          Category
          <select className={styles.wide} name="categoryId" defaultValue={q?.categoryId ?? ''}>
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Reward rank
          <select className={styles.wide} name="rewardRoleId" defaultValue={q?.rewardRoleId ?? ''}>
            <option value="">None</option>
            {ranks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Proof links required
          <input
            className={styles.wide}
            name="linkCount"
            type="number"
            min={1}
            max={8}
            required
            defaultValue={q?.linkCount ?? 1}
          />
        </label>
        <label className={styles.field}>
          Starts (UTC, optional)
          <input
            className={styles.wide}
            name="startsAt"
            type="datetime-local"
            defaultValue={toUtcInput(q?.startsAt ?? null)}
          />
        </label>
        <label className={styles.field}>
          Ends (UTC, optional)
          <input
            className={styles.wide}
            name="endsAt"
            type="datetime-local"
            defaultValue={toUtcInput(q?.endsAt ?? null)}
          />
        </label>
      </div>
      <label className={styles.field}>
        Link hint (shown to members, optional)
        <input
          className={styles.wide}
          name="linkHint"
          maxLength={LIMITS.linkHint}
          defaultValue={q?.linkHint ?? ''}
        />
      </label>
      {id !== null && (
        <p className={styles.muted}>
          Changing the XP applies to future approvals; XP already awarded stays as it was. Changing
          the reward rank moves it for everyone who completed this quest.
        </p>
      )}
    </ActionForm>
  );
}
