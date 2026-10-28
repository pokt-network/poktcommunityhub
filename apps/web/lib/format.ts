import type { SubmissionStatus } from '@community/core';

/** Dates read the same for everyone: the hub's months are UTC (brief section 10.3). */
const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export const formatDate = (date: Date): string => DATE.format(date);

export const formatXp = (xp: number): string => `${xp.toLocaleString('en-US')} XP`;

export const STATUS_LABELS: Record<SubmissionStatus | 'not_started', string> = {
  not_started: 'Not started',
  pending: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
};
