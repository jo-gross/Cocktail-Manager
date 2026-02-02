# Email Notifications

This document describes email notifications in Cocktail Manager, in particular for workspace join requests.

## Overview

Emails are only sent when SMTP is configured and `EMAIL_TEMPLATE_CONFIG` (JSON with `appUrl`, `supportEmail`, and optional `impressumUrl`) is set and valid (see [Environment Variables](ENV.md#e-mail--smtp)). If `SMTP_HOST` is not set, no emails are sent. If SMTP is set but `EMAIL_TEMPLATE_CONFIG` is missing or invalid, an error is logged and no email is sent.

## Join Requests (Workspace Join Requests)

### Who Gets Notified When?

1. **New join request**  
   When a user requests to join a workspace via an invite link and the workspace already has members, the request must be approved by an authorized user. In this case **all users with role OWNER, ADMIN, or MANAGER** in that workspace receive an email (if they have an email address). The email includes the applicant’s name, workspace name, and a link to user management to accept or reject the request.

2. **Request accepted**  
   When an authorized user accepts the join request, **the requesting user** receives an email with confirmation and a link to the workspace (if they have an email address).

3. **Request rejected**  
   When an authorized user rejects the join request, **the requesting user** receives an email stating that the request was rejected (if they have an email address).

Users without an email address (e.g. demo users) do not receive emails.

## EMAIL_TEMPLATE_CONFIG

Email sending requires **`EMAIL_TEMPLATE_CONFIG`** (environment variable with a JSON string). Without a valid config, no email is sent and an error is logged.

**JSON structure:**

| Key             | Required | Description |
|-----------------|----------|-------------|
| `appUrl`        | yes      | Base URL of the application (for links in emails and logo URL). |
| `supportEmail`  | yes      | Support email address (used as `mailto:` link in the footer). |
| `impressumUrl`  | no       | URL for imprint/privacy (default: value of `appUrl`). |

**Example** (single line in `.env`, JSON in single quotes):

```bash
EMAIL_TEMPLATE_CONFIG='{"appUrl":"https://cocktail-manager.example.com","supportEmail":"support@cocktail-manager.de","impressumUrl":"https://cocktail-manager.example.com/impressum"}'
```

Full list of email-related environment variables: [ENV.md – E-Mail / SMTP](ENV.md#e-mail--smtp).

## Email Templates

Emails are rendered with EJS templates and share a common layout:

- **Layout:** Content area, footer with divider, logo + “Cocktail-Manager” + tagline (clickable, opens the app), legal notice with support `mailto:` link and imprint/privacy link. Links and support address come from `EMAIL_TEMPLATE_CONFIG`.
- **Templates:**
  - **New join request** (`join-request-notification`): To authorized users; includes workspace name, applicant name, and link to user management.
  - **Request accepted** (`join-request-accepted`): To the requesting user; confirmation and link to the workspace.
  - **Request rejected** (`join-request-rejected`): To the requesting user; neutral notice that the request was rejected.

Templates live under `lib/email/templates/`. Logo and all links in emails are loaded from `EMAIL_TEMPLATE_CONFIG` (in particular `appUrl`).

## Local Testing with fake-smtp-server

To test emails without a real SMTP server you can use [fake-smtp-server](https://github.com/gessnerfl/fake-smtp-server). It accepts emails, stores them, and displays them in a web UI.

### Docker (recommended)

1. A `fake-smtp` service (image `gessnerfl/fake-smtp-server`) is already defined in `docker-compose.yaml`.
2. Start the stack including fake-smtp:
   ```bash
   docker-compose up -d
   ```
3. **SMTP port:** 8025  
   **Web UI:** http://localhost:8080 (view received emails)
4. Configure the app for email (see [ENV.md – E-Mail / SMTP](ENV.md#e-mail--smtp)):
   - **App running locally (e.g. `pnpm dev`):** In `.env` for example:
     - `SMTP_HOST=localhost`
     - `SMTP_PORT=8025`
     - `MAIL_FROM=noreply@localhost`
     - `EMAIL_TEMPLATE_CONFIG={"appUrl":"http://localhost:3000","supportEmail":"support@cocktail-manager.de"}`
   - **App running in Docker (cocktail-manager):** Set email variables under `cocktail-manager` in `docker-compose.yaml`, including `EMAIL_TEMPLATE_CONFIG` (JSON with `appUrl`, `supportEmail`, optional `impressumUrl`).
5. Trigger a join request (user clicks invite link, workspace already has members). All authorized users with an email receive an email.
6. Check received emails in the Web UI at http://localhost:8080.
7. Accept or reject the request; the requesting user receives the corresponding email, also visible in the Web UI.

### Without Docker

fake-smtp-server can also be run locally with Java (see [gessnerfl/fake-smtp-server](https://github.com/gessnerfl/fake-smtp-server)). Then set e.g. `SMTP_HOST=localhost` and `SMTP_PORT=8025` in `.env`.

## Technical Notes

- Email is sent asynchronously; send failures are logged and the API response (e.g. “Request created” or “Accepted”) remains successful.
- Base URL for links and logo, support address, and imprint link come only from **`EMAIL_TEMPLATE_CONFIG`** (JSON with `appUrl`, `supportEmail`, optional `impressumUrl`). See [Environment Variables – E-Mail / SMTP](ENV.md#e-mail--smtp).
