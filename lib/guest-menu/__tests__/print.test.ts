import { describe, expect, it } from 'vitest';
import { buildInlineFontCss, findUsedFontIds } from '../print/fonts.server';
import { buildPrintBaseCss, buildTableTentCss, safeCssValue } from '../print/printCss';
import { themeToCssVariables } from '../theme';
import { DEFAULT_THEME } from '../schema';

describe('print fonts', () => {
  it('detects fonts referenced by the theme variables', () => {
    const variables = themeToCssVariables({ ...DEFAULT_THEME.tokens, fontHeading: 'playfair-display', fontBody: 'lora' });
    const ids = findUsedFontIds(Object.values(variables).join(';'));
    expect(ids).toEqual(expect.arrayContaining(['playfair-display', 'lora']));
    expect(ids).not.toContain('inter');
  });

  it('ignores system font stacks', () => {
    expect(findUsedFontIds('font-family: system-ui, Georgia, serif')).toEqual([]);
  });

  it('inlines latin woff2 subsets as data URIs', async () => {
    const css = await buildInlineFontCss('--gm-font-body:"Lora", Georgia, serif');
    expect(css).toContain("font-family: 'Lora'");
    expect(css).toContain('data:font/woff2;base64,');
    expect(css).toContain('font-style: italic');
    expect(css).not.toMatch(/url\(\.\/files/);
    expect(css).not.toContain('cyrillic');
  });
});

describe('print css', () => {
  it('sets the @page size per paper', () => {
    expect(buildPrintBaseCss('A4', '#fff')).toContain('size: 210mm 297mm');
    expect(buildPrintBaseCss('A5', '#fff')).toContain('size: 148mm 210mm');
    expect(buildPrintBaseCss('DL', '#fff')).toContain('size: 99mm 210mm');
  });

  it('keeps items together and section headers with the next item', () => {
    const css = buildPrintBaseCss('A4', '#fff');
    expect(css).toMatch(/\.gm-item-wrap[\s\S]*break-inside: avoid/);
    expect(css).toMatch(/\.gm-section-header \{ break-after: avoid/);
  });

  it('builds table tent css for A6 and A5', () => {
    const colors = { bg: '#fff', text: '#000', muted: '#555', accent: '#a00' };
    expect(buildTableTentCss('A6', colors, { heading: 'serif', body: 'sans-serif' })).toContain('size: 105mm 148mm');
    expect(buildTableTentCss('A5', colors, { heading: 'serif', body: 'sans-serif' })).toContain('size: 148mm 210mm');
  });

  it('strips characters that could break out of a declaration', () => {
    expect(safeCssValue('#fff;}</style><script>', '#000')).toBe('#fff/stylescript');
    expect(safeCssValue('', '#000')).toBe('#000');
  });
});
