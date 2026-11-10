/**
 * CSS scoping & cleaning for template/custom CSS (postcss + postcss-selector-parser).
 *
 * - Every selector is prefixed with the scope (`.gm-root[data-gm="<id>"]`);
 *   leading `:root`, `html`, `body` and `.gm-root` compounds are replaced by it.
 * - Selectors starting with a combinator or reaching root siblings (`html + x`)
 *   are removed.
 * - Only allowlisted at-rules survive (`@import`, `@property`, `@scope`, … are
 *   dropped); `@keyframes` stay unscoped; `@font-face` families must start with `gm-`.
 * - `url()` is only kept for same-origin relative paths and raster `data:` images
 *   (+ data fonts); declarations with other `url()`s, CSS escapes (`\`),
 *   `image-set()`/`image()`/`cross-fade()`/`element()`/`src()`, `expression()`,
 *   `javascript:` are removed.
 */
import postcss, { type AtRule, type Container, type Declaration, type Root } from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { SAFE_DATA_FONT, SAFE_DATA_IMAGE, SAFE_RELATIVE_URL } from './urlPolicy';

export interface CssIssue {
  message: string;
  line: number | null;
  column: number | null;
}

export interface ScopedCssResult {
  css: string;
  errors: CssIssue[];
  /** Removed constructs (imports, external urls, …) – informative. */
  warnings: CssIssue[];
}

export function getScopeSelector(menuId: string): string {
  return `.gm-root[data-gm="${menuId.replace(/["\\]/g, '')}"]`;
}

/** Everything else (`@import`, `@property`, `@scope`, `@namespace`, `@document`, …) is dropped. */
const ALLOWED_AT_RULES = new Set(['media', 'supports', 'font-face', 'keyframes', 'layer', 'container', 'page', 'counter-style', 'starting-style']);
const UNSAFE_VALUE = /expression\s*\(|javascript:|behavior\s*:|-moz-binding/i;
/**
 * Functions that load resources from bare strings (or build images from other
 * elements) – only `url()` with a checked argument may reference resources.
 */
const BLOCKED_FUNCTIONS = new Set(['image-set', 'image', 'cross-fade', 'element', 'src', 'paint', 'expression']);
const ROOT_TAGS = new Set(['html', 'body']);
/** `@font-face` families must be namespaced so they cannot shadow other fonts of the page. */
const FONT_FAMILY_PREFIX = /^gm-[a-z0-9-]+$/i;

function isSafeUrlArgument(raw: string): boolean {
  const argument = raw.trim();
  const quote = argument[0] === '"' || argument[0] === "'" ? argument[0] : '';
  if (quote && argument[argument.length - 1] !== quote) return false;
  const url = quote ? argument.slice(1, -1) : argument;
  return SAFE_RELATIVE_URL.test(url) || SAFE_DATA_IMAGE.test(url) || SAFE_DATA_FONT.test(url);
}

/**
 * True if a CSS value only references same-origin relative paths or data
 * images/fonts via `url()`. Backslashes (CSS escapes like `\75rl(`) are
 * rejected outright, so the plain-text scan below sees the real tokens.
 */
export function isSafeCssValue(value: string): boolean {
  if (value.includes('\\') || UNSAFE_VALUE.test(value)) return false;
  const functions = /([-a-z0-9_]+)\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = functions.exec(value))) {
    const name = match[1].toLowerCase().replace(/^-(webkit|moz|ms|o)-/, '');
    if (BLOCKED_FUNCTIONS.has(name)) return false;
  }
  const urls = /url\s*\(\s*("[^"]*"|'[^']*'|[^)]*)\)/gi;
  while ((match = urls.exec(value))) {
    if (!isSafeUrlArgument(match[1])) return false;
  }
  return true;
}

function declarationValues(decl: Declaration): string[] {
  const raw = (decl.raws as { value?: { raw?: string } }).value?.raw;
  return raw && raw !== decl.value ? [decl.value, raw] : [decl.value];
}

function isAllowedAtRule(name: string): boolean {
  return ALLOWED_AT_RULES.has(name.toLowerCase().replace(/^-(webkit|moz|ms|o)-(?=keyframes$)/, ''));
}

class UnsafeSelectorError extends Error {}

function isInsideKeyframes(node: { parent?: Container | Root | undefined | null }): boolean {
  let parent = node.parent as (Container & { name?: string; type: string; parent?: Container }) | undefined;
  while (parent) {
    if (parent.type === 'atrule' && /keyframes$/i.test(parent.name ?? '')) return true;
    parent = parent.parent as typeof parent;
  }
  return false;
}

function createSelectorTransformer(scope: string) {
  const scopeNodes = () =>
    selectorParser()
      .astSync(scope)
      .first.nodes.map((node) => node.clone({}) as selectorParser.Node);

  return selectorParser((selectors) => {
    selectors.each((selector) => {
      // `+ x`, `~ x`, `> x` (also relative nested selectors) could reach siblings of the root.
      if (selector.first?.type === 'combinator') throw new UnsafeSelectorError('Selectors must not start with a combinator');
      const leading: selectorParser.Node[] = [];
      let next: selectorParser.Node | undefined;
      for (const node of selector.nodes) {
        if (node.type === 'combinator') {
          next = node;
          break;
        }
        leading.push(node);
      }
      const rootish = leading.filter(
        (node) =>
          (node.type === 'tag' && ROOT_TAGS.has(node.value.toLowerCase())) ||
          (node.type === 'pseudo' && node.value === ':root') ||
          (node.type === 'class' && node.value === 'gm-root'),
      );
      if (rootish.length > 0) {
        if (next && /[+~]/.test(next.value ?? '')) throw new UnsafeSelectorError('Sibling combinators after the menu root are not allowed');
        const anchor = rootish[0];
        for (const node of scopeNodes()) selector.insertBefore(anchor as never, node as never);
        for (const node of rootish) node.remove();
        return;
      }
      const first = selector.first;
      const nodes = [...scopeNodes(), selectorParser.combinator({ value: ' ' })];
      for (const node of nodes) selector.insertBefore(first as never, node as never);
    });
  });
}

/** Scopes and cleans CSS. Syntax errors are returned (with line numbers) instead of thrown. */
export function scopeCss(css: string | null | undefined, scope: string): ScopedCssResult {
  const errors: CssIssue[] = [];
  const warnings: CssIssue[] = [];
  if (!css || css.trim() === '') return { css: '', errors, warnings };

  let root: Root;
  try {
    root = postcss.parse(css);
  } catch (error) {
    const e = error as { reason?: string; message?: string; line?: number; column?: number };
    errors.push({ message: e.reason ?? e.message ?? 'Invalid CSS', line: e.line ?? null, column: e.column ?? null });
    return { css: '', errors, warnings };
  }

  const transformer = createSelectorTransformer(scope);
  const issue = (node: { source?: { start?: { line: number; column: number } } }, message: string): CssIssue => ({
    message,
    line: node.source?.start?.line ?? null,
    column: node.source?.start?.column ?? null,
  });

  root.walkAtRules((atRule: AtRule) => {
    if (!isAllowedAtRule(atRule.name) || atRule.name.includes('\\')) {
      warnings.push(issue(atRule, `@${atRule.name} is not allowed and was removed`));
      atRule.remove();
      return;
    }
    if (atRule.params && !isSafeCssValue(atRule.params)) {
      warnings.push(issue(atRule, `@${atRule.name} uses a disallowed value and was removed`));
      atRule.remove();
      return;
    }
    if (atRule.name.toLowerCase() === 'font-face') {
      const families: string[] = [];
      atRule.walkDecls(/^font-family$/i, (decl) => {
        families.push(decl.value.trim().replace(/^(['"])(.*)\1$/, '$2'));
      });
      if (families.length === 0 || families.some((family) => !FONT_FAMILY_PREFIX.test(family))) {
        warnings.push(issue(atRule, '@font-face font-family must start with "gm-" – the rule was removed'));
        atRule.remove();
      }
    }
  });

  root.walkDecls((decl) => {
    if (decl.prop.includes('\\') || declarationValues(decl).some((value) => !isSafeCssValue(value))) {
      warnings.push(issue(decl, `"${decl.prop}" uses a disallowed value (external url, escape or script) and was removed`));
      decl.remove();
    }
  });

  root.walkRules((rule) => {
    if (isInsideKeyframes(rule)) return;
    try {
      rule.selectors = rule.selectors.map((selector) => transformer.processSync(selector.trim()));
    } catch (error) {
      if (error instanceof UnsafeSelectorError) {
        warnings.push(issue(rule, `Selector "${rule.selector}" is not allowed (${error.message}) and was removed`));
      } else {
        errors.push(issue(rule, `Invalid selector "${rule.selector}": ${(error as Error).message}`));
      }
      rule.remove();
    }
  });

  // Drop at-rules that became empty (e.g. @font-face without src).
  root.walkAtRules((atRule) => {
    if (atRule.nodes && atRule.nodes.length === 0) atRule.remove();
  });

  return { css: root.toString(), errors, warnings };
}

export { cssVariablesToDeclarations, getFontStack, themeToCssVariables } from '../theme';
