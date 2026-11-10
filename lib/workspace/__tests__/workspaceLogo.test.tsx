import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { WorkspaceLogo } from '@components/workspaces/WorkspaceLogo';
import settings from '../../../locales/de/settings.json';

const i18n = createInstance();
await i18n.init({ lng: 'de', resources: { de: { settings } }, initAsync: false });

function renderLogo(image: string | null) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <WorkspaceLogo name="Bar" image={image} />
    </I18nextProvider>,
  );
}

describe('WorkspaceLogo', () => {
  it('does not mistake relative image paths for legacy base64 data', () => {
    expect(renderLogo('/api/private/image')).toContain('src="/api/private/image"');
    expect(renderLogo('/images/logo.png')).toContain('src="/images/logo.png"');
  });

  it('supports uploaded logos, URLs and legacy raw base64', () => {
    expect(renderLogo('data:image/png;base64,AAAA')).toContain('src="data:image/png;base64,AAAA"');
    expect(renderLogo('https://example.org/logo.png')).toContain('src="https://example.org/logo.png"');
    expect(renderLogo('iVBORw0KGgo=')).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(renderLogo('/9j/AAAA')).toContain('src="data:image/png;base64,/9j/AAAA"');
  });

  it('renders nothing if no workspace logo has been set', () => {
    expect(renderLogo(null)).toBe('');
  });
});
