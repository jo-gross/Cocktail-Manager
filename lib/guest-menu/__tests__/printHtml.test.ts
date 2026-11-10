import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { GuestMenu, Workspace } from '@generated/prisma/client';
import { buildPublicMenuDto } from '../resolveCore';
import { renderMenuSlots } from '../render';
import { resolveTemplate } from '../templates';
import type { RenderGuestMenuInput } from '../server';
import { buildInput, cocktail, manualDocument, resolverData } from './fixtures';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

vi.mock('../../../prisma/prisma', () => ({
  default: {
    cocktailRecipeImage: { findMany: vi.fn(async () => [{ cocktailRecipeId: 'c1', image: PNG }]) },
    workspace: { findUnique: vi.fn(async () => ({ image: null })) },
    workspaceSetting: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock('../server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server')>();
  return {
    ...actual,
    renderGuestMenu: vi.fn(async (input: RenderGuestMenuInput) => {
      const { dto, meta } = buildPublicMenuDto(
        buildInput(input.document, { output: input.output, locale: input.locale, workspace: input.workspace }),
        resolverData([cocktail({ id: 'c1', name: 'Negroni', hasImage: true })]),
      );
      const rendered = renderMenuSlots(dto, resolveTemplate(input.document.templates[input.output]), input.output);
      return { dto, rendered, meta };
    }),
  };
});

const { buildGuestMenuPrintHtml, buildTableTentHtml } = await import('../print/print.server');

const workspace = { id: 'ws1', name: 'Bar', publicSlug: 'bar', image: null } as unknown as Workspace;

function menuWith(document: unknown): GuestMenu {
  return { id: 'menu1', slug: 'abend', name: 'Abendkarte', draft: document, published: null, locales: [] } as unknown as GuestMenu;
}

describe('guest menu print html', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://cocktails.example';
  });

  const document = manualDocument(['c1'], (doc) => {
    doc.theme.logo = PNG;
    doc.theme.tokens.fontHeading = 'playfair-display';
    doc.theme.tokens.fontBody = 'lora';
    doc.templates.print = { templateId: 'print-elegant' };
    doc.outputs.print.fields = { ...doc.outputs.print.fields, image: 'list' };
  });

  it('builds a self-contained document with inlined images, fonts and QR code', async () => {
    const result = await buildGuestMenuPrintHtml(workspace, menuWith(document), { source: 'draft', paper: 'DL', showQrCode: true });
    expect(result.paper).toBe('DL');
    expect(result.html).toMatch(/^<!DOCTYPE html>/);
    expect(result.html).toContain('size: 99mm 210mm');
    expect(result.html).toContain('Negroni');
    expect(result.html).not.toContain('/api/public/images');
    expect(result.html).toContain('data:image/png;base64,');
    expect(result.html).toContain('data:font/woff2;base64,');
    expect(result.html).not.toContain('cdn.tailwindcss.com');
    expect(result.html).toContain('<svg');
    expect(result.html).toContain('cocktails.example/m/bar/abend');
    expect(result.fileName).toBe('abend-dl-de.pdf');
    expect(result.html).toContain(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'">`,
    );
  });

  it('omits the QR code when disabled', async () => {
    const result = await buildGuestMenuPrintHtml(workspace, menuWith(document), { source: 'draft', showQrCode: false });
    expect(result.html).not.toContain('class="gm-print-qr-code"');
    expect(result.paper).toBe(document.outputs.print.paper);
  });

  it('throws 404 for an unpublished menu', async () => {
    await expect(buildGuestMenuPrintHtml(workspace, menuWith(document), { source: 'published' })).rejects.toMatchObject({ status: 404 });
  });

  it('builds a localized table tent', async () => {
    const de = await buildTableTentHtml(workspace, menuWith(document), { target: 'bar', paper: 'A6' });
    expect(de.html).toContain('Unsere Karte');
    expect(de.html).toContain('size: 105mm 148mm');
    expect(de.html).toContain('cocktails.example/m/bar<');
    const en = await buildTableTentHtml(workspace, menuWith(document), { target: 'menu', locale: 'en', paper: 'A5' });
    expect(en.html).toContain('Our menu');
    expect(en.html).toContain('cocktails.example/m/bar/abend');
  });

  it('inlines the workspace fallback logo in print and table tents', async () => {
    const prisma = (await import('../../../prisma/prisma')).default;
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce({ image: PNG } as Workspace);
    const document = manualDocument([]);
    const branded = { ...workspace, image: PNG };
    const result = await buildGuestMenuPrintHtml(branded, menuWith(document), { source: 'draft', showQrCode: false });
    expect(result.html).toContain(PNG);
    expect(result.html).not.toContain('/workspace-logo/');
    const tent = await buildTableTentHtml(branded, menuWith(document), { target: 'bar' });
    expect(tent.html).toContain(PNG);
  });
});
