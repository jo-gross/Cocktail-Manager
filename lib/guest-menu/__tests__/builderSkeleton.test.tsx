import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import en from '../../../locales/en/guestMenu.json';
import de from '../../../locales/de/guestMenu.json';
import { GuestMenuBuilderSkeleton } from '@components/guest-menu/builder/GuestMenuBuilderSkeleton';

const { route } = vi.hoisted(() => ({ route: { query: {} as Record<string, string | string[]> } }));
vi.mock('next/router', () => ({ useRouter: () => route }));
vi.mock('@middleware/ui/withPagePermission', () => ({
  withPagePermission: (_roles: unknown, Component: unknown) => Component,
}));
vi.mock('@components/guest-menu/builder', async () => ({
  GuestMenuBuilderSkeleton: (await import('@components/guest-menu/builder/GuestMenuBuilderSkeleton')).GuestMenuBuilderSkeleton,
  GuestMenuBuilder: () => <div data-testid="loaded-builder" />,
}));

import GuestMenuBuilderPage from '../../../pages/workspaces/[workspaceId]/manage/guest-menus/[id]';

async function render(content: React.ReactNode, language = 'en') {
  const i18n = createInstance();
  await i18n.init({ lng: language, resources: { en: { guestMenu: en }, de: { guestMenu: de } }, defaultNS: 'guestMenu' });
  return renderToStaticMarkup(<I18nextProvider i18n={i18n}>{content}</I18nextProvider>);
}

describe('GuestMenuBuilderSkeleton', () => {
  it.each([
    ['en', en.builder.loading],
    ['de', de.builder.loading],
  ])('announces loading in %s without interactive placeholder controls', async (language, label) => {
    const html = await render(<GuestMenuBuilderSkeleton />, language);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain(`<span role="status" class="sr-only">${label}</span>`);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('motion-reduce:animate-none');
    expect(html).not.toMatch(/<(button|input|select|a)\b/);
    expect(html).not.toContain('role="tab"');
  });

  it('matches the desktop panes and the single-column tablet/mobile breakpoint', async () => {
    const html = await render(<GuestMenuBuilderSkeleton />);
    expect(html).toContain('h-dvh');
    expect(html).toContain('hidden min-h-0 flex-1 lg:flex');
    expect(html).toContain('w-[23rem]');
    expect(html).toContain('w-[22rem]');
    expect(html).toContain('max-w-[414px]');
    expect(html).toContain('lg:hidden');
  });

  it('uses the same skeleton while route parameters are unavailable or invalid', async () => {
    for (const query of [{}, { workspaceId: 'workspace' }, { workspaceId: 'workspace', id: ['menu'] }]) {
      route.query = query;
      const html = await render(<GuestMenuBuilderPage />);
      expect(html).toContain('aria-busy="true"');
      expect(html).not.toContain('loaded-builder');
    }
  });

  it('renders the builder once both route parameters are available', async () => {
    route.query = { workspaceId: 'workspace', id: 'menu' };
    const html = await render(<GuestMenuBuilderPage />);
    expect(html).toContain('loaded-builder');
    expect(html).not.toContain('aria-busy="true"');
  });
});
