import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { scopeCss } from '../render/css';
import { sanitizeHtml } from '../render/sanitize';
import { markdownToHtml } from '../render/markdown';
import { composeMenuHtml, renderMenuSlots, validateTemplateSyntax } from '../render';
import { BUILT_IN_TEMPLATES, resolveTemplate } from '../templates';
import { layoutsForOutput, resolveLayoutForOutput } from '../schema';
import { buildPublicMenuDto } from '../resolveCore';
import { buildInput, cocktail, guestInfo, manualDocument, resolverData } from './fixtures';

const SCOPE = '.gm-root[data-gm="m1"]';

describe('scopeCss', () => {
  it('prefixes selectors and replaces root selectors', () => {
    const { css, errors } = scopeCss(':root { color: red } .a, .b > p { margin: 0 } html body .c { x: y } .gm-root.dark { a: b }', SCOPE);
    expect(errors).toEqual([]);
    expect(css).toContain(`${SCOPE} { color: red }`);
    expect(css).toContain(`${SCOPE} .a, ${SCOPE} .b > p`);
    expect(css).toContain(`${SCOPE}.dark`);
    expect(css).not.toMatch(/(^|[\s,])html/);
  });

  it('drops @import and external urls but keeps safe ones and keyframes', () => {
    const { css, warnings } = scopeCss(
      `@import url("https://evil.example/x.css");
       .a { background: url(https://evil.example/t.png); color: blue }
       .b { background: url(/api/public/images/x) }
       .c { width: expression(alert(1)) }
       @keyframes pulse { from { opacity: 0 } to { opacity: 1 } }
       @media (min-width: 600px) { .d { color: red } }`,
      SCOPE,
    );
    expect(css).not.toContain('@import');
    expect(css).not.toContain('evil.example');
    expect(css).not.toContain('expression');
    expect(css).toContain('url(/api/public/images/x)');
    expect(css).toContain('from { opacity: 0 }');
    expect(css).toContain(`@media (min-width: 600px) { ${SCOPE} .d`);
    expect(warnings.length).toBe(3);
  });

  it('reports syntax errors with line numbers', () => {
    const { errors } = scopeCss('.a { color: red }\n.b { color: blue', SCOPE);
    expect(errors[0].line).toBe(2);
  });
});

describe('sanitizeHtml', () => {
  it('removes scripts, handlers, iframes and unsafe urls', () => {
    const html = sanitizeHtml(
      '<div onclick="x()"><script>alert(1)</script><iframe src="https://x"></iframe><a href="javascript:alert(1)">a</a><a href="https://ok.example" target="_blank">b</a><img src="https://track.example/p.gif"><img src="/api/public/images/bar/cocktail/1"><img src="data:image/png;base64,AAAA"></div>',
    );
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('script');
    expect(html).not.toContain('iframe');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('track.example');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('src="/api/public/images/bar/cocktail/1"');
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });

  it('keeps details/summary and drops style with url()', () => {
    const html = sanitizeHtml('<details open><summary>More</summary><p style="background:url(https://x)">x</p><p style="color:red">y</p></details>');
    expect(html).toContain('<details open="">');
    expect(html).not.toContain('url(');
    expect(html).toContain('style="color:red"');
  });
});

describe('markdownToHtml', () => {
  it('escapes html and renders basics', () => {
    expect(markdownToHtml('**bold** <b>x</b>\n- a\n- b')).toBe('<p><strong>bold</strong> &lt;b&gt;x&lt;/b&gt;</p><ul><li>a</li><li>b</li></ul>');
    expect(markdownToHtml('[x](javascript:alert(1))')).not.toContain('href');
  });
});

describe('renderMenuSlots', () => {
  it.each(BUILT_IN_TEMPLATES.map((t) => t.id))('uses a neutral, uniform notice border instead of an accent stripe (%s)', (templateId) => {
    const declarations: Record<string, string> = {};
    postcss.parse(resolveTemplate({ templateId }).css).walkRules((rule) => {
      if (!rule.selectors.some((selector) => /\.gm-notice$/.test(selector.trim()))) return;
      rule.walkDecls((declaration) => {
        declarations[declaration.prop] = declaration.value;
      });
    });
    expect(declarations.border).toContain('1px solid');
    expect(declarations.border).not.toContain('--gm-accent');
    expect(declarations['border-left']).toBeUndefined();
    expect(declarations['border-left-color']).toBeUndefined();
  });

  it('keeps line breaks in the subtitle', () => {
    expect(resolveTemplate({ templateId: 'classic' }).css).toMatch(/\.gm-subtitle \{[^}]*white-space: pre-line/);
  });

  it('maps touch-only layouts to a static grid for monitor and print', () => {
    expect(resolveLayoutForOutput('gallery', 'web')).toBe('gallery');
    expect(resolveLayoutForOutput('tiles', 'web')).toBe('tiles');
    expect(resolveLayoutForOutput('gallery', 'monitor')).toBe('grid');
    expect(resolveLayoutForOutput('tiles', 'print')).toBe('grid');
    expect(layoutsForOutput('monitor')).not.toContain('gallery');
    expect(layoutsForOutput('web')).toContain('gallery');
  });

  const data = resolverData(
    [
      cocktail({ id: 'c1', name: 'Negroni & Co', hasImage: true, history: 'Since **1919**' }),
      cocktail({ id: 'c2', name: 'Virgin', unavailableUntil: '2030-01-01T00:00:00Z' }),
    ],
    {
      guestInfo: new Map([
        ['c1', guestInfo({ allergens: [{ code: 'MILK', optional: false }], additives: [{ code: 'CAFFEINE', optional: false }] })],
        ['c2', guestInfo({ alcohol: { abv: 0, status: 'calculated', category: 'alcoholFree', alcoholFree: true, grams: 0, volumeMl: 100 } })],
      ]),
    },
  );
  const doc = manualDocument(['c1', 'c2'], (d) => {
    d.outputs.web.fields = {
      ...d.outputs.web.fields,
      allergens: 'list',
      allergenDisplay: 'footnotes',
      additives: 'list',
      history: 'expandable',
      alcoholDisplay: 'percent',
    };
    (d.blocks[1] as { overrides: object }).overrides = { c1: { highlight: 'signature' } };
  });
  const { dto } = buildPublicMenuDto(buildInput(doc), data);

  it.each(BUILT_IN_TEMPLATES.map((t) => t.id))('renders built-in template %s without errors', (templateId) => {
    const template = resolveTemplate({ templateId });
    expect(validateTemplateSyntax(template)).toEqual([]);
    const rendered = renderMenuSlots(dto, template, 'web');
    expect(rendered.errors).toEqual([]);
    expect(rendered.cssErrors).toEqual([]);
    expect(rendered.sections).toHaveLength(1);
    const [first, second] = rendered.sections[0].items;
    expect(first.html).toContain('Negroni &amp; Co');
    expect(first.html).toContain('gm-badge--signature');
    expect(first.html).toContain('G,11');
    expect(second.html).toContain('is-unavailable');
    expect(first.detailHtml).toContain('<details');
    expect(rendered.footer).toContain('Milch');
    expect(rendered.css.startsWith(`.gm-root[data-gm="menu1"]{--gm-bg`)).toBe(true);
  });

  it('renders expandable history and alcohol labels in the list (classic)', () => {
    const rendered = renderMenuSlots(dto, resolveTemplate({ templateId: 'classic' }), 'web');
    const html = rendered.sections[0].items[0].html;
    expect(html).toContain('<details class="gm-expand">');
    expect(html).toContain('<strong>1919</strong>');
    expect(html).toMatch(/ca\. 12,3 % vol/);
  });

  it('applies custom slots, escapes output and reports line numbers', () => {
    const template = resolveTemplate({
      templateId: 'classic',
      slots: { item: '<p>{{ item.name }}</p>\n<p>{{ item.price | money }}</p>\n{% if %}' },
    });
    const errors = validateTemplateSyntax(template);
    expect(errors[0]).toMatchObject({ slot: 'item', line: 3 });

    const ok = renderMenuSlots(
      dto,
      resolveTemplate({
        templateId: 'classic',
        slots: { item: '<p onclick="x">{{ item.name }} {{ item.price | money }} {{ "badge.new" | t }}</p><script>1</script>' },
      }),
      'web',
    );
    expect(ok.sections[0].items[0].html).toMatch(/^<p>Negroni &amp; Co 10,00(\s|&nbsp;)€ Neu<\/p>$/);
  });

  it('has no file system access and hides prototypes', () => {
    const rendered = renderMenuSlots(dto, resolveTemplate({ templateId: 'classic', slots: { item: "{% include '/etc/passwd' %}" } }), 'web');
    expect(rendered.errors[0]?.slot).toBe('item');
    const proto = renderMenuSlots(
      dto,
      resolveTemplate({ templateId: 'classic', slots: { item: '[{{ item.constructor }}{{ item.__proto__ }}{{ item.constructor.name }}]' } }),
      'web',
    );
    expect(proto.sections[0].items[0].html).toBe('[]');
  });

  it('composes static html for print', () => {
    const { dto: printDto } = buildPublicMenuDto(buildInput(doc, { output: 'print' }), data);
    const rendered = renderMenuSlots(printDto, resolveTemplate({ templateId: 'print-elegant' }), 'print');
    expect(rendered.sections[0].items[0].detailHtml).toBe('');
    const html = composeMenuHtml(rendered);
    expect(html).toContain('<div class="gm-root" data-gm="menu1" data-output="print"');
    expect(html).toContain('id="gm-section-sec1"');
    expect(html).toContain('Negroni &amp; Co');
  });
});
