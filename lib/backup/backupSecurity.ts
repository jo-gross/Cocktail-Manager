/**
 * Security rules for workspace backups (export/import routes under
 * `pages/api/workspaces/[workspaceId]/admin/backups`).
 *
 * Export: secrets never leave the server – guest menu access code hash/version
 * and preview tokens are stripped; the workspace row (signage key) as well as
 * API keys and join codes are not part of the backup at all.
 *
 * Import: a backup is untrusted input. Settings, custom templates and guest
 * menu documents are validated with the same rules as the regular endpoints
 * (invalid items are skipped and reported). Imported guest menus never go live
 * on their own: disabled, unpublished, not default, no access code and a fresh
 * preview token.
 */
import { Prisma, type GuestMenu, type WorkspaceSettingKey } from '@generated/prisma/client';
import { generatePreviewToken } from '@lib/guest-menu/access';
import { remapGuestMenuDocumentIds, type GuestMenuIdMaps } from '@lib/guest-menu/backup';
import { safeParseGuestMenuDocument, type GuestMenuDocument } from '@lib/guest-menu/schema';
import { getBuiltInTemplate, resolveTemplate } from '@lib/guest-menu/templates';
import { validateTemplateSyntax } from '@lib/guest-menu/render';
import { GuestMenuSlugSchema, GuestMenuTemplateInputSchema, type GuestMenuTemplateInput } from '@lib/schemas/guestMenus';
import { WorkspaceSettingUpdateSchema } from '@lib/schemas/workspace';

export const GUEST_MENU_BACKUP_SECRET_FIELDS = ['accessCodeHash', 'accessCodeVersion', 'previewToken'] as const;
type GuestMenuSecretField = (typeof GUEST_MENU_BACKUP_SECRET_FIELDS)[number];

/** Guest menu as stored in a backup (older exports may still contain the secret fields – they are ignored). */
export type GuestMenuBackupRecord = Omit<GuestMenu, GuestMenuSecretField>;

export function stripGuestMenuSecrets<T extends object>(menu: T): Omit<T, GuestMenuSecretField> {
  const copy = { ...menu } as Record<string, unknown>;
  for (const field of GUEST_MENU_BACKUP_SECRET_FIELDS) delete copy[field];
  return copy as Omit<T, GuestMenuSecretField>;
}

export interface BackupImportSkippedItem {
  type: 'workspaceSetting' | 'guestMenuTemplate' | 'guestMenu';
  /** Setting key / template or menu name from the backup. */
  name: string;
  reason: string;
}

export interface BackupImportReport {
  skipped: BackupImportSkippedItem[];
}

type ValidationResult<T> = { ok: true; value: T } | { ok: false; reason: string };

const zodReason = (issues: { path: PropertyKey[]; message: string }[]) =>
  issues
    .slice(0, 5)
    .map((issue) => (issue.path.length > 0 ? `${issue.path.map(String).join('.')}: ${issue.message}` : issue.message))
    .join('; ');

/** Same rules as `PUT /settings` (known key + value validator). */
export function validateBackupWorkspaceSetting(setting: { setting: unknown; value: unknown }): ValidationResult<{
  setting: WorkspaceSettingKey;
  value: string | null;
}> {
  const parsed = WorkspaceSettingUpdateSchema.safeParse({ setting: setting.setting, value: setting.value });
  if (!parsed.success) return { ok: false, reason: zodReason(parsed.error.issues) };
  return { ok: true, value: { setting: parsed.data.setting, value: parsed.data.value ?? null } };
}

/** Same rules as creating a custom template (schema, known base template, Liquid/CSS syntax). */
export function validateBackupGuestMenuTemplate(template: { name: unknown; definition: unknown }): ValidationResult<GuestMenuTemplateInput> {
  const parsed = GuestMenuTemplateInputSchema.safeParse({ name: template.name, definition: template.definition });
  if (!parsed.success) return { ok: false, reason: zodReason(parsed.error.issues) };
  const { definition } = parsed.data;
  if (!getBuiltInTemplate(definition.baseTemplateId)) return { ok: false, reason: `Unknown base template "${definition.baseTemplateId}"` };
  const errors = validateTemplateSyntax(resolveTemplate({ templateId: definition.baseTemplateId, slots: definition.slots }));
  if (errors.length > 0) return { ok: false, reason: `Template validation failed: ${errors.map((error) => `${error.slot}: ${error.message}`).join('; ')}` };
  return { ok: true, value: parsed.data };
}

/** Validates a guest menu document from the backup, then rewrites its ids to the imported entities. */
export function prepareBackupGuestMenuDocument(document: unknown, idMaps: GuestMenuIdMaps): ValidationResult<GuestMenuDocument> {
  const parsed = safeParseGuestMenuDocument(document);
  if (!parsed.success) return { ok: false, reason: zodReason(parsed.error.issues) };
  return { ok: true, value: remapGuestMenuDocumentIds(parsed.data, idMaps) };
}

/** Backup slug if valid, otherwise a normalized one (uniqueness is handled by the caller). */
export function normalizeBackupGuestMenuSlug(slug: unknown): string {
  if (GuestMenuSlugSchema.safeParse(slug).success) return slug as string;
  const normalized = (typeof slug === 'string' ? slug : '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56)
    .replace(/-+$/g, '');
  return normalized || 'menu';
}

/** Publication/access state of every imported guest menu – an import never publishes anything. */
export function importedGuestMenuSafeState() {
  return {
    enabled: false,
    isDefault: false,
    published: Prisma.DbNull,
    publishedAt: null,
    accessCodeHash: null,
    accessCodeVersion: 0,
    previewToken: generatePreviewToken(),
  };
}
