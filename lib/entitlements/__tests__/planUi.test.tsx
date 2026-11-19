import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import dePlan from '../../../locales/de/plan.json';
import enPlan from '../../../locales/en/plan.json';
import deCommon from '../../../locales/de/common.json';
import enCommon from '../../../locales/en/common.json';
import { PlanCard } from '@components/plan/PlanCard';
import { PlanLimitDialog } from '@components/plan/PlanLimitDialog';
import { PlanStatusBanner } from '@components/plan/PlanStatusBanner';
import { SuspendedWorkspaceView } from '@components/plan/PlanBoundary';
import type { WorkspaceEntitlementDto } from '@lib/schemas/entitlements';
import { UserContext } from '@lib/context/UserContextProvider';

vi.mock('next/router', () => ({ useRouter: () => ({ query: { workspaceId: 'ws1' }, pathname: '/workspaces/[workspaceId]/manage' }) }));

/** The signed-in user: owner with a verified email address unless stated otherwise. */
interface Viewer {
  owner?: boolean;
  emailVerified?: boolean;
}

async function render(content: React.ReactNode, language = 'de', { owner = true, emailVerified = true }: Viewer = {}) {
  const i18n = createInstance();
  await i18n.init({
    lng: language,
    resources: { de: { plan: dePlan, common: deCommon }, en: { plan: enPlan, common: enCommon } },
    defaultNS: 'plan',
  });
  const user = { isUserPermitted: (role: string) => owner || role !== 'OWNER', user: { emailVerified } } as never;
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <UserContext.Provider value={user}>{content}</UserContext.Provider>
    </I18nextProvider>,
  );
}

/** The portal button is shown and can be clicked. */
const ENABLED_MANAGE = /<button[^>]*type="button"(?![^>]*disabled="")[^>]*>Abo verwalten<\/button>/;

function managed(plan: Partial<NonNullable<WorkspaceEntitlementDto['plan']>> = {}): WorkspaceEntitlementDto {
  return {
    mode: 'managed',
    plan: {
      planKey: 'homebar_free',
      planName: { de: 'Homebar Gratis', en: 'Homebar Free' },
      status: 'ACTIVE',
      billing: 'portal',
      nextChangeAt: null,
      limits: { cocktails: 50, members: 2, calculations: null, guestMenusPublished: 1, signageScreens: 0, apiKeys: 0 },
      features: ['statistics.advanced'],
      source: 'default',
      ...plan,
    },
    usage: { cocktails: 50, members: 1, calculations: 7, guestMenusPublished: 0, signageScreens: 0, apiKeys: 0 },
    portalHandoff: true,
  };
}

const OFF: WorkspaceEntitlementDto = { mode: 'off', plan: null, usage: null, portalHandoff: false };

describe('PlanCard', () => {
  it('renders nothing on self-hosted instances', async () => {
    expect(await render(<PlanCard entitlement={OFF} workspaceId="ws1" />)).toBe('');
    expect(await render(<PlanCard entitlement={null} workspaceId="ws1" />)).toBe('');
  });

  it('shows plan name, status, usage against limits and the manage button', async () => {
    const html = await render(<PlanCard entitlement={managed()} workspaceId="ws1" />);
    expect(html).toContain('Homebar Gratis');
    expect(html).toContain('Aktiv');
    expect(html).toContain('50 von 50');
    expect(html).toContain('7 · unbegrenzt');
    expect(html).toContain('Erweiterte Statistik');
    expect(html).toMatch(ENABLED_MANAGE);
    expect(html).not.toContain('individuelle Konditionen');
  });

  it('disables the manage button when the instance offers no portal handoff', async () => {
    const html = await render(<PlanCard entitlement={{ ...managed(), portalHandoff: false }} workspaceId="ws1" />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Abo verwalten<\/button>/);
  });

  it('tells non-owners that only owners can manage the subscription', async () => {
    const html = await render(<PlanCard entitlement={managed()} workspaceId="ws1" />, 'de', { owner: false });
    expect(html).toContain('Nur Inhaberinnen und Inhaber können das Abo verwalten.');
    expect(html).not.toContain('<button');
    const en = await render(<PlanCard entitlement={managed()} workspaceId="ws1" />, 'en', { owner: false });
    expect(en).toContain('Only owners can manage the subscription.');
  });

  it('explains why the button is unavailable while the email address is not verified', async () => {
    const html = await render(<PlanCard entitlement={managed()} workspaceId="ws1" />, 'de', { emailVerified: false });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Abo verwalten<\/button>/);
    expect(html).toContain('Bestätige zuerst deine E-Mail-Adresse');
  });

  it('shows a contact hint instead of the button for billing contact, in English', async () => {
    const html = await render(<PlanCard entitlement={managed({ billing: 'contact', planName: { de: 'Partner', en: 'Partner' } })} workspaceId="ws1" />, 'en');
    expect(html).toContain('Partner');
    expect(html).toContain('Individual terms apply');
    expect(html).not.toContain('Manage subscription');
  });

  it('says that nothing is limited before the first push', async () => {
    expect(await render(<PlanCard entitlement={{ mode: 'managed', plan: null, usage: managed().usage }} workspaceId="ws1" />)).toContain('keine Limits');
  });
});

describe('PlanStatusBanner', () => {
  it('shows nothing for ACTIVE or off', async () => {
    expect(await render(<PlanStatusBanner entitlement={managed()} workspaceId="ws1" />)).toBe('');
    expect(await render(<PlanStatusBanner entitlement={OFF} workspaceId="ws1" />)).toBe('');
  });

  it('warns for GRACE with the manage button', async () => {
    const html = await render(<PlanStatusBanner entitlement={managed({ status: 'GRACE' })} workspaceId="ws1" />);
    expect(html).toContain('Zahlung für diesen Workspace ist offen');
    expect(html).toContain('bg-warning');
    expect(html).toMatch(ENABLED_MANAGE);
  });

  it('shows READ_ONLY and SUSPENDED as errors', async () => {
    const readOnly = await render(<PlanStatusBanner entitlement={managed({ status: 'READ_ONLY' })} workspaceId="ws1" />);
    expect(readOnly).toContain('nur noch lesbar');
    expect(readOnly).toContain('bg-error');
    const suspended = await render(<PlanStatusBanner entitlement={managed({ status: 'SUSPENDED' })} workspaceId="ws1" />, 'en');
    expect(suspended).toContain('This workspace is suspended.');
    // Paying stays possible in a suspended workspace (the handoff is exempt from the status gate).
    expect(suspended).toContain('>Manage subscription</button>');
  });
});

describe('PlanLimitDialog', () => {
  const close = () => undefined;

  it('names the reached limit with its numbers and offers the upgrade', async () => {
    const html = await render(
      <PlanLimitDialog
        event={{ code: 'PLAN_LIMIT_REACHED', details: { key: 'cocktails', limit: 50, current: 50 } }}
        workspaceId="ws1"
        billing="portal"
        portalHandoff
        onClose={close}
      />,
    );
    expect(html).toContain('Limit erreicht');
    expect(html).toContain('höchstens 50 (Cocktails). Aktuell: 50.');
    expect(html).toMatch(/<button[^>]*type="button"(?![^>]*disabled="")[^>]*>Upgrade<\/button>/);
    expect(html).not.toContain('Abo verwalten');
  });

  it('offers "Abo verwalten" for read-only and suspended workspaces, disabled without handoff', async () => {
    for (const code of ['WORKSPACE_READ_ONLY', 'WORKSPACE_SUSPENDED'] as const) {
      const html = await render(<PlanLimitDialog event={{ code, details: null }} workspaceId="ws1" billing="portal" portalHandoff onClose={close} />);
      expect(html, code).toMatch(ENABLED_MANAGE);
    }
    const without = await render(
      <PlanLimitDialog event={{ code: 'PLAN_FEATURE_MISSING', details: null }} workspaceId="ws1" billing="portal" onClose={close} />,
    );
    expect(without).toMatch(/<button[^>]*disabled=""[^>]*>Upgrade<\/button>/);
  });

  it('names a missing feature and shows the contact hint for billing contact', async () => {
    const html = await render(
      <PlanLimitDialog
        event={{ code: 'PLAN_FEATURE_MISSING', details: { key: 'signage', limit: null, current: null } }}
        workspaceId="ws1"
        billing="contact"
        onClose={close}
      />,
      'en',
    );
    expect(html).toContain('Not included in your plan');
    expect(html).toContain('Monitor/signage');
    expect(html).toContain('Individual terms apply');
    expect(html).not.toContain('Manage subscription');
  });

  it('explains read-only and free workspace limits without a workspace', async () => {
    expect(
      await render(<PlanLimitDialog event={{ code: 'WORKSPACE_READ_ONLY', details: null }} workspaceId="ws1" billing="portal" onClose={close} />),
    ).toContain('Änderungen sind nicht möglich');
    const free = await render(
      <PlanLimitDialog
        event={{ code: 'PLAN_LIMIT_REACHED', details: { key: 'freeWorkspacesPerOwner', limit: 1, current: 1 } }}
        workspaceId={null}
        billing={null}
        onClose={close}
      />,
    );
    expect(free).toContain('Kostenlose Workspaces');
    expect(free).not.toContain('Abo verwalten');
  });
});

describe('SuspendedWorkspaceView', () => {
  it('links to export and to leaving/deleting', async () => {
    const html = await render(<SuspendedWorkspaceView workspaceId="ws1" />);
    expect(html).toContain('Workspace gesperrt');
    expect(html).toContain('/workspaces/ws1/manage/settings/data');
    expect(html).toContain('/workspaces/ws1/manage/settings/danger');
    expect(html).not.toContain('Abo verwalten');
  });

  it('offers "Abo verwalten" for billing portal, so a suspended workspace can still pay', async () => {
    const html = await render(<SuspendedWorkspaceView workspaceId="ws1" entitlement={managed({ status: 'SUSPENDED' })} />);
    expect(html).toMatch(ENABLED_MANAGE);
    const contact = await render(<SuspendedWorkspaceView workspaceId="ws1" entitlement={managed({ status: 'SUSPENDED', billing: 'contact' })} />);
    expect(contact).not.toContain('Abo verwalten');
  });
});
