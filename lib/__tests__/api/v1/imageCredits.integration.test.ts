/**
 * Image credits (`credit` of the image tables): entity APIs (create, keep, clear on a new upload,
 * clone, tenant isolation), backup round trip (also old backups without credits) and the
 * guest menu output.
 */
import { describe, expect, it } from 'vitest';
import prisma from '../../../../prisma/prisma';
import exportHandler from '@lib/backup/exportHandler';
import importHandler from '@lib/backup/importHandler';
import { collectionHandler as glassesHandler, itemHandler as glassHandler, cloneHandler as glassCloneHandler } from '@lib/api/v1/glasses';
import { collectionHandler as garnishesHandler, itemHandler as garnishHandler } from '@lib/api/v1/garnishes';
import { collectionHandler as ingredientsHandler, itemHandler as ingredientHandler } from '@lib/api/v1/ingredients';
import { collectionHandler as cocktailsHandler, itemHandler as cocktailHandler, cloneHandler as cocktailCloneHandler } from '@lib/api/v1/cocktails';
import { loadPublicMenu } from '@lib/guest-menu/public.server';
import { createDefaultGuestMenuDocument } from '@lib/guest-menu/schema';
import { callAs, dataOf, roleUser, seedTenantPair } from '@test/helpers/scenario';
import { seedWorkspace } from '@test/helpers/dbFixtures';
import type { GlassDto } from '@lib/schemas/glasses';
import type { GarnishDto } from '@lib/schemas/garnishes';
import type { IngredientDto } from '@lib/schemas/ingredients';
import type { CocktailDto, CocktailSummaryDto } from '@lib/schemas/cocktails';

const png = (byte: number) => `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, byte]).toString('base64')}`;
const IMAGE_A = png(0x0a);
const IMAGE_B = png(0x0b);
const CREDIT = '"Negroni" by Jane Doe, https://commons.wikimedia.org/wiki/File:Negroni.jpg, CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/';

describe('image credits: entity APIs', () => {
  it('glasses: stored with the image, kept while the image stays, cleared by a new upload, copied by clone', async () => {
    const { a } = await seedTenantPair();
    const manager = roleUser(a, 'MANAGER');
    const query = { workspaceId: a.workspace.id };

    const created = await callAs(manager, glassesHandler, {
      method: 'POST',
      query,
      body: { name: 'Coupe', deposit: 0, image: IMAGE_A, imageCredit: `  ${CREDIT} ` },
    });
    expect(created.status, JSON.stringify(created.json)).toBe(200);
    const glass = dataOf<GlassDto>(created);
    expect(glass.imageCredit).toBe(CREDIT);
    const item = { ...query, glassId: glass.id };

    // Same image re-sent without a credit (older clients): kept.
    const kept = dataOf<GlassDto>(await callAs(manager, glassHandler, { method: 'PUT', query: item, body: { name: 'Coupe', deposit: 0, image: IMAGE_A } }));
    expect(kept.imageCredit).toBe(CREDIT);
    expect(dataOf<GlassDto>(await callAs(manager, glassHandler, { method: 'GET', query: item })).imageCredit).toBe(CREDIT);
    expect(dataOf<GlassDto[]>(await callAs(manager, glassesHandler, { method: 'GET', query })).find((row) => row.id === glass.id)?.imageCredit).toBe(CREDIT);

    const cloned = dataOf<GlassDto>(await callAs(manager, glassCloneHandler, { method: 'POST', query: item, body: { name: 'Coupe 2' } }));
    expect(cloned.imageCredit).toBe(CREDIT);

    // A new image without a credit: the old credit does not belong to it.
    const replaced = dataOf<GlassDto>(await callAs(manager, glassHandler, { method: 'PUT', query: item, body: { name: 'Coupe', deposit: 0, image: IMAGE_B } }));
    expect(replaced.imageCredit).toBeNull();
    expect(await prisma.glassImage.findUniqueOrThrow({ where: { glassId: glass.id } })).toMatchObject({ image: IMAGE_B, credit: null });

    // Explicit credit with the new image; "" clears it; no image → no credit.
    const credited = dataOf<GlassDto>(
      await callAs(manager, glassHandler, { method: 'PUT', query: item, body: { name: 'Coupe', deposit: 0, image: IMAGE_B, imageCredit: 'Photo: me' } }),
    );
    expect(credited.imageCredit).toBe('Photo: me');
    const cleared = dataOf<GlassDto>(
      await callAs(manager, glassHandler, { method: 'PUT', query: item, body: { name: 'Coupe', deposit: 0, image: IMAGE_B, imageCredit: '' } }),
    );
    expect(cleared.imageCredit).toBeNull();
    const removed = dataOf<GlassDto>(
      await callAs(manager, glassHandler, { method: 'PUT', query: item, body: { name: 'Coupe', deposit: 0, imageCredit: 'x' } }),
    );
    expect(removed).toMatchObject({ hasImage: false, imageCredit: null });

    const tooLong = await callAs(manager, glassHandler, {
      method: 'PUT',
      query: item,
      body: { name: 'Coupe', deposit: 0, image: IMAGE_A, imageCredit: 'x'.repeat(1001) },
    });
    expect(tooLong.status).toBe(400);
  });

  it('garnishes and ingredients: credit with the image, cleared by a new upload', async () => {
    const { a } = await seedTenantPair();
    const manager = roleUser(a, 'MANAGER');
    const query = { workspaceId: a.workspace.id };

    const garnish = dataOf<GarnishDto>(
      await callAs(manager, garnishesHandler, { method: 'POST', query, body: { name: 'Zeste', image: IMAGE_A, imageCredit: CREDIT } }),
    );
    expect(garnish.imageCredit).toBe(CREDIT);
    const garnishItem = { ...query, garnishId: garnish.id };
    expect(
      dataOf<GarnishDto>(await callAs(manager, garnishHandler, { method: 'PUT', query: garnishItem, body: { name: 'Zeste', image: IMAGE_A } })).imageCredit,
    ).toBe(CREDIT);
    expect(
      dataOf<GarnishDto>(await callAs(manager, garnishHandler, { method: 'PUT', query: garnishItem, body: { name: 'Zeste', image: IMAGE_B } })).imageCredit,
    ).toBeNull();

    const ingredient = dataOf<IngredientDto>(
      await callAs(manager, ingredientsHandler, { method: 'POST', query, body: { name: 'Gin', image: IMAGE_A, imageCredit: CREDIT } }),
    );
    expect(ingredient.imageCredit).toBe(CREDIT);
    const ingredientItem = { ...query, ingredientId: ingredient.id };
    expect(dataOf<IngredientDto>(await callAs(manager, ingredientHandler, { method: 'GET', query: ingredientItem })).imageCredit).toBe(CREDIT);
    expect(
      dataOf<IngredientDto>(await callAs(manager, ingredientHandler, { method: 'PUT', query: ingredientItem, body: { name: 'Gin', image: IMAGE_A } }))
        .imageCredit,
    ).toBe(CREDIT);
    expect(
      dataOf<IngredientDto>(await callAs(manager, ingredientHandler, { method: 'PUT', query: ingredientItem, body: { name: 'Gin', image: IMAGE_B } }))
        .imageCredit,
    ).toBeNull();
  });

  it('cocktails: detail and list DTO, clone, new upload clears; a foreign tenant cannot change it', async () => {
    const { a, b } = await seedTenantPair();
    const manager = roleUser(a, 'MANAGER');
    const query = { workspaceId: a.workspace.id };

    const cocktail = dataOf<CocktailDto>(
      await callAs(manager, cocktailsHandler, { method: 'POST', query, body: { name: 'Negroni', image: IMAGE_A, imageCredit: CREDIT } }),
    );
    expect(cocktail.imageCredit).toBe(CREDIT);
    const item = { ...query, cocktailId: cocktail.id };
    expect(
      dataOf<CocktailSummaryDto[]>(await callAs(manager, cocktailsHandler, { method: 'GET', query })).find((row) => row.id === cocktail.id)?.imageCredit,
    ).toBe(CREDIT);
    expect(dataOf<CocktailDto>(await callAs(manager, cocktailCloneHandler, { method: 'POST', query: item, body: { name: 'Negroni 2' } })).imageCredit).toBe(
      CREDIT,
    );
    expect(
      dataOf<CocktailDto>(await callAs(manager, cocktailHandler, { method: 'PUT', query: item, body: { name: 'Negroni', image: IMAGE_A } })).imageCredit,
    ).toBe(CREDIT);

    // Tenant B cannot touch A's cocktail (404) and A's credit stays.
    const foreign = await callAs(roleUser(b, 'OWNER'), cocktailHandler, {
      method: 'PUT',
      query: { workspaceId: b.workspace.id, cocktailId: cocktail.id },
      body: { name: 'Hijack', image: IMAGE_B, imageCredit: 'B' },
    });
    expect(foreign.status).toBe(404);
    expect(await prisma.cocktailRecipeImage.findUniqueOrThrow({ where: { cocktailRecipeId: cocktail.id } })).toMatchObject({ image: IMAGE_A, credit: CREDIT });

    const replaced = dataOf<CocktailDto>(await callAs(manager, cocktailHandler, { method: 'PUT', query: item, body: { name: 'Negroni', image: IMAGE_B } }));
    expect(replaced.imageCredit).toBeNull();
  });
});

describe('image credits: backup round trip', () => {
  it('keeps the credits of all image kinds; backups without credits import with none', async () => {
    const { a } = await seedTenantPair();
    const workspaceId = a.workspace.id;
    const glass = await prisma.glass.create({
      data: { workspaceId, name: 'Coupe', deposit: 0, GlassImage: { create: { image: IMAGE_A, credit: 'glass credit' } } },
    });
    await prisma.garnish.create({ data: { workspaceId, name: 'Zeste', GarnishImage: { create: { image: IMAGE_A, credit: 'garnish credit' } } } });
    await prisma.ingredient.create({ data: { workspaceId, name: 'Gin', IngredientImage: { create: { image: IMAGE_A, credit: 'ingredient credit' } } } });
    await prisma.cocktailRecipe.create({
      data: { workspaceId, name: 'Negroni', glassId: glass.id, CocktailRecipeImage: { create: { image: IMAGE_A, credit: CREDIT } } },
    });

    const exported = await callAs(roleUser(a, 'ADMIN'), exportHandler, { method: 'GET', query: { workspaceId } });
    expect(exported.status).toBe(200);
    const backup = exported.json as Record<string, Array<Record<string, unknown>>>;
    expect(backup.cocktailRecipeImage?.[0]).toMatchObject({ credit: CREDIT });

    const credits = async (targetId: string) => ({
      glass: (await prisma.glassImage.findFirst({ where: { glass: { workspaceId: targetId } } }))?.credit,
      garnish: (await prisma.garnishImage.findFirst({ where: { garnish: { workspaceId: targetId } } }))?.credit,
      ingredient: (await prisma.ingredientImage.findFirst({ where: { ingredient: { workspaceId: targetId } } }))?.credit,
      cocktail: (await prisma.cocktailRecipeImage.findFirst({ where: { cocktailRecipe: { workspaceId: targetId } } }))?.credit,
    });

    const target = await seedWorkspace({ users: [{ role: 'ADMIN' }] });
    const imported = await callAs(target.users[0]!, importHandler, {
      method: 'POST',
      query: { workspaceId: target.workspace.id },
      body: JSON.stringify(backup),
    });
    expect(imported.status, JSON.stringify(imported.json)).toBe(200);
    expect(await credits(target.workspace.id)).toEqual(await credits(workspaceId));
    expect(await credits(target.workspace.id)).toEqual({ glass: 'glass credit', garnish: 'garnish credit', ingredient: 'ingredient credit', cocktail: CREDIT });

    // Older backups have no `credit`.
    const legacy = Object.fromEntries(
      Object.entries(backup).map(([key, rows]) => [key, Array.isArray(rows) && /Image/.test(key) ? rows.map(({ credit: _credit, ...row }) => row) : rows]),
    );
    const legacyTarget = await seedWorkspace({ users: [{ role: 'ADMIN' }] });
    const legacyImport = await callAs(legacyTarget.users[0]!, importHandler, {
      method: 'POST',
      query: { workspaceId: legacyTarget.workspace.id },
      body: JSON.stringify(legacy),
    });
    expect(legacyImport.status, JSON.stringify(legacyImport.json)).toBe(200);
    expect(await credits(legacyTarget.workspace.id)).toEqual({ glass: null, garnish: null, ingredient: null, cocktail: null });
  });
});

describe('image credits: guest menu', () => {
  it('shows the credit of shown images (detail caption, footer list), HTML-escaped', async () => {
    const { a } = await seedTenantPair();
    const workspaceId = a.workspace.id;
    const evil = 'Photo by <img src=x onerror=alert(1)> & "Co", CC BY 4.0';
    const cocktail = await prisma.cocktailRecipe.create({
      data: { workspaceId, name: 'Negroni', CocktailRecipeImage: { create: { image: IMAGE_A, credit: evil } } },
    });
    await prisma.cocktailRecipe.create({ data: { workspaceId, name: 'Plain', CocktailRecipeImage: { create: { image: IMAGE_B } } } });
    const card = await prisma.cocktailCard.create({
      data: {
        workspaceId,
        name: 'Karte',
        groups: { create: { name: 'Klassiker', groupNumber: 0, items: { create: [{ cocktailId: cocktail.id, itemNumber: 0 }] } } },
      },
    });
    const document = createDefaultGuestMenuDocument({ title: 'Karte' });
    await prisma.guestMenu.create({
      data: {
        workspaceId,
        name: 'Karte',
        slug: 'karte',
        isDefault: true,
        sourceMode: 'FIXED_CARD',
        sourceCardId: card.id,
        draft: document,
        published: document,
        publishedAt: new Date(),
      },
    });

    const result = await loadPublicMenu({ bar: workspaceId, locale: 'de' });
    expect(result.kind).toBe('menu');
    if (result.kind !== 'menu' || !result.menu) throw new Error('menu expected');
    const { dto, rendered } = result.menu;
    expect(dto.imageCredits).toEqual([{ name: 'Negroni', credit: evil }]);
    const section = dto.blocks.find((block) => block.type === 'section');
    expect(section && section.type === 'section' ? section.items[0]?.imageCredit : undefined).toBe(evil);

    const html = [rendered.footer, ...rendered.sections.flatMap((entry) => entry.items.map((row) => row.detailHtml))].join('\n');
    expect(html).toContain('gm-image-credits');
    expect(html).toContain('gm-image-credit');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
  });
});
