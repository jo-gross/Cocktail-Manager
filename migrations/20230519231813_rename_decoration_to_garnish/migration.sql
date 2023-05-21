ALTER TABLE "Decoration"
    RENAME TO "Garnish";

ALTER TABLE "Garnish"
    RENAME CONSTRAINT "Decoration_pkey" TO "Garnish_pkey";

ALTER TABLE "Garnish"
    ADD COLUMN "description" TEXT;

-- RenameForeignKey
ALTER TABLE "CocktailRecipe"
    RENAME CONSTRAINT "CocktailRecipe_decorationId_fkey" TO "CocktailRecipe_garnishId_fkey";

ALTER TABLE "CocktailRecipe"
    RENAME COLUMN "decorationId" TO "garnishId";
