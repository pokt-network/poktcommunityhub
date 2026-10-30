import type { Category } from '@community/store';

const SLOTS = 5;

/**
 * A category's colour: the brand colour for its place in the board's order
 * (--cat-1 to --cat-5 in globals.css, repeating). Categories have no colour of
 * their own, so reordering them in the console recolours them.
 */
export function categoryColor(categories: Category[], id: string | null | undefined): string {
  const index = id === null || id === undefined ? -1 : categories.findIndex((c) => c.id === id);
  return index < 0 ? 'var(--cat-none)' : `var(--cat-${(index % SLOTS) + 1})`;
}
