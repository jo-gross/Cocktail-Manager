import prisma from '../../prisma/prisma';
import { Role } from '@generated/prisma/client';
import { sendEmail } from './send';
import { getEmailConfig } from './config';
import { getEmailCopy, getUserEmailLocale } from './copy';

/**
 * Sends emails to all authorized users (OWNER, ADMIN, MANAGER) of the workspace
 * that a new user has requested to join.
 */
export async function sendJoinRequestNotificationToManagers(workspaceId: string, applicantUserId: string): Promise<void> {
  const config = getEmailConfig();
  if (!config.enabled || !config.templateConfig) return;

  const { appBaseUrl, supportEmail, impressumUrl } = config.templateConfig;

  const [workspace, applicant] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    }),
    prisma.user.findUnique({
      where: { id: applicantUserId },
      select: { name: true },
    }),
  ]);

  if (!workspace) return;

  const managers = await prisma.workspaceUser.findMany({
    where: {
      workspaceId,
      role: { in: [Role.OWNER, Role.ADMIN, Role.MANAGER] },
      user: { email: { not: null } },
    },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  const manageUsersUrl = `${appBaseUrl}/workspaces/${workspaceId}/manage/settings/users`;

  await Promise.all(
    managers
      .filter((m) => m.user.email)
      .map(async (m) => {
        const locale = await getUserEmailLocale(m.user.id);
        const emailCopy = getEmailCopy(locale);
        const applicantName = applicant?.name ?? emailCopy.aUser;

        await sendEmail(m.user.email!, emailCopy.joinRequestSubject(workspace.name), 'join-request-notification', {
          lang: emailCopy.lang,
          title: emailCopy.joinRequestTitle,
          greeting: emailCopy.greeting(m.user.name ?? undefined),
          bodyHtml: emailCopy.joinRequestBody(applicantName, workspace.name),
          ctaHint: emailCopy.joinRequestCtaHint,
          ctaLabel: emailCopy.joinRequestCta,
          manageUsersUrl,
          footerTagline: emailCopy.footerTagline,
          footerLegal: emailCopy.footerLegal(supportEmail, impressumUrl),
        });
      }),
  );
}

/**
 * Sends an email to the requesting user that their join request was accepted.
 */
export async function sendJoinRequestAcceptedToUser(workspaceId: string, userId: string): Promise<void> {
  const config = getEmailConfig();
  if (!config.enabled || !config.templateConfig) return;

  const { supportEmail, impressumUrl } = config.templateConfig;

  const [workspace, recipient] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    }),
  ]);

  if (!workspace || !recipient?.email) return;

  const locale = await getUserEmailLocale(userId);
  const emailCopy = getEmailCopy(locale);
  const workspaceUrl = `${config.templateConfig.appBaseUrl}/workspaces/${workspaceId}`;

  await sendEmail(recipient.email, emailCopy.joinAcceptedSubject, 'join-request-accepted', {
    lang: emailCopy.lang,
    title: emailCopy.joinAcceptedTitle,
    greeting: emailCopy.greeting(recipient.name ?? undefined),
    bodyHtml: emailCopy.joinAcceptedBody(workspace.name),
    ctaHint: emailCopy.joinAcceptedCtaHint,
    ctaLabel: emailCopy.joinAcceptedCta,
    workspaceUrl,
    footerTagline: emailCopy.footerTagline,
    footerLegal: emailCopy.footerLegal(supportEmail, impressumUrl),
  });
}

/**
 * Sends an email to the requesting user that their join request was rejected.
 */
export async function sendJoinRequestRejectedToUser(workspaceId: string, userId: string): Promise<void> {
  const config = getEmailConfig();
  if (!config.enabled || !config.templateConfig) return;

  const { supportEmail, impressumUrl } = config.templateConfig;

  const [workspace, recipient] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    }),
  ]);

  if (!workspace || !recipient?.email) return;

  const locale = await getUserEmailLocale(userId);
  const emailCopy = getEmailCopy(locale);

  await sendEmail(recipient.email, emailCopy.joinRejectedSubject, 'join-request-rejected', {
    lang: emailCopy.lang,
    title: emailCopy.joinRejectedTitle,
    greeting: emailCopy.greeting(recipient.name ?? undefined),
    bodyHtml: emailCopy.joinRejectedBody(workspace.name),
    footerTagline: emailCopy.footerTagline,
    footerLegal: emailCopy.footerLegal(supportEmail, impressumUrl),
  });
}
