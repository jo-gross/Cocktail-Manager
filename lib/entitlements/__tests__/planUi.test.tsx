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

vi.mock('next/router', () => ({ useRouter: () => ({ query: { workspaceId: 'ws1' }, pathname: '/workspaces/[workspaceId]/manage' }) }));

async function render(content: React.ReactNode, language = 'de') {
  const i18n = createInstance();
  await i18n.init({
    lng: language,
    resources: { de: { plan: dePlan, common: deCommon }, en: { plan: enPlan, common: enCommon } },
    defaultNS: 'plan',
  });
  return renderToStaticMarkup(<I18nextProvider i18n={i18n}>{content}</I18nextProvider>);
}

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
  };
}

const OFF: WorkspaceEntitlementDto = { mode: 'off', plan: null, usage: null };

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
    expect(html).toContain('Abo verwalten');
    expect(html).not.toContain('individuelle Konditionen');
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
    expect(html).toContain('Abo verwalten');
  });

  it('shows READ_ONLY and SUSPENDED as errors', async () => {
    const readOnly = await render(<PlanStatusBanner entitlement={managed({ status: 'READ_ONLY' })} workspaceId="ws1" />);
    expect(readOnly).toContain('nur noch lesbar');
    expect(readOnly).toContain('bg-error');
    const suspended = await render(<PlanStatusBanner entitlement={managed({ status: 'SUSPENDED' })} workspaceId="ws1" />, 'en');
    expect(suspended).toContain('This workspace is suspended.');
    expect(suspended).not.toContain('Manage subscription');
  });
});

describe('PlanLimitDialog', () => {
  const close = () => undefined;

  it('names the reached limit with its numbers and offers the manage button', async () => {
    const html = await render(
      <PlanLimitDialog
        event={{ code: 'PLAN_LIMIT_REACHED', details: { key: 'cocktails', limit: 50, current: 50 } }}
        workspaceId="ws1"
        billing="portal"
        onClose={close}
      />,
    );
    expect(html).toContain('Limit erreicht');
    expect(html).toContain('höchstens 50 (Cocktails). Aktuell: 50.');
    expect(html).toContain('Abo verwalten');
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
  });
});
