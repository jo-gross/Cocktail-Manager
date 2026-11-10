/**
 * Public guest menu resolution shared by `/api/public/menus/[...slug]` and the
 * SSR page `/m/[...slug]` (spec: "Mehrere Gästekarten & Zeitsteuerung").
 *
 * - `/m/{bar}`: active (enabled + published + schedule) menu → lowest priority;
 *   else default; else `noMenu`.
 * - `/m/{bar}/{menu}`: valid → menu; else notice per `inactiveBehavior`
 *   (NOTICE_WITH_LINK: notice + link, NOTICE_WITH_CONTENT: notice + content,
 *   REDIRECT: redirect to the current menu). Disabled menus never show content.
 * - `?preview={previewToken}` shows the draft and ignores the schedule (and the access code).
 * - Menus with an access code (`accessCodeHash`) return `locked` (title/logo/theme
 *   only) unless `access` grants it (guest cookie or signage token, see access.ts).
 */
import prisma from '../../prisma/prisma';
import type { GuestMenu } from '@generated/prisma/client';
import { DEFAULT_THEME, GUEST_MENU_OUTPUTS, type GuestMenuDocument, type GuestMenuOutput } from './schema';
import { describeMenuValidity, getScheduleNow, resolveActiveMenu, type MenuValidity } from './schedule';
import { createPublicImageUrls, getBarSlug, loadWorkspaceGuestSettings, pickContentLocale } from './resolve';
import { findPublicWorkspace, parseStoredDocument, renderGuestMenu, type PublicWorkspace, type RenderedGuestMenu } from './server';
import { isNumericAccessCodeHash, NO_MENU_ACCESS, type MenuAccess } from './access';
import { resolveLocalizedText } from './localizedText';
import { themeToCssVariables } from './theme';
import { publicRenderKey, RenderCache } from './renderCache';
import { isSafeRelativeUrl } from './render/urlPolicy';

const publicRenderCache = new RenderCache<RenderedGuestMenu>();

export interface PublicMenuNotice {
  reason: NonNullable<MenuValidity['reason']>;
  validity: Pick<MenuValidity, 'startsAt' | 'endedAt' | 'weekdays' | 'timeFrom' | 'timeTo'>;
  /** Path of the currently active menu (`/m/{bar}/{slug}`), if any. */
  currentMenuPath: string | null;
}

/** Everything the PIN page may show before unlocking (no menu content). */
export interface PublicMenuLock {
  menuId: string;
  menuSlug: string;
  /** `/m/{bar}/{slug}` – where to go after unlocking a directly addressed menu. */
  menuPath: string;
  /** `POST` target (JSON or form). */
  unlockPath: string;
  title: string;
  workspaceName: string;
  logoUrl: string | null;
  cssVariables: Record<string, string>;
  /** Code consists of digits only (numeric keypad). */
  numeric: boolean;
  /** Content locale of `title`. */
  locale: string;
}

export type PublicMenuResult =
  | { kind: 'notFound'; barPath: string | null; workspaceName: string | null }
  | { kind: 'locked'; workspace: PublicWorkspace; barPath: string; lock: PublicMenuLock }
  | { kind: 'noMenu'; workspace: PublicWorkspace; barPath: string }
  | { kind: 'redirect'; location: string }
  | {
      kind: 'menu';
      workspace: PublicWorkspace;
      barPath: string;
      /** `null` for NOTICE_WITH_LINK / disabled menus (notice only). */
      menu: RenderedGuestMenu | null;
      notice: PublicMenuNotice | null;
      isPreview: boolean;
      /** Locales/meta for the page even without content. */
      menuName: string;
      /** The shown menu has an access code (responses must not be cached publicly). */
      isProtected: boolean;
    };

export interface LoadPublicMenuInput {
  bar: string;
  menuSlug?: string | null;
  locale?: string | null;
  /** Accept-Language preferences when `locale` is not set. */
  preferredLocales?: string[];
  output?: GuestMenuOutput;
  previewToken?: string | null;
  /** Access cookies/tokens of the request; default: none (protected menus are locked). */
  access?: MenuAccess;
  now?: Date;
}

function menuPath(workspace: PublicWorkspace, slug: string) {
  return `/m/${encodeURIComponent(getBarSlug(workspace))}/${encodeURIComponent(slug)}`;
}

/** Logo exactly like the rendered header (menu asset → relative URL → workspace logo). */
function lockLogoUrl(workspace: PublicWorkspace, menu: GuestMenu, document: GuestMenuDocument | null): string | null {
  const logo = document?.theme.logo;
  if (logo && /^data:image\//i.test(logo)) return createPublicImageUrls(workspace, menu.id).menuAsset('logo');
  if (logo && isSafeRelativeUrl(logo)) return logo;
  if (!logo && workspace.hasImage) return createPublicImageUrls(workspace, menu.id).workspaceLogo();
  return null;
}

export async function buildMenuLock(
  workspace: PublicWorkspace,
  menu: GuestMenu,
  document: GuestMenuDocument | null,
  locale?: string | null,
  preferredLocales: string[] = [],
): Promise<PublicMenuLock> {
  const settings = await loadWorkspaceGuestSettings(workspace.id);
  const primary = settings.contentLocales.primary;
  const available =
    menu.locales.length > 0 ? [primary, ...menu.locales.filter((entry) => entry !== primary)] : [primary, ...settings.contentLocales.additional];
  const contentLocale = pickContentLocale(
    locale ?? preferredLocales.find((entry) => pickContentLocale(entry, available, '') !== '') ?? null,
    available,
    primary,
  );
  const path = menuPath(workspace, menu.slug);
  return {
    menuId: menu.id,
    menuSlug: menu.slug,
    menuPath: path,
    unlockPath: `/api/public/menus/${encodeURIComponent(getBarSlug(workspace))}/${encodeURIComponent(menu.slug)}/unlock`,
    title: resolveLocalizedText(document?.title, contentLocale, primary, menu.name) || menu.name,
    workspaceName: workspace.name,
    logoUrl: lockLogoUrl(workspace, menu, document),
    cssVariables: themeToCssVariables((document?.theme ?? DEFAULT_THEME).tokens),
    numeric: isNumericAccessCodeHash(menu.accessCodeHash),
    locale: contentLocale,
  };
}

export async function loadPublicMenu(input: LoadPublicMenuInput): Promise<PublicMenuResult> {
  const now = input.now ?? new Date();
  const access = input.access ?? NO_MENU_ACCESS;
  const output: GuestMenuOutput = input.output && GUEST_MENU_OUTPUTS.includes(input.output) ? input.output : 'web';
  const workspace = await findPublicWorkspace(input.bar);
  if (!workspace) return { kind: 'notFound', barPath: null, workspaceName: null };
  const barPath = `/m/${encodeURIComponent(getBarSlug(workspace))}`;

  const [menus, settings] = await Promise.all([prisma.guestMenu.findMany({ where: { workspaceId: workspace.id } }), loadWorkspaceGuestSettings(workspace.id)]);
  const scheduleNow = getScheduleNow(now, settings);
  const active = resolveActiveMenu(menus, scheduleNow);

  const render = async (menu: GuestMenu, source: 'draft' | 'published') => {
    const document = parseStoredDocument(source === 'draft' ? menu.draft : menu.published);
    if (!document || !document.outputs[output].enabled) return null;
    const accessToken = source === 'published' ? access.signageTokenFor(menu) : null;
    const compute = () =>
      renderGuestMenu({
        workspace,
        menu,
        document,
        output,
        locale: input.locale,
        preferredLocales: input.preferredLocales,
        now,
        isPreview: source === 'draft',
        previewToken: source === 'draft' ? menu.previewToken : null,
        accessToken,
      });
    // Published renders only (no previews); an explicit `now` (tests, time travel) bypasses the cache.
    if (source === 'draft' || input.now) return compute();
    return publicRenderCache.get(
      publicRenderKey({ workspace, menu, output, locale: input.locale, preferredLocales: input.preferredLocales, accessToken }),
      compute,
    );
  };
  const locked = async (menu: GuestMenu): Promise<PublicMenuResult> => ({
    kind: 'locked',
    workspace,
    barPath,
    lock: await buildMenuLock(workspace, menu, parseStoredDocument(menu.published), input.locale, input.preferredLocales),
  });

  if (!input.menuSlug) {
    if (!active) return { kind: 'noMenu', workspace, barPath };
    if (!access.canAccess(active)) return locked(active);
    const rendered = await render(active, 'published');
    if (!rendered) return { kind: 'noMenu', workspace, barPath };
    return { kind: 'menu', workspace, barPath, menu: rendered, notice: null, isPreview: false, menuName: active.name, isProtected: !!active.accessCodeHash };
  }

  const menu = menus.find((candidate) => candidate.slug === input.menuSlug);
  if (!menu) return { kind: 'notFound', barPath, workspaceName: workspace.name };

  if (input.previewToken && input.previewToken === menu.previewToken) {
    const rendered = await render(menu, 'draft');
    if (!rendered) return { kind: 'notFound', barPath, workspaceName: workspace.name };
    return { kind: 'menu', workspace, barPath, menu: rendered, notice: null, isPreview: true, menuName: menu.name, isProtected: !!menu.accessCodeHash };
  }

  if (menu.published == null) return { kind: 'notFound', barPath, workspaceName: workspace.name };
  // Protected: nothing (no content, schedule notice or redirect target) before unlocking.
  if (!access.canAccess(menu)) return locked(menu);
  const isProtected = !!menu.accessCodeHash;

  const validity = describeMenuValidity(menu, scheduleNow, { requirePublished: true });
  if (validity.valid) {
    const rendered = await render(menu, 'published');
    if (!rendered) return { kind: 'notFound', barPath, workspaceName: workspace.name };
    return { kind: 'menu', workspace, barPath, menu: rendered, notice: null, isPreview: false, menuName: menu.name, isProtected };
  }

  const currentMenuPath = active && active.id !== menu.id ? menuPath(workspace, active.slug) : null;
  if (menu.inactiveBehavior === 'REDIRECT' && currentMenuPath) return { kind: 'redirect', location: currentMenuPath };

  const notice: PublicMenuNotice = {
    reason: validity.reason ?? 'disabled',
    validity: { startsAt: validity.startsAt, endedAt: validity.endedAt, weekdays: validity.weekdays, timeFrom: validity.timeFrom, timeTo: validity.timeTo },
    currentMenuPath,
  };
  const showContent = menu.inactiveBehavior === 'NOTICE_WITH_CONTENT' && validity.reason !== 'disabled';
  return {
    kind: 'menu',
    workspace,
    barPath,
    menu: showContent ? await render(menu, 'published') : null,
    notice,
    isPreview: false,
    menuName: menu.name,
    isProtected,
  };
}

// ---------------------------------------------------------------------------
// Image allowlist (public image endpoint)
// ---------------------------------------------------------------------------

export interface ImageAllowlist {
  cocktailImageIds: Set<string>;
  cocktailIds: Set<string>;
  /** `${menuId}~${assetKey}` → source (`draft` for previews). */
  menuAssets: Map<string, 'draft' | 'published'>;
  workspaceLogo: boolean;
}

const ALLOWLIST_TTL_MS = 60_000;
const allowlistCache = new Map<string, { expires: number; value: Promise<ImageAllowlist> }>();

function emptyAllowlist(): ImageAllowlist {
  return { cocktailImageIds: new Set(), cocktailIds: new Set(), menuAssets: new Map(), workspaceLogo: false };
}

async function addMenuToAllowlist(allowlist: ImageAllowlist, workspace: PublicWorkspace, menu: GuestMenu, source: 'draft' | 'published') {
  const document = parseStoredDocument(source === 'draft' ? menu.draft : menu.published);
  if (!document) return;
  for (const output of GUEST_MENU_OUTPUTS) {
    if (!document.outputs[output].enabled) continue;
    const { meta } = await renderGuestMenu({
      workspace,
      menu,
      document,
      output,
      isPreview: source === 'draft',
      previewToken: source === 'draft' ? menu.previewToken : null,
    });
    meta.cocktailImageIds.forEach((id) => allowlist.cocktailImageIds.add(id));
    meta.cocktailIds.forEach((id) => allowlist.cocktailIds.add(id));
    meta.menuAssets.forEach((key) => allowlist.menuAssets.set(`${menu.id}~${key}`, source));
    if (meta.workspaceLogo) allowlist.workspaceLogo = true;
  }
}

async function computeAllowlist(workspace: PublicWorkspace, previewToken: string | null): Promise<ImageAllowlist> {
  const allowlist = emptyAllowlist();
  if (previewToken) {
    const menus = await prisma.guestMenu.findMany({ where: { workspaceId: workspace.id, previewToken } });
    for (const menu of menus) await addMenuToAllowlist(allowlist, workspace, menu, 'draft');
    return allowlist;
  }
  const menus = await prisma.guestMenu.findMany({ where: { workspaceId: workspace.id, enabled: true } });
  for (const menu of menus) {
    if (!menu.accessCodeHash) {
      await addMenuToAllowlist(allowlist, workspace, menu, 'published');
      continue;
    }
    // Protected: only the logo shown on the PIN page is public.
    const document = parseStoredDocument(menu.published);
    if (!document) continue;
    if (document.theme.logo && /^data:image\//i.test(document.theme.logo)) allowlist.menuAssets.set(`${menu.id}~logo`, 'published');
    else if (!document.theme.logo && workspace.hasImage) allowlist.workspaceLogo = true;
  }
  return allowlist;
}

function cached(key: string, compute: () => Promise<ImageAllowlist>): Promise<ImageAllowlist> {
  const hit = allowlistCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = compute();
  allowlistCache.set(key, { expires: Date.now() + ALLOWLIST_TTL_MS, value });
  value.catch(() => allowlistCache.delete(key));
  if (allowlistCache.size > 500) {
    const oldest = allowlistCache.keys().next().value;
    if (oldest !== undefined) allowlistCache.delete(oldest);
  }
  return value;
}

/**
 * Images referenced by enabled + published unprotected menus (plus the PIN page
 * logo of protected ones), or by the draft of `previewToken`; cached for 60 s.
 */
export function getImageAllowlist(workspace: PublicWorkspace, previewToken: string | null): Promise<ImageAllowlist> {
  return cached(`${workspace.id}|${previewToken ?? ''}`, () => computeAllowlist(workspace, previewToken));
}

/** Images of one protected menu (only after the caller checked access); cached per menu + code version. */
export function getProtectedMenuImageAllowlist(workspace: PublicWorkspace, menu: GuestMenu): Promise<ImageAllowlist> {
  return cached(`${workspace.id}|menu:${menu.id}:${menu.accessCodeVersion}`, async () => {
    const allowlist = emptyAllowlist();
    if (menu.enabled) await addMenuToAllowlist(allowlist, workspace, menu, 'published');
    return allowlist;
  });
}

export function decodeImage(raw: string): { contentType: string; bytes: Buffer } | null {
  if (!raw) return null;
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(raw);
  if (match) {
    const contentType = match[1].toLowerCase();
    if (!/^image\/(png|jpe?g|gif|webp|avif|svg\+xml)$/.test(contentType)) return null;
    try {
      if (match[2] && !/^[A-Za-z0-9+/\s]+={0,2}$/.test(match[3])) return null;
      const bytes = match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]));
      return bytes.length ? { contentType, bytes } : null;
    } catch {
      return null;
    }
  }
  // Never interpret URLs (or other arbitrary strings) as legacy raw base64.
  if (!/^[A-Za-z0-9+/\s]+={0,2}$/.test(raw) || raw.replace(/\s/g, '').length % 4 !== 0) return null;
  const bytes = Buffer.from(raw, 'base64');
  // A relative path can contain only base64 characters. Require an image
  // signature for untyped legacy values instead of returning garbage PNG bytes.
  let contentType: string | null = null;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) contentType = 'image/png';
  else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) contentType = 'image/jpeg';
  else if (/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString('ascii'))) contentType = 'image/gif';
  else if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') contentType = 'image/webp';
  else if (bytes.subarray(4, 8).toString('ascii') === 'ftyp' && /avif|avis/.test(bytes.subarray(8, 64).toString('ascii'))) contentType = 'image/avif';
  else if (/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(bytes.subarray(0, 1024).toString('utf8'))) contentType = 'image/svg+xml';
  return contentType ? { contentType, bytes } : null;
}
