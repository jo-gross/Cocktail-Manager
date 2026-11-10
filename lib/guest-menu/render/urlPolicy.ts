/**
 * URL policy shared by the CSS scoper, the HTML sanitizer and the resolver
 * (light module, safe for client bundles).
 *
 * Same-origin relative paths only: `/…` but not `//…` or `/\…` (browsers treat
 * `\` like `/`), and no whitespace (tab/newline are stripped by URL parsers),
 * backslashes, quotes or parentheses.
 */
export const SAFE_RELATIVE_URL = /^\/(?![/\\])[^\\\s"'()]*$/;

/** Raster `data:image/*;base64` URIs (no SVG). */
export const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=]+$/i;

/** Embedded fonts for `@font-face src`. */
export const SAFE_DATA_FONT = /^data:font\/(woff2?|ttf|otf);base64,[a-z0-9+/=]+$/i;

export function isSafeRelativeUrl(value: string): boolean {
  return SAFE_RELATIVE_URL.test(value);
}
