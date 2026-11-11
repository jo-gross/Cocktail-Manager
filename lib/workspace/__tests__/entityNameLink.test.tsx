import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EntityNameLink } from '@components/manage/EntityNameLink';

describe('EntityNameLink', () => {
  it('renders a link to the edit target', () => {
    const html = renderToStaticMarkup(
      <EntityNameLink href="/workspaces/ws/manage/cocktails/c1" className="truncate">
        Negroni
      </EntityNameLink>,
    );
    expect(html).toMatch(/^<a /);
    expect(html).toContain('href="/workspaces/ws/manage/cocktails/c1"');
    expect(html).toContain('hover:underline');
    expect(html).toContain('focus-visible:ring-2');
    expect(html).toContain('truncate');
    expect(html).toContain('>Negroni</a>');
  });

  it('renders a button when the edit target is a modal', () => {
    const html = renderToStaticMarkup(<EntityNameLink onClick={() => undefined}>cl</EntityNameLink>);
    expect(html).toMatch(/^<button type="button"/);
    expect(html).toContain('>cl</button>');
  });

  it('renders plain text without an edit target', () => {
    const html = renderToStaticMarkup(<EntityNameLink className="font-bold">Gin</EntityNameLink>);
    expect(html).toBe('<span class="font-bold">Gin</span>');
  });
});
