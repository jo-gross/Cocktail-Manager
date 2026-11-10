/**
 * Client for the guest menu v1 API (`/api/v1/workspaces/{ws}/guest-menus/**`)
 * and the public menu JSON API (`/api/public/menus/**`). All functions throw
 * `ApiV1RequestError` on failure; publish errors carry `issues: GuestMenuPublishIssue[]`.
 */
import { apiV1Fetch, apiV1Mutate, ApiV1RequestError, getApiV1ErrorMessage } from './apiV1';
import type { DeletionResult } from '@lib/schemas/common';
import type { GuestMenuDocument, GuestMenuOutput, PublicMenuDto } from '@lib/guest-menu/schema';
import type { RenderedMenu } from '@lib/guest-menu/render';
import type {
  GuestMenuCreateInput,
  GuestMenuDto,
  GuestMenuDuplicateInput,
  GuestMenuExtrasDto,
  GuestMenuSummaryDto,
  GuestMenuTemplateDto,
  GuestMenuTemplateInput,
  GuestMenuUpdateInput,
} from '@lib/schemas/guestMenus';
import type { BuiltInTemplate } from '@lib/guest-menu/templates';

export type { GuestMenuPublishIssue } from '@lib/schemas/guestMenus';

/** Resolved DTO + rendered slots (admin preview and public JSON API). */
export interface GuestMenuRenderResult {
  dto: PublicMenuDto;
  rendered: RenderedMenu;
}

export interface BuiltInGuestMenuTemplates {
  templates: BuiltInTemplate[];
  baseCss: string;
  partials: Record<string, string>;
}

const base = (workspaceId: string | string[]) => `/api/v1/workspaces/${workspaceId}/guest-menus`;

export function getGuestMenus(workspaceId: string | string[]): Promise<GuestMenuSummaryDto[]> {
  return apiV1Fetch<GuestMenuSummaryDto[]>(base(workspaceId));
}

export function createGuestMenu(workspaceId: string | string[], body: GuestMenuCreateInput): Promise<GuestMenuDto> {
  return apiV1Mutate<GuestMenuDto>(base(workspaceId), 'POST', body);
}

export function getGuestMenu(workspaceId: string | string[], menuId: string): Promise<GuestMenuDto> {
  return apiV1Fetch<GuestMenuDto>(`${base(workspaceId)}/${menuId}`);
}

export function updateGuestMenu(workspaceId: string | string[], menuId: string, body: GuestMenuUpdateInput): Promise<GuestMenuDto> {
  return apiV1Mutate<GuestMenuDto>(`${base(workspaceId)}/${menuId}`, 'PATCH', body);
}

export function deleteGuestMenu(workspaceId: string | string[], menuId: string): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`${base(workspaceId)}/${menuId}`, 'DELETE');
}

export function saveGuestMenuDraft(workspaceId: string | string[], menuId: string, document: GuestMenuDocument): Promise<GuestMenuDto> {
  return apiV1Mutate<GuestMenuDto>(`${base(workspaceId)}/${menuId}/draft`, 'PUT', document);
}

export function publishGuestMenu(workspaceId: string | string[], menuId: string): Promise<GuestMenuDto> {
  return apiV1Mutate<GuestMenuDto>(`${base(workspaceId)}/${menuId}/publish`, 'POST');
}

export function unpublishGuestMenu(workspaceId: string | string[], menuId: string): Promise<GuestMenuDto> {
  return apiV1Mutate<GuestMenuDto>(`${base(workspaceId)}/${menuId}/unpublish`, 'POST');
}

export function duplicateGuestMenu(workspaceId: string | string[], menuId: string, body: GuestMenuDuplicateInput = {}): Promise<GuestMenuDto> {
  return apiV1Mutate<GuestMenuDto>(`${base(workspaceId)}/${menuId}/duplicate`, 'POST', body);
}

/** New draft preview token – previously shared preview links stop working. */
export function regenerateGuestMenuPreviewToken(workspaceId: string | string[], menuId: string): Promise<GuestMenuDto> {
  return apiV1Mutate<GuestMenuDto>(`${base(workspaceId)}/${menuId}/preview-token/regenerate`, 'POST');
}

export function reorderGuestMenus(workspaceId: string | string[], menuIds: string[]): Promise<GuestMenuSummaryDto[]> {
  return apiV1Mutate<GuestMenuSummaryDto[]>(`${base(workspaceId)}/reorder`, 'PUT', { menuIds });
}

export interface GuestMenuPreviewParams {
  locale?: string;
  output?: GuestMenuOutput;
  source?: 'draft' | 'published';
}

export function previewGuestMenu(workspaceId: string | string[], menuId: string, params: GuestMenuPreviewParams = {}): Promise<GuestMenuRenderResult> {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value != null) as [string, string][]).toString();
  return apiV1Fetch<GuestMenuRenderResult>(`${base(workspaceId)}/${menuId}/preview${query ? `?${query}` : ''}`);
}

/** URL of the QR code SVG (use as `<img src>`; session cookie authenticates). */
export function getGuestMenuQrUrl(workspaceId: string | string[], menuId: string, target: 'bar' | 'menu' = 'menu'): string {
  return `${base(workspaceId)}/${menuId}/qr.svg?target=${target}`;
}

/** QR code SVG whose link carries `?code=` (verified server-side; 422 if it does not match the menu's code). */
export async function fetchGuestMenuQrWithCode(workspaceId: string | string[], menuId: string, code: string): Promise<string> {
  const response = await fetch(`${getGuestMenuQrUrl(workspaceId, menuId, 'menu')}&code=${encodeURIComponent(code.trim())}`, { cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiV1RequestError(response.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? response.statusText);
  }
  return response.text();
}

export function getBuiltInGuestMenuTemplates(workspaceId: string | string[]): Promise<BuiltInGuestMenuTemplates> {
  return apiV1Fetch<BuiltInGuestMenuTemplates>(`${base(workspaceId)}/templates/built-in`);
}

export function getGuestMenuTemplates(workspaceId: string | string[]): Promise<GuestMenuTemplateDto[]> {
  return apiV1Fetch<GuestMenuTemplateDto[]>(`${base(workspaceId)}/templates`);
}

export function getGuestMenuTemplate(workspaceId: string | string[], templateId: string): Promise<GuestMenuTemplateDto> {
  return apiV1Fetch<GuestMenuTemplateDto>(`${base(workspaceId)}/templates/${templateId}`);
}

export function createGuestMenuTemplate(workspaceId: string | string[], body: GuestMenuTemplateInput): Promise<GuestMenuTemplateDto> {
  return apiV1Mutate<GuestMenuTemplateDto>(`${base(workspaceId)}/templates`, 'POST', body);
}

export function updateGuestMenuTemplate(workspaceId: string | string[], templateId: string, body: GuestMenuTemplateInput): Promise<GuestMenuTemplateDto> {
  return apiV1Mutate<GuestMenuTemplateDto>(`${base(workspaceId)}/templates/${templateId}`, 'PUT', body);
}

export function deleteGuestMenuTemplate(workspaceId: string | string[], templateId: string): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`${base(workspaceId)}/templates/${templateId}`, 'DELETE');
}

// ---------------------------------------------------------------------------
// Public (unauthenticated)
// ---------------------------------------------------------------------------

export interface PublicMenuQuery {
  lang?: string;
  output?: GuestMenuOutput;
  preview?: string;
}

/** Public JSON: `/api/public/menus/{bar}` (active menu) or `/api/public/menus/{bar}/{menuSlug}`. */
export function getPublicMenuUrl(bar: string, menuSlug?: string | null, query: PublicMenuQuery = {}): string {
  const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value != null) as [string, string][]).toString();
  return `/api/public/menus/${encodeURIComponent(bar)}${menuSlug ? `/${encodeURIComponent(menuSlug)}` : ''}${params ? `?${params}` : ''}`;
}

// ---------------------------------------------------------------------------
// Print / PDF export, bartender extras
// ---------------------------------------------------------------------------

export type GuestMenuPrintPaper = 'A4' | 'A5' | 'DL';

export interface GuestMenuPdfExportParams {
  source: 'draft' | 'published';
  locale?: string;
  paper?: GuestMenuPrintPaper;
  showQrCode?: boolean;
}

async function readPdfResponse(response: Response): Promise<{ blob: Blob; fileName: string }> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiV1RequestError(response.status, error?.code ?? 'UNKNOWN', getApiV1ErrorMessage(body, response.statusText || 'PDF export failed'));
  }
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'guest-menu.pdf';
  return { blob: await response.blob(), fileName };
}

/** Renders the guest menu print output as PDF (throws ApiV1RequestError, 503 if the PDF service is unavailable). */
export async function exportGuestMenuPdf(
  workspaceId: string | string[],
  menuId: string,
  params: GuestMenuPdfExportParams,
): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch(`${base(workspaceId)}/${menuId}/export/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return readPdfResponse(response);
}

/** URL of the self-contained print HTML (open in a new tab / iframe for a print preview). */
export function getGuestMenuPrintHtmlUrl(workspaceId: string | string[], menuId: string, params: Partial<GuestMenuPdfExportParams> = {}): string {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value != null)
      .map(([key, value]) => [key, String(value)]),
  ).toString();
  return `${base(workspaceId)}/${menuId}/export/html${query ? `?${query}` : ''}`;
}

export interface GuestMenuTableTentParams {
  target?: 'bar' | 'menu';
  locale?: string;
  paper?: 'A6' | 'A5';
}

/** URL of the table tent PDF (session cookie authenticates; usable as download link). */
export function getGuestMenuTableTentUrl(workspaceId: string | string[], menuId: string, params: GuestMenuTableTentParams = {}): string {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value != null) as [string, string][]).toString();
  return `${base(workspaceId)}/${menuId}/export/table-tent.pdf${query ? `?${query}` : ''}`;
}

export async function exportGuestMenuTableTentPdf(
  workspaceId: string | string[],
  menuId: string,
  params: GuestMenuTableTentParams = {},
): Promise<{ blob: Blob; fileName: string }> {
  return readPdfResponse(await fetch(getGuestMenuTableTentUrl(workspaceId, menuId, params)));
}

/** Cocktails on the active guest menu that are not on the given bartender card. */
export function getActiveGuestMenuExtras(workspaceId: string | string[], cardId: string): Promise<GuestMenuExtrasDto> {
  return apiV1Fetch<GuestMenuExtrasDto>(`${base(workspaceId)}/active/extras?cardId=${encodeURIComponent(cardId)}`);
}

/** True if the server has a Chromium PDF service configured. */
export async function isPdfExportAvailable(): Promise<boolean> {
  try {
    const response = await fetch('/api/chromium-status');
    const body = (await response.json()) as { available?: boolean };
    return body.available === true;
  } catch {
    return false;
  }
}
