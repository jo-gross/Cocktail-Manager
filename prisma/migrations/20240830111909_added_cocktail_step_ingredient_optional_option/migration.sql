-- AlterTable
ALTER TABLE "CocktailRecipeIngredient"
    ADD COLUMN "optional" BOOLEAN NOT NULL DEFAULT false;
