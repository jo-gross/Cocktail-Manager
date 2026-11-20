// @vitest-environment jsdom
/**
 * The public monitor page (`pages/signage.tsx`): only the feed's own `503 WORKSPACE_UNAVAILABLE` and
 * `402 PLAN_FEATURE_MISSING` replace the slides; any other failure (a reverse proxy's 503 page) keeps them.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/router', () => ({ useRouter: () => ({ query: { id: 'ws1' } }) }));
vi.mock('react-i18next', () => {
  const translation = { t: (key: string) => key };
  return { useTranslation: () => translation };
});
vi.mock('@lib/alertService', () => ({ alertService: { error: vi.fn() } }));
vi.mock('@lib/signage/isSlideActiveNow', () => ({ filterSlidesForDisplay: (slides: unknown[]) => slides }));
vi.mock('@components/signage/SignageSlideDisplay', () => ({
  SignageSlideDisplay: ({ slides }: { slides: unknown[] }) => <div data-testid="slides">{`${slides.length} slides`}</div>,
}));

const POLL_MS = 5 * 60 * 1000;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const proxyPage = () =>
  new Response('<html><body>503 Service Temporarily Unavailable</body></html>', { status: 503, headers: { 'Content-Type': 'text/html' } });
const feed = () => json(200, { content: { slides: [{ id: 's1' }, { id: 's2' }], slideDurationSeconds: 10, backgroundMode: 'COLOR' } });

let container: HTMLDivElement;
let root: Root;
/** What the feed answers now. */
let answer: () => Response = feed;

async function flush() {
  for (let i = 0; i < 5; i++) await act(async () => undefined);
}

async function mount(response: () => Response) {
  answer = response;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => answer()),
  );
  const { default: SignagePage } = await import('../../../pages/signage');
  await act(async () => root.render(<SignagePage />));
  await flush();
}

async function poll(response: () => Response) {
  answer = response;
  await act(async () => void vi.advanceTimersByTime(POLL_MS));
  await flush();
}

describe('signage page', () => {
  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }));
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps the slides when a poll gets a reverse proxy's 503 page", async () => {
    await mount(feed);
    expect(container.textContent).toContain('2 slides');
    await poll(proxyPage);
    expect(container.textContent).toContain('2 slides');
    expect(container.textContent).not.toContain('plan:signage.unavailable');
  });

  it('keeps the slides for a 503 or 402 that is not the feed’s own answer', async () => {
    await mount(feed);
    await poll(() => json(503, { error: { code: 'SERVICE_UNAVAILABLE' } }));
    expect(container.textContent).not.toContain('plan:signage.unavailable');
    await poll(() => json(402, { error: { code: 'PAYMENT_REQUIRED' } }));
    expect(container.textContent).not.toContain('plan:signage.planRequired');
  });

  it('shows "currently not available" for 503 WORKSPACE_UNAVAILABLE and the slides again afterwards', async () => {
    await mount(feed);
    await poll(() => json(503, { error: { code: 'WORKSPACE_UNAVAILABLE', message: 'Currently not available' } }));
    expect(container.textContent).toContain('plan:signage.unavailable');
    expect(container.textContent).not.toContain('slides');
    await poll(feed);
    expect(container.textContent).toContain('2 slides');
  });

  it('shows "plan required" for 402 PLAN_FEATURE_MISSING', async () => {
    await mount(() => json(402, { error: { code: 'PLAN_FEATURE_MISSING', issues: { key: 'signage', limit: null, current: null } } }));
    expect(container.textContent).toContain('plan:signage.planRequired');
  });
});
