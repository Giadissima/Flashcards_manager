/** Mirrors src/common/visibility.ts on the server. */
export const visibilities = ['private', 'public'] as const;

export type Visibility = (typeof visibilities)[number];

/** Nothing becomes visible to others by accident. */
export const defaultVisibility: Visibility = 'private';
