export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DEPLOYMENT: 'test' | 'development' | 'production' | 'staging' | 'demo';
      DISABLE_WORKSPACE_CREATION?: string;
      WORKSPACE_CREATION_DISABLED_MESSAGE?: string;
      // E-Mail / SMTP (optional; if SMTP_HOST is not set, no email is sent)
      SMTP_HOST?: string;
      SMTP_PORT?: string;
      SMTP_SECURE?: string;
      SMTP_USER?: string;
      SMTP_PASSWORD?: string;
      MAIL_FROM?: string;
      MAIL_FROM_NAME?: string;
      /** JSON with appUrl (required), supportEmail (required), impressumUrl (optional, default: appUrl). Required when SMTP is enabled. If a required value is missing, no email is sent. See docs/ENV.md. */
      EMAIL_TEMPLATE_CONFIG?: string;
    }
  }
}
