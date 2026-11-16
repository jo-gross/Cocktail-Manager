import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import en from '../../../locales/en/nav.json';
import { UserContext } from '@lib/context/UserContextProvider';
import type { Role } from '@generated/prisma/client';
import type { OnboardingChecklistItem } from '@lib/network/onboarding';
import { useOnboardingStatus } from '@components/tour/useOnboardingStatus';

vi.mock('next/router', () => ({ useRouter: () => ({ query: { workspaceId: 'ws' }, replace: vi.fn() }) }));
vi.mock('@lib/auth-client', () => ({ authClient: { signOut: vi.fn() } }));
vi.mock('@components/tour/useOnboardingStatus', () => ({ useOnboardingStatus: vi.fn() }));

import ManagePage from '../../../pages/workspaces/[workspaceId]/manage/index';

const roleRank: Record<string, number> = { USER: 0, MANAGER: 1, ADMIN: 2, OWNER: 3 };

async function render(role: Role, checklist: OnboardingChecklistItem[] = []) {
  vi.mocked(useOnboardingStatus).mockReturnValue({
    status: { setupCompletedAt: null, checklist },
    setStatus: vi.fn(),
    loading: false,
    failed: false,
  });
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
  it('aligns the full-width language switch with the other profile menu entries', async () => {
    const html = await render('ADMIN' as Role);
    expect(html).toContain('block w-64 p-2!');
    expect(html.match(/<button[^>]*class="[^"]*min-w-0 flex-1/g)).toHaveLength(2);
    expect(html).not.toContain('flex justify-center px-1 py-1');
  });

  it('renders all groups as labelled lists without quick actions for admins', async () => {
    const html = await render('ADMIN' as Role);
    for (const [key, heading] of Object.entries(en.section)) {
      if (key === 'help') continue;
      expect(html).toContain(heading.replace('&', '&amp;'));
    }
    // Recipes, guest info, display, numbers, workspace. Help is in the profile menu only.
    expect(html.match(/<section aria-labelledby=/g)).toHaveLength(5);
    expect(html.match(/href="\/workspaces\/ws\/manage\/help"/g)).toHaveLength(1);
    expect(html).toContain('data-tour="manage.help"');
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
    // Help & tutorials is available for every role
    expect(html).toContain('href="/workspaces/ws/manage/help"');
    expect(html).not.toContain(en.section.display.replace('&', '&amp;'));
    expect(html).not.toContain('href="/workspaces/ws/manage/cards"');
    expect(html).not.toContain('href="/workspaces/ws/manage/settings"');
    expect(html).toContain('href="/workspaces/ws/manage/settings/users"');
    expect(html).toContain('href="/workspaces/ws/manage/tags"');
  });

  it('shows the open checklist count on both the profile and help entry, excluding skipped points', async () => {
    const checklist: OnboardingChecklistItem[] = [
      { id: 'glasses', done: true, skipped: false, open: 0 },
      { id: 'team', done: false, skipped: true, open: 1 },
      { id: 'prices', done: false, skipped: false, open: 10 },
      { id: 'guestInfo', done: false, skipped: false, open: 20 },
    ];
    const html = await render('MANAGER' as Role, checklist);
    expect(html.match(/aria-label="2 open checklist items"/g)).toHaveLength(2);
    expect(html).toContain(', 2 open checklist items"');

    const settled = await render(
      'MANAGER' as Role,
      checklist.map((item) => ({ ...item, skipped: true })),
    );
    expect(settled).not.toContain('aria-label="2 open checklist items"');
    expect(settled).not.toContain('pointer-events-none absolute top-0 right-0');
  });

  it('does not notify regular users about setup tasks they cannot manage', async () => {
    const html = await render('USER' as Role, [{ id: 'team', done: false, skipped: false, open: 1 }]);
    expect(html).not.toContain('1 open checklist item');
    expect(useOnboardingStatus).toHaveBeenLastCalledWith('ws', false);
  });
});
