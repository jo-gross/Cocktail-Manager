import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { AnnouncementBannerList } from '@components/announcements/AnnouncementBannerList';
import { announcementScope } from '@components/announcements/AnnouncementBanner';
import { dismiss, type DismissalStorage } from '@lib/announcements/dismissal';
import type { AnnouncementDto } from '@lib/schemas/announcements';
import common from '../../../locales/en/common.json';

const i18n = createInstance();
await i18n.init({ lng: 'en', resources: { en: { common } }, initAsync: false });

const info: AnnouncementDto = {
  id: 'info-1',
  level: 'info',
  title: { de: 'Neue Funktion', en: 'New feature' },
  body: { de: 'Karten lassen sich jetzt teilen.', en: 'Cards can be shared now.' },
  dismissible: true,
  revision: 'r1',
  endsAt: null,
};
const warning: AnnouncementDto = {
  id: 'warn-1',
  level: 'warning',
  title: null,
  body: { de: 'Wartung am Sonntag.', en: 'Maintenance on Sunday.' },
  dismissible: false,
  revision: 'r1',
  endsAt: '2030-01-01T00:00:00.000Z',
};
const critical: AnnouncementDto = { ...warning, id: 'crit-1', level: 'critical', body: { de: 'Störung.', en: 'Outage.' } };

function render(announcements: AnnouncementDto[], options: { dismissed?: string[]; locale?: string } = {}) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <AnnouncementBannerList announcements={announcements} dismissed={options.dismissed ?? []} locale={options.locale ?? 'en'} onDismiss={() => undefined} />
    </I18nextProvider>,
  );
}

/** Markup of the single banner with this `data-level`. */
function banner(html: string, level: string): string {
  const match = html.match(new RegExp(`<div[^>]*data-level="${level}"[^>]*>`));
  expect(match, `banner with level ${level}`).not.toBeNull();
  return match![0];
}

describe('Announcement banner', () => {
  it('renders nothing without announcements (self-hosted instances)', () => {
    expect(render([])).toBe('');
  });

  it('shows the level as colour', () => {
    const html = render([critical, warning, info]);
    expect(banner(html, 'info')).toContain('bg-info');
    expect(banner(html, 'warning')).toContain('bg-warning');
    expect(banner(html, 'critical')).toContain('bg-error');
  });

  it('announces info politely and interrupts for warnings and critical announcements', () => {
    const html = render([critical, warning, info]);
    expect(banner(html, 'info')).toContain('role="status"');
    expect(banner(html, 'warning')).toContain('role="alert"');
    expect(banner(html, 'critical')).toContain('role="alert"');
  });

  it('shows title and text in the language of the user', () => {
    const english = render([info], { locale: 'en' });
    expect(english).toContain('New feature');
    expect(english).toContain('Cards can be shared now.');
    expect(english).not.toContain('Neue Funktion');

    const german = render([info], { locale: 'de' });
    expect(german).toContain('Neue Funktion');
    expect(german).toContain('Karten lassen sich jetzt teilen.');
    expect(german).not.toContain('New feature');
  });

  it('renders text as text, never as markup', () => {
    const html = render([{ ...info, title: null, body: { de: '<b>x</b>', en: '<script>alert(1)</script>' } }]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('offers the dismiss button only for info announcements', () => {
    expect(render([info])).toContain('aria-label="Dismiss announcement"');
    expect(render([warning, critical])).not.toContain('<button');
  });

  it('hides a dismissed info announcement and keeps the others', () => {
    const storage: DismissalStorage = { getItem: () => null, setItem: () => undefined };
    const dismissed = dismiss(storage, info, []);

    const html = render([warning, info], { dismissed });
    expect(html).not.toContain('New feature');
    expect(html).toContain('Maintenance on Sunday.');
    expect(render([info], { dismissed })).toBe('');
  });

  it('shows a dismissed announcement again after it changed', () => {
    const dismissed = dismiss(null, info, []);
    expect(render([{ ...info, revision: 'r2' }], { dismissed })).toContain('New feature');
  });

  it('ignores a dismissal entry for an announcement that cannot be dismissed', () => {
    expect(render([warning], { dismissed: ['warn-1:r1'] })).toContain('Maintenance on Sunday.');
  });
});

describe('announcementScope', () => {
  it('is the overview on the start page and the workspace inside a workspace', () => {
    expect(announcementScope('/', undefined)).toBeNull();
    expect(announcementScope('/workspaces/[workspaceId]', 'w1')).toBe('w1');
    expect(announcementScope('/workspaces/[workspaceId]/manage/cocktails', 'w1')).toBe('w1');
  });

  it('is undefined on other pages and without a workspace id', () => {
    expect(announcementScope('/signage', undefined)).toBeUndefined();
    expect(announcementScope('/workspaces', undefined)).toBeUndefined();
    expect(announcementScope('/workspaces/[workspaceId]', undefined)).toBeUndefined();
    expect(announcementScope('/workspaces/[workspaceId]', ['a', 'b'])).toBeUndefined();
  });
});
