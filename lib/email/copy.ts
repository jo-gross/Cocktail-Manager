import { Setting } from '@generated/prisma/client';
import prisma from '../../prisma/prisma';
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from '@lib/i18n/locales';

export type EmailCopy = {
  lang: AppLocale;
  aUser: string;
  joinRequestSubject: (workspaceName: string) => string;
  joinRequestTitle: string;
  joinRequestBody: (applicantName: string, workspaceName: string) => string;
  joinRequestCtaHint: string;
  joinRequestCta: string;
  joinAcceptedSubject: string;
  joinAcceptedTitle: string;
  joinAcceptedBody: (workspaceName: string) => string;
  joinAcceptedCtaHint: string;
  joinAcceptedCta: string;
  joinRejectedSubject: string;
  joinRejectedTitle: string;
  joinRejectedBody: (workspaceName: string) => string;
  greeting: (name?: string) => string;
  footerTagline: string;
  footerLegal: (supportEmail: string, impressumUrl: string) => string;
};

const copy: Record<AppLocale, EmailCopy> = {
  de: {
    lang: 'de',
    aUser: 'Ein Nutzer',
    joinRequestSubject: (workspaceName) => `Cocktail-Manager - ${workspaceName}: Neue Beitrittsanfrage`,
    joinRequestTitle: 'Neue Beitrittsanfrage',
    joinRequestBody: (applicantName, workspaceName) => `<strong>${applicantName}</strong> möchte dem Workspace <strong>${workspaceName}</strong> beitreten.`,
    joinRequestCtaHint: 'Öffne die Nutzerverwaltung, um die Anfrage anzunehmen oder abzulehnen:',
    joinRequestCta: 'Zur Nutzerverwaltung',
    joinAcceptedSubject: 'Cocktail-Manager - Beitrittsanfrage angenommen',
    joinAcceptedTitle: 'Beitrittsanfrage angenommen',
    joinAcceptedBody: (workspaceName) => `Deine Anfrage für den Workspace <strong>${workspaceName}</strong> wurde angenommen.`,
    joinAcceptedCtaHint: 'Du bist jetzt Mitglied und kannst den Workspace nutzen:',
    joinAcceptedCta: 'Zum Workspace',
    joinRejectedSubject: 'Cocktail-Manager - Beitrittsanfrage abgelehnt',
    joinRejectedTitle: 'Beitrittsanfrage abgelehnt',
    joinRejectedBody: (workspaceName) => `Deine Anfrage für den Workspace <strong>${workspaceName}</strong> wurde abgelehnt.`,
    greeting: (name) => (name ? `Hallo ${name},` : 'Hallo,'),
    footerTagline: 'Übersichtlich • Kollaborativ • Zeitsparend',
    footerLegal: (supportEmail, impressumUrl) =>
      `Diese E-Mail wurde automatisch vom Cocktail-Manager-System versendet. Bitte antworten Sie nicht direkt auf diese Nachricht – eingehende Antworten werden nicht bearbeitet. Bei Fragen oder Support: <a href="mailto:${supportEmail}">${supportEmail}</a>. Impressum und Datenschutzhinweis: <a href="${impressumUrl}">Cocktail-Manager</a>.`,
  },
  en: {
    lang: 'en',
    aUser: 'A user',
    joinRequestSubject: (workspaceName) => `Cocktail-Manager - ${workspaceName}: New join request`,
    joinRequestTitle: 'New join request',
    joinRequestBody: (applicantName, workspaceName) => `<strong>${applicantName}</strong> wants to join the workspace <strong>${workspaceName}</strong>.`,
    joinRequestCtaHint: 'Open user management to accept or reject the request:',
    joinRequestCta: 'Open user management',
    joinAcceptedSubject: 'Cocktail-Manager - Join request accepted',
    joinAcceptedTitle: 'Join request accepted',
    joinAcceptedBody: (workspaceName) => `Your request to join the workspace <strong>${workspaceName}</strong> has been accepted.`,
    joinAcceptedCtaHint: 'You are now a member and can use the workspace:',
    joinAcceptedCta: 'Open workspace',
    joinRejectedSubject: 'Cocktail-Manager - Join request declined',
    joinRejectedTitle: 'Join request declined',
    joinRejectedBody: (workspaceName) => `Your request to join the workspace <strong>${workspaceName}</strong> has been declined.`,
    greeting: (name) => (name ? `Hello ${name},` : 'Hello,'),
    footerTagline: 'Clear • Collaborative • Time-saving',
    footerLegal: (supportEmail, impressumUrl) =>
      `This email was sent automatically by the Cocktail-Manager system. Please do not reply directly — incoming replies are not monitored. For questions or support: <a href="mailto:${supportEmail}">${supportEmail}</a>. Legal notice and privacy: <a href="${impressumUrl}">Cocktail-Manager</a>.`,
  },
};

export async function getUserEmailLocale(userId: string): Promise<AppLocale> {
  const setting = await prisma.userSetting.findFirst({
    where: { userId, setting: Setting.language },
    select: { value: true },
  });
  return isAppLocale(setting?.value) ? setting.value : DEFAULT_LOCALE;
}

export function getEmailCopy(locale: AppLocale): EmailCopy {
  return copy[locale] ?? copy[DEFAULT_LOCALE];
}
