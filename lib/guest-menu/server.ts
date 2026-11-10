/**
 * Server helpers shared by the admin API (preview/publish), the public JSON API,
 * the public page (/m/…) and the public image endpoint.
 */
import type { IncomingMessage } from 'http';
import prisma from '../../prisma/prisma';
import type { GuestMenu, Workspace } from '@generated/prisma/client';
import {
  GUEST_MENU_OUTPUTS,
  GuestMenuDocumentSchema,
  GuestMenuTemplateDefinitionSchema,
  type GuestMenuDocument,
  type GuestMenuOutput,
  type GuestMenuTemplateDefinition,
  type PublicMenuDto,
} from './schema';
import { getCustomTemplateDbId, resolveTemplate } from './templates';
import { renderMenuSlots, validateTemplateSyntax, type RenderedMenu, type TemplateError } from './render';
import { loadWorkspaceGuestSettings, resolvePublicMenuWithMeta, type ResolvedMenuMeta } from './resolve';
import { getScheduleNow, resolveActiveMenu, type ScheduleNow } from './schedule';

export type PublicWorkspace = Pick<Workspace, 'id' | 'name' | 'publicSlug'> & { hasImage: boolean };

export const publicWorkspaceSelect = { id: true, name: true, publicSlug: true, image: true } as const;

/** `/m/{bar}`: public slug, or the workspace id (works before a slug is set and keeps old QR codes valid). */
export async function findPublicWorkspace(bar: string): Promise<PublicWorkspace | null> {
  if (!bar || bar.length > 128) return null;
  // Id first: a public slug can never take over the (always valid) `/m/{workspaceId}` URLs.
  const workspace =
    (await prisma.workspace.findUnique({ where: { id: bar }, select: publicWorkspaceSelect })) ??
    (await prisma.workspace.findUnique({ where: { publicSlug: bar }, select: publicWorkspaceSelect }));
  if (!workspace) return null;
  return { id: workspace.id, name: workspace.name, publicSlug: workspace.publicSlug, hasImage: !!workspace.image };
}

/** Parses a stored document; `null` if it does not match the schema. */
export function parseStoredDocument(value: unknown): GuestMenuDocument | null {
  if (value == null) return null;
  const parsed = GuestMenuDocumentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Loads the `custom:` templates referenced by a document (all outputs). */
export async function loadCustomTemplates(workspaceId: string, document: GuestMenuDocument): Promise<Map<string, GuestMenuTemplateDefinition>> {
  const ids = GUEST_MENU_OUTPUTS.map((output) => getCustomTemplateDbId(document.templates[output].templateId)).filter((id): id is string => !!id);
  const result = new Map<string, GuestMenuTemplateDefinition>();
  if (ids.length === 0) return result;
  const rows = await prisma.guestMenuTemplate.findMany({ where: { workspaceId, id: { in: ids } }, select: { id: true, definition: true } });
  for (const row of rows) {
    const parsed = GuestMenuTemplateDefinitionSchema.safeParse(row.definition);
    if (parsed.success) result.set(row.id, parsed.data);
  }
  return result;
}

export interface RenderedGuestMenu {
  dto: PublicMenuDto;
  rendered: RenderedMenu;
  meta: ResolvedMenuMeta;
}

export interface RenderGuestMenuInput {
  workspace: PublicWorkspace;
  menu: GuestMenu;
  document: GuestMenuDocument;
  output: GuestMenuOutput;
  locale?: string | null;
  /** Accept-Language preferences when `locale` is not set. */
  preferredLocales?: string[];
  now?: Date;
  isPreview?: boolean;
  /** For draft previews: appended to image URLs. */
  previewToken?: string | null;
  /** Signage access token of a protected menu: appended to image URLs (`?access=`). */
  accessToken?: string | null;
  customTemplates?: Map<string, GuestMenuTemplateDefinition>;
}

/** Resolve + render in one step (the public JSON API payload is `{ dto, rendered }`). */
export async function renderGuestMenu(input: RenderGuestMenuInput): Promise<RenderedGuestMenu> {
  const { dto, meta } = await resolvePublicMenuWithMeta({
    workspace: input.workspace,
    menu: input.menu,
    document: input.document,
    output: input.output,
    locale: input.locale,
    preferredLocales: input.preferredLocales,
    now: input.now,
    isPreview: input.isPreview,
    previewToken: input.previewToken,
    accessToken: input.accessToken,
  });
  const customTemplates = input.customTemplates ?? (await loadCustomTemplates(input.workspace.id, input.document));
  const template = resolveTemplate(input.document.templates[input.output], customTemplates);
  const rendered = renderMenuSlots(dto, template, input.output, { customCss: input.document.theme.customCss });
  return { dto, rendered, meta };
}

export interface PublishIssue extends TemplateError {
  output: GuestMenuOutput;
  source: 'syntax' | 'render' | 'css' | 'customCss';
}

/**
 * Validates a document for publishing: template syntax of every enabled output,
 * plus a full test render with the real data (runtime errors, CSS errors).
 */
export async function validateForPublish(workspace: PublicWorkspace, menu: GuestMenu, document: GuestMenuDocument): Promise<PublishIssue[]> {
  const issues: PublishIssue[] = [];
  const customTemplates = await loadCustomTemplates(workspace.id, document);
  for (const output of GUEST_MENU_OUTPUTS) {
    if (!document.outputs[output].enabled) continue;
    const ref = document.templates[output];
    const customId = getCustomTemplateDbId(ref.templateId);
    if (customId && !customTemplates.has(customId)) {
      issues.push({ output, source: 'syntax', slot: 'template', message: `Template "${ref.templateId}" not found`, line: null, column: null });
      continue;
    }
    const template = resolveTemplate(ref, customTemplates);
    const syntax = validateTemplateSyntax(template);
    syntax.forEach((error) => issues.push({ ...error, output, source: error.slot === 'css' ? 'css' : 'syntax' }));
    if (syntax.length > 0) continue;
    const { rendered } = await renderGuestMenu({ workspace, menu, document, output, customTemplates, isPreview: true });
    rendered.errors.forEach((error) => issues.push({ ...error, output, source: 'render' }));
    rendered.cssErrors.forEach((error) =>
      issues.push({
        slot: 'css',
        message: error.message,
        line: error.line,
        column: error.column,
        output,
        source: error.source === 'custom' ? 'customCss' : 'css',
      }),
    );
  }
  return issues;
}

/** Enabled + published menus of a workspace and the currently active one. */
export async function findActiveGuestMenu(
  workspaceId: string,
  now = new Date(),
): Promise<{ active: GuestMenu | null; scheduleNow: ScheduleNow; timezone: string }> {
  const [menus, settings] = await Promise.all([prisma.guestMenu.findMany({ where: { workspaceId, enabled: true } }), loadWorkspaceGuestSettings(workspaceId)]);
  const scheduleNow = getScheduleNow(now, settings);
  const active = resolveActiveMenu(
    menus.filter((menu) => menu.published != null),
    scheduleNow,
  );
  return { active, scheduleNow, timezone: settings.timezone };
}

let warnedOriginFromHeaders = false;

/** Absolute origin for QR codes / OG tags: env (`NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`) or request headers. */
export function getPublicOrigin(req?: IncomingMessage): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || process.env.BETTER_AUTH_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (!warnedOriginFromHeaders) {
    warnedOriginFromHeaders = true;
    console.warn(
      '[guest menu] None of NEXT_PUBLIC_APP_URL, NEXTAUTH_URL or BETTER_AUTH_URL is set – the public origin for canonical/og:url links and QR codes is taken from the request Host/X-Forwarded-Host headers. A spoofed Host header can then end up in cached guest menu pages. Set BETTER_AUTH_URL to the public URL, see docs/ENV.md.',
    );
  }
  const header = (name: string) => {
    const value = req?.headers[name];
    return (Array.isArray(value) ? value[0] : value)?.split(',')[0].trim();
  };
  const host = header('x-forwarded-host') ?? header('host') ?? 'localhost:3000';
  const proto = header('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
