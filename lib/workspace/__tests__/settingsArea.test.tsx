import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { Role } from '@generated/prisma/client';
import deSettings from '../../../locales/de/settings.json';
import enSettings from '../../../locales/en/settings.json';
import deCommon from '../../../locales/de/common.json';
import enCommon from '../../../locales/en/common.json';
import { UserContext } from '@lib/context/UserContextProvider';
import { SettingsLayout } from '@components/settings/SettingsLayout';
import { SettingsSection, SettingsSectionSkeleton } from '@components/settings/SettingsSection';
import { SETTINGS_NAV_ITEMS, settingsHref, visibleSettingsNavGroups } from '@components/settings/settingsNavigation';
import { buildEntityLabelKeys } from '@components/settings/EntityLabelTranslationsSection';

vi.mock('next/router', () => ({ useRouter: () => ({ query: { workspaceId: 'ws1' }, asPath: '/workspaces/ws1/manage/settings' }) }));

const ROLE_RANK: Record<Role, number> = { USER: 0, MANAGER: 1, ADMIN: 2, OWNER: 3 };
const permittedAs = (role: Role) => (required: Role) => ROLE_RANK[role] >= ROLE_RANK[required];

async function render(content: React.ReactNode, role: Role = Role.ADMIN, language = 'de') {
  const i18n = createInstance();
  await i18n.init({
    lng: language,
    resources: { de: { settings: deSettings, common: deCommon }, en: { settings: enSettings, common: enCommon } },
    defaultNS: 'settings',
  });
  const userContext = { workspace: { name: 'Test Bar' }, isUserPermitted: permittedAs(role) } as unknown as React.ContextType<typeof UserContext>;
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <UserContext.Provider value={userContext}>{content}</UserContext.Provider>
    </I18nextProvider>,
  );
}

describe('settings navigation', () => {
  it('keeps the legacy URLs for overview, users and API keys', () => {
    expect(settingsHref('ws1', 'general')).toBe('/workspaces/ws1/manage/settings');
    expect(settingsHref('ws1', 'users')).toBe('/workspaces/ws1/manage/settings/users');
    expect(settingsHref('ws1', 'apiKeys')).toBe('/workspaces/ws1/manage/settings/api-keys');
    expect(settingsHref('ws1', 'translations')).toBe('/workspaces/ws1/manage/settings/translations');
  });

  it('puts deleting the workspace on its own admin page instead of the general page', () => {
    expect(settingsHref('ws1', 'danger')).toBe('/workspaces/ws1/manage/settings/danger');
    expect(SETTINGS_NAV_ITEMS.find((item) => item.id === 'danger')).toMatchObject({ group: 'advanced', minRole: Role.ADMIN });
  });

  it('shows every page to admins', () => {
    const ids = visibleSettingsNavGroups(permittedAs(Role.ADMIN)).flatMap((group) => group.items.map((item) => item.id));
    expect(ids).toEqual(SETTINGS_NAV_ITEMS.map((item) => item.id));
  });

  it('only shows member pages to users and managers', () => {
    for (const role of [Role.USER, Role.MANAGER]) {
      const groups = visibleSettingsNavGroups(permittedAs(role));
      expect(groups.flatMap((group) => group.items.map((item) => item.id))).toEqual(['translations', 'users']);
      expect(groups.map((group) => group.group)).toEqual(['content', 'access']);
    }
  });
});

describe('SettingsLayout (SSR)', () => {
  it('renders title, both navigations and marks the active page', async () => {
    const html = await render(
      <SettingsLayout page="languages">
        <p>content</p>
      </SettingsLayout>,
    );
    expect(html).toContain(`<h1 class="text-2xl font-bold">${deSettings.pages.languages.title}</h1>`);
    expect(html).toContain(deSettings.pages.languages.description);
    expect(html.match(new RegExp(`<nav aria-label="${deSettings.area.navLabel}"`, 'g'))).toHaveLength(2);
    // Sidebar (≥lg) and horizontal tab bar (mobile) each mark the active link.
    expect(html.match(/aria-current="page"/g)).toHaveLength(2);
    expect(html.match(/<a aria-current="page"[^>]*href="\/workspaces\/ws1\/manage\/settings\/languages"/g)).toHaveLength(2);
    expect(html).toContain('hidden w-60 shrink-0 lg:sticky lg:top-24 lg:block');
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('max-w-4xl');
    expect(html).toContain('Test Bar');
    expect(html).toContain('<p>content</p>');
  });

  it('hides admin-only pages from regular users', async () => {
    const html = await render(<SettingsLayout page="users">x</SettingsLayout>, Role.USER, 'en');
    expect(html).toContain('href="/workspaces/ws1/manage/settings/users"');
    expect(html).toContain('href="/workspaces/ws1/manage/settings/translations"');
    expect(html).not.toContain('href="/workspaces/ws1/manage/settings/api-keys"');
    expect(html).not.toContain('href="/workspaces/ws1/manage/settings/data"');
    expect(html).not.toContain('href="/workspaces/ws1/manage/settings/danger"');
    expect(html).not.toContain('href="/workspaces/ws1/manage/settings"');
    expect(html).toContain(enSettings.pages.users.title);
  });

  it('lets wide pages use the full width', async () => {
    const html = await render(
      <SettingsLayout page="translations" wide>
        x
      </SettingsLayout>,
    );
    expect(html).not.toContain('max-w-4xl');
  });
});

describe('SettingsSection', () => {
  it('labels the section by its heading and renders actions and footer', async () => {
    const html = await render(
      <SettingsSection title="Units" description="Help" actions={<button>Add</button>} footer={<button>Save</button>}>
        body
      </SettingsSection>,
    );
    const id = html.match(/<section aria-labelledby="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`<h2 id="${id}"`);
    expect(html).toContain('<button>Add</button>');
    expect(html).toContain('<button>Save</button>');
  });

  it('renders an announced skeleton without interactive controls', async () => {
    const html = await render(<SettingsSectionSkeleton rows={2} />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(`<span role="status" class="sr-only">${deCommon.loadingShort}</span>`);
    expect(html).not.toMatch(/<(button|input|select|a)\b/);
  });
});

describe('buildEntityLabelKeys', () => {
  it('deduplicates and sorts keys per kind', () => {
    const keys = buildEntityLabelKeys(
      [
        { name: 'SHAKE', actionGroup: 'MIXING' },
        { name: 'STIR', actionGroup: 'MIXING' },
        { name: 'POUR', actionGroup: 'ADDING' },
      ],
      [{ name: 'CL' }, { name: 'CL' }, { name: 'DASH' }],
      [{ name: 'CRUSHED' }, { name: '' }],
    );
    expect(keys).toEqual({ action: ['POUR', 'SHAKE', 'STIR'], actionGroup: ['ADDING', 'MIXING'], unit: ['CL', 'DASH'], ice: ['CRUSHED'] });
  });
});

describe('label languages', () => {
  it('follow the content languages (primary first, no duplicates) instead of the app UI languages', async () => {
    const { labelLocales } = await import('@components/settings/useContentLocales');
    expect(labelLocales({ primary: 'de', additional: [] })).toEqual(['de']);
    expect(labelLocales({ primary: 'de', additional: ['fr', 'de', 'it'] })).toEqual(['de', 'fr', 'it']);
  });
});
