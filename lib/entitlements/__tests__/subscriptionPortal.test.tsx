import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import dePlan from '../../../locales/de/plan.json';
import enPlan from '../../../locales/en/plan.json';
import { openSubscriptionPortal, portalButtonState, PortalHandoffError, requestPortalHandoff } from '@lib/entitlements/subscriptionPortal';
import { ManageSubscriptionButtonView } from '@components/plan/ManageSubscriptionButton';

const PORTAL = 'https://portal.example.test/sso?token=a.b.c';

function answer(status: number, body: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;
}

async function render(content: React.ReactNode, language = 'de') {
  const i18n = createInstance();
  await i18n.init({ lng: language, resources: { de: { plan: dePlan }, en: { plan: enPlan } }, defaultNS: 'plan' });
  return renderToStaticMarkup(<I18nextProvider i18n={i18n}>{content}</I18nextProvider>);
}

describe('portalButtonState', () => {
  it('checks availability, then the owner role, then the verified email address', () => {
    expect(portalButtonState({ available: false, isOwner: true, emailVerified: true })).toBe('unavailable');
    expect(portalButtonState({ available: false, isOwner: false, emailVerified: false })).toBe('unavailable');
    expect(portalButtonState({ available: true, isOwner: false, emailVerified: true })).toBe('notOwner');
    expect(portalButtonState({ available: true, isOwner: false, emailVerified: false })).toBe('notOwner');
    expect(portalButtonState({ available: true, isOwner: true, emailVerified: false })).toBe('emailNotVerified');
    expect(portalButtonState({ available: true, isOwner: true, emailVerified: true })).toBe('ready');
  });
});

describe('requestPortalHandoff', () => {
  it('POSTs intent and locale to the handoff of the workspace and answers the portal URL', async () => {
    const fetchImpl = answer(200, { data: { url: PORTAL } });
    expect(await requestPortalHandoff('ws 1', 'upgrade', 'en', fetchImpl)).toBe(PORTAL);
    expect(fetchImpl).toHaveBeenCalledWith('/api/v1/workspaces/ws%201/portal/handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'upgrade', locale: 'en' }),
      cache: 'no-store',
    });
  });

  it('throws the error code of a refused handoff', async () => {
    await expect(requestPortalHandoff('ws1', 'manage', 'de', answer(403, { error: { code: 'EMAIL_NOT_VERIFIED', message: 'x' } }))).rejects.toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
      status: 403,
    });
    await expect(requestPortalHandoff('ws1', 'manage', 'de', answer(500, null))).rejects.toMatchObject({ code: 'ERROR', status: 500 });
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(requestPortalHandoff('ws1', 'manage', 'de', offline)).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('never navigates to anything but an http(s) URL', async () => {
    await expect(requestPortalHandoff('ws1', 'manage', 'de', answer(200, { data: { url: 'javascript:alert(1)' } }))).rejects.toBeInstanceOf(PortalHandoffError);
    await expect(requestPortalHandoff('ws1', 'manage', 'de', answer(200, { data: {} }))).rejects.toBeInstanceOf(PortalHandoffError);
  });
});

describe('openSubscriptionPortal', () => {
  it('navigates to the portal URL', async () => {
    const navigate = vi.fn();
    await openSubscriptionPortal('ws1', 'manage', 'de', navigate, answer(200, { data: { url: PORTAL } }));
    expect(navigate).toHaveBeenCalledWith(PORTAL);
  });

  it('does not navigate when the handoff is refused', async () => {
    const navigate = vi.fn();
    await expect(openSubscriptionPortal('ws1', 'manage', 'de', navigate, answer(404, { error: { code: 'PORTAL_HANDOFF_UNAVAILABLE' } }))).rejects.toThrow();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('ManageSubscriptionButtonView', () => {
  it('shows "Abo verwalten" or "Upgrade" by intent', async () => {
    expect(await render(<ManageSubscriptionButtonView state="ready" />)).toMatch(/<button(?![^>]*disabled="")[^>]*>Abo verwalten<\/button>/);
    expect(await render(<ManageSubscriptionButtonView state="ready" intent="upgrade" />, 'en')).toMatch(/<button(?![^>]*disabled="")[^>]*>Upgrade<\/button>/);
  });

  it('shows a disabled button with a spinner while loading', async () => {
    const html = await render(<ManageSubscriptionButtonView state="ready" busy />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-busy="true"[^>]*>.*role="status"/);
  });

  it('shows the error of a failed attempt and keeps the button usable', async () => {
    const failed = await render(<ManageSubscriptionButtonView state="ready" error="NETWORK" />);
    expect(failed).toContain('role="alert"');
    expect(failed).toContain('Das Kundenportal konnte nicht geöffnet werden.');
    expect(failed).toMatch(/<button(?![^>]*disabled="")[^>]*>Abo verwalten<\/button>/);
    const unverified = await render(<ManageSubscriptionButtonView state="ready" error="EMAIL_NOT_VERIFIED" />, 'en');
    expect(unverified).toContain('Verify your email address first');
  });

  it('explains the unverified email address and the owner rule', async () => {
    const unverified = await render(<ManageSubscriptionButtonView state="emailNotVerified" />);
    expect(unverified).toMatch(/<button[^>]*disabled=""[^>]*>Abo verwalten<\/button>/);
    expect(unverified).toContain('Bestätige zuerst deine E-Mail-Adresse');
    expect(await render(<ManageSubscriptionButtonView state="notOwner" />)).toBe(
      '<p class="text-sm text-base-content/70" data-testid="portal-owners-only">Nur Inhaberinnen und Inhaber können das Abo verwalten.</p>',
    );
  });

  it('disables the button when the instance offers no handoff', async () => {
    expect(await render(<ManageSubscriptionButtonView state="unavailable" />)).toMatch(/<button[^>]*disabled=""[^>]*>Abo verwalten<\/button>/);
  });
});
