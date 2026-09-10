import { Visibility } from '../models/visibility.dto';

/**
 * What a newly created flashcard's visibility starts as. 'inherit' means
 * "match the topic it is filed under, or the subject if there is no topic
 * chosen yet" - see default-topic-visibility.ts for the topic equivalent.
 */
export const defaultFlashcardVisibilityOptions = ['inherit', 'public', 'private'] as const;

export type DefaultFlashcardVisibility = (typeof defaultFlashcardVisibilityOptions)[number];

const storageKey = 'defaultFlashcardVisibility';

/** Nothing becomes public just because a setting was never touched. */
export const defaultFlashcardVisibilityDefault: DefaultFlashcardVisibility = 'inherit';

export function readDefaultFlashcardVisibility(): DefaultFlashcardVisibility {
  const stored = localStorage.getItem(storageKey);
  return (defaultFlashcardVisibilityOptions as readonly string[]).includes(stored ?? '')
    ? (stored as DefaultFlashcardVisibility)
    : defaultFlashcardVisibilityDefault;
}

export function storeDefaultFlashcardVisibility(value: DefaultFlashcardVisibility): void {
  localStorage.setItem(storageKey, value);
}

/** 'inherit' resolves once a parent (topic, or failing that subject) is known. */
export function resolveDefaultFlashcardVisibility(
  mode: DefaultFlashcardVisibility,
  parentVisibility: Visibility | undefined,
): Visibility {
  if (mode === 'inherit') return parentVisibility === 'public' ? 'public' : 'private';
  return mode;
}
