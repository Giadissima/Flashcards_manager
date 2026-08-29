import { Transform } from 'class-transformer';

import { hasHtmlContent } from './html.util';

/**
 * Payload normalisation shared by the DTOs: the same transforms were repeated
 * inline on almost every string property.
 */

/** Trims a value only when it is a string, leaving any other type untouched. */
export const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/**
 * Like Trim(), but a value that trims down to "" becomes undefined, so an
 * optional field sent as an empty string counts as "not provided".
 */
export const TrimToUndefined = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  );

/**
 * Trims HTML coming from the TipTap editor and normalises "markup with no
 * visible text" (an empty editor still produces "<p></p>") to an empty string,
 * so nothing meaningless gets stored.
 */
export const TrimHtml = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return hasHtmlContent(trimmed) ? trimmed : '';
  });
