import { baseUrlAPI } from '../../../config/config';

/**
 * The two fields an avatar is drawn from, and nothing else.
 *
 * Written out rather than taken as AuthUser: the post author in the feed is
 * shown the same way and is not an AuthUser - it carries no address, no study
 * fields, nothing the logged reader has - and asking for the whole of one here
 * would tie the drawing to fields it never looks at.
 */
export interface AvatarSource {
  /** Id of the uploaded picture; absent means the default drawing. */
  avatar?: string;
  avatarColor?: string;
}

export const defaultAvatarColor = '#a294f9';

// Official Google Material Symbols "person" paths (viewBox 0 0 24 24), split in
// its two subpaths so they can be filled on their own: the head and the
// shoulders. Shared by the live preview component and the data URI used inside
// <img> tags, so the two can never drift apart.
const personHeadPath =
  'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z';
const personBodyPath =
  'M12 14c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z';

// The two colours the figure can take. They are written out because the drawing
// ends up inside a data: URI, which is a document of its own and cannot read a
// var() from the page. The dark one is the value of --header-color in the light
// theme (see styles.scss), so the avatar stays within the palette.
const lightFigure = '#ffffff';
const darkFigure = '#344054';

/** #rgb or #rrggbb to its three channels; null when it is neither. */
function parseHex(hex: string): [number, number, number] | null {
  const cleaned = hex.trim().replace('#', '');
  const full = cleaned.length === 3
    ? cleaned.split('').map((c) => c + c).join('')
    : cleaned;

  const value = parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(value)) return null;
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/**
 * Relative luminance as WCAG 2 defines it: how much light a colour actually
 * puts out, on a scale from 0 (black) to 1 (white).
 *
 * The two steps both look arbitrary and are not:
 *
 * 1. The channel() function undoes the sRGB gamma. Hex values are not
 *    quantities of light - they are encoded for how a screen reproduces them,
 *    so they cannot be averaged as they stand. #808080 is 0.502 of white as a
 *    number, but only 0.216 of its light: 22%, not 50%. Skipping this step
 *    would call a colour light that the eye reads as dark, and the other way
 *    round.
 *
 * 2. The three weights differ because the eye is not equally sensitive to the
 *    three primaries: green carries about 72% of the perceived brightness and
 *    blue barely 7%. A saturated blue therefore comes out far darker than a
 *    green of the same numeric intensity.
 */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (raw: number) => {
    const c = raw / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * The WCAG 2 contrast ratio between two luminances, from 1 (identical) to 21
 * (pure black on pure white).
 *
 * The 0.05 added to both sides stands for the ambient light a screen reflects:
 * without it black against white would divide by zero. It is also what keeps
 * the top of the scale at 21 rather than at infinity.
 *
 * For reference, WCAG asks for 4.5 on body text and 3 on large text and
 * graphics. The threshold used below is deliberately lower - see it for why.
 */
const contrastRatio = (a: number, b: number): number =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * Below this contrast against the background, the white figure stops reading
 * and the dark one takes over. Picked from the palette rather than guessed: the
 * default purple sits at 2.58 and the other strong colours above it, while the
 * pale ones the picker allows - a light green at 1.99, white at 1.00 - fall
 * under it. The dark grey is above 3.9 on every one of those.
 *
 * Not simply "whichever contrasts more": that flips to dark on mid colours like
 * the default purple too, where the white figure is the look the app has.
 */
const minWhiteContrast = 2;

/**
 * The figure colour to use on the chosen background: white as a rule, dark grey
 * once the background is light enough that white would disappear, so a white or
 * a very pale green still leaves a visible avatar.
 */
export function figureColorOn(background: string): string {
  const rgb = parseHex(background);
  if (!rgb) return lightFigure;

  const whiteContrast = contrastRatio(
    relativeLuminance(rgb),
    relativeLuminance(parseHex(lightFigure)!),
  );
  return whiteContrast >= minWhiteContrast ? lightFigure : darkFigure;
}

/**
 * The default avatar: the "person" figure on a filled circle in the chosen
 * colour, drawn as a plain silhouette, which is how a person reads best.
 */
export function buildDefaultAvatarSvgMarkup(fill: string = defaultAvatarColor): string {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">` +
    `<circle cx="50" cy="50" r="48" fill="${fill}" />` +
    // Small enough to sit inside the circle with room around it, the way the
    // book does on a subject icon: the figure reads as a drawing placed on the
    // disc rather than as a silhouette cut out of it. Nothing overflows at this
    // size, so no clipping is needed.
    `<g transform="translate(50,50) scale(3.4) translate(-12,-12)" fill="${figureColorOn(fill)}">` +
    `<path d="${personHeadPath}" /><path d="${personBodyPath}" />` +
    `</g>` +
    `</svg>`;
}

export function getDefaultAvatarDataUrl(fill: string = defaultAvatarColor): string {
  const svg = buildDefaultAvatarSvgMarkup(fill);
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// user.avatar is the id of the file stored in Mongo, not a URL: it has to be
// resolved through the endpoint serving the file bytes. With nothing uploaded,
// the default drawing is generated on the fly in the chosen colour, so no file
// is stored for it.
export function getAvatarUrl(user: AvatarSource | null | undefined): string {
  if (user?.avatar) {
    return `${baseUrlAPI}file/${user.avatar}`;
  }
  return getDefaultAvatarDataUrl(user?.avatarColor);
}
