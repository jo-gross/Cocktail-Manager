-- Attribution of an image (author, source, license), e.g. from a template with CC BY / CC BY-SA photos.
-- AlterTable
ALTER TABLE "CocktailRecipeImage" ADD COLUMN "credit" TEXT;

-- AlterTable
ALTER TABLE "GarnishImage" ADD COLUMN "credit" TEXT;

-- AlterTable
ALTER TABLE "GlassImage" ADD COLUMN "credit" TEXT;

-- AlterTable
ALTER TABLE "IngredientImage" ADD COLUMN "credit" TEXT;
