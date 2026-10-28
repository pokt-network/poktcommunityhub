'use client';

import { useActionState } from 'react';

import { submitProofAction, type SubmitState } from '@/lib/quest-actions';

import styles from '../../hub.module.css';

/** Flows 3 and 4. Errors come back from the action; success redirects to the quest. */
export function SubmitProofForm({
  questId,
  linkCount,
  resubmit,
}: {
  questId: string;
  linkCount: number;
  resubmit: boolean;
}) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitProofAction, {
    error: null,
  });

  return (
    <form action={action} className={styles.list}>
      <input type="hidden" name="questId" value={questId} />
      {Array.from({ length: linkCount }, (_, i) => (
        <label key={i} className={styles.field}>
          {linkCount === 1 ? 'Link' : `Link ${i + 1}`}
          <input
            className={styles.wide}
            type="url"
            name="link"
            required
            maxLength={2048}
            placeholder="https://"
            inputMode="url"
          />
        </label>
      ))}
      <label className={styles.field}>
        Screenshot (optional: PNG, JPEG or WebP, up to 5 MB)
        <input
          className={styles.wide}
          type="file"
          name="screenshot"
          accept="image/png,image/jpeg,image/webp"
        />
      </label>
      {state.error !== null && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      <div>
        <button className={styles.button} type="submit" disabled={pending}>
          {pending ? 'Submitting…' : resubmit ? 'Resubmit proof' : 'Submit proof'}
        </button>
      </div>
    </form>
  );
}
