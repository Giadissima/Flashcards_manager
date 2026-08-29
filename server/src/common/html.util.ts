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
