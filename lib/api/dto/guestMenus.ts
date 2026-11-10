/**
 * Prisma → v1 DTO mapping for guest menus. Dates as ISO strings / `YYYY-MM-DD`,
 * no `workspaceId`, documents parsed (invalid stored documents fall back to a
 * default document so the builder can still open the menu).
 */
import type { GuestMenu, GuestMenuTemplate } from '@generated/prisma/client';
import { createDefaultGuestMenuDocument, GuestMenuTemplateDefinitionSchema, CUSTOM_TEMPLATE_PREFIX } from '@lib/guest-menu/schema';
import { describeMenuValidity, toDateKey, type ScheduleNow } from '@lib/guest-menu/schedule';
import { parseStoredDocument } from '@lib/guest-menu/server';
import type { GuestMenuDto, GuestMenuSummaryDto, GuestMenuTemplateDto } from '@lib/schemas/guestMenus';

export interface GuestMenuDtoContext {
  barSlug: string;
  scheduleNow: ScheduleNow;
  activeMenuId: string | null;
}

export function toGuestMenuSummaryDto(menu: GuestMenu, context: GuestMenuDtoContext): GuestMenuSummaryDto {
  const validity = describeMenuValidity(menu, context.scheduleNow, { requirePublished: true });
  return {
    id: menu.id,
    name: menu.name,
    slug: menu.slug,
    enabled: menu.enabled,
    isDefault: menu.isDefault,
    priority: menu.priority,
    validFrom: toDateKey(menu.validFrom),
    validTo: toDateKey(menu.validTo),
    weekdays: menu.weekdays,
    timeFrom: menu.timeFrom,
    timeTo: menu.timeTo,
    inactiveBehavior: menu.inactiveBehavior,
    sourceMode: menu.sourceMode,
    sourceCardId: menu.sourceCardId,
    locales: menu.locales,
    isPublished: menu.published != null,
    publishedAt: menu.publishedAt ? menu.publishedAt.toISOString() : null,
    hasUnpublishedChanges: menu.published == null || JSON.stringify(menu.published) !== JSON.stringify(menu.draft),
    previewToken: menu.previewToken,
    publicPath: `/m/${encodeURIComponent(context.barSlug)}/${encodeURIComponent(menu.slug)}`,
    hasAccessCode: menu.accessCodeHash != null,
    validity: { valid: validity.valid, reason: validity.reason },
    isActive: context.activeMenuId === menu.id,
    createdAt: menu.createdAt.toISOString(),
    updatedAt: menu.updatedAt.toISOString(),
  };
}

export function toGuestMenuDto(menu: GuestMenu, context: GuestMenuDtoContext): GuestMenuDto {
  return {
    ...toGuestMenuSummaryDto(menu, context),
    draft: parseStoredDocument(menu.draft) ?? createDefaultGuestMenuDocument({ title: menu.name }),
    published: parseStoredDocument(menu.published),
  };
}

export function toGuestMenuTemplateDto(template: GuestMenuTemplate): GuestMenuTemplateDto {
  const parsed = GuestMenuTemplateDefinitionSchema.safeParse(template.definition);
  return {
    id: template.id,
    name: template.name,
    templateId: `${CUSTOM_TEMPLATE_PREFIX}${template.id}`,
    definition: parsed.success ? parsed.data : { schemaVersion: 1, baseTemplateId: 'classic', slots: {} },
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}
