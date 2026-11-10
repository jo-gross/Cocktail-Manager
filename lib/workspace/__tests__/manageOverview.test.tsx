import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import en from '../../../locales/en/nav.json';
import { UserContext } from '@lib/context/UserContextProvider';
import type { Role } from '@generated/prisma/client';

vi.mock('next/router', () => ({ useRouter: () => ({ query: { workspaceId: 'ws' }, replace: vi.fn() }) }));
vi.mock('@lib/auth-client', () => ({ authClient: { signOut: vi.fn() } }));

import ManagePage from '../../../pages/workspaces/[workspaceId]/manage/index';

const roleRank: Record<string, number> = { USER: 0, MANAGER: 1, ADMIN: 2, OWNER: 3 };

async function render(role: Role) {
  const i18n = createInstance();
  await i18n.init({ lng: 'en', resources: { en: { nav: en } }, defaultNS: 'nav' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const context = { workspace: undefined, user: undefined, isUserPermitted: (required: Role) => roleRank[role] >= roleRank[required] } as any;
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <UserContext.Provider value={context}>
        <ManagePage />
      </UserContext.Provider>
    </I18nextProvider>,
  );
}

describe('Manage overview', () => {
  it('renders all groups as labelled lists without quick actions for admins', async () => {
    const html = await render('ADMIN' as Role);
    for (const heading of Object.values(en.section)) {
      expect(html).toContain(heading.replace('&', '&amp;'));
    }
    expect(html.match(/<section aria-labelledby=/g)).toHaveLength(5);
    expect(html).toContain(en.overview.description.cocktails);
    // Workspace = a single settings entry (members, languages and API keys live in the settings area).
    expect(html).toContain('href="/workspaces/ws/manage/settings"');
    expect(html).not.toContain('href="/workspaces/ws/manage/settings/api-keys"');
    expect(html).not.toContain('href="/workspaces/ws/manage/settings/users"');
    expect(html).not.toContain('href="/workspaces/ws/manage/cocktails/create"');
    expect(html).not.toContain('/manage/settings/languages');
    expect(html).not.toContain('/manage/translations');
  });

  it('hides manager and admin entries for regular users and links them to the members page', async () => {
    const html = await render('USER' as Role);
    expect(html.match(/<section aria-labelledby=/g)).toHaveLength(4);
    expect(html).not.toContain(en.section.display.replace('&', '&amp;'));
    expect(html).not.toContain('href="/workspaces/ws/manage/cards"');
    expect(html).not.toContain('href="/workspaces/ws/manage/settings"');
    expect(html).toContain('href="/workspaces/ws/manage/settings/users"');
    expect(html).toContain('href="/workspaces/ws/manage/tags"');
  });
});
