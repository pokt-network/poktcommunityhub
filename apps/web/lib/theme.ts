/**
 * The light/dark choice. Dark is the default (decision 10.4); a member who
 * switches gets a cookie, which the layout reads so the first paint is already
 * right (no flash, no inline script). Only two values are honoured.
 */
export type Theme = 'dark' | 'light';

export const THEME_COOKIE = 'theme';

export const parseTheme = (value: string | undefined): Theme =>
  value === 'light' ? 'light' : 'dark';
