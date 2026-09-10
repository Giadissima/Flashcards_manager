import { Visibility } from '../models/visibility.dto';

/**
 * What a newly created topic's visibility starts as. 'inherit' means "match
 * the subject it is filed under" - the other two are a fixed choice regardless
 * of the subject. Read before Angular boots is not needed here (unlike
 * language, see shared/language.ts), since only the settings modal and the
 * create-topic form ever touch it, both after the app is up.
 */
export const defaultTopicVisibilityOptions = ['inherit', 'public', 'private'] as const;

export type DefaultTopicVisibility = (typeof defaultTopicVisibilityOptions)[number];

const storageKey = 'defaultTopicVisibility';

/** Nothing becomes public just because a setting was never touched. */
export const defaultTopicVisibilityDefault: DefaultTopicVisibility = 'inherit';

export function readDefaultTopicVisibility(): DefaultTopicVisibility {
  const stored = localStorage.getItem(storageKey);
  return (defaultTopicVisibilityOptions as readonly string[]).includes(stored ?? '')
    ? (stored as DefaultTopicVisibility)
    : defaultTopicVisibilityDefault;
}

export function storeDefaultTopicVisibility(value: DefaultTopicVisibility): void {
  localStorage.setItem(storageKey, value);
}

/** 'inherit' resolves once a subject is known; the fixed choices ignore it. */
export function resolveDefaultTopicVisibility(
  mode: DefaultTopicVisibility,
  subjectVisibility: Visibility | undefined,
): Visibility {
  if (mode === 'inherit') return subjectVisibility === 'public' ? 'public' : 'private';
  return mode;
}
