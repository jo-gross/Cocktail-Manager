import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { GuestMenuShell } from '@components/guest-menu/shell';
import { renderMenuSlots } from '../render';
import { resolveTemplate } from '../templates';
import { buildPublicMenuDto } from '../resolveCore';
import { buildInput, cocktail, manualDocument, resolverData } from './fixtures';

const ids = Array.from({ length: 12 }, (_, i) => `c${i}`);
const data = resolverData(
  ids.map((id, i) => cocktail({ id, name: `Drink ${i}`, tags: [i % 2 ? 'sour' : 'sweet'], price: 8 + i })),
  {
    tagCategories: [{ id: 'taste', name: { de: 'Geschmack' }, order: 0, showAsGuestFilter: true }],
    tagDefinitions: [
      { tag: 'sour', label: { de: 'Sauer' }, categoryId: 'taste', color: null, isPublic: true },
      { tag: 'sweet', label: { de: 'Süß' }, categoryId: 'taste', color: null, isPublic: true },
    ],
  },
);

describe('GuestMenuShell (SSR)', () => {
  it('renders search, quick chips, filter button and items', () => {
    const doc = manualDocument(ids);
    const { dto } = buildPublicMenuDto(buildInput(doc), data);
    const rendered = renderMenuSlots(dto, resolveTemplate(doc.templates.web), 'web');
    const html = renderToString(<GuestMenuShell dto={dto} rendered={rendered} onLocaleChange={() => undefined} />);
    expect(html).toContain('class="gm-root gm-shell"');
    expect(html).toContain('data-gm="menu1"');
    expect(html).toContain('type="search"');
    expect(html).toContain('Sauer');
    expect(html).toContain('Filter');
    expect(html).toContain('data-item-id="c0"');
    expect(html).toContain('Drink 11');
    // Language switcher: de + en available.
    expect(html).toContain('<select');
  });

  it('applies the initial search state and renders on-request results', () => {
    const doc = manualDocument(ids.slice(0, 3), (d) => {
      d.outputs.web.search.includeOnRequest = true;
    });
    const { dto } = buildPublicMenuDto(buildInput(doc), data);
    const rendered = renderMenuSlots(dto, resolveTemplate(doc.templates.web), 'web');
    const html = renderToString(<GuestMenuShell dto={dto} rendered={rendered} initialState={{ query: 'drink 1' }} />);
    expect(html).toContain('Drink 1');
    expect(html).toContain('Auf Anfrage');
    expect(html).toContain('Drink 10');
    // < 10 menu items: no filter button.
    expect(html).not.toContain('aria-haspopup="dialog" class');
  });

  it('renders statically for print', () => {
    const doc = manualDocument(ids.slice(0, 2));
    const { dto } = buildPublicMenuDto(buildInput(doc, { output: 'print' }), data);
    const rendered = renderMenuSlots(dto, resolveTemplate(doc.templates.print), 'print');
    const html = renderToString(<GuestMenuShell dto={dto} rendered={rendered} />);
    expect(html).not.toContain('type="search"');
    expect(html).not.toContain('role="button"');
  });
});
