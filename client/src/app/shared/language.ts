/**
 * The starting language is read before Angular boots (app.config) and written
 * by the settings modal, so the storage key and the accepted values live here,
 * in a module both can import without depending on each other.
 */
export const availableLanguages = ['it', 'en'] as const;

export type AppLanguage = (typeof availableLanguages)[number];

const languageStorageKey = 'language';

/** What a first visit gets, before the settings modal has stored anything. */
export const defaultLanguage: AppLanguage = 'en';

/**
 * The stored language, checked against the ones the app actually ships: a key
 * that was never written, or written by hand with something else in it, falls
 * back to the browser/system language (if supported) or the default instead
 * of asking Transloco for a file that is not there.
 */
export function readStoredLanguage(): AppLanguage {
  const stored = localStorage.getItem(languageStorageKey);
  if (availableLanguages.includes(stored as AppLanguage)) {
    return stored as AppLanguage;
  }

  const browserLang = navigator.language.slice(0, 2);
  return availableLanguages.includes(browserLang as AppLanguage)
    ? (browserLang as AppLanguage)
    : defaultLanguage;
}

export function storeLanguage(language: AppLanguage): void {
  localStorage.setItem(languageStorageKey, language);
}
