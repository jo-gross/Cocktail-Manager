// @vitest-environment jsdom
/**
 * The plan UI and the announcement banner in the app shell, rendered with a real React root:
 * - `ENTITLEMENTS_MODE=off`: no request beyond the mode itself (once per page load), none per workspace open, no polling
 * - the page stays mounted when the plan loads and when the workspace changes
 * - reads refused with `WORKSPACE_SUSPENDED` do not open the limit dialog over the status view; writes still do
 */
import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import dePlan from '../../../locales/de/plan.json';
import deCommon from '../../../locales/de/common.json';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import type { WorkspaceEntitlementDto } from '@lib/schemas/entitlements';

const router = { pathname: '/workspaces/[workspaceId]/manage', query: { workspaceId: 'ws1' } as Record<string, string>, replace: vi.fn(async () => true) };
vi.mock('next/router', () => ({ useRouter: () => router }));

const ANNOUNCEMENT_POLL_MS = 5 * 60 * 1000;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function plan(status: 'ACTIVE' | 'SUSPENDED'): WorkspaceEntitlementDto {
  return {
    mode: 'managed',
    plan: {
      planKey: 'bar_pro',
      planName: { de: 'Bar Pro', en: 'Bar Pro' },
      status,
      billing: 'contact',
      nextChangeAt: null,
      scheduledEnd: null,
      limits: { cocktails: null, members: null, calculations: null, guestMenusPublished: null, signageScreens: null, apiKeys: null },
      features: [],
      source: 'workspace',
    },
    usage: { cocktails: 0, members: 1, calculations: 0, guestMenusPublished: 0, signageScreens: 0, apiKeys: 0 },
    portalHandoff: false,
  };
}

const mounts: string[] = [];
function Page() {
  useEffect(() => {
    mounts.push('mount');
    return () => void mounts.push('unmount');
  }, []);
  return <div>page</div>;
}

let container: HTMLDivElement;
let root: Root;
let requests: string[];
let answer: (url: string, init?: RequestInit) => Response | Promise<Response>;
const modal = { openModal: vi.fn(), closeModal: vi.fn(), closeAllModals: vi.fn(), content: [], hideCloseButton: [] };

async function flush() {
  for (let i = 0; i < 5; i++) await act(async () => undefined);
}

async function renderShell(workspaceId: string) {
  router.query = { workspaceId };
  const { PlanBoundary } = await import('@components/plan/PlanBoundary');
  const { AnnouncementBanner } = await import('@components/announcements/AnnouncementBanner');
  const i18n = createInstance();
  await i18n.init({ lng: 'de', resources: { de: { plan: dePlan, common: deCommon } }, defaultNS: 'plan' });
  const user = {
    user: { id: 'u1', emailVerified: true },
    workspace: { id: workspaceId, isExternallyManaged: false, members: [{ userId: 'u1', role: 'USER' }] },
    isUserPermitted: (role: string) => role === 'USER',
    uiLocale: 'de',
  } as never;
  await act(async () =>
    root.render(
      <I18nextProvider i18n={i18n}>
        <ModalContext.Provider value={modal as never}>
          <UserContext.Provider value={user}>
            <AnnouncementBanner />
            <PlanBoundary>
              <Page />
            </PlanBoundary>
          </UserContext.Provider>
        </ModalContext.Provider>
      </I18nextProvider>,
    ),
  );
  await flush();
}

describe('plan UI in the app shell', () => {
  beforeEach(async () => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    (await import('@lib/network/entitlementsMode')).resetEntitlementsModeForTests();
    mounts.length = 0;
    requests = [];
    modal.openModal.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        requests.push(`${init?.method ?? 'GET'} ${input}`);
        return answer(input, init);
      }),
    );
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('off: one request for the mode per page load, none per workspace open, no polling', async () => {
    answer = (url) => (url === '/api/config/entitlements' ? json(200, { data: { mode: 'off' } }) : json(200, { data: [] }));
    await renderShell('ws1');
    await renderShell('ws2');
    await renderShell('ws1');
    await act(async () => void vi.advanceTimersByTime(3 * ANNOUNCEMENT_POLL_MS));
    await flush();
    expect(requests).toEqual(['GET /api/config/entitlements']);
    expect(container.textContent).toBe('page');
  });

  it('managed: keeps the page mounted when the plan arrives and when the workspace changes', async () => {
    const pending: Array<() => void> = [];
    answer = (url) => {
      if (url === '/api/config/entitlements') return json(200, { data: { mode: 'managed' } });
      if (url.endsWith('/entitlement')) return new Promise((resolve) => pending.push(() => resolve(json(200, { data: plan('ACTIVE') }))));
      return json(200, { data: [] });
    };
    await renderShell('ws1');
    expect(requests).toContain('GET /api/v1/workspaces/ws1/entitlement');
    await act(async () => pending.splice(0).forEach((resolve) => resolve()));
    await flush();
    await renderShell('ws2');
    await act(async () => pending.splice(0).forEach((resolve) => resolve()));
    await flush();
    expect(requests).toContain('GET /api/v1/workspaces/ws2/entitlement');
    expect(requests).toContain('GET /api/v1/workspaces/ws2/announcements');
    expect(mounts).toEqual(['mount']);
  });

  it('managed, suspended: background reads do not open the dialog over the status view; writes do', async () => {
    answer = (url) => {
      if (url === '/api/config/entitlements') return json(200, { data: { mode: 'managed' } });
      if (url.endsWith('/entitlement')) return json(200, { data: plan('SUSPENDED') });
      if (url.endsWith('/announcements')) return json(200, { data: [] });
      return json(402, { error: { code: 'WORKSPACE_SUSPENDED', message: 'Suspended' } });
    };
    await renderShell('ws1');
    expect(container.querySelector('[data-testid="plan-suspended-view"]')).not.toBeNull();
    // The status view offers the member export and leaving to a plain member.
    expect(container.textContent).toContain('Cocktails exportieren (JSON)');
    expect(container.textContent).toContain('Kalkulationen exportieren (JSON)');
    expect(container.textContent).toContain('Workspace verlassen');
    expect(container.textContent).not.toContain('Komplettes Backup');

    const { apiV1Fetch } = await import('@lib/network/apiV1');
    await act(async () => void (await apiV1Fetch('/api/v1/workspaces/ws1/translations').catch(() => undefined)));
    await act(async () => void (await apiV1Fetch('/api/v1/workspaces/ws1/cocktails').catch(() => undefined)));
    expect(modal.openModal).not.toHaveBeenCalled();

    await act(async () => void (await apiV1Fetch('/api/v1/workspaces/ws1/cocktails', { method: 'POST', body: '{}' }).catch(() => undefined)));
    expect(modal.openModal).toHaveBeenCalledTimes(1);
  });

  it('managed, suspended: a member leaves through the leave API', async () => {
    answer = (url) => {
      if (url === '/api/config/entitlements') return json(200, { data: { mode: 'managed' } });
      if (url.endsWith('/entitlement')) return json(200, { data: plan('SUSPENDED') });
      if (url.endsWith('/leave')) return json(200, { data: { ok: true } });
      return json(200, { data: [] });
    };
    await renderShell('ws1');
    const leave = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Workspace verlassen')!;
    await act(async () => leave.click());
    await flush();
    expect(requests).toContain('POST /api/v1/workspaces/ws1/leave');
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
