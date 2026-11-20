/**
 * Portal handoff (docs/ENTITLEMENTS.md "Portal handoff"): signs a fresh token for the customer portal and answers its
 * URL. The route is `sessionOnly` with role OWNER, so `user` is the real signed-in user row. The token and the URL are
 * never logged or stored.
 */
import type { NextApiResponse } from 'next';
import { Setting } from '@generated/prisma/client';
import type { User, Workspace } from '@generated/prisma/client';
import prisma from '../../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { DEFAULT_LOCALE, isAppLocale } from '@lib/i18n/locales';
import { portalHandoffConfig } from '@lib/portal/handoffConfig';
import { buildHandoffClaims, handoffUrl, signHandoffToken } from '@lib/portal/handoffToken';
import type { HandoffLocale } from '@lib/portal/constants';
import type { PortalHandoffInput, PortalHandoffResult } from '@lib/schemas/portalHandoff';

async function storedLocale(userId: string): Promise<HandoffLocale> {
  const setting = await prisma.userSetting.findUnique({ where: { userId_setting: { userId, setting: Setting.language } }, select: { value: true } });
  return isAppLocale(setting?.value) ? setting.value : DEFAULT_LOCALE;
}

export async function createPortalHandoff(res: NextApiResponse, workspace: Workspace, user: User, input: PortalHandoffInput): Promise<PortalHandoffResult> {
  const config = portalHandoffConfig();
  if (!config) throw new ApiError(404, 'PORTAL_HANDOFF_UNAVAILABLE', 'This instance offers no customer portal');
  // The portal lets only verified addresses in; refuse here so the UI can explain it.
  if (!user.email || user.emailVerified !== true) throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'The email address of your account is not verified');

  const membership = await prisma.workspaceUser.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    select: { role: true },
  });
  if (!membership) throw new ApiError(403, 'FORBIDDEN', 'User is not permitted');

  const locale = input.locale ?? (await storedLocale(user.id));
  const claims = buildHandoffClaims({
    issuer: config.issuer,
    user: { id: user.id, email: user.email, emailVerified: user.emailVerified, name: user.name },
    workspace: { id: workspace.id, name: workspace.name },
    role: membership.role,
    locale,
    intent: input.intent,
  });
  const token = signHandoffToken(claims, config.privateKey);

  // A single write, no transaction needed. Neither token nor jti are stored.
  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      entityType: 'PortalHandoff',
      entityId: workspace.id,
      action: 'CREATE',
      snapshot: { event: 'portal handoff', intent: input.intent, locale },
    },
  });

  res.setHeader('Cache-Control', 'no-store');
  return { url: handoffUrl(config.portalUrl, token) };
}
