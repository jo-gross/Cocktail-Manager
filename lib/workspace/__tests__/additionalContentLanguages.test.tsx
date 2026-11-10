import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { AdditionalContentLanguages } from '@components/settings/AdditionalContentLanguages';
import settings from '../../../locales/de/settings.json';

const i18n = createInstance();
await i18n.init({ lng: 'de', resources: { de: { settings } }, initAsync: false });

function renderLanguages(value: string[]) {
  const names: Record<string, string> = { de: 'Deutsch', en: 'Englisch', fr: 'Französisch' };
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <AdditionalContentLanguages
        inputId="test-languages"
        options={['de', 'en', 'fr']}
        primary="de"
        value={value}
        languageName={(locale) => names[locale] ?? locale}
        onChange={() => undefined}
      />
    </I18nextProvider>,
  );
}

describe('AdditionalContentLanguages', () => {
  it('renders a searchable combobox and a separate list with named remove buttons', () => {
    const html = renderLanguages(['en', 'fr']);
    expect(html).toContain('role="combobox"');
    expect(html).toContain('id="test-languages"');
    expect(html).toContain('aria-label="Weitere Inhaltssprachen"');
    expect(html).toContain('aria-label="Englisch entfernen"');
    expect(html).toContain('aria-label="Französisch entfernen"');
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain('Deutsch entfernen');
  });

  it('explains the empty state without rendering a language list', () => {
    const html = renderLanguages([]);
    expect(html).toContain('Noch keine weiteren Inhaltssprachen hinzugefügt.');
    expect(html).not.toContain('<ul');
    expect(html).not.toContain('type="checkbox"');
  });
});
