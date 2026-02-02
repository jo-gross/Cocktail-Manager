import path from 'path';
import ejs from 'ejs';
import { getTransport } from './transport';
import { getEmailConfig } from './config';

export interface EmailTemplateContext {
  recipientName?: string;
  workspaceName: string;
  applicantName?: string;
  manageUsersUrl?: string;
  workspaceUrl?: string;
  appBaseUrl: string;
  logoUrl: string;
  supportEmail: string;
  impressumUrl: string;
}

/**
 * Renders an EJS template and sends the email.
 * If SMTP is not configured or EMAIL_TEMPLATE_CONFIG is invalid, nothing is sent (error is logged).
 * Send failures are logged; the caller does not receive an exception.
 */
export async function sendEmail(
  to: string,
  subject: string,
  templateName: string,
  context: Omit<EmailTemplateContext, 'appBaseUrl' | 'logoUrl' | 'supportEmail' | 'impressumUrl'>,
): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    return;
  }

  const config = getEmailConfig();
  if (!config.templateConfig) {
    console.error('[email] EMAIL_TEMPLATE_CONFIG missing or invalid – cannot send mail. Set EMAIL_TEMPLATE_CONFIG JSON with appUrl and supportEmail.');
    return;
  }

  const templatesDir = path.join(process.cwd(), 'lib', 'email', 'templates');
  const templatePath = path.join(templatesDir, `${templateName}.ejs`);

  try {
    const html = await ejs.renderFile(templatePath, {
      ...context,
      appBaseUrl: config.templateConfig.appBaseUrl,
      logoUrl: config.templateConfig.logoUrl,
      supportEmail: config.templateConfig.supportEmail,
      impressumUrl: config.templateConfig.impressumUrl,
    });

    await transport.sendMail({
      from: `"${config.fromName}" <${config.from}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('[email] Failed to send:', templateName, 'to', to, error);
  }
}
