/**
 * Read-only report of stored images that new uploads would reject (SVG, HTML,
 * non-data-URI values, oversized). Such images are still served safely
 * (nosniff + sandbox CSP), but should be re-uploaded or removed.
 *
 *   DATABASE_URL=… pnpm exec tsx scripts/check-stored-images.ts
 */
import prisma from '../prisma/prisma';
import { isAllowedImageDataUri } from '../lib/images/imageSchema';

interface Finding {
  table: string;
  id: string;
  workspaceId: string | null;
  reason: string;
}

function classify(value: string | null): string | null {
  if (!value || isAllowedImageDataUri(value)) return null;
  const head = String(value).slice(0, 40);
  if (/^data:image\/svg/i.test(head)) return 'svg';
  if (/^data:image\//i.test(head)) return 'unsupported image type or oversized';
  if (/^data:/i.test(head)) return 'non-image data URI';
  if (/^https?:\/\//i.test(head)) return 'remote URL';
  return 'not a data URI';
}

async function main() {
  const findings: Finding[] = [];
  const push = (table: string, id: string, workspaceId: string | null, value: string | null) => {
    const reason = classify(value);
    if (reason) findings.push({ table, id, workspaceId, reason });
  };

  for (const row of await prisma.glassImage.findMany({ select: { glassId: true, image: true, glass: { select: { workspaceId: true } } } }))
    push('GlassImage', row.glassId, row.glass.workspaceId, row.image);
  for (const row of await prisma.garnishImage.findMany({ select: { garnishId: true, image: true, garnish: { select: { workspaceId: true } } } }))
    push('GarnishImage', row.garnishId, row.garnish.workspaceId, row.image);
  for (const row of await prisma.ingredientImage.findMany({ select: { ingredientId: true, image: true, ingredient: { select: { workspaceId: true } } } }))
    push('IngredientImage', row.ingredientId, row.ingredient.workspaceId, row.image);
  for (const row of await prisma.cocktailRecipeImage.findMany({
    select: { cocktailRecipeId: true, image: true, cocktailRecipe: { select: { workspaceId: true } } },
  }))
    push('CocktailRecipeImage', row.cocktailRecipeId, row.cocktailRecipe.workspaceId, row.image);
  for (const row of await prisma.signageSlide.findMany({ where: { type: 'IMAGE' }, select: { id: true, workspaceId: true, content: true } }))
    push('SignageSlide', row.id, row.workspaceId, row.content);
  for (const row of await prisma.workspace.findMany({ select: { id: true, image: true } })) push('Workspace.image', row.id, row.id, row.image);

  if (findings.length === 0) {
    console.log('All stored images are raster data URIs accepted by the upload validation.');
  } else {
    console.log(`${findings.length} stored image(s) would be rejected by the upload validation:`);
    console.table(findings);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
