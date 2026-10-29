import { isUuid } from './ids';

/**
 * Reading admin forms. Everything in FormData is an untrusted string (or a
 * File); these turn fields into the typed shapes core checks, and never throw:
 * a value that does not parse becomes one core will refuse, with a message.
 */

/** What an admin form's action answers; ActionForm shows it. */
export type FormState = { error: string | null; notice?: string | null };

export const initialFormState: FormState = { error: null, notice: null };

export const text = (form: FormData, key: string): string => {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
};

export const optionalText = (form: FormData, key: string): string | null => {
  const value = text(form, key).trim();
  return value === '' ? null : value;
};

/** An integer field; NaN when it is not one, which core refuses. */
export const integer = (form: FormData, key: string): number => {
  const value = text(form, key).trim();
  return /^-?\d+$/.test(value) ? Number(value) : Number.NaN;
};

export const optionalInteger = (form: FormData, key: string): number | null =>
  text(form, key).trim() === '' ? null : integer(form, key);

export const optionalUuid = (form: FormData, key: string): string | null => {
  const value = text(form, key).trim();
  return isUuid(value) ? value : null;
};

/**
 * A `datetime-local` field, read as UTC: the hub's dates are UTC everywhere
 * (brief section 10.3), and the form says so.
 */
export const optionalUtcDate = (form: FormData, key: string): Date | null => {
  const value = text(form, key).trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** The value a `datetime-local` input shows for a date, in UTC. */
export const toUtcInput = (date: Date | null): string =>
  date === null ? '' : date.toISOString().slice(0, 16);

/** Field errors from core, as one message an admin can act on. */
export const describeErrors = (
  errors: Partial<Record<string, string>>,
  labels: Record<string, string>,
): string =>
  Object.entries(errors)
    .map(([field, message]) => `${labels[field] ?? field}: ${message}`)
    .join(' ');
