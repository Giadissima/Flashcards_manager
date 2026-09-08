/**
 * What a user can be stopped from doing.
 *
 * Only the three ways of reaching other people: studying, importing and
 * writing one's own cards are nobody else's business, and taking them away
 * would punish somebody by deleting their notes.
 */
export const privileges = ['publish', 'comment', 'feedback'] as const;
export type Privilege = (typeof privileges)[number];

/**
 * How long the block lasts, by how many warnings the account has collected.
 *
 * The first two are warnings and nothing more: everybody is allowed to be
 * told. From the third the account stops reaching people, for a week, then a
 * month, then for good - a ladder rather than a cliff, so that one bad evening
 * is not the same as a habit.
 *
 * `null` at the end means no expiry; the length of the array is the point at
 * which nothing more is added.
 */
export const strikeBlockDays: (number | null)[] = [0, 0, 7, 30, null];

/** When a block handed down now would end, or undefined for "never". */
export function blockUntil(strikes: number, from = new Date()): Date | null {
  const step = strikeBlockDays[Math.min(strikes, strikeBlockDays.length) - 1];
  if (step === null) return null;
  return new Date(from.getTime() + step * 24 * 60 * 60 * 1000);
}

/** True when that many warnings are enough to take privileges away. */
export function blocksAt(strikes: number): boolean {
  return strikes >= 1 && strikeBlockDays[Math.min(strikes, strikeBlockDays.length) - 1] !== 0;
}
