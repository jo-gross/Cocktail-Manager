/**
 * Self-contained print HTML for guest menus (PDF via lib/pdf/browser.ts):
 * composeMenuHtml output + print base CSS (@page per paper) + inlined fonts
 * (base64 @font-face) + images inlined as data URIs from the DB + optional QR
 * code. No external requests – the Chromium service never calls back into the app.
 */
import QRCode from 'qrcode';
import prisma from '../../../prisma/prisma';
import type { GuestMenu, Workspace } from '@generated/prisma/client';
import { ApiError } from '@lib/http/ApiError';
import { composeMenuHtml } from '../render';
import { escapeHtml } from '../render/markdown';
import { toGuestUiLocale, translateGuestText } from '../render/uiTexts';
import { createPublicImageUrls, getBarSlug, loadWorkspaceGuestSettings, pickContentLocale, type ResolvedMenuMeta } from '../resolve';
import { DEFAULT_THEME, type GuestMenuDocument, type PrintPaper } from '../schema';
import { resolveLocalizedText } from '../localizedText';
import { getFontStack } from '../theme';
import { decodeImage } from '../public.server';
import { loadWorkspaceImage } from '../workspaceImage.server';
import { getPublicOrigin, parseStoredDocument, renderGuestMenu } from '../server';
import { buildInlineFontCss } from './fonts.server';
import { buildPrintBaseCss, buildTableTentCss, safeCssValue, type TableTentPaper } from './printCss';

type RequestLike = Parameters<typeof getPublicOrigin>[0];

export interface GuestMenuPrintOptions {
  source: 'draft' | 'published';
  locale?: string | null;
  paper?: PrintPaper;
  showQrCode?: boolean;
  req?: RequestLike;
}

export interface GuestMenuPrintHtml {
  html: string;
  paper: PrintPaper;
  locale: string;
  fileName: string;
}

function toDataUri(raw: string | null | undefined): string | null {
  const image = raw ? decodeImage(raw) : null;
  return image ? `data:${image.contentType};base64,${image.bytes.toString('base64')}` : null;
}

/** Public image URL → data URI for every image referenced by the rendered menu. */
async function loadInlineImages(workspace: Pick<Workspace, 'id' | 'publicSlug'>, menuId: string, document: GuestMenuDocument, meta: ResolvedMenuMeta) {
  const urls = createPublicImageUrls(workspace, menuId, null);
  const replacements = new Map<string, string>();

  if (meta.cocktailImageIds.length > 0) {
    const rows = await prisma.cocktailRecipeImage.findMany({
      where: { cocktailRecipeId: { in: meta.cocktailImageIds }, cocktailRecipe: { workspaceId: workspace.id } },
      select: { cocktailRecipeId: true, image: true },
    });
    for (const row of rows) {
      const uri = toDataUri(row.image);
      if (uri && !replacements.has(urls.cocktail(row.cocktailRecipeId))) replacements.set(urls.cocktail(row.cocktailRecipeId), uri);
    }
  }
  if (meta.workspaceLogo) {
    const row = await prisma.workspace.findUnique({ where: { id: workspace.id }, select: { image: true } });
    const image = await loadWorkspaceImage(row?.image);
    const uri = image ? `data:${image.contentType};base64,${image.bytes.toString('base64')}` : null;
    if (uri) replacements.set(urls.workspaceLogo(), uri);
  }
  for (const assetKey of meta.menuAssets) {
    let raw: string | null | undefined = null;
    if (assetKey === 'logo') raw = document.theme.logo;
    else if (assetKey === 'background') raw = document.theme.backgroundImage;
    else if (assetKey.startsWith('block-')) {
      const block = document.blocks.find((candidate) => candidate.type === 'image' && candidate.id === assetKey.slice(6));
      raw = block?.type === 'image' ? block.src : null;
    }
    const uri = toDataUri(raw);
    if (uri) replacements.set(urls.menuAsset(assetKey), uri);
  }
  return replacements;
}

function replaceAll(html: string, replacements: Map<string, string>): string {
  let result = html;
  for (const [url, dataUri] of replacements) result = result.split(url).join(dataUri);
  return result;
}

export function getPublicMenuUrl(workspace: Pick<Workspace, 'id' | 'publicSlug'>, menu: Pick<GuestMenu, 'slug'> | null, req?: RequestLike): string {
  const bar = encodeURIComponent(getBarSlug(workspace));
  return `${getPublicOrigin(req)}/m/${bar}${menu ? `/${encodeURIComponent(menu.slug)}` : ''}`;
}

function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
}

function fileSafe(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'menu'
  );
}

/** Print documents are fully self-contained: no scripts, no network, only inline styles and data: images/fonts. */
export const PRINT_CSP = "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'";

function wrapDocument(input: { lang: string; title: string; css: string[]; body: string }): string {
  const style = input.css
    .filter(Boolean)
    .map((css) => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`)
    .join('\n');
  return `<!DOCTYPE html>
<html lang="${escapeHtml(input.lang)}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${PRINT_CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)}</title>
${style}
</head>
<body>
${input.body}
</body>
</html>`;
}

function publicWorkspace(workspace: Workspace) {
  return { id: workspace.id, name: workspace.name, publicSlug: workspace.publicSlug, hasImage: !!workspace.image };
}

/** Full print HTML of a guest menu (draft or published). */
export async function buildGuestMenuPrintHtml(workspace: Workspace, menu: GuestMenu, options: GuestMenuPrintOptions): Promise<GuestMenuPrintHtml> {
  const document = parseStoredDocument(options.source === 'draft' ? menu.draft : menu.published);
  if (!document) {
    throw new ApiError(404, 'NOT_FOUND', options.source === 'draft' ? 'Draft document is invalid' : 'Guest menu is not published');
  }
  const paper = options.paper ?? document.outputs.print.paper;
  const showQrCode = options.showQrCode ?? document.outputs.print.showQrCode;

  const { dto, rendered, meta } = await renderGuestMenu({
    workspace: publicWorkspace(workspace),
    menu,
    document,
    output: 'print',
    locale: options.locale ?? undefined,
    isPreview: options.source === 'draft',
  });

  const replacements = await loadInlineImages(workspace, menu.id, document, meta);
  const menuHtml = replaceAll(composeMenuHtml(rendered), replacements);
  const fontCss = await buildInlineFontCss(rendered.css);
  const background = safeCssValue(dto.theme.cssVariables['--gm-bg'], '#ffffff');

  let qr = '';
  if (showQrCode) {
    const url = getPublicMenuUrl(workspace, menu, options.req);
    const uiLocale = dto.uiLocale ?? toGuestUiLocale(dto.locale);
    const text = translateGuestText('print.qrHint', uiLocale, {}, dto.uiTexts ?? {});
    qr = `<div class="gm-print-qr"><div class="gm-print-qr-code">${await qrSvg(url)}</div><div class="gm-print-qr-text">${escapeHtml(text)}<span class="gm-print-qr-url">${escapeHtml(url.replace(/^https?:\/\//, ''))}</span></div></div>`;
  }

  // QR + footer share the root's theme colors: the QR block sits inside a themed wrapper.
  const qrBlock = qr ? `<div class="${escapeHtml(rendered.rootAttributes.class)}" data-gm="${escapeHtml(rendered.rootAttributes['data-gm'])}">${qr}</div>` : '';
  const html = wrapDocument({
    lang: dto.locale,
    title: dto.menu.title || menu.name,
    css: [fontCss, buildPrintBaseCss(paper, background)],
    body: `<div class="gm-print" data-paper="${paper}">${menuHtml}${qrBlock}</div>`,
  });
  return { html, paper, locale: dto.locale, fileName: `${fileSafe(menu.slug)}-${paper.toLowerCase()}-${dto.locale}.pdf` };
}

export interface TableTentHtml {
  html: string;
  paper: TableTentPaper;
  fileName: string;
}

export interface TableTentOptions {
  target: 'bar' | 'menu';
  locale?: string | null;
  paper?: TableTentPaper;
  req?: RequestLike;
}

/** Printable table tent card (A6/A5) with bar name/logo, "Unsere Karte" and a big QR code. */
export async function buildTableTentHtml(workspace: Workspace, menu: GuestMenu, options: TableTentOptions): Promise<TableTentHtml> {
  const document = parseStoredDocument(menu.published) ?? parseStoredDocument(menu.draft);
  const theme = document?.theme ?? DEFAULT_THEME;
  const settings = await loadWorkspaceGuestSettings(workspace.id);
  const available = [settings.contentLocales.primary, ...settings.contentLocales.additional];
  const locale = pickContentLocale(options.locale ?? null, available, settings.contentLocales.primary);
  const uiLocale = toGuestUiLocale(options.locale ?? locale);
  const paper = options.paper ?? 'A6';
  const overrides: Record<string, string> = {};
  for (const [key, value] of Object.entries(document?.uiTexts ?? {})) {
    const resolved = resolveLocalizedText(value, locale, settings.contentLocales.primary);
    if (resolved) overrides[key] = resolved;
  }

  const url = getPublicMenuUrl(workspace, options.target === 'menu' ? menu : null, options.req);
  const workspaceLogo = !theme.logo ? await loadWorkspaceImage(workspace.image) : null;
  const logo = theme.logo ? toDataUri(theme.logo) : workspaceLogo ? `data:${workspaceLogo.contentType};base64,${workspaceLogo.bytes.toString('base64')}` : null;
  const colors = {
    bg: safeCssValue(theme.tokens.colors.bg, '#ffffff'),
    text: safeCssValue(theme.tokens.colors.text, '#111111'),
    muted: safeCssValue(theme.tokens.colors.muted, '#555555'),
    accent: safeCssValue(theme.tokens.colors.accent, '#111111'),
  };
  const fonts = { heading: getFontStack(theme.tokens.fontHeading), body: getFontStack(theme.tokens.fontBody) };
  const css = buildTableTentCss(paper, colors, fonts);
  const fontCss = await buildInlineFontCss(`${fonts.heading};${fonts.body}`);

  const title = translateGuestText('print.tableTentTitle', uiLocale, {}, overrides);
  const hint = translateGuestText('print.tableTentHint', uiLocale, {}, overrides);
  const body = `<div class="tt">
<div class="tt-head">${logo ? `<img class="tt-logo" src="${escapeHtml(logo)}" alt="">` : ''}<p class="tt-bar">${escapeHtml(workspace.name)}</p></div>
<h1 class="tt-title">${escapeHtml(title)}</h1>
<div class="tt-qr">${await qrSvg(url)}</div>
<div><p class="tt-hint">${escapeHtml(hint)}</p><p class="tt-url">${escapeHtml(url.replace(/^https?:\/\//, ''))}</p></div>
</div>`;
  const html = wrapDocument({ lang: uiLocale, title: `${workspace.name} – ${title}`, css: [fontCss, css], body });
  return {
    html,
    paper,
    fileName: `table-tent-${fileSafe(options.target === 'menu' ? menu.slug : getBarSlug(workspace))}-${paper.toLowerCase()}-${uiLocale}.pdf`,
  };
}
