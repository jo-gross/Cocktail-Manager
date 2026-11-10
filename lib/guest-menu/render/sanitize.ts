/**
 * HTML sanitizer for Liquid output (isomorphic-dompurify, allowlist).
 *
 * - No scripts, event handlers, iframes, forms, styles/links/meta.
 * - `href`: only http(s), mailto, tel, in-page anchors and same-origin relative paths.
 * - `img src`: only same-origin relative paths (`/…`, not `//…` or `/\…`) or raster `data:image/*;base64`.
 * - `style` attributes are kept unless they contain `url(`, other resource functions
 *   (`image-set(`, `cross-fade(`, …), CSS escapes, `expression(`, `@import` or `javascript:`.
 */
import DOMPurify from 'isomorphic-dompurify';
import { isSafeRelativeUrl } from './urlPolicy';

const ALLOWED_TAGS = [
  'a',
  'abbr',
  'article',
  'aside',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'img',
  'ins',
  'li',
  'mark',
  'nav',
  'ol',
  'p',
  'picture',
  'q',
  's',
  'section',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'u',
  'ul',
];

const ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'src',
  'srcset',
  'alt',
  'title',
  'class',
  'id',
  'style',
  'role',
  'open',
  'width',
  'height',
  'loading',
  'decoding',
  'datetime',
  'colspan',
  'rowspan',
  'lang',
  'dir',
  'aria-label',
  'aria-hidden',
  'aria-describedby',
  'aria-labelledby',
];

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|#|\/(?![/\\]))/i;
const SAFE_DATA_IMG_SRC = /^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i;
/**
 * Inline styles must not load anything: no `url()` and no other resource
 * functions, no CSS escapes (`\75rl(` = `url(`), no script-ish values.
 */
const UNSAFE_STYLE =
  /\\|url\s*\(|image-set\s*\(|image\s*\(|cross-fade\s*\(|element\s*\(|src\s*\(|paint\s*\(|expression\s*\(|@import|javascript:|behavior\s*:|-moz-binding/i;

export function isSafeHref(value: string): boolean {
  return SAFE_HREF.test(value.trim());
}

export function isSafeImageSrc(value: string): boolean {
  const src = value.trim();
  return isSafeRelativeUrl(src) || SAFE_DATA_IMG_SRC.test(src);
}

export function isSafeInlineStyle(value: string): boolean {
  return !UNSAFE_STYLE.test(value);
}

function afterSanitizeAttributes(node: Element) {
  if (node.hasAttribute('href')) {
    const href = node.getAttribute('href') ?? '';
    if (!isSafeHref(href)) node.removeAttribute('href');
  }
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  } else if (node.hasAttribute('target')) {
    node.removeAttribute('target');
  }
  if (node.hasAttribute('srcset')) node.removeAttribute('srcset');
  if (node.hasAttribute('src')) {
    const src = node.getAttribute('src') ?? '';
    if (node.tagName !== 'IMG' || !isSafeImageSrc(src)) node.removeAttribute('src');
  }
  if (node.hasAttribute('style')) {
    const style = node.getAttribute('style') ?? '';
    if (!isSafeInlineStyle(style)) node.removeAttribute('style');
  }
}

/** Sanitizes rendered template HTML (string in, string out). */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  DOMPurify.addHook('afterSanitizeAttributes', afterSanitizeAttributes);
  try {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: true,
      ALLOW_ARIA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta', 'base', 'svg', 'math'],
      FORBID_ATTR: ['action', 'formaction', 'xlink:href'],
      RETURN_TRUSTED_TYPE: false,
    }) as unknown as string;
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes', afterSanitizeAttributes);
  }
}
