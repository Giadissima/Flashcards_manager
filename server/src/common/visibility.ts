/**
 * Who may see a flashcard, a subject or a topic.
 *
 * "private" is the default and the only thing the app acts on today: every list
 * is scoped to the user who owns it. "public" is what the Community section
 * will read, so the choice can be made and stored before the section exists.
 */
export const visibilities = ['private', 'public'] as const;

export type Visibility = (typeof visibilities)[number];

/** Nothing becomes visible to others by accident. */
export const defaultVisibility: Visibility = 'private';
