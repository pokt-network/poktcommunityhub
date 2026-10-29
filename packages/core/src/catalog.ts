/**
 * What admins may write into quests, categories and ranks (flows 9 to 11). The
 * web app parses forms into these shapes; these functions decide what is valid,
 * so the rules are tested without a server and hold for any caller.
 */

/**
 * The fixed quest icon set (brief section 13.2). Ids are stored; the web app
 * draws each one. Adding an icon is a code change, never free text in the
 * database.
 */
export const QUEST_ICONS = [
  { id: 'megaphone', label: 'Announcement' },
  { id: 'share', label: 'Share' },
  { id: 'at-sign', label: 'Social post' },
  { id: 'newspaper', label: 'Article' },
  { id: 'book-open', label: 'Guide' },
  { id: 'video', label: 'Video & stream' },
  { id: 'languages', label: 'Translation' },
  { id: 'users', label: 'Community' },
  { id: 'mail', label: 'Outreach' },
  { id: 'graduation-cap', label: 'Learning' },
  { id: 'code', label: 'Code' },
  { id: 'git-pull-request', label: 'Pull request' },
  { id: 'terminal', label: 'Node & infra' },
  { id: 'bug', label: 'Bug report' },
  { id: 'compass', label: 'Explore' },
  { id: 'trophy', label: 'Challenge' },
] as const;

export type QuestIcon = (typeof QUEST_ICONS)[number]['id'];

export const isQuestIcon = (value: string): value is QuestIcon =>
  QUEST_ICONS.some((icon) => icon.id === value);

export const LIMITS = {
  title: 200,
  description: 20_000,
  linkHint: 300,
  maxXp: 100_000,
  categoryName: 60,
  rankName: 100,
  rankDescription: 500,
  rankIcon: 16,
} as const;

export type FieldErrors<K extends string> = Partial<Record<K, string>>;
type Checked<T, K extends string> = { ok: true; value: T } | { ok: false; errors: FieldErrors<K> };

const finish = <T, K extends string>(value: T, errors: FieldErrors<K>): Checked<T, K> =>
  Object.keys(errors).length === 0 ? { ok: true, value } : { ok: false, errors };

const isWholeNumber = (n: number, min: number, max: number) =>
  Number.isInteger(n) && n >= min && n <= max;

export type QuestInput = {
  title: string;
  descriptionMd: string;
  xpReward: number;
  icon: string;
  categoryId: string | null;
  linkCount: number;
  linkHint: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  rewardRoleId: string | null;
};

export type QuestField = keyof QuestInput;

/** Flow 9: a quest as created or edited. Text is trimmed; an empty hint is null. */
export function checkQuest(input: QuestInput): Checked<QuestInput, QuestField> {
  const errors: FieldErrors<QuestField> = {};
  const title = input.title.trim();
  const descriptionMd = input.descriptionMd.trim();
  const linkHint = input.linkHint?.trim() || null;

  if (title === '' || title.length > LIMITS.title) {
    errors.title = `A title of 1 to ${LIMITS.title} characters.`;
  }
  if (descriptionMd.length > LIMITS.description) {
    errors.descriptionMd = `At most ${LIMITS.description.toLocaleString('en-US')} characters.`;
  }
  if (!isWholeNumber(input.xpReward, 1, LIMITS.maxXp)) {
    errors.xpReward = `A whole number from 1 to ${LIMITS.maxXp.toLocaleString('en-US')}.`;
  }
  if (!isQuestIcon(input.icon)) errors.icon = 'Choose an icon from the set.';
  if (!isWholeNumber(input.linkCount, 1, 8)) errors.linkCount = 'From 1 to 8 links.';
  if (linkHint !== null && linkHint.length > LIMITS.linkHint) {
    errors.linkHint = `At most ${LIMITS.linkHint} characters.`;
  }
  if (input.startsAt !== null && input.endsAt !== null && input.endsAt <= input.startsAt) {
    errors.endsAt = 'The end must be after the start.';
  }

  return finish({ ...input, title, descriptionMd, linkHint }, errors);
}

/** Flow 10: a category name. */
export function checkCategoryName(name: string): Checked<string, 'name'> {
  const trimmed = name.trim();
  return trimmed === '' || trimmed.length > LIMITS.categoryName
    ? { ok: false, errors: { name: `A name of 1 to ${LIMITS.categoryName} characters.` } }
    : { ok: true, value: trimmed };
}

export type RankInput = {
  name: string;
  description: string;
  color: string | null;
  icon: string | null;
  xpRequired: number | null;
  discordRoleId: string | null;
};

export type RankField = keyof RankInput;

const SNOWFLAKE = /^[0-9]{17,20}$/;

/**
 * Flow 11: a rank (server role). `xpRequired` null means it is granted only as
 * a quest reward or by hand. `discordRoleId` maps it to the Discord role it
 * stands for; phase 6 can create missing ones.
 */
export function checkRank(input: RankInput): Checked<RankInput, RankField> {
  const errors: FieldErrors<RankField> = {};
  const name = input.name.trim();
  const description = input.description.trim();
  const color = input.color?.trim() || null;
  const icon = input.icon?.trim() || null;
  const discordRoleId = input.discordRoleId?.trim() || null;

  if (name === '' || name.length > LIMITS.rankName) {
    errors.name = `A name of 1 to ${LIMITS.rankName} characters.`;
  }
  if (description.length > LIMITS.rankDescription) {
    errors.description = `At most ${LIMITS.rankDescription} characters.`;
  }
  if (color !== null && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    errors.color = 'A colour like #ffc547.';
  }
  if (icon !== null && Array.from(icon).length > LIMITS.rankIcon) {
    errors.icon = 'An emoji or a few characters.';
  }
  if (input.xpRequired !== null && !isWholeNumber(input.xpRequired, 0, 10_000_000)) {
    errors.xpRequired = 'A whole number of XP, or empty for quest-reward-only ranks.';
  }
  if (discordRoleId !== null && !SNOWFLAKE.test(discordRoleId)) {
    errors.discordRoleId = 'A Discord role id: 17 to 20 digits.';
  }

  return finish({ ...input, name, description, color, icon, discordRoleId }, errors);
}
