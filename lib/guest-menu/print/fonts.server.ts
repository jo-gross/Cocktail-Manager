/**
 * Inlined @font-face rules for print/PDF: the same @fontsource weights the guest
 * shell loads (components/guest-menu/shell/fonts.ts), restricted to the latin +
 * latin-ext subsets, with the woff2 files embedded as base64 data URIs – the
 * Chromium PDF service needs no network access to the app.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { GUEST_MENU_FONTS } from '../schema';

/** Font id → @fontsource package + CSS files (keep in sync with components/guest-menu/shell/fonts.ts). */
const FONT_FILES: Partial<Record<(typeof GUEST_MENU_FONTS)[number]['id'], { pkg: string; files: string[] }>> = {
  inter: { pkg: 'inter', files: ['400', '700'] },
  'dm-sans': { pkg: 'dm-sans', files: ['400', '700'] },
  montserrat: { pkg: 'montserrat', files: ['400', '700'] },
  raleway: { pkg: 'raleway', files: ['400', '700'] },
  'josefin-sans': { pkg: 'josefin-sans', files: ['400', '700'] },
  oswald: { pkg: 'oswald', files: ['400', '600'] },
  'playfair-display': { pkg: 'playfair-display', files: ['400', '700', '400-italic'] },
  'cormorant-garamond': { pkg: 'cormorant-garamond', files: ['500', '700', '500-italic'] },
  lora: { pkg: 'lora', files: ['400', '700', '400-italic'] },
  'libre-baskerville': { pkg: 'libre-baskerville', files: ['400', '700'] },
};

const INCLUDED_SUBSETS = /-(latin|latin-ext)-\d+-(normal|italic)$/;

const cache = new Map<string, Promise<string>>();

function fontsourceDir(pkg: string): string {
  return path.join(process.cwd(), 'node_modules', '@fontsource', pkg);
}

async function inlineCssFile(pkg: string, file: string): Promise<string> {
  const dir = fontsourceDir(pkg);
  const css = await fs.readFile(path.join(dir, `${file}.css`), 'utf8');
  const blocks = css.split(/(?=\/\*\s*[\w-]+\s*\*\/)/);
  const result: string[] = [];
  for (const block of blocks) {
    const name = /\/\*\s*([\w-]+)\s*\*\//.exec(block)?.[1];
    if (!name || !INCLUDED_SUBSETS.test(name)) continue;
    const woff2 = /url\((\.\/files\/[^)]+\.woff2)\)/.exec(block)?.[1];
    if (!woff2) continue;
    const data = await fs.readFile(path.join(dir, woff2));
    const face = /@font-face\s*\{[\s\S]*?\}/.exec(block)?.[0];
    if (!face) continue;
    result.push(face.replace(/src:[^;]+;/, `src: url(data:font/woff2;base64,${data.toString('base64')}) format('woff2');`).replace(/font-display:\s*\w+;/, ''));
  }
  return result.join('\n');
}

function loadFont(fontId: string): Promise<string> {
  const entry = FONT_FILES[fontId as keyof typeof FONT_FILES];
  if (!entry) return Promise.resolve('');
  let pending = cache.get(fontId);
  if (!pending) {
    pending = Promise.all(entry.files.map((file) => inlineCssFile(entry.pkg, file)))
      .then((parts) => parts.join('\n'))
      .catch((error) => {
        cache.delete(fontId);
        console.error(`[guest menu print] could not inline font "${fontId}"`, error);
        return '';
      });
    cache.set(fontId, pending);
  }
  return pending;
}

/** Fonts whose family name appears in `css` (theme variables, template or custom CSS). */
export function findUsedFontIds(css: string): string[] {
  return GUEST_MENU_FONTS.filter((font) => font.id in FONT_FILES && new RegExp(`["']${font.label}["']`, 'i').test(css)).map((font) => font.id);
}

/** `@font-face` rules with embedded woff2 data for all fonts referenced in `css`. */
export async function buildInlineFontCss(css: string): Promise<string> {
  const parts = await Promise.all(findUsedFontIds(css).map(loadFont));
  return parts.filter(Boolean).join('\n');
}
