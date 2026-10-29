'use client';

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from 'react';

import type { FormState } from '@/lib/forms';

import styles from './hub.module.css';

/**
 * A form posting to a server action that answers with a FormState. Shows the
 * error or the notice it returns, and disables the submit button while it runs.
 * The fields are the children; `submit` labels the button.
 *
 * React resets a form after its `action` runs, which would wipe everything an
 * admin typed whenever the server answers with an error. So with JavaScript the
 * submit goes through `onSubmit` instead, and the fields are cleared only when
 * asked (`resetOnSuccess`) and only on success. Without JavaScript the `action`
 * attribute still posts the form.
 */
export function ActionForm({
  action,
  children,
  submit,
  tone = 'primary',
  className,
  resetOnSuccess = false,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children?: ReactNode;
  submit: string;
  tone?: 'primary' | 'quiet' | 'danger';
  className?: string | undefined;
  resetOnSuccess?: boolean;
}) {
  const [state, run, pending] = useActionState(action, { error: null, notice: null });
  const form = useRef<HTMLFormElement>(null);
  const button =
    tone === 'primary' ? styles.button : tone === 'danger' ? styles.danger : styles.quiet;

  useEffect(() => {
    if (resetOnSuccess && state.error === null && typeof state.notice === 'string') {
      form.current?.reset();
    }
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={form}
      action={run}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => run(data));
      }}
      className={className ?? styles.formStack}
    >
      {children}
      {state.error !== null && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      {typeof state.notice === 'string' && (
        <p className={styles.success} role="status">
          {state.notice}
        </p>
      )}
      <div>
        <button className={button} type="submit" disabled={pending}>
          {pending ? 'Working…' : submit}
        </button>
      </div>
    </form>
  );
}
