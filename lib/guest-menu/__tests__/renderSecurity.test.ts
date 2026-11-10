import { describe, expect, it, vi } from 'vitest';
import { isSafeCssValue, scopeCss } from '../render/css';
import { isSafeImageSrc, isSafeInlineStyle, sanitizeHtml } from '../render/sanitize';
import { isSafeRelativeUrl } from '../render/urlPolicy';
import { renderMenuSlots } from '../render';
import { resolveTemplate } from '../templates';
import { buildPublicMenuDto } from '../resolveCore';
import { publicRenderKey, RenderCache } from '../renderCache';
import { lockDownPage } from '../../pdf/browser';
import { buildInput, cocktail, manualDocument, resolverData } from './fixtures';

const SCOPE = '.gm-root[data-gm="m1"]';

describe('URL policy', () => {
  it.each(['/api/public/images/x', '/a/b.png?x=1&y=2', '/'])('accepts same-origin path %s', (url) => {
    expect(isSafeRelativeUrl(url)).toBe(true);
  });

  it.each(['//evil.example/x', '/\\evil.example/x', '/\t/evil.example/x', '/a b', '/a"b', "/a'b", '/a(b)', 'https://evil.example', 'x/y', ''])(
    'rejects %j',
    (url) => {
      expect(isSafeRelativeUrl(url)).toBe(false);
    },
  );
});

describe('scopeCss – url bypasses', () => {
  it.each([
    '.a { background: image-set("https://evil.example/a.png" 1x) }',
    '.a { background: -webkit-image-set(url(/ok.png) 1x, "https://evil.example/a.png" 2x) }',
    '.a { background: IMAGE-SET("https://evil.example/a.png" 1x) }',
    '.a { background: \\75rl(https://evil.example/a.png) }',
    '.a { background: u\\72l(https://evil.example/a.png) }',
    '.a { background: url("\\2f\\2f evil.example/a.png") }',
    '.a { background: url(/\\evil.example/a.png) }',
    '.a { background: url("//evil.example/a.png") }',
    '.a { background: image("https://evil.example/a.png") }',
    '.a { background: cross-fade(url(/a.png), "https://evil.example/b.png", 50%) }',
    '.a { background: -moz-element(#x) }',
    '.a { background: src("https://evil.example/a.png") }',
    '.a { background: url(data:image/svg+xml;base64,PHN2Zz4=) }',
    '.a { --x: url(https://evil.example/a.png) }',
    '.a { list-style: url(https://evil.example/a.png) }',
  ])('drops %s', (css) => {
    const result = scopeCss(css, SCOPE);
    expect(result.css).not.toMatch(/evil|image-set|\\|cross-fade|element\(|src\(|svg/i);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('keeps safe urls and data images', () => {
    const { css, warnings } = scopeCss('.a { background: url("/api/x.png"), url(data:image/png;base64,AAAA) } .b { color: red }', SCOPE);
    expect(warnings).toEqual([]);
    expect(css).toContain('url("/api/x.png")');
    expect(css).toContain('data:image/png;base64,AAAA');
  });

  it('checks @font-face src and namespaces font families', () => {
    const { css, warnings } = scopeCss(
      `@font-face { font-family: "gm-brand"; src: url(data:font/woff2;base64,AAAA) format("woff2") }
       @font-face { font-family: "Inter"; src: url(data:font/woff2;base64,AAAA) }
       @font-face { font-family: gm-x; src: url(https://evil.example/f.woff2) }
       @font-face { font-family: gm-y; src: \\75rl(https://evil.example/f.woff2) }`,
      SCOPE,
    );
    expect(css).toContain('"gm-brand"');
    expect(css).not.toContain('Inter');
    expect(css).not.toContain('evil');
    // gm-x / gm-y lose their src → empty-ish rules stay harmless; Inter is removed entirely.
    expect(warnings.some((w) => w.message.includes('gm-'))).toBe(true);
  });

  it('drops @property, @scope and other non-allowlisted at-rules', () => {
    const { css } = scopeCss(
      `@property --x { syntax: "<color>"; inherits: true; initial-value: red }
       @scope (body) { p { color: red } }
       @namespace svg url(http://www.w3.org/2000/svg);
       @document url-prefix(https://evil.example) { .a { color: red } }
       @supports (display: grid) { .ok { display: grid } }`,
      SCOPE,
    );
    expect(css).not.toMatch(/@property|@scope|@namespace|@document/);
    expect(css).toContain(`${SCOPE} .ok`);
  });

  it('rejects selectors that could reach outside the root', () => {
    const { css, warnings, errors } = scopeCss(
      `+ .x { color: red }
       ~ .y { color: red }
       > .z { color: red }
       html + div { color: red }
       :root ~ * { color: red }
       .gm-root + .w { color: red }
       body > .ok { color: green }
       .a + .b { color: green }`,
      SCOPE,
    );
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(6);
    expect(css).not.toMatch(/\.x|\.y|\.z|\+ div|~ \*|\.w/);
    expect(css).toContain(`${SCOPE} > .ok`);
    expect(css).toContain(`${SCOPE} .a + .b`);
  });

  it('exposes the value check', () => {
    expect(isSafeCssValue('linear-gradient(red, blue)')).toBe(true);
    expect(isSafeCssValue('url( "/a.png" )')).toBe(true);
    expect(isSafeCssValue('url("/a.png) url(https://evil.example")')).toBe(false);
    expect(isSafeCssValue('"url(/ok)" url(https://evil.example)')).toBe(false);
  });
});

describe('sanitizeHtml – url bypasses', () => {
  it.each([
    'background:image-set("https://evil.example/a.png" 1x)',
    'background:-webkit-image-set("https://evil.example/a.png" 1x)',
    'background:\\75rl(https://evil.example/a.png)',
    'background:cross-fade(url(/a.png), url(/b.png), 50%)',
    'background:image("https://evil.example/a.png")',
    'background:url(/a.png)',
    'content:src("https://evil.example")',
  ])('removes style %s', (style) => {
    expect(isSafeInlineStyle(style)).toBe(false);
    const html = sanitizeHtml(`<p style='${style}'>x</p>`);
    expect(html).toBe('<p>x</p>');
  });

  it('keeps plain inline styles', () => {
    expect(sanitizeHtml('<p style="color:red;background-image:linear-gradient(red,blue)">x</p>')).toContain('style=');
  });

  it.each(['/\\evil.example/a.png', '//evil.example/a.png', '/\t/evil.example', 'https://evil.example/a.png', 'data:image/svg+xml;base64,PHN2Zz4='])(
    'removes img src %j',
    (src) => {
      expect(isSafeImageSrc(src)).toBe(false);
      expect(sanitizeHtml(`<img src="${src}" alt="">`)).not.toContain('src=');
    },
  );

  it('keeps safe img src', () => {
    expect(sanitizeHtml('<img src="/api/public/images/x?a=1" alt="">')).toContain('src="/api/public/images/x?a=1"');
    expect(sanitizeHtml('<a href="/\\evil.example">x</a>')).not.toContain('href');
  });
});

describe('resolver image urls', () => {
  it.each(['/\\evil.example/logo.png', '/\t/evil.example', '/a b.png'])('ignores unsafe theme urls (%j)', (url) => {
    const input = buildInput(
      manualDocument([], (doc) => {
        doc.theme.logo = url;
        doc.theme.backgroundImage = url;
      }),
    );
    const { dto } = buildPublicMenuDto(input, resolverData([]));
    expect(dto.theme.logoUrl).toBeNull();
    expect(dto.theme.backgroundImageUrl).toBeNull();
  });
});

describe('render budget', () => {
  const data = resolverData([cocktail({ id: 'c1', name: 'One' }), cocktail({ id: 'c2', name: 'Two' }), cocktail({ id: 'c3', name: 'Three' })]);
  const { dto } = buildPublicMenuDto(buildInput(manualDocument(['c1', 'c2', 'c3'])), data);

  it('skips everything and records one error once the shared budget is exhausted', () => {
    const rendered = renderMenuSlots(dto, resolveTemplate({ templateId: 'classic' }), 'web', { budgetMs: 0 });
    const budgetErrors = rendered.errors.filter((error) => error.slot === 'render');
    expect(budgetErrors).toHaveLength(1);
    expect(budgetErrors[0].message).toMatch(/budget/);
    expect(rendered.sections[0].items.every((item) => item.html === '' && item.detailHtml === '')).toBe(true);
    expect(rendered.footer).toBe('');
  });

  it('bounds the total render time of slow templates across items', () => {
    const slow = resolveTemplate({
      templateId: 'classic',
      slots: { item: '{% for a in (1..500) %}{% for b in (1..500) %}{% for c in (1..500) %}{% endfor %}{% endfor %}{% endfor %}{{ item.name }}' },
    });
    const started = Date.now();
    const rendered = renderMenuSlots(dto, slow, 'web', { budgetMs: 150 });
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(1500);
    expect(rendered.errors.some((error) => error.slot === 'render' && /budget/.test(error.message))).toBe(true);
    expect(rendered.sections[0].items.map((item) => item.html)).toEqual(['', '', '']);
  });

  it('renders normally within the default budget', () => {
    const rendered = renderMenuSlots(dto, resolveTemplate({ templateId: 'classic' }), 'web');
    expect(rendered.errors).toEqual([]);
    expect(rendered.sections[0].items[2].html).toContain('Three');
  });
});

describe('RenderCache', () => {
  it('dedupes, expires after the TTL and evicts the least recently used entry', async () => {
    let now = 0;
    const cache = new RenderCache<number>(1000, 2, () => now);
    const compute = vi.fn(async () => 1);
    await cache.get('a', compute);
    await cache.get('a', compute);
    expect(compute).toHaveBeenCalledTimes(1);

    await cache.get('b', async () => 2);
    await cache.get('a', compute); // a is now most recently used
    await cache.get('c', async () => 3); // evicts b
    expect(cache.size).toBe(2);
    const b = vi.fn(async () => 22);
    expect(await cache.get('b', b)).toBe(22);
    expect(b).toHaveBeenCalledTimes(1);

    now = 1001;
    await cache.get('a', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('does not cache failures', async () => {
    const cache = new RenderCache<number>(1000, 10, () => 0);
    await expect(cache.get('x', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await Promise.resolve();
    expect(await cache.get('x', async () => 5)).toBe(5);
  });

  it('keys by menu version, locale, output and access variant', () => {
    const base = {
      workspace: { id: 'ws1', publicSlug: 'bar', name: 'Bar', hasImage: false },
      menu: { id: 'm1', publishedAt: new Date(1000), updatedAt: new Date(2000) },
      output: 'web' as const,
      locale: 'de',
    };
    const key = publicRenderKey(base);
    expect(publicRenderKey({ ...base })).toBe(key);
    expect(publicRenderKey({ ...base, locale: 'en' })).not.toBe(key);
    expect(publicRenderKey({ ...base, output: 'monitor' })).not.toBe(key);
    expect(publicRenderKey({ ...base, accessToken: 'secret' })).not.toBe(key);
    expect(publicRenderKey({ ...base, accessToken: 'secret' })).not.toContain('secret');
    expect(publicRenderKey({ ...base, menu: { ...base.menu, publishedAt: new Date(3000) } })).not.toBe(key);
    expect(publicRenderKey({ ...base, menu: { ...base.menu, updatedAt: new Date(3000) } })).not.toBe(key);
  });
});

describe('PDF lockdown', () => {
  it('disables scripts and aborts every non-data request', async () => {
    let handler: ((request: unknown) => void) | undefined;
    const page = {
      setJavaScriptEnabled: vi.fn(async () => undefined),
      setRequestInterception: vi.fn(async () => undefined),
      on: vi.fn((event: string, fn: (request: unknown) => void) => {
        if (event === 'request') handler = fn;
      }),
    };
    await lockDownPage(page as never);
    expect(page.setJavaScriptEnabled).toHaveBeenCalledWith(false);
    expect(page.setRequestInterception).toHaveBeenCalledWith(true);
    const request = (url: string) => ({
      url: () => url,
      isInterceptResolutionHandled: () => false,
      continue: vi.fn(async () => undefined),
      abort: vi.fn(async () => undefined),
    });
    for (const url of ['data:image/png;base64,AAAA', 'about:blank']) {
      const r = request(url);
      handler!(r);
      expect(r.continue).toHaveBeenCalled();
      expect(r.abort).not.toHaveBeenCalled();
    }
    for (const url of ['http://169.254.169.254/latest', 'https://evil.example/a.png', 'file:///etc/passwd', 'ws://x']) {
      const r = request(url);
      handler!(r);
      expect(r.abort).toHaveBeenCalled();
      expect(r.continue).not.toHaveBeenCalled();
    }
  });
});
