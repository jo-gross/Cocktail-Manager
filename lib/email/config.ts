/**
 * Email configuration from environment variables.
 * If SMTP_HOST is not set, no email is sent.
 * When SMTP is enabled, EMAIL_TEMPLATE_CONFIG (JSON) with appUrl and supportEmail is required.
 */

export interface EmailTemplateConfig {
  appBaseUrl: string;
  logoUrl: string;
  supportEmail: string;
  impressumUrl: string;
}

function parseEmailTemplateConfig(): EmailTemplateConfig | null {
  const raw = process.env.EMAIL_TEMPLATE_CONFIG;
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const appUrl = typeof parsed.appUrl === 'string' ? parsed.appUrl.trim() : '';
    const supportEmail = typeof parsed.supportEmail === 'string' ? parsed.supportEmail.trim() : '';
    const impressumUrl = typeof parsed.impressumUrl === 'string' ? parsed.impressumUrl.trim() : appUrl;

    if (!appUrl || !supportEmail) {
      console.error('[email] EMAIL_TEMPLATE_CONFIG invalid: appUrl and supportEmail are required and must be non-empty');
      return null;
    }

    const baseUrl = appUrl.replace(/\/$/, '');
    return {
      appBaseUrl: baseUrl,
      logoUrl: `${baseUrl}/images/Logo.svg`,
      supportEmail,
      impressumUrl: impressumUrl.replace(/\/$/, '') || baseUrl,
    };
  } catch (e) {
    console.error('[email] EMAIL_TEMPLATE_CONFIG invalid JSON:', e);
    return null;
  }
}

export function getEmailConfig(): {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  fromName: string;
  templateConfig: EmailTemplateConfig | null;
} {
  const host = process.env.SMTP_HOST ?? '';
  const port = parseInt(process.env.SMTP_PORT ?? '8025', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.MAIL_FROM ?? 'noreply@localhost';
  const fromName = process.env.MAIL_FROM_NAME ?? 'Cocktail Manager';
  const templateConfig = parseEmailTemplateConfig();

  if (host && !templateConfig) {
    console.error('[email] SMTP is configured but EMAIL_TEMPLATE_CONFIG is missing or invalid – no emails will be sent');
  }

  return {
    enabled: Boolean(host),
    host,
    port: Number.isNaN(port) ? 8025 : port,
    secure,
    user: user || undefined,
    pass: pass || undefined,
    from,
    fromName,
    templateConfig,
  };
}
