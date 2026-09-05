/**
 * What counts as "content" in a rich-text field, in one place.
 *
 * Content created with the TipTap editor arrives as HTML, so both the payload
 * transforms and the length validator have to decide what is really there.
 * They used to answer differently - the transform looked at visible text only,
 * the validator also accepted an image - and since class-transformer runs
 * first, a description made only of an image was emptied before the validator
 * ever saw it.
 */

/** Visible text of an HTML fragment, tags removed. */
export function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

/**
 * An image is content in its own right - an answer made only of the requested
 * drawing, a description made only of a diagram - even though it carries no
 * visible text of its own.
 */
export function containsImage(value: string): boolean {
  return /<img\b/i.test(value);
}

/** Whether an HTML fragment carries anything worth storing. */
export function hasHtmlContent(value: string): boolean {
  return stripHtmlTags(value).trim().length > 0 || containsImage(value);
}

/**
 * Inline images live inside the HTML rather than in a field of their own, as
 * <img src="/api/file/{24 hex char mongo id}">. Whoever has to know which files
 * a flashcard owns has to read them back out of the markup, so the pattern is
 * declared once here.
 */
const IMAGE_REF_REGEX = /file\/([0-9a-fA-F]{24})/g;

/** The ids of the files an HTML fragment points at, without repetitions. */
export function extractImageFileIds(html: string | undefined): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  for (const match of html.matchAll(IMAGE_REF_REGEX)) {
    ids.add(match[1]);
  }
  return [...ids];
}

/** Repoints the images of an HTML fragment, leaving unmapped ids untouched. */
export function replaceImageFileIds(
  html: string,
  idMap: Map<string, string>,
): string {
  if (!html) return html;
  return html.replace(IMAGE_REF_REGEX, (full, oldId: string) => {
    const newId = idMap.get(oldId);
    return newId ? `file/${newId}` : full;
  });
}
