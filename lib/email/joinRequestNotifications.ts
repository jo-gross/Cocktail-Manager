import prisma from '../../prisma/prisma';
import { Role } from '@generated/prisma/client';
import { sendEmail } from './send';
import { getEmailConfig } from './config';

/**
 * Sends emails to all authorized users (OWNER, ADMIN, MANAGER) of the workspace
 * that a new user has requested to join.
 */
export async function sendJoinRequestNotificationToManagers(workspaceId: string, applicantUserId: string): Promise<void> {
  const config = getEmailConfig();
  if (!config.enabled || !config.templateConfig) return;

  const { appBaseUrl } = config.templateConfig;

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
    include: { user: { select: { email: true, name: true } } },
  });

  const manageUsersUrl = `${appBaseUrl}/workspaces/${workspaceId}/manage/settings/users`;
  const applicantName = applicant?.name ?? 'Ein Nutzer';

  await Promise.all(
    managers
      .filter((m) => m.user.email)
      .map((m) =>
        sendEmail(m.user.email!, `Cocktail-Manager - ${workspace.name}: Neue Beitrittsanfrage`, 'join-request-notification', {
          recipientName: m.user.name ?? undefined,
          workspaceName: workspace.name,
          applicantName,
          manageUsersUrl,
        }),
      ),
  );
}

/**
 * Sends an email to the requesting user that their join request was accepted.
 */
export async function sendJoinRequestAcceptedToUser(workspaceId: string, userId: string): Promise<void> {
  const config = getEmailConfig();
  if (!config.enabled || !config.templateConfig) return;

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

  const workspaceUrl = `${config.templateConfig.appBaseUrl}/workspaces/${workspaceId}`;

  await sendEmail(recipient.email, 'Cocktail-Manager - Beitrittsanfrage angenommen', 'join-request-accepted', {
    recipientName: recipient.name ?? undefined,
    workspaceName: workspace.name,
    workspaceUrl,
  });
}

/**
 * Sends an email to the requesting user that their join request was rejected.
 */
export async function sendJoinRequestRejectedToUser(workspaceId: string, userId: string): Promise<void> {
  const config = getEmailConfig();
  if (!config.enabled || !config.templateConfig) return;

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

  await sendEmail(recipient.email, 'Cocktail-Manager - Beitrittsanfrage abgelehnt', 'join-request-rejected', {
    recipientName: recipient.name ?? undefined,
    workspaceName: workspace.name,
  });
}
