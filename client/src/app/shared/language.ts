/**
 * The starting language is read before Angular boots (app.config) and written
 * by the settings modal, so the storage key and the accepted values live here,
 * in a module both can import without depending on each other.
 */
export const availableLanguages = ['it', 'en'] as const;

export type AppLanguage = (typeof availableLanguages)[number];

const languageStorageKey = 'language';

/** Falls back to English when nothing, or something unknown, was stored. */
export function readStoredLanguage(): AppLanguage {
  return localStorage.getItem(languageStorageKey) === 'it' ? 'it' : 'en';
}

export function storeLanguage(language: AppLanguage): void {
  localStorage.setItem(languageStorageKey, language);
}
