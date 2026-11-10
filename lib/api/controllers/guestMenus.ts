/**
 * Business logic for guest menus (v1). See docs/GUEST-MENU-CONCEPT.md and
 * lib/schemas/guestMenus.ts for the contract.
 */
import type { NextApiRequest } from 'next';
import QRCode from 'qrcode';
import prisma from '../../../prisma/prisma';
import { Permission, Prisma, Role, type GuestMenu, type User, type Workspace } from '@generated/prisma/client';
import { ApiError } from '@lib/http/ApiError';
import { createLog } from '@lib/auditLog';
import { toGuestMenuDto, toGuestMenuSummaryDto, toGuestMenuTemplateDto, type GuestMenuDtoContext } from '@lib/api/dto/guestMenus';
import { createDefaultGuestMenuDocument, CUSTOM_TEMPLATE_PREFIX, GUEST_MENU_OUTPUTS, type GuestMenuDocument } from '@lib/guest-menu/schema';
import { getScheduleNow, resolveActiveMenu } from '@lib/guest-menu/schedule';
import { getBarSlug, loadWorkspaceGuestSettings, resolvePublicMenu } from '@lib/guest-menu/resolve';
import { findActiveGuestMenu, getPublicOrigin, parseStoredDocument, renderGuestMenu, validateForPublish } from '@lib/guest-menu/server';
import { buildGuestMenuPrintHtml, buildTableTentHtml, type GuestMenuPrintHtml, type GuestMenuPrintOptions } from '@lib/guest-menu/print/print.server';
import { isPdfServiceConfigured, renderHtmlToPdf } from '@lib/pdf/browser';
import { generatePreviewToken, hashAccessCode, verifyAccessCode } from '@lib/guest-menu/access';
import type { RequestApiKeyPermissions } from '@lib/http/requestAuth';
import { BASE_CSS, BUILT_IN_TEMPLATES, getBuiltInTemplate, GUEST_MENU_PARTIALS, resolveTemplate } from '@lib/guest-menu/templates';
import { validateTemplateSyntax } from '@lib/guest-menu/render';
import type {
  GuestMenuCreateInput,
  GuestMenuDto,
  GuestMenuDuplicateInput,
  GuestMenuExtrasDto,
  GuestMenuPdfExportInput,
  GuestMenuPreviewQuery,
  GuestMenuReorderInput,
  GuestMenuSummaryDto,
  GuestMenuTemplateDto,
  GuestMenuTemplateInput,
  GuestMenuUpdateInput,
} from '@lib/schemas/guestMenus';

const json = (value: unknown) => value as Prisma.InputJsonValue;

async function dtoContext(workspace: Pick<Workspace, 'id' | 'publicSlug'>, menus?: GuestMenu[]): Promise<GuestMenuDtoContext> {
  const settings = await loadWorkspaceGuestSettings(workspace.id);
  const scheduleNow = getScheduleNow(new Date(), settings);
  const all = menus ?? (await prisma.guestMenu.findMany({ where: { workspaceId: workspace.id } }));
  const active = resolveActiveMenu(all, scheduleNow);
  return { barSlug: getBarSlug(workspace), scheduleNow, activeMenuId: active?.id ?? null };
}

async function findMenuOrThrow(workspace: Workspace, menuId: string): Promise<GuestMenu> {
  const menu = await prisma.guestMenu.findFirst({ where: { id: menuId, workspaceId: workspace.id } });
  if (!menu) throw new ApiError(404, 'NOT_FOUND', 'Guest menu not found');
  return menu;
}

async function toDto(workspace: Workspace, menu: GuestMenu): Promise<GuestMenuDto> {
  return toGuestMenuDto(menu, await dtoContext(workspace));
}

/** "Abend Karte!" → "abend-karte"; umlauts transliterated. */
export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || 'karte';
}

async function uniqueSlug(workspaceId: string, base: string, excludeId?: string): Promise<string> {
  const existing = new Set(
    (
      await prisma.guestMenu.findMany({
        where: { workspaceId, slug: { startsWith: base }, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { slug: true },
      })
    ).map((row) => row.slug),
  );
  if (!existing.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function assertSlugFree(workspaceId: string, slug: string, excludeId?: string) {
  const taken = await prisma.guestMenu.findFirst({ where: { workspaceId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
  if (taken) throw new ApiError(409, 'SLUG_TAKEN', 'A guest menu with this slug already exists');
}

async function assertCardInWorkspace(workspaceId: string, cardId: string | null | undefined) {
  if (!cardId) return;
  const card = await prisma.cocktailCard.findFirst({ where: { id: cardId, workspaceId }, select: { id: true } });
  if (!card) throw new ApiError(400, 'VALIDATION_ERROR', 'sourceCardId does not belong to this workspace');
}

function toDbDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(`${value}T00:00:00.000Z`);
}

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------

/**
 * The draft preview token is only for MANAGER+ (USER members may read menus but not share drafts).
 * API keys act as their creator – they need `GUEST_MENUS_UPDATE` instead of the creator's role.
 */
async function canSeePreviewToken(
  workspace: Pick<Workspace, 'id'>,
  user: Pick<User, 'id'> | undefined,
  apiKeyPermissions: RequestApiKeyPermissions | null = null,
): Promise<boolean> {
  if (apiKeyPermissions) return apiKeyPermissions === 'all' || apiKeyPermissions.includes(Permission.GUEST_MENUS_UPDATE);
  if (!user) return false;
  const member = await prisma.workspaceUser.findFirst({ where: { workspaceId: workspace.id, userId: user.id }, select: { role: true } });
  return member != null && member.role !== Role.USER;
}

function withoutPreviewToken<T extends { previewToken: string | null }>(dto: T, visible: boolean): T {
  return visible ? dto : { ...dto, previewToken: null };
}

/** Audit snapshot: meta data + publish state only (documents are large and autosaved – not logged). */
function guestMenuAuditSnapshot(menu: GuestMenu): Record<string, unknown> {
  return {
    name: menu.name,
    slug: menu.slug,
    enabled: menu.enabled,
    isDefault: menu.isDefault,
    priority: menu.priority,
    validFrom: menu.validFrom?.toISOString().slice(0, 10) ?? null,
    validTo: menu.validTo?.toISOString().slice(0, 10) ?? null,
    weekdays: menu.weekdays,
    timeFrom: menu.timeFrom,
    timeTo: menu.timeTo,
    inactiveBehavior: menu.inactiveBehavior,
    sourceMode: menu.sourceMode,
    sourceCardId: menu.sourceCardId,
    locales: menu.locales,
    isPublished: menu.published != null,
    publishedAt: menu.publishedAt?.toISOString() ?? null,
    // Never the code/hash – the version shows that it was changed.
    hasAccessCode: menu.accessCodeHash != null,
    accessCodeVersion: menu.accessCodeVersion,
  };
}

/** Logs create / meta update / publish / unpublish / delete (never draft autosaves). Failures don't fail the request. */
async function auditGuestMenu(
  workspace: Pick<Workspace, 'id'>,
  user: Pick<User, 'id'> | undefined,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  before: GuestMenu | null,
  after: GuestMenu | null,
) {
  const entityId = (after ?? before)?.id;
  if (!entityId) return;
  try {
    await createLog(
      prisma,
      workspace.id,
      user?.id,
      'GuestMenu',
      entityId,
      action,
      before ? guestMenuAuditSnapshot(before) : null,
      after ? guestMenuAuditSnapshot(after) : null,
    );
  } catch (error) {
    console.error('[guest menu audit]', error);
  }
}

export async function listGuestMenus(
  workspace: Workspace,
  user?: Pick<User, 'id'>,
  apiKeyPermissions: RequestApiKeyPermissions | null = null,
): Promise<GuestMenuSummaryDto[]> {
  const menus = await prisma.guestMenu.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }] });
  const context = await dtoContext(workspace, menus);
  const showToken = user === undefined ? true : await canSeePreviewToken(workspace, user, apiKeyPermissions);
  return menus.map((menu) => withoutPreviewToken(toGuestMenuSummaryDto(menu, context), showToken));
}

export async function getGuestMenu(
  workspace: Workspace,
  menuId: string,
  user?: Pick<User, 'id'>,
  apiKeyPermissions: RequestApiKeyPermissions | null = null,
): Promise<GuestMenuDto> {
  const dto = await toDto(workspace, await findMenuOrThrow(workspace, menuId));
  return withoutPreviewToken(dto, user === undefined ? true : await canSeePreviewToken(workspace, user, apiKeyPermissions));
}

export async function createGuestMenu(workspace: Workspace, input: GuestMenuCreateInput, user?: Pick<User, 'id'>): Promise<GuestMenuDto> {
  const slug = input.slug ?? (await uniqueSlug(workspace.id, slugify(input.name)));
  await assertSlugFree(workspace.id, slug);
  await assertCardInWorkspace(workspace.id, input.sourceCardId);

  const settings = await loadWorkspaceGuestSettings(workspace.id);
  const sourceMode = input.sourceMode ?? (input.sourceCardId ? 'FIXED_CARD' : 'ACTIVE_CARD');
  let document: GuestMenuDocument =
    input.document ?? createDefaultGuestMenuDocument({ locale: settings.contentLocales.primary, title: input.name, withCardSection: sourceMode !== 'NONE' });
  if (!input.document && input.templateId) {
    const template = getBuiltInTemplate(input.templateId);
    if (!template) throw new ApiError(400, 'VALIDATION_ERROR', `Unknown built-in template "${input.templateId}"`);
    document = {
      ...document,
      theme: { ...document.theme, preset: template.id, tokens: structuredClone(template.defaultTokens) },
      templates: { web: { templateId: template.id }, monitor: { templateId: template.id }, print: { templateId: template.id } },
    };
  }

  const maxPriority = await prisma.guestMenu.aggregate({ where: { workspaceId: workspace.id }, _max: { priority: true } });
  const menu = await prisma.guestMenu.create({
    data: {
      workspaceId: workspace.id,
      name: input.name,
      slug,
      sourceMode,
      sourceCardId: input.sourceCardId ?? null,
      locales: input.locales ?? [],
      priority: (maxPriority._max.priority ?? -1) + 1,
      draft: json(document),
      previewToken: generatePreviewToken(),
    },
  });
  await auditGuestMenu(workspace, user, 'CREATE', null, menu);
  return toDto(workspace, menu);
}

export async function updateGuestMenu(workspace: Workspace, menuId: string, input: GuestMenuUpdateInput, user?: Pick<User, 'id'>): Promise<GuestMenuDto> {
  const menu = await findMenuOrThrow(workspace, menuId);
  if (input.slug !== undefined && input.slug !== menu.slug) await assertSlugFree(workspace.id, input.slug, menu.id);
  if (input.sourceCardId !== undefined) await assertCardInWorkspace(workspace.id, input.sourceCardId);
  // Set/change → new hash; remove → null. Both bump the version (invalidates cookies + signage tokens).
  const accessCode =
    input.accessCode === undefined || (input.accessCode === null && menu.accessCodeHash == null)
      ? undefined
      : { accessCodeHash: input.accessCode === null ? null : await hashAccessCode(input.accessCode), accessCodeVersion: { increment: 1 } };

  const updated = await prisma.$transaction(async (tx) => {
    if (input.isDefault === true) {
      await tx.guestMenu.updateMany({ where: { workspaceId: workspace.id, id: { not: menu.id }, isDefault: true }, data: { isDefault: false } });
    }
    return tx.guestMenu.update({
      where: { id: menu.id },
      data: {
        name: input.name,
        slug: input.slug,
        enabled: input.enabled,
        isDefault: input.isDefault,
        priority: input.priority,
        validFrom: toDbDate(input.validFrom),
        validTo: toDbDate(input.validTo),
        weekdays: input.weekdays ? [...new Set(input.weekdays)].sort((a, b) => a - b) : undefined,
        timeFrom: input.timeFrom,
        timeTo: input.timeTo,
        inactiveBehavior: input.inactiveBehavior,
        sourceMode: input.sourceMode,
        sourceCardId: input.sourceCardId,
        locales: input.locales,
        ...accessCode,
      },
    });
  });
  await auditGuestMenu(workspace, user, 'UPDATE', menu, updated);
  return toDto(workspace, updated);
}

export async function deleteGuestMenu(workspace: Workspace, menuId: string, user?: Pick<User, 'id'>): Promise<{ count: number }> {
  const menu = await prisma.guestMenu.findFirst({ where: { id: menuId, workspaceId: workspace.id } });
  const result = await prisma.guestMenu.deleteMany({ where: { id: menuId, workspaceId: workspace.id } });
  if (menu && result.count > 0) await auditGuestMenu(workspace, user, 'DELETE', menu, null);
  return result;
}

export async function saveGuestMenuDraft(workspace: Workspace, menuId: string, document: GuestMenuDocument): Promise<GuestMenuDto> {
  await findMenuOrThrow(workspace, menuId);
  const updated = await prisma.guestMenu.update({ where: { id: menuId }, data: { draft: json(document) } });
  return toDto(workspace, updated);
}

export async function publishGuestMenu(workspace: Workspace, menuId: string, user?: Pick<User, 'id'>): Promise<GuestMenuDto> {
  const menu = await findMenuOrThrow(workspace, menuId);
  const document = parseStoredDocument(menu.draft);
  if (!document) throw new ApiError(422, 'INVALID_DOCUMENT', 'The draft document is invalid; save it again to see the errors');
  const issues = await validateForPublish(
    { id: workspace.id, name: workspace.name, publicSlug: workspace.publicSlug, hasImage: !!workspace.image },
    menu,
    document,
  );
  if (issues.length > 0) throw new ApiError(422, 'TEMPLATE_ERROR', 'Template validation failed', issues);
  const updated = await prisma.guestMenu.update({ where: { id: menuId }, data: { published: json(document), publishedAt: new Date() } });
  await auditGuestMenu(workspace, user, 'UPDATE', menu, updated);
  return toDto(workspace, updated);
}

export async function unpublishGuestMenu(workspace: Workspace, menuId: string, user?: Pick<User, 'id'>): Promise<GuestMenuDto> {
  const menu = await findMenuOrThrow(workspace, menuId);
  const updated = await prisma.guestMenu.update({ where: { id: menuId }, data: { published: Prisma.DbNull, publishedAt: null } });
  await auditGuestMenu(workspace, user, 'UPDATE', menu, updated);
  return toDto(workspace, updated);
}

export async function duplicateGuestMenu(workspace: Workspace, menuId: string, input: GuestMenuDuplicateInput, user?: Pick<User, 'id'>): Promise<GuestMenuDto> {
  const menu = await findMenuOrThrow(workspace, menuId);
  const name = input.name ?? `${menu.name} (2)`;
  const slug = input.slug ?? (await uniqueSlug(workspace.id, slugify(name)));
  await assertSlugFree(workspace.id, slug);
  const maxPriority = await prisma.guestMenu.aggregate({ where: { workspaceId: workspace.id }, _max: { priority: true } });
  const created = await prisma.guestMenu.create({
    data: {
      workspaceId: workspace.id,
      name,
      slug,
      enabled: false,
      isDefault: false,
      priority: (maxPriority._max.priority ?? -1) + 1,
      validFrom: menu.validFrom,
      validTo: menu.validTo,
      weekdays: menu.weekdays,
      timeFrom: menu.timeFrom,
      timeTo: menu.timeTo,
      inactiveBehavior: menu.inactiveBehavior,
      sourceMode: menu.sourceMode,
      sourceCardId: menu.sourceCardId,
      locales: menu.locales,
      draft: json(menu.draft),
      previewToken: generatePreviewToken(),
    },
  });
  await auditGuestMenu(workspace, user, 'CREATE', null, created);
  return toDto(workspace, created);
}

/** New draft preview token: invalidates all shared `?preview=` links of the menu. */
export async function regenerateGuestMenuPreviewToken(workspace: Workspace, menuId: string, user?: Pick<User, 'id'>): Promise<GuestMenuDto> {
  const menu = await findMenuOrThrow(workspace, menuId);
  const updated = await prisma.guestMenu.update({ where: { id: menu.id }, data: { previewToken: generatePreviewToken() } });
  try {
    // Never the token itself – only that (and when) it was replaced.
    await createLog(prisma, workspace.id, user?.id, 'GuestMenu', menu.id, 'UPDATE', guestMenuAuditSnapshot(menu), {
      ...guestMenuAuditSnapshot(updated),
      previewTokenRegeneratedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('[guest menu audit]', error);
  }
  return toDto(workspace, updated);
}

export async function reorderGuestMenus(workspace: Workspace, input: GuestMenuReorderInput): Promise<GuestMenuSummaryDto[]> {
  const menus = await prisma.guestMenu.findMany({ where: { workspaceId: workspace.id }, select: { id: true } });
  const known = new Set(menus.map((menu) => menu.id));
  const unknown = input.menuIds.filter((id) => !known.has(id));
  if (unknown.length > 0) throw new ApiError(404, 'NOT_FOUND', `Guest menus not found: ${unknown.join(', ')}`);
  await prisma.$transaction(input.menuIds.map((id, index) => prisma.guestMenu.update({ where: { id }, data: { priority: index } })));
  return listGuestMenus(workspace);
}

export async function previewGuestMenu(workspace: Workspace, menuId: string, query: GuestMenuPreviewQuery) {
  const menu = await findMenuOrThrow(workspace, menuId);
  const source = query.source ?? 'draft';
  const document = parseStoredDocument(source === 'draft' ? menu.draft : menu.published);
  if (!document) throw new ApiError(404, 'NOT_FOUND', source === 'draft' ? 'Draft document is invalid' : 'Guest menu is not published');
  const { dto, rendered } = await renderGuestMenu({
    workspace: { id: workspace.id, name: workspace.name, publicSlug: workspace.publicSlug, hasImage: !!workspace.image },
    menu,
    document,
    output: query.output ?? 'web',
    locale: query.locale,
    isPreview: source === 'draft',
    previewToken: menu.previewToken,
  });
  return { dto, rendered } as unknown as { dto: Record<string, unknown>; rendered: Record<string, unknown> };
}

/** QR code (SVG) for the public URL of the bar (`/m/{bar}`) or this menu, optionally with `?code=` (protected menus). */
export async function getGuestMenuQrSvg(
  workspace: Workspace,
  menuId: string,
  target: 'bar' | 'menu' = 'menu',
  margin = 1,
  req?: NextApiRequest,
  code?: string,
): Promise<string> {
  const menu = await findMenuOrThrow(workspace, menuId);
  const bar = encodeURIComponent(getBarSlug(workspace));
  let url = `${getPublicOrigin(req)}/m/${bar}${target === 'menu' ? `/${encodeURIComponent(menu.slug)}` : ''}`;
  if (code) {
    // Only the current code (a wrong code on printed table QR codes would lock guests out).
    if (!menu.accessCodeHash || !(await verifyAccessCode(code, menu.accessCodeHash))) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'The access code does not match this menu');
    }
    url += `?code=${encodeURIComponent(code.trim())}`;
  }
  return QRCode.toString(url, { type: 'svg', margin, errorCorrectionLevel: 'M' });
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function listBuiltInGuestMenuTemplates() {
  return {
    templates: BUILT_IN_TEMPLATES.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      outputs: template.outputs,
      layout: template.layout,
      defaultTokens: template.defaultTokens as unknown as Record<string, unknown>,
      slots: template.slots,
      css: template.css,
    })),
    baseCss: BASE_CSS,
    partials: GUEST_MENU_PARTIALS,
  };
}

function assertTemplateValid(input: GuestMenuTemplateInput) {
  if (!getBuiltInTemplate(input.definition.baseTemplateId)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Unknown base template "${input.definition.baseTemplateId}"`);
  }
  const resolved = resolveTemplate({ templateId: input.definition.baseTemplateId, slots: input.definition.slots });
  const errors = validateTemplateSyntax(resolved);
  if (errors.length > 0) {
    const issues = errors.map((error) => ({ ...error, output: 'web', source: error.slot === 'css' ? 'css' : 'syntax' }));
    throw new ApiError(422, 'TEMPLATE_ERROR', 'Template validation failed', issues);
  }
}

export async function listGuestMenuTemplates(workspace: Workspace): Promise<GuestMenuTemplateDto[]> {
  const templates = await prisma.guestMenuTemplate.findMany({ where: { workspaceId: workspace.id }, orderBy: { name: 'asc' } });
  return templates.map(toGuestMenuTemplateDto);
}

export async function getGuestMenuTemplate(workspace: Workspace, templateId: string): Promise<GuestMenuTemplateDto> {
  const template = await prisma.guestMenuTemplate.findFirst({ where: { id: templateId, workspaceId: workspace.id } });
  if (!template) throw new ApiError(404, 'NOT_FOUND', 'Template not found');
  return toGuestMenuTemplateDto(template);
}

export async function createGuestMenuTemplate(workspace: Workspace, input: GuestMenuTemplateInput): Promise<GuestMenuTemplateDto> {
  assertTemplateValid(input);
  const template = await prisma.guestMenuTemplate.create({ data: { workspaceId: workspace.id, name: input.name, definition: json(input.definition) } });
  return toGuestMenuTemplateDto(template);
}

export async function updateGuestMenuTemplate(workspace: Workspace, templateId: string, input: GuestMenuTemplateInput): Promise<GuestMenuTemplateDto> {
  await getGuestMenuTemplate(workspace, templateId);
  assertTemplateValid(input);
  const template = await prisma.guestMenuTemplate.update({ where: { id: templateId }, data: { name: input.name, definition: json(input.definition) } });
  return toGuestMenuTemplateDto(template);
}

export async function deleteGuestMenuTemplate(workspace: Workspace, templateId: string): Promise<{ count: number }> {
  const ref = `${CUSTOM_TEMPLATE_PREFIX}${templateId}`;
  const menus = await prisma.guestMenu.findMany({ where: { workspaceId: workspace.id }, select: { name: true, draft: true, published: true } });
  const users = menus.filter((menu) =>
    [menu.draft, menu.published].some((doc) => {
      const parsed = parseStoredDocument(doc);
      return parsed ? GUEST_MENU_OUTPUTS.some((output) => parsed.templates[output].templateId === ref) : false;
    }),
  );
  if (users.length > 0) throw new ApiError(409, 'TEMPLATE_IN_USE', `Template is used by: ${users.map((menu) => menu.name).join(', ')}`);
  return prisma.guestMenuTemplate.deleteMany({ where: { id: templateId, workspaceId: workspace.id } });
}

// ---------------------------------------------------------------------------
// Print / PDF export
// ---------------------------------------------------------------------------

async function renderPdfOrThrow(html: string, format: 'A4' | 'A5' | 'A6'): Promise<Buffer> {
  if (!isPdfServiceConfigured()) throw new ApiError(503, 'PDF_SERVICE_UNAVAILABLE', 'PDF export service is not configured');
  try {
    return await renderHtmlToPdf(html, { format, allowNetwork: false });
  } catch (error) {
    console.error('[guest menu pdf]', error);
    throw new ApiError(503, 'PDF_SERVICE_UNAVAILABLE', 'PDF export service is not available');
  }
}

/** Self-contained print HTML (also the input of the PDF export). */
export async function getGuestMenuPrintHtml(workspace: Workspace, menuId: string, options: GuestMenuPrintOptions): Promise<GuestMenuPrintHtml> {
  const menu = await findMenuOrThrow(workspace, menuId);
  return buildGuestMenuPrintHtml(workspace, menu, options);
}

export async function exportGuestMenuPdf(
  workspace: Workspace,
  menuId: string,
  input: GuestMenuPdfExportInput,
  req?: NextApiRequest,
): Promise<{ buffer: Buffer; fileName: string }> {
  const print = await getGuestMenuPrintHtml(workspace, menuId, { ...input, req });
  const buffer = await renderPdfOrThrow(print.html, print.paper === 'A5' ? 'A5' : 'A4');
  return { buffer, fileName: print.fileName };
}

export async function exportGuestMenuTableTentPdf(
  workspace: Workspace,
  menuId: string,
  options: { target?: 'bar' | 'menu'; locale?: string; paper?: 'A6' | 'A5' },
  req?: NextApiRequest,
): Promise<{ buffer: Buffer; fileName: string }> {
  const menu = await findMenuOrThrow(workspace, menuId);
  const tent = await buildTableTentHtml(workspace, menu, { target: options.target ?? 'bar', locale: options.locale, paper: options.paper, req });
  const buffer = await renderPdfOrThrow(tent.html, tent.paper);
  return { buffer, fileName: tent.fileName };
}

// ---------------------------------------------------------------------------
// Bartender view: cocktails only on the active guest menu
// ---------------------------------------------------------------------------

export async function getActiveGuestMenuExtras(workspace: Workspace, cardId: string): Promise<GuestMenuExtrasDto> {
  const card = await prisma.cocktailCard.findFirst({
    where: { id: cardId, workspaceId: workspace.id },
    select: { groups: { select: { items: { select: { cocktailId: true } } } } },
  });
  if (!card) throw new ApiError(404, 'NOT_FOUND', 'Card not found');
  const { active } = await findActiveGuestMenu(workspace.id);
  const document = active ? parseStoredDocument(active.published) : null;
  if (!active || !document) return { menus: [], cocktailIds: [] };

  const onCard = new Set(card.groups.flatMap((group) => group.items.map((item) => item.cocktailId)));
  const dto = await resolvePublicMenu({
    workspace: { id: workspace.id, name: workspace.name, publicSlug: workspace.publicSlug, hasImage: !!workspace.image },
    menu: active,
    document,
    output: 'web',
  });
  const cocktailIds: string[] = [];
  for (const block of dto.blocks) {
    if (block.type !== 'section') continue;
    for (const item of block.items) {
      if (!item.onRequest && !onCard.has(item.id) && !cocktailIds.includes(item.id)) cocktailIds.push(item.id);
    }
  }
  return { menus: [{ id: active.id, name: active.name }], cocktailIds };
}
