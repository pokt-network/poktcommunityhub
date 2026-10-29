import { LIMITS, type RankInput } from '@community/core';

import { saveRankAction } from '@/lib/admin-actions';

import { ActionForm } from '../../action-form';
import styles from '../../hub.module.css';

/** Flow 11: the rank editor, for a new rank (no `id`) or an existing one. */
export function RankForm({ rank, id }: { rank: RankInput | null; id: string | null }) {
  return (
    <ActionForm action={saveRankAction} submit={id === null ? 'Create rank' : 'Save changes'}>
      <input type="hidden" name="id" value={id ?? ''} />
      <div className={styles.formGrid}>
        <label className={styles.field}>
          Name
          <input
            className={styles.wide}
            name="name"
            required
            maxLength={LIMITS.rankName}
            defaultValue={rank?.name}
          />
        </label>
        <label className={styles.field}>
          XP threshold (empty: quest reward or by hand only)
          <input
            className={styles.wide}
            name="xpRequired"
            type="number"
            min={0}
            defaultValue={rank?.xpRequired ?? ''}
          />
        </label>
        <label className={styles.field}>
          Colour
          <input
            className={styles.wide}
            name="color"
            placeholder="#ffc547"
            pattern="#[0-9a-fA-F]{6}"
            defaultValue={rank?.color ?? ''}
          />
        </label>
        <label className={styles.field}>
          Icon (an emoji)
          <input
            className={styles.wide}
            name="icon"
            maxLength={16}
            defaultValue={rank?.icon ?? ''}
          />
        </label>
        <label className={styles.field}>
          Discord role id (optional)
          <input
            className={styles.wide}
            name="discordRoleId"
            inputMode="numeric"
            pattern="[0-9]{17,20}"
            defaultValue={rank?.discordRoleId ?? ''}
          />
        </label>
      </div>
      <label className={styles.field}>
        Description
        <input
          className={styles.wide}
          name="description"
          maxLength={LIMITS.rankDescription}
          defaultValue={rank?.description ?? ''}
        />
      </label>
      <p className={styles.muted}>
        A threshold change rechecks every member at once: those who now qualify gain the rank, those
        who no longer do lose it. Ranks given by hand are never taken away by this.
      </p>
    </ActionForm>
  );
}
