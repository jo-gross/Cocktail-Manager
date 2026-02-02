import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getEmailConfig } from './config';

let transporter: Transporter | null = null;

/**
 * Returns a configured Nodemailer transport or null if SMTP is not configured.
 */
export function getTransport(): Transporter | null {
  if (transporter !== null) {
    return transporter;
  }

  const config = getEmailConfig();
  if (!config.enabled) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
  });

  return transporter;
}
