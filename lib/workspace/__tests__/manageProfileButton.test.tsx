import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { ManageProfileButton } from '@components/manage/ManageProfileButton';
import nav from '../../../locales/en/nav.json';

const i18n = createInstance();
await i18n.init({ lng: 'en', resources: { en: { nav } }, initAsync: false });

function render(props: Parameters<typeof ManageProfileButton>[0]) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <ManageProfileButton {...props} />
    </I18nextProvider>,
  );
}

describe('Manage profile button', () => {
  it('uses a compact square portrait instead of the circular, blurred avatar', () => {
    const html = render({ name: 'Johannes Gross', role: 'OWNER', image: 'https://example.org/profile.jpg' });
    expect(html).toContain('src="https://example.org/profile.jpg"');
    expect(html).toContain('rounded-md');
    expect(html).toContain('object-cover');
    expect(html).not.toContain('rounded-full');
    expect(html).not.toContain('blur');
    expect(html).toContain('h-auto! gap-1! p-1!');
    expect(html).not.toContain('md:pr-3');
    expect(html).toContain('OWNER');
    expect(html).toContain('aria-label="Profile menu for Johannes Gross"');
  });

  it('keeps a visible initials tile and accessible name without a photo, including on mobile', () => {
    const html = render({ name: '  Ada   Lovelace ' });
    expect(html).toContain('>AL</span>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('MANAGER');
    expect(html).toContain('aria-label="Profile menu for');
  });

  it('handles single and multi-part names without stretching the profile button', () => {
    expect(render({ name: 'Demo' })).toContain('>D</span>');
    expect(render({ name: 'Jean Luc Picard' })).toContain('>JP</span>');
    expect(render({ name: 'Jean Luc Picard' })).toContain('max-w-40 truncate');
  });

  it('shows pending tasks on the profile without changing its padding', () => {
    const html = render({ name: 'Ada', pendingCount: 3 });
    expect(html).toContain('aria-label="Profile menu for Ada, 3 open checklist items"');
    expect(html).toContain('aria-label="3 open checklist items"');
    expect(html).toContain('h-auto! gap-1! p-1!');
    expect(html).toContain('pointer-events-none absolute top-0 right-0');
    expect(render({ name: 'Ada' })).not.toContain('pointer-events-none absolute top-0 right-0');
  });
});
