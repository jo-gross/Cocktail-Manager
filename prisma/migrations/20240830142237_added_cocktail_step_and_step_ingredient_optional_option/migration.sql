-- AlterTable
ALTER TABLE "CocktailRecipeIngredient"
    ADD COLUMN "optional" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CocktailRecipeStep"
    ADD COLUMN "optional" BOOLEAN NOT NULL DEFAULT false;
